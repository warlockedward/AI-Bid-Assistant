/**
 * Workflow Status API
 * Provides detailed workflow status, progress, and real-time monitoring
 * Implements requirements 4.1, 4.4, and 5.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateWorkflowRead,
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
 * GET /api/workflows/[id]/status - Get detailed workflow status and progress
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowRead(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session, workflowState } = auth.data!;

    const { searchParams } = new URL(request.url);
    const includeCheckpoints = searchParams.get('include_checkpoints') === 'true';
    const includeExecutionLog = searchParams.get('include_execution_log') === 'true';
    const includeErrorDetails = searchParams.get('include_error_details') === 'true';
    const includeMetrics = searchParams.get('include_metrics') === 'true';

    // Get basic workflow progress
    let progress = null;
    let progressError = null;
    
    try {
      progress = await workflowOrchestrator.getWorkflowStatus(workflowId);
    } catch (error) {
      progressError = error instanceof Error ? error.message : 'Failed to get progress';
    }

    // Build status response
    const statusData: any = {
      workflow_id: workflowId,
      status: workflowState.status,
      current_step: workflowState.current_step,
      created_at: workflowState.created_at,
      updated_at: workflowState.updated_at,
      tenant_id: workflowState.tenant_id,
      user_id: workflowState.user_id,
      metadata: workflowState.metadata,
      progress,
      progress_error: progressError
    };

    // Add computed status information
    statusData.is_active = [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED].includes(workflowState.status as WorkflowStatus);
    statusData.is_completed = workflowState.status === WorkflowStatus.COMPLETED;
    statusData.is_failed = workflowState.status === WorkflowStatus.FAILED;
    statusData.duration_ms = workflowState.updated_at.getTime() - workflowState.created_at.getTime();

    // Add timeout information if workflow is active
    if (statusData.is_active) {
      const timeoutThreshold = 24 * 60 * 60 * 1000; // 24 hours
      const timeSinceUpdate = Date.now() - workflowState.updated_at.getTime();
      statusData.timeout_info = {
        timeout_threshold_ms: timeoutThreshold,
        time_since_update_ms: timeSinceUpdate,
        is_approaching_timeout: timeSinceUpdate > timeoutThreshold * 0.8, // 80% of timeout
        is_timed_out: timeSinceUpdate > timeoutThreshold
      };
    }

    // Include checkpoints if requested
    if (includeCheckpoints) {
      try {
        const checkpoints = await checkpointManager.listCheckpoints(workflowId);
        statusData.checkpoints = checkpoints.map(cp => ({
          id: cp.id,
          step_id: cp.step_id,
          created_at: cp.created_at,
          is_recoverable: cp.is_recoverable,
          data_size: JSON.stringify(cp.checkpoint_data).length
        }));
        statusData.checkpoint_count = checkpoints.length;
        statusData.latest_checkpoint = checkpoints.length > 0 ? checkpoints[0] : null;
      } catch (error) {
        statusData.checkpoints_error = error instanceof Error ? error.message : 'Failed to get checkpoints';
      }
    }

    // Include execution log if requested (limited to last 50 entries)
    if (includeExecutionLog) {
      try {
        // This would typically come from a logging system
        // For now, we'll extract from workflow state data
        const executionLog = workflowState.state_data?.execution_log || [];
        statusData.execution_log = executionLog.slice(-50); // Last 50 entries
        statusData.execution_log_count = executionLog.length;
      } catch (error) {
        statusData.execution_log_error = error instanceof Error ? error.message : 'Failed to get execution log';
      }
    }

    // Include error details if requested and workflow has errors
    if (includeErrorDetails && workflowState.status === WorkflowStatus.FAILED) {
      statusData.error_details = {
        error_info: workflowState.state_data?.error_info || null,
        last_error: workflowState.state_data?.last_error || null,
        error_count: workflowState.state_data?.error_count || 0,
        recovery_suggestions: workflowState.state_data?.error_info?.recovery_suggestions || []
      };
    }

    // Include performance metrics if requested
    if (includeMetrics) {
      statusData.metrics = calculateWorkflowMetrics(workflowState, progress);
    }

    // Add state-specific information
    switch (workflowState.status) {
      case WorkflowStatus.PAUSED:
        statusData.pause_info = {
          paused_at: workflowState.state_data?.paused_at,
          paused_by: workflowState.state_data?.paused_by,
          pause_reason: workflowState.state_data?.pause_reason
        };
        break;
        
      case WorkflowStatus.CANCELLED:
        statusData.cancellation_info = {
          cancelled_at: workflowState.state_data?.cancelled_at,
          cancelled_by: workflowState.state_data?.cancelled_by,
          cancellation_reason: workflowState.state_data?.cancellation_reason
        };
        break;
        
      case WorkflowStatus.RECOVERING:
        statusData.recovery_info = {
          recovery_started_at: workflowState.state_data?.recovery_started_at,
          recovery_checkpoint: workflowState.state_data?.recovery_checkpoint,
          recovery_attempt: workflowState.state_data?.recovery_attempt || 1
        };
        break;
    }

    return createApiResponse('success', statusData);

  } catch (error) {
    console.error(`Failed to get workflow status:`, error);
    return createErrorResponse(
      'Failed to get workflow status',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * POST /api/workflows/[id]/status - Update workflow status or add status annotations
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowRead(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session, workflowState } = auth.data!;

    const body = await request.json();
    const { action, annotation, metadata } = body;

    if (!action || !['add_annotation', 'update_metadata', 'heartbeat'].includes(action)) {
      return createErrorResponse(
        'Invalid action',
        'Action must be one of: add_annotation, update_metadata, heartbeat',
        400
      );
    }

    let result: any = {
      workflow_id: workflowId,
      action,
      timestamp: new Date().toISOString(),
      tenant_id: session.user.tenantId
    };

    switch (action) {
      case 'add_annotation':
        if (!annotation) {
          return createErrorResponse('Missing annotation', 'Annotation text is required', 400);
        }
        
        // Add annotation to workflow state
        const annotations = workflowState.state_data?.annotations || [];
        annotations.push({
          id: `ann_${Date.now()}`,
          text: annotation,
          created_by: session.user.id,
          created_at: new Date().toISOString()
        });
        
        workflowStateManager.updateWorkflowState(workflowId, {
          state_data: {
            ...workflowState.state_data,
            annotations
          }
        });
        
        result.annotation_added = true;
        result.total_annotations = annotations.length;
        break;

      case 'update_metadata':
        if (!metadata || typeof metadata !== 'object') {
          return createErrorResponse('Invalid metadata', 'Metadata must be an object', 400);
        }
        
        // Update workflow metadata
        const updatedMetadata = {
          ...workflowState.metadata,
          ...metadata,
          last_updated_by: session.user.id,
          last_updated_at: new Date().toISOString()
        };
        
        workflowStateManager.updateWorkflowState(workflowId, {
          metadata: updatedMetadata
        });
        
        result.metadata_updated = true;
        result.updated_fields = Object.keys(metadata);
        break;

      case 'heartbeat':
        // Update last seen timestamp for monitoring
        workflowStateManager.updateWorkflowState(workflowId, {
          state_data: {
            ...workflowState.state_data,
            last_heartbeat: new Date().toISOString(),
            heartbeat_from: session.user.id
          }
        });
        
        result.heartbeat_recorded = true;
        break;
    }

    return createApiResponse('success', result);

  } catch (error) {
    console.error(`Failed to update workflow status:`, error);
    return createErrorResponse(
      'Failed to update workflow status',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * Calculate workflow performance metrics
 */
