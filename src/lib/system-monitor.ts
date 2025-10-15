import { metricsCollector, SystemMetrics } from './metrics'
import { logger } from './logger'
import { websocketManager } from './websocket-server'
import { alertingSystem, AlertSeverity } from './alerting'

export class SystemMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null
  private isMonitoring = false

  start(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('System monitor already running', { component: 'system-monitor' })
      return
    }

    this.isMonitoring = true
    
    logger.info('Starting system monitor', {
      component: 'system-monitor',
      operation: 'start',
      intervalMs
    })

    // Collect metrics immediately
    this.collectMetrics()

    // Set up periodic collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, intervalMs)
  }

  stop(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    logger.info('System monitor stopped', { component: 'system-monitor' })
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherSystemMetrics()
      
      // Record system metrics
      metricsCollector.recordSystemMetrics(metrics)

      // Check for alerts
      this.checkSystemAlerts(metrics)

      logger.debug('System metrics collected', {
        component: 'system-monitor',
        operation: 'collectMetrics',
        metadata: metrics
      })

    } catch (error) {
      logger.error('Failed to collect system metrics', {
        component: 'system-monitor',
        operation: 'collectMetrics'
      }, error instanceof Error ? error : undefined)
    }
  }

  private async gatherSystemMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      activeWorkflows: 0,
      activeTenants: 0,
      errorRate: 0,
      responseTime: 0
    }

    try {
      // Get WebSocket metrics
      const activeWorkflows = websocketManager.getActiveWorkflows()
      metrics.activeWorkflows = activeWorkflows.length

      // Count unique tenants from active workflows
      const tenantIds = new Set<string>()
      for (const workflowId of activeWorkflows) {
        // This would need to be enhanced to actually get tenant info from workflows
        // For now, we'll estimate based on connection count
      }
      metrics.activeTenants = Math.max(1, Math.ceil(activeWorkflows.length / 2)) // Rough estimate

      // Get system performance metrics
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage()
        metrics.memoryUsage = memUsage.heapUsed
      }

      if (typeof process !== 'undefined' && process.cpuUsage) {
        const cpuUsage = process.cpuUsage()
        // Convert to percentage (this is a simplified calculation)
        metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000 // Convert microseconds to seconds
      }

      // Calculate error rate from recent metrics
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const recentMetrics = metricsCollector.getMetrics(undefined, undefined, fiveMinutesAgo)
      const errorMetrics = recentMetrics.filter(m => 
        m.name.includes('error') || 
        m.tags.status === 'error' || 
        m.tags.status === 'failed'
      )
      
      metrics.errorRate = recentMetrics.length > 0 
        ? (errorMetrics.length / recentMetrics.length) * 100 
        : 0

      // Calculate average response time
      const responseTimeMetrics = recentMetrics.filter(m => 
        m.name.includes('duration') || m.name.includes('response.time')
      )
      
      if (responseTimeMetrics.length > 0) {
        metrics.responseTime = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
      }

    } catch (error) {
      logger.error('Error gathering system metrics', {
        component: 'system-monitor',
        operation: 'gatherSystemMetrics'
      }, error instanceof Error ? error : undefined)
    }

    return metrics
  }

  private checkSystemAlerts(metrics: SystemMetrics): void {
    try {
      // High memory usage alert
      if (metrics.memoryUsage && metrics.memoryUsage > 1024 * 1024 * 1024) { // > 1GB
        alertingSystem.createCustomAlert(
          'High Memory Usage',
          `Memory usage is ${(metrics.memoryUsage / (1024 * 1024 * 1024)).toFixed(2)}GB`,
          AlertSeverity.HIGH,
          undefined,
          undefined,
          { memoryUsage: metrics.memoryUsage }
        )
      }

      // High error rate alert
      if (metrics.errorRate > 10) {
        alertingSystem.createCustomAlert(
          'High Error Rate',
          `Error rate is ${metrics.errorRate.toFixed(2)}%`,
          AlertSeverity.HIGH,
          undefined,
          undefined,
          { errorRate: metrics.errorRate }
        )
      }

      // Slow response time alert
      if (metrics.responseTime > 5000) { // > 5 seconds
        alertingSystem.createCustomAlert(
          'Slow Response Time',
          `Average response time is ${metrics.responseTime.toFixed(0)}ms`,
          AlertSeverity.MEDIUM,
          undefined,
          undefined,
          { responseTime: metrics.responseTime }
        )
      }

      // No active workflows for extended period (might indicate system issues)
      if (metrics.activeWorkflows === 0) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const recentWorkflows = metricsCollector.getMetrics('workflow.started', undefined, oneHourAgo)
        
        if (recentWorkflows.length === 0) {
          alertingSystem.createCustomAlert(
            'No Workflow Activity',
            'No workflows have been started in the last hour',
            AlertSeverity.LOW,
            undefined,
            undefined,
            { lastWorkflowActivity: oneHourAgo.toISOString() }
          )
        }
      }

    } catch (error) {
      logger.error('Error checking system alerts', {
        component: 'system-monitor',
        operation: 'checkSystemAlerts'
      }, error instanceof Error ? error : undefined)
    }
  }

  // Get current system status
  getSystemStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    metrics: SystemMetrics
    uptime: number
    timestamp: string
  } {
    const health = metricsCollector.getHealthMetrics()
    const alertHealth = alertingSystem.getSystemHealth()
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (health.status === 'unhealthy' || alertHealth.status === 'critical') {
      status = 'unhealthy'
    } else if (health.status === 'degraded' || alertHealth.status === 'degraded') {
      status = 'degraded'
    }

    // Get current metrics
    const currentMetrics: SystemMetrics = {
      activeWorkflows: websocketManager.getActiveWorkflows().length,
      activeTenants: Math.max(1, Math.ceil(websocketManager.getActiveWorkflows().length / 2)),
      errorRate: health.metrics.errorRate,
      responseTime: 0 // Would need to be calculated from recent metrics
    }

    return {
      status,
      metrics: currentMetrics,
      uptime: process.uptime ? process.uptime() * 1000 : 0,
      timestamp: new Date().toISOString()
    }
  }

  // Get detailed monitoring report
  getMonitoringReport() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentMetrics = metricsCollector.getMetrics(undefined, undefined, fiveMinutesAgo)
    
    const workflowMetrics = recentMetrics.filter(m => m.name.startsWith('workflow.'))
    const agentMetrics = recentMetrics.filter(m => m.name.startsWith('agent.'))
    const errorMetrics = recentMetrics.filter(m => 
      m.name.includes('error') || m.tags.status === 'error'
    )
    const websocketMetrics = recentMetrics.filter(m => m.name.startsWith('websocket.'))

    return {
      system: this.getSystemStatus(),
      health: metricsCollector.getHealthMetrics(),
      alerts: alertingSystem.getSystemHealth(),
      recentMetrics: {
        workflows: workflowMetrics.length,
        agents: agentMetrics.length,
        errors: errorMetrics.length,
        websocketConnections: websocketMetrics.length
      }
    }
  }
}

// Global system monitor instance
export const systemMonitor = new SystemMonitor()

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  systemMonitor.start(30000) // Every 30 seconds in production
} else {
  systemMonitor.start(60000) // Every minute in development
}