import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { workflowOrchestrator } from '@/workflows';
import { workflowStateManager } from '@/workflows/workflow-state';
import { checkpointManager } from '@/workflows/checkpoint-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { from_checkpoint } = body;
    const workflowId = params.id;

    // Verify workflow exists and belongs to tenant
    const workflowState = workflowStateManager.getWorkflowState(workflowId);
    if (!workflowState) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflowState.tenant_id !== session.user.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if workflow is in a recoverable state
    if (workflowState.status !== 'failed' && workflowState.status !== 'cancelled') {
      return NextResponse.json({ 
        error: 'Workflow is not in a recoverable state',
        current_status: workflowState.status
      }, { status: 400 });
    }

    // Get available checkpoints
    const checkpoints = await checkpointManager.listCheckpoints(workflowId);
    if (checkpoints.length === 0) {
      return NextResponse.json({ 
        error: 'No checkpoints available for recovery'
      }, { status: 400 });
    }

    // Validate checkpoint if specified
    if (from_checkpoint) {
      const checkpoint = await checkpointManager.getCheckpoint(workflowId, from_checkpoint);
      if (!checkpoint) {
        return NextResponse.json({ 
          error: 'Specified checkpoint not found',
          available_checkpoints: checkpoints.map(cp => cp.step_id)
        }, { status: 400 });
      }
    }

    // Recover workflow
    const recoveredExecution = await workflowOrchestrator.recoverWorkflow(
      workflowId,
      from_checkpoint
    );

    return NextResponse.json({
      status: 'success',
      message: 'Workflow recovery initiated',
      execution_id: recoveredExecution.id,
      recovered_from: from_checkpoint || 'latest_checkpoint',
      available_checkpoints: checkpoints.map(cp => ({
        step_id: cp.step_id,
        created_at: cp.created_at,
        is_recoverable: cp.is_recoverable
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Workflow recovery failed:', error);
    return NextResponse.json({ 
      error: 'Workflow recovery failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflowId = params.id;

    // Verify workflow exists and belongs to tenant
    const workflowState = workflowStateManager.getWorkflowState(workflowId);
    if (!workflowState) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflowState.tenant_id !== session.user.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get recovery information
    const checkpoints = await checkpointManager.listCheckpoints(workflowId);
    const latestCheckpoint = await checkpointManager.getLatestCheckpoint(workflowId);

    return NextResponse.json({
      status: 'success',
      workflow_id: workflowId,
      current_status: workflowState.status,
      is_recoverable: workflowState.status === 'failed' || workflowState.status === 'cancelled',
      checkpoints: checkpoints.map(cp => ({
        step_id: cp.step_id,
        created_at: cp.created_at,
        is_recoverable: cp.is_recoverable
      })),
      latest_checkpoint: latestCheckpoint ? {
        step_id: latestCheckpoint.step_id,
        created_at: latestCheckpoint.created_at,
        is_recoverable: latestCheckpoint.is_recoverable
      } : null,
      recovery_suggestions: [
        'Review error logs to understand failure cause',
        'Check system resources and dependencies',
        'Verify tenant configuration is correct',
        'Consider recovering from an earlier checkpoint if recent changes caused issues'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get recovery information:', error);
    return NextResponse.json({ 
      error: 'Failed to get recovery information',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}