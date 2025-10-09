import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

    // For now, return empty agents array
    // In a real implementation, this would query the Python backend
    // or a shared database for agent status
    return NextResponse.json({
      workflow_id: workflowId,
      agents: []
    })

  } catch (error) {
    console.error('Error getting agent sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get agent status' },
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

    // Update agent status from Python backend
    const { agents } = body

    if (!Array.isArray(agents)) {
      return NextResponse.json(
        { error: 'Invalid agents data' },
        { status: 400 }
      )
    }

    // Import WebSocket manager to broadcast updates
    const { websocketManager } = await import('@/lib/websocket-server')
    
    // Broadcast each agent update
    for (const agent of agents) {
      const { agent_id, status, progress, message, current_task, requires_response } = agent

      websocketManager.broadcastAgentStatus(workflowId, {
        agentId: agent_id,
        status: status || 'idle',
        progress: progress || 0,
        message: message || '',
        currentTask: current_task
      })

      // If agent requires user input, send a message
      if (requires_response) {
        websocketManager.broadcastAgentMessage(workflowId, {
          agentId: agent_id,
          message: message || 'Agent requires user input',
          requiresResponse: true
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Agent status updated',
      updated_count: agents.length
    })

  } catch (error) {
    console.error('Error updating agent sync status:', error)
    return NextResponse.json(
      { error: 'Failed to update agent status' },
      { status: 500 }
    )
  }
}