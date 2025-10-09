import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Store user responses temporarily (in production, use Redis or database)
const userResponses = new Map<string, Map<string, { response: string; timestamp: string }>>()

export async function POST(request: NextRequest) {
  try {
    // For testing, skip authentication
    // const session = await getServerSession(authOptions)
    // if (!session?.user?.tenantId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const body = await request.json()
    const { workflow_id, agent_id, response, timestamp } = body

    if (!workflow_id || !agent_id || !response) {
      return NextResponse.json(
        { error: 'Missing required fields: workflow_id, agent_id, response' },
        { status: 400 }
      )
    }

    // Store the response
    if (!userResponses.has(workflow_id)) {
      userResponses.set(workflow_id, new Map())
    }
    
    userResponses.get(workflow_id)!.set(agent_id, {
      response,
      timestamp: timestamp || new Date().toISOString()
    })

    // Import WebSocket manager to broadcast the response
    const { websocketManager } = await import('@/lib/websocket-server')
    
    // Broadcast user response to all connections in the workflow
    websocketManager.broadcastSystemNotification(workflow_id, {
      level: 'info',
      message: `User response received for ${agent_id}`,
      details: { agentId: agent_id, response }
    })

    return NextResponse.json({
      success: true,
      message: 'User response stored',
      workflow_id,
      agent_id
    })

  } catch (error) {
    console.error('Error storing user response:', error)
    return NextResponse.json(
      { error: 'Failed to store user response' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // For testing, skip authentication
    // const session = await getServerSession(authOptions)
    // if (!session?.user?.tenantId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflow_id')
    const agentId = searchParams.get('agent_id')

    if (!workflowId || !agentId) {
      return NextResponse.json(
        { error: 'Missing workflow_id or agent_id parameters' },
        { status: 400 }
      )
    }

    // Get the response
    const workflowResponses = userResponses.get(workflowId)
    const responseData = workflowResponses?.get(agentId)

    if (responseData) {
      // Remove response after retrieval
      workflowResponses!.delete(agentId)
      if (workflowResponses!.size === 0) {
        userResponses.delete(workflowId)
      }

      return NextResponse.json({
        success: true,
        response: responseData.response,
        timestamp: responseData.timestamp,
        workflow_id: workflowId,
        agent_id: agentId
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'No response available',
        workflow_id: workflowId,
        agent_id: agentId
      }, { status: 404 })
    }

  } catch (error) {
    console.error('Error retrieving user response:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve user response' },
      { status: 500 }
    )
  }
}