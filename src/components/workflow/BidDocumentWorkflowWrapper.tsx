'use client'

import { BidDocumentWorkflow } from './BidDocumentWorkflow'

interface BidDocumentWorkflowWrapperProps {
  projectId: string
  tenantId: string
}

export function BidDocumentWorkflowWrapper({ 
  projectId, 
  tenantId 
}: BidDocumentWorkflowWrapperProps) {
  const handleWorkflowComplete = (result: any) => {
    console.log('Workflow completed:', result)
    // Handle workflow completion here
    // You can add navigation, notifications, etc.
  }

  return (
    <BidDocumentWorkflow
      projectId={projectId}
      tenantId={tenantId}
      onWorkflowComplete={handleWorkflowComplete}
    />
  )
}