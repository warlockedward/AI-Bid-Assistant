import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AgentWorkspaceWrapper } from '@/components/AgentWorkspaceWrapper'

interface PageProps {
  searchParams: { workflowId?: string }
}

export default async function AgentWorkspacePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.tenantId) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Workspace</h1>
          <p className="text-gray-600 mt-2">
            Monitor and interact with AI agents in real-time
          </p>
        </div>

        <AgentWorkspaceWrapper
          workflowId={searchParams.workflowId}
          tenantId={session.user.tenantId}
        />
      </div>
    </div>
  )
}