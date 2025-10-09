import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { workflowOrchestrator } from '@/workflows/workflow-orchestrator'

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    // For testing, skip authentication
    // const session = await getServerSession(authOptions)
    // if (!session?.user?.tenantId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { workflowId } = params

    // Get workflow status from orchestrator
    const workflowStatus = await workflowOrchestrator.getWorkflowStatus(workflowId)

    // Map status to WebSocket format
    const status = workflowStatus ? 'running' : 'completed'
    const controls = {
      canPause: status === 'running',
      canResume: false, // Currently not supporting pause/resume
      canCancel: status === 'running'
    }

    return NextResponse.json({
      workflow_id: workflowId,
      status,
      controls,
      progress: workflowStatus ? {
        total_steps: workflowStatus.total_steps,
        completed_steps: workflowStatus.completed_steps,
        current_step: workflowStatus.current_step,
        progress_percentage: workflowStatus.progress_percentage
      } : undefined
    })

  } catch (error) {
    console.error('Error getting workflow sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get workflow status' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    // For testing, skip authentication
    // const session = await getServerSession(authOptions)
    // if (!session?.user?.tenantId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { workflowId } = params
    const body = await request.json()

    // Update workflow status from Python backend
    const { status, controls, progress } = body

    // Import WebSocket manager to broadcast updates
    const { websocketManager } = await import('@/lib/websocket-server')
    
    websocketManager.broadcastWorkflowStatus(workflowId, {
      status,
      controls: controls || {
        canPause: status === 'running',
        canResume: status === 'paused',
        canCancel: status === 'running' || status === 'paused'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Workflow status updated'
    })

  } catch (error) {
    console.error('Error updating workflow sync status:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow status' },
      { status: 500 }
    )
  }
}