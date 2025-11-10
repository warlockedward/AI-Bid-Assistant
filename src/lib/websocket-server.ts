import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { parse } from 'url'
import { verify } from 'jsonwebtoken'
import { logger } from './logger'
import { metricsCollector } from './metrics'

export interface WebSocketConnection {
  ws: WebSocket
  workflowId: string
  tenantId: string
  userId: string
  lastPing: number
}

export interface AgentStatusUpdate {
  type: 'agent_status'
  agentId: string
  status: 'idle' | 'processing' | 'completed' | 'error' | 'waiting_input'
  progress: number
  message: string
  currentTask?: string
  timestamp: string
}

export interface AgentMessage {
  type: 'agent_message'
  agentId: string
  message: string
  requiresResponse?: boolean
  timestamp: string
}

export interface WorkflowStatusUpdate {
  type: 'workflow_status'
  status: 'running' | 'paused' | 'completed' | 'error'
  controls: {
    canPause: boolean
    canResume: boolean
    canCancel: boolean
  }
  progress?: {
    totalSteps: number
    completedSteps: number
    currentStep: string
    progressPercentage: number
    estimatedTimeRemaining?: number
  }
  timestamp: string
}

export interface WorkflowProgressUpdate {
  type: 'workflow_progress'
  totalSteps: number
  completedSteps: number
  currentStep: string
  progressPercentage: number
  estimatedTimeRemaining?: number
  timestamp: string
}

export interface UserInteraction {
  type: 'user_response'
  agentId: string
  response: string
  timestamp: string
}

export interface SystemNotification {
  type: 'system_notification'
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  details?: any
  timestamp: string
}

export interface ConnectionStatus {
  type: 'connection_status'
  status: 'connected' | 'disconnected' | 'reconnecting'
  connectionCount: number
  timestamp: string
}

export type WebSocketMessage = 
  | AgentStatusUpdate 
  | AgentMessage 
  | WorkflowStatusUpdate 
  | WorkflowProgressUpdate
  | UserInteraction 
  | SystemNotification
  | ConnectionStatus

class WorkflowWebSocketManager {
  private connections = new Map<string, WebSocketConnection[]>()
  private tenantConnections = new Map<string, Set<string>>() // tenantId -> Set<workflowId>
  private wss: WebSocketServer | null = null

  initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/workflows/ws'
    })

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request)
    })

    // Cleanup disconnected connections every 30 seconds
    setInterval(() => {
      this.cleanupConnections()
    }, 30000)

    logger.info('WebSocket server initialized for workflow updates', {
      component: 'websocket-server',
      operation: 'initialize'
    })
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage) {
    try {
      const { query } = parse(request.url || '', true)
      const { workflowId, token } = query

      if (!workflowId || !token || Array.isArray(workflowId) || Array.isArray(token)) {
        logger.warn('WebSocket connection rejected: missing or invalid parameters', {
          component: 'websocket-server',
          operation: 'connection',
          workflowId: workflowId as string,
          hasToken: !!token
        })
        ws.close(1008, 'Missing or invalid workflowId or token')
        return
      }

      // Verify JWT token and extract tenant/user info
      const decoded = await this.verifyToken(token as string)
      if (!decoded) {
        logger.warn('WebSocket connection rejected: invalid token', {
          component: 'websocket-server',
          operation: 'connection',
          workflowId: workflowId as string
        })
        ws.close(1008, 'Invalid token')
        return
      }

      const connection: WebSocketConnection = {
        ws,
        workflowId: workflowId,
        tenantId: decoded.tenantId,
        userId: decoded.userId,
        lastPing: Date.now()
      }

      // Add connection to workflow group
      if (!this.connections.has(workflowId)) {
        this.connections.set(workflowId, [])
      }
      this.connections.get(workflowId)!.push(connection)

      // Track tenant connections for isolation
      if (!this.tenantConnections.has(decoded.tenantId)) {
        this.tenantConnections.set(decoded.tenantId, new Set())
      }
      this.tenantConnections.get(decoded.tenantId)!.add(workflowId)

      // Set up message handlers
      ws.on('message', (data) => {
        this.handleMessage(connection, Buffer.from(data as ArrayBuffer))
      })

      ws.on('pong', () => {
        connection.lastPing = Date.now()
      })

      ws.on('close', (code: number, reason: Buffer) => {
        logger.info('WebSocket connection closed', {
          component: 'websocket-server',
          operation: 'disconnect',
          workflowId: connection.workflowId,
          tenantId: connection.tenantId,
          userId: connection.userId,
          code,
          reason: reason.toString()
        })
        
        metricsCollector.recordCustomMetric(
          'websocket.connection.closed',
          1,
          'count',
          { 
            tenantId: connection.tenantId,
            workflowId: connection.workflowId,
            code: code.toString()
          }
        )
        
        this.removeConnection(connection)
      })

      ws.on('error', (error: Error) => {
        logger.error('WebSocket error occurred', {
          component: 'websocket-server',
          operation: 'error',
          workflowId: connection.workflowId,
          tenantId: connection.tenantId,
          userId: connection.userId
        }, error)
        
        metricsCollector.recordCustomMetric(
          'websocket.connection.error',
          1,
          'count',
          { 
            tenantId: connection.tenantId,
            workflowId: connection.workflowId,
            errorType: error.name
          }
        )
        
        this.removeConnection(connection)
      })

      // Send connection confirmation
      this.sendToConnection(connection, {
        type: 'workflow_status',
        status: 'running',
        controls: {
          canPause: true,
          canResume: false,
          canCancel: true
        },
        timestamp: new Date().toISOString()
      })

      logger.info('WebSocket connection established', {
        component: 'websocket-server',
        operation: 'connection',
        workflowId: workflowId as string,
        tenantId: decoded.tenantId,
        userId: decoded.userId
      })

      // Record metrics
      metricsCollector.recordCustomMetric(
        'websocket.connection.established',
        1,
        'count',
        { 
          tenantId: decoded.tenantId,
          workflowId: workflowId as string
        }
      )

      // Register workflow with bridge for Python backend monitoring
      this.registerWorkflowWithBridge(workflowId)

    } catch (error) {
      console.error('Error handling WebSocket connection:', error)
      ws.close(1011, 'Internal server error')
    }
  }

  private async verifyToken(token: string): Promise<{ tenantId: string; userId: string } | null> {
    try {
      // Verify JWT token with proper validation
      const decoded = verify(token, process.env.NEXTAUTH_SECRET || 'secret') as any
      
      // Validate required fields
      if (!decoded.tenantId || !decoded.sub) {
        console.error('Token missing required fields:', { tenantId: decoded.tenantId, userId: decoded.sub })
        return null
      }
      
      return {
        tenantId: decoded.tenantId,
        userId: decoded.sub
      }
    } catch (error) {
      console.error('Token verification failed:', error)
      return null
    }
  }

  private async handleMessage(connection: WebSocketConnection, data: Buffer) {
    try {
      const message = JSON.parse(data.toString())
      
      switch (message.type) {
        case 'ping':
          connection.lastPing = Date.now()
          this.sendToConnection(connection, { type: 'pong', timestamp: new Date().toISOString() } as any)
          break
          
        case 'user_response':
          // Handle user response and send to Python backend
          await this.handleUserResponse(connection, message)
          break

        case 'workflow_control':
          // Handle workflow control commands (pause, resume, cancel)
          await this.handleWorkflowControl(connection, message)
          break

        case 'request_status':
          // Handle status request
          await this.handleStatusRequest(connection, message)
          break
          
        default:
          logger.warn('Unknown WebSocket message type', {
            type: message.type,
            workflowId: connection.workflowId,
            component: 'websocket-server'
          })
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
      this.sendToConnection(connection, {
        type: 'system_notification',
        level: 'error',
        message: 'Failed to process message',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString()
      })
    }
  }

  private removeConnection(connection: WebSocketConnection) {
    const connections = this.connections.get(connection.workflowId)
    if (connections) {
      const index = connections.indexOf(connection)
      if (index > -1) {
        connections.splice(index, 1)
        if (connections.length === 0) {
          this.connections.delete(connection.workflowId)
          
          // Remove from tenant tracking
          const tenantWorkflows = this.tenantConnections.get(connection.tenantId)
          if (tenantWorkflows) {
            tenantWorkflows.delete(connection.workflowId)
            if (tenantWorkflows.size === 0) {
              this.tenantConnections.delete(connection.tenantId)
            }
          }
          
          // Unregister workflow from bridge when no more connections
          this.unregisterWorkflowFromBridge(connection.workflowId)
        }
      }
    }
  }

  private cleanupConnections() {
    const now = Date.now()
    const timeout = 60000 // 60 seconds

    for (const [workflowId, connections] of Array.from(this.connections.entries())) {
      const activeConnections = connections.filter((conn: WebSocketConnection) => {
        if (conn.ws.readyState !== WebSocket.OPEN || now - conn.lastPing > timeout) {
          try {
            conn.ws.close()
          } catch (error) {
            // Ignore errors when closing dead connections
          }
          return false
        }
        return true
      })

      if (activeConnections.length === 0) {
        this.connections.delete(workflowId)
      } else if (activeConnections.length !== connections.length) {
        this.connections.set(workflowId, activeConnections)
      }
    }
  }

  private sendToConnection(connection: WebSocketConnection, message: WebSocketMessage) {
    if (connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message))
      } catch (error) {
        console.error('Error sending message to WebSocket:', error)
        this.removeConnection(connection)
      }
    }
  }

  // Public methods for broadcasting updates

  broadcastAgentStatus(workflowId: string, update: Omit<AgentStatusUpdate, 'type' | 'timestamp'>) {
    this.broadcastToWorkflow(workflowId, {
      ...update,
      type: 'agent_status',
      timestamp: new Date().toISOString()
    })
  }

  broadcastAgentMessage(workflowId: string, message: Omit<AgentMessage, 'type' | 'timestamp'>) {
    this.broadcastToWorkflow(workflowId, {
      ...message,
      type: 'agent_message',
      timestamp: new Date().toISOString()
    })
  }

  broadcastWorkflowStatus(workflowId: string, update: Omit<WorkflowStatusUpdate, 'type' | 'timestamp'>) {
    this.broadcastToWorkflow(workflowId, {
      ...update,
      type: 'workflow_status',
      timestamp: new Date().toISOString()
    })
  }

  broadcastWorkflowProgress(workflowId: string, progress: Omit<WorkflowProgressUpdate, 'type' | 'timestamp'>) {
    this.broadcastToWorkflow(workflowId, {
      ...progress,
      type: 'workflow_progress',
      timestamp: new Date().toISOString()
    })
  }

  broadcastSystemNotification(workflowId: string, notification: Omit<SystemNotification, 'type' | 'timestamp'>) {
    this.broadcastToWorkflow(workflowId, {
      ...notification,
      type: 'system_notification',
      timestamp: new Date().toISOString()
    })
  }

  broadcastConnectionStatus(workflowId: string) {
    const connectionCount = this.getConnectionCount(workflowId)
    this.broadcastToWorkflow(workflowId, {
      type: 'connection_status',
      status: 'connected',
      connectionCount,
      timestamp: new Date().toISOString()
    })
  }

  private broadcastToWorkflow(workflowId: string, message: WebSocketMessage) {
    const connections = this.connections.get(workflowId)
    if (!connections) return

    connections.forEach(connection => {
      this.sendToConnection(connection, message)
    })
  }

  // Get connection count for a workflow
  getConnectionCount(workflowId: string): number {
    return this.connections.get(workflowId)?.length || 0
  }

  // Get all active workflow IDs
  getActiveWorkflows(): string[] {
    return Array.from(this.connections.keys())
  }

  // Get active workflows for a specific tenant
  getTenantWorkflows(tenantId: string): string[] {
    const tenantWorkflows = this.tenantConnections.get(tenantId)
    return tenantWorkflows ? Array.from(tenantWorkflows) : []
  }

  // Get connection count for a specific tenant
  getTenantConnectionCount(tenantId: string): number {
    const tenantWorkflows = this.tenantConnections.get(tenantId)
    if (!tenantWorkflows) return 0
    
    let count = 0
    const workflowIds = Array.from(tenantWorkflows);
    for (const workflowId of workflowIds) {
      count += this.getConnectionCount(workflowId)
    }
    return count
  }

  // Broadcast to all workflows for a specific tenant
  broadcastToTenant(tenantId: string, message: WebSocketMessage) {
    const tenantWorkflows = this.tenantConnections.get(tenantId)
    if (!tenantWorkflows) return

    const workflowIds = Array.from(tenantWorkflows);
    for (const workflowId of workflowIds) {
      this.broadcastToWorkflow(workflowId, message)
    }
  }

  // Validate tenant access to workflow
  validateTenantAccess(workflowId: string, tenantId: string): boolean {
    const connections = this.connections.get(workflowId)
    if (!connections || connections.length === 0) return false
    
    // Check if any connection for this workflow belongs to the tenant
    return connections.some(conn => conn.tenantId === tenantId)
  }

  // Handle user response and integrate with Python backend
  private async handleUserResponse(connection: WebSocketConnection, message: any) {
    try {
      // Import bridge dynamically to avoid circular dependencies
      const { workflowWebSocketBridge } = await import('./workflow-websocket-bridge')
      
      // Send response to Python backend via bridge
      await workflowWebSocketBridge.handleUserInteraction(
        connection.workflowId,
        message.agentId,
        message.response
      )

      // Broadcast user response to all connections in the workflow
      this.broadcastToWorkflow(connection.workflowId, {
        type: 'user_response',
        agentId: message.agentId,
        response: message.response,
        timestamp: new Date().toISOString()
      })

      // Send confirmation to the sender
      this.sendToConnection(connection, {
        type: 'system_notification',
        level: 'success',
        message: 'Response sent successfully',
        details: { agentId: message.agentId, response: message.response },
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Error handling user response:', error)
      
      // Send error message back to the connection
      this.sendToConnection(connection, {
        type: 'system_notification',
        level: 'error',
        message: 'Failed to send response. Please try again.',
        details: { agentId: message.agentId, error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString()
      })
    }
  }

  // Handle workflow control commands
  private async handleWorkflowControl(connection: WebSocketConnection, message: any) {
    try {
      const { action } = message // 'pause', 'resume', 'cancel'
      
      // Send control command to workflow API
      const response = await fetch(`http://localhost:3000/api/workflows/${connection.workflowId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Broadcast workflow status update
        this.broadcastWorkflowStatus(connection.workflowId, {
          status: result.status,
          controls: result.controls || {
            canPause: result.status === 'running',
            canResume: result.status === 'paused',
            canCancel: result.status !== 'completed'
          }
        })

        // Send success notification
        this.sendToConnection(connection, {
          type: 'system_notification',
          level: 'success',
          message: `Workflow ${action} successful`,
          details: { action, status: result.status },
          timestamp: new Date().toISOString()
        })
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

    } catch (error) {
      console.error('Error handling workflow control:', error)
      
      this.sendToConnection(connection, {
        type: 'system_notification',
        level: 'error',
        message: `Failed to ${message.action} workflow`,
        details: { action: message.action, error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString()
      })
    }
  }

  // Handle status request
  private async handleStatusRequest(connection: WebSocketConnection, message: any) {
    try {
      // Get current workflow status
      const response = await fetch(`http://localhost:3000/api/workflows/${connection.workflowId}/status`)
      
      if (response.ok) {
        const status = await response.json()
        
        // Send current status to requesting connection
        this.sendToConnection(connection, {
          type: 'workflow_status',
          status: status.status,
          controls: status.controls,
          progress: status.progress,
          timestamp: new Date().toISOString()
        })
      }

      // Send connection status
      this.broadcastConnectionStatus(connection.workflowId)

    } catch (error) {
      console.error('Error handling status request:', error)
      
      this.sendToConnection(connection, {
        type: 'system_notification',
        level: 'error',
        message: 'Failed to get workflow status',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString()
      })
    }
  }

  // Register workflow with Python backend bridge
  private async registerWorkflowWithBridge(workflowId: string) {
    try {
      const { workflowWebSocketBridge } = await import('./workflow-websocket-bridge')
      workflowWebSocketBridge.registerWorkflow(workflowId)
    } catch (error) {
      console.error('Error registering workflow with bridge:', error)
    }
  }

  // Unregister workflow from Python backend bridge
  private async unregisterWorkflowFromBridge(workflowId: string) {
    try {
      const { workflowWebSocketBridge } = await import('./workflow-websocket-bridge')
      workflowWebSocketBridge.unregisterWorkflow(workflowId)
    } catch (error) {
      console.error('Error unregistering workflow from bridge:', error)
    }
  }
}

export const websocketManager = new WorkflowWebSocketManager()