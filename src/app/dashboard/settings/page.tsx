'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Card, 
  Button, 
  Tabs, 
  Switch, 
  Input, 
  Select, 
  Space, 
  Typography,
  Spin,
  theme
} from 'antd'
import { ModelSelector } from '@/components/ModelSelector'
import { 
  SettingOutlined, 
  UserOutlined, 
  NotificationOutlined, 
  SafetyCertificateOutlined, 
  ApiOutlined,
  MailOutlined,
  KeyOutlined,
  GlobalOutlined,
  FormatPainterOutlined,
  DatabaseOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography
const { TabPane } = Tabs
const { Option } = Select

export default function SettingsPage() {
  const { token } = theme.useToken()
  const { data: session, status } = useSession()
  const router = useRouter()
  
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.tenantId) {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
      <Spin size="large" />
    </div>
  }

  if (!session?.user?.tenantId) {
    return null
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={3} style={{ margin: '0 0 8px 0' }}>系统设置</Title>
        <Text type="secondary">管理您的账户设置、通知偏好和系统配置</Text>
      </div>

      <Tabs defaultActiveKey="profile">
        <TabPane
          tab={
            <span>
              <UserOutlined />
              个人资料
            </span>
          }
          key="profile"
        >
          <Card title={<Space><UserOutlined />个人信息</Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>姓名</Text>
                  <Input defaultValue={session.user.name || ''} />
                </Space>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>邮箱</Text>
                  <Input defaultValue={session.user.email || ''} />
                </Space>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>职位</Text>
                  <Input placeholder="请输入职位" />
                </Space>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>部门</Text>
                  <Input placeholder="请输入部门" />
                </Space>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary">
                  保存更改
                </Button>
              </div>
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
          <Card title={<Space><NotificationOutlined />通知偏好</Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>工作流完成通知</Text>
                  <Text type="secondary">当AI工作流完成时接收通知</Text>
                </Space>
                <Switch defaultChecked />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>错误警报</Text>
                  <Text type="secondary">当系统出现错误时立即通知</Text>
                </Space>
                <Switch defaultChecked />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>每周报告</Text>
                  <Text type="secondary">接收每周的投标活动摘要</Text>
                </Space>
                <Switch />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical">
                  <Text strong>审核提醒</Text>
                  <Text type="secondary">当有内容需要审核时通知</Text>
                </Space>
                <Switch defaultChecked />
              </div>

              <div style={{ borderTop: `1px solid ${token?.colorBorder}`, paddingTop: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '12px' }}>通知方式</Text>
                <Space direction="vertical">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="checkbox" id="email-notifications" defaultChecked style={{ marginRight: '8px' }} />
                    <label htmlFor="email-notifications">邮件通知</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="checkbox" id="browser-notifications" style={{ marginRight: '8px' }} />
                    <label htmlFor="browser-notifications">浏览器通知</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="checkbox" id="sms-notifications" style={{ marginRight: '8px' }} />
                    <label htmlFor="sms-notifications">短信通知</label>
                  </div>
                </Space>
              </div>
            </Space>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <SafetyCertificateOutlined />
              安全设置
            </span>
          }
          key="security"
        >
          <Card title={<Space><SafetyCertificateOutlined />安全与隐私</Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>密码设置</Text>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>当前密码</Text>
                    <Input.Password />
                  </Space>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>新密码</Text>
                    <Input.Password />
                  </Space>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>确认新密码</Text>
                    <Input.Password />
                  </Space>
                  <Button>更新密码</Button>
                </Space>
              </Space>

              <div style={{ borderTop: `1px solid ${token?.colorBorder}`, paddingTop: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '12px' }}>两步验证</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">为您的账户添加额外的安全保护</Text>
                  <Button>
                    <KeyOutlined /> 启用两步验证
                  </Button>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${token?.colorBorder}`, paddingTop: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '12px' }}>活跃会话</Text>
                <div style={{ padding: '12px', border: `1px solid ${token?.colorBorder}`, borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space direction="vertical">
                      <Text strong>当前会话</Text>
                      <Text type="secondary">Chrome on macOS • 当前位置</Text>
                    </Space>
                    <span style={{ 
                      backgroundColor: token?.colorSuccessBg, 
                      color: token?.colorSuccess, 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      活跃
                    </span>
                  </div>
                </div>
              </div>
            </Space>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ApiOutlined />
              集成配置
            </span>
          }
          key="integrations"
        >
          <Card title={<Space><ApiOutlined />AI 模型配置</Space>}>
            <ModelSelector 
              onModelChange={(provider, model) => {
                console.log('Model changed:', provider, model);
              }}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <FormatPainterOutlined />
              界面设置
            </span>
          }
          key="appearance"
        >
          <Card title={<Space><FormatPainterOutlined />界面个性化</Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space direction="vertical">
                <Text strong>主题设置</Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ 
                    border: `2px solid ${token?.colorPrimary}`, 
                    borderRadius: '8px', 
                    padding: '12px', 
                    cursor: 'pointer' 
                  }}>
                    <div style={{ 
                      width: '100%', 
                      height: '80px', 
                      background: 'linear-gradient(to bottom right, #f0f7ff, #ffffff)', 
                      borderRadius: '4px', 
                      marginBottom: '8px' 
                    }}></div>
                    <Text style={{ textAlign: 'center', fontSize: '12px' }}>浅色主题</Text>
                  </div>
                  <div style={{ 
                    border: `2px solid ${token?.colorBorder}`, 
                    borderRadius: '8px', 
                    padding: '12px', 
                    cursor: 'pointer' 
                  }}>
                    <div style={{ 
                      width: '100%', 
                      height: '80px', 
                      background: 'linear-gradient(to bottom right, #1d1d1d, #000000)', 
                      borderRadius: '4px', 
                      marginBottom: '8px' 
                    }}></div>
                    <Text style={{ textAlign: 'center', fontSize: '12px' }}>深色主题</Text>
                  </div>
                  <div style={{ 
                    border: `2px solid ${token?.colorBorder}`, 
                    borderRadius: '8px', 
                    padding: '12px', 
                    cursor: 'pointer' 
                  }}>
                    <div style={{ 
                      width: '100%', 
                      height: '80px', 
                      background: 'linear-gradient(to bottom right, #e6f4ff, #f9f0ff)', 
                      borderRadius: '4px', 
                      marginBottom: '8px' 
                    }}></div>
                    <Text style={{ textAlign: 'center', fontSize: '12px' }}>自动切换</Text>
                  </div>
                </div>
              </Space>

              <div style={{ borderTop: `1px solid ${token?.colorBorder}`, paddingTop: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '12px' }}>语言设置</Text>
                <Select style={{ width: '100%' }} defaultValue="zh-CN">
                  <Option value="zh-CN">简体中文</Option>
                  <Option value="en-US">English</Option>
                  <Option value="zh-TW">繁體中文</Option>
                </Select>
              </div>

              <div style={{ borderTop: `1px solid ${token?.colorBorder}`, paddingTop: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '12px' }}>显示设置</Text>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: '12px' }}>显示侧边栏</Text>
                    <Switch defaultChecked />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: '12px' }}>紧凑模式</Text>
                    <Switch />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: '12px' }}>显示动画效果</Text>
                    <Switch defaultChecked />
                  </div>
                </Space>
              </div>
            </Space>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <DatabaseOutlined />
              高级设置
            </span>
          }
          key="advanced"
        >
          <Card title={<Space><DatabaseOutlined />系统配置</Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>工作流设置</Text>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>自动保存间隔 (秒)</Text>
                    <Input type="number" defaultValue="300" />
                  </Space>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>最大重试次数</Text>
                    <Input type="number" defaultValue="3" />
                  </Space>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>超时时间 (分钟)</Text>
                    <Input type="number" defaultValue="60" />
                  </Space>
                </Space>
              </Space>

              <div style={{ borderTop: `1px solid ${token?.colorBorder}`, paddingTop: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '12px' }}>日志设置</Text>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: '12px' }}>启用详细日志</Text>
                    <Switch defaultChecked />
                  </div>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>日志级别</Text>
                    <Select style={{ width: '100%' }} defaultValue="INFO">
                      <Option value="INFO">INFO</Option>
                      <Option value="DEBUG">DEBUG</Option>
                      <Option value="WARN">WARN</Option>
                      <Option value="ERROR">ERROR</Option>
                    </Select>
                  </Space>
                </Space>
              </div>

              <div style={{ borderTop: `1px solid ${token?.colorBorder}`, paddingTop: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '12px' }}>数据管理</Text>
                <Space>
                  <Button>清除缓存</Button>
                  <Button>导出数据</Button>
                </Space>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary">保存设置</Button>
              </div>
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}