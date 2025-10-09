import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * 配置API - 获取系统配置
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 从环境变量构建配置（不包含敏感信息）
    const config = {
      openai: {
        apiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
        defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4',
        availableModels: (process.env.OPENAI_AVAILABLE_MODELS || 'gpt-4,gpt-4-turbo,gpt-3.5-turbo,gpt-4o').split(','),
        apiKeyConfigured: !!process.env.OPENAI_API_KEY,
        temperature: 0.1,
        timeout: 600,
        maxTokens: 4000
      },
      vllm: {
        apiUrl: process.env.VLLM_API_URL || 'http://localhost:8000',
        defaultModel: process.env.VLLM_DEFAULT_MODEL || 'llama-2-7b-chat',
        availableModels: (process.env.VLLM_AVAILABLE_MODELS || 'llama-2-7b-chat,llama-2-13b-chat,codellama-7b-instruct').split(','),
        apiKeyConfigured: !!process.env.VLLM_API_KEY,
        temperature: 0.1,
        timeout: 120,
        maxTokens: 2000
      },
      fastgpt: {
        apiUrl: process.env.FASTGPT_API_URL || 'http://localhost:3000',
        apiKeyConfigured: !!process.env.FASTGPT_API_KEY,
        timeout: 30
      },
      workflow: {
        maxRounds: parseInt(process.env.WORKFLOW_MAX_ROUNDS || '20'),
        timeoutSeconds: parseInt(process.env.WORKFLOW_TIMEOUT_SECONDS || '3600'),
        retryAttempts: parseInt(process.env.WORKFLOW_RETRY_ATTEMPTS || '3')
      },
      tenant: {
        maxAgentsPerTenant: parseInt(process.env.MAX_AGENTS_PER_TENANT || '10'),
        maxConcurrentWorkflows: parseInt(process.env.MAX_CONCURRENT_WORKFLOWS || '5')
      }
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 配置API - 更新系统配置
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户权限（只有管理员可以更新配置）
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    // 这里应该实现配置更新逻辑
    // 在生产环境中，可能需要更新数据库中的租户配置
    // 或者通过其他方式持久化配置更改
    
    console.log('Configuration update requested:', body);
    
    // 返回成功响应
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}