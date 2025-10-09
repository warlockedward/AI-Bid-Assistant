'use client'

import { useState } from 'react'
import { Card, Checkbox, Button, Badge, Space, Typography, Divider, Row, Col, Statistic } from 'antd'
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  ExclamationCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

interface DocumentSection {
  id: string
  name: string
  description: string
  required: boolean
  status: 'pending' | 'generating' | 'review' | 'approved' | 'rejected'
  content?: string
  aiSuggestions?: string[]
}

interface DocumentSectionSelectorProps {
  sections: DocumentSection[]
  onStartWorkflow: (selectedSections: string[]) => void
}

export function DocumentSectionSelector({ sections, onStartWorkflow }: DocumentSectionSelectorProps) {
  const [selectedSections, setSelectedSections] = useState<string[]>(
    sections.filter(s => s.required).map(s => s.id)
  )

  const handleSectionToggle = (sectionId: string, checked: boolean) => {
    if (checked) {
      setSelectedSections(prev => [...prev, sectionId])
    } else {
      // Don't allow deselecting required sections
      const section = sections.find(s => s.id === sectionId)
      if (!section?.required) {
        setSelectedSections(prev => prev.filter(id => id !== sectionId))
      }
    }
  }

  const handleStartWorkflow = () => {
    if (selectedSections.length > 0) {
      onStartWorkflow(selectedSections)
    }
  }

  const getStatusIcon = (status: DocumentSection['status']) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />
      case 'generating':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} spin />
      case 'review':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />
      case 'approved':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'rejected':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />
    }
  }

  const getStatusBadge = (status: DocumentSection['status']) => {
    const statusConfig = {
      pending: { color: 'default', text: 'Pending' },
      generating: { color: 'processing', text: 'Generating' },
      review: { color: 'warning', text: 'Review' },
      approved: { color: 'success', text: 'Approved' },
      rejected: { color: 'error', text: 'Rejected' }
    }

    const config = statusConfig[status] || statusConfig.pending
    return <Badge color={config.color} text={config.text} />
  }

  const requiredSections = sections.filter(s => s.required)
  const optionalSections = sections.filter(s => !s.required)
  const selectedCount = selectedSections.length
  const estimatedTime = selectedCount * 3 // Rough estimate: 3 minutes per section

  return (
    <div style={{ padding: '24px 0' }}>
      <Card>
        <Title level={4} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileTextOutlined />
          Document Section Selection
        </Title>
        <Text type="secondary">
          Choose which sections to include in your bid document. Required sections are pre-selected.
        </Text>
        
        <Divider />
        
        {/* Required Sections */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={5} style={{ color: '#1890ff' }}>Required Sections</Title>
          <Row gutter={[16, 16]}>
            {requiredSections.map((section) => (
              <Col span={24} key={section.id}>
                <Card 
                  size="small" 
                  style={{ 
                    backgroundColor: '#e6f7ff', 
                    borderColor: '#91d5ff' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {getStatusIcon(section.status)}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Text strong>{section.name}</Text>
                          <Badge color="blue" text="Required" />
                          {getStatusBadge(section.status)}
                        </div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {section.description}
                        </Text>
                      </div>
                    </div>
                    <Checkbox
                      checked={selectedSections.includes(section.id)}
                      disabled={section.required}
                    />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* Optional Sections */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={5}>Optional Sections</Title>
          <Row gutter={[16, 16]}>
            {optionalSections.map((section) => (
              <Col span={24} key={section.id}>
                <Card 
                  size="small"
                  hoverable
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {getStatusIcon(section.status)}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Text strong>{section.name}</Text>
                          <Badge color="default" text="Optional" />
                          {getStatusBadge(section.status)}
                        </div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {section.description}
                        </Text>
                      </div>
                    </div>
                    <Checkbox
                      checked={selectedSections.includes(section.id)}
                      onChange={(e) => handleSectionToggle(section.id, e.target.checked)}
                    />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* Summary and Start Button */}
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size="large">
            <Statistic title="Sections Selected" value={selectedCount} />
            <Statistic title="Estimated Time" value={`${estimatedTime} min`} />
          </Space>
          <Button
            type="primary"
            onClick={handleStartWorkflow}
            disabled={selectedCount === 0}
            size="large"
          >
            Start Workflow
          </Button>
        </div>
      </Card>
    </div>
  )
}