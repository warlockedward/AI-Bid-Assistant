import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { websocketManager } from '@/lib/websocket-server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = params
    const { agentId, response } = await request.json()

    // In production, this would:
    // 1. Validate the workflow belongs to the tenant
    // 2. Send the user response to the appropriate agent
    // 3. Resume the workflow execution
    // 4. Log the interaction

    console.log('User response received:', {
      workflowId,
      agentId,
      response,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      timestamp: new Date().toISOString()
    })

    // Broadcast user response to all WebSocket connections for this workflow
    websocketManager.broadcastAgentMessage(workflowId, {
      agentId: 'system',
      message: `User responded to ${agentId}: "${response}"`,
      requiresResponse: false
    })

    // In production, this would also trigger agent processing
    // For now, simulate agent acknowledgment
    setTimeout(() => {
      websocketManager.broadcastAgentMessage(workflowId, {
        agentId,
        message: `Received user input: "${response}". Processing...`,
        requiresResponse: false
      })
    }, 1000)

    return NextResponse.json({
      success: true,
      message: 'User response received and forwarded to agent',
      workflowId,
      agentId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error handling user response:', error)
    return NextResponse.json(
      { error: 'Failed to process user response' },
      { status: 500 }
    )
  }
}