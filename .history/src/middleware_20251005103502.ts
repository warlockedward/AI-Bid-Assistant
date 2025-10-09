import { NextResponse } from 'next/server';

// 临时解决方案：直接导出一个简单的中间件，允许所有访问
export default function middleware(req) {
  return NextResponse.next();
}

// 临时配置，只匹配必要的路径
export const config = {
  matcher: []
};