import { logger } from './logger';

export interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
}

export interface WorkflowMetrics {
  workflowId: string;
  tenantId: string;
  status: 'started' | 'completed' | 'failed' | 'paused';
  duration?: number;
  stepCount?: number;
  errorCount?: number;
  retryCount?: number;
}

export interface AgentMetrics {
  agentId: string;
  agentType: string;
  tenantId: string;
  workflowId?: string;
  operation: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  inputTokens?: number;
  outputTokens?: number;
  ragQueries?: number;
}

export interface SystemMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  activeWorkflows: number;
  activeTenants: number;
  errorRate: number;
  responseTime: number;
}

class MetricsCollector {
  private metrics: MetricData[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k metrics in memory

  private createMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {}
  ): MetricData {
    return {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags: {
        ...tags,
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  private addMetric(metric: MetricData): void {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log metric for external collection
    logger.info('Metric collected', {
      component: 'metrics',
      metadata: metric
    });
  }

  // Workflow metrics
  recordWorkflowStart(workflowId: string, tenantId: string): void {
    this.addMetric(this.createMetric(
      'workflow.started',
      1,
      'count',
      { workflowId, tenantId }
    ));
  }

  recordWorkflowCompletion(metrics: WorkflowMetrics): void {
    const tags = {
      workflowId: metrics.workflowId,
      tenantId: metrics.tenantId,
      status: metrics.status
    };

    this.addMetric(this.createMetric('workflow.completed', 1, 'count', tags));

    if (metrics.duration) {
      this.addMetric(this.createMetric(
        'workflow.duration',
        metrics.duration,
        'milliseconds',
        tags
      ));
    }

    if (metrics.stepCount) {
      this.addMetric(this.createMetric(
        'workflow.steps',
        metrics.stepCount,
        'count',
        tags
      ));
    }

    if (metrics.errorCount) {
      this.addMetric(this.createMetric(
        'workflow.errors',
        metrics.errorCount,
        'count',
        tags
      ));
    }

    if (metrics.retryCount) {
      this.addMetric(this.createMetric(
        'workflow.retries',
        metrics.retryCount,
        'count',
        tags
      ));
    }
  }

  // Agent metrics
  recordAgentOperation(metrics: AgentMetrics): void {
    const tags = {
      agentId: metrics.agentId,
      agentType: metrics.agentType,
      tenantId: metrics.tenantId,
      operation: metrics.operation,
      status: metrics.status
    };

    if (metrics.workflowId) {
      (tags as any).workflowId = metrics.workflowId;
    }

    this.addMetric(this.createMetric(
      'agent.operation',
      1,
      'count',
      tags
    ));

    this.addMetric(this.createMetric(
      'agent.duration',
      metrics.duration,
      'milliseconds',
      tags
    ));

    if (metrics.inputTokens) {
      this.addMetric(this.createMetric(
        'agent.tokens.input',
        metrics.inputTokens,
        'count',
        tags
      ));
    }

    if (metrics.outputTokens) {
      this.addMetric(this.createMetric(
        'agent.tokens.output',
        metrics.outputTokens,
        'count',
        tags
      ));
    }

    if (metrics.ragQueries) {
      this.addMetric(this.createMetric(
        'agent.rag.queries',
        metrics.ragQueries,
        'count',
        tags
      ));
    }
  }

  // System metrics
  recordSystemMetrics(metrics: SystemMetrics): void {
    const tags = { component: 'system' };

    if (metrics.cpuUsage !== undefined) {
      this.addMetric(this.createMetric(
        'system.cpu.usage',
        metrics.cpuUsage,
        'percent',
        tags
      ));
    }

    if (metrics.memoryUsage !== undefined) {
      this.addMetric(this.createMetric(
        'system.memory.usage',
        metrics.memoryUsage,
        'bytes',
        tags
      ));
    }

    this.addMetric(this.createMetric(
      'system.workflows.active',
      metrics.activeWorkflows,
      'count',
      tags
    ));

    this.addMetric(this.createMetric(
      'system.tenants.active',
      metrics.activeTenants,
      'count',
      tags
    ));

    this.addMetric(this.createMetric(
      'system.error.rate',
      metrics.errorRate,
      'percent',
      tags
    ));

    this.addMetric(this.createMetric(
      'system.response.time',
      metrics.responseTime,
      'milliseconds',
      tags
    ));
  }

  // Custom metrics
  recordCustomMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {}
  ): void {
    this.addMetric(this.createMetric(name, value, unit, tags));
  }

  // Query methods for dashboards
  getMetrics(
    name?: string,
    tenantId?: string,
    since?: Date,
    limit: number = 1000
  ): MetricData[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (tenantId) {
      filtered = filtered.filter(m => m.tags.tenantId === tenantId);
    }

    if (since) {
      filtered = filtered.filter(m => new Date(m.timestamp) >= since);
    }

    return filtered.slice(-limit);
  }

  getAggregatedMetrics(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    groupBy?: string,
    since?: Date
  ): Record<string, number> {
    const metrics = this.getMetrics(name, undefined, since);
    
    if (!groupBy) {
      const values = metrics.map(m => m.value);
      switch (aggregation) {
        case 'sum':
          return { total: values.reduce((a, b) => a + b, 0) };
        case 'avg':
          return { average: values.reduce((a, b) => a + b, 0) / values.length };
        case 'min':
          return { minimum: Math.min(...values) };
        case 'max':
          return { maximum: Math.max(...values) };
        case 'count':
          return { count: values.length };
        default:
          return {};
      }
    }

    const grouped = metrics.reduce((acc, metric) => {
      const key = metric.tags[groupBy] || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    const result: Record<string, number> = {};
    for (const [key, values] of Object.entries(grouped)) {
      switch (aggregation) {
        case 'sum':
          result[key] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          result[key] = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'min':
          result[key] = Math.min(...values);
          break;
        case 'max':
          result[key] = Math.max(...values);
          break;
        case 'count':
          result[key] = values.length;
          break;
      }
    }

    return result;
  }

  // Health check metrics
  getHealthMetrics(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    metrics: Record<string, number>;
  } {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const recentMetrics = this.getMetrics(undefined, undefined, fiveMinutesAgo);
    const errorMetrics = recentMetrics.filter(m => 
      m.name.includes('error') || m.tags.status === 'error'
    );
    
    const errorRate = recentMetrics.length > 0 
      ? (errorMetrics.length / recentMetrics.length) * 100 
      : 0;

    const checks = {
      metricsCollecting: recentMetrics.length > 0,
      lowErrorRate: errorRate < 5,
      systemResponsive: true // Could add more sophisticated checks
    };

    const allHealthy = Object.values(checks).every(check => check);
    const status = allHealthy ? 'healthy' : errorRate > 20 ? 'unhealthy' : 'degraded';

    return {
      status,
      checks,
      metrics: {
        errorRate,
        totalMetrics: this.metrics.length,
        recentMetrics: recentMetrics.length
      }
    };
  }
}

export const metricsCollector = new MetricsCollector();
export default metricsCollector;