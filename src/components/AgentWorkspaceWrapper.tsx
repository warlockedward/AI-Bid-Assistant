'use client'

import { AgentWorkspace } from './agent-workspace'

interface AgentWorkspaceWrapperProps {
  workflowId?: string
  tenantId: string
}

export function AgentWorkspaceWrapper({ 
  workflowId, 
  tenantId 
}: AgentWorkspaceWrapperProps) {
  const handleWorkflowComplete = (result: any) => {
    console.log('Workflow completed in workspace:', result)
    // Handle workflow completion here
    // You can add navigation, notifications, etc.
  }

  return (
    <AgentWorkspace
      workflowId={workflowId}
      tenantId={tenantId}
      onWorkflowComplete={handleWorkflowComplete}
    />
  )
}