/**
 * Workflow state management implementation
 * Handles workflow state persistence and synchronization with backend
 */

import { 
  WorkflowState as IWorkflowState, 
  WorkflowStatus, 
  WorkflowMetadata,
  WorkflowError,
  ErrorSeverity 
} from '../types/workflow';
import { TenantContext } from '../types/tenant';

export class WorkflowStateManager {
  private states: Map<string, IWorkflowState> = new Map();
  private listeners: Map<string, Set<(state: IWorkflowState) => void>> = new Map();

  /**
   * Create a new workflow state
   */
  createWorkflowState(
    workflowId: string,
    tenantContext: TenantContext,
    initialStep: string,
    metadata: WorkflowMetadata,
    initialData: Record<string, any> = {}
  ): IWorkflowState {
    const now = new Date();
    const state: IWorkflowState = {
      workflow_id: workflowId,
      tenant_id: tenantContext.tenant_id,
      user_id: tenantContext.user_id,
      current_step: initialStep,
      state_data: initialData,
      created_at: now,
      updated_at: now,
      status: WorkflowStatus.PENDING,
      metadata
    };

    this.states.set(workflowId, state);
    this.notifyListeners(workflowId, state);
    return state;
  }

  /**
   * Get workflow state by ID
   */
  getWorkflowState(workflowId: string): IWorkflowState | null {
    return this.states.get(workflowId) || null;
  }

  /**
   * Update workflow state
   */
  updateWorkflowState(
    workflowId: string,
    updates: Partial<IWorkflowState>
  ): IWorkflowState | null {
    const currentState = this.states.get(workflowId);
    if (!currentState) {
      return null;
    }

    const updatedState: IWorkflowState = {
      ...currentState,
      ...updates,
      updated_at: new Date()
    };

    this.states.set(workflowId, updatedState);
    this.notifyListeners(workflowId, updatedState);
    return updatedState;
  }

  /**
   * Update workflow step and data
   */
  updateWorkflowStep(
    workflowId: string,
    newStep: string,
    stateData: Record<string, any>,
    status?: WorkflowStatus
  ): IWorkflowState | null {
    return this.updateWorkflowState(workflowId, {
      current_step: newStep,
      state_data: stateData,
      status: status || WorkflowStatus.RUNNING
    });
  }

  /**
   * Mark workflow as completed
   */
  completeWorkflow(
    workflowId: string,
    finalData: Record<string, any>
  ): IWorkflowState | null {
    return this.updateWorkflowState(workflowId, {
      status: WorkflowStatus.COMPLETED,
      state_data: finalData
    });
  }

  /**
   * Mark workflow as failed
   */
  failWorkflow(
    workflowId: string,
    error: WorkflowError
  ): IWorkflowState | null {
    const currentState = this.states.get(workflowId);
    if (!currentState) {
      return null;
    }

    return this.updateWorkflowState(workflowId, {
      status: WorkflowStatus.FAILED,
      state_data: {
        ...currentState.state_data,
        error_info: error
      }
    });
  }

  /**
   * Pause workflow
   */
  pauseWorkflow(workflowId: string): IWorkflowState | null {
    return this.updateWorkflowState(workflowId, {
      status: WorkflowStatus.PAUSED
    });
  }

  /**
   * Resume workflow
   */
  resumeWorkflow(workflowId: string): IWorkflowState | null {
    return this.updateWorkflowState(workflowId, {
      status: WorkflowStatus.RUNNING
    });
  }

  /**
   * Cancel workflow
   */
  cancelWorkflow(workflowId: string): IWorkflowState | null {
    return this.updateWorkflowState(workflowId, {
      status: WorkflowStatus.CANCELLED
    });
  }

  /**
   * Get all workflows for a tenant
   */
  getTenantWorkflows(tenantId: string): IWorkflowState[] {
    return Array.from(this.states.values()).filter(
      state => state.tenant_id === tenantId
    );
  }

  /**
   * Get workflows by tenant (alias for getTenantWorkflows for API compatibility)
   */
  getWorkflowsByTenant(tenantId: string): IWorkflowState[] {
    return this.getTenantWorkflows(tenantId);
  }

  /**
   * Get active workflows for a tenant
   */
  getActiveWorkflows(tenantId: string): IWorkflowState[] {
    return this.getTenantWorkflows(tenantId).filter(
      state => state.status === WorkflowStatus.RUNNING || 
               state.status === WorkflowStatus.PAUSED
    );
  }

  /**
   * Subscribe to workflow state changes
   */
  subscribe(
    workflowId: string,
    listener: (state: IWorkflowState) => void
  ): () => void {
    if (!this.listeners.has(workflowId)) {
      this.listeners.set(workflowId, new Set());
    }
    
    this.listeners.get(workflowId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(workflowId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(workflowId);
        }
      }
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(workflowId: string, state: IWorkflowState): void {
    const listeners = this.listeners.get(workflowId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(state);
        } catch (error) {
          console.error('Error in workflow state listener:', error);
        }
      });
    }
  }

  /**
   * Remove workflow state
   */
  removeWorkflowState(workflowId: string): boolean {
    const removed = this.states.delete(workflowId);
    this.listeners.delete(workflowId);
    return removed;
  }

  /**
   * Clear all states (for cleanup)
   */
  clear(): void {
    this.states.clear();
    this.listeners.clear();
  }
}

// Export singleton instance
export const workflowStateManager = new WorkflowStateManager();