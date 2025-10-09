'use client'

import { useState, useEffect } from 'react'
import { Card, Tabs } from 'antd'
import { 
  FileTextOutlined, 
  BarChartOutlined, 
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { DocumentEditor } from './DocumentEditor'
import { WorkflowProgress } from './WorkflowProgress'
import { DocumentSectionSelector } from './DocumentSectionSelector'
import { ContentConfirmationDialog } from './ContentConfirmationDialog'
import { WorkflowStatus, WorkflowProgress as WorkflowProgressType } from '@/types/workflow'
import { ModelProvider } from '@/lib/config'

const { TabPane } = Tabs

interface BidDocumentWorkflowProps {
  projectId: string
  tenantId: string
  onWorkflowComplete?: (result: any) => void
}

interface DocumentSection {
  id: string
  name: string
  description: string
  required: boolean
  status: 'pending' | 'generating' | 'review' | 'approved' | 'rejected'
  content?: string
  aiSuggestions?: string[]
}

const DEFAULT_SECTIONS: DocumentSection[] = [
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview of the proposal',
    required: true,
    status: 'pending'
  },
  {
    id: 'technical-approach',
    name: 'Technical Approach',
    description: 'Detailed technical solution and methodology',
    required: true,
    status: 'pending'
  },
  {
    id: 'project-timeline',
    name: 'Project Timeline',
    description: 'Delivery schedule and milestones',
    required: true,
    status: 'pending'
  },
  {
    id: 'team-qualifications',
    name: 'Team Qualifications',
    description: 'Team member profiles and experience',
    required: true,
    status: 'pending'
  },
  {
    id: 'pricing-structure',
    name: 'Pricing Structure',
    description: 'Cost breakdown and pricing model',
    required: true,
    status: 'pending'
  },
  {
    id: 'risk-management',
    name: 'Risk Management',
    description: 'Risk assessment and mitigation strategies',
    required: false,
    status: 'pending'
  },
  {
    id: 'quality-assurance',
    name: 'Quality Assurance',
    description: 'QA processes and standards',
    required: false,
    status: 'pending'
  }
]

