/**
 * Workflow API Authentication and Authorization Middleware
 * Provides comprehensive authentication and tenant validation for workflow endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, AuthUtils } from '@/lib/auth';
import { workflowStateManager } from '@/workflows/workflow-state';

export interface AuthenticatedRequest {
  session: {
    user: {
      id: string;
      email: string;
      name?: string | null;
      tenantId: string;
      role: string;
    };
    tenant?: {
      id: string;
      name: string;
      settings: Record<string, any>;
    };
  };
  workflowState?: any;
}

export interface AuthResult {
  success: boolean;
  data?: AuthenticatedRequest;
  error?: NextResponse;
}

/**
 * Base authentication middleware for all workflow endpoints
 */
export async function authenticateWorkflowRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return {
        success: false,
        error: NextResponse.json({ 
          error: 'Unauthorized',
          message: 'Authentication required'
        }, { status: 401 })
      };
    }

    if (!session.user.tenantId) {
      return {
        success: false,
        error: NextResponse.json({ 
          error: 'Tenant not found',
          message: 'User must be associated with a tenant'
        }, { status: 403 })
      };
    }

    // Validate tenant access
    const hasAccess = await AuthUtils.validateTenantAccess(session.user.id, session.user.tenantId);
    if (!hasAccess) {
      return {
        success: false,
        error: NextResponse.json({ 
          error: 'Access denied',
          message: 'Invalid tenant access'
        }, { status: 403 })
      };
    }

    return {
      success: true,
      data: { session }
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: NextResponse.json({ 
        error: 'Authentication failed',
        message: 'Internal authentication error'
      }, { status: 500 })
    };
  }
}

/**
 * Workflow-specific authentication with workflow access validation
 */
export async function authenticateWorkflowAccess(
  request: NextRequest, 
  workflowId: string
): Promise<AuthResult> {
  const baseAuth = await authenticateWorkflowRequest(request);
  if (!baseAuth.success) {
    return baseAuth;
  }

  try {
    // Verify workflow exists and belongs to tenant
    const workflowState = workflowStateManager.getWorkflowState(workflowId);
    if (!workflowState) {
      return {
        success: false,
        error: NextResponse.json({ 
          error: 'Workflow not found',
          message: `Workflow ${workflowId} does not exist`
        }, { status: 404 })
      };
    }

    if (workflowState.tenant_id !== baseAuth.data!.session.user.tenantId) {
      return {
        success: false,
        error: NextResponse.json({ 
          error: 'Access denied',
          message: 'Workflow does not belong to your tenant'
        }, { status: 403 })
      };
    }

    return {
      success: true,
      data: {
        ...baseAuth.data!,
        workflowState
      }
    };
  } catch (error) {
    console.error('Workflow access validation error:', error);
    return {
      success: false,
      error: NextResponse.json({ 
        error: 'Workflow access validation failed',
        message: 'Internal validation error'
      }, { status: 500 })
    };
  }
}

/**
 * Permission-based authorization middleware
 */
export async function authorizeWorkflowAction(
  session: AuthenticatedRequest['session'],
  resource: string,
  action: string
): Promise<{ success: boolean; error?: NextResponse }> {
  try {
    const hasPermission = await AuthUtils.hasPermission(session.user.id, resource, action);
    
    if (!hasPermission) {
      return {
        success: false,
        error: NextResponse.json({ 
          error: 'Insufficient permissions',
          message: `Permission denied for ${action} on ${resource}`
        }, { status: 403 })
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Authorization error:', error);
    return {
      success: false,
      error: NextResponse.json({ 
        error: 'Authorization failed',
        message: 'Internal authorization error'
      }, { status: 500 })
    };
  }
}

/**
 * Combined authentication and authorization middleware
 */
export async function authenticateAndAuthorize(
  request: NextRequest,
  resource: string,
  action: string,
  workflowId?: string
): Promise<AuthResult> {
  // Authenticate request
  const auth = workflowId 
    ? await authenticateWorkflowAccess(request, workflowId)
    : await authenticateWorkflowRequest(request);
  
  if (!auth.success) {
    return auth;
  }

  // Authorize action
  const authz = await authorizeWorkflowAction(auth.data!.session, resource, action);
  if (!authz.success) {
    return {
      success: false,
      error: authz.error
    };
  }

  return auth;
}

/**
 * Middleware for workflow listing endpoints
 */
export async function authenticateWorkflowList(request: NextRequest): Promise<AuthResult> {
  return authenticateAndAuthorize(request, 'workflows', 'read');
}

/**
 * Middleware for workflow creation endpoints
 */
export async function authenticateWorkflowCreate(request: NextRequest): Promise<AuthResult> {
  return authenticateAndAuthorize(request, 'workflows', 'create');
}

/**
 * Middleware for workflow execution endpoints
 */
export async function authenticateWorkflowExecute(request: NextRequest): Promise<AuthResult> {
  return authenticateAndAuthorize(request, 'workflows', 'execute');
}

/**
 * Middleware for workflow read endpoints
 */
export async function authenticateWorkflowRead(request: NextRequest, workflowId: string): Promise<AuthResult> {
  return authenticateAndAuthorize(request, 'workflows', 'read', workflowId);
}

/**
 * Middleware for workflow update endpoints
 */
export async function authenticateWorkflowUpdate(request: NextRequest, workflowId: string): Promise<AuthResult> {
  return authenticateAndAuthorize(request, 'workflows', 'update', workflowId);
}

/**
 * Middleware for workflow delete endpoints
 */
export async function authenticateWorkflowDelete(request: NextRequest, workflowId: string): Promise<AuthResult> {
  return authenticateAndAuthorize(request, 'workflows', 'delete', workflowId);
}

/**
 * Utility function to create standardized API responses
 */
export function createApiResponse(
  status: 'success' | 'error',
  data?: any,
  message?: string,
  statusCode: number = 200
): NextResponse {
  const response = {
    status,
    ...(data && { data }),
    ...(message && { message }),
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Utility function to create error responses
 */
export function createErrorResponse(
  error: string,
  message?: string,
  statusCode: number = 500,
  details?: any
): NextResponse {
  const response = {
    status: 'error',
    error,
    ...(message && { message }),
    ...(details && { details }),
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(response, { status: statusCode });
}