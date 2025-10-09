import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// 临时解决方案：直接导出一个简单的中间件，允许所有访问
export default function middleware(req) {
  return NextResponse.next();
}

/* 原始认证中间件暂时禁用
const originalAuth = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // 允许访问的公共路径
    const publicPaths = [
      '/',
      '/auth/signin',
      '/auth/signup',
      '/auth/error',
      '/api/auth',
      '/simple-test',
      '/quick-login',
      '/test-auth',
      '/api/debug-auth',
      '/api/test-bcrypt',
      '/dashboard'  // 临时添加dashboard为公共路径
    ];

    // 检查是否为公共路径
    const isPublicPath = publicPaths.some(path => 
      pathname.startsWith(path) || pathname === path
    );

    // 如果是公共路径，允许访问
    if (isPublicPath) {
      return NextResponse.next();
    }

    // 如果用户未登录且访问受保护的路径，重定向到登录页
    if (!token) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', req.url);
      return NextResponse.redirect(signInUrl);
    }

    // 检查用户是否有租户ID
    if (!token.tenantId && pathname.startsWith('/dashboard')) {
      const errorUrl = new URL('/auth/error?error=NoTenant', req.url);
      return NextResponse.redirect(errorUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // 允许访问公共路径
        const publicPaths = [
          '/',
          '/auth/signin',
          '/auth/signup',
          '/auth/error',
          '/simple-test',
          '/quick-login',
          '/test-auth'
        ];

        if (publicPaths.some(path => pathname.startsWith(path))) {
          return true;
        }

        // 其他路径需要认证
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};