export function BidDocumentWorkflow({ projectId, tenantId, onWorkflowComplete }: BidDocumentWorkflowProps) {
  const [sections, setSections] = useState<DocumentSection[]>(DEFAULT_SECTIONS)
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [currentSection, setCurrentSection] = useState<string | null>(null)
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgressType | null>(null)
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(WorkflowStatus.PENDING)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingContent, setPendingContent] = useState<{ sectionId: string; content: string } | null>(null)
  const [activeTab, setActiveTab] = useState('selection')
  // 新增模型配置状态
  const [modelProvider, setModelProvider] = useState<ModelProvider>(ModelProvider.OPENAI)
  const [modelName, setModelName] = useState<string>('')

  // Initialize workflow when sections are selected
  const handleStartWorkflow = async (sectionIds: string[]) => {
    setSelectedSections(sectionIds)
    setActiveTab('progress')
    
    try {
      const response = await fetch('/api/workflows/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          tenantId,
          sections: sectionIds,
          workflowType: 'bid-document-generation',
          // 传递模型配置
          modelProvider,
          modelName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start workflow')
      }

      const { workflowId } = await response.json()
      
      // Start monitoring workflow progress
      monitorWorkflowProgress(workflowId)
      
    } catch (error) {
      console.error('Error starting workflow:', error)
    }
  }

  // Monitor workflow progress
  const monitorWorkflowProgress = async (workflowId: string) => {
    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}/monitor`)
        if (response.ok) {
          const data = await response.json()
          setWorkflowProgress(data.progress)
          
          // Update workflow status if provided
          if (data.status) {
            setWorkflowStatus(data.status)
          }
          
          // Check if content is ready for review
          if (data.progress?.current_step?.includes('review')) {
            const sectionId = extractSectionIdFromStep(data.progress.current_step)
            if (sectionId) {
              const content = await fetchGeneratedContent(workflowId, sectionId)
              setPendingContent({ sectionId, content })
              setShowConfirmation(true)
            }
          }
          
          // Continue polling if workflow is still running
          if (data.status === WorkflowStatus.RUNNING) {
            setTimeout(pollProgress, 2000)
          } else if (data.status === WorkflowStatus.COMPLETED) {
            setActiveTab('editor')
            onWorkflowComplete?.(data)
          }
        }
      } catch (error) {
        console.error('Error monitoring workflow:', error)
      }
    }

    pollProgress()
  }

  // Extract section ID from workflow step name
  const extractSectionIdFromStep = (stepName: string): string | null => {
    const match = stepName.match(/review-(.+)/)
    return match ? match[1] : null
  }

  // Fetch generated content for review
  const fetchGeneratedContent = async (workflowId: string, sectionId: string): Promise<string> => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/content/${sectionId}`)
      if (response.ok) {
        const { content } = await response.json()
        return content
      }
    } catch (error) {
      console.error('Error fetching content:', error)
    }
    return ''
  }

  // Handle content confirmation
  const handleContentConfirmation = async (approved: boolean, feedback?: string) => {
    if (!pendingContent || !workflowProgress) return

    try {
      const response = await fetch(`/api/workflows/${workflowProgress.workflow_id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionId: pendingContent.sectionId,
          approved,
          feedback
        })
      })

      if (response.ok) {
        // Update section status
        setSections(prev => prev.map(section => 
          section.id === pendingContent.sectionId
            ? { 
                ...section, 
                status: approved ? 'approved' : 'rejected',
                content: approved ? pendingContent.content : undefined
              }
            : section
        ))

        setShowConfirmation(false)
        setPendingContent(null)
      }
    } catch (error) {
      console.error('Error confirming content:', error)
    }
  }

  // Update section content from editor
  const handleSectionUpdate = (sectionId: string, content: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId
        ? { ...section, content, status: 'approved' }
        : section
    ))
  }

  const handleModelProviderChange = (provider: ModelProvider) => {
    setModelProvider(provider)
  }

  const handleModelNameChange = (model: string) => {
    setModelName(model)
  }

  const items = [
    {
      key: 'selection',
      label: (
        <span>
          <FileTextOutlined />
          Section Selection
        </span>
      ),
      children: (
        <DocumentSectionSelector
          sections={sections}
          onStartWorkflow={handleStartWorkflow}
          onModelProviderChange={handleModelProviderChange}
          onModelNameChange={handleModelNameChange}
        />
      )
    },
    {
      key: 'progress',
      label: (
        <span>
          <BarChartOutlined />
          Workflow Progress
        </span>
      ),
      disabled: selectedSections.length === 0,
      children: workflowProgress && (
        <WorkflowProgress
          progress={workflowProgress}
          sections={sections}
        />
      )
    },
    {
      key: 'editor',
      label: (
        <span>
          <EditOutlined />
          Document Editor
        </span>
      ),
      disabled: !workflowProgress || workflowStatus !== WorkflowStatus.COMPLETED,
      children: (
        <DocumentEditor
          sections={sections.filter(s => selectedSections.includes(s.id))}
          currentSection={currentSection}
          onSectionSelect={setCurrentSection}
          onSectionUpdate={handleSectionUpdate}
        />
      )
    }
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileTextOutlined />
          <span>Bid Document Workflow</span>
        </div>
      } 
      extra={
        <div style={{ color: '#666', fontSize: '14px' }}>
          Create professional bid documents with AI assistance
        </div>
      }>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          type="card"
          items={items}
        />
      </Card>

      {/* Content Confirmation Dialog */}
      {showConfirmation && pendingContent && (
        <ContentConfirmationDialog
          isOpen={showConfirmation}
          sectionName={sections.find(s => s.id === pendingContent.sectionId)?.name || ''}
          content={pendingContent.content}
          onConfirm={handleContentConfirmation}
          onClose={() => setShowConfirmation(false)}
        />
      )}
    </div>
  )
}