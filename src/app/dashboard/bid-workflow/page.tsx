import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BidDocumentWorkflowWrapper } from '@/components/workflow/BidDocumentWorkflowWrapper'

export default async function BidWorkflowPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.tenantId) {
    redirect('/auth/signin')
  }

  // In a real implementation, you might get the project ID from URL params
  // For now, we'll use a default project ID
  const projectId = 'default-project'

  return (
    <div className="container mx-auto py-6">
      <BidDocumentWorkflowWrapper
        projectId={projectId}
        tenantId={session.user.tenantId}
      />
    </div>
  )
}