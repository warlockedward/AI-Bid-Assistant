'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Button, 
  Select, 
  Modal, 
  Space, 
  Typography,
  Alert,
  Spin
} from 'antd'
import { 
  ApartmentOutlined, 
  SettingOutlined, 
  TeamOutlined 
} from '@ant-design/icons'

const { Text, Title } = Typography
const { Option } = Select

interface Tenant {
  id: string
  name: string
  domain?: string
  isActive: boolean
}

interface TenantSelectorProps {
  currentTenantId?: string
  onTenantChange?: (tenantId: string) => void
  showDialog?: boolean
  onDialogClose?: () => void
}

export function TenantSelector({ 
  currentTenantId, 
  onTenantChange, 
  showDialog = false,
  onDialogClose 
}: TenantSelectorProps) {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState<string>(currentTenantId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取用户可访问的租户列表
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await fetch('/api/tenants/accessible')
        if (!response.ok) {
          throw new Error('Failed to fetch tenants')
        }
        const data = await response.json()
        setTenants(data.tenants || [])
        
        // 如果没有当前租户ID，设置第一个租户为默认值
        if (!currentTenantId && data.tenants.length > 0) {
          setSelectedTenant(data.tenants[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    if (session?.user) {
      fetchTenants()
    }
  }, [session, currentTenantId])

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId === currentTenantId) return

    setLoading(true)
    setError(null)

    try {
      // 调用API切换租户
      const response = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to switch tenant')
      }

      // 更新session
      await update({ tenantId })
      
      // 通知父组件
      onTenantChange?.(tenantId)
      
      // 刷新页面以确保所有数据都是新租户的
      router.refresh()
      
      // 关闭对话框
      onDialogClose?.()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const currentTenant = tenants.find(t => t.id === currentTenantId)

  // 内联选择器组件
  const SelectorContent = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      {error && (
        <Alert message={error} type="error" showIcon />
      )}
      
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text strong>选择租户组织</Text>
        <Select
          style={{ width: '100%' }}
          value={selectedTenant}
          onChange={setSelectedTenant}
          disabled={loading}
        >
          {tenants.map((tenant) => (
            <Option key={tenant.id} value={tenant.id}>
              <Space>
                <ApartmentOutlined />
                <Space direction="vertical" size={0}>
                  <Text strong>{tenant.name}</Text>
                  {tenant.domain && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>{tenant.domain}</Text>
                  )}
                </Space>
              </Space>
            </Option>
          ))}
        </Select>
      </Space>

      {selectedTenant && selectedTenant !== currentTenantId && (
        <Button
          type="primary"
          onClick={() => handleTenantSwitch(selectedTenant)}
          loading={loading}
          block
        >
          {loading ? '切换中...' : '切换到此组织'}
        </Button>
      )}
    </Space>
  )

  // 如果显示为对话框
  if (showDialog) {
    return (
      <Modal
        title={
          <Space>
            <TeamOutlined />
            <span>选择组织</span>
          </Space>
        }
        open={showDialog}
        onCancel={onDialogClose}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            选择您要访问的组织。切换组织将刷新页面并加载该组织的数据。
          </Text>
          <SelectorContent />
        </Space>
      </Modal>
    )
  }

  // 内联显示
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>当前组织</Title>
        {currentTenant && (
          <Space>
            <ApartmentOutlined />
            <Text type="secondary">{currentTenant.name}</Text>
          </Space>
        )}
      </div>
      <SelectorContent />
    </Space>
  )
}

// 简化的租户切换按钮组件
export function TenantSwitchButton() {
  const { data: session } = useSession()
  const [showDialog, setShowDialog] = useState(false)

  if (!session?.user) return null

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
      >
        <Space>
          <ApartmentOutlined />
          <span>切换组织</span>
        </Space>
      </Button>
      
      <TenantSelector
        currentTenantId={session.user.tenantId}
        showDialog={showDialog}
        onDialogClose={() => setShowDialog(false)}
      />
    </>
  )
}