function calculateWorkflowMetrics(workflowState: any, progress: any) {
  const metrics: any = {
    execution_time_ms: workflowState.updated_at.getTime() - workflowState.created_at.getTime(),
    steps_completed: 0,
    steps_total: 0,
    average_step_time_ms: 0,
    estimated_completion_time: null
  };

  if (progress) {
    metrics.steps_completed = progress.completed_steps;
    metrics.steps_total = progress.total_steps;
    metrics.progress_percentage = progress.progress_percentage;
    metrics.estimated_remaining_time_ms = progress.estimated_remaining_time;
    
    if (progress.completed_steps > 0) {
      metrics.average_step_time_ms = metrics.execution_time_ms / progress.completed_steps;
    }
    
    if (progress.estimated_remaining_time) {
      metrics.estimated_completion_time = new Date(Date.now() + progress.estimated_remaining_time).toISOString();
    }
  }

  // Calculate efficiency metrics
  if (workflowState.status === WorkflowStatus.COMPLETED) {
    metrics.efficiency_score = calculateEfficiencyScore(workflowState);
  }

  // Add resource usage if available
  if (workflowState.state_data?.resource_usage) {
    metrics.resource_usage = workflowState.state_data.resource_usage;
  }

  return metrics;
}

/**
 * Calculate workflow efficiency score (0-100)
 */
function calculateEfficiencyScore(workflowState: any): number {
  // This is a simplified efficiency calculation
  // In a real system, this would consider factors like:
  // - Execution time vs. expected time
  // - Resource utilization
  // - Error rate
  // - Retry count
  
  const executionTimeMs = workflowState.updated_at.getTime() - workflowState.created_at.getTime();
  const errorCount = workflowState.state_data?.error_count || 0;
  const retryCount = workflowState.state_data?.retry_count || 0;
  
  // Base score starts at 100
  let score = 100;
  
  // Penalize for errors and retries
  score -= errorCount * 5;
  score -= retryCount * 2;
  
  // Penalize for very long execution times (over 1 hour)
  const oneHour = 60 * 60 * 1000;
  if (executionTimeMs > oneHour) {
    const hoursOver = (executionTimeMs - oneHour) / oneHour;
    score -= hoursOver * 10;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}