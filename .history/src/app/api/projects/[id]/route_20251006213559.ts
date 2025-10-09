import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTenantIsolation } from '@/lib/database';
import { 
  createSuccessResponse, 
  createErrorResponse,
  AuthenticationError,
  NotFoundError,
  DatabaseError
} from '@/lib/error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        createErrorResponse(
          new AuthenticationError('未授权', 'UNAUTHORIZED')
        ),
        { status: 401 }
      );
    }

    const db = withTenantIsolation(session.user.tenantId);
    
    const project = await db.bidProject.findUnique({
      where: { id: params.id },
      include: {
        tenderDocument: {
          include: {
            extractedRequirements: true,
            classification: true
          }
        },
        assignedAgents: true,
        generatedContent: {
          include: {
            reviewRecords: {
              include: {
                reviewer: {
                  select: { id: true, name: true, email: true }
                }
              }
            }
          }
        },
        workflowExecutions: {
          orderBy: { startedAt: 'desc' }
        },
        reviewHistory: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { reviewedAt: 'desc' }
        }
      }
    });

    if (!project) {
      return NextResponse.json(
        createErrorResponse(
          new NotFoundError('项目不存在', 'PROJECT_NOT_FOUND')
        ),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse({ project }));

  } catch (error: any) {
    console.error('获取项目详情失败:', error);
    
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        createErrorResponse(
          new AuthenticationError('未授权', 'UNAUTHORIZED')
        ),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, status } = body;

    const db = withTenantIsolation(session.user.tenantId);

    const project = await db.bidProject.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(status && { status }),
        updatedAt: new Date()
      },
      include: {
        tenderDocument: true,
        assignedAgents: true,
        generatedContent: true
      }
    });

    return NextResponse.json(createSuccessResponse({ project }));

  } catch (error: any) {
    console.error('更新项目失败:', error);
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        createErrorResponse(
          new AuthenticationError('未授权', 'UNAUTHORIZED')
        ),
        { status: 401 }
      );
    }

    const db = withTenantIsolation(session.user.tenantId);

    await db.bidProject.delete({
      where: { id: params.id }
    });

    return NextResponse.json(createSuccessResponse(null, '项目已删除'));

  } catch (error: any) {
    console.error('删除项目失败:', error);
    
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