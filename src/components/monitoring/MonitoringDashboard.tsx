'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Tabs, 
  Alert, 
  Row, 
  Col, 
  Statistic, 
  Space, 
  Typography,
  List,
  Badge,
  theme
} from 'antd';
import { 
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ApiOutlined,
  AlertOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { AlertSeverity } from '@/lib/alerting';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
}

interface AlertData {
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

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    metrics: {
      status: string;
      checks: Record<string, boolean>;
      metrics: Record<string, number>;
    };
    alerting: {
      status: string;
      activeAlerts: number;
      criticalAlerts: number;
      lastAlertTime?: string;
    };
    system: {
      uptime: number;
      memory: any;
      nodeVersion: string;
      platform: string;
    };
  };
}

export default function MonitoringDashboard() {
  const { token } = theme.useToken();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MetricData[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthData();
    fetchAlerts();
    fetchMetrics();

    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchHealthData();
      fetchAlerts();
      fetchMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/monitoring/health');
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError('Failed to fetch health data');
      console.error('Health fetch error:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/monitoring/alerts?resolved=false&limit=50');
      const data = await response.json();
      if (data.success) {
        setAlerts(data.data);
      }
    } catch (err) {
      setError('Failed to fetch alerts');
      console.error('Alerts fetch error:', err);
    }
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      
      // Fetch different metric types
      const metricTypes = [
        'workflow.completed',
        'agent.operation',
        'system.error.rate',
        'system.response.time'
      ];

      const metricsData: Record<string, MetricData[]> = {};
      
      for (const metricType of metricTypes) {
        const response = await fetch(
          `/api/monitoring/metrics?name=${metricType}&limit=100&since=${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`
        );
        const data = await response.json();
        if (data.success) {
          metricsData[metricType] = data.data;
        }
      }

      setMetrics(metricsData);
    } catch (err) {
      setError('Failed to fetch metrics');
      console.error('Metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' })
      });

      if (response.ok) {
        setAlerts(alerts.filter(alert => alert.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': 
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.LOW: return 'processing';
      case AlertSeverity.MEDIUM: return 'warning';
      case AlertSeverity.HIGH: return 'orange';
      case AlertSeverity.CRITICAL: return 'error';
      default: return 'default';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading && !health) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64px' }}>
        <Text>Loading monitoring data...</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Title level={3} style={{ margin: 0 }}>System Monitoring</Title>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={() => {
            fetchHealthData();
            fetchAlerts();
            fetchMetrics();
          }}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Alert 
          message="Error" 
          description={error} 
          type="error" 
          showIcon 
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* System Health Overview */}
      {health && (
        <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="System Status"
                value={health.status}
                prefix={
                  health.status === 'healthy' ? 
                  <CheckCircleOutlined style={{ color: token?.colorSuccess }} /> :
                  health.status === 'degraded' ?
                  <WarningOutlined style={{ color: token?.colorWarning }} /> :
                  <CloseCircleOutlined style={{ color: token?.colorError }} />
                }
                valueStyle={{ 
                  color: health.status === 'healthy' ? token?.colorSuccess :
                         health.status === 'degraded' ? token?.colorWarning :
                         token?.colorError
                }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Active Alerts"
                value={health.components.alerting.activeAlerts}
                prefix={<AlertOutlined style={{ color: token?.colorWarning }} />}
                valueStyle={{ color: token?.colorWarning }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {health.components.alerting.criticalAlerts} critical
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="System Uptime"
                value={formatUptime(health.components.system.uptime)}
                prefix={<DesktopOutlined />}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Memory: {formatMemory(health.components.system.memory.heapUsed)}
              </Text>
            </Card>
          </Col>
        </Row>
      )}

      <Tabs defaultActiveKey="alerts">
        <TabPane
          tab={
            <span>
              <AlertOutlined />
              Active Alerts
            </span>
          }
          key="alerts"
        >
          <Card title="Active Alerts" style={{ marginBottom: '24px' }}>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Text type="secondary">No active alerts</Text>
              </div>
            ) : (
              <List
                dataSource={alerts}
                renderItem={(alert) => (
                  <List.Item
                    actions={[
                      <Button
                        size="small"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        Resolve
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Badge status={getSeverityColor(alert.severity) as any} text={alert.severity} />
                          <Text strong>{alert.title}</Text>
                        </Space>
                      }
                      description={
                        <Space direction="vertical">
                          <Text type="secondary">{alert.description}</Text>
                          <Space size="small">
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              Component: {alert.component}
                            </Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              Time: {new Date(alert.timestamp).toLocaleString()}
                            </Text>
                            {alert.tenantId && (
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                Tenant: {alert.tenantId}
                              </Text>
                            )}
                          </Space>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ApiOutlined />
              Metrics
            </span>
          }
          key="metrics"
        >
          <Row gutter={[24, 24]}>
            {Object.entries(metrics).map(([metricName, metricData]) => (
              <Col xs={24} md={12} key={metricName}>
                <Card 
                  title={metricName} 
                  extra={<InfoCircleOutlined />}
                >
                  {metricData.length > 0 ? (
                    <Space direction="vertical">
                      <Statistic
                        value={metricData[metricData.length - 1]?.value || 0}
                        suffix={metricData[0]?.unit}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Latest: {metricData[metricData.length - 1] ? 
                          new Date(metricData[metricData.length - 1].timestamp).toLocaleString() : 
                          'No data'
                        }
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Data points: {metricData.length}
                      </Text>
                    </Space>
                  ) : (
                    <Text type="secondary">No data available</Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane
          tab={
            <span>
              <DatabaseOutlined />
              Health Details
            </span>
          }
          key="health"
        >
          {health && (
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Card title="Metrics System">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Status:</Text>
                      <Badge status={getStatusColor(health.components.metrics.status)} text={health.components.metrics.status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Error Rate:</Text>
                      <Text>{health.components.metrics.metrics.errorRate.toFixed(2)}%</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Total Metrics:</Text>
                      <Text>{health.components.metrics.metrics.totalMetrics}</Text>
                    </div>
                  </Space>
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card title="System Resources">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Platform:</Text>
                      <Text>{health.components.system.platform}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Node Version:</Text>
                      <Text>{health.components.system.nodeVersion}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Heap Used:</Text>
                      <Text>{formatMemory(health.components.system.memory.heapUsed)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Heap Total:</Text>
                      <Text>{formatMemory(health.components.system.memory.heapTotal)}</Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            </Row>
          )}
        </TabPane>
      </Tabs>
    </div>
  );
}