import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.tenantId) {
    redirect('/auth/signin')
  }

  // 动态导入antd组件以避免服务端组件问题
  const { Card, Button, Input, Row, Col, Space, Typography } = await import('antd')
  const { FileTextOutlined, UploadOutlined, SearchOutlined, FilterOutlined } = await import('@ant-design/icons')
  
  const { Title, Text } = Typography

  // 示例文档数据
  const documents = [
    {
      id: '1',
      title: '技术方案模板',
      description: '标准技术方案文档模板，包含项目概述、技术架构、实施计划等章节。',
      updatedAt: '2024-01-15',
      color: '#1677ff'
    },
    {
      id: '2',
      title: '项目管理方案',
      description: '项目管理和实施方案模板，包含团队组织、进度计划、风险管控等内容。',
      updatedAt: '2024-01-10',
      color: '#52c41a'
    },
    {
      id: '3',
      title: '商务方案模板',
      description: '商务投标方案模板，包含报价策略、服务承诺、合同条款等商务内容。',
      updatedAt: '2024-01-08',
      color: '#722ed1'
    }
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: '0 0 8px 0' }}>文档管理</Title>
            <Text type="secondary">管理投标文档、模板和生成的内容</Text>
          </div>
          <Button type="primary" icon={<UploadOutlined />}>
            上传文档
          </Button>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <Card style={{ marginBottom: '24px' }} title={<Space><SearchOutlined />搜索文档</Space>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="搜索文档名称或内容..."
            prefix={<SearchOutlined />}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button icon={<FilterOutlined />}>过滤</Button>
          </div>
        </Space>
      </Card>

      {/* 文档列表 */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        {documents.map((doc) => (
          <Col xs={24} sm={12} md={8} key={doc.id}>
            <Card 
              hoverable
              title={
                <Space>
                  <FileTextOutlined style={{ color: doc.color }} />
                  <Text strong>{doc.title}</Text>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">{doc.description}</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    更新于 {doc.updatedAt}
                  </Text>
                  <Button size="small">查看</Button>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 空状态提示 */}
      <Card style={{ 
        border: '2px dashed #d9d9d9', 
        textAlign: 'center',
        padding: '48px 0'
      }}>
        <Space direction="vertical">
          <FileTextOutlined style={{ fontSize: '48px', color: '#bfbfbf' }} />
          <Title level={4}>暂无更多文档</Title>
          <Text type="secondary" style={{ marginBottom: '16px' }}>
            上传您的投标文档模板或生成新的文档内容
          </Text>
          <Button type="primary" icon={<UploadOutlined />}>
            上传第一个文档
          </Button>
        </Space>
      </Card>
    </div>
  )
}