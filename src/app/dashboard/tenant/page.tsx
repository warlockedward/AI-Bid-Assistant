import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TenantConfig } from '@/components/tenant-config'
import { TenantSelector } from '@/components/tenant-selector'

export const metadata: Metadata = {
  title: '租户管理 - 智能投标系统',
  description: '管理租户配置和设置',
}

export default async function TenantManagementPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // 检查用户权限
  const hasManagementAccess = ['ADMIN', 'MANAGER'].includes(session.user.role)

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* 租户选择器 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <TenantSelector currentTenantId={session.user.tenantId} />
        </div>

        {/* 租户配置 - 只有管理员可以访问 */}
        {hasManagementAccess ? (
          <TenantConfig />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">权限不足</h3>
              <p className="text-gray-600">
                只有管理员和经理可以访问租户配置设置。
              </p>
              <p className="text-sm text-gray-500 mt-2">
                当前角色: {session.user.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}