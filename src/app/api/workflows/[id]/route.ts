import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, AuthUtils } from '@/lib/auth';
import { workflowOrchestrator } from '@/workflows';
import { workflowStateManager } from '@/workflows/workflow-state';
import { checkpointManager } from '@/workflows/checkpoint-manager';

/**
 * Authentication middleware for workflow-specific endpoints
 */
async function authenticateAndValidateWorkflowAccess(request: NextRequest, workflowId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!session.user.tenantId) {
    return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 403 }) };
  }

  // Validate tenant access
  const hasAccess = await AuthUtils.validateTenantAccess(session.user.id, session.user.tenantId);
  if (!hasAccess) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }

  // Verify workflow exists and belongs to tenant
  const workflowState = workflowStateManager.getWorkflowState(workflowId);
  if (!workflowState) {
    return { error: NextResponse.json({ error: 'Workflow not found' }, { status: 404 }) };
  }

  if (workflowState.tenant_id !== session.user.tenantId) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }

  return { session, workflowState };
}

/**
 * GET /api/workflows/[id] - Get workflow status and details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    const auth = await authenticateAndValidateWorkflowAccess(request, workflowId);
    if (auth.error) return auth.error;

    const { session, workflowState } = auth;

    // Check read permission
    const hasReadPermission = await AuthUtils.hasPermission(session!.user.id, 'workflows', 'read');
    if (!hasReadPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get workflow status from orchestrator
    const workflowProgress = await workflowOrchestrator.getWorkflowStatus(workflowId);
    const checkpoints = await checkpointManager.listCheckpoints(workflowId);

    return NextResponse.json({
      status: 'success',
      data: {
        workflow_state: workflowState,
        workflow_progress: workflowProgress,
        checkpoints: checkpoints.slice(0, 10), // Return last 10 checkpoints
        tenant_id: workflowState!.tenant_id,
        user_id: workflowState!.user_id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get workflow status:', error);
    return NextResponse.json({ 
      error: 'Failed to get workflow status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/workflows/[id] - Control workflow execution (pause, resume, cancel)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    const auth = await authenticateAndValidateWorkflowAccess(request, workflowId);
    if (auth.error) return auth.error;

    const { session, workflowState } = auth;

    const body = await request.json();
    const { action } = body; // 'pause', 'resume', 'cancel'

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid or missing action' }, { status: 400 });
    }

    // Check update permission
    const hasUpdatePermission = await AuthUtils.hasPermission(session!.user.id, 'workflows', 'update');
    if (!hasUpdatePermission) {
      return NextResponse.json({ error: 'Insufficient permissions to control workflows' }, { status: 403 });
    }

    let result;
    switch (action) {
      case 'pause':
        await workflowOrchestrator.pauseWorkflow(workflowId);
        result = { message: 'Workflow paused successfully', action: 'pause' };
        break;
        
      case 'resume':
        await workflowOrchestrator.resumeWorkflow(workflowId);
        result = { message: 'Workflow resumed successfully', action: 'resume' };
        break;
        
      case 'cancel':
        await workflowOrchestrator.cancelWorkflow(workflowId);
        result = { message: 'Workflow cancelled successfully', action: 'cancel' };
        break;
    }

    // Get updated status
    const updatedProgress = await workflowOrchestrator.getWorkflowStatus(workflowId);
    const updatedState = workflowStateManager.getWorkflowState(workflowId);

    return NextResponse.json({
      status: 'success',
      data: {
        ...result,
        workflow_state: updatedState,
        workflow_progress: updatedProgress,
        tenant_id: workflowState!.tenant_id,
        user_id: workflowState!.user_id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Workflow operation failed:', error);
    return NextResponse.json({ 
      error: 'Workflow operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/workflows/[id] - Delete workflow
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    const auth = await authenticateAndValidateWorkflowAccess(request, workflowId);
    if (auth.error) return auth.error;

    const { session, workflowState } = auth;

    // Check delete permission
    const hasDeletePermission = await AuthUtils.hasPermission(session!.user.id, 'workflows', 'delete');
    if (!hasDeletePermission) {
      return NextResponse.json({ error: 'Insufficient permissions to delete workflows' }, { status: 403 });
    }

    // Cancel workflow if it's still running
    if (workflowState!.status === 'running' || workflowState!.status === 'paused') {
      await workflowOrchestrator.cancelWorkflow(workflowId);
    }

    // Remove workflow state and checkpoints
    const removed = workflowStateManager.removeWorkflowState(workflowId);
    await checkpointManager.deleteCheckpoints(workflowId);

    if (!removed) {
      return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      data: {
        message: 'Workflow deleted successfully',
        workflow_id: workflowId,
        tenant_id: workflowState!.tenant_id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to delete workflow:', error);
    return NextResponse.json({ 
      error: 'Failed to delete workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}