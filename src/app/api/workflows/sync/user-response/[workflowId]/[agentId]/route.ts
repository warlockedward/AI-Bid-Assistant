import { NextRequest, NextResponse } from 'next/server'
import { workflowWebSocketBridge } from '@/lib/workflow-websocket-bridge'

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string; agentId: string } }
) {
  try {
    const { workflowId, agentId } = params

    // Get user response from the bridge queue
    const response = workflowWebSocketBridge.getUserResponse(workflowId, agentId)

    if (response) {
      return NextResponse.json({
        success: true,
        response,
        workflow_id: workflowId,
        agent_id: agentId,
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json(
        { 
          success: false,
          message: 'No response available',
          workflow_id: workflowId,
          agent_id: agentId
        },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('Error getting user response:', error)
    return NextResponse.json(
      { error: 'Failed to get user response' },
      { status: 500 }
    )
  }
}