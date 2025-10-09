import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email = 'demo@example.com', password = 'demo123', domain = 'demo' } = await request.json();
    
    console.log('Debug auth request:', { email, domain });
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found', email }, { status: 404 });
    }
    
    console.log('Found user:', {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      role: user.role,
      hasPassword: !!user.password,
      tenant: user.tenant
    });
    
    // 验证密码
    let isValid = false;
    if (user.password) {
      isValid = await bcrypt.compare(password, user.password);
      console.log('Password comparison result:', isValid);
    } else {
      console.log('No password stored for user');
    }
    
    if (!isValid) {
      return NextResponse.json({ 
        error: 'Invalid password',
        hasPassword: !!user.password,
        passwordLength: user.password?.length || 0
      }, { status: 401 });
    }
    
    // 验证租户
    if (domain && user.tenant?.domain !== domain) {
      return NextResponse.json({ 
        error: 'Invalid tenant',
        expectedDomain: domain,
        actualDomain: user.tenant?.domain
      }, { status: 401 });
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
        tenant: user.tenant
      }
    });
    
  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}