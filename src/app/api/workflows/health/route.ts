/**
 * Workflow Health Check API
 * Provides system health monitoring for workflow management
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateWorkflowRequest,
  createApiResponse,
  createErrorResponse
} from '@/lib/workflow-auth-middleware';
import { workflowStateManager } from '@/workflows/workflow-state';
import { workflowOrchestrator } from '@/workflows';
import { checkpointManager } from '@/workflows/checkpoint-manager';

/**
 * GET /api/workflows/health - Get workflow system health status
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateWorkflowRequest(request);
    if (!auth.success) return auth.error!;

    const { session } = auth.data!;
    const tenantId = session.user.tenantId;

    // Check workflow state manager health
    const allWorkflows = workflowStateManager.getWorkflowsByTenant(tenantId);
    const activeWorkflows = allWorkflows.filter(w => 
      w.status === 'running' || w.status === 'paused'
    );

    // Check for stuck workflows (running for more than 2 hours)
    const stuckWorkflows = activeWorkflows.filter(w => {
      const runningTime = Date.now() - w.updated_at.getTime();
      return runningTime > 2 * 60 * 60 * 1000; // 2 hours
    });

    // Check orchestrator health
    let orchestratorHealth = 'healthy';
    const orchestratorErrors: string[] = [];

    try {
      // Test orchestrator with a sample workflow status check
      if (activeWorkflows.length > 0) {
        await workflowOrchestrator.getWorkflowStatus(activeWorkflows[0].workflow_id);
      }
    } catch (error) {
      orchestratorHealth = 'unhealthy';
      orchestratorErrors.push(error instanceof Error ? error.message : 'Unknown orchestrator error');
    }

    // Check checkpoint manager health
    let checkpointHealth = 'healthy';
    const checkpointErrors: string[] = [];

    try {
      // Test checkpoint manager with a sample operation
      if (allWorkflows.length > 0) {
        await checkpointManager.listCheckpoints(allWorkflows[0].workflow_id);
      }
    } catch (error) {
      checkpointHealth = 'unhealthy';
      checkpointErrors.push(error instanceof Error ? error.message : 'Unknown checkpoint error');
    }

    // Calculate system metrics
    const metrics = {
      total_workflows: allWorkflows.length,
      active_workflows: activeWorkflows.length,
      stuck_workflows: stuckWorkflows.length,
      completed_workflows: allWorkflows.filter(w => w.status === 'completed').length,
      failed_workflows: allWorkflows.filter(w => w.status === 'failed').length,
      average_execution_time: calculateAverageExecutionTime(allWorkflows),
      success_rate: calculateSuccessRate(allWorkflows)
    };

    // Determine overall health
    const overallHealth = 
      orchestratorHealth === 'healthy' && 
      checkpointHealth === 'healthy' && 
      stuckWorkflows.length === 0 
        ? 'healthy' 
        : stuckWorkflows.length > 0 
          ? 'degraded' 
          : 'unhealthy';

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (stuckWorkflows.length > 0) {
      recommendations.push(`${stuckWorkflows.length} workflows appear to be stuck. Consider cancelling or investigating.`);
    }
    
    if (metrics.failed_workflows > metrics.completed_workflows * 0.1) {
      recommendations.push('High failure rate detected. Review workflow configurations and error logs.');
    }
    
    if (activeWorkflows.length > 10) {
      recommendations.push('High number of active workflows. Consider scaling resources or optimizing workflow execution.');
    }

    const healthData = {
      overall_health: overallHealth,
      components: {
        workflow_state_manager: 'healthy',
        workflow_orchestrator: {
          status: orchestratorHealth,
          errors: orchestratorErrors
        },
        checkpoint_manager: {
          status: checkpointHealth,
          errors: checkpointErrors
        }
      },
      metrics,
      stuck_workflows: stuckWorkflows.map(w => ({
        workflow_id: w.workflow_id,
        current_step: w.current_step,
        running_time_hours: Math.round((Date.now() - w.updated_at.getTime()) / (60 * 60 * 1000))
      })),
      recommendations,
      tenant_id: tenantId,
      last_check: new Date().toISOString()
    };

    return createApiResponse('success', healthData);

  } catch (error) {
    console.error('Health check failed:', error);
    return createErrorResponse(
      'Health check failed',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * POST /api/workflows/health - Perform health check actions
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateWorkflowRequest(request);
    if (!auth.success) return auth.error!;

    const { session } = auth.data!;
    const tenantId = session.user.tenantId;

    const body = await request.json();
    const { action } = body;

    if (!action || !['recover_stuck', 'cleanup_failed', 'restart_orchestrator'].includes(action)) {
      return createErrorResponse(
        'Invalid action',
        'Action must be one of: recover_stuck, cleanup_failed, restart_orchestrator',
        400
      );
    }

    const results: any = { action, tenant_id: tenantId };

    switch (action) {
      case 'recover_stuck':
        results.recovered_workflows = await recoverStuckWorkflows(tenantId);
        break;
        
      case 'cleanup_failed':
        results.cleaned_workflows = await cleanupFailedWorkflows(tenantId);
        break;
        
      case 'restart_orchestrator':
        results.restart_status = await restartOrchestrator();
        break;
    }

    return createApiResponse('success', results);

  } catch (error) {
    console.error('Health check action failed:', error);
    return createErrorResponse(
      'Health check action failed',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * Calculate average execution time for completed workflows
 */
