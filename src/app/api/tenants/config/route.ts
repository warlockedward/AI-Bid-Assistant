import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/database'

/**
 * 获取当前租户的配置信息
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 获取租户配置
    const tenantConfig = await prisma.tenantConfig.findUnique({
      where: { tenantId: session.user.tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
            isActive: true,
          }
        }
      }
    })

    if (!tenantConfig) {
      // 如果没有配置，创建默认配置
      const defaultConfig = await prisma.tenantConfig.create({
        data: {
          tenantId: session.user.tenantId,
          features: {
            aiAssistance: true,
            workflowAutomation: true,
            documentGeneration: true,
            complianceCheck: true,
          },
          workflowSettings: {
            autoSave: true,
            checkpointInterval: 300, // 5分钟
            maxRetries: 3,
            timeoutMinutes: 60,
          },
          uiCustomization: {
            theme: 'dark',
            primaryColor: '#3b82f6',
            companyLogo: null,
          },
          notificationSettings: {
            emailNotifications: true,
            workflowCompletion: true,
            errorAlerts: true,
            weeklyReports: false,
          },
          ragApiUrl: process.env.FASTGPT_RAG_ENDPOINT || null,
          llmEndpoint: process.env.OPENAI_API_URL || null
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              domain: true,
              isActive: true,
            }
          }
        }
      })
      
      return NextResponse.json({ config: defaultConfig })
    }

    return NextResponse.json({ config: tenantConfig })

  } catch (error) {
    console.error('获取租户配置失败:', error)
    return NextResponse.json(
      { 
        error: '获取配置失败',
        details: error instanceof Error ? error.message : '未知错误'
      }, 
      { status: 500 }
    )
  }
}

/**
 * 更新当前租户的配置信息
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查用户权限 - 只有管理员可以修改租户配置
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ 
        error: '权限不足，只有管理员可以修改租户配置' 
      }, { status: 403 })
    }

    const updateData = await request.json()
    
    // 验证更新数据的结构
    const allowedFields = [
      'ragApiUrl', 
      'llmEndpoint', 
      'features', 
      'workflowSettings', 
      'uiCustomization', 
      'notificationSettings',
      'ragApiKey',
      'fallbackRagEndpoints',
      'knowledgeBaseIds',
      'defaultRagFilters',
      'ragTimeout',
      'ragRetryAttempts',
      'enableRagFallback'
    ]
    
    const filteredData: any = {}
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field]
      }
    }

    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json({ error: '没有有效的更新数据' }, { status: 400 })
    }

    // 更新租户配置
    const updatedConfig = await prisma.tenantConfig.upsert({
      where: { tenantId: session.user.tenantId },
      update: {
        ...filteredData,
        updatedAt: new Date(),
      },
      create: {
        tenantId: session.user.tenantId,
        ...filteredData,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
            isActive: true,
          }
        }
      }
    })

    // 记录配置更新日志
    console.log(`租户配置已更新: ${session.user.tenantId} by ${session.user.email}`)

    return NextResponse.json({ 
      config: updatedConfig,
      message: '配置更新成功'
    })

  } catch (error) {
    console.error('更新租户配置失败:', error)
    return NextResponse.json(
      { 
        error: '配置更新失败',
        details: error instanceof Error ? error.message : '未知错误'
      }, 
      { status: 500 }
    )
  }
}