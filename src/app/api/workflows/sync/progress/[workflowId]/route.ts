import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

    // Update workflow progress from Python backend
    const { 
      total_steps, 
      completed_steps, 
      current_step, 
      progress_percentage,
      estimated_time_remaining,
      step_details
    } = body

    // Import WebSocket manager to broadcast updates
    const { websocketManager } = await import('@/lib/websocket-server')
    
    websocketManager.broadcastWorkflowProgress(workflowId, {
      totalSteps: total_steps || 0,
      completedSteps: completed_steps || 0,
      currentStep: current_step || 'Unknown',
      progressPercentage: progress_percentage || 0,
      estimatedTimeRemaining: estimated_time_remaining
    })

    // If step details are provided, also send as system notification
    if (step_details) {
      websocketManager.broadcastSystemNotification(workflowId, {
        level: 'info',
        message: `Step: ${step_details.step_name}`,
        details: {
          description: step_details.step_description,
          progress: step_details.step_progress
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Workflow progress updated',
      workflow_id: workflowId,
      progress_percentage
    })

  } catch (error) {
    console.error('Error updating workflow progress:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow progress' },
      { status: 500 }
    )
  }
}