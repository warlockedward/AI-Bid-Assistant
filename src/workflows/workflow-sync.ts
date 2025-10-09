/**
 * Workflow synchronization service
 * Bridges TypeScript workflow orchestrator with Python backend
 */

import { WorkflowState, WorkflowCheckpoint } from '../types/workflow';
import { TenantContext } from '../types/tenant';
import { workflowStateManager } from './workflow-state';
import { checkpointManager } from './checkpoint-manager';

export class WorkflowSyncService {
  private apiBaseUrl: string;
  private syncInterval: number = 30000; // 30 seconds
  private activeSyncs: Map<string, NodeJS.Timeout> = new Map();

  constructor(apiBaseUrl: string = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Start synchronization for a workflow
   */
  startSync(workflowId: string, tenantContext: TenantContext): void {
    // Clear existing sync if any
    this.stopSync(workflowId);

    // Initial sync
    this.syncWorkflowState(workflowId, tenantContext);

    // Set up periodic sync
    const interval = setInterval(() => {
      this.syncWorkflowState(workflowId, tenantContext);
    }, this.syncInterval);

    this.activeSyncs.set(workflowId, interval);
  }

  /**
   * Stop synchronization for a workflow
   */
  stopSync(workflowId: string): void {
    const interval = this.activeSyncs.get(workflowId);
    if (interval) {
      clearInterval(interval);
      this.activeSyncs.delete(workflowId);
    }
  }

  /**
   * Synchronize workflow state with Python backend
   */
  async syncWorkflowState(workflowId: string, tenantContext: TenantContext): Promise<void> {
    try {
      const localState = workflowStateManager.getWorkflowState(workflowId);
      if (!localState) {
        console.warn(`No local state found for workflow ${workflowId}`);
        return;
      }

      // Sync state to backend
      await this.pushStateToBackend(localState, tenantContext);

      // Sync checkpoints to backend
      await this.syncCheckpoints(workflowId, tenantContext);

      // Pull any updates from backend
      await this.pullStateFromBackend(workflowId, tenantContext);

    } catch (error) {
      console.error(`Failed to sync workflow ${workflowId}:`, error);
    }
  }

  /**
   * Push workflow state to Python backend
   */
  private async pushStateToBackend(
    workflowState: WorkflowState,
    tenantContext: TenantContext
  ): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/workflows/${workflowState.workflow_id}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tenantContext.user_id}`,
          'X-Tenant-ID': tenantContext.tenant_id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workflow_state: {
            workflow_id: workflowState.workflow_id,
            tenant_id: workflowState.tenant_id,
            user_id: workflowState.user_id,
            workflow_type: workflowState.metadata.name,
            current_step: workflowState.current_step,
            status: workflowState.status,
            state_data: workflowState.state_data,
            workflow_metadata: workflowState.metadata,
            created_at: workflowState.created_at.toISOString(),
            updated_at: workflowState.updated_at.toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to push state to backend: ${response.statusText}`);
      }

    } catch (error) {
      console.error('Error pushing state to backend:', error);
      // Don't throw - allow sync to continue with other operations
    }
  }

  /**
   * Pull workflow state updates from Python backend
   */
  private async pullStateFromBackend(
    workflowId: string,
    tenantContext: TenantContext
  ): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/workflows/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${tenantContext.user_id}`,
          'X-Tenant-ID': tenantContext.tenant_id,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Workflow doesn't exist in backend yet
          return;
        }
        throw new Error(`Failed to pull state from backend: ${response.statusText}`);
      }

      const data = await response.json();
      const backendState = data.workflow_state;

      if (backendState) {
        // Update local state if backend has newer data
        const localState = workflowStateManager.getWorkflowState(workflowId);
        if (localState && new Date(backendState.updated_at) > localState.updated_at) {
          workflowStateManager.updateWorkflowState(workflowId, {
            current_step: backendState.current_step,
            status: backendState.status,
            state_data: backendState.state_data,
            updated_at: new Date(backendState.updated_at)
          });
        }
      }

    } catch (error) {
      console.error('Error pulling state from backend:', error);
      // Don't throw - allow sync to continue
    }
  }

  /**
   * Synchronize checkpoints with backend
   */
  private async syncCheckpoints(
    workflowId: string,
    tenantContext: TenantContext
  ): Promise<void> {
    try {
      // Load checkpoints from backend
      await checkpointManager.loadCheckpointsFromBackend(workflowId, tenantContext);

      // Get local checkpoints that might need to be pushed
      const localCheckpoints = await checkpointManager.listCheckpoints(workflowId);
      
      // Push any local checkpoints that don't exist in backend
      for (const checkpoint of localCheckpoints) {
        await this.pushCheckpointToBackend(checkpoint, tenantContext);
      }

    } catch (error) {
      console.error('Error syncing checkpoints:', error);
    }
  }

  /**
   * Push checkpoint to backend
   */
  private async pushCheckpointToBackend(
    checkpoint: WorkflowCheckpoint,
    tenantContext: TenantContext
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/workflows/${checkpoint.workflow_id}/checkpoints`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tenantContext.user_id}`,
            'X-Tenant-ID': tenantContext.tenant_id,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            step_name: checkpoint.step_id,
            checkpoint_data: checkpoint.checkpoint_data,
            step_index: await this.getCheckpointIndex(checkpoint),
            created_at: checkpoint.created_at.toISOString()
          })
        }
      );

      if (!response.ok && response.status !== 409) { // 409 = conflict (already exists)
        throw new Error(`Failed to push checkpoint: ${response.statusText}`);
      }

    } catch (error) {
      console.error('Error pushing checkpoint to backend:', error);
    }
  }

  /**
   * Get checkpoint index for ordering
   */
  private async getCheckpointIndex(checkpoint: WorkflowCheckpoint): Promise<number> {
    const allCheckpoints = await checkpointManager.listCheckpoints(checkpoint.workflow_id);
    return allCheckpoints.findIndex(cp => cp.id === checkpoint.id);
  }

  /**
   * Sync workflow execution results from Python agents
   */
  async syncAgentResults(
    workflowId: string,
    stepId: string,
    agentResults: any,
    tenantContext: TenantContext
  ): Promise<void> {
    try {
      // Update local workflow state with agent results
      const currentState = workflowStateManager.getWorkflowState(workflowId);
      if (currentState) {
        const updatedData = {
          ...currentState.state_data,
          [`${stepId}_result`]: agentResults,
          [`${stepId}_completed_at`]: new Date().toISOString()
        };

        workflowStateManager.updateWorkflowStep(
          workflowId,
          stepId,
          updatedData
        );

        // Create checkpoint for this step completion
        await checkpointManager.saveCheckpoint(
          workflowId,
          `${stepId}_completed`,
          updatedData,
          tenantContext
        );
      }

    } catch (error) {
      console.error('Error syncing agent results:', error);
    }
  }

  /**
   * Handle workflow errors from Python backend
   */
  async handleBackendError(
    workflowId: string,
    error: any,
    tenantContext: TenantContext
  ): Promise<void> {
    try {
      const workflowError = {
        code: error.code || 'BACKEND_ERROR',
        message: error.message || 'Unknown backend error',
        severity: error.severity || 'critical',
        step_id: error.step_id || 'unknown',
        timestamp: new Date(),
        recovery_suggestions: error.recovery_suggestions || ['Check backend logs', 'Retry operation'],
        is_recoverable: error.is_recoverable !== false
      };

      // Update workflow state to failed
      workflowStateManager.failWorkflow(workflowId, workflowError);

      // Create error checkpoint
      await checkpointManager.saveCheckpoint(
        workflowId,
        'backend_error',
        { error: workflowError },
        tenantContext
      );

    } catch (syncError) {
      console.error('Error handling backend error:', syncError);
    }
  }

  /**
   * Get sync status for a workflow
   */
  getSyncStatus(workflowId: string): { isActive: boolean; lastSync?: Date } {
    return {
      isActive: this.activeSyncs.has(workflowId),
      lastSync: new Date() // This could be tracked more precisely
    };
  }

  /**
   * Stop all active syncs (cleanup)
   */
  stopAllSyncs(): void {
    this.activeSyncs.forEach((interval, workflowId) => {
      clearInterval(interval);
    });
    this.activeSyncs.clear();
  }
}

// Export singleton instance
export const workflowSyncService = new WorkflowSyncService();