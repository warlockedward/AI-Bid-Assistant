import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/metrics';
import { alertingSystem } from '@/lib/alerting';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const metricsHealth = metricsCollector.getHealthMetrics();
    const alertingHealth = alertingSystem.getSystemHealth();

    const overallStatus = 
      metricsHealth.status === 'unhealthy' || alertingHealth.status === 'critical'
        ? 'unhealthy'
        : metricsHealth.status === 'degraded' || alertingHealth.status === 'degraded'
        ? 'degraded'
        : 'healthy';

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        metrics: {
          status: metricsHealth.status,
          checks: metricsHealth.checks,
          metrics: metricsHealth.metrics
        },
        alerting: {
          status: alertingHealth.status,
          activeAlerts: alertingHealth.activeAlerts,
          criticalAlerts: alertingHealth.criticalAlerts,
          lastAlertTime: alertingHealth.lastAlertTime
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform
        }
      }
    };

    // Log health check
    logger.info('Health check performed', {
      component: 'monitoring-api',
      operation: 'healthCheck',
      metadata: { status: overallStatus }
    });

    // Return appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthData, { status: httpStatus });

  } catch (error) {
    logger.error('Error performing health check', {
      component: 'monitoring-api',
      operation: 'healthCheck'
    }, error as Error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}