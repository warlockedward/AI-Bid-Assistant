import { useState, useEffect, useCallback, useRef } from 'react'
import { WorkflowWebSocketClient } from '@/lib/websocket-client'
import { WebSocketMessage } from '@/lib/websocket-server'

export interface WorkflowWebSocketState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  messages: WebSocketMessage[]
  agentStatuses: Record<string, {
    status: string
    progress: number
    message: string
    currentTask?: string
  }>
  workflowStatus: {
    status: string
    controls: {
      canPause: boolean
      canResume: boolean
      canCancel: boolean
    }
  }
  workflowProgress: {
    totalSteps: number
    completedSteps: number
    currentStep: string
    progressPercentage: number
    estimatedTimeRemaining?: number
  }
  systemNotifications: Array<{
    id: string
    level: 'info' | 'warning' | 'error' | 'success'
    message: string
    details?: any
    timestamp: string
  }>
}

export interface UseWorkflowWebSocketOptions {
  workflowId: string
  token: string
  autoConnect?: boolean
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export function useWorkflowWebSocket(options: UseWorkflowWebSocketOptions) {
  const [state, setState] = useState<WorkflowWebSocketState>({
    connectionStatus: 'disconnected',
    messages: [],
    agentStatuses: {},
    workflowStatus: {
      status: 'unknown',
      controls: {
        canPause: false,
        canResume: false,
        canCancel: false
      }
    },
    workflowProgress: {
      totalSteps: 0,
      completedSteps: 0,
      currentStep: 'Unknown',
      progressPercentage: 0
    },
    systemNotifications: []
  })

  const clientRef = useRef<WorkflowWebSocketClient | null>(null)
  const messageIdCounter = useRef(0)

  const handleMessage = useCallback((message: WebSocketMessage) => {
    setState(prevState => {
      const newState = { ...prevState }
      
      // Add message to history
      newState.messages = [...prevState.messages, message].slice(-100) // Keep last 100 messages

      switch (message.type) {
        case 'agent_status':
          newState.agentStatuses = {
            ...prevState.agentStatuses,
            [message.agentId]: {
              status: message.status,
              progress: message.progress,
              message: message.message,
              currentTask: message.currentTask
            }
          }
          break

        case 'workflow_status':
          newState.workflowStatus = {
            status: message.status,
            controls: message.controls
          }
          if (message.progress) {
            newState.workflowProgress = {
              totalSteps: message.progress.totalSteps,
              completedSteps: message.progress.completedSteps,
              currentStep: message.progress.currentStep,
              progressPercentage: message.progress.progressPercentage,
              estimatedTimeRemaining: message.progress.estimatedTimeRemaining
            }
          }
          break

        case 'workflow_progress':
          newState.workflowProgress = {
            totalSteps: message.totalSteps,
            completedSteps: message.completedSteps,
            currentStep: message.currentStep,
            progressPercentage: message.progressPercentage,
            estimatedTimeRemaining: message.estimatedTimeRemaining
          }
          break

        case 'system_notification':
          const notification = {
            id: `notification-${++messageIdCounter.current}`,
            level: message.level,
            message: message.message,
            details: message.details,
            timestamp: message.timestamp
          }
          newState.systemNotifications = [
            ...prevState.systemNotifications,
            notification
          ].slice(-50) // Keep last 50 notifications
          break

        case 'connection_status':
          // Handle connection status updates
          break
      }

      return newState
    })

    // Call user-provided message handler
    options.onMessage?.(message)
  }, [options])

  const connect = useCallback(async () => {
    if (clientRef.current?.isConnected) {
      return
    }

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }))

    try {
      const client = new WorkflowWebSocketClient({
        workflowId: options.workflowId,
        token: options.token,
        onConnect: () => {
          setState(prev => ({ ...prev, connectionStatus: 'connected' }))
          options.onConnect?.()
        },
        onDisconnect: () => {
          setState(prev => ({ ...prev, connectionStatus: 'disconnected' }))
          options.onDisconnect?.()
        },
        onError: (error) => {
          setState(prev => ({ ...prev, connectionStatus: 'error' }))
          options.onError?.(error)
        },
        onMessage: handleMessage
      })

      await client.connect()
      clientRef.current = client

      // Request initial status
      client.requestStatus()

    } catch (error) {
      setState(prev => ({ ...prev, connectionStatus: 'error' }))
      console.error('Failed to connect WebSocket:', error)
    }
  }, [handleMessage, options])

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }
    setState(prev => ({ ...prev, connectionStatus: 'disconnected' }))
  }, [])

  const sendUserResponse = useCallback((agentId: string, response: string) => {
    if (clientRef.current?.isConnected) {
      clientRef.current.sendUserResponse(agentId, response)
    }
  }, [])

  const sendWorkflowControl = useCallback((action: 'pause' | 'resume' | 'cancel') => {
    if (clientRef.current?.isConnected) {
      clientRef.current.sendWorkflowControl(action)
    }
  }, [])

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, systemNotifications: [] }))
  }, [])

  const removeNotification = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      systemNotifications: prev.systemNotifications.filter(n => n.id !== notificationId)
    }))
  }, [])

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect !== false && options.workflowId && options.token) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [options.workflowId, options.token, options.autoConnect, connect, disconnect])

  return {
    ...state,
    connect,
    disconnect,
    sendUserResponse,
    sendWorkflowControl,
    clearNotifications,
    removeNotification,
    isConnected: clientRef.current?.isConnected || false
  }
}