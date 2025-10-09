import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { 
  createSuccessResponse, 
  createErrorResponse,
  ValidationError,
  DatabaseError
} from '@/lib/error-handler';

/**
 * 用户注册API
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, name, companyName, domain } = await request.json();

    // 验证必填字段
    if (!email || !password || !name) {
      throw new ValidationError('邮箱、密码和姓名为必填项', 'MISSING_REQUIRED_FIELDS');
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('邮箱格式不正确', 'INVALID_EMAIL');
    }

    // 验证密码强度
    if (password.length < 6) {
      throw new ValidationError('密码长度至少6位', 'WEAK_PASSWORD');
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ValidationError('该邮箱已被注册', 'EMAIL_EXISTS');
    }

    // 处理租户逻辑
    let tenant;
    let userRole = 'USER'; // 默认角色
    let finalCompanyName = companyName; // 用于存储最终的公司名称
    
    if (domain) {
      // 如果提供了域名，尝试加入现有租户
      tenant = await prisma.tenant.findUnique({
        where: { domain },
      });

      if (!tenant) {
        throw new ValidationError('指定的企业域名不存在', 'TENANT_NOT_FOUND');
      }
      userRole = 'USER'; // 加入现有租户的用户为普通用户
      finalCompanyName = tenant.name; // 使用租户名称
    } else {
      // 创建新租户
      const tenantName = companyName || `${name}的公司`;
      finalCompanyName = tenantName;
      const tenantDomain = generateTenantDomain(email);

      // 检查域名是否已存在
      let uniqueDomain = tenantDomain;
      let counter = 1;
      while (await prisma.tenant.findUnique({ where: { domain: uniqueDomain } })) {
        uniqueDomain = `${tenantDomain}-${counter}`;
        counter++;
      }

      // 创建租户
      tenant = await prisma.tenant.create({
        data: {
          name: tenantName,
          domain: uniqueDomain,
          isActive: true,
        },
      });

      // 创建租户配置
      await prisma.tenantConfig.create({
        data: {
          tenantId: tenant.id,
        },
      });
      
      userRole = 'ADMIN'; // 创建租户的用户为管理员
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        companyName: finalCompanyName,
        tenantId: tenant.id,
        role: userRole as any,
        emailVerified: new Date(), // 简化流程，直接验证邮箱
        isActive: true,
      },
      include: {
        tenant: true,
      },
    });

    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      createSuccessResponse(
        { user: userWithoutPassword }, 
        '注册成功'
      )
    );

  } catch (error: any) {
    console.error('Registration error:', error);
    
    // 处理自定义错误
    if (error.name && error.name.endsWith('Error')) {
      return NextResponse.json(
        createErrorResponse(error),
        { status: error.statusCode || 500 }
      );
    }
    
    // 处理数据库错误
    if (error.message) {
      if (error.message.includes('Unique constraint failed')) {
        const dbError = new DatabaseError('数据冲突，请稍后重试', 'DATABASE_CONFLICT');
        return NextResponse.json(
          createErrorResponse(dbError),
          { status: 409 }
        );
      }
      
      const dbError = new DatabaseError('服务器内部错误，请稍后重试', 'INTERNAL_SERVER_ERROR');
      return NextResponse.json(
        createErrorResponse(dbError),
        { status: 500 }
      );
    }
    
    // 处理未知错误
    const unknownError = new DatabaseError('未知错误，请稍后重试', 'UNKNOWN_ERROR');
    return NextResponse.json(
      createErrorResponse(unknownError),
      { status: 500 }
    );
  }
}

/**
 * 从邮箱生成租户域名
 */
function generateTenantDomain(email: string): string {
  const domain = email.split('@')[1];
  return domain.replace(/\./g, '-').toLowerCase();
}