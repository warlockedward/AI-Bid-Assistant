import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTenantIsolation } from '@/lib/database';
import { DashboardOverview } from '@/components/dashboard/overview';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.tenantId) {
    return <div>未授权访问</div>;
  }

  const db = withTenantIsolation(session.user.tenantId);

  // 获取统计数据
  const [
    totalProjects,
    activeWorkflows,
    pendingReviews,
    completedProjects
  ] = await Promise.all([
    db.bidProject.count(),
    db.workflowExecution.count({
      where: { status: 'RUNNING' }
    }),
    db.generatedContent.count({
      where: { status: 'PENDING_REVIEW' }
    }),
    db.bidProject.count({
      where: { status: 'APPROVED' }
    })
  ]);

  // 获取最近的项目
  const recentProjects = await db.bidProject.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      workflowExecutions: {
        take: 1,
        orderBy: { startedAt: 'desc' }
      }
    }
  });

  // 获取活跃的工作流
  const activeWorkflowsList = await db.workflowExecution.findMany({
    where: { status: 'RUNNING' },
    take: 5,
    orderBy: { startedAt: 'desc' },
    include: {
      bidProject: {
        select: { name: true }
      }
    }
  });

  const stats = {
    totalProjects,
    activeWorkflows,
    pendingReviews,
    completedProjects
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">仪表板概览</h1>
        <p className="text-gray-600 mt-2">
          欢迎回来，{session.user.name}！这里是您的项目概览。
        </p>
      </div>

      <DashboardOverview 
        stats={stats}
        recentProjects={recentProjects}
        activeWorkflows={activeWorkflowsList}
      />
    </div>
  );
}