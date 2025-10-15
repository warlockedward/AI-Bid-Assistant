import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/database';

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
        
        if (!credentials?.email || !credentials?.password) {
          console.log('缺少凭据');
          return null;
        }

        try {
          // 从数据库查找用户
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { tenant: true }
          });
          
          console.log('找到用户:', user);
          
          // 验证用户是否存在且密码正确
          if (user && user.password && await bcrypt.compare(credentials.password, user.password)) {
            console.log('密码验证成功');
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              tenantId: user.tenantId
            };
          }
          
          console.log('认证失败');
          return null;
        } catch (error) {
          console.error('认证过程中发生错误:', error);
          return null;
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
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true, // 启用调试模式
};

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