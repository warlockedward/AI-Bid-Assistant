'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Card, 
  Progress, 
  Button, 
  Badge, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  Timeline,
  Divider
} from 'antd'
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  SyncOutlined,
  FileTextOutlined,
  BulbOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  WifiOutlined,
  WifiDisconnectedOutlined
} from '@ant-design/icons'
import { WorkflowProgress as WorkflowProgressType, WorkflowStatus } from '@/types/workflow'

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

interface WorkflowProgressProps {
  progress: WorkflowProgressType
  status?: WorkflowStatus
  sections: DocumentSection[]
  workflowId?: string
  enableRealTimeUpdates?: boolean
}

interface WorkflowStep {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  agent: string
  progress: number
  startTime?: Date
  endTime?: Date
  error?: string
}

// Mock workflow steps based on the current progress
const generateWorkflowSteps = (progress: WorkflowProgressType, sections: DocumentSection[]): WorkflowStep[] => {
  const steps: WorkflowStep[] = []
  
  // Analysis step
  steps.push({
    id: 'analysis',
    name: 'Tender Analysis',
    description: 'Analyzing tender requirements and constraints',
    status: progress.completed_steps > 0 ? 'completed' : progress.current_step === 'analysis' ? 'running' : 'pending',
    agent: 'Tender Analysis Agent',
    progress: progress.completed_steps > 0 ? 100 : progress.current_step === 'analysis' ? 50 : 0
  })

  // Knowledge retrieval step
  steps.push({
    id: 'knowledge',
    name: 'Knowledge Retrieval',
    description: 'Gathering relevant industry knowledge and best practices',
    status: progress.completed_steps > 1 ? 'completed' : progress.current_step === 'knowledge' ? 'running' : 'pending',
    agent: 'Knowledge Retrieval Agent',
    progress: progress.completed_steps > 1 ? 100 : progress.current_step === 'knowledge' ? 30 : 0
  })

  // Content generation steps for each section
  sections.forEach((section, index) => {
    const stepIndex = index + 2
    steps.push({
      id: `generate-${section.id}`,
      name: `Generate ${section.name}`,
      description: `Creating content for ${section.name.toLowerCase()}`,
      status: progress.completed_steps > stepIndex ? 'completed' : 
              progress.current_step === `generate-${section.id}` ? 'running' : 'pending',
      agent: 'Content Generation Agent',
      progress: progress.completed_steps > stepIndex ? 100 : 
                progress.current_step === `generate-${section.id}` ? 70 : 0
    })
  })

  // Compliance verification step
  steps.push({
    id: 'compliance',
    name: 'Compliance Verification',
    description: 'Verifying document compliance and quality',
    status: progress.completed_steps >= steps.length ? 'completed' : 
            progress.current_step === 'compliance' ? 'running' : 'pending',
    agent: 'Compliance Verification Agent',
    progress: progress.completed_steps >= steps.length ? 100 : 
              progress.current_step === 'compliance' ? 80 : 0
  })

  return steps
}

