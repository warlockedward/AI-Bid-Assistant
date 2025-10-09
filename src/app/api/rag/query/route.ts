/**
 * RAG query API endpoint.
 * Provides direct access to tenant-aware RAG service for testing and debugging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantRAGService } from '@/services/tenant-rag-service';
import { TenantContext } from '@/tenants/tenant-context';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    
    if (!body.query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const ragQuery = {
      query: body.query,
      context: body.context || {},
      filters: body.filters || {},
      maxResults: body.maxResults || 10,
      minRelevanceScore: body.minRelevanceScore || 0.3
    };

    const result = await tenantRAGService.query(tenantContext, ragQuery);

    return NextResponse.json({
      success: true,
      data: result,
      tenant_id: tenantId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('RAG query failed:', error);
    return NextResponse.json(
      { 
        error: 'RAG query failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}