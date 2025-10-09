import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
    const { sectionId, approved, feedback } = await request.json()

    // In production, this would:
    // 1. Update the workflow state in the database
    // 2. If approved, mark the section as complete and move to next step
    // 3. If rejected, trigger regeneration with feedback
    // 4. Notify the workflow orchestrator to continue

    console.log('Workflow confirmation:', {
      workflowId,
      sectionId,
      approved,
      feedback,
      tenantId: session.user.tenantId
    })

    // Mock response - in production, return updated workflow state
    return NextResponse.json({
      success: true,
      message: approved ? 'Content approved' : 'Content rejected, regenerating...',
      nextStep: approved ? `generate-next-section` : `regenerate-${sectionId}`
    })
  } catch (error) {
    console.error('Error confirming workflow content:', error)
    return NextResponse.json(
      { error: 'Failed to confirm content' },
      { status: 500 }
    )
  }
}