export function WorkflowProgress({ 
  progress: initialProgress,
  status: initialStatus = WorkflowStatus.PENDING,
  sections, 
  workflowId,
  enableRealTimeUpdates = false 
}: WorkflowProgressProps) {
  const [progress, setProgress] = useState(initialProgress)
  const [status, setStatus] = useState(initialStatus)
  const [realtimeSteps, setRealtimeSteps] = useState<Map<string, Partial<WorkflowStep>>>(new Map())
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const wsClientRef = useRef<any>(null)

  const steps = generateWorkflowSteps(progress, sections)

  // Merge real-time updates with base steps
  const enhancedSteps = steps.map(step => {
    const realtimeUpdate = realtimeSteps.get(step.id)
    return realtimeUpdate ? { ...step, ...realtimeUpdate } : step
  })

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!enableRealTimeUpdates || !workflowId) return

    const connectWebSocket = async () => {
      try {
        setConnectionStatus('connecting')
        
        // Get WebSocket connection info
        const response = await fetch(`/api/workflows/${workflowId}/websocket`)
        if (!response.ok) {
          throw new Error('Failed to get WebSocket connection info')
        }

        const { wsToken } = await response.json()

        // Import WebSocket client dynamically
        const { WorkflowWebSocketClient } = await import('@/lib/websocket-client')
        
        const wsClient = new WorkflowWebSocketClient({
          workflowId,
          token: wsToken,
          onConnect: () => {
            setConnectionStatus('connected')
            console.log('WorkflowProgress: WebSocket connected')
          },
          onDisconnect: () => {
            setConnectionStatus('disconnected')
            console.log('WorkflowProgress: WebSocket disconnected')
          },
          onError: (error) => {
            setConnectionStatus('error')
            console.error('WorkflowProgress: WebSocket error:', error)
          },
          onMessage: (message) => {
            handleRealtimeUpdate(message)
          }
        })

        await wsClient.connect()
        wsClientRef.current = wsClient

      } catch (error) {
        console.error('Failed to connect WebSocket:', error)
        setConnectionStatus('error')
      }
    }

    connectWebSocket()

    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect()
      }
    }
  }, [workflowId, enableRealTimeUpdates])

  const handleRealtimeUpdate = useCallback((message: any) => {
    switch (message.type) {
      case 'agent_status':
        updateStepFromAgentStatus(message)
        break
      case 'workflow_status':
        updateWorkflowStatus(message)
        break
      case 'agent_message':
        // Could be used to show recent messages or logs
        console.log('Agent message:', message)
        break
    }
  }, [])

  const updateStepFromAgentStatus = (agentStatus: any) => {
    const { agentId, status, progress: agentProgress, message, currentTask } = agentStatus
    
    // Map agent IDs to step IDs
    const agentToStepMap: Record<string, string> = {
      'tender-analysis': 'analysis',
      'knowledge-retrieval': 'knowledge',
      'content-generation': 'generate-content',
      'compliance-verification': 'compliance'
    }

    const stepId = agentToStepMap[agentId] || agentId

    setRealtimeSteps(prev => {
      const updated = new Map(prev)
      updated.set(stepId, {
        status: mapAgentStatusToStepStatus(status),
        progress: agentProgress,
        description: message || currentTask
      })
      return updated
    })
  }

  const updateWorkflowStatus = (workflowStatus: any) => {
    const { status } = workflowStatus
    setProgress(prev => ({
      ...prev,
      status: status as WorkflowStatus
    }))
  }

  const mapAgentStatusToStepStatus = (agentStatus: string): WorkflowStep['status'] => {
    switch (agentStatus) {
      case 'idle': return 'pending'
      case 'processing': return 'running'
      case 'completed': return 'completed'
      case 'error': return 'failed'
      case 'waiting_input': return 'running'
      default: return 'pending'
    }
  }
  
  const getStatusIcon = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />
      case 'running':
        return <SyncOutlined style={{ color: '#1890ff' }} spin />
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />
    }
  }

  const getAgentIcon = (agent: string) => {
    if (agent.includes('Analysis')) return <FileTextOutlined />
    if (agent.includes('Knowledge')) return <SearchOutlined />
    if (agent.includes('Generation')) return <BulbOutlined />
    if (agent.includes('Compliance')) return <SafetyCertificateOutlined />
    return <ClockCircleOutlined />
  }

  const getStatusBadge = (status: WorkflowStatus) => {
    const statusConfig = {
      [WorkflowStatus.PENDING]: { color: 'default', text: 'Pending' },
      [WorkflowStatus.RUNNING]: { color: 'processing', text: 'Running' },
      [WorkflowStatus.PAUSED]: { color: 'warning', text: 'Paused' },
      [WorkflowStatus.COMPLETED]: { color: 'success', text: 'Completed' },
      [WorkflowStatus.FAILED]: { color: 'error', text: 'Failed' },
      [WorkflowStatus.CANCELLED]: { color: 'default', text: 'Cancelled' },
      [WorkflowStatus.RECOVERING]: { color: 'warning', text: 'Recovering' }
    }

    const config = statusConfig[status] || statusConfig[WorkflowStatus.PENDING]
    return <Badge color={config.color} text={config.text} />
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

  const handleWorkflowControl = async (action: 'pause' | 'resume' | 'cancel') => {
    try {
      const response = await fetch(`/api/workflows/${progress.workflow_id}/${action}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} workflow`)
      }
    } catch (error) {
      console.error(`Error ${action}ing workflow:`, error)
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Overall Progress */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SyncOutlined />
            Workflow Progress
            {getStatusBadge(status)}
          </div>
        }
        extra={
          <Space>
            {status === WorkflowStatus.RUNNING && (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={() => handleWorkflowControl('pause')}
              >
                Pause
              </Button>
            )}
            {status === WorkflowStatus.PAUSED && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleWorkflowControl('resume')}
              >
                Resume
              </Button>
            )}
            {(status === WorkflowStatus.RUNNING || status === WorkflowStatus.PAUSED) && (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => handleWorkflowControl('cancel')}
              >
                Cancel
              </Button>
            )}
          </Space>
        }
      >
        <Row gutter={24}>
          <Col span={24}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text strong>Overall Progress</Text>
                <Text>{Math.round(progress.progress_percentage)}%</Text>
              </div>
              <Progress percent={Math.round(progress.progress_percentage)} />
            </div>
          </Col>
          
          <Col span={6}>
            <Statistic title="Total Steps" value={progress.total_steps} />
          </Col>
          <Col span={6}>
            <Statistic title="Completed" value={progress.completed_steps} />
          </Col>
          <Col span={6}>
            <Statistic title="Current Step" value={progress.current_step} />
          </Col>
          <Col span={6}>
            <Statistic 
              title="Est. Remaining" 
              value={
                progress.estimated_remaining_time 
                  ? formatDuration(progress.estimated_remaining_time)
                  : 'Calculating...'
              } 
            />
          </Col>
        </Row>
      </Card>

      {/* Detailed Step Progress */}
      <Card title="Step Details" style={{ marginTop: '24px' }}>
        <Timeline>
          {steps.map((step, index) => (
            <Timeline.Item
              key={step.id}
              dot={getStatusIcon(step.status)}
              color={
                step.status === 'running' ? 'blue' :
                step.status === 'completed' ? 'green' :
                step.status === 'failed' ? 'red' :
                'gray'
              }
            >
              <Card 
                size="small"
                style={{
                  backgroundColor: 
                    step.status === 'running' ? '#e6f7ff' :
                    step.status === 'completed' ? '#f6ffed' :
                    step.status === 'failed' ? '#fff2f0' :
                    '#fafafa',
                  borderColor: 
                    step.status === 'running' ? '#91d5ff' :
                    step.status === 'completed' ? '#b7eb8f' :
                    step.status === 'failed' ? '#ffccc7' :
                    '#d9d9d9'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <Text strong>{index + 1}. {step.name}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      {getAgentIcon(step.agent)}
                      <Text type="secondary" style={{ fontSize: '12px' }}>{step.agent}</Text>
                    </div>
                  </div>
                  <Text>{step.progress}%</Text>
                </div>
                
                <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
                  {step.description}
                </Text>
                
                {step.status === 'running' && (
                  <Progress percent={step.progress} size="small" style={{ marginTop: '8px' }} />
                )}
                
                {step.error && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px', 
                    backgroundColor: '#fff2f0', 
                    borderColor: '#ffccc7', 
                    borderRadius: '4px',
                    border: '1px solid #ffccc7'
                  }}>
                    <Text strong type="danger">Error: </Text>
                    <Text type="danger">{step.error}</Text>
                  </div>
                )}
              </Card>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>
    </div>
  )
}