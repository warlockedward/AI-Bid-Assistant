import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { password = 'demo123' } = await request.json();
    
    // 获取演示用户的密码哈希
    const user = await prisma.user.findUnique({
      where: { email: 'demo@example.com' },
      select: { password: true, email: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // 测试bcrypt比较
    const isValid = user.password ? await bcrypt.compare(password, user.password) : false;
    
    // 生成新的哈希用于比较
    const newHash = await bcrypt.hash(password, 12);
    const testWithNewHash = await bcrypt.compare(password, newHash);
    
    return NextResponse.json({
      success: true,
      results: {
        userEmail: user.email,
        hasStoredPassword: !!user.password,
        storedPasswordLength: user.password?.length || 0,
        passwordToTest: password,
        bcryptCompareResult: isValid,
        newHashTest: testWithNewHash,
        storedPasswordStart: user.password?.substring(0, 20) || 'none'
      }
    });
    
  } catch (error) {
    console.error('Bcrypt test error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}