import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// 模拟用户数据 - 在实际应用中应该从数据库获取
const users = [
  {
    id: '1',
    email: 'demo@example.com',
    password: '$2a$10$rOzJqQZ8QxQZ8QxQZ8QxQeO7.5uF5vF5vF5vF5vF5vF5vF5vF5vF5', // demo123的哈希值
    name: '演示用户',
    tenantId: 'demo-tenant'
  }
];

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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // 查找用户
        const user = users.find(u => u.email === credentials.email);
        
        if (user && await bcrypt.compare(credentials.password, user.password)) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId
          };
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
      }
      return token;
    },
    async session({ session, token }) {
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
