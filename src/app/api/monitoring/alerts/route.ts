import { NextRequest, NextResponse } from 'next/server';
import { alertingSystem, AlertSeverity } from '@/lib/alerting';
import { logger } from '@/lib/logger';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const severity = searchParams.get('severity') as AlertSeverity || undefined;
    const resolved = searchParams.get('resolved') === 'true' ? true : 
                    searchParams.get('resolved') === 'false' ? false : undefined;
    const limit = parseInt(searchParams.get('limit') || '100');

    logger.info('Alerts API request', {
      component: 'monitoring-api',
      operation: 'getAlerts',
      metadata: { tenantId, severity, resolved, limit }
    });

    const alerts = alertingSystem.getAlerts(tenantId, severity, resolved, limit);

    return NextResponse.json({
      success: true,
      data: alerts,
      metadata: {
        count: alerts.length,
        tenantId,
        severity,
        resolved,
        limit,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error retrieving alerts', {
      component: 'monitoring-api',
      operation: 'getAlerts'
    }, error as Error);

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve alerts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, severity, tenantId, workflowId, metadata = {} } = body;

    if (!title || !description || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, severity' },
        { status: 400 }
      );
    }

    if (!Object.values(AlertSeverity).includes(severity)) {
      return NextResponse.json(
        { error: 'Invalid severity level' },
        { status: 400 }
      );
    }

    const alertId = alertingSystem.createCustomAlert(
      title,
      description,
      severity,
      tenantId,
      workflowId,
      metadata
    );

    logger.info('Custom alert created via API', {
      component: 'monitoring-api',
      operation: 'createCustomAlert',
      metadata: { alertId, title, severity, tenantId, workflowId }
    });

    return NextResponse.json({
      success: true,
      message: 'Alert created successfully',
      data: { alertId, title, severity, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Error creating custom alert', {
      component: 'monitoring-api',
      operation: 'createCustomAlert'
    }, error as Error);

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create alert',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}