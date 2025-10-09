import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metricsCollector } from '@/lib/metrics'
import { websocketManager } from '@/lib/websocket-server'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '1h'
    const tenantId = session.user.tenantId

    // Calculate time range
    const now = new Date()
    const timeRangeMs = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    }[timeRange] || 60 * 60 * 1000

    const since = new Date(now.getTime() - timeRangeMs)

    // Get tenant-specific metrics
    const tenantMetrics = metricsCollector.getMetrics(undefined, tenantId, since)
    
    // Get aggregated data
    const workflowMetrics = metricsCollector.getAggregatedMetrics(
      'workflow.completed',
      'count',
      'status',
      since
    )

    const agentMetrics = metricsCollector.getAggregatedMetrics(
      'agent.operation',
      'count',
      'agentType',
      since
    )

    const errorMetrics = metricsCollector.getAggregatedMetrics(
      'workflow.errors',
      'sum',
      undefined,
      since
    )

    // Get current system status
    const activeWorkflows = websocketManager.getTenantWorkflows(tenantId)
    const connectionCount = websocketManager.getTenantConnectionCount(tenantId)
    const healthMetrics = metricsCollector.getHealthMetrics()

    // Calculate performance metrics
    const avgResponseTime = metricsCollector.getAggregatedMetrics(
      'system.response.time',
      'avg',
      undefined,
      since
    )

    const errorRate = metricsCollector.getAggregatedMetrics(
      'system.error.rate',
      'avg',
      undefined,
      since
    )

    // Workflow status distribution
    const workflowStatusDistribution = {
      completed: workflowMetrics.completed || 0,
      failed: workflowMetrics.failed || 0,
      running: activeWorkflows.length
    }

    // Agent performance metrics
    const agentPerformance = Object.entries(agentMetrics).map(([agentType, count]) => ({
      agentType,
      operationCount: count,
      avgDuration: metricsCollector.getAggregatedMetrics(
        'agent.duration',
        'avg',
        'agentType',
        since
      )[agentType] || 0
    }))

    // Recent activity timeline
    const recentActivity = tenantMetrics
      .filter(m => ['workflow.started', 'workflow.completed', 'agent.operation'].includes(m.name))
      .slice(-20)
      .map(m => ({
        timestamp: m.timestamp,
        type: m.name,
        details: m.tags
      }))

    // System alerts
    const alerts = []
    if (healthMetrics.status !== 'healthy') {
      alerts.push({
        level: healthMetrics.status === 'unhealthy' ? 'error' : 'warning',
        message: `System health is ${healthMetrics.status}`,
        details: healthMetrics.checks
      })
    }

    if ((errorRate.average || 0) > 5) {
      alerts.push({
        level: 'warning',
        message: `High error rate: ${(errorRate.average || 0).toFixed(2)}%`,
        details: { errorRate: errorRate.average }
      })
    }

    const dashboard = {
      tenant: {
        id: tenantId,
        name: session.user.name || 'Unknown'
      },
      timeRange,
      timestamp: now.toISOString(),
      
      // Overview metrics
      overview: {
        activeWorkflows: activeWorkflows.length,
        totalConnections: connectionCount,
        completedWorkflows: workflowMetrics.completed || 0,
        totalErrors: errorMetrics.total || 0,
        systemHealth: healthMetrics.status,
        avgResponseTime: avgResponseTime.average || 0,
        errorRate: errorRate.average || 0
      },

      // Workflow metrics
      workflows: {
        statusDistribution: workflowStatusDistribution,
        activeWorkflowIds: activeWorkflows,
        recentCompletions: workflowMetrics
      },

      // Agent metrics
      agents: {
        performance: agentPerformance,
        totalOperations: Object.values(agentMetrics).reduce((sum, count) => sum + count, 0)
      },

      // System metrics
      system: {
        health: healthMetrics,
        performance: {
          avgResponseTime: avgResponseTime.average || 0,
          errorRate: errorRate.average || 0,
          connectionCount
        }
      },

      // Activity and alerts
      activity: {
        recent: recentActivity,
        alerts
      }
    }

    return NextResponse.json(dashboard)

  } catch (error) {
    console.error('Error generating monitoring dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to generate dashboard' },
      { status: 500 }
    )
  }
}