function calculateAverageExecutionTime(workflows: any[]): number {
  const completedWorkflows = workflows.filter(w => w.status === 'completed');
  
  if (completedWorkflows.length === 0) return 0;
  
  const totalTime = completedWorkflows.reduce((sum, workflow) => {
    const executionTime = workflow.updated_at.getTime() - workflow.created_at.getTime();
    return sum + executionTime;
  }, 0);
  
  return Math.round(totalTime / completedWorkflows.length / (60 * 1000)); // Return in minutes
}

/**
 * Calculate success rate for workflows
 */
function calculateSuccessRate(workflows: any[]): number {
  const finishedWorkflows = workflows.filter(w => 
    w.status === 'completed' || w.status === 'failed' || w.status === 'cancelled'
  );
  
  if (finishedWorkflows.length === 0) return 100;
  
  const successfulWorkflows = workflows.filter(w => w.status === 'completed');
  return Math.round((successfulWorkflows.length / finishedWorkflows.length) * 100);
}

/**
 * Recover stuck workflows
 */
async function recoverStuckWorkflows(tenantId: string): Promise<any[]> {
  const allWorkflows = workflowStateManager.getWorkflowsByTenant(tenantId);
  const stuckWorkflows = allWorkflows.filter(w => {
    const runningTime = Date.now() - w.updated_at.getTime();
    return (w.status === 'running' || w.status === 'paused') && runningTime > 2 * 60 * 60 * 1000;
  });

  const results = [];
  
  for (const workflow of stuckWorkflows) {
    try {
      // Try to resume from last checkpoint
      const latestCheckpoint = await checkpointManager.getLatestCheckpoint(workflow.workflow_id);
      
      if (latestCheckpoint) {
        await workflowOrchestrator.resumeWorkflow(workflow.workflow_id);
        results.push({
          workflow_id: workflow.workflow_id,
          action: 'resumed',
          success: true
        });
      } else {
        // Cancel if no checkpoint available
        await workflowOrchestrator.cancelWorkflow(workflow.workflow_id);
        results.push({
          workflow_id: workflow.workflow_id,
          action: 'cancelled',
          success: true,
          reason: 'No checkpoint available for recovery'
        });
      }
    } catch (error) {
      results.push({
        workflow_id: workflow.workflow_id,
        action: 'failed',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

/**
 * Cleanup failed workflows
 */
async function cleanupFailedWorkflows(tenantId: string): Promise<any[]> {
  const allWorkflows = workflowStateManager.getWorkflowsByTenant(tenantId);
  const failedWorkflows = allWorkflows.filter(w => w.status === 'failed');
  
  const results = [];
  
  for (const workflow of failedWorkflows) {
    try {
      // Clean up old checkpoints (keep last 3)
      const checkpoints = await checkpointManager.listCheckpoints(workflow.workflow_id);
      if (checkpoints.length > 3) {
        const oldCheckpoints = checkpoints.slice(3);
        await checkpointManager.cleanupOldCheckpoints(
          workflow.workflow_id,
          oldCheckpoints[oldCheckpoints.length - 1].created_at
        );
      }
      
      results.push({
        workflow_id: workflow.workflow_id,
        success: true,
        cleaned_checkpoints: Math.max(0, checkpoints.length - 3)
      });
    } catch (error) {
      results.push({
        workflow_id: workflow.workflow_id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

/**
 * Restart orchestrator (placeholder - would need actual implementation)
 */
async function restartOrchestrator(): Promise<string> {
  // This would typically involve restarting the orchestrator service
  // For now, we'll just return a status message
  return 'Orchestrator restart not implemented - manual restart required';
}