/**
 * WebSocket bridge for Python backend integration
 * Handles communication between Python agents and WebSocket clients
 */

import { websocketManager } from './websocket-server';
import { pythonAPI } from './python-api';

export interface PythonAgentUpdate {
  workflow_id: string;
  agent_id: string;
  status: 'idle' | 'processing' | 'completed' | 'error' | 'waiting_input';
  progress: number;
  message: string;
  current_task?: string;
  requires_response?: boolean;
  response_data?: any;
}

export interface PythonWorkflowUpdate {
  workflow_id: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  controls: {
    canPause: boolean;
    canResume: boolean;
    canCancel: boolean;
  };
  progress?: {
    total_steps: number;
    completed_steps: number;
    current_step: string;
    progress_percentage: number;
    estimated_time_remaining?: number;
  };
}

export interface PythonProgressUpdate {
  workflow_id: string;
  total_steps: number;
  completed_steps: number;
  current_step: string;
  progress_percentage: number;
  estimated_time_remaining?: number;
  step_details?: {
    step_name: string;
    step_description: string;
    step_progress: number;
  };
}

class WorkflowWebSocketBridge {
  private pythonUpdateInterval: NodeJS.Timeout | null = null;
  private activeWorkflows = new Set<string>();
  private workflowLastUpdate = new Map<string, number>();
  private userResponseQueue = new Map<string, Map<string, string>>(); // workflowId -> agentId -> response

  /**
   * Start monitoring Python backend for workflow updates
   */
  startMonitoring() {
    if (this.pythonUpdateInterval) {
      return; // Already monitoring
    }

    console.log('Starting WebSocket bridge monitoring for Python backend');

    // Poll Python backend for updates every 2 seconds
    this.pythonUpdateInterval = setInterval(async () => {
      await this.pollPythonUpdates();
    }, 2000);
  }

  /**
   * Stop monitoring Python backend
   */
  stopMonitoring() {
    if (this.pythonUpdateInterval) {
      clearInterval(this.pythonUpdateInterval);
      this.pythonUpdateInterval = null;
      logger.info('Stopped WebSocket bridge monitoring', {
        component: 'websocket-bridge'
      });
    }
  }

  /**
   * Register a workflow for monitoring
   */
  registerWorkflow(workflowId: string) {
    this.activeWorkflows.add(workflowId);
    logger.info('Registered workflow for monitoring', {
      workflowId,
      component: 'websocket-bridge'
    });
  }

  /**
   * Unregister a workflow from monitoring
   */
  unregisterWorkflow(workflowId: string) {
    this.activeWorkflows.delete(workflowId);
    logger.info('Unregistered workflow from monitoring', {
      workflowId,
      component: 'websocket-bridge'
    });
  }

