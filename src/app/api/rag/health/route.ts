/**
 * RAG service health check API endpoint.
 * Provides health status for tenant-specific RAG endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantRAGService } from '@/services/tenant-rag-service';
import { TenantContext } from '@/tenants/tenant-context';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('X-Tenant-ID');
    const userId = request.headers.get('X-User-ID');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing tenant context headers' },
        { status: 400 }
      );
    }

    const tenantContext: TenantContext = {
      tenant_id: tenantId,
      user_id: userId,
      user_email: request.headers.get('X-User-Email') || '',
      user_name: request.headers.get('X-User-Name') || '',
      tenant_name: request.headers.get('X-Tenant-Name') || '',
      permissions: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    const healthStatus = await tenantRAGService.getHealthStatus(tenantContext);

    return NextResponse.json({
      status: healthStatus.status,
      endpoints: healthStatus.endpoints,
      timestamp: new Date().toISOString(),
      tenant_id: tenantId
    });

  } catch (error) {
    console.error('RAG health check failed:', error);
    return NextResponse.json(
      { 
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}