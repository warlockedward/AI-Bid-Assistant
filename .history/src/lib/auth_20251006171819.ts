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
 * 企业级认证配置
 * 支持多租户SSO集成和多种登录方式
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24小时
  },
  providers: [
    // 邮箱密码登录
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        domain: { label: 'Domain', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // 验证用户凭据
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true },
        });

        if (!user) {
          throw new Error('用户不存在');
        }

        // 验证密码
        let isValid = false;
        if (user.password) {
          // 使用bcrypt验证哈希密码
          isValid = await bcrypt.compare(credentials.password, user.password);
          console.log('Password verification:', { email: credentials.email, isValid });
        } else {
          // 演示环境密码验证（向后兼容）
          isValid = credentials.password === 'demo123';
          console.log('Fallback password verification:', { email: credentials.email, isValid });
        }

        if (!isValid) {
          console.error('Password verification failed for:', credentials.email);
          throw new Error('密码错误');
        }

        // 验证租户访问权限
        if (credentials.domain && user.tenant?.domain !== credentials.domain) {
          throw new Error('无权访问该租户');
        }

        // 更新最后登录时间
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId || '',
          role: user.role,
        };
      },
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // 处理OAuth登录时的用户创建/更新
      if (account?.provider === 'google' || account?.provider === 'github') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { tenant: true }
        });

        if (!existingUser) {
          // 为新的OAuth用户创建租户和用户
          const tenant = await createTenantForUser(user.email!, user.name || 'Unknown Company');

          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              tenantId: tenant.id,
              ssoProvider: account.provider,
              ssoId: account.providerAccountId,
              emailVerified: new Date(),
            }
          });
        } else if (!existingUser.tenantId) {
          // 为现有用户分配租户
          const tenant = await createTenantForUser(user.email!, user.name || 'Unknown Company');
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { tenantId: tenant.id }
          });
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // 初始登录时添加用户信息到token
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { tenant: true }
        });

        token.tenantId = dbUser?.tenantId || undefined;
        token.role = dbUser?.role;
      }

      // SSO提供商返回的信息
      if (account?.provider) {
        token.provider = account.provider;
      }

      return token;
    },

    async session({ session, token }) {
      // 将token信息添加到session
      session.user.id = token.sub!;
      session.user.tenantId = token.tenantId as string;
      session.user.role = token.role as string;

      // 获取租户配置
      if (token.tenantId) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: token.tenantId as string },
          select: { name: true, settings: true },
        });

        (session as any).tenant = tenant;
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      // 重定向到租户特定的仪表盘
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  events: {
    async signIn(message) {
      console.log('用户登录:', message.user.email);
    },
    async signOut(message) {
      console.log('用户登出:', message.session?.user?.email);
    },
  },
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
      role: string;
    };
    tenant?: TenantContext;
  }

  interface User {
    tenantId: string;
    role: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId?: string;
    role?: string;
    provider?: string;
  }
}

/**
 * 为新用户创建租户
 */
async function createTenantForUser(email: string, companyName: string) {
  // 从邮箱域名生成租户域名
  const domain = email.split('@')[1].replace(/\./g, '-');

  // 检查域名是否已存在
  let uniqueDomain = domain;
  let counter = 1;
  while (await prisma.tenant.findUnique({ where: { domain: uniqueDomain } })) {
    uniqueDomain = `${domain}-${counter}`;
    counter++;
  }

  // 创建租户
  const tenant = await prisma.tenant.create({
    data: {
      name: companyName,
      domain: uniqueDomain,
      isActive: true,
    }
  });

  // 创建租户配置
  await prisma.tenantConfig.create({
    data: {
      tenantId: tenant.id,
    }
  });

  return tenant;
}

/**
 * 权限验证工具函数
 */
export class AuthUtils {
  /**
   * 检查用户是否有权限访问资源
   */
  static async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) return false;

    // 基于角色的权限检查
    const permissions = this.getRolePermissions(user.role);
    return permissions[resource]?.includes(action) || false;
  }

  /**
   * 获取角色权限配置
   */
  private static getRolePermissions(role: string): Record<string, string[]> {
    const permissions: Record<string, Record<string, string[]>> = {
      ADMIN: {
        projects: ['create', 'read', 'update', 'delete', 'manage'],
        workflows: ['create', 'read', 'update', 'delete', 'execute'],
        users: ['create', 'read', 'update', 'delete', 'manage'],
        tenants: ['read', 'update'],
      },
      MANAGER: {
        projects: ['create', 'read', 'update', 'delete'],
        workflows: ['create', 'read', 'update', 'execute'],
        users: ['read'],
      },
      USER: {
        projects: ['read', 'create'],
        workflows: ['read', 'execute'],
      },
    };

    return permissions[role] || {};
  }

  /**
   * 验证租户访问权限
   */
  static async validateTenantAccess(
    userId: string,
    tenantId: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    return user?.tenantId === tenantId;
  }

  /**
   * 获取用户租户上下文
   */
  static async getTenantContext(userId: string): Promise<TenantContext | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user?.tenant) return null;

    return {
      id: user.tenant.id,
      name: user.tenant.name,
      domain: user.tenant.domain || '',
      settings: user.tenant.settings as Record<string, any>,
    };
  }
}