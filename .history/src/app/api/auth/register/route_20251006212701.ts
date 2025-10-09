import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';

// 自定义错误类型
class RegistrationError extends Error {
  constructor(message: string, public statusCode: number, public code: string) {
    super(message);
    this.name = 'RegistrationError';
  }
}

// 统一响应格式
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    code?: string;
    statusCode?: number;
  };
}

/**
 * 用户注册API
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, name, companyName, domain } = await request.json();

    // 验证必填字段
    if (!email || !password || !name) {
      throw new RegistrationError('邮箱、密码和姓名为必填项', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new RegistrationError('邮箱格式不正确', 400, 'INVALID_EMAIL');
    }

    // 验证密码强度
    if (password.length < 6) {
      throw new RegistrationError('密码长度至少6位', 400, 'WEAK_PASSWORD');
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new RegistrationError('该邮箱已被注册', 409, 'EMAIL_EXISTS');
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
        throw new RegistrationError('指定的企业域名不存在', 404, 'TENANT_NOT_FOUND');
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

    return NextResponse.json({
      success: true,
      message: '注册成功',
      data: { user: userWithoutPassword },
    } as APIResponse<{ user: typeof userWithoutPassword }>);

  } catch (error) {
    console.error('Registration error:', error);
    
    // 处理自定义注册错误
    if (error instanceof RegistrationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
          },
        } as APIResponse<null>,
        { status: error.statusCode }
      );
    }
    
    // 处理数据库错误
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint failed')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: '数据冲突，请稍后重试',
              code: 'DATABASE_CONFLICT',
              statusCode: 409,
            },
          } as APIResponse<null>,
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: {
            message: '服务器内部错误，请稍后重试',
            code: 'INTERNAL_SERVER_ERROR',
            statusCode: 500,
          },
        } as APIResponse<null>,
        { status: 500 }
      );
    }
    
    // 处理未知错误
    return NextResponse.json(
      {
        success: false,
        error: {
          message: '未知错误，请稍后重试',
          code: 'UNKNOWN_ERROR',
          statusCode: 500,
        },
      } as APIResponse<null>,
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