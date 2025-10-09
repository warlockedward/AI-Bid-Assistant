/**
 * Tests for the monitoring and logging infrastructure
 */

import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';
import { alertingSystem, AlertSeverity } from '@/lib/alerting';

describe('Monitoring System', () => {
  beforeEach(() => {
    // Clear any existing metrics and alerts
    jest.clearAllMocks();
  });

  describe('Logger', () => {
    it('should create structured log entries', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logger.info('Test message', {
        component: 'test',
        operation: 'unit-test'
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should support tenant-aware logging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const tenantContext = {
        tenant_id: 'test-tenant',
        user_id: 'test-user',
        sso_provider: 'test-sso',
        sso_id: 'test-sso-id',
        preferences: {},
        permissions: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      const tenantLogger = logger.withTenant(tenantContext);
      tenantLogger.info('Tenant-specific message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should time operations correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await logger.time(
        'test_operation',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'result';
        },
        { component: 'test' }
      );

      expect(consoleSpy).toHaveBeenCalledTimes(2); // Start and completion logs
      consoleSpy.mockRestore();
    });
  });

  describe('Metrics Collector', () => {
    it('should record workflow metrics', () => {
      const workflowId = 'test-workflow';
      const tenantId = 'test-tenant';

      metricsCollector.recordWorkflowStart(workflowId, tenantId);

      const metrics = metricsCollector.getMetrics('workflow.started');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].tags.workflowId).toBe(workflowId);
      expect(metrics[0].tags.tenantId).toBe(tenantId);
    });

    it('should record agent operation metrics', () => {
      const agentMetrics = {
        agentId: 'test-agent',
        agentType: 'TestAgent',
        tenantId: 'test-tenant',
        workflowId: 'test-workflow',
        operation: 'test-operation',
        duration: 1500,
        status: 'success' as const,
        inputTokens: 100,
        outputTokens: 200
      };

      metricsCollector.recordAgentOperation(agentMetrics);

      const operationMetrics = metricsCollector.getMetrics('agent.operation');
      const durationMetrics = metricsCollector.getMetrics('agent.duration');

      expect(operationMetrics.length).toBeGreaterThan(0);
      expect(durationMetrics.length).toBeGreaterThan(0);
      expect(durationMetrics[0].value).toBe(1500);
    });

    it('should aggregate metrics correctly', () => {
      // Record multiple metrics
      for (let i = 0; i < 5; i++) {
        metricsCollector.recordCustomMetric('test.metric', i * 10, 'count', {
          group: i % 2 === 0 ? 'even' : 'odd'
        });
      }

      const aggregated = metricsCollector.getAggregatedMetrics(
        'test.metric',
        'sum',
        'group'
      );

      expect(aggregated).toHaveProperty('even');
      expect(aggregated).toHaveProperty('odd');
      expect(aggregated.even).toBe(60); // 0 + 20 + 40
      expect(aggregated.odd).toBe(30);  // 10 + 30
    });

    it('should provide health metrics', () => {
      const health = metricsCollector.getHealthMetrics();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('metrics');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Alerting System', () => {
    it('should create and manage alerts', () => {
      const alertId = alertingSystem.createCustomAlert(
        'Test Alert',
        'This is a test alert',
        AlertSeverity.MEDIUM,
        'test-tenant',
        'test-workflow',
        { testData: 'value' }
      );

      expect(alertId).toBeDefined();

      const alerts = alertingSystem.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const testAlert = alerts.find(a => a.id === alertId);
      expect(testAlert).toBeDefined();
      expect(testAlert?.title).toBe('Test Alert');
      expect(testAlert?.severity).toBe(AlertSeverity.MEDIUM);
    });

    it('should resolve alerts', () => {
      const alertId = alertingSystem.createCustomAlert(
        'Resolvable Alert',
        'This alert will be resolved',
        AlertSeverity.LOW
      );

      const resolved = alertingSystem.resolveAlert(alertId);
      expect(resolved).toBe(true);

      const alerts = alertingSystem.getAlerts(undefined, undefined, true);
      const resolvedAlert = alerts.find(a => a.id === alertId);
      expect(resolvedAlert?.resolved).toBe(true);
    });

    it('should filter alerts correctly', () => {
      // Create alerts with different severities
      alertingSystem.createCustomAlert('Low Alert', 'Low severity', AlertSeverity.LOW);
      alertingSystem.createCustomAlert('High Alert', 'High severity', AlertSeverity.HIGH);
      alertingSystem.createCustomAlert('Critical Alert', 'Critical severity', AlertSeverity.CRITICAL);

      const highAlerts = alertingSystem.getAlerts(undefined, AlertSeverity.HIGH);
      const criticalAlerts = alertingSystem.getAlerts(undefined, AlertSeverity.CRITICAL);

      expect(highAlerts.length).toBe(1);
      expect(criticalAlerts.length).toBe(1);
      expect(highAlerts[0].title).toBe('High Alert');
      expect(criticalAlerts[0].title).toBe('Critical Alert');
    });

    it('should provide system health status', () => {
      const health = alertingSystem.getSystemHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('activeAlerts');
      expect(health).toHaveProperty('criticalAlerts');
      expect(['healthy', 'degraded', 'critical']).toContain(health.status);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate logging with metrics collection', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Perform a timed operation that should generate both logs and metrics
      await logger.time(
        'integration_test',
        async () => {
          metricsCollector.recordCustomMetric('integration.test', 1, 'count');
          return 'success';
        },
        { component: 'integration-test' }
      );

      const metrics = metricsCollector.getMetrics('integration.test');
      expect(metrics.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle error scenarios correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        await logger.time(
          'error_test',
          async () => {
            throw new Error('Test error');
          },
          { component: 'error-test' }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});