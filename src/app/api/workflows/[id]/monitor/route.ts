import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { workflowStateManager } from '@/workflows/workflow-state';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflowId = params.id;
    const url = new URL(request.url);
    const stream = url.searchParams.get('stream') === 'true';

    // Verify workflow exists and belongs to tenant
    const workflowState = workflowStateManager.getWorkflowState(workflowId);
    if (!workflowState) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflowState.tenant_id !== session.user.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!stream) {
      // Return current monitoring data with mock progress for bid document workflow
      const mockProgress = generateMockProgress(workflowId, workflowState);
      
      return NextResponse.json(mockProgress);
    }

    // Set up Server-Sent Events for real-time monitoring
    const encoder = new TextEncoder();
    
    const stream_response = new ReadableStream({
      start(controller) {
        // Send initial state
        const initialData = {
          type: 'workflow_status',
          data: {
            workflow_id: workflowId,
            status: workflowState.status,
            current_step: workflowState.current_step,
            last_updated: workflowState.updated_at,
            timestamp: new Date().toISOString()
          }
        };
        
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`)
        );

        // Subscribe to workflow state changes
        const unsubscribe = workflowStateManager.subscribe(workflowId, (updatedState) => {
          const updateData = {
            type: 'workflow_update',
            data: {
              workflow_id: workflowId,
              status: updatedState.status,
              current_step: updatedState.current_step,
              last_updated: updatedState.updated_at,
              state_data: updatedState.state_data,
              timestamp: new Date().toISOString()
            }
          };

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`)
            );
          } catch (error) {
            console.error('Error sending workflow update:', error);
            unsubscribe();
            controller.close();
          }
        });

        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = {
              type: 'heartbeat',
              data: {
                workflow_id: workflowId,
                timestamp: new Date().toISOString()
              }
            };
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`)
            );
          } catch (error) {
            console.error('Error sending heartbeat:', error);
            clearInterval(heartbeatInterval);
            unsubscribe();
            controller.close();
          }
        }, 30000);

        // Clean up on close
        return () => {
          clearInterval(heartbeatInterval);
          unsubscribe();
        };
      },
      
      cancel() {
        console.log('Workflow monitoring stream cancelled for:', workflowId);
      }
    });

    return new Response(stream_response, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('Workflow monitoring failed:', error);
    return NextResponse.json({ 
      error: 'Workflow monitoring failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Generate mock progress data for bid document workflow
function generateMockProgress(workflowId: string, workflowState: any) {
  const now = Date.now();
  const startTime = workflowState.created_at.getTime();
  const elapsed = now - startTime;
  
  // Simulate workflow progress based on elapsed time
  let currentStep = 'analysis';
  let completedSteps = 0;
  let totalSteps = 7; // analysis, knowledge, 4 sections, compliance
  let progressPercentage = 0;
  
  if (elapsed > 5000) { // 5 seconds
    currentStep = 'knowledge';
    completedSteps = 1;
    progressPercentage = 15;
  }
  
  if (elapsed > 10000) { // 10 seconds
    currentStep = 'generate-executive-summary';
    completedSteps = 2;
    progressPercentage = 30;
  }
  
  if (elapsed > 15000) { // 15 seconds
    currentStep = 'generate-technical-approach';
    completedSteps = 3;
    progressPercentage = 45;
  }
  
  if (elapsed > 20000) { // 20 seconds
    currentStep = 'generate-project-timeline';
    completedSteps = 4;
    progressPercentage = 60;
  }
  
  if (elapsed > 25000) { // 25 seconds
    currentStep = 'generate-team-qualifications';
    completedSteps = 5;
    progressPercentage = 75;
  }
  
  if (elapsed > 30000) { // 30 seconds
    currentStep = 'compliance';
    completedSteps = 6;
    progressPercentage = 90;
  }
  
  if (elapsed > 35000) { // 35 seconds
    currentStep = 'completed';
    completedSteps = 7;
    progressPercentage = 100;
  }

  const status = progressPercentage === 100 ? 'completed' : 'running';
  const estimatedRemainingTime = progressPercentage === 100 ? 0 : (40000 - elapsed); // 40 seconds total

  return {
    workflow_id: workflowId,
    status: status,
    current_step: currentStep,
    total_steps: totalSteps,
    completed_steps: completedSteps,
    progress_percentage: progressPercentage,
    estimated_remaining_time: estimatedRemainingTime,
    last_updated: new Date(),
    tenant_id: workflowState.tenant_id,
    user_id: workflowState.user_id
  };
}