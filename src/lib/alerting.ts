import { logger } from './logger';
import { metricsCollector } from './metrics';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  tenantId?: string;
  workflowId?: string;
  component: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: (metrics: any) => boolean;
  cooldownMinutes: number;
  enabled: boolean;
  tenantSpecific: boolean;
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack' | 'console';
  config: Record<string, any>;
  severityFilter: AlertSeverity[];
}

class AlertingSystem {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private channels: AlertChannel[] = [];
  private lastAlertTime: Map<string, Date> = new Map();
  private readonly maxAlerts = 1000;

  constructor() {
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
    this.startMonitoring();
  }

  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds 10% in the last 5 minutes',
        severity: AlertSeverity.HIGH,
        condition: () => {
          const health = metricsCollector.getHealthMetrics();
          return health.metrics.errorRate > 10;
        },
        cooldownMinutes: 5,
        enabled: true,
        tenantSpecific: false
      },
      {
        id: 'workflow-failures',
        name: 'Multiple Workflow Failures',
        description: 'More than 3 workflow failures in the last 10 minutes',
        severity: AlertSeverity.MEDIUM,
        condition: () => {
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          const failedWorkflows = metricsCollector.getMetrics(
            'workflow.completed',
            undefined,
            tenMinutesAgo
          ).filter(m => m.tags.status === 'failed');
          return failedWorkflows.length > 3;
        },
        cooldownMinutes: 10,
        enabled: true,
        tenantSpecific: true
      },
      {
        id: 'agent-timeout',
        name: 'Agent Operation Timeouts',
        description: 'Agent operations timing out frequently',
        severity: AlertSeverity.MEDIUM,
        condition: () => {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const timeoutOperations = metricsCollector.getMetrics(
            'agent.operation',
            undefined,
            fiveMinutesAgo
          ).filter(m => m.tags.status === 'timeout');
          return timeoutOperations.length > 5;
        },
        cooldownMinutes: 5,
        enabled: true,
        tenantSpecific: true
      },
      {
        id: 'system-unresponsive',
        name: 'System Unresponsive',
        description: 'System health check indicates unhealthy status',
        severity: AlertSeverity.CRITICAL,
        condition: () => {
          const health = metricsCollector.getHealthMetrics();
          return health.status === 'unhealthy';
        },
        cooldownMinutes: 2,
        enabled: true,
        tenantSpecific: false
      },
      {
        id: 'memory-usage-high',
        name: 'High Memory Usage',
        description: 'Memory usage exceeds 85%',
        severity: AlertSeverity.HIGH,
        condition: () => {
          const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
          const memoryMetrics = metricsCollector.getMetrics(
            'system.memory.usage',
            undefined,
            oneMinuteAgo
          );
          if (memoryMetrics.length === 0) return false;
          
          const latestMemory = memoryMetrics[memoryMetrics.length - 1];
          const memoryUsagePercent = (latestMemory.value / (1024 * 1024 * 1024)) * 100; // Assuming bytes to GB
          return memoryUsagePercent > 85;
        },
        cooldownMinutes: 5,
        enabled: true,
        tenantSpecific: false
      }
    ];
  }

  private initializeDefaultChannels(): void {
    // Console channel for development
    this.channels.push({
      type: 'console',
      config: {},
      severityFilter: [AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL]
    });

    // Webhook channel for production (if configured)
    if (process.env.ALERT_WEBHOOK_URL) {
      this.channels.push({
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ALERT_WEBHOOK_TOKEN || ''
          }
        },
        severityFilter: [AlertSeverity.HIGH, AlertSeverity.CRITICAL]
      });
    }
  }

  private startMonitoring(): void {
    // Check rules every minute
    setInterval(() => {
      this.checkRules();
    }, 60 * 1000);

    // Clean up old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000);
  }

  private checkRules(): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = rule.condition(null);
        if (shouldAlert && this.canAlert(rule.id, rule.cooldownMinutes)) {
          this.createAlert(rule);
        }
      } catch (error) {
        logger.error('Error checking alert rule', {
          component: 'alerting',
          operation: 'checkRules',
          metadata: { ruleId: rule.id, ruleName: rule.name }
        }, error as Error);
      }
    }
  }

  private canAlert(ruleId: string, cooldownMinutes: number): boolean {
    const lastAlert = this.lastAlertTime.get(ruleId);
    if (!lastAlert) return true;

    const cooldownMs = cooldownMinutes * 60 * 1000;
    return Date.now() - lastAlert.getTime() > cooldownMs;
  }

  private createAlert(rule: AlertRule): void {
    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      severity: rule.severity,
      title: rule.name,
      description: rule.description,
      component: 'system',
      timestamp: new Date().toISOString(),
      resolved: false,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name
      }
    };

    this.alerts.push(alert);
    this.lastAlertTime.set(rule.id, new Date());

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Send alert through channels
    this.sendAlert(alert);

    logger.warn('Alert triggered', {
      component: 'alerting',
      operation: 'createAlert',
      metadata: alert
    });
  }

  private async sendAlert(alert: Alert): Promise<void> {
    for (const channel of this.channels) {
      if (!channel.severityFilter.includes(alert.severity)) continue;

      try {
        await this.sendToChannel(alert, channel);
      } catch (error) {
        logger.error('Failed to send alert to channel', {
          component: 'alerting',
          operation: 'sendAlert',
          metadata: { alertId: alert.id, channelType: channel.type }
        }, error as Error);
      }
    }
  }

  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.error(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`);
        console.error(`Description: ${alert.description}`);
        console.error(`Time: ${alert.timestamp}`);
        if (alert.tenantId) console.error(`Tenant: ${alert.tenantId}`);
        if (alert.workflowId) console.error(`Workflow: ${alert.workflowId}`);
        break;

      case 'webhook':
        if (channel.config.url) {
          const response = await fetch(channel.config.url, {
            method: 'POST',
            headers: channel.config.headers || {},
            body: JSON.stringify({
              alert,
              timestamp: new Date().toISOString(),
              system: 'intelligent-bid-system'
            })
          });

          if (!response.ok) {
            throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
          }
        }
        break;

      case 'email':
        // Email implementation would go here
        logger.info('Email alert would be sent', {
          component: 'alerting',
          metadata: { alertId: alert.id }
        });
        break;

      case 'slack':
        // Slack implementation would go here
        logger.info('Slack alert would be sent', {
          component: 'alerting',
          metadata: { alertId: alert.id }
        });
        break;
    }
  }

  private cleanupOldAlerts(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const initialCount = this.alerts.length;
    
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp) > oneDayAgo
    );

    const removedCount = initialCount - this.alerts.length;
    if (removedCount > 0) {
      logger.info('Cleaned up old alerts', {
        component: 'alerting',
        operation: 'cleanup',
        metadata: { removedCount, remainingCount: this.alerts.length }
      });
    }
  }

  // Public methods for managing alerts
  getAlerts(
    tenantId?: string,
    severity?: AlertSeverity,
    resolved?: boolean,
    limit: number = 100
  ): Alert[] {
    let filtered = this.alerts;

    if (tenantId) {
      filtered = filtered.filter(a => a.tenantId === tenantId);
    }

    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }

    if (resolved !== undefined) {
      filtered = filtered.filter(a => a.resolved === resolved);
    }

    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();

    logger.info('Alert resolved', {
      component: 'alerting',
      operation: 'resolveAlert',
      metadata: { alertId, title: alert.title }
    });

    return true;
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
    logger.info('Alert rule added', {
      component: 'alerting',
      operation: 'addRule',
      metadata: { ruleId: rule.id, ruleName: rule.name }
    });
  }

  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(r => r.id !== ruleId);
    
    const removed = this.rules.length < initialLength;
    if (removed) {
      logger.info('Alert rule removed', {
        component: 'alerting',
        operation: 'removeRule',
        metadata: { ruleId }
      });
    }

    return removed;
  }

  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
    logger.info('Alert channel added', {
      component: 'alerting',
      operation: 'addChannel',
      metadata: { channelType: channel.type }
    });
  }

  // Manual alert creation for custom scenarios
  createCustomAlert(
    title: string,
    description: string,
    severity: AlertSeverity,
    tenantId?: string,
    workflowId?: string,
    metadata: Record<string, any> = {}
  ): string {
    const alert: Alert = {
      id: `custom-${Date.now()}`,
      severity,
      title,
      description,
      tenantId,
      workflowId,
      component: 'custom',
      timestamp: new Date().toISOString(),
      resolved: false,
      metadata
    };

    this.alerts.push(alert);
    this.sendAlert(alert);

    logger.warn('Custom alert created', {
      component: 'alerting',
      operation: 'createCustomAlert',
      metadata: alert
    });

    return alert.id;
  }

  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    activeAlerts: number;
    criticalAlerts: number;
    lastAlertTime?: string;
  } {
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL);
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (activeAlerts.length > 5) {
      status = 'degraded';
    }

    const lastAlert = this.alerts.length > 0 
      ? this.alerts[this.alerts.length - 1] 
      : null;

    return {
      status,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      lastAlertTime: lastAlert?.timestamp
    };
  }
}

export const alertingSystem = new AlertingSystem();
export default alertingSystem;