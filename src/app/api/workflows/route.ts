import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateWorkflowList,
  authenticateWorkflowCreate,
  createApiResponse,
  createErrorResponse
} from '@/lib/workflow-auth-middleware';
import { withTenantIsolation } from '@/lib/database';
import { AgentManager } from '@/agents/agent-manager';
import { workflowStateManager } from '@/workflows/workflow-state';
import { workflowOrchestrator } from '@/workflows';
import { WorkflowStatus } from '@/types/workflow';



/**
 * GET /api/workflows - List workflows for the current tenant with enhanced filtering and status
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateWorkflowList(request);
    if (!auth.success) return auth.error!;
    
    const { session } = auth.data!;
    const { searchParams } = new URL(request.url);
    
    // Enhanced query parameters for workflow management
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100); // Cap at 100
    const status = searchParams.get('status') as WorkflowStatus | null;
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const includeProgress = searchParams.get('include_progress') === 'true';
    const includeErrors = searchParams.get('include_errors') === 'true';
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    // Get workflows from state manager with enhanced filtering
    const allWorkflows = workflowStateManager.getWorkflowsByTenant(session.user.tenantId);
    
    // Apply filters
    let filteredWorkflows = allWorkflows;
    
    // Filter by status
    if (status && Object.values(WorkflowStatus).includes(status)) {
      filteredWorkflows = filteredWorkflows.filter(workflow => workflow.status === status);
    }
    
    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredWorkflows = filteredWorkflows.filter(workflow => workflow.created_at >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      filteredWorkflows = filteredWorkflows.filter(workflow => workflow.created_at <= toDate);
    }

    // Sort workflows
    filteredWorkflows.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a];
      const bValue = b[sortBy as keyof typeof b];
      
      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : 1;
      }
      return aValue < bValue ? -1 : 1;
    });

    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedWorkflows = filteredWorkflows.slice(startIndex, endIndex);

    // Get enhanced workflow data with optional progress and error details
    const workflowsWithStatus = await Promise.all(
      paginatedWorkflows.map(async (workflow) => {
        const workflowData: any = {
          workflow_id: workflow.workflow_id,
          status: workflow.status,
          current_step: workflow.current_step,
          created_at: workflow.created_at,
          updated_at: workflow.updated_at,
          tenant_id: workflow.tenant_id,
          user_id: workflow.user_id,
          metadata: workflow.metadata,
          state_data: workflow.state_data
        };
        
        // Include progress if requested
        if (includeProgress) {
          try {
            workflowData.progress = await workflowOrchestrator.getWorkflowStatus(workflow.workflow_id);
          } catch (error) {
            workflowData.progress = null;
            workflowData.progress_error = 'Failed to get progress';
          }
        }
        
        // Include error details if requested and workflow has errors
        if (includeErrors && workflow.status === WorkflowStatus.FAILED) {
          workflowData.error_details = workflow.state_data?.error_info || null;
        }
        
        // Add computed fields
        workflowData.duration_ms = workflow.updated_at.getTime() - workflow.created_at.getTime();
        workflowData.is_active = [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED].includes(workflow.status);
        
        return workflowData;
      })
    );

    // Calculate summary statistics
    const summary = {
      total: allWorkflows.length,
      filtered: filteredWorkflows.length,
      by_status: {
        [WorkflowStatus.RUNNING]: allWorkflows.filter(w => w.status === WorkflowStatus.RUNNING).length,
        [WorkflowStatus.COMPLETED]: allWorkflows.filter(w => w.status === WorkflowStatus.COMPLETED).length,
        [WorkflowStatus.FAILED]: allWorkflows.filter(w => w.status === WorkflowStatus.FAILED).length,
        [WorkflowStatus.PAUSED]: allWorkflows.filter(w => w.status === WorkflowStatus.PAUSED).length,
        [WorkflowStatus.CANCELLED]: allWorkflows.filter(w => w.status === WorkflowStatus.CANCELLED).length,
        [WorkflowStatus.PENDING]: allWorkflows.filter(w => w.status === WorkflowStatus.PENDING).length
      }
    };

    return createApiResponse('success', {
      workflows: workflowsWithStatus,
      summary,
      pagination: {
        page,
        limit,
        total: filteredWorkflows.length,
        totalPages: Math.ceil(filteredWorkflows.length / limit),
        hasNext: endIndex < filteredWorkflows.length,
        hasPrev: page > 1
      },
      filters: {
        status,
        date_from: dateFrom,
        date_to: dateTo,
        include_progress: includeProgress,
        include_errors: includeErrors
      },
      tenant_id: session.user.tenantId
    });

  } catch (error) {
    console.error('Failed to list workflows:', error);
    return createErrorResponse(
      'Failed to list workflows',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * POST /api/workflows - Create a new workflow with enhanced validation and tenant isolation
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateWorkflowCreate(request);
    if (!auth.success) return auth.error!;
    
    const { session } = auth.data!;

    const body = await request.json();
    const { 
      bidProjectId, 
      workflowType = 'bid-document-generation',
      priority = 'normal',
      metadata = {},
      initialData = {}
    } = body;

    // Validate required fields
    if (!bidProjectId) {
      return createErrorResponse(
        'Missing required field',
        'bidProjectId is required',
        400
      );
    }

    // Validate workflow type
    const validWorkflowTypes = ['bid-document-generation', 'compliance-check', 'document-analysis'];
    if (!validWorkflowTypes.includes(workflowType)) {
      return createErrorResponse(
        'Invalid workflow type',
        `workflowType must be one of: ${validWorkflowTypes.join(', ')}`,
        400
      );
    }

    const db = withTenantIsolation(session.user.tenantId);

    // Verify project exists and belongs to current tenant
    const project = await db.bidProject.findUnique({
      where: { id: bidProjectId },
      include: { tenant: true }
    });

    if (!project) {
      return createErrorResponse(
        'Project not found',
        `Project ${bidProjectId} does not exist or does not belong to your tenant`,
        404
      );
    }

    // Check for existing active workflows for this project
    const existingWorkflows = workflowStateManager.getWorkflowsByTenant(session.user.tenantId)
      .filter(w => 
        w.state_data?.project_id === bidProjectId && 
        [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED].includes(w.status)
      );

    if (existingWorkflows.length > 0) {
      return createErrorResponse(
        'Workflow already exists',
        `An active workflow already exists for project ${bidProjectId}. Workflow ID: ${existingWorkflows[0].workflow_id}`,
        409,
        { existing_workflow_id: existingWorkflows[0].workflow_id }
      );
    }

    // Create agent manager with enhanced configuration
    const tenantSettings = (project.tenant.settings as Record<string, any>) || {};
    const agentManager = new AgentManager(
      session.user.tenantId,
      {
        ...tenantSettings,
        workflow_type: workflowType,
        priority,
        user_id: session.user.id
      }
    );

    // Execute workflow with enhanced metadata
    const workflowExecution = await agentManager.executeWorkflow(bidProjectId);

    return createApiResponse('success', {
      workflow_id: workflowExecution.id,
      execution_id: workflowExecution.id,
      project_id: bidProjectId,
      workflow_type: workflowType,
      status: workflowExecution.status,
      created_at: workflowExecution.startedAt,
      tenant_id: session.user.tenantId
    }, 'Workflow created successfully', 201);

  } catch (error) {
    console.error('Failed to create workflow:', error);
    return createErrorResponse(
      'Failed to create workflow',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}