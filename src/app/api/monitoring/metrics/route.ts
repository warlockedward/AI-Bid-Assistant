import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || undefined;
    const tenantId = searchParams.get('tenantId') || undefined;
    const since = searchParams.get('since') 
      ? new Date(searchParams.get('since')!) 
      : undefined;
    const limit = parseInt(searchParams.get('limit') || '1000');
    const aggregation = searchParams.get('aggregation') as 'sum' | 'avg' | 'min' | 'max' | 'count' | null;
    const groupBy = searchParams.get('groupBy') || undefined;

    logger.info('Metrics API request', {
      component: 'monitoring-api',
      operation: 'getMetrics',
      metadata: { name, tenantId, since, limit, aggregation, groupBy }
    });

    if (aggregation && name) {
      const aggregatedMetrics = metricsCollector.getAggregatedMetrics(
        name,
        aggregation,
        groupBy,
        since
      );

      return NextResponse.json({
        success: true,
        data: aggregatedMetrics,
        metadata: {
          name,
          aggregation,
          groupBy,
          since: since?.toISOString(),
          generatedAt: new Date().toISOString()
        }
      });
    }

    const metrics = metricsCollector.getMetrics(name, tenantId, since, limit);

    return NextResponse.json({
      success: true,
      data: metrics,
      metadata: {
        count: metrics.length,
        name,
        tenantId,
        since: since?.toISOString(),
        limit,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error retrieving metrics', {
      component: 'monitoring-api',
      operation: 'getMetrics'
    }, error as Error);

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve metrics',
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
    const { name, value, unit, tags = {} } = body;

    if (!name || value === undefined || !unit) {
      return NextResponse.json(
        { error: 'Missing required fields: name, value, unit' },
        { status: 400 }
      );
    }

    metricsCollector.recordCustomMetric(name, value, unit, tags);

    logger.info('Custom metric recorded', {
      component: 'monitoring-api',
      operation: 'recordCustomMetric',
      metadata: { name, value, unit, tags }
    });

    return NextResponse.json({
      success: true,
      message: 'Metric recorded successfully',
      data: { name, value, unit, tags, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Error recording custom metric', {
      component: 'monitoring-api',
      operation: 'recordCustomMetric'
    }, error as Error);

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to record metric',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}