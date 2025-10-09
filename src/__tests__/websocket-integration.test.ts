/**
 * WebSocket Integration Tests
 * Tests the complete WebSocket system including server, client, and bridge
 */

import { WebSocket } from 'ws'
import { websocketManager } from '@/lib/websocket-server'
import { workflowWebSocketBridge } from '@/lib/workflow-websocket-bridge'

// Mock JWT verification for testing
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(() => ({
    tenantId: 'test-tenant',
    sub: 'test-user'
  }))
}))

describe('WebSocket Integration', () => {
  const testWorkflowId = 'test-workflow-123'
  const testToken = 'test-token'

  beforeEach(() => {
    // Clear any existing connections
    jest.clearAllMocks()
  })

  describe('WebSocket Server', () => {
    test('should broadcast agent status updates', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      // Mock connections map
      const connectionsMap = new Map()
      connectionsMap.set(testWorkflowId, [mockConnection])
      ;(websocketManager as any).connections = connectionsMap

      // Test agent status broadcast
      websocketManager.broadcastAgentStatus(testWorkflowId, {
        agentId: 'test-agent',
        status: 'processing',
        progress: 50,
        message: 'Processing test data',
        currentTask: 'Data analysis'
      })

      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"agent_status"')
      )
      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"agentId":"test-agent"')
      )
    })

    test('should broadcast workflow status updates', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      const connectionsMap = new Map()
      connectionsMap.set(testWorkflowId, [mockConnection])
      ;(websocketManager as any).connections = connectionsMap

      websocketManager.broadcastWorkflowStatus(testWorkflowId, {
        status: 'running',
        controls: {
          canPause: true,
          canResume: false,
          canCancel: true
        }
      })

      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"workflow_status"')
      )
      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"running"')
      )
    })

    test('should broadcast workflow progress updates', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      const connectionsMap = new Map()
      connectionsMap.set(testWorkflowId, [mockConnection])
      ;(websocketManager as any).connections = connectionsMap

      websocketManager.broadcastWorkflowProgress(testWorkflowId, {
        totalSteps: 5,
        completedSteps: 2,
        currentStep: 'Processing data',
        progressPercentage: 40,
        estimatedTimeRemaining: 120
      })

      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"workflow_progress"')
      )
      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"progressPercentage":40')
      )
    })

    test('should broadcast system notifications', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      const connectionsMap = new Map()
      connectionsMap.set(testWorkflowId, [mockConnection])
      ;(websocketManager as any).connections = connectionsMap

      websocketManager.broadcastSystemNotification(testWorkflowId, {
        level: 'info',
        message: 'Test notification',
        details: { test: 'data' }
      })

      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"system_notification"')
      )
      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      )
    })
  })

  describe('WebSocket Bridge', () => {
    test('should register and unregister workflows', () => {
      const initialCount = workflowWebSocketBridge.getActiveWorkflowCount()

      workflowWebSocketBridge.registerWorkflow(testWorkflowId)
      expect(workflowWebSocketBridge.getActiveWorkflowCount()).toBe(initialCount + 1)
      expect(workflowWebSocketBridge.getActiveWorkflows()).toContain(testWorkflowId)

      workflowWebSocketBridge.unregisterWorkflow(testWorkflowId)
      expect(workflowWebSocketBridge.getActiveWorkflowCount()).toBe(initialCount)
      expect(workflowWebSocketBridge.getActiveWorkflows()).not.toContain(testWorkflowId)
    })

    test('should handle user responses', () => {
      const testAgentId = 'test-agent'
      const testResponse = 'Test user response'

      // Store a response
      ;(workflowWebSocketBridge as any).userResponseQueue.set(testWorkflowId, new Map())
      ;(workflowWebSocketBridge as any).userResponseQueue.get(testWorkflowId).set(testAgentId, testResponse)

      // Retrieve the response
      const retrievedResponse = workflowWebSocketBridge.getUserResponse(testWorkflowId, testAgentId)
      expect(retrievedResponse).toBe(testResponse)

      // Response should be removed after retrieval
      const secondRetrieval = workflowWebSocketBridge.getUserResponse(testWorkflowId, testAgentId)
      expect(secondRetrieval).toBeNull()
    })

    test('should broadcast agent updates from Python backend', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      const connectionsMap = new Map()
      connectionsMap.set(testWorkflowId, [mockConnection])
      ;(websocketManager as any).connections = connectionsMap

      const pythonAgentUpdate = {
        workflow_id: testWorkflowId,
        agent_id: 'python-agent',
        status: 'processing' as const,
        progress: 75,
        message: 'Processing from Python backend',
        current_task: 'Data processing',
        requires_response: false
      }

      workflowWebSocketBridge.broadcastAgentUpdate(pythonAgentUpdate)

      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"agentId":"python-agent"')
      )
      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"progress":75')
      )
    })

    test('should broadcast workflow updates from Python backend', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      const connectionsMap = new Map()
      connectionsMap.set(testWorkflowId, [mockConnection])
      ;(websocketManager as any).connections = connectionsMap

      const pythonWorkflowUpdate = {
        workflow_id: testWorkflowId,
        status: 'completed' as const,
        controls: {
          canPause: false,
          canResume: false,
          canCancel: false
        },
        progress: {
          total_steps: 5,
          completed_steps: 5,
          current_step: 'Completed',
          progress_percentage: 100,
          estimated_time_remaining: 0
        }
      }

      workflowWebSocketBridge.broadcastWorkflowUpdate(pythonWorkflowUpdate)

      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"completed"')
      )
      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"progressPercentage":100')
      )
    })
  })

  describe('Message Types', () => {
    test('should handle all WebSocket message types', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      const connectionsMap = new Map()
      connectionsMap.set(testWorkflowId, [mockConnection])
      ;(websocketManager as any).connections = connectionsMap

      // Test all message types
      const messageTypes = [
        {
          method: 'broadcastAgentStatus',
          data: {
            agentId: 'test-agent',
            status: 'idle' as const,
            progress: 0,
            message: 'Agent ready'
          },
          expectedType: 'agent_status'
        },
        {
          method: 'broadcastAgentMessage',
          data: {
            agentId: 'test-agent',
            message: 'Agent message',
            requiresResponse: true
          },
          expectedType: 'agent_message'
        },
        {
          method: 'broadcastWorkflowStatus',
          data: {
            status: 'paused' as const,
            controls: {
              canPause: false,
              canResume: true,
              canCancel: true
            }
          },
          expectedType: 'workflow_status'
        },
        {
          method: 'broadcastWorkflowProgress',
          data: {
            totalSteps: 10,
            completedSteps: 3,
            currentStep: 'Step 3',
            progressPercentage: 30
          },
          expectedType: 'workflow_progress'
        },
        {
          method: 'broadcastSystemNotification',
          data: {
            level: 'warning' as const,
            message: 'Warning message'
          },
          expectedType: 'system_notification'
        }
      ]

      messageTypes.forEach(({ method, data, expectedType }) => {
        ;(websocketManager as any)[method](testWorkflowId, data)
        expect(mockConnection.ws.send).toHaveBeenCalledWith(
          expect.stringContaining(`"type":"${expectedType}"`)
        )
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.CLOSED,
          send: jest.fn(() => {
            throw new Error('Connection closed')
          })
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      const connectionsMap = new Map()
      connectionsMap.set(testWorkflowId, [mockConnection])
      ;(websocketManager as any).connections = connectionsMap

      // Should not throw error when sending to closed connection
      expect(() => {
        websocketManager.broadcastAgentStatus(testWorkflowId, {
          agentId: 'test-agent',
          status: 'processing',
          progress: 50,
          message: 'Test message'
        })
      }).not.toThrow()
    })

    test('should handle invalid message data', () => {
      const mockConnection = {
        ws: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        workflowId: testWorkflowId,
        tenantId: 'test-tenant',
        userId: 'test-user',
        lastPing: Date.now()
      }

      // Test with undefined data
      expect(() => {
        websocketManager.broadcastAgentStatus(testWorkflowId, undefined as any)
      }).not.toThrow()

      // Test with null data
      expect(() => {
        websocketManager.broadcastWorkflowStatus(testWorkflowId, null as any)
      }).not.toThrow()
    })
  })
})