import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/database'

/**
 * 切换用户的当前租户
 * 验证用户是否有权限访问目标租户
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { tenantId } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: '缺少租户ID' }, { status: 400 })
    }

    // 验证租户是否存在且处于活跃状态
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        isActive: true,
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: '租户不存在' }, { status: 404 })
    }

    if (!tenant.isActive) {
      return NextResponse.json({ error: '租户已被禁用' }, { status: 403 })
    }

    // 验证用户是否有权限访问该租户
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        tenantId: true,
        isActive: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: '用户账户已被禁用' }, { status: 403 })
    }

    // 目前简化实现：只允许切换到用户自己的租户
    // 未来可以扩展支持多租户成员关系
    if (user.tenantId !== tenantId) {
      return NextResponse.json({ 
        error: '无权限访问该租户' 
      }, { status: 403 })
    }

    // 记录租户切换日志
    console.log(`用户 ${session.user.email} 切换到租户 ${tenant.name} (${tenantId})`)

    // 更新用户的最后登录时间
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastLogin: new Date() }
    })

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      message: `已切换到 ${tenant.name}`
    })

  } catch (error) {
    console.error('租户切换失败:', error)
    return NextResponse.json(
      { 
        error: '租户切换失败',
        details: error instanceof Error ? error.message : '未知错误'
      }, 
      { status: 500 }
    )
  }
}