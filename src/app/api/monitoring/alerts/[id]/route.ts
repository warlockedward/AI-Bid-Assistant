import { NextRequest, NextResponse } from 'next/server';
import { alertingSystem } from '@/lib/alerting';
import { logger } from '@/lib/logger';
import { getServerSession } from 'next-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alertId = params.id;
    const body = await request.json();
    const { action } = body;

    if (action !== 'resolve') {
      return NextResponse.json(
        { error: 'Invalid action. Only "resolve" is supported.' },
        { status: 400 }
      );
    }

    const resolved = alertingSystem.resolveAlert(alertId);

    if (!resolved) {
      return NextResponse.json(
        { error: 'Alert not found or already resolved' },
        { status: 404 }
      );
    }

    logger.info('Alert resolved via API', {
      component: 'monitoring-api',
      operation: 'resolveAlert',
      metadata: { alertId }
    });

    return NextResponse.json({
      success: true,
      message: 'Alert resolved successfully',
      data: { alertId, resolvedAt: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Error resolving alert', {
      component: 'monitoring-api',
      operation: 'resolveAlert',
      metadata: { alertId: params.id }
    }, error as Error);

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to resolve alert',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}