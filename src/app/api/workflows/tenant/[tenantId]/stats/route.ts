import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface WorkflowStats {
  total: number
  running: number
  completed: number
  failed: number
  avgDuration: number
  successRate: number
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

    // In production, calculate from database
    // const stats = await db.workflowExecution.aggregate({
    //   where: { tenantId },
    //   _count: { _all: true },
    //   _avg: { duration: true }
    // })

    // Mock stats for now
    const stats: WorkflowStats = {
      total: 45,
      running: 3,
      completed: 38,
      failed: 4,
      avgDuration: 1800000, // 30 minutes in milliseconds
      successRate: Math.round((38 / 42) * 100) // 90%
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching workflow stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}