  /**
   * Send user response to Python backend
   */
  async sendUserResponseToPython(workflowId: string, agentId: string, response: string) {
    try {
      // Store response in queue for Python backend to retrieve
      if (!this.userResponseQueue.has(workflowId)) {
        this.userResponseQueue.set(workflowId, new Map());
      }
      this.userResponseQueue.get(workflowId)!.set(agentId, response);

      // Also send via API for immediate processing
      const apiResponse = await fetch('/api/workflows/sync/user-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow_id: workflowId,
          agent_id: agentId,
          response: response,
          timestamp: new Date().toISOString()
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`HTTP ${apiResponse.status}: ${apiResponse.statusText}`);
      }

      logger.info('Sent user response to backend', {
        workflowId,
        agentId,
        component: 'websocket-bridge'
      });
      
      // Broadcast success notification
      websocketManager.broadcastSystemNotification(workflowId, {
        level: 'success',
        message: `Response sent to ${agentId}`,
        details: { agentId, response }
      });

    } catch (error) {
      console.error('Failed to send user response to backend:', error);
      
      // Broadcast error to WebSocket clients
      websocketManager.broadcastSystemNotification(workflowId, {
        level: 'error',
        message: 'Failed to send response to agent. Please try again.',
        details: { agentId, error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  /**
   * Get user response from queue (for Python backend to retrieve)
   */
  getUserResponse(workflowId: string, agentId: string): string | null {
    const workflowResponses = this.userResponseQueue.get(workflowId);
    if (!workflowResponses) return null;

    const response = workflowResponses.get(agentId);
    if (response) {
      // Remove response after retrieval
      workflowResponses.delete(agentId);
      if (workflowResponses.size === 0) {
        this.userResponseQueue.delete(workflowId);
      }
    }
    return response || null;
  }

  /**
   * Broadcast agent status update from Python backend
   */
  broadcastAgentUpdate(update: PythonAgentUpdate) {
    websocketManager.broadcastAgentStatus(update.workflow_id, {
      agentId: update.agent_id,
      status: update.status,
      progress: update.progress,
      message: update.message,
      currentTask: update.current_task
    });

    // If agent requires user input, send a message
    if (update.requires_response) {
      websocketManager.broadcastAgentMessage(update.workflow_id, {
        agentId: update.agent_id,
        message: update.message,
        requiresResponse: true
      });
    }
  }

  /**
   * Broadcast workflow status update from Python backend
   */
  broadcastWorkflowUpdate(update: PythonWorkflowUpdate) {
    websocketManager.broadcastWorkflowStatus(update.workflow_id, {
      status: update.status,
      controls: update.controls,
      progress: update.progress ? {
        totalSteps: update.progress.total_steps,
        completedSteps: update.progress.completed_steps,
        currentStep: update.progress.current_step,
        progressPercentage: update.progress.progress_percentage,
        estimatedTimeRemaining: update.progress.estimated_time_remaining
      } : undefined
    });
  }

  /**
   * Broadcast workflow progress update from Python backend
   */
  broadcastProgressUpdate(update: PythonProgressUpdate) {
    websocketManager.broadcastWorkflowProgress(update.workflow_id, {
      totalSteps: update.total_steps,
      completedSteps: update.completed_steps,
      currentStep: update.current_step,
      progressPercentage: update.progress_percentage,
      estimatedTimeRemaining: update.estimated_time_remaining
    });
  }

  /**
   * Poll Python backend for workflow and agent updates
   */
  private async pollPythonUpdates() {
    if (this.activeWorkflows.size === 0) {
      return; // No workflows to monitor
    }

    try {
      // Get updates for all active workflows
      const workflowIds = Array.from(this.activeWorkflows);
      
      for (const workflowId of workflowIds) {
        await this.pollWorkflowUpdates(workflowId);
      }

    } catch (error) {
      console.error('Error polling Python backend for updates:', error);
    }
  }

  /**
   * Poll updates for a specific workflow
   */
  private async pollWorkflowUpdates(workflowId: string) {
    try {
      // Check if workflow is still active in WebSocket connections
      const connectionCount = websocketManager.getConnectionCount(workflowId);
      if (connectionCount === 0) {
        this.unregisterWorkflow(workflowId);
        return;
      }

      // Get workflow status from local API (which may sync with Python backend)
      const workflowResponse = await fetch(`/api/workflows/sync/status/${workflowId}`);
      
      if (workflowResponse.ok) {
        const workflowData = await workflowResponse.json();
        const workflowUpdate: PythonWorkflowUpdate = {
          workflow_id: workflowId,
          status: workflowData.status,
          controls: workflowData.controls || {
            canPause: true,
            canResume: false,
            canCancel: true
          }
        };

        this.broadcastWorkflowUpdate(workflowUpdate);
      }

      // Get agent updates from local API (which may sync with Python backend)
      const agentResponse = await fetch(`/api/workflows/sync/agents/${workflowId}`);
      
      if (agentResponse.ok) {
        const agentData = await agentResponse.json();
        if (agentData.agents && Array.isArray(agentData.agents)) {
          for (const agentUpdate of agentData.agents) {
          const pythonAgentUpdate: PythonAgentUpdate = {
            workflow_id: workflowId,
            agent_id: agentUpdate.agent_id,
            status: agentUpdate.status,
            progress: agentUpdate.progress || 0,
            message: agentUpdate.message || '',
            current_task: agentUpdate.current_task,
            requires_response: agentUpdate.requires_response || false,
            response_data: agentUpdate.response_data
          };

          this.broadcastAgentUpdate(pythonAgentUpdate);
          }
        }
      }

    } catch (error) {
      // Only log error if it's not a 404 (workflow not found)
      if (error && typeof error === 'object' && 'status' in error) {
        const fetchError = error as { status: number };
        if (fetchError.status !== 404) {
          console.error(`Error polling updates for workflow ${workflowId}:`, error);
        }
      } else {
        console.error(`Error polling updates for workflow ${workflowId}:`, error);
      }
    }
  }

  /**
   * Handle user interaction from WebSocket
   */
  async handleUserInteraction(workflowId: string, agentId: string, response: string) {
    // Send response to Python backend
    await this.sendUserResponseToPython(workflowId, agentId, response);

    // Broadcast confirmation to WebSocket clients
    websocketManager.broadcastAgentMessage(workflowId, {
      agentId: agentId,
      message: `Response sent: ${response}`,
      requiresResponse: false
    });
  }

  /**
   * Get active workflow count
   */
  getActiveWorkflowCount(): number {
    return this.activeWorkflows.size;
  }

  /**
   * Get list of active workflows
   */
  getActiveWorkflows(): string[] {
    return Array.from(this.activeWorkflows);
  }
}

/**
 * Simulate agent workflow for testing purposes
 */
export async function simulateAgentWorkflow(workflowId: string, agentConfig: any) {
  logger.info('Starting simulated workflow', {
    workflowId,
    component: 'websocket-bridge'
  });
  
  // Register workflow for monitoring
  workflowWebSocketBridge.registerWorkflow(workflowId);
  
  // Simulate workflow progress
  const steps = [
    'Initializing agents',
    'Analyzing tender document', 
    'Generating content',
    'Reviewing output',
    'Finalizing proposal'
  ];
  
  for (let i = 0; i < steps.length; i++) {
    const progress = Math.round(((i + 1) / steps.length) * 100);
    
    // Broadcast progress update
    workflowWebSocketBridge.broadcastProgressUpdate({
      workflow_id: workflowId,
      total_steps: steps.length,
      completed_steps: i + 1,
      current_step: steps[i],
      progress_percentage: progress,
      estimated_time_remaining: (steps.length - i - 1) * 2000
    });
    
    // Simulate agent activity
    workflowWebSocketBridge.broadcastAgentUpdate({
      workflow_id: workflowId,
      agent_id: `agent_${i}`,
      status: 'processing',
      progress: progress,
      message: `Working on: ${steps[i]}`,
      current_task: steps[i]
    });
    
    // Wait 2 seconds between steps
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Mark workflow as completed
  workflowWebSocketBridge.broadcastWorkflowUpdate({
    workflow_id: workflowId,
    status: 'completed',
    controls: {
      canPause: false,
      canResume: false,
      canCancel: false
    }
  });
  
  logger.info('Completed simulated workflow', {
    workflowId,
    component: 'websocket-bridge'
  });
}

// Export singleton instance
export const workflowWebSocketBridge = new WorkflowWebSocketBridge();

// Auto-start monitoring when module is loaded
workflowWebSocketBridge.startMonitoring();