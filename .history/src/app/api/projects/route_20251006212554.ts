import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTenantIsolation } from '@/lib/database';

// 自定义错误类型
class APIError extends Error {
  constructor(message: string, public statusCode: number, public code?: string) {
    super(message);
    this.name = 'APIError';
  }
}

// 统一响应格式
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    statusCode?: number;
  };
  timestamp: string;
}

// 创建成功响应
function createSuccessResponse<T>(data: T, message?: string): APIResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

// 创建错误响应
function createErrorResponse(message: string, statusCode: number, code?: string): APIResponse<null> {
  return {
    success: false,
    error: {
      message,
      code,
      statusCode,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('获取项目列表请求');
    const session = await getServerSession(authOptions);
    console.log('会话信息:', session);
    
    if (!session?.user?.tenantId) {
      console.log('未授权访问 - 缺少租户ID');
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const db = withTenantIsolation(session.user.tenantId);
    console.log('使用租户ID:', session.user.tenantId);
    
    const projects = await db.bidProject.findMany({
      include: {
        tenderDocument: true,
        assignedAgents: true,
        generatedContent: true,
        workflowExecutions: {
          orderBy: { startedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('获取到项目数量:', projects.length);

    return NextResponse.json({ projects });

  } catch (error) {
    console.error('获取项目列表失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('创建项目请求');
    const session = await getServerSession(authOptions);
    console.log('会话信息:', session);
    
    if (!session?.user?.tenantId) {
      console.log('未授权访问 - 缺少租户ID');
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    console.log('请求体:', body);
    
    const { name, description, tenderDocument } = body;

    if (!name || !tenderDocument) {
      console.log('缺少必需参数');
      return NextResponse.json({ error: '缺少必需参数' }, { status: 400 });
    }

    const db = withTenantIsolation(session.user.tenantId);
    console.log('使用租户ID创建项目:', session.user.tenantId);

    const project = await db.bidProject.create({
      data: {
        name,
        description,
        status: 'DRAFT',
        tenantId: session.user.tenantId,
        tenderDocument: {
          create: {
            filename: tenderDocument.filename,
            content: tenderDocument.content,
            extractedRequirements: {
              create: []
            },
            uploadedAt: new Date()
          }
        }
      },
      include: {
        tenderDocument: true
      }
    });
    
    console.log('项目创建成功:', project.id);

    return NextResponse.json({ project }, { status: 201 });

  } catch (error) {
    console.error('创建项目失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}