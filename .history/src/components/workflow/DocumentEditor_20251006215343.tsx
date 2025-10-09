'use client'

import { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Input, 
  Badge, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  List,
  Divider,
  Spin,
  Alert,
  Tooltip,
  Empty
} from 'antd'
import { 
  FileTextOutlined, 
  EditOutlined, 
  SaveOutlined, 
  DownloadOutlined, 
  EyeOutlined,
  BulbOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined
} from '@ant-design/icons'
import type { TextAreaRef } from 'antd/es/input'

const { Title, Text } = Typography
const { TextArea } = Input

interface DocumentSection {
  id: string
  name: string
  description: string
  required: boolean
  status: 'pending' | 'generating' | 'review' | 'approved' | 'rejected'
  content?: string
  aiSuggestions?: string[]
}

interface DocumentEditorProps {
  sections: DocumentSection[]
  currentSection: string | null
  onSectionSelect: (sectionId: string) => void
  onSectionUpdate: (sectionId: string, content: string) => void
}

interface AISuggestion {
  id: string
  type: 'improvement' | 'addition' | 'style' | 'compliance'
  title: string
  description: string
  suggestedText?: string
}

export function DocumentEditor({ 
  sections, 
  currentSection, 
  onSectionSelect, 
  onSectionUpdate 
}: DocumentEditorProps) {
  const [editingContent, setEditingContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)
  const [textAreaRef, setTextAreaRef] = useState<TextAreaRef | null>(null)

  const selectedSection = sections.find(s => s.id === currentSection)

  useEffect(() => {
    if (selectedSection?.content) {
      setEditingContent(selectedSection.content)
    } else {
      setEditingContent('')
    }
  }, [selectedSection])

  const handleSectionSelect = (sectionId: string) => {
    if (isEditing) {
      // Save current changes before switching
      handleSave()
    }
    onSectionSelect(sectionId)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = () => {
    if (currentSection && editingContent !== selectedSection?.content) {
      onSectionUpdate(currentSection, editingContent)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditingContent(selectedSection?.content || '')
    setIsEditing(false)
  }

  const generateAISuggestions = async () => {
    if (!currentSection || !selectedSection?.content) return

    setIsGeneratingSuggestions(true)
    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionId: currentSection,
          content: selectedSection.content,
          sectionType: selectedSection.name
        })
      })

      if (response.ok) {
        const suggestions = await response.json()
        setAiSuggestions(suggestions)
      }
    } catch (error) {
      console.error('Error generating suggestions:', error)
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

  const applySuggestion = (suggestion: AISuggestion) => {
    if (suggestion.suggestedText) {
      setEditingContent(prev => prev + '\n\n' + suggestion.suggestedText)
      setIsEditing(true)
    }
  }

  const exportDocument = () => {
    const completedSections = sections.filter(s => s.content)
    const documentContent = completedSections
      .map(section => `# ${section.name}\n\n${section.content}`)
      .join('\n\n---\n\n')

    const blob = new Blob([documentContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bid-document.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: DocumentSection['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'rejected':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <FileTextOutlined style={{ color: '#bfbfbf' }} />
    }
  }

  const getSuggestionIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'improvement':
        return <EditOutlined style={{ color: '#1890ff' }} />
      case 'addition':
        return <FileTextOutlined style={{ color: '#52c41a' }} />
      case 'style':
        return <EyeOutlined style={{ color: '#722ed1' }} />
      case 'compliance':
        return <CheckCircleOutlined style={{ color: '#fa8c16' }} />
      default:
        return <BulbOutlined style={{ color: '#1890ff' }} />
    }
  }

  const completedSections = sections.filter(s => s.content).length
  const totalSections = sections.length
  const completionPercentage = totalSections > 0 ? (completedSections / totalSections) * 100 : 0

  return (
    <div style={{ padding: '24px 0' }}>
      <Row gutter={24}>
        {/* Section Navigation */}
        <Col span={6}>
          <Card title="Document Sections">
            <div style={{ marginBottom: '16px' }}>
              <Statistic 
                title="Completion" 
                value={completionPercentage} 
                precision={0} 
                suffix="%" 
              />
            </div>
            
            <List
              dataSource={sections}
              renderItem={section => (
                <List.Item
                  onClick={() => handleSectionSelect(section.id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: currentSection === section.id ? '#e6f7ff' : 'transparent',
                    border: currentSection === section.id ? '1px solid #1890ff' : '1px solid #f0f0f0',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                >
                  <List.Item.Meta
                    avatar={getStatusIcon(section.status)}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Text strong>{section.name}</Text>
                        {section.required && <Badge color="blue" text="Required" />}
                      </div>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {section.description}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
            
            <Divider />
            
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={exportDocument}
              block
            >
              Export Document
            </Button>
          </Card>
        </Col>

        {/* Content Editor */}
        <Col span={12}>
          {selectedSection ? (
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileTextOutlined />
                  {selectedSection.name}
                </div>
              }
              extra={
                <Space>
                  {!isEditing ? (
                    <Button 
                      type="primary" 
                      icon={<EditOutlined />} 
                      onClick={handleEdit}
                    >
                      Edit
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleCancel}>
                        Cancel
                      </Button>
                      <Button 
                        type="primary" 
                        icon={<SaveOutlined />} 
                        onClick={handleSave}
                      >
                        Save
                      </Button>
                    </>
                  )}
                </Space>
              }
            >
              <Text type="secondary" style={{ marginBottom: '16px', display: 'block' }}>
                {selectedSection.description}
              </Text>
              
              {isEditing ? (
                <TextArea
                  ref={setTextAreaRef}
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  autoSize={{ minRows: 15, maxRows: 25 }}
                  style={{ fontFamily: 'monospace', fontSize: '14px' }}
                  placeholder="Enter your content here..."
                />
              ) : (
                <div style={{ 
                  minHeight: '300px', 
                  padding: '16px', 
                  border: '1px solid #f0f0f0', 
                  borderRadius: '4px',
                  backgroundColor: '#fafafa'
                }}>
                  {selectedSection.content ? (
                    <div>
                      {selectedSection.content.split('\n').map((paragraph, index) => (
                        <Text key={index} style={{ display: 'block', marginBottom: '12px', lineHeight: '1.6' }}>
                          {paragraph}
                        </Text>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      description={
                        <span>
                          No content available for this section
                          <br />
                          <Text type="secondary">Content will appear here after generation</Text>
                        </span>
                      }
                    >
                      <FileTextOutlined style={{ fontSize: '48px', color: '#bfbfbf' }} />
                    </Empty>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <Empty
                description={
                  <span>
                    <Title level={4}>Select a Section</Title>
                    <Text type="secondary">Choose a section from the left panel to view and edit its content</Text>
                  </span>
                }
              >
                <FileTextOutlined style={{ fontSize: '48px', color: '#bfbfbf' }} />
              </Empty>
            </Card>
          )}
        </Col>

        {/* AI Suggestions Panel */}
        <Col span={6}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BulbOutlined />
                AI Suggestions
              </div>
            }
            extra={
              <Tooltip title="Generate AI Suggestions">
                <Button
                  type="text"
                  icon={
                    isGeneratingSuggestions ? 
                    <Spin indicator={<ReloadOutlined style={{ color: '#1890ff' }} spin />} /> : 
                    <ReloadOutlined />
                  }
                  onClick={generateAISuggestions}
                  disabled={!selectedSection?.content || isGeneratingSuggestions}
                />
              </Tooltip>
            }
          >
            {!selectedSection?.content ? (
              <Empty description="Select a section with content to get AI suggestions" />
            ) : aiSuggestions.length === 0 ? (
              <Empty description="Click the refresh button to generate AI suggestions for improving this section" />
            ) : (
              <List
                dataSource={aiSuggestions}
                renderItem={suggestion => (
                  <List.Item
                    style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      padding: '12px'
                    }}
                  >
                    <List.Item.Meta
                      avatar={getSuggestionIcon(suggestion.type)}
                      title={
                        <Text strong style={{ fontSize: '14px' }}>
                          {suggestion.title}
                        </Text>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {suggestion.description}
                        </Text>
                      }
                    />
                    {suggestion.suggestedText && (
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => applySuggestion(suggestion)}
                        icon={<PlusOutlined />}
                      >
                        Apply
                      </Button>
                    )}
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}