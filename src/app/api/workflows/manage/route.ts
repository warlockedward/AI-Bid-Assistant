/**
 * Workflow Management API
 * Provides bulk operations and advanced workflow management functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateWorkflowList,
  authenticateWorkflowUpdate,
  createApiResponse,
  createErrorResponse
} from '@/lib/workflow-auth-middleware';
import { workflowStateManager } from '@/workflows/workflow-state';
import { workflowOrchestrator } from '@/workflows';
import { checkpointManager } from '@/workflows/checkpoint-manager';
import { WorkflowStatus } from '@/types/workflow';

/**
 * GET /api/workflows/manage - Get workflow management dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateWorkflowList(request);
    if (!auth.success) return auth.error!;

    const { session } = auth.data!;
    const tenantId = session.user.tenantId;

    // Get all workflows for tenant
    const allWorkflows = workflowStateManager.getWorkflowsByTenant(tenantId);
    
    // Calculate statistics
    const stats = {
      total: allWorkflows.length,
      running: allWorkflows.filter(w => w.status === WorkflowStatus.RUNNING).length,
      completed: allWorkflows.filter(w => w.status === WorkflowStatus.COMPLETED).length,
      failed: allWorkflows.filter(w => w.status === WorkflowStatus.FAILED).length,
      paused: allWorkflows.filter(w => w.status === WorkflowStatus.PAUSED).length,
      cancelled: allWorkflows.filter(w => w.status === WorkflowStatus.CANCELLED).length
    };

    // Get recent workflows (last 10)
    const recentWorkflows = allWorkflows
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
      .slice(0, 10);

    // Get active workflows with progress
    const activeWorkflows = await Promise.all(
      allWorkflows
        .filter(w => w.status === WorkflowStatus.RUNNING || w.status === WorkflowStatus.PAUSED)
        .map(async (workflow) => {
          try {
            const progress = await workflowOrchestrator.getWorkflowStatus(workflow.workflow_id);
            return { ...workflow, progress };
          } catch (error) {
            return { ...workflow, progress: null, error: 'Failed to get progress' };
          }
        })
    );

    // Get failed workflows with error details
    const failedWorkflows = allWorkflows
      .filter(w => w.status === WorkflowStatus.FAILED)
      .map(workflow => ({
        ...workflow,
        error_info: workflow.state_data?.error_info || null
      }));

    return createApiResponse('success', {
      stats,
      recent_workflows: recentWorkflows,
      active_workflows: activeWorkflows,
      failed_workflows: failedWorkflows,
      tenant_id: tenantId
    });

  } catch (error) {
    console.error('Failed to get workflow management data:', error);
    return createErrorResponse(
      'Failed to get workflow management data',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * POST /api/workflows/manage - Bulk workflow operations
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateWorkflowUpdate(request, 'bulk');
    if (!auth.success) return auth.error!;

    const { session } = auth.data!;
    const tenantId = session.user.tenantId;

    const body = await request.json();
    const { action, workflow_ids, filters } = body;

    if (!action || !['pause', 'resume', 'cancel', 'delete', 'cleanup'].includes(action)) {
      return createErrorResponse(
        'Invalid action',
        'Action must be one of: pause, resume, cancel, delete, cleanup',
        400
      );
    }

    let targetWorkflows: string[] = [];

    // Determine target workflows
    if (workflow_ids && Array.isArray(workflow_ids)) {
      // Specific workflow IDs
      targetWorkflows = workflow_ids;
    } else if (filters) {
      // Filter-based selection
      const allWorkflows = workflowStateManager.getWorkflowsByTenant(tenantId);
      targetWorkflows = allWorkflows
        .filter(workflow => {
          if (filters.status && workflow.status !== filters.status) return false;
          if (filters.created_before && workflow.created_at >= new Date(filters.created_before)) return false;
          if (filters.created_after && workflow.created_at <= new Date(filters.created_after)) return false;
          return true;
        })
        .map(w => w.workflow_id);
    } else {
      return createErrorResponse(
        'Missing target specification',
        'Either workflow_ids or filters must be provided',
        400
      );
    }

    if (targetWorkflows.length === 0) {
      return createApiResponse('success', {
        message: 'No workflows matched the criteria',
        affected_count: 0,
        results: []
      });
    }

    // Validate all workflows belong to tenant
    const results: Array<{ workflow_id: string; success: boolean; error?: string }> = [];
    
    for (const workflowId of targetWorkflows) {
      try {
        const workflowState = workflowStateManager.getWorkflowState(workflowId);
        
        if (!workflowState) {
          results.push({
            workflow_id: workflowId,
            success: false,
            error: 'Workflow not found'
          });
          continue;
        }

        if (workflowState.tenant_id !== tenantId) {
          results.push({
            workflow_id: workflowId,
            success: false,
            error: 'Access denied'
          });
          continue;
        }

        // Perform the action
        switch (action) {
          case 'pause':
            await workflowOrchestrator.pauseWorkflow(workflowId);
            break;
          case 'resume':
            await workflowOrchestrator.resumeWorkflow(workflowId);
            break;
          case 'cancel':
            await workflowOrchestrator.cancelWorkflow(workflowId);
            break;
          case 'delete':
            await workflowOrchestrator.cancelWorkflow(workflowId);
            workflowStateManager.removeWorkflowState(workflowId);
            await checkpointManager.deleteCheckpoints(workflowId);
            break;
          case 'cleanup':
            // Only cleanup completed, failed, or cancelled workflows
            if (['completed', 'failed', 'cancelled'].includes(workflowState.status)) {
              await checkpointManager.cleanupOldCheckpoints(
                workflowId, 
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
              );
            }
            break;
        }

        results.push({
          workflow_id: workflowId,
          success: true
        });

      } catch (error) {
        results.push({
          workflow_id: workflowId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return createApiResponse('success', {
      message: `Bulk ${action} operation completed`,
      affected_count: successCount,
      failed_count: failureCount,
      results,
      tenant_id: tenantId
    });

  } catch (error) {
    console.error('Bulk workflow operation failed:', error);
    return createErrorResponse(
      'Bulk workflow operation failed',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * DELETE /api/workflows/manage - Cleanup old workflows and checkpoints
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateWorkflowUpdate(request, 'cleanup');
    if (!auth.success) return auth.error!;

    const { session } = auth.data!;
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const daysOld = parseInt(searchParams.get('days') || '30');
    const includeCompleted = searchParams.get('include_completed') === 'true';
    const includeFailed = searchParams.get('include_failed') === 'true';

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const allWorkflows = workflowStateManager.getWorkflowsByTenant(tenantId);
    const workflowsToCleanup = allWorkflows.filter(workflow => {
      if (workflow.updated_at >= cutoffDate) return false;
      
      const status = workflow.status;
      if (status === 'running' || status === 'paused') return false;
      
      if (status === 'completed' && !includeCompleted) return false;
      if (status === 'failed' && !includeFailed) return false;
      
      return true;
    });

    let cleanedWorkflows = 0;
    let cleanedCheckpoints = 0;

    for (const workflow of workflowsToCleanup) {
      try {
        // Clean up checkpoints
        const checkpointCount = await checkpointManager.cleanupOldCheckpoints(
          workflow.workflow_id,
          cutoffDate
        );
        cleanedCheckpoints += checkpointCount;

        // Remove workflow state if it's old enough and not active
        if (['completed', 'failed', 'cancelled'].includes(workflow.status)) {
          workflowStateManager.removeWorkflowState(workflow.workflow_id);
          cleanedWorkflows++;
        }
      } catch (error) {
        console.error(`Failed to cleanup workflow ${workflow.workflow_id}:`, error);
      }
    }

    return createApiResponse('success', {
      message: 'Cleanup completed successfully',
      cleaned_workflows: cleanedWorkflows,
      cleaned_checkpoints: cleanedCheckpoints,
      cutoff_date: cutoffDate.toISOString(),
      tenant_id: tenantId
    });

  } catch (error) {
    console.error('Workflow cleanup failed:', error);
    return createErrorResponse(
      'Workflow cleanup failed',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}