'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Button, 
  Input, 
  Card, 
  Badge, 
  Spin, 
  Alert,
  Row,
  Col,
  Typography,
  Space,
  Progress,
  theme
} from 'antd'
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  StopOutlined, 
  SendOutlined, 
  MessageOutlined, 
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  UserOutlined,
  RobotOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

export interface AgentMessage {
  agent: string
  content: string
  timestamp: Date
  type: 'status' | 'user_input' | 'feedback' | 'error'
}

interface AgentStatus {
  id: string
  name: string
  status: 'idle' | 'processing' | 'completed' | 'error' | 'waiting_input'
  progress: number
  message: string
  currentTask?: string
  lastUpdate: Date
}

interface ConversationMessage {
  id: string
  agent: string
  content: string
  timestamp: Date
  type: 'agent' | 'user' | 'system'
  requiresResponse?: boolean
}

interface WorkflowControl {
  workflowId: string | null
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  canPause: boolean
  canResume: boolean
  canCancel: boolean
}

export function AgentWorkspace({ 
  workflowId, 
  tenantId,
  onWorkflowComplete 
}: { 
  workflowId?: string
  tenantId: string
  onWorkflowComplete?: (result: any) => void
}) {
  const { token } = theme.useToken()
  const [agents, setAgents] = useState<AgentStatus[]>([
    { 
      id: 'tender-analysis', 
      name: '招标分析智能体', 
      status: 'idle', 
      progress: 0, 
      message: '等待任务',
      lastUpdate: new Date()
    },
    { 
      id: 'knowledge-retrieval', 
      name: '知识检索智能体', 
      status: 'idle', 
      progress: 0, 
      message: '等待任务',
      lastUpdate: new Date()
    },
    { 
      id: 'content-generation', 
      name: '内容生成智能体', 
      status: 'idle', 
      progress: 0, 
      message: '等待任务',
      lastUpdate: new Date()
    },
    { 
      id: 'compliance-verification', 
      name: '合规验证智能体', 
      status: 'idle', 
      progress: 0, 
      message: '等待任务',
      lastUpdate: new Date()
    }
  ])

  const [conversation, setConversation] = useState<ConversationMessage[]>([])
  const [workflowControl, setWorkflowControl] = useState<WorkflowControl>({
    workflowId: workflowId || null,
    status: 'idle',
    canPause: false,
    canResume: false,
    canCancel: false
  })
  const [userInput, setUserInput] = useState('')
  const [pendingResponse, setPendingResponse] = useState<string | null>(null)
  const wsRef = useRef<any>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  const handleWebSocketMessage = useCallback((data: any) => {
    console.log('WebSocket message received:', data);
    
    switch (data.type) {
      case 'agent_status':
        updateAgentStatus(data.agentId, data.status, data.progress, data.message, data.currentTask)
        break
      case 'agent_message':
        addAgentMessage(data.agentId, data.message, data.requiresResponse)
        break
      case 'workflow_status':
        updateWorkflowStatus(data.status, data.controls)
        break
      case 'workflow_complete':
        handleWorkflowComplete(data.result)
        break
      case 'error':
        handleWorkflowError(data.error)
        break
    }
  }, [])

  const connectWebSocket = useCallback(async () => {
    if (!workflowId) return

    try {
      // Get WebSocket connection info
      const response = await fetch(`/api/workflows/${workflowId}/websocket`)
      if (!response.ok) {
        throw new Error('Failed to get WebSocket connection info')
      }

      const { wsToken } = await response.json()

      // Import WebSocket client dynamically to avoid SSR issues
      const { WorkflowWebSocketClient } = await import('@/lib/websocket-client')
      
      const wsClient = new WorkflowWebSocketClient({
        workflowId,
        token: wsToken,
        onConnect: () => {
          console.log('WebSocket connected for workflow:', workflowId)
          addSystemMessage('Connected to workflow monitoring')
        },
        onDisconnect: () => {
          console.log('WebSocket disconnected')
          addSystemMessage('Connection lost - attempting to reconnect...')
        },
        onError: (error) => {
          console.error('WebSocket error:', error)
          addSystemMessage('Connection error - check your network')
        },
        onMessage: (message) => {
          handleWebSocketMessage(message)
        }
      })

      await wsClient.connect()
      wsRef.current = wsClient

    } catch (error) {
      console.error('Error connecting WebSocket:', error)
      addSystemMessage('Failed to connect to real-time updates')
      
      // Fallback to polling or retry
      setTimeout(() => {
        if (workflowControl.status === 'running') {
          connectWebSocket()
        }
      }, 5000)
    }
  }, [workflowId, workflowControl.status, handleWebSocketMessage])

  // Initialize WebSocket connection
  useEffect(() => {
    if (workflowId) {
      connectWebSocket()
      setWorkflowControl(prev => ({ ...prev, workflowId }))
    }

    return () => {
      if (wsRef.current) {
        if (typeof wsRef.current.disconnect === 'function') {
          wsRef.current.disconnect()
        } else if (typeof wsRef.current.close === 'function') {
          wsRef.current.close()
        }
      }
    }
  }, [workflowId, connectWebSocket])

  // Auto-scroll conversation to bottom
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const updateAgentStatus = (agentId: string, status: string, progress: number, message: string, currentTask?: string) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { 
            ...agent, 
            status: status as any, 
            progress, 
            message, 
            currentTask,
            lastUpdate: new Date()
          }
        : agent
    ))
  }

  const addAgentMessage = (agentId: string, message: string, requiresResponse = false) => {
    const agent = agents.find(a => a.id === agentId)
    const agentName = agent?.name || agentId

    const newMessage: ConversationMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      agent: agentName,
      content: message,
      timestamp: new Date(),
      type: 'agent',
      requiresResponse
    }

    setConversation(prev => [...prev, newMessage])

    if (requiresResponse) {
      setPendingResponse(agentId)
    }
  }

  const addSystemMessage = (message: string) => {
    const newMessage: ConversationMessage = {
      id: `sys-${Date.now()}`,
      agent: 'System',
      content: message,
      timestamp: new Date(),
      type: 'system'
    }

    setConversation(prev => [...prev, newMessage])
  }

  const updateWorkflowStatus = (status: string, controls: any) => {
    setWorkflowControl(prev => ({
      ...prev,
      status: status as any,
      canPause: controls?.canPause || false,
      canResume: controls?.canResume || false,
      canCancel: controls?.canCancel || false
    }))
  }

  const handleWorkflowComplete = (result: any) => {
    setWorkflowControl(prev => ({ ...prev, status: 'completed' }))
    addSystemMessage('Workflow completed successfully')
    onWorkflowComplete?.(result)
  }

  const handleWorkflowError = (error: any) => {
    setWorkflowControl(prev => ({ ...prev, status: 'error' }))
    addSystemMessage(`Workflow error: ${error.message}`)
  }

  const startWorkflow = async () => {
    if (!workflowId) {
      // Start a new workflow
      try {
        const response = await fetch('/api/workflows/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenantId,
            workflowType: 'bid-document-generation',
            sections: ['executive-summary', 'technical-approach']
          })
        })

        if (response.ok) {
          const { workflow_id } = await response.json()
          setWorkflowControl(prev => ({ ...prev, workflowId: workflow_id, status: 'running' }))
          connectWebSocket()
        }
      } catch (error) {
        console.error('Error starting workflow:', error)
        addSystemMessage('Failed to start workflow')
      }
    } else {
      // Resume existing workflow
      handleWorkflowControl('resume')
    }
  }

  const handleWorkflowControl = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!workflowControl.workflowId) return

    try {
      const response = await fetch(`/api/workflows/${workflowControl.workflowId}/${action}`, {
        method: 'POST'
      })

      if (response.ok) {
        addSystemMessage(`Workflow ${action}d successfully`)
      } else {
        addSystemMessage(`Failed to ${action} workflow`)
      }
    } catch (error) {
      console.error(`Error ${action}ing workflow:`, error)
      addSystemMessage(`Error ${action}ing workflow`)
    }
  }

  const handleUserResponse = async () => {
    if (!userInput.trim() || !pendingResponse) return

    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      agent: 'User',
      content: userInput,
      timestamp: new Date(),
      type: 'user'
    }

    setConversation(prev => [...prev, userMessage])

    // Send response via WebSocket if connected, otherwise fall back to API
    try {
      if (wsRef.current && typeof wsRef.current.sendUserResponse === 'function') {
        wsRef.current.sendUserResponse(pendingResponse, userInput)
        addSystemMessage('Response sent to agent')
      } else {
        // Fallback to API
        const response = await fetch(`/api/workflows/${workflowControl.workflowId}/user-response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentId: pendingResponse,
            response: userInput
          })
        })
        
        if (!response.ok) {
          throw new Error('Failed to send user response')
        }
        
        addSystemMessage('Response sent to agent')
      }
    } catch (error) {
      console.error('Error sending user response:', error)
      addSystemMessage('Error sending response to agent')
    }

    setUserInput('')
    setPendingResponse(null)
  }

  const getStatusColor = (status: AgentStatus['status']) => {
    switch (status) {
      case 'idle': return 'default'
      case 'processing': return 'processing'
      case 'completed': return 'success'
      case 'error': return 'error'
      case 'waiting_input': return 'warning'
    }
  }

  const getStatusIcon = (status: AgentStatus['status']) => {
    switch (status) {
      case 'idle': return <ClockCircleOutlined />
      case 'processing': return <ApiOutlined style={{ color: token?.colorPrimary }} />
      case 'completed': return <CheckCircleOutlined style={{ color: token?.colorSuccess }} />
      case 'error': return <CloseCircleOutlined style={{ color: token?.colorError }} />
      case 'waiting_input': return <MessageOutlined style={{ color: token?.colorWarning }} />
    }
  }

  const getMessageTypeIcon = (type: ConversationMessage['type']) => {
    switch (type) {
      case 'agent': return <RobotOutlined style={{ color: token?.colorPrimary }} />
      case 'user': return <UserOutlined style={{ color: token?.colorSuccess }} />
      case 'system': return <WarningOutlined style={{ color: token?.colorWarning }} />
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[24, 24]}>
        {/* 智能体状态面板 */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card title="智能体状态">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {agents.map((agent) => (
                  <Card size="small" key={agent.id}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          {getStatusIcon(agent.status)}
                          <Text strong>{agent.name}</Text>
                        </Space>
                        <Badge status={getStatusColor(agent.status)} text={
                          agent.status === 'idle' && '等待' ||
                          agent.status === 'processing' && '处理中' ||
                          agent.status === 'completed' && '完成' ||
                          agent.status === 'error' && '错误' ||
                          agent.status === 'waiting_input' && '等待输入'
                        } />
                      </div>
                      <Progress percent={agent.progress} size="small" />
                      <Text type="secondary">{agent.message}</Text>
                      {agent.currentTask && (
                        <Text type="success" style={{ fontSize: '12px' }}>当前任务: {agent.currentTask}</Text>
                      )}
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        更新时间: {agent.lastUpdate.toLocaleTimeString()}
                      </Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>

            {/* 工作流控制 */}
            <Card title="工作流控制">
              <Space direction="vertical" style={{ width: '100%' }}>
                {workflowControl.status === 'idle' && (
                  <Button type="primary" onClick={startWorkflow} block icon={<PlayCircleOutlined />}>
                    开始工作流
                  </Button>
                )}
                
                {workflowControl.status === 'running' && (
                  <>
                    {workflowControl.canPause && (
                      <Button 
                        onClick={() => handleWorkflowControl('pause')} 
                        block 
                        icon={<PauseCircleOutlined />}
                      >
                        暂停工作流
                      </Button>
                    )}
                    {workflowControl.canCancel && (
                      <Button 
                        onClick={() => handleWorkflowControl('cancel')} 
                        danger 
                        block 
                        icon={<StopOutlined />}
                      >
                        取消工作流
                      </Button>
                    )}
                  </>
                )}
                
                {workflowControl.status === 'paused' && workflowControl.canResume && (
                  <Button 
                    type="primary"
                    onClick={() => handleWorkflowControl('resume')} 
                    block 
                    icon={<PlayCircleOutlined />}
                  >
                    恢复工作流
                  </Button>
                )}
                
                <Alert 
                  message="工作流状态" 
                  description={workflowControl.status} 
                  type={
                    workflowControl.status === 'running' ? 'success' :
                    workflowControl.status === 'paused' ? 'warning' :
                    workflowControl.status === 'error' ? 'error' : 'info'
                  } 
                />
              </Space>
            </Card>
          </Space>
        </Col>

        {/* 对话面板 */}
        <Col xs={24} lg={16}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card title="智能体对话">
              <div style={{ 
                height: '400px', 
                overflowY: 'auto', 
                border: `1px solid ${token?.colorBorder}`, 
                borderRadius: '4px',
                padding: '16px',
                backgroundColor: token?.colorBgContainer
              }}>
                {conversation.length === 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%' 
                  }}>
                    <Text type="secondary">等待智能体开始协作...</Text>
                  </div>
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {conversation.map((msg) => (
                      <div key={msg.id}>
                        <Space style={{ marginBottom: '8px' }}>
                          {getMessageTypeIcon(msg.type)}
                          <Text strong style={{ 
                            color: msg.type === 'agent' ? token?.colorPrimary : 
                                   msg.type === 'user' ? token?.colorSuccess : 
                                   token?.colorWarning
                          }}>
                            {msg.agent}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {msg.timestamp.toLocaleTimeString()}
                          </Text>
                          {msg.requiresResponse && (
                            <Badge status="warning" text="需要回复" />
                          )}
                        </Space>
                        <div style={{ 
                          padding: '8px', 
                          borderRadius: '4px',
                          border: `1px solid ${
                            msg.type === 'user' ? token?.colorSuccess : 
                            msg.type === 'system' ? token?.colorWarning : 
                            token?.colorBorder
                          }`,
                          backgroundColor: 
                            msg.type === 'user' ? `${token?.colorSuccess}10` : 
                            msg.type === 'system' ? `${token?.colorWarning}10` : 
                            token?.colorBgContainer
                        }}>
                          <Text>{msg.content}</Text>
                        </div>
                      </div>
                    ))}
                    <div ref={conversationEndRef} />
                  </Space>
                )}
              </div>
            </Card>

            {/* 用户输入区域 */}
            {pendingResponse && (
              <Card title="智能体等待您的回复">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input.TextArea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="请输入您的回复..."
                    autoSize={{ minRows: 3, maxRows: 6 }}
                  />
                  <Button 
                    type="primary"
                    onClick={handleUserResponse}
                    disabled={!userInput.trim()}
                    icon={<SendOutlined />}
                  >
                    发送回复
                  </Button>
                </Space>
              </Card>
            )}
          </Space>
        </Col>
      </Row>
    </div>
  )
}