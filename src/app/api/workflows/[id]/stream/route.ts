import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = params

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'connected',
            workflowId,
            timestamp: new Date().toISOString()
          })}\n\n`)
        )

        // Simulate agent status updates
        const simulateAgentUpdates = () => {
          const agents = [
            { id: 'tender-analysis', name: '招标分析智能体' },
            { id: 'knowledge-retrieval', name: '知识检索智能体' },
            { id: 'content-generation', name: '内容生成智能体' },
            { id: 'compliance-verification', name: '合规验证智能体' }
          ]

          let currentAgentIndex = 0
          let step = 0

          const sendUpdate = () => {
            if (step >= 20) { // Complete after 20 steps
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'workflow_complete',
                  result: { status: 'completed', message: 'All agents completed successfully' },
                  timestamp: new Date().toISOString()
                })}\n\n`)
              )
              controller.close()
              return
            }

            const agent = agents[currentAgentIndex]
            const progress = Math.min(100, (step + 1) * 5)
            
            // Send agent status update
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'agent_status',
                agentId: agent.id,
                status: progress === 100 ? 'completed' : 'processing',
                progress,
                message: `Processing step ${step + 1}...`,
                currentTask: `Task ${step + 1} for ${agent.name}`,
                timestamp: new Date().toISOString()
              })}\n\n`)
            )

            // Send agent message
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'agent_message',
                agentId: agent.id,
                message: `${agent.name} 正在执行第 ${step + 1} 步操作`,
                requiresResponse: step === 10, // Require user input at step 10
                timestamp: new Date().toISOString()
              })}\n\n`)
            )

            // Update workflow status
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'workflow_status',
                status: 'running',
                controls: {
                  canPause: true,
                  canResume: false,
                  canCancel: true
                },
                timestamp: new Date().toISOString()
              })}\n\n`)
            )

            step++
            if (step % 5 === 0) {
              currentAgentIndex = (currentAgentIndex + 1) % agents.length
            }

            setTimeout(sendUpdate, 2000) // Update every 2 seconds
          }

          // Start sending updates after 1 second
          setTimeout(sendUpdate, 1000)
        }

        simulateAgentUpdates()

        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString()
              })}\n\n`)
            )
          } catch (error) {
            clearInterval(heartbeatInterval)
          }
        }, 30000)

        return () => {
          clearInterval(heartbeatInterval)
        }
      },
      
      cancel() {
        console.log('Agent stream cancelled for workflow:', workflowId)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })

  } catch (error) {
    console.error('Error setting up agent stream:', error)
    return NextResponse.json(
      { error: 'Failed to setup agent stream' },
      { status: 500 }
    )
  }
}