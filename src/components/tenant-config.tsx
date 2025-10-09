'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  Button, 
  Input, 
  Switch, 
  Tabs, 
  Card, 
  Space, 
  Typography,
  Alert,
  Spin,
  Select,
  theme
} from 'antd'
import { 
  SettingOutlined, 
  ApiOutlined, 
  NotificationOutlined, 
  ControlOutlined,
  SaveOutlined,
  WarningOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography
const { TabPane } = Tabs
const { Option } = Select

interface TenantConfig {
  id: string
  tenantId: string
  ragApiUrl?: string
  llmEndpoint?: string
  features: {
    aiAssistance: boolean
    workflowAutomation: boolean
    documentGeneration: boolean
    complianceCheck: boolean
  }
  workflowSettings: {
    autoSave: boolean
    checkpointInterval: number
    maxRetries: number
    timeoutMinutes: number
  }
  uiCustomization: {
    theme: string
    primaryColor: string
    companyLogo?: string
  }
  notificationSettings: {
    emailNotifications: boolean
    workflowCompletion: boolean
    errorAlerts: boolean
    weeklyReports: boolean
  }
  tenant: {
    id: string
    name: string
    domain?: string
  }
}

export function TenantConfig() {
  const { token } = theme.useToken()
  const { data: session } = useSession()
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 加载租户配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/tenants/config')
        if (!response.ok) {
          throw new Error('Failed to fetch config')
        }
        const data = await response.json()
        setConfig(data.config)
      } catch (error) {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : '加载配置失败'
        })
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.tenantId) {
      fetchConfig()
    }
  }, [session])

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/tenants/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ragApiUrl: config.ragApiUrl,
          llmEndpoint: config.llmEndpoint,
          features: config.features,
          workflowSettings: config.workflowSettings,
          uiCustomization: config.uiCustomization,
          notificationSettings: config.notificationSettings,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '保存失败')
      }

      const data = await response.json()
      setConfig(data.config)
      setMessage({ type: 'success', text: '配置保存成功' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存失败'
      })
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (path: string, value: any) => {
    if (!config) return

    setConfig(prev => {
      if (!prev) return prev
      
      const newConfig = { ...prev }
      const keys = path.split('.')
      let current: any = newConfig
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      
      current[keys[keys.length - 1]] = value
      return newConfig
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px' }}>
        <Space direction="vertical" align="center">
          <Spin size="large" />
          <Text>加载配置中...</Text>
        </Space>
      </div>
    )
  }

  if (!config) {
    return (
      <div style={{ textAlign: 'center', padding: '32px' }}>
        <WarningOutlined style={{ fontSize: '48px', color: token?.colorError }} />
        <Text type="danger" style={{ display: 'block', marginTop: '16px' }}>无法加载租户配置</Text>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题和保存按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: '0 0 8px 0' }}>租户配置</Title>
          <Text type="secondary">管理 {config.tenant.name} 的系统配置</Text>
        </div>
        <Button 
          type="primary" 
          icon={<SaveOutlined />} 
          onClick={handleSave} 
          loading={saving}
        >
          {saving ? '保存中...' : '保存配置'}
        </Button>
      </div>

      {/* 消息提示 */}
      {message && (
        <Alert 
          message={message.text}
          type={message.type}
          showIcon
          icon={message.type === 'success' ? <CheckCircleOutlined /> : <WarningOutlined />}
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* 配置选项卡 */}
      <Tabs defaultActiveKey="general">
        <TabPane
          tab={
            <span>
              <SettingOutlined />
              基础设置
            </span>
          }
          key="general"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card title="AI服务配置">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>RAG API地址</Text>
                  <Input
                    value={config.ragApiUrl || ''}
                    onChange={(e) => updateConfig('ragApiUrl', e.target.value)}
                    placeholder="https://your-rag-api.com/api"
                  />
                </Space>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>LLM端点地址</Text>
                  <Input
                    value={config.llmEndpoint || ''}
                    onChange={(e) => updateConfig('llmEndpoint', e.target.value)}
                    placeholder="https://your-llm-endpoint.com/api"
                  />
                </Space>
              </Space>
            </Card>

            <Card title="功能开关">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space direction="vertical">
                    <Text strong>AI辅助功能</Text>
                    <Text type="secondary">启用AI驱动的内容生成和建议</Text>
                  </Space>
                  <Switch
                    checked={config.features.aiAssistance}
                    onChange={(checked) => updateConfig('features.aiAssistance', checked)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space direction="vertical">
                    <Text strong>工作流自动化</Text>
                    <Text type="secondary">启用自动化工作流执行</Text>
                  </Space>
                  <Switch
                    checked={config.features.workflowAutomation}
                    onChange={(checked) => updateConfig('features.workflowAutomation', checked)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space direction="vertical">
                    <Text strong>文档生成</Text>
                    <Text type="secondary">启用AI文档生成功能</Text>
                  </Space>
                  <Switch
                    checked={config.features.documentGeneration}
                    onChange={(checked) => updateConfig('features.documentGeneration', checked)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space direction="vertical">
                    <Text strong>合规检查</Text>
                    <Text type="secondary">启用自动合规性验证</Text>
                  </Space>
                  <Switch
                    checked={config.features.complianceCheck}
                    onChange={(checked) => updateConfig('features.complianceCheck', checked)}
                  />
                </div>
              </Space>
            </Card>
          </Space>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ControlOutlined />
              工作流
            </span>
          }
          key="workflow"
        >
          <Card title="工作流执行设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>自动保存</Text>
                  <Text type="secondary">自动保存工作流进度</Text>
                </Space>
                <Switch
                  checked={config.workflowSettings.autoSave}
                  onChange={(checked) => updateConfig('workflowSettings.autoSave', checked)}
                />
              </div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>检查点间隔（秒）</Text>
                <Input
                  type="number"
                  value={config.workflowSettings.checkpointInterval}
                  onChange={(e) => updateConfig('workflowSettings.checkpointInterval', parseInt(e.target.value))}
                  min="60"
                  max="3600"
                />
              </Space>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>最大重试次数</Text>
                <Input
                  type="number"
                  value={config.workflowSettings.maxRetries}
                  onChange={(e) => updateConfig('workflowSettings.maxRetries', parseInt(e.target.value))}
                  min="0"
                  max="10"
                />
              </Space>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>超时时间（分钟）</Text>
                <Input
                  type="number"
                  value={config.workflowSettings.timeoutMinutes}
                  onChange={(e) => updateConfig('workflowSettings.timeoutMinutes', parseInt(e.target.value))}
                  min="5"
                  max="480"
                />
              </Space>
            </Space>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ApiOutlined />
              界面定制
            </span>
          }
          key="ui"
        >
          <Card title="界面定制">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>主题</Text>
                <Select
                  style={{ width: '100%' }}
                  value={config.uiCustomization.theme}
                  onChange={(value) => updateConfig('uiCustomization.theme', value)}
                >
                  <Option value="light">浅色主题</Option>
                  <Option value="dark">深色主题</Option>
                  <Option value="auto">跟随系统</Option>
                </Select>
              </Space>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>主色调</Text>
                <Input
                  type="color"
                  value={config.uiCustomization.primaryColor}
                  onChange={(e) => updateConfig('uiCustomization.primaryColor', e.target.value)}
                />
              </Space>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>公司Logo URL</Text>
                <Input
                  value={config.uiCustomization.companyLogo || ''}
                  onChange={(e) => updateConfig('uiCustomization.companyLogo', e.target.value)}
                  placeholder="https://your-domain.com/logo.png"
                />
              </Space>
            </Space>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <NotificationOutlined />
              通知设置
            </span>
          }
          key="notifications"
        >
          <Card title="通知设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>邮件通知</Text>
                  <Text type="secondary">启用邮件通知功能</Text>
                </Space>
                <Switch
                  checked={config.notificationSettings.emailNotifications}
                  onChange={(checked) => updateConfig('notificationSettings.emailNotifications', checked)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>工作流完成通知</Text>
                  <Text type="secondary">工作流完成时发送通知</Text>
                </Space>
                <Switch
                  checked={config.notificationSettings.workflowCompletion}
                  onChange={(checked) => updateConfig('notificationSettings.workflowCompletion', checked)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>错误警报</Text>
                  <Text type="secondary">系统错误时发送警报</Text>
                </Space>
                <Switch
                  checked={config.notificationSettings.errorAlerts}
                  onChange={(checked) => updateConfig('notificationSettings.errorAlerts', checked)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>周报</Text>
                  <Text type="secondary">发送系统使用周报</Text>
                </Space>
                <Switch
                  checked={config.notificationSettings.weeklyReports}
                  onChange={(checked) => updateConfig('notificationSettings.weeklyReports', checked)}
                />
              </div>
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}