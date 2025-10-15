import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/database';
import { AuthenticationError } from '@/lib/error-handler';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: '邮箱', type: 'text' },
        password: { label: '密码', type: 'password' },
        domain: { label: '域名', type: 'text', placeholder: '可选' }
      },
      async authorize(credentials) {
        console.log('认证请求:', credentials);
        
        // 验证凭据
        if (!credentials?.email || !credentials?.password) {
          console.log('缺少凭据');
          throw new AuthenticationError('邮箱和密码为必填项', 'MISSING_CREDENTIALS');
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(credentials.email)) {
          throw new AuthenticationError('邮箱格式不正确', 'INVALID_EMAIL');
        }

        try {
          // 从数据库查找用户
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { tenant: true }
          });
          
          console.log('找到用户:', user);
          
          // 检查用户是否存在
          if (!user) {
            throw new AuthenticationError('用户不存在', 'USER_NOT_FOUND');
          }

          // 检查用户是否激活
          if (!user.isActive) {
            throw new AuthenticationError('账户已被禁用', 'ACCOUNT_DISABLED');
          }

          // 检查密码是否存在
          if (!user.password) {
            throw new AuthenticationError('账户未设置密码', 'PASSWORD_NOT_SET');
          }
          
          // 验证密码
          const isValidPassword = await bcrypt.compare(credentials.password, user.password);
          if (!isValidPassword) {
            throw new AuthenticationError('密码错误', 'INVALID_PASSWORD');
          }

          console.log('密码验证成功');
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId
          };
        } catch (error) {
          // 如果是自定义认证错误，重新抛出
          if (error instanceof AuthenticationError) {
            throw error;
          }
          
          // 其他错误记录并抛出通用错误
          console.error('认证过程中发生错误:', error);
          throw new AuthenticationError('认证服务暂时不可用', 'AUTH_SERVICE_ERROR');
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      console.log('JWT回调:', { token, user });
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      console.log('Session回调:', { session, token });
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).tenantId = token.tenantId as string;
      }
      return session;
    }
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('用户登录:', { user, account, profile, isNewUser });
      try {
        // 更新用户最后登录时间
        if (user?.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
          });
        }
      } catch (error) {
        console.error('更新用户最后登录时间失败:', error);
      }
    },
    async signOut({ token, session }) {
      console.log('用户登出:', { token, session });
    },
    async createUser({ user }) {
      console.log('创建新用户:', user);
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development', // 仅在开发环境启用调试模式
};

/**
 * Authentication utilities
 */
export class AuthUtils {
  /**
   * Validate that a user has access to a specific tenant
   */
  static async validateTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true }
      });
      
      return user?.tenantId === tenantId;
    } catch (error) {
      console.error('Error validating tenant access:', error);
      return false;
    }
  }

  /**
   * Check if a user has a specific permission
   */
  static async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    try {
      // In a real implementation, this would check the user's role and permissions
      // For now, we'll allow all authenticated users to execute workflows
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      
      // Allow ADMIN and MANAGER roles to execute workflows
      // For other roles, allow workflow execution by default
      return !!user;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }
}

/**
 * 租户上下文类型定义
 */
export interface TenantContext {
  id: string;
  name: string;
  domain: string;
  settings: Record<string, any>;
}

/**
 * 扩展的Session类型
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      tenantId: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId?: string;
    id?: string;
  }
}

// 导出认证错误类
export { AuthenticationError };