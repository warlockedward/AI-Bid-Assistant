import { NextRequest, NextResponse } from 'next/server'
import { sign } from 'jsonwebtoken'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: workflowId } = params

    // For testing purposes, create a mock WebSocket token
    // In production, this would check authentication
    const wsToken = sign(
      {
        sub: 'test-user-id',
        tenantId: 'test-tenant-id',
        workflowId,
        type: 'websocket'
      },
      process.env.NEXTAUTH_SECRET || 'secret',
      { expiresIn: '1h' }
    )

    return NextResponse.json({
      wsToken,
      workflowId,
      expiresIn: 3600
    })

  } catch (error) {
    console.error('Error creating WebSocket token:', error)
    return NextResponse.json(
      { error: 'Failed to create WebSocket token' },
      { status: 500 }
    )
  }
}