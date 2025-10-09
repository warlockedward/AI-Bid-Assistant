import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    return NextResponse.json({
      success: true,
      session: session || null,
      message: session ? '已认证' : '未认证'
    });
  } catch (error) {
    console.error('认证测试错误:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}