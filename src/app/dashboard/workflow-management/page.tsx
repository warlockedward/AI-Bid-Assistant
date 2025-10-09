import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { WorkflowManagementDashboard } from '@/components/workflow/WorkflowManagementDashboard'

export default async function WorkflowManagementPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.tenantId) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-6">
      <WorkflowManagementDashboard tenantId={session.user.tenantId} />
    </div>
  )
}