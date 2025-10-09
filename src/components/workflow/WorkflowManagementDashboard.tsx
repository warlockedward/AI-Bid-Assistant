'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Card, 
  Button, 
  Badge, 
  Tabs, 
  Input, 
  Select, 
  Spin, 
  Empty,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Tag,
  Modal,
  Descriptions,
  List,
  Progress,
  Switch,
  Form
} from 'antd'
import { 
  ApiOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  PauseCircleOutlined, 
  PlayCircleOutlined, 
  RedoOutlined,
  WarningOutlined,
  SearchOutlined,
  FilterOutlined,
  SettingOutlined,
  HistoryOutlined,
  RiseOutlined,
  FileTextOutlined,
  UserOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { WorkflowStatus } from '@/types/workflow'

const { Title, Text } = Typography
const { TabPane } = Tabs
const { Option } = Select

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

interface WorkflowStats {
  total: number
  running: number
  completed: number
  failed: number
  avgDuration: number
  successRate: number
}

interface TenantPreferences {
  autoRetry: boolean
  maxRetries: number
  notificationEmail: string
  defaultTimeout: number
  enableLogging: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export function WorkflowManagementDashboard({ tenantId }: { tenantId: string }) {
  const [workflows, setWorkflows] = useState<WorkflowExecution[]>([])
  const [stats, setStats] = useState<WorkflowStats | null>(null)
  const [preferences, setPreferences] = useState<TenantPreferences | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all')
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowExecution | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  useEffect(() => {
    loadWorkflows()
    loadStats()
    loadPreferences()
  }, [tenantId])

  const loadWorkflows = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/tenant/${tenantId}`)
      if (response.ok) {
        const data = await response.json()
        setWorkflows(data.workflows || generateMockWorkflows())
      } else {
        setWorkflows(generateMockWorkflows())
      }
    } catch (error) {
      console.error('Error loading workflows:', error)
      setWorkflows(generateMockWorkflows())
    }
  }, [tenantId])

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/tenant/${tenantId}/stats`)
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || generateMockStats())
      } else {
        setStats(generateMockStats())
      }
    } catch (error) {
      console.error('Error loading stats:', error)
      setStats(generateMockStats())
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  const loadPreferences = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/tenant/${tenantId}/preferences`)
      if (response.ok) {
        const data = await response.json()
        setPreferences(data.preferences || getDefaultPreferences())
      } else {
        setPreferences(getDefaultPreferences())
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
      setPreferences(getDefaultPreferences())
    }
  }, [tenantId])

  const handleWorkflowAction = async (workflowId: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/${action}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await loadWorkflows() // Refresh the list
      }
    } catch (error) {
      console.error(`Error ${action}ing workflow:`, error)
    }
  }

  const handlePreferencesUpdate = async (newPreferences: TenantPreferences) => {
    try {
      const response = await fetch(`/api/workflows/tenant/${tenantId}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPreferences)
      })
      
      if (response.ok) {
        setPreferences(newPreferences)
      }
    } catch (error) {
      console.error('Error updating preferences:', error)
    }
  }

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.projectName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusIcon = (status: WorkflowStatus) => {
    switch (status) {
      case WorkflowStatus.RUNNING:
        return <ApiOutlined style={{ color: '#1677ff' }} />
      case WorkflowStatus.COMPLETED:
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case WorkflowStatus.FAILED:
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      case WorkflowStatus.PAUSED:
        return <PauseCircleOutlined style={{ color: '#faad14' }} />
      case WorkflowStatus.CANCELLED:
        return <CloseCircleOutlined style={{ color: '#8c8c8c' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />
    }
  }

  const getStatusColor = (status: WorkflowStatus) => {
    switch (status) {
      case WorkflowStatus.PENDING: return 'default'
      case WorkflowStatus.RUNNING: return 'processing'
      case WorkflowStatus.PAUSED: return 'warning'
      case WorkflowStatus.COMPLETED: return 'success'
      case WorkflowStatus.FAILED: return 'error'
      case WorkflowStatus.CANCELLED: return 'default'
      case WorkflowStatus.RECOVERING: return 'warning'
      default: return 'default'
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <div>
        <Title level={3} style={{ margin: '0 0 8px 0' }}>Workflow Management</Title>
        <Text type="secondary">Monitor and manage your workflow executions</Text>
      </div>

      <Tabs defaultActiveKey="overview" style={{ marginTop: '24px' }}>
        <TabPane
          tab={
            <span>
              <RiseOutlined />
              Overview
            </span>
          }
          key="overview"
        >
          <OverviewTab 
            stats={stats} 
            workflows={workflows} 
            formatDuration={formatDuration}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <ApiOutlined />
              Workflows
            </span>
          }
          key="workflows"
        >
          <WorkflowsTab 
            workflows={filteredWorkflows}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            handleWorkflowAction={handleWorkflowAction}
            setSelectedWorkflow={setSelectedWorkflow}
            setDetailModalVisible={setDetailModalVisible}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <HistoryOutlined />
              History
            </span>
          }
          key="history"
        >
          <HistoryTab 
            workflows={workflows}
            formatDuration={formatDuration}
            handleWorkflowAction={handleWorkflowAction}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <SettingOutlined />
              Settings
            </span>
          }
          key="settings"
        >
          {preferences && (
            <PreferencesTab 
              preferences={preferences}
              onUpdate={handlePreferencesUpdate}
            />
          )}
        </TabPane>
      </Tabs>

      {/* Workflow Detail Modal */}
      <WorkflowDetailModal
        visible={detailModalVisible}
        workflow={selectedWorkflow}
        onClose={() => setDetailModalVisible(false)}
        onAction={handleWorkflowAction}
        formatDuration={formatDuration}
        getStatusIcon={getStatusIcon}
        getStatusColor={getStatusColor}
      />
    </div>
  )
}

// Overview Tab Component
function OverviewTab({ 
  stats, 
  workflows, 
  formatDuration,
  getStatusIcon,
  getStatusColor
}: { 
  stats: WorkflowStats | null,
  workflows: WorkflowExecution[],
  formatDuration: (ms: number) => string,
  getStatusIcon: (status: WorkflowStatus) => React.ReactNode,
  getStatusColor: (status: WorkflowStatus) => string
}) {
  return (
    <div style={{ marginTop: '24px' }}>
      {/* Stats Cards */}
      {stats && (
        <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Workflows"
                value={stats.total}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Running"
                value={stats.running}
                prefix={<ApiOutlined style={{ color: '#1677ff' }} />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Success Rate"
                value={stats.successRate}
                suffix="%"
                prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Avg Duration"
                value={formatDuration(stats.avgDuration)}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Recent Workflows */}
      <Card title="Recent Workflows">
        <List
          dataSource={workflows.slice(0, 5)}
          renderItem={workflow => (
            <List.Item>
              <List.Item.Meta
                avatar={getStatusIcon(workflow.status)}
                title={workflow.name}
                description={
                  <Space direction="vertical" size="small">
                    <Text type="secondary">{workflow.projectName}</Text>
                    <Space size="small">
                      <Badge color={getStatusColor(workflow.status)} text={workflow.status} />
                      <Text type="secondary">
                        {new Date(workflow.startedAt).toLocaleDateString()}
                      </Text>
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}

// Workflows Tab Component
function WorkflowsTab({ 
  workflows,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  handleWorkflowAction,
  setSelectedWorkflow,
  setDetailModalVisible,
  getStatusIcon,
  getStatusColor
}: { 
  workflows: WorkflowExecution[],
  searchTerm: string,
  setSearchTerm: (term: string) => void,
  statusFilter: WorkflowStatus | 'all',
  setStatusFilter: (filter: WorkflowStatus | 'all') => void,
  handleWorkflowAction: (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => void,
  setSelectedWorkflow: (workflow: WorkflowExecution) => void,
  setDetailModalVisible: (visible: boolean) => void,
  getStatusIcon: (status: WorkflowStatus) => React.ReactNode,
  getStatusColor: (status: WorkflowStatus) => string
}) {
  return (
    <div style={{ marginTop: '24px' }}>
      {/* Filters */}
      <Card title="Filters" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Input
              placeholder="Search workflows..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Col>
          <Col xs={24} md={12}>
            <Select
              style={{ width: '100%' }}
              placeholder="Select status"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="all">All Status</Option>
              <Option value={WorkflowStatus.RUNNING}>Running</Option>
              <Option value={WorkflowStatus.COMPLETED}>Completed</Option>
              <Option value={WorkflowStatus.FAILED}>Failed</Option>
              <Option value={WorkflowStatus.PAUSED}>Paused</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Workflows List */}
      <Card title={`Workflows (${workflows.length})`}>
        {workflows.length > 0 ? (
          <List
            dataSource={workflows}
            renderItem={workflow => (
              <WorkflowCard
                workflow={workflow}
                onAction={handleWorkflowAction}
                onSelect={(wf) => {
                  setSelectedWorkflow(wf)
                  setDetailModalVisible(true)
                }}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
              />
            )}
          />
        ) : (
          <Empty description="No workflows found" />
        )}
      </Card>
    </div>
  )
}

// History Tab Component
function HistoryTab({ 
  workflows,
  formatDuration,
  handleWorkflowAction,
  getStatusIcon,
  getStatusColor
}: { 
  workflows: WorkflowExecution[],
  formatDuration: (ms: number) => string,
  handleWorkflowAction: (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => void,
  getStatusIcon: (status: WorkflowStatus) => React.ReactNode,
  getStatusColor: (status: WorkflowStatus) => string
}) {
  const historyWorkflows = workflows.filter(w => 
    w.status === WorkflowStatus.COMPLETED || w.status === WorkflowStatus.FAILED
  )

  return (
    <div style={{ marginTop: '24px' }}>
      <Card title="Workflow History">
        {historyWorkflows.length > 0 ? (
          <List
            dataSource={historyWorkflows}
            renderItem={workflow => (
              <List.Item
                actions={[
                  workflow.duration && (
                    <Text type="secondary">
                      {formatDuration(workflow.duration)}
                    </Text>
                  ),
                  <Badge color={getStatusColor(workflow.status)} text={workflow.status} />,
                  workflow.status === WorkflowStatus.FAILED && (
                    <Button
                      size="small"
                      onClick={() => handleWorkflowAction(workflow.id, 'retry')}
                    >
                      <RedoOutlined /> Retry
                    </Button>
                  )
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={getStatusIcon(workflow.status)}
                  title={workflow.name}
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary">
                        {workflow.projectName} • {workflow.createdBy}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(workflow.startedAt).toLocaleString()} - 
                        {workflow.completedAt ? new Date(workflow.completedAt).toLocaleString() : 'Running'}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No workflow history found" />
        )}
      </Card>
    </div>
  )
}

// Preferences Tab Component
function PreferencesTab({ 
  preferences, 
  onUpdate 
}: { 
  preferences: TenantPreferences
  onUpdate: (preferences: TenantPreferences) => void
}) {
  const [form] = Form.useForm()
  
  useEffect(() => {
    form.setFieldsValue(preferences)
  }, [preferences, form])

  const onFinish = (values: TenantPreferences) => {
    onUpdate(values)
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <Card title="Tenant Preferences">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          {/* Retry Settings */}
          <Title level={5}>Retry Settings</Title>
          
          <Form.Item
            name="autoRetry"
            label="Auto Retry Failed Steps"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="maxRetries"
            label="Maximum Retries"
          >
            <Input type="number" min={1} max={10} />
          </Form.Item>

          {/* Notification Settings */}
          <Title level={5} style={{ marginTop: '24px' }}>Notifications</Title>
          
          <Form.Item
            name="notificationEmail"
            label="Notification Email"
          >
            <Input type="email" placeholder="admin@company.com" />
          </Form.Item>

          {/* Execution Settings */}
          <Title level={5} style={{ marginTop: '24px' }}>Execution Settings</Title>
          
          <Form.Item
            name="defaultTimeout"
            label="Default Timeout (seconds)"
          >
            <Input type="number" min={60} max={7200} />
          </Form.Item>

          {/* Logging Settings */}
          <Title level={5} style={{ marginTop: '24px' }}>Logging Settings</Title>
          
          <Form.Item
            name="enableLogging"
            label="Enable Detailed Logging"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="logLevel"
            label="Log Level"
          >
            <Select>
              <Option value="debug">Debug</Option>
              <Option value="info">Info</Option>
              <Option value="warn">Warning</Option>
              <Option value="error">Error</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Save Preferences
              </Button>
              <Button htmlType="button" onClick={() => form.resetFields()}>
                Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

// Workflow Card Component
function WorkflowCard({ 
  workflow, 
  onAction, 
  onSelect,
  getStatusIcon,
  getStatusColor
}: { 
  workflow: WorkflowExecution
  onAction: (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => void
  onSelect: (workflow: WorkflowExecution) => void
  getStatusIcon: (status: WorkflowStatus) => React.ReactNode
  getStatusColor: (status: WorkflowStatus) => string
}) {
  return (
    <List.Item
      actions={[
        <Badge color={getStatusColor(workflow.status)} text={workflow.status} />,
        workflow.status === WorkflowStatus.RUNNING && (
          <Space>
            <Button
              size="small"
              onClick={() => onAction(workflow.id, 'pause')}
            >
              <PauseCircleOutlined /> Pause
            </Button>
            <Button
              size="small"
              danger
              onClick={() => onAction(workflow.id, 'cancel')}
            >
              <CloseCircleOutlined /> Cancel
            </Button>
          </Space>
        ),
        workflow.status === WorkflowStatus.PAUSED && (
          <Space>
            <Button
              size="small"
              onClick={() => onAction(workflow.id, 'resume')}
            >
              <PlayCircleOutlined /> Resume
            </Button>
            <Button
              size="small"
              danger
              onClick={() => onAction(workflow.id, 'cancel')}
            >
              <CloseCircleOutlined /> Cancel
            </Button>
          </Space>
        ),
        workflow.status === WorkflowStatus.FAILED && workflow.error?.recoverable && (
          <Button
            size="small"
            onClick={() => onAction(workflow.id, 'retry')}
          >
            <RedoOutlined /> Retry
          </Button>
        ),
        <Button
          size="small"
          onClick={() => onSelect(workflow)}
        >
          <EyeOutlined /> View Details
        </Button>
      ].filter(Boolean)}
    >
      <List.Item.Meta
        avatar={getStatusIcon(workflow.status)}
        title={workflow.name}
        description={
          <Space direction="vertical" size="small">
            <Text type="secondary">
              {workflow.projectName} • {workflow.createdBy}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Started: {new Date(workflow.startedAt).toLocaleString()}
            </Text>
            {workflow.progress > 0 && workflow.status === WorkflowStatus.RUNNING && (
              <Progress percent={workflow.progress} size="small" />
            )}
            {workflow.error && (
              <Card size="small" style={{ marginTop: '8px' }}>
                <Space direction="vertical" size="small">
                  <Space>
                    <WarningOutlined style={{ color: '#ff4d4f' }} />
                    <Text strong type="danger">Error in {workflow.error.step}</Text>
                  </Space>
                  <Text type="danger">{workflow.error.message}</Text>
                  {workflow.error.recoverable && (
                    <div>
                      <Text strong type="danger" style={{ fontSize: '12px' }}>Recovery suggestions:</Text>
                      <ul style={{ margin: '4px 0 0 16px', fontSize: '12px' }}>
                        {workflow.error.suggestions.map((suggestion, index) => (
                          <li key={index} style={{ color: '#ff4d4f' }}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Space>
              </Card>
            )}
          </Space>
        }
      />
    </List.Item>
  )
}

// Workflow Detail Modal Component
function WorkflowDetailModal({ 
  visible, 
  workflow, 
  onClose, 
  onAction,
  formatDuration,
  getStatusIcon,
  getStatusColor
}: { 
  visible: boolean
  workflow: WorkflowExecution | null
  onClose: () => void
  onAction: (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => void
  formatDuration: (ms: number) => string
  getStatusIcon: (status: WorkflowStatus) => React.ReactNode
  getStatusColor: (status: WorkflowStatus) => string
}) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (workflow?.id) {
      loadWorkflowLogs()
    }
  }, [workflow?.id])

  const loadWorkflowLogs = useCallback(async () => {
    if (!workflow?.id) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/workflows/${workflow.id}/logs`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setLoading(false)
    }
  }, [workflow?.id])

  if (!workflow) return null

  return (
    <Modal
      title={workflow.name}
      visible={visible}
      onCancel={onClose}
      footer={[
        workflow.status === WorkflowStatus.RUNNING && (
          <>
            <Button onClick={() => onAction(workflow.id, 'pause')}>
              <PauseCircleOutlined /> Pause
            </Button>
            <Button danger onClick={() => onAction(workflow.id, 'cancel')}>
              <CloseCircleOutlined /> Cancel
            </Button>
          </>
        ),
        workflow.status === WorkflowStatus.PAUSED && (
          <>
            <Button onClick={() => onAction(workflow.id, 'resume')}>
              <PlayCircleOutlined /> Resume
            </Button>
            <Button danger onClick={() => onAction(workflow.id, 'cancel')}>
              <CloseCircleOutlined /> Cancel
            </Button>
          </>
        ),
        workflow.status === WorkflowStatus.FAILED && workflow.error?.recoverable && (
          <Button onClick={() => onAction(workflow.id, 'retry')}>
            <RedoOutlined /> Retry Workflow
          </Button>
        ),
        <Button onClick={onClose}>Close</Button>
      ].filter(Boolean)}
      width={800}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Row gutter={[24, 24]}>
          {/* Workflow Info */}
          <Col xs={24} md={12}>
            <Card title="Workflow Information" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Status">
                  <Badge color={getStatusColor(workflow.status)} text={workflow.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Progress">
                  {workflow.progress}%
                </Descriptions.Item>
                <Descriptions.Item label="Started">
                  {new Date(workflow.startedAt).toLocaleString()}
                </Descriptions.Item>
                {workflow.completedAt && (
                  <Descriptions.Item label="Completed">
                    {new Date(workflow.completedAt).toLocaleString()}
                  </Descriptions.Item>
                )}
                {workflow.duration && (
                  <Descriptions.Item label="Duration">
                    {formatDuration(workflow.duration)}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Created by">
                  <Space>
                    <UserOutlined />
                    {workflow.createdBy}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* Error Details */}
          {workflow.error && (
            <Col xs={24} md={12}>
              <Card title="Error Details" size="small">
                <Space direction="vertical">
                  <Text strong type="danger">Failed Step: {workflow.error.step}</Text>
                  <Text type="danger">{workflow.error.message}</Text>
                  <Text>
                    Recoverable: 
                    <Badge 
                      status={workflow.error.recoverable ? 'success' : 'error'} 
                      text={workflow.error.recoverable ? 'Yes' : 'No'} 
                    />
                  </Text>
                  {workflow.error.suggestions.length > 0 && (
                    <div>
                      <Text strong>Recovery Suggestions:</Text>
                      <ul style={{ margin: '4px 0 0 16px' }}>
                        {workflow.error.suggestions.map((suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Space>
              </Card>
            </Col>
          )}
        </Row>

        {/* Execution Logs */}
        <Card title="Execution Logs" size="small">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <Spin />
            </div>
          ) : (
            <List
              dataSource={logs}
              renderItem={(log, index) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text type="secondary" style={{ width: '80px' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Text>
                        <Text 
                          type={
                            log.level === 'error' ? 'danger' :
                            log.level === 'warn' ? 'warning' :
                            log.level === 'info' ? 'success' : undefined
                          }
                          style={{ width: '60px' }}
                        >
                          {log.level.toUpperCase()}
                        </Text>
                      </Space>
                    }
                    description={log.message}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Space>
    </Modal>
  )
}

// Helper functions would be defined here...
function generateMockWorkflows(): WorkflowExecution[] {
  return [
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
    }
  ]
}

function generateMockStats(): WorkflowStats {
  return {
    total: 45,
    running: 3,
    completed: 38,
    failed: 4,
    avgDuration: 1800000, // 30 minutes
    successRate: 84
  }
}

function getDefaultPreferences(): TenantPreferences {
  return {
    autoRetry: true,
    maxRetries: 3,
    notificationEmail: '',
    defaultTimeout: 3600,
    enableLogging: true,
    logLevel: 'info'
  }
}