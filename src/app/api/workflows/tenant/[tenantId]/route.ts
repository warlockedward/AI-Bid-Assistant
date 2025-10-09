import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WorkflowStatus } from '@/types/workflow'

interface WorkflowExecution {
  id: string
  name: string
  status: WorkflowStatus
  progress: number
  startedAt: Date
  completedAt?: Date
  duration?: number
  projectName: string
  createdBy: string
  error?: {
    message: string
    step: string
    recoverable: boolean
    suggestions: string[]
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tenantId } = params

    // Verify user has access to this tenant
    if (session.user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // In production, fetch from database
    // const workflows = await db.workflowExecution.findMany({
    //   where: { tenantId },
    //   orderBy: { startedAt: 'desc' },
    //   include: { project: true, user: true }
    // })

    // Mock data for now
    const workflows: WorkflowExecution[] = [
      {
        id: 'wf-001',
        name: 'Bid Document Generation - Tech RFP',
        status: WorkflowStatus.RUNNING,
        progress: 65,
        startedAt: new Date(Date.now() - 300000),
        projectName: 'Enterprise Software RFP',
        createdBy: 'John Smith'
      },
      {
        id: 'wf-002',
        name: 'Bid Document Generation - Healthcare',
        status: WorkflowStatus.COMPLETED,
        progress: 100,
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(Date.now() - 1800000),
        duration: 1800000,
        projectName: 'Healthcare Management System',
        createdBy: 'Sarah Johnson'
      },
      {
        id: 'wf-003',
        name: 'Bid Document Generation - Infrastructure',
        status: WorkflowStatus.FAILED,
        progress: 45,
        startedAt: new Date(Date.now() - 7200000),
        projectName: 'Cloud Infrastructure Project',
        createdBy: 'Mike Davis',
        error: {
          message: 'Knowledge retrieval timeout',
          step: 'knowledge_retrieval',
          recoverable: true,
          suggestions: [
            'Check network connectivity',
            'Verify API credentials',
            'Retry with reduced scope'
          ]
        }
      },
      {
        id: 'wf-004',
        name: 'Bid Document Generation - Financial Services',
        status: WorkflowStatus.PAUSED,
        progress: 30,
        startedAt: new Date(Date.now() - 1800000),
        projectName: 'Banking Platform RFP',
        createdBy: 'Alice Brown'
      },
      {
        id: 'wf-005',
        name: 'Bid Document Generation - E-commerce',
        status: WorkflowStatus.COMPLETED,
        progress: 100,
        startedAt: new Date(Date.now() - 86400000),
        completedAt: new Date(Date.now() - 84600000),
        duration: 1800000,
        projectName: 'E-commerce Platform',
        createdBy: 'Bob Wilson'
      }
    ]

    return NextResponse.json({ workflows })
  } catch (error) {
    console.error('Error fetching tenant workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}