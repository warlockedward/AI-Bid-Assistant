import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { logger } from './logger'
import { metricsCollector } from './metrics'
import { websocketManager } from './websocket-server'

export interface MonitoringOptions {
  trackPerformance?: boolean
  trackErrors?: boolean
  trackTenantMetrics?: boolean
  operation?: string
  component?: string
}

export function withMonitoring(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options: MonitoringOptions = {}
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const startTime = Date.now()
    const {
      trackPerformance = true,
      trackErrors = true,
      trackTenantMetrics = true,
      operation = 'api_request',
      component = 'api'
    } = options

    // Extract request info
    const method = request.method
    const url = request.url
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    let session: any = null
    let tenantId: string | undefined
    let userId: string | undefined

    try {
      // Get session for tenant context
      if (trackTenantMetrics) {
        session = await getServerSession(authOptions)
        tenantId = session?.user?.tenantId
        userId = session?.user?.id
      }

      const baseContext = {
        component,
        operation,
        method,
        url,
        userAgent,
        ...(tenantId && { tenantId }),
        ...(userId && { userId })
      }

      // Log request start
      logger.info(`${method} ${url} - Request started`, baseContext)

      // Execute the handler
      const response = await handler(request, ...args)
      const duration = Date.now() - startTime
      const status = response.status

      // Log successful completion
      logger.info(`${method} ${url} - Request completed`, {
        ...baseContext,
        status: status.toString(),
        duration,
        success: true
      })

      // Record performance metrics
      if (trackPerformance) {
        metricsCollector.recordCustomMetric(
          'api.request.duration',
          duration,
          'milliseconds',
          {
            method,
            status: status.toString(),
            ...(tenantId && { tenantId }),
            component
          }
        )

        metricsCollector.recordCustomMetric(
          'api.request.count',
          1,
          'count',
          {
            method,
            status: status.toString(),
            ...(tenantId && { tenantId }),
            component
          }
        )
      }

      return response

    } catch (error) {
      const duration = Date.now() - startTime
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      const errorMessage = error instanceof Error ? error.message : String(error)

      const errorContext = {
        component,
        operation,
        method,
        url,
        userAgent,
        duration,
        errorName,
        errorMessage,
        ...(tenantId && { tenantId }),
        ...(userId && { userId })
      }

      // Log error
      if (trackErrors) {
        logger.error(`${method} ${url} - Request failed`, errorContext, error instanceof Error ? error : undefined)

        // Record error metrics
        metricsCollector.recordCustomMetric(
          'api.request.error',
          1,
          'count',
          {
            method,
            errorType: errorName,
            ...(tenantId && { tenantId }),
            component
          }
        )

        metricsCollector.recordCustomMetric(
          'api.request.duration',
          duration,
          'milliseconds',
          {
            method,
            status: '500',
            ...(tenantId && { tenantId }),
            component
          }
        )
      }

      // Return error response
      return NextResponse.json(
        { 
          error: 'Internal server error',
          requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        { status: 500 }
      )
    }
  }
}

// Middleware for workflow operations
export function withWorkflowMonitoring(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return withMonitoring(handler, {
    component: 'workflow',
    operation: 'workflow_operation',
    trackPerformance: true,
    trackErrors: true,
    trackTenantMetrics: true
  })
}

// Middleware for agent operations
export function withAgentMonitoring(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return withMonitoring(handler, {
    component: 'agent',
    operation: 'agent_operation',
    trackPerformance: true,
    trackErrors: true,
    trackTenantMetrics: true
  })
}

// Middleware for WebSocket operations
export function withWebSocketMonitoring(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return withMonitoring(handler, {
    component: 'websocket',
    operation: 'websocket_operation',
    trackPerformance: true,
    trackErrors: true,
    trackTenantMetrics: true
  })
}

// Performance timing utility
export class PerformanceTimer {
  private startTime: number
  private operation: string
  private context: Record<string, any>

  constructor(operation: string, context: Record<string, any> = {}) {
    this.startTime = Date.now()
    this.operation = operation
    this.context = context

    logger.debug(`Performance timer started: ${operation}`, {
      ...context,
      component: 'performance'
    })
  }

  end(additionalContext: Record<string, any> = {}): number {
    const duration = Date.now() - this.startTime
    
    logger.info(`Performance timer completed: ${this.operation}`, {
      ...this.context,
      ...additionalContext,
      duration,
      component: 'performance'
    })

    metricsCollector.recordCustomMetric(
      'performance.operation.duration',
      duration,
      'milliseconds',
      {
        operation: this.operation,
        ...this.context,
        ...additionalContext
      }
    )

    return duration
  }

  checkpoint(checkpointName: string, additionalContext: Record<string, any> = {}): number {
    const duration = Date.now() - this.startTime
    
    logger.debug(`Performance checkpoint: ${this.operation} - ${checkpointName}`, {
      ...this.context,
      ...additionalContext,
      duration,
      checkpoint: checkpointName,
      component: 'performance'
    })

    metricsCollector.recordCustomMetric(
      'performance.checkpoint.duration',
      duration,
      'milliseconds',
      {
        operation: this.operation,
        checkpoint: checkpointName,
        ...this.context,
        ...additionalContext
      }
    )

    return duration
  }
}

// System health checker
export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map()

  addCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.checks.set(name, checkFn)
  }

  async runHealthChecks(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Record<string, boolean>
    timestamp: string
  }> {
    const results: Record<string, boolean> = {}
    
    const checkEntries = Array.from(this.checks.entries());
    for (const [name, checkFn] of checkEntries) {
      try {
        results[name] = await checkFn()
      } catch (error) {
        logger.error(`Health check failed: ${name}`, { component: 'health' }, error instanceof Error ? error : undefined)
        results[name] = false
      }
    }

    const failedChecks = Object.values(results).filter(result => !result).length
    const totalChecks = Object.keys(results).length
    
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (failedChecks === 0) {
      status = 'healthy'
    } else if (failedChecks / totalChecks > 0.5) {
      status = 'unhealthy'
    } else {
      status = 'degraded'
    }

    logger.info('Health check completed', {
      component: 'health',
      status,
      totalChecks,
      failedChecks,
      results
    })

    return {
      status,
      checks: results,
      timestamp: new Date().toISOString()
    }
  }
}

// Global health checker instance
export const healthChecker = new HealthChecker()

// Add default health checks
healthChecker.addCheck('metrics_collection', async () => {
  const metrics = metricsCollector.getMetrics(undefined, undefined, new Date(Date.now() - 60000), 1)
  return metrics.length > 0
})

healthChecker.addCheck('websocket_server', async () => {
  return websocketManager.getActiveWorkflows().length >= 0 // Always true if manager is working
})