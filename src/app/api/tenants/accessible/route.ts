import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 获取用户可访问的租户列表
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 目前简化为只返回用户当前的租户
    // 在更复杂的场景中，用户可能属于多个租户
    const tenants = user.tenant ? [user.tenant] : [];

    return NextResponse.json({
      tenants: tenants.map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        isActive: tenant.isActive
      }))
    });

  } catch (error) {
    console.error('Error fetching accessible tenants:', error);
    return NextResponse.json(
      { error: '获取租户列表失败' },
      { status: 500 }
    );
  }
}