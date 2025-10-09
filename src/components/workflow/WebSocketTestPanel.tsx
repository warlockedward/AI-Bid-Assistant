'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWorkflowWebSocket } from '@/hooks/useWorkflowWebSocket'

interface WebSocketTestPanelProps {
  workflowId: string
  wsToken: string
}

export function WebSocketTestPanel({ workflowId, wsToken }: WebSocketTestPanelProps) {
  const [userResponse, setUserResponse] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState('')

  const {
    connectionStatus,
    messages,
    agentStatuses,
    workflowStatus,
    workflowProgress,
    systemNotifications,
    connect,
    disconnect,
    sendUserResponse,
    sendWorkflowControl,
    clearNotifications,
    removeNotification,
    isConnected
  } = useWorkflowWebSocket({
    workflowId,
    token: wsToken,
    autoConnect: true,
    onMessage: (message) => {
      console.log('WebSocket message received:', message)
    },
    onConnect: () => {
      console.log('WebSocket connected')
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected')
    },
    onError: (error) => {
      console.error('WebSocket error:', error)
    }
  })

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500'
      case 'connecting': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const handleSendResponse = () => {
    if (selectedAgentId && userResponse.trim()) {
      sendUserResponse(selectedAgentId, userResponse.trim())
      setUserResponse('')
    }
  }

  const handleWorkflowControl = (action: 'pause' | 'resume' | 'cancel') => {
    sendWorkflowControl(action)
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            WebSocket Connection
            <div className={`w-3 h-3 rounded-full ${getConnectionStatusColor()}`} />
          </CardTitle>
          <CardDescription>
            Status: {connectionStatus} | Workflow: {workflowId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button 
              onClick={connect} 
              disabled={isConnected}
              variant="outline"
            >
              Connect
            </Button>
            <Button 
              onClick={disconnect} 
              disabled={!isConnected}
              variant="outline"
            >
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Status & Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={workflowStatus.status === 'running' ? 'default' : 'secondary'}>
              {workflowStatus.status}
            </Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleWorkflowControl('pause')}
                disabled={!workflowStatus.controls.canPause}
              >
                Pause
              </Button>
              <Button
                size="sm"
                onClick={() => handleWorkflowControl('resume')}
                disabled={!workflowStatus.controls.canResume}
              >
                Resume
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleWorkflowControl('cancel')}
                disabled={!workflowStatus.controls.canCancel}
              >
                Cancel
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress: {workflowProgress.currentStep}</span>
              <span>{workflowProgress.progressPercentage.toFixed(1)}%</span>
            </div>
            <Progress value={workflowProgress.progressPercentage} />
            <div className="text-xs text-muted-foreground">
              Step {workflowProgress.completedSteps} of {workflowProgress.totalSteps}
              {workflowProgress.estimatedTimeRemaining && (
                <span> • ETA: {Math.round(workflowProgress.estimatedTimeRemaining / 60)}m</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Statuses */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(agentStatuses).map(([agentId, status]) => (
              <div key={agentId} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{agentId}</span>
                  <Badge variant={status.status === 'processing' ? 'default' : 'secondary'}>
                    {status.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">{status.message}</div>
                  {status.currentTask && (
                    <div className="text-xs text-muted-foreground">Task: {status.currentTask}</div>
                  )}
                  <Progress value={status.progress} className="h-2" />
                </div>
              </div>
            ))}
            {Object.keys(agentStatuses).length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                No active agents
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Interaction */}
      <Card>
        <CardHeader>
          <CardTitle>Send User Response</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Agent ID"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            />
            <Input
              placeholder="Your response..."
              value={userResponse}
              onChange={(e) => setUserResponse(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendResponse()}
            />
            <Button onClick={handleSendResponse} disabled={!selectedAgentId || !userResponse.trim()}>
              Send
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Available agents: {Object.keys(agentStatuses).join(', ') || 'None'}
          </div>
        </CardContent>
      </Card>

      {/* System Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            System Notifications
            <Button size="sm" variant="outline" onClick={clearNotifications}>
              Clear All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {systemNotifications.map((notification) => (
                <Alert key={notification.id} className="relative">
                  <AlertDescription>
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant={notification.level === 'error' ? 'destructive' : 'default'} className="mb-1">
                          {notification.level}
                        </Badge>
                        <div>{notification.message}</div>
                        {notification.details && (
                          <pre className="text-xs mt-1 text-muted-foreground">
                            {JSON.stringify(notification.details, null, 2)}
                          </pre>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeNotification(notification.id)}
                      >
                        ×
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
              {systemNotifications.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  No notifications
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Message Log */}
      <Card>
        <CardHeader>
          <CardTitle>Message Log</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {messages.slice(-20).map((message, index) => (
                <div key={index} className="text-xs font-mono bg-muted p-2 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{message.type}</Badge>
                    <span className="text-muted-foreground">{message.timestamp}</span>
                  </div>
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(message, null, 2)}
                  </pre>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  No messages received
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}