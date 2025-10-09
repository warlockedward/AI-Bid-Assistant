/**
 * Checkpoint manager implementation
 * Handles workflow checkpoint creation, retrieval, and recovery
 */

import { 
  WorkflowCheckpoint, 
  CheckpointManager as ICheckpointManager 
} from '../types/workflow';
import { TenantContext } from '../types/tenant';

export class CheckpointManager implements ICheckpointManager {
  private checkpoints: Map<string, WorkflowCheckpoint[]> = new Map();
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Save a checkpoint for a workflow step
   */
  async saveCheckpoint(
    workflowId: string,
    stepId: string,
    data: Record<string, any>,
    tenantContext?: TenantContext
  ): Promise<WorkflowCheckpoint> {
    const checkpoint: WorkflowCheckpoint = {
      id: this.generateCheckpointId(),
      workflow_id: workflowId,
      step_id: stepId,
      checkpoint_data: this.sanitizeData(data),
      created_at: new Date(),
      is_recoverable: true
    };

    // Store locally
    if (!this.checkpoints.has(workflowId)) {
      this.checkpoints.set(workflowId, []);
    }
    this.checkpoints.get(workflowId)!.push(checkpoint);

    // Persist to backend if tenant context is available
    if (tenantContext) {
      try {
        await this.persistCheckpointToBackend(checkpoint, tenantContext);
      } catch (error) {
        console.error('Failed to persist checkpoint to backend:', error);
        // Continue with local storage for resilience
      }
    }

    return checkpoint;
  }

  /**
   * Get the latest checkpoint for a workflow
   */
  async getLatestCheckpoint(workflowId: string): Promise<WorkflowCheckpoint | null> {
    const workflowCheckpoints = this.checkpoints.get(workflowId);
    if (!workflowCheckpoints || workflowCheckpoints.length === 0) {
      return null;
    }

    // Return the most recent checkpoint
    return workflowCheckpoints.reduce((latest, current) => 
      current.created_at > latest.created_at ? current : latest
    );
  }

  /**
   * Get a specific checkpoint by step ID
   */
  async getCheckpoint(workflowId: string, stepId: string): Promise<WorkflowCheckpoint | null> {
    const workflowCheckpoints = this.checkpoints.get(workflowId);
    if (!workflowCheckpoints) {
      return null;
    }

    return workflowCheckpoints.find(cp => cp.step_id === stepId) || null;
  }

  /**
   * List all checkpoints for a workflow
   */
  async listCheckpoints(workflowId: string): Promise<WorkflowCheckpoint[]> {
    const workflowCheckpoints = this.checkpoints.get(workflowId);
    if (!workflowCheckpoints) {
      return [];
    }

    // Return sorted by creation time (newest first)
    return [...workflowCheckpoints].sort((a, b) => 
      b.created_at.getTime() - a.created_at.getTime()
    );
  }

  /**
   * Get checkpoints created after a specific timestamp
   */
  async getCheckpointsSince(
    workflowId: string, 
    since: Date
  ): Promise<WorkflowCheckpoint[]> {
    const workflowCheckpoints = this.checkpoints.get(workflowId);
    if (!workflowCheckpoints) {
      return [];
    }

    return workflowCheckpoints.filter(cp => cp.created_at > since);
  }

  /**
   * Remove checkpoints older than specified date
   */
  async cleanupOldCheckpoints(
    workflowId: string, 
    olderThan: Date
  ): Promise<number> {
    const workflowCheckpoints = this.checkpoints.get(workflowId);
    if (!workflowCheckpoints) {
      return 0;
    }

    const initialCount = workflowCheckpoints.length;
    const filtered = workflowCheckpoints.filter(cp => cp.created_at >= olderThan);
    
    this.checkpoints.set(workflowId, filtered);
    return initialCount - filtered.length;
  }

  /**
   * Remove all checkpoints for a workflow
   */
  async clearWorkflowCheckpoints(workflowId: string): Promise<void> {
    this.checkpoints.delete(workflowId);
  }

  /**
   * Delete all checkpoints for a workflow (alias for clearWorkflowCheckpoints)
   */
  async deleteCheckpoints(workflowId: string): Promise<void> {
    await this.clearWorkflowCheckpoints(workflowId);
  }

  /**
   * Load checkpoints from backend for a workflow
   */
  async loadCheckpointsFromBackend(
    workflowId: string,
    tenantContext: TenantContext
  ): Promise<WorkflowCheckpoint[]> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/workflows/${workflowId}/checkpoints`,
        {
          headers: {
            'Authorization': `Bearer ${tenantContext.user_id}`,
            'X-Tenant-ID': tenantContext.tenant_id,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load checkpoints: ${response.statusText}`);
      }

      const data = await response.json();
      const backendCheckpoints = data.checkpoints || [];

      // Convert backend format to our format
      const checkpoints: WorkflowCheckpoint[] = backendCheckpoints.map((cp: any) => ({
        id: cp.id,
        workflow_id: cp.workflow_state_id,
        step_id: cp.step_name,
        checkpoint_data: cp.checkpoint_data,
        created_at: new Date(cp.created_at),
        is_recoverable: true
      }));

      // Merge with local checkpoints
      this.mergeCheckpoints(workflowId, checkpoints);

      return checkpoints;
    } catch (error) {
      console.error('Failed to load checkpoints from backend:', error);
      return this.checkpoints.get(workflowId) || [];
    }
  }

  /**
   * Create a recovery point from the latest checkpoint
   */
  async createRecoveryPoint(workflowId: string): Promise<WorkflowCheckpoint | null> {
    const latestCheckpoint = await this.getLatestCheckpoint(workflowId);
    if (!latestCheckpoint) {
      return null;
    }

    // Create a recovery checkpoint with current timestamp
    const recoveryCheckpoint: WorkflowCheckpoint = {
      ...latestCheckpoint,
      id: this.generateCheckpointId(),
      step_id: `${latestCheckpoint.step_id}_recovery`,
      created_at: new Date(),
      is_recoverable: true
    };

    if (!this.checkpoints.has(workflowId)) {
      this.checkpoints.set(workflowId, []);
    }
    this.checkpoints.get(workflowId)!.push(recoveryCheckpoint);

    return recoveryCheckpoint;
  }

  /**
   * Validate checkpoint data integrity
   */
  validateCheckpoint(checkpoint: WorkflowCheckpoint): boolean {
    try {
      // Check required fields
      if (!checkpoint.id || !checkpoint.workflow_id || !checkpoint.step_id) {
        return false;
      }

      // Check data can be serialized
      JSON.stringify(checkpoint.checkpoint_data);

      // Check timestamp is valid
      if (!(checkpoint.created_at instanceof Date) || isNaN(checkpoint.created_at.getTime())) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Checkpoint validation failed:', error);
      return false;
    }
  }

  /**
   * Generate a unique checkpoint ID
   */
  private generateCheckpointId(): string {
    return `cp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Sanitize data for safe storage
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    try {
      // Remove circular references and functions
      return JSON.parse(JSON.stringify(data, (_key, value) => {
        if (typeof value === 'function') {
          return '[Function]';
        }
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack
          };
        }
        return value;
      }));
    } catch (error) {
      console.error('Failed to sanitize checkpoint data:', error);
      return { error: 'Failed to sanitize data', original_error: String(error) };
    }
  }

  /**
   * Persist checkpoint to backend
   */
  private async persistCheckpointToBackend(
    checkpoint: WorkflowCheckpoint,
    tenantContext: TenantContext
  ): Promise<void> {
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
          step_index: await this.getNextStepIndex(checkpoint.workflow_id)
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to persist checkpoint: ${response.statusText}`);
    }
  }

  /**
   * Get the next step index for a workflow
   */
  private async getNextStepIndex(workflowId: string): Promise<number> {
    const checkpoints = await this.listCheckpoints(workflowId);
    return checkpoints.length;
  }

  /**
   * Merge backend checkpoints with local ones
   */
  private mergeCheckpoints(workflowId: string, backendCheckpoints: WorkflowCheckpoint[]): void {
    const localCheckpoints = this.checkpoints.get(workflowId) || [];
    const allCheckpoints = [...backendCheckpoints, ...localCheckpoints];

    // Remove duplicates based on step_id and created_at
    const uniqueCheckpoints = allCheckpoints.filter((checkpoint, index, array) => 
      array.findIndex(cp => 
        cp.step_id === checkpoint.step_id && 
        cp.created_at.getTime() === checkpoint.created_at.getTime()
      ) === index
    );

    this.checkpoints.set(workflowId, uniqueCheckpoints);
  }
}

// Export singleton instance
export const checkpointManager = new CheckpointManager();