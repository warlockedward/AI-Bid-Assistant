import { NextRequest, NextResponse } from 'next/server'
import { websocketManager } from '@/lib/websocket-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant_id parameter' },
        { status: 400 }
      )
    }

    // Validate tenant access to workflow using WebSocket manager
    const hasAccess = websocketManager.validateTenantAccess(workflowId, tenantId)

    if (hasAccess) {
      return NextResponse.json({
        success: true,
        workflow_id: workflowId,
        tenant_id: tenantId,
        access: 'granted'
      })
    } else {
      return NextResponse.json(
        { 
          error: 'Access denied',
          workflow_id: workflowId,
          tenant_id: tenantId,
          access: 'denied'
        },
        { status: 403 }
      )
    }

  } catch (error) {
    console.error('Error validating workflow access:', error)
    return NextResponse.json(
      { error: 'Failed to validate access' },
      { status: 500 }
    )
  }
}