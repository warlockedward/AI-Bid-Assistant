import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, AuthUtils } from '@/lib/auth';
import { workflowOrchestrator } from '@/workflows';
import { WorkflowDefinition, WorkflowStep } from '@/types/workflow';
import { TenantContext } from '@/types/tenant';
import { simulateAgentWorkflow } from '@/lib/workflow-websocket-bridge';

/**
 * Authentication middleware for workflow start endpoint
 */
async function authenticateAndValidateWorkflowStart(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!session.user.tenantId) {
    return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 403 }) };
  }

  // Validate tenant access
  const hasAccess = await AuthUtils.validateTenantAccess(session.user.id, session.user.tenantId);
  if (!hasAccess) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }

  // Check workflow execution permission
  const hasPermission = await AuthUtils.hasPermission(session.user.id, 'workflows', 'execute');
  if (!hasPermission) {
    return { error: NextResponse.json({ error: 'Insufficient permissions to execute workflows' }, { status: 403 }) };
  }

  return { session };
}

/**
 * POST /api/workflows/start - Start a new workflow execution
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAndValidateWorkflowStart(request);
    if (auth.error) return auth.error;
    
    const { session } = auth;

    const body = await request.json();
    const { 
      projectId, 
      tenantId, 
      sections, 
      workflowType = 'bid-document-generation',
      // 新增模型配置参数
      modelProvider,
      modelName,
      // Legacy support
      project_id, 
      tender_document, 
      requirements, 
      workflow_type = 'bid_generation' 
    } = body;

    // Create tenant context
    const tenantContext: TenantContext = {
      tenant_id: tenantId || session.user.tenantId,
      user_id: session.user.id,
      sso_provider: '',
      sso_id: '',
      preferences: {},
      permissions: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    // Define workflow steps based on type
    let workflowSteps: WorkflowStep[] = [];
    
    if (workflowType === 'bid-document-generation' && sections) {
      // New bid document workflow
      workflowSteps = [
        {
          id: 'analysis',
          name: 'Tender Analysis',
          description: 'Analyze tender requirements and constraints',
          agent_type: 'tender_analysis',
          input_schema: { sections: 'array', project_id: 'string' },
          output_schema: { requirements: 'array', analysis: 'object' },
          timeout_seconds: 300,
          retry_count: 3,
          dependencies: [],
          is_checkpoint: true
        },
        {
          id: 'knowledge',
          name: 'Knowledge Retrieval',
          description: 'Gathering relevant industry knowledge and best practices',
          agent_type: 'knowledge_retrieval',
          input_schema: { query: 'string', context: 'object' },
          output_schema: { knowledge_base: 'array' },
          timeout_seconds: 180,
          retry_count: 3,
          dependencies: ['analysis'],
          is_checkpoint: true
        }
      ];

      // Add generation steps for each section
      sections.forEach((sectionId: string, index: number) => {
        workflowSteps.push({
          id: `generate-${sectionId}`,
          name: `Generate ${sectionId}`,
          description: `Creating content for ${sectionId}`,
          agent_type: 'content_generation',
          input_schema: { section: 'string', requirements: 'array', knowledge_base: 'array' },
          output_schema: { generated_content: 'object' },
          timeout_seconds: 600,
          retry_count: 2,
          dependencies: ['analysis', 'knowledge'],
          is_checkpoint: true
        });
      });

      // Add compliance verification
      workflowSteps.push({
        id: 'compliance',
        name: 'Compliance Verification',
        description: 'Verifying document compliance and quality',
        agent_type: 'compliance_verification',
        input_schema: { generated_content: 'array', requirements: 'array' },
        output_schema: { compliance_report: 'object', verified_content: 'object' },
        timeout_seconds: 240,
        retry_count: 2,
        dependencies: sections.map((s: string) => `generate-${s}`),
        is_checkpoint: true
      });
    } else {
      // Legacy workflow
      workflowSteps = [
        {
          id: 'tender_analysis',
          name: 'Tender Document Analysis',
          description: 'Analyze tender document to extract requirements and key information',
          agent_type: 'tender_analysis',
          input_schema: { tender_document: 'string', project_id: 'string' },
          output_schema: { requirements: 'array', analysis: 'object' },
          timeout_seconds: 300,
          retry_count: 3,
          dependencies: [],
          is_checkpoint: true
        },
        {
          id: 'knowledge_retrieval',
          name: 'Knowledge Retrieval',
          description: 'Retrieve relevant knowledge and best practices',
          agent_type: 'knowledge_retrieval',
          input_schema: { query: 'string', context: 'object' },
          output_schema: { knowledge_base: 'array' },
          timeout_seconds: 180,
          retry_count: 3,
          dependencies: ['tender_analysis'],
          is_checkpoint: true
        },
        {
          id: 'content_generation',
          name: 'Content Generation',
          description: 'Generate bid document sections based on requirements and knowledge',
          agent_type: 'content_generation',
          input_schema: { section: 'string', requirements: 'array', knowledge_base: 'array' },
          output_schema: { generated_content: 'object' },
          timeout_seconds: 600,
          retry_count: 2,
          dependencies: ['tender_analysis', 'knowledge_retrieval'],
          is_checkpoint: true
        },
        {
          id: 'compliance_verification',
          name: 'Compliance Verification',
          description: 'Verify generated content meets compliance requirements',
          agent_type: 'compliance_verification',
          input_schema: { generated_content: 'array', requirements: 'array', compliance_rules: 'array' },
          output_schema: { compliance_report: 'object', verified_content: 'object' },
          timeout_seconds: 240,
          retry_count: 2,
          dependencies: ['content_generation'],
          is_checkpoint: true
        }
      ];
    }

    // Create workflow definition
    const workflowDefinition: WorkflowDefinition = {
      id: `${workflowType || workflow_type}_${Date.now()}`,
      name: `Bid Generation Workflow - ${projectId || project_id}`,
      description: 'Complete bid document generation workflow with analysis, knowledge retrieval, content generation, and compliance verification',
      version: '1.0.0',
      steps: workflowSteps,
      tenant_id: tenantContext.tenant_id,
      created_by: tenantContext.user_id,
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
      metadata: {
        category: 'bid-generation',
        tags: ['ai-assisted', 'document-generation'],
        estimated_duration_minutes: 20,
        complexity: 'medium'
      }
    };

    // Prepare initial workflow data
    const initialData = {
      project_id: projectId || project_id,
      sections: sections || [],
      tender_document,
      requirements: requirements || [],
      workflow_type: workflowType || workflow_type,
      tenant_settings: {
        llm_config: {
          model: modelName || process.env.OPENAI_MODEL || 'gpt-4',
          provider: modelProvider || 'openai',
          api_key: process.env.OPENAI_API_KEY || '',
          temperature: 0.7,
        },
        fastgpt_config: {
          api_url: process.env.FASTGPT_API_URL || '',
          api_key: process.env.FASTGPT_API_KEY || '',
        },
      }
    };

    // Start workflow execution
    const workflowExecution = await workflowOrchestrator.startWorkflow(
      workflowDefinition,
      tenantContext,
      initialData
    );

    const workflowId = workflowExecution.workflow_state.workflow_id;

    // Start WebSocket simulation for real-time updates
    setTimeout(() => {
      simulateAgentWorkflow(workflowId, {
        projectId: projectId || project_id,
        workflowType: workflowType || workflow_type,
        tenantId: tenantContext.tenant_id,
        modelProvider: modelProvider,
        modelName: modelName
      });
    }, 2000);

    return NextResponse.json({
      status: 'success',
      workflow_id: workflowId,
      execution_id: workflowExecution.id,
      message: 'Workflow started successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to start workflow:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}