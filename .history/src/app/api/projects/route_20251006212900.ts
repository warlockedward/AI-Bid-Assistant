import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTenantIsolation } from '@/lib/database';
import { 
  createSuccessResponse, 
  createErrorResponse,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  DatabaseError
} from '@/lib/error-handler';

export async function GET(request: NextRequest) {
  try {
    console.log('获取项目列表请求');
    const session = await getServerSession(authOptions);
    console.log('会话信息:', session);
    
    if (!session?.user?.tenantId) {
      console.log('未授权访问 - 缺少租户ID');
      return NextResponse.json(
        createErrorResponse(
          new AuthenticationError('未授权访问', 'UNAUTHORIZED')
        ),
        { status: 401 }
      );
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

    return NextResponse.json(createSuccessResponse({ projects }));

  } catch (error: any) {
    console.error('获取项目列表失败:', error);
    
    // 处理自定义错误
    if (error.name && error.name.endsWith('Error')) {
      return NextResponse.json(
        createErrorResponse(error),
        { status: error.statusCode || 500 }
      );
    }
    
    // 处理其他错误
    const databaseError = new DatabaseError('服务器内部错误', 'INTERNAL_SERVER_ERROR');
    return NextResponse.json(
      createErrorResponse(databaseError),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('创建项目请求');
    const session = await getServerSession(authOptions);
    console.log('会话信息:', session);
    
    if (!session?.user?.tenantId) {
      console.log('未授权访问 - 缺少租户ID');
      return NextResponse.json(
        createErrorResponse(
          new AuthenticationError('未授权访问', 'UNAUTHORIZED')
        ),
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('请求体:', body);
    
    const { name, description, tenderDocument } = body;

    if (!name || !tenderDocument) {
      console.log('缺少必需参数');
      return NextResponse.json(
        createErrorResponse(
          new ValidationError('缺少必需参数', 'MISSING_REQUIRED_FIELDS')
        ),
        { status: 400 }
      );
    }

    // 验证招标文档数据
    if (!tenderDocument.filename || !tenderDocument.content) {
      return NextResponse.json(
        createErrorResponse(
          new ValidationError('招标文档数据不完整', 'INVALID_TENDER_DOCUMENT')
        ),
        { status: 400 }
      );
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

    return NextResponse.json(
      createSuccessResponse({ project }, '项目创建成功'),
      { status: 201 }
    );

  } catch (error: any) {
    console.error('创建项目失败:', error);
    
    // 处理自定义错误
    if (error.name && error.name.endsWith('Error')) {
      return NextResponse.json(
        createErrorResponse(error),
        { status: error.statusCode || 500 }
      );
    }
    
    // 处理数据库约束错误
    if (error.message && error.message.includes('Unique constraint failed')) {
      const validationError = new ValidationError('项目名称已存在', 'PROJECT_NAME_EXISTS');
      return NextResponse.json(
        createErrorResponse(validationError),
        { status: 409 }
      );
    }
    
    // 处理其他错误
    const databaseError = new DatabaseError('服务器内部错误', 'INTERNAL_SERVER_ERROR');
    return NextResponse.json(
      createErrorResponse(databaseError),
      { status: 500 }
    );
  }
}