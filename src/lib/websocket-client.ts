import { WebSocketMessage } from './websocket-server'

export interface WebSocketClientOptions {
  workflowId: string
  token: string
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export class WorkflowWebSocketClient {
  private ws: WebSocket | null = null
  private options: WebSocketClientOptions
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private pingTimer: NodeJS.Timeout | null = null
  private isConnecting = false
  private shouldReconnect = true

  constructor(options: WebSocketClientOptions) {
    this.options = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...options
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve()
        return
      }

      this.isConnecting = true
      
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/workflows/ws?workflowId=${this.options.workflowId}&token=${this.options.token}`
        
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          logger.info('WebSocket connected', { 
            workflowId: this.options.workflowId,
            component: 'websocket-client'
          })
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.startPingTimer()
          this.options.onConnect?.()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage
            this.handleMessage(message)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          logger.info('WebSocket closed', { 
            code: event.code,
            reason: event.reason,
            workflowId: this.options.workflowId,
            component: 'websocket-client'
          })
          this.isConnecting = false
          this.stopPingTimer()
          this.options.onDisconnect?.()
          
          if (this.shouldReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts!) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnecting = false
          this.options.onError?.(error)
          
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            reject(new Error('Failed to connect to WebSocket'))
          }
        }

      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  disconnect() {
    this.shouldReconnect = false
    this.stopPingTimer()
    this.clearReconnectTimer()
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
  }

  sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message:', message)
    }
  }

  sendUserResponse(agentId: string, response: string) {
    this.sendMessage({
      type: 'user_response',
      agentId,
      response
    })
  }

  sendWorkflowControl(action: 'pause' | 'resume' | 'cancel') {
    this.sendMessage({
      type: 'workflow_control',
      action
    })
  }

  requestStatus() {
    this.sendMessage({
      type: 'request_status'
    })
  }

  private handleMessage(message: WebSocketMessage) {
    // Handle pong messages
    if ((message as any).type === 'pong') {
      return
    }

    this.options.onMessage?.(message)
  }

  private startPingTimer() {
    this.stopPingTimer()
    this.pingTimer = setInterval(() => {
      this.sendMessage({ type: 'ping' })
    }, 30000) // Ping every 30 seconds
  }

  private stopPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer()
    this.reconnectAttempts++
    
    const delay = Math.min(
      this.options.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    )

    logger.info('Scheduling WebSocket reconnect', { 
      attempt: this.reconnectAttempts,
      delayMs: delay,
      workflowId: this.options.workflowId,
      component: 'websocket-client'
    })
    
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().catch(error => {
          console.error('Reconnect failed:', error)
        })
      }
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting'
      case WebSocket.OPEN: return 'connected'
      case WebSocket.CLOSING: return 'closing'
      case WebSocket.CLOSED: return 'disconnected'
      default: return 'unknown'
    }
  }
}