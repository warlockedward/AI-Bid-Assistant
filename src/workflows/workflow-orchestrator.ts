/**
 * Workflow orchestrator implementation
 * Handles workflow execution, checkpointing, recovery, and timeout management
 */

import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowProgress,
  WorkflowStatus,
  WorkflowStep,
  AgentRequest,
  AgentResponse,
  WorkflowError,
  ErrorSeverity,
  WorkflowOrchestrator as IWorkflowOrchestrator
} from '../types/workflow';
import { TenantContext } from '../tenants/tenant-context';
import { WorkflowDefinitionRegistry } from './workflow-definitions';
import { workflowStateManager } from './workflow-state';
import { checkpointManager } from './checkpoint-manager';
import { pythonAPI } from '../lib/python-api';
import { websocketManager } from '../lib/websocket-server';
import { logger } from '../lib/logger';
import { metricsCollector } from '../lib/metrics';
import { alertingSystem, AlertSeverity } from '../lib/alerting';

export class WorkflowOrchestrator implements IWorkflowOrchestrator {
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff delays in ms
  private maxRetries = 5;
  private defaultTimeoutMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Start a new workflow execution
   */
  async startWorkflow(
    definition: WorkflowDefinition,
    context: TenantContext,
    initialData: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const workflowId = this.generateWorkflowId();
    
    // Log workflow start
    logger.withTenant(context).info('Starting workflow', {
      workflowId,
      component: 'workflow-orchestrator',
      operation: 'startWorkflow',
      metadata: { definitionId: definition.id, definitionName: definition.name }
    });

    // Record workflow start metric
    metricsCollector.recordWorkflowStart(workflowId, context.tenant_id);
    
    // Create workflow state
    const workflowState = workflowStateManager.createWorkflowState(
      workflowId,
      context,
      definition.steps[0]?.id || 'start',
      {
        name: definition.name,
        description: definition.description,
        version: definition.version,
        priority: 'normal' as any,
        tags: []
      },
      initialData
    );

    // Create workflow execution
    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflow_definition_id: definition.id,
      workflow_state: workflowState,
      execution_log: [],
      started_at: new Date()
    };

    this.activeExecutions.set(workflowId, execution);

    // Set up timeout
    this.setupWorkflowTimeout(workflowId, context);

    // Start execution
    try {
      await this.executeWorkflow(workflowId, definition, context);
    } catch (error) {
      await this.handleWorkflowError(workflowId, error as Error, context);
    }

    return execution;
  }

  /**
   * Pause a running workflow
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    const execution = this.activeExecutions.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Update state to paused
    workflowStateManager.pauseWorkflow(workflowId);

    // Clear timeout
    this.clearWorkflowTimeout(workflowId);

    // Create checkpoint for current state
    const currentState = workflowStateManager.getWorkflowState(workflowId);
    if (currentState) {
      await checkpointManager.saveCheckpoint(
        workflowId,
        `${currentState.current_step}_pause`,
        currentState.state_data
      );
    }

    this.logWorkflowEvent(workflowId, 'info', 'Workflow paused by user');

    // Broadcast workflow pause status
    websocketManager.broadcastWorkflowStatus(workflowId, {
      status: 'paused',
      controls: {
        canPause: false,
        canResume: true,
        canCancel: true
      }
    });
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    const execution = this.activeExecutions.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const currentState = workflowStateManager.getWorkflowState(workflowId);
    if (!currentState || currentState.status !== WorkflowStatus.PAUSED) {
      throw new Error(`Workflow ${workflowId} is not in paused state`);
    }

    // Resume workflow state
    workflowStateManager.resumeWorkflow(workflowId);

    // Re-setup timeout
    const tenantContext: TenantContext = {
      tenant_id: currentState.tenant_id,
      user_id: currentState.user_id,
      sso_provider: '',
      sso_id: '',
      preferences: {},
      permissions: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    this.setupWorkflowTimeout(workflowId, tenantContext);

    this.logWorkflowEvent(workflowId, 'info', 'Workflow resumed by user');

    // Broadcast workflow resume status
    websocketManager.broadcastWorkflowStatus(workflowId, {
      status: 'running',
      controls: {
        canPause: true,
        canResume: false,
        canCancel: true
      }
    });

    // Continue execution from current step
    // Note: This would need the workflow definition to continue
    // For now, we just update the state
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const execution = this.activeExecutions.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Update state to cancelled
    workflowStateManager.cancelWorkflow(workflowId);

    // Clear timeout
    this.clearWorkflowTimeout(workflowId);

    // Mark execution as completed
    execution.completed_at = new Date();

    this.logWorkflowEvent(workflowId, 'info', 'Workflow cancelled by user');

    // Broadcast workflow cancellation
    websocketManager.broadcastWorkflowStatus(workflowId, {
      status: 'error',
      controls: {
        canPause: false,
        canResume: false,
        canCancel: false
      }
    });

    // Remove from active executions
    this.activeExecutions.delete(workflowId);
  }

  /**
   * Get workflow status and progress
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowProgress> {
    const execution = this.activeExecutions.get(workflowId);
    const workflowState = workflowStateManager.getWorkflowState(workflowId);

    if (!execution || !workflowState) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Calculate progress based on checkpoints
    const checkpoints = await checkpointManager.listCheckpoints(workflowId);
    const totalSteps = this.estimateTotalSteps(execution.workflow_definition_id);
    const completedSteps = checkpoints.length;

    return {
      workflow_id: workflowId,
      total_steps: totalSteps,
      completed_steps: completedSteps,
      current_step: workflowState.current_step,
      progress_percentage: Math.min(100, Math.round((completedSteps / totalSteps) * 100)),
      estimated_remaining_time: this.estimateRemainingTime(checkpoints, totalSteps - completedSteps),
      last_updated: workflowState.updated_at
    };
  }

  /**
   * Recover a workflow from failure
   */
  async recoverWorkflow(
    workflowId: string,
    fromCheckpoint?: string
  ): Promise<WorkflowExecution> {
    const workflowState = workflowStateManager.getWorkflowState(workflowId);
    if (!workflowState) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Load checkpoints
    const tenantContext: TenantContext = {
      tenant_id: workflowState.tenant_id,
      user_id: workflowState.user_id,
      sso_provider: '',
      sso_id: '',
      preferences: {},
      permissions: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    await checkpointManager.loadCheckpointsFromBackend(workflowId, tenantContext);

    // Find recovery checkpoint
    let recoveryCheckpoint;
    if (fromCheckpoint) {
      recoveryCheckpoint = await checkpointManager.getCheckpoint(workflowId, fromCheckpoint);
    } else {
      recoveryCheckpoint = await checkpointManager.getLatestCheckpoint(workflowId);
    }

    if (!recoveryCheckpoint) {
      throw new Error(`No recovery checkpoint found for workflow ${workflowId}`);
    }

    // Update workflow state to recovering
    workflowStateManager.updateWorkflowState(workflowId, {
      status: WorkflowStatus.RECOVERING,
      current_step: recoveryCheckpoint.step_id,
      state_data: recoveryCheckpoint.checkpoint_data
    });

    // Create new execution for recovery
    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflow_definition_id: `recovery_${workflowId}`,
      workflow_state: workflowState,
      execution_log: [],
      started_at: new Date()
    };

    this.activeExecutions.set(workflowId, execution);

    this.logWorkflowEvent(workflowId, 'info', `Workflow recovery started from checkpoint ${recoveryCheckpoint.step_id}`);

    return execution;
  }

  /**
   * Execute workflow steps with checkpointing and error handling
   */
  private async executeWorkflow(
    workflowId: string,
    definition: WorkflowDefinition,
    context: TenantContext
  ): Promise<void> {
    const workflowState = workflowStateManager.getWorkflowState(workflowId);
    if (!workflowState) {
      throw new Error(`Workflow state not found for ${workflowId}`);
    }

    // Update status to running
    workflowStateManager.updateWorkflowState(workflowId, {
      status: WorkflowStatus.RUNNING
    });

    // Broadcast workflow status update
    websocketManager.broadcastWorkflowStatus(workflowId, {
      status: 'running',
      controls: {
        canPause: true,
        canResume: false,
        canCancel: true
      }
    });

    for (const step of definition.steps) {
      // Check if workflow was paused or cancelled
      const currentState = workflowStateManager.getWorkflowState(workflowId);
      if (!currentState || currentState.status !== WorkflowStatus.RUNNING) {
        this.logWorkflowEvent(workflowId, 'info', `Workflow execution stopped at step ${step.id}, status: ${currentState?.status}`);
        return;
      }

      try {
        await this.executeStep(workflowId, step, context);
        
        // Create checkpoint if step is marked for checkpointing
        if (step.is_checkpoint) {
          const updatedState = workflowStateManager.getWorkflowState(workflowId);
          if (updatedState) {
            await checkpointManager.saveCheckpoint(
              workflowId,
              step.id,
              updatedState.state_data,
              context
            );
          }
        }

      } catch (error) {
        await this.handleStepError(workflowId, step, error as Error, context);
        return; // Stop execution on error
      }
    }

    // Mark workflow as completed
    const finalState = workflowStateManager.getWorkflowState(workflowId);
    if (finalState) {
      workflowStateManager.completeWorkflow(workflowId, finalState.state_data);
      
      const execution = this.activeExecutions.get(workflowId);
      if (execution) {
        execution.completed_at = new Date();
        
        // Record workflow completion metrics
        const duration = execution.completed_at.getTime() - execution.started_at.getTime();
        const stepCount = definition.steps.length;
        
        metricsCollector.recordWorkflowCompletion({
          workflowId,
          tenantId: context.tenant_id,
          status: 'completed',
          duration,
          stepCount,
          errorCount: 0,
          retryCount: 0
        });

        logger.withTenant(context).info('Workflow completed successfully', {
          workflowId,
          component: 'workflow-orchestrator',
          operation: 'completeWorkflow',
          duration,
          metadata: { stepCount }
        });
      }

      this.clearWorkflowTimeout(workflowId);
      this.logWorkflowEvent(workflowId, 'info', 'Workflow completed successfully');

      // Broadcast workflow completion
      websocketManager.broadcastWorkflowStatus(workflowId, {
        status: 'completed',
        controls: {
          canPause: false,
          canResume: false,
          canCancel: false
        }
      });
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    workflowId: string,
    step: WorkflowStep,
    context: TenantContext
  ): Promise<void> {
    const startTime = Date.now();
    const workflowState = workflowStateManager.getWorkflowState(workflowId);
    
    if (!workflowState) {
      throw new Error(`Workflow state not found for ${workflowId}`);
    }

    this.logWorkflowEvent(workflowId, 'info', `Starting step: ${step.name}`);

    // Update current step
    workflowStateManager.updateWorkflowStep(
      workflowId,
      step.id,
      workflowState.state_data,
      WorkflowStatus.RUNNING
    );

    // Broadcast agent status update
    websocketManager.broadcastAgentStatus(workflowId, {
      agentId: step.agent_type,
      status: 'processing',
      progress: 0,
      message: `Starting ${step.name}`,
      currentTask: step.name
    });

    // Prepare agent request
    const agentRequest: AgentRequest = {
      tenant_context: context,
      workflow_id: workflowId,
      step_id: step.id,
      input_data: workflowState.state_data,
      checkpoint_data: {},
      timeout_seconds: step.timeout_seconds
    };

    // Execute step with retry logic and performance monitoring
    const response = await logger.time(
      `step_${step.id}_execution`,
      () => this.executeStepWithRetry(step, agentRequest),
      {
        workflowId,
        stepId: step.id,
        agentType: step.agent_type,
        tenantId: context.tenant_id,
        component: 'workflow-orchestrator'
      }
    );

    // Update workflow state with response
    const updatedData = {
      ...workflowState.state_data,
      ...response.output_data,
      [`${step.id}_result`]: response.output_data,
      [`${step.id}_execution_time`]: response.execution_time_ms
    };

    workflowStateManager.updateWorkflowStep(
      workflowId,
      response.next_step || step.id,
      updatedData
    );

    const executionTime = Date.now() - startTime;
    
    // Record agent operation metrics
    metricsCollector.recordAgentOperation({
      agentId: step.agent_type,
      agentType: step.agent_type,
      tenantId: context.tenant_id,
      workflowId,
      operation: step.name,
      duration: executionTime,
      status: response.success ? 'success' : 'error',
      inputTokens: response.input_tokens,
      outputTokens: response.output_tokens,
      ragQueries: response.rag_queries
    });

    this.logWorkflowEvent(
      workflowId, 
      'info', 
      `Completed step: ${step.name} in ${executionTime}ms`
    );

    // Broadcast agent completion status
    websocketManager.broadcastAgentStatus(workflowId, {
      agentId: step.agent_type,
      status: 'completed',
      progress: 100,
      message: `Completed ${step.name} in ${executionTime}ms`
    });
  }

  /**
   * Execute step with exponential backoff retry logic
   */
  private async executeStepWithRetry(
    step: WorkflowStep,
    request: AgentRequest
  ): Promise<AgentResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Call appropriate agent based on step type
        const response = await this.callAgent(step.agent_type, request);
        
        if (response.success) {
          return response;
        } else {
          throw new Error(response.error_info?.message || 'Agent execution failed');
        }

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
          this.logWorkflowEvent(
            request.workflow_id,
            'warn',
            `Step ${step.name} failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${lastError.message}`
          );

          // Broadcast retry status
          websocketManager.broadcastAgentStatus(request.workflow_id, {
            agentId: step.agent_type,
            status: 'error',
            progress: 0,
            message: `Retrying ${step.name} (attempt ${attempt + 1}/${this.maxRetries + 1})`
          });
          
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error(`Step ${step.name} failed after ${this.maxRetries} attempts`);
  }

  /**
   * Call appropriate agent using AgentCoordinator
   */
  private async callAgent(agentType: string, request: AgentRequest): Promise<AgentResponse> {
    // Import AgentCoordinator dynamically to avoid circular dependencies
    const { agentCoordinator } = await import('../agents/agent-coordinator');

    // Create agent execution context
    const executionContext = {
      tenantContext: request.tenant_context,
      workflowId: request.workflow_id,
      stepId: request.step_id,
      agentType: agentType,
      inputData: request.input_data,
      checkpointData: request.checkpoint_data,
      timeoutSeconds: request.timeout_seconds
    };

    // Execute agent through coordinator
    return await agentCoordinator.executeAgent(executionContext);
  }

  /**
   * Handle workflow-level errors
   */
  private async handleWorkflowError(
    workflowId: string,
    error: Error,
    context: TenantContext
  ): Promise<void> {
    const workflowError: WorkflowError = {
      code: 'WORKFLOW_EXECUTION_ERROR',
      message: error.message,
      severity: ErrorSeverity.CRITICAL,
      step_id: 'workflow',
      timestamp: new Date(),
      stack_trace: error.stack,
      recovery_suggestions: ['Check workflow definition', 'Verify tenant configuration', 'Contact support'],
      is_recoverable: false
    };

    workflowStateManager.failWorkflow(workflowId, workflowError);
    
    // Record workflow failure metrics
    const execution = this.activeExecutions.get(workflowId);
    if (execution) {
      const duration = Date.now() - execution.started_at.getTime();
      
      metricsCollector.recordWorkflowCompletion({
        workflowId,
        tenantId: context.tenant_id,
        status: 'failed',
        duration,
        stepCount: 0,
        errorCount: 1,
        retryCount: 0
      });
    }

    // Log error with tenant context
    logger.withTenant(context).error('Workflow execution failed', {
      workflowId,
      component: 'workflow-orchestrator',
      operation: 'handleWorkflowError',
      metadata: { errorCode: workflowError.code }
    }, error);

    // Create critical alert for workflow failure
    alertingSystem.createCustomAlert(
      'Workflow Execution Failed',
      `Workflow ${workflowId} failed: ${error.message}`,
      AlertSeverity.CRITICAL,
      context.tenant_id,
      workflowId,
      { errorCode: workflowError.code, stepId: workflowError.step_id }
    );
    
    // Create error checkpoint
    await checkpointManager.saveCheckpoint(
      workflowId,
      'error_state',
      { error: workflowError },
      context
    );

    this.logWorkflowEvent(workflowId, 'error', `Workflow failed: ${error.message}`);
    this.clearWorkflowTimeout(workflowId);
  }

  /**
   * Handle step-level errors
   */
  private async handleStepError(
    workflowId: string,
    step: WorkflowStep,
    error: Error,
    context: TenantContext
  ): Promise<void> {
    const stepError: WorkflowError = {
      code: 'STEP_EXECUTION_ERROR',
      message: error.message,
      severity: ErrorSeverity.RETRY_REQUIRED,
      step_id: step.id,
      timestamp: new Date(),
      stack_trace: error.stack,
      recovery_suggestions: [`Retry step ${step.name}`, 'Check step configuration', 'Verify input data'],
      is_recoverable: true
    };

    workflowStateManager.failWorkflow(workflowId, stepError);
    
    // Create error checkpoint
    await checkpointManager.saveCheckpoint(
      workflowId,
      `${step.id}_error`,
      { error: stepError },
      context
    );

    this.logWorkflowEvent(workflowId, 'error', `Step ${step.name} failed: ${error.message}`);
  }

  /**
   * Setup workflow timeout
   */
  private setupWorkflowTimeout(workflowId: string, context: TenantContext): void {
    const timeout = setTimeout(async () => {
      this.logWorkflowEvent(workflowId, 'warn', 'Workflow timed out');
      
      const timeoutError: WorkflowError = {
        code: 'WORKFLOW_TIMEOUT',
        message: 'Workflow execution timed out',
        severity: ErrorSeverity.USER_INPUT_NEEDED,
        step_id: 'timeout',
        timestamp: new Date(),
        recovery_suggestions: ['Resume workflow', 'Extend timeout', 'Cancel workflow'],
        is_recoverable: true
      };

      workflowStateManager.failWorkflow(workflowId, timeoutError);
      
      // Create timeout checkpoint
      await checkpointManager.saveCheckpoint(
        workflowId,
        'timeout_state',
        { timeout: true },
        context
      );

    }, this.defaultTimeoutMs);

    this.timeouts.set(workflowId, timeout);
  }

  /**
   * Clear workflow timeout
   */
  private clearWorkflowTimeout(workflowId: string): void {
    const timeout = this.timeouts.get(workflowId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(workflowId);
    }
  }

  /**
   * Log workflow events
   */
  private logWorkflowEvent(
    workflowId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, any>
  ): void {
    const execution = this.activeExecutions.get(workflowId);
    if (execution) {
      execution.execution_log.push({
        id: this.generateLogId(),
        workflow_id: workflowId,
        step_id: execution.workflow_state.current_step,
        timestamp: new Date(),
        level: level as any,
        message,
        data
      });
    }

    // Also log to console for debugging
    console.log(`[${level.toUpperCase()}] Workflow ${workflowId}: ${message}`, data || '');
  }

  /**
   * Utility methods
   */
  private generateWorkflowId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateExecutionId(): string {
    return `ex_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private estimateTotalSteps(definitionId: string): number {
    const definition = WorkflowDefinitionRegistry.getDefinition(definitionId);
    return definition ? definition.steps.length : 10;
  }

  private estimateRemainingTime(checkpoints: any[], remainingSteps: number): number | undefined {
    if (checkpoints.length === 0 || remainingSteps === 0) {
      return undefined;
    }

    // Calculate average time per step from completed checkpoints
    const totalTime = checkpoints.reduce((sum, cp) => {
      const executionTime = cp.checkpoint_data?.execution_time || 30000; // Default 30s
      return sum + executionTime;
    }, 0);

    const avgTimePerStep = totalTime / checkpoints.length;
    return avgTimePerStep * remainingSteps;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const workflowOrchestrator = new WorkflowOrchestrator();