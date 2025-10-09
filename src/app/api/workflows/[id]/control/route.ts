/**
 * Workflow Control API
 * Provides workflow control operations: pause, resume, cancel, delete
 * Implements requirements 4.1, 4.4, and 5.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateWorkflowUpdate,
  authenticateWorkflowDelete,
  createApiResponse,
  createErrorResponse
} from '@/lib/workflow-auth-middleware';
import { workflowOrchestrator } from '@/workflows';
import { workflowStateManager } from '@/workflows/workflow-state';
import { checkpointManager } from '@/workflows/checkpoint-manager';
import { WorkflowStatus } from '@/types/workflow';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/workflows/[id]/control - Control workflow execution
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowUpdate(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session, workflowState } = auth.data!;

    const body = await request.json();
    const { action, reason, checkpoint_id } = body;

    // Validate action
    const validActions = ['pause', 'resume', 'cancel', 'restart', 'recover'];
    if (!action || !validActions.includes(action)) {
      return createErrorResponse(
        'Invalid action',
        `Action must be one of: ${validActions.join(', ')}`,
        400
      );
    }

    // Check if action is valid for current workflow status
    const validTransitions: Record<WorkflowStatus, string[]> = {
      [WorkflowStatus.RUNNING]: ['pause', 'cancel'],
      [WorkflowStatus.PAUSED]: ['resume', 'cancel'],
      [WorkflowStatus.FAILED]: ['restart', 'recover', 'cancel'],
      [WorkflowStatus.COMPLETED]: ['restart'],
      [WorkflowStatus.CANCELLED]: ['restart'],
      [WorkflowStatus.PENDING]: ['cancel'],
      [WorkflowStatus.RECOVERING]: ['cancel']
    };

    const allowedActions = validTransitions[workflowState.status as WorkflowStatus] || [];
    if (!allowedActions.includes(action)) {
      return createErrorResponse(
        'Invalid action for current status',
        `Cannot ${action} workflow in ${workflowState.status} status. Allowed actions: ${allowedActions.join(', ')}`,
        400
      );
    }

    let result: any = {
      workflow_id: workflowId,
      action,
      previous_status: workflowState.status,
      timestamp: new Date().toISOString(),
      tenant_id: session.user.tenantId
    };

    // Execute the requested action
    switch (action) {
      case 'pause':
        await workflowOrchestrator.pauseWorkflow(workflowId);
        result.new_status = WorkflowStatus.PAUSED;
        result.message = 'Workflow paused successfully';
        if (reason) {
          result.reason = reason;
          // Store pause reason in workflow state
          workflowStateManager.updateWorkflowState(workflowId, {
            state_data: {
              ...workflowState.state_data,
              pause_reason: reason,
              paused_by: session.user.id,
              paused_at: new Date().toISOString()
            }
          });
        }
        break;

      case 'resume':
        await workflowOrchestrator.resumeWorkflow(workflowId);
        result.new_status = WorkflowStatus.RUNNING;
        result.message = 'Workflow resumed successfully';
        // Clear pause information
        workflowStateManager.updateWorkflowState(workflowId, {
          state_data: {
            ...workflowState.state_data,
            pause_reason: undefined,
            paused_by: undefined,
            paused_at: undefined,
            resumed_by: session.user.id,
            resumed_at: new Date().toISOString()
          }
        });
        break;

      case 'cancel':
        await workflowOrchestrator.cancelWorkflow(workflowId);
        result.new_status = WorkflowStatus.CANCELLED;
        result.message = 'Workflow cancelled successfully';
        if (reason) {
          result.reason = reason;
          // Store cancellation reason
          workflowStateManager.updateWorkflowState(workflowId, {
            state_data: {
              ...workflowState.state_data,
              cancellation_reason: reason,
              cancelled_by: session.user.id,
              cancelled_at: new Date().toISOString()
            }
          });
        }
        break;

      case 'restart':
        // Create a new workflow execution based on the original
        const originalData = workflowState.state_data;
        const restartData = {
          ...originalData,
          restarted_from: workflowId,
          restarted_by: session.user.id,
          restarted_at: new Date().toISOString(),
          restart_reason: reason
        };

        // This would typically create a new workflow instance
        // For now, we'll reset the current workflow
        workflowStateManager.updateWorkflowState(workflowId, {
          status: WorkflowStatus.PENDING,
          current_step: 'start',
          state_data: restartData
        });

        result.new_status = WorkflowStatus.PENDING;
        result.message = 'Workflow restart initiated';
        break;

      case 'recover':
        // Recover from specific checkpoint or latest
        const recoveryExecution = await workflowOrchestrator.recoverWorkflow(
          workflowId, 
          checkpoint_id
        );
        
        result.new_status = WorkflowStatus.RECOVERING;
        result.message = 'Workflow recovery initiated';
        result.recovery_execution_id = recoveryExecution.id;
        
        if (checkpoint_id) {
          result.recovery_checkpoint = checkpoint_id;
        } else {
          const latestCheckpoint = await checkpointManager.getLatestCheckpoint(workflowId);
          result.recovery_checkpoint = latestCheckpoint?.step_id || 'none';
        }
        break;
    }

    // Get updated workflow progress
    try {
      const progress = await workflowOrchestrator.getWorkflowStatus(workflowId);
      result.progress = progress;
    } catch (error) {
      result.progress_error = 'Failed to get updated progress';
    }

    return createApiResponse('success', result);

  } catch (error) {
    console.error(`Workflow control action failed:`, error);
    return createErrorResponse(
      'Workflow control action failed',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * DELETE /api/workflows/[id]/control - Delete workflow and cleanup resources
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowDelete(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session, workflowState } = auth.data!;

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const cleanup_checkpoints = searchParams.get('cleanup_checkpoints') !== 'false'; // Default true

    // Check if workflow can be deleted
    if (!force && [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED].includes(workflowState.status as WorkflowStatus)) {
      return createErrorResponse(
        'Cannot delete active workflow',
        'Workflow must be cancelled, completed, or failed before deletion. Use force=true to override.',
        400
      );
    }

    // Cancel workflow if it's still active and force is true
    if (force && [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED].includes(workflowState.status as WorkflowStatus)) {
      try {
        await workflowOrchestrator.cancelWorkflow(workflowId);
      } catch (error) {
        console.warn(`Failed to cancel workflow before deletion: ${error}`);
      }
    }

    let cleanupResults = {
      workflow_deleted: false,
      checkpoints_deleted: 0,
      errors: [] as string[]
    };

    // Delete checkpoints if requested
    if (cleanup_checkpoints) {
      try {
        const checkpoints = await checkpointManager.listCheckpoints(workflowId);
        await checkpointManager.deleteCheckpoints(workflowId);
        cleanupResults.checkpoints_deleted = checkpoints.length;
      } catch (error) {
        cleanupResults.errors.push(`Failed to delete checkpoints: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Remove workflow state
    try {
      workflowStateManager.removeWorkflowState(workflowId);
      cleanupResults.workflow_deleted = true;
    } catch (error) {
      cleanupResults.errors.push(`Failed to delete workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const result = {
      workflow_id: workflowId,
      deleted_at: new Date().toISOString(),
      deleted_by: session.user.id,
      tenant_id: session.user.tenantId,
      cleanup: cleanupResults,
      force_delete: force
    };

    if (cleanupResults.errors.length > 0) {
      return createApiResponse('success', result, 'Workflow deleted with some cleanup errors');
    } else {
      return createApiResponse('success', result, 'Workflow deleted successfully');
    }

  } catch (error) {
    console.error(`Workflow deletion failed:`, error);
    return createErrorResponse(
      'Workflow deletion failed',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * GET /api/workflows/[id]/control - Get available control actions for workflow
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowUpdate(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session, workflowState } = auth.data!;

    // Determine available actions based on current status
    const validTransitions: Record<WorkflowStatus, Array<{action: string, description: string, requires_reason: boolean}>> = {
      [WorkflowStatus.RUNNING]: [
        { action: 'pause', description: 'Pause workflow execution', requires_reason: false },
        { action: 'cancel', description: 'Cancel workflow execution', requires_reason: true }
      ],
      [WorkflowStatus.PAUSED]: [
        { action: 'resume', description: 'Resume workflow execution', requires_reason: false },
        { action: 'cancel', description: 'Cancel workflow execution', requires_reason: true }
      ],
      [WorkflowStatus.FAILED]: [
        { action: 'restart', description: 'Restart workflow from beginning', requires_reason: false },
        { action: 'recover', description: 'Recover from last checkpoint', requires_reason: false },
        { action: 'cancel', description: 'Mark as permanently cancelled', requires_reason: false }
      ],
      [WorkflowStatus.COMPLETED]: [
        { action: 'restart', description: 'Restart workflow with same parameters', requires_reason: false }
      ],
      [WorkflowStatus.CANCELLED]: [
        { action: 'restart', description: 'Restart cancelled workflow', requires_reason: false }
      ],
      [WorkflowStatus.PENDING]: [
        { action: 'cancel', description: 'Cancel pending workflow', requires_reason: false }
      ],
      [WorkflowStatus.RECOVERING]: [
        { action: 'cancel', description: 'Cancel recovery process', requires_reason: false }
      ]
    };

    const availableActions = validTransitions[workflowState.status as WorkflowStatus] || [];

    // Get available checkpoints for recovery
    let availableCheckpoints: any[] = [];
    if (workflowState.status === WorkflowStatus.FAILED) {
      try {
        const checkpoints = await checkpointManager.listCheckpoints(workflowId);
        availableCheckpoints = checkpoints.map(cp => ({
          step_id: cp.step_id,
          created_at: cp.created_at,
          is_recoverable: cp.is_recoverable
        }));
      } catch (error) {
        console.warn(`Failed to get checkpoints for workflow ${workflowId}:`, error);
      }
    }

    return createApiResponse('success', {
      workflow_id: workflowId,
      current_status: workflowState.status,
      available_actions: availableActions,
      available_checkpoints: availableCheckpoints,
      can_delete: ![WorkflowStatus.RUNNING, WorkflowStatus.PAUSED].includes(workflowState.status as WorkflowStatus),
      tenant_id: session.user.tenantId
    });

  } catch (error) {
    console.error(`Failed to get workflow control options:`, error);
    return createErrorResponse(
      'Failed to get workflow control options',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}