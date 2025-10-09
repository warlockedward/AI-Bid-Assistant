/**
 * Integration tests for agent-workflow integration
 * Tests the integration between AgentCoordinator and WorkflowOrchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { agentCoordinator, AgentCoordinator } from '../agents/agent-coordinator';
import { workflowOrchestrator } from '../workflows/workflow-orchestrator';
import { workflowStateManager } from '../workflows/workflow-state';
import { checkpointManager } from '../workflows/checkpoint-manager';
import { TenantContext } from '../types/tenant';
import { WorkflowDefinition, WorkflowStep, WorkflowStatus, ErrorSeverity } from '../types/workflow';

// Mock the python API
vi.mock('../lib/python-api', () => ({
  pythonAPI: {
    analyzeTenderDocument: vi.fn(),
    retrieveKnowledge: vi.fn(),
    generateContent: vi.fn(),
    verifyCompliance: vi.fn()
  }
}));

describe('Agent-Workflow Integration', () => {
  let testTenantContext: TenantContext;
  let testWorkflowDefinition: WorkflowDefinition;

  beforeEach(() => {
    // Setup test tenant context
    testTenantContext = {
      tenant_id: 'test-tenant-123',
      user_id: 'test-user-456',
      sso_provider: 'test-sso',
      sso_id: 'test-sso-id',
      preferences: {},
      permissions: ['workflow:execute', 'agent:use'],
      created_at: new Date(),
      updated_at: new Date()
    };

    // Setup test workflow definition
    testWorkflowDefinition = {
      id: 'test-workflow-def',
      name: 'Test Bid Generation Workflow',
      description: 'Test workflow for bid document generation',
      version: '1.0.0',
      steps: [
        {
          id: 'tender_analysis',
          name: 'Analyze Tender Document',
          description: 'Extract requirements from tender document',
          agent_type: 'tender_analysis',
          input_schema: { tender_document: 'string' },
          output_schema: { requirements: 'array' },
          timeout_seconds: 300,
          retry_count: 3,
          dependencies: [],
          is_checkpoint: true
        },
        {
          id: 'knowledge_retrieval',
          name: 'Retrieve Knowledge',
          description: 'Get relevant knowledge for bid preparation',
          agent_type: 'knowledge_retrieval',
          input_schema: { query: 'string' },
          output_schema: { knowledge_base: 'array' },
          timeout_seconds: 180,
          retry_count: 2,
          dependencies: ['tender_analysis'],
          is_checkpoint: true
        }
      ],
      tenant_id: testTenantContext.tenant_id,
      created_by: testTenantContext.user_id,
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true
    };

    // Clear any existing state
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    vi.restoreAllMocks();
  });

  describe('AgentCoordinator Integration', () => {
    it('should execute agent with automatic checkpointing', async () => {
      // Mock successful agent execution
      const { pythonAPI } = await import('../lib/python-api');
      vi.mocked(pythonAPI.analyzeTenderDocument).mockResolvedValue({
        output: {
          requirements: ['Technical requirement 1', 'Commercial requirement 2'],
          analysis_summary: 'Test analysis completed'
        }
      });

      // Mock checkpoint manager
      const saveCheckpointSpy = vi.spyOn(checkpointManager, 'saveCheckpoint').mockResolvedValue({
        id: 'checkpoint-123',
        workflow_id: 'test-workflow',
        step_id: 'tender_analysis',
        checkpoint_data: {},
        created_at: new Date(),
        is_recoverable: true
      });

      // Execute agent
      const executionContext = {
        tenantContext: testTenantContext,
        workflowId: 'test-workflow',
        stepId: 'tender_analysis',
        agentType: 'tender_analysis',
        inputData: {
          tender_document: 'Test tender document content',
          project_id: 'test-project-123'
        },
        checkpointData: {},
        timeoutSeconds: 300
      };

      const response = await agentCoordinator.executeAgent(executionContext);

      // Verify successful execution
      expect(response.success).toBe(true);
      expect(response.output_data).toEqual({
        requirements: ['Technical requirement 1', 'Commercial requirement 2'],
        analysis_summary: 'Test analysis completed'
      });
      expect(response.execution_time_ms).toBeGreaterThan(0);

      // Verify checkpoints were created (pre and post execution)
      expect(saveCheckpointSpy).toHaveBeenCalledTimes(2);
      expect(saveCheckpointSpy).toHaveBeenCalledWith(
        'test-workflow',
        'tender_analysis_pre',
        expect.objectContaining({
          checkpoint_type: 'pre_execution',
          agent_type: 'tender_analysis'
        }),
        testTenantContext
      );
      expect(saveCheckpointSpy).toHaveBeenCalledWith(
        'test-workflow',
        'tender_analysis_post',
        expect.objectContaining({
          checkpoint_type: 'post_execution',
          agent_type: 'tender_analysis'
        }),
        testTenantContext
      );
    });

    it('should handle agent execution errors with tenant-specific recovery', async () => {
      // Mock agent failure
      const { pythonAPI } = await import('../lib/python-api');
      vi.mocked(pythonAPI.analyzeTenderDocument).mockRejectedValue(
        new Error('Network timeout during analysis')
      );

      // Mock checkpoint manager
      const saveCheckpointSpy = vi.spyOn(checkpointManager, 'saveCheckpoint').mockResolvedValue({
        id: 'error-checkpoint-123',
        workflow_id: 'test-workflow',
        step_id: 'tender_analysis_error',
        checkpoint_data: {},
        created_at: new Date(),
        is_recoverable: true
      });

      // Configure tenant-specific recovery strategy
      agentCoordinator.setTenantRecoveryStrategy(testTenantContext.tenant_id, {
        tenantId: testTenantContext.tenant_id,
        maxRetries: 2,
        retryDelays: [500, 1000],
        fallbackActions: ['Use cached analysis', 'Request manual review'],
        escalationThreshold: 3,
        notificationSettings: {
          email: 'admin@test-tenant.com'
        }
      });

      const executionContext = {
        tenantContext: testTenantContext,
        workflowId: 'test-workflow',
        stepId: 'tender_analysis',
        agentType: 'tender_analysis',
        inputData: {
          tender_document: 'Test tender document content'
        },
        checkpointData: {},
        timeoutSeconds: 300
      };

      const response = await agentCoordinator.executeAgent(executionContext);

      // Verify error handling
      expect(response.success).toBe(false);
      expect(response.error_info).toBeDefined();
      expect(response.error_info?.message).toContain('Network timeout during analysis');
      expect(response.error_info?.severity).toBe(ErrorSeverity.RETRY_REQUIRED);
      expect(response.error_info?.recovery_suggestions).toContain('Use cached analysis');
      expect(response.error_info?.recovery_suggestions).toContain('Request manual review');

      // Verify error checkpoint was created
      expect(saveCheckpointSpy).toHaveBeenCalledWith(
        'test-workflow',
        'tender_analysis_error',
        expect.objectContaining({
          checkpoint_type: 'error',
          error_message: 'Network timeout during analysis'
        }),
        testTenantContext
      );
    });

    it('should retry failed agent executions with exponential backoff', async () => {
      // Mock agent to fail twice then succeed
      const { pythonAPI } = await import('../lib/python-api');
      let callCount = 0;
      vi.mocked(pythonAPI.analyzeTenderDocument).mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary service unavailable'));
        }
        return Promise.resolve({
          output: { requirements: ['Requirement after retry'] }
        });
      });

      const executionContext = {
        tenantContext: testTenantContext,
        workflowId: 'test-workflow',
        stepId: 'tender_analysis',
        agentType: 'tender_analysis',
        inputData: {
          tender_document: 'Test tender document content'
        },
        checkpointData: {},
        timeoutSeconds: 300
      };

      const startTime = Date.now();
      const response = await agentCoordinator.executeAgent(executionContext);
      const executionTime = Date.now() - startTime;

      // Verify successful execution after retries
      expect(response.success).toBe(true);
      expect(response.output_data.requirements).toEqual(['Requirement after retry']);
      
      // Verify retries occurred (should take at least 1000ms + 2000ms for delays)
      expect(executionTime).toBeGreaterThan(3000);
      expect(callCount).toBe(3);
    });
  });

  describe('Workflow Orchestrator Integration', () => {
    it('should execute workflow using AgentCoordinator', async () => {
      // Mock successful agent executions
      const { pythonAPI } = await import('../lib/python-api');
      vi.mocked(pythonAPI.analyzeTenderDocument).mockResolvedValue({
        output: { requirements: ['Tech req 1', 'Commercial req 2'] }
      });
      vi.mocked(pythonAPI.retrieveKnowledge).mockResolvedValue({
        output: { knowledge_base: ['Knowledge item 1', 'Knowledge item 2'] }
      });

      // Mock workflow state manager
      const createWorkflowStateSpy = vi.spyOn(workflowStateManager, 'createWorkflowState').mockReturnValue({
        workflow_id: 'test-workflow',
        tenant_id: testTenantContext.tenant_id,
        user_id: testTenantContext.user_id,
        current_step: 'tender_analysis',
        state_data: {},
        created_at: new Date(),
        updated_at: new Date(),
        status: WorkflowStatus.PENDING,
        metadata: {
          name: 'Test Workflow',
          version: '1.0.0',
          priority: 'normal' as any,
          tags: []
        }
      });

      const getWorkflowStateSpy = vi.spyOn(workflowStateManager, 'getWorkflowState').mockReturnValue({
        workflow_id: 'test-workflow',
        tenant_id: testTenantContext.tenant_id,
        user_id: testTenantContext.user_id,
        current_step: 'tender_analysis',
        state_data: {},
        created_at: new Date(),
        updated_at: new Date(),
        status: WorkflowStatus.RUNNING,
        metadata: {
          name: 'Test Workflow',
          version: '1.0.0',
          priority: 'normal' as any,
          tags: []
        }
      });

      const updateWorkflowStepSpy = vi.spyOn(workflowStateManager, 'updateWorkflowStep').mockImplementation(() => {});

      // Start workflow execution
      const execution = await workflowOrchestrator.startWorkflow(
        testWorkflowDefinition,
        testTenantContext,
        { tender_document: 'Test document content' }
      );

      // Verify workflow was created
      expect(execution).toBeDefined();
      expect(execution.workflow_state.tenant_id).toBe(testTenantContext.tenant_id);
      expect(createWorkflowStateSpy).toHaveBeenCalled();

      // Allow some time for async execution
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify agents were called through coordinator
      expect(pythonAPI.analyzeTenderDocument).toHaveBeenCalledWith({
        filename: 'document.pdf',
        content: 'Test document content',
        project_id: '',
        tenant_id: testTenantContext.tenant_id
      });
    });

    it('should handle workflow recovery using checkpoints', async () => {
      // Mock checkpoint data
      const mockCheckpoint = {
        id: 'recovery-checkpoint',
        workflow_id: 'failed-workflow',
        step_id: 'knowledge_retrieval',
        checkpoint_data: {
          requirements: ['Recovered requirement 1'],
          analysis_summary: 'Recovered analysis'
        },
        created_at: new Date(),
        is_recoverable: true
      };

      // Mock workflow state for recovery
      const mockWorkflowState = {
        workflow_id: 'failed-workflow',
        tenant_id: testTenantContext.tenant_id,
        user_id: testTenantContext.user_id,
        current_step: 'tender_analysis',
        state_data: {},
        created_at: new Date(),
        updated_at: new Date(),
        status: WorkflowStatus.FAILED,
        metadata: {
          name: 'Failed Workflow',
          version: '1.0.0',
          priority: 'normal' as any,
          tags: []
        }
      };

      // Mock checkpoint manager methods
      vi.spyOn(checkpointManager, 'loadCheckpointsFromBackend').mockResolvedValue();
      vi.spyOn(checkpointManager, 'getLatestCheckpoint').mockResolvedValue(mockCheckpoint);
      vi.spyOn(workflowStateManager, 'getWorkflowState').mockReturnValue(mockWorkflowState);
      vi.spyOn(workflowStateManager, 'updateWorkflowState').mockImplementation(() => {});

      // Recover workflow
      const recoveredExecution = await workflowOrchestrator.recoverWorkflow('failed-workflow');

      // Verify recovery
      expect(recoveredExecution).toBeDefined();
      expect(recoveredExecution.workflow_state.workflow_id).toBe('failed-workflow');
      
      // Verify checkpoint was loaded
      expect(checkpointManager.loadCheckpointsFromBackend).toHaveBeenCalledWith(
        'failed-workflow',
        testTenantContext
      );
      expect(checkpointManager.getLatestCheckpoint).toHaveBeenCalledWith('failed-workflow');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should classify errors correctly based on type', async () => {
      const testCases = [
        {
          error: new Error('Authentication failed'),
          expectedSeverity: ErrorSeverity.CRITICAL
        },
        {
          error: new Error('Invalid input format'),
          expectedSeverity: ErrorSeverity.USER_INPUT_NEEDED
        },
        {
          error: new Error('Network timeout occurred'),
          expectedSeverity: ErrorSeverity.RETRY_REQUIRED
        },
        {
          error: new Error('General processing error'),
          expectedSeverity: ErrorSeverity.RECOVERABLE
        }
      ];

      for (const testCase of testCases) {
        // Mock agent to throw specific error
        const { pythonAPI } = await import('../lib/python-api');
        vi.mocked(pythonAPI.analyzeTenderDocument).mockRejectedValue(testCase.error);

        const executionContext = {
          tenantContext: testTenantContext,
          workflowId: 'test-workflow',
          stepId: 'tender_analysis',
          agentType: 'tender_analysis',
          inputData: { tender_document: 'Test content' },
          checkpointData: {},
          timeoutSeconds: 300
        };

        const response = await agentCoordinator.executeAgent(executionContext);

        expect(response.success).toBe(false);
        expect(response.error_info?.severity).toBe(testCase.expectedSeverity);
      }
    });

    it('should generate appropriate recovery suggestions', async () => {
      // Mock timeout error
      const { pythonAPI } = await import('../lib/python-api');
      vi.mocked(pythonAPI.analyzeTenderDocument).mockRejectedValue(
        new Error('Request timeout after 30 seconds')
      );

      const executionContext = {
        tenantContext: testTenantContext,
        workflowId: 'test-workflow',
        stepId: 'tender_analysis',
        agentType: 'tender_analysis',
        inputData: { tender_document: 'Test content' },
        checkpointData: {},
        timeoutSeconds: 300
      };

      const response = await agentCoordinator.executeAgent(executionContext);

      expect(response.success).toBe(false);
      expect(response.error_info?.recovery_suggestions).toContain('Increase timeout duration');
      expect(response.error_info?.recovery_suggestions).toContain('Check network connectivity');
    });
  });

  describe('Tenant Isolation', () => {
    it('should maintain tenant isolation in agent execution', async () => {
      // Mock successful execution
      const { pythonAPI } = await import('../lib/python-api');
      vi.mocked(pythonAPI.analyzeTenderDocument).mockResolvedValue({
        output: { requirements: ['Tenant-specific requirement'] }
      });

      const executionContext = {
        tenantContext: testTenantContext,
        workflowId: 'test-workflow',
        stepId: 'tender_analysis',
        agentType: 'tender_analysis',
        inputData: { tender_document: 'Test content' },
        checkpointData: {},
        timeoutSeconds: 300
      };

      await agentCoordinator.executeAgent(executionContext);

      // Verify tenant ID was passed to agent
      expect(pythonAPI.analyzeTenderDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: testTenantContext.tenant_id
        })
      );
    });

    it('should use tenant-specific recovery strategies', async () => {
      // Configure different recovery strategies for different tenants
      const tenant1Strategy = {
        tenantId: 'tenant-1',
        maxRetries: 5,
        retryDelays: [100, 200, 400],
        fallbackActions: ['Use tenant-1 fallback'],
        escalationThreshold: 3,
        notificationSettings: { email: 'tenant1@example.com' }
      };

      const tenant2Strategy = {
        tenantId: 'tenant-2',
        maxRetries: 2,
        retryDelays: [1000, 2000],
        fallbackActions: ['Use tenant-2 fallback'],
        escalationThreshold: 1,
        notificationSettings: { email: 'tenant2@example.com' }
      };

      agentCoordinator.setTenantRecoveryStrategy('tenant-1', tenant1Strategy);
      agentCoordinator.setTenantRecoveryStrategy('tenant-2', tenant2Strategy);

      // Mock agent failure
      const { pythonAPI } = await import('../lib/python-api');
      vi.mocked(pythonAPI.analyzeTenderDocument).mockRejectedValue(
        new Error('Service unavailable')
      );

      // Test tenant-1 context
      const tenant1Context = { ...testTenantContext, tenant_id: 'tenant-1' };
      const executionContext1 = {
        tenantContext: tenant1Context,
        workflowId: 'test-workflow-1',
        stepId: 'tender_analysis',
        agentType: 'tender_analysis',
        inputData: { tender_document: 'Test content' },
        checkpointData: {},
        timeoutSeconds: 300
      };

      const response1 = await agentCoordinator.executeAgent(executionContext1);
      expect(response1.error_info?.recovery_suggestions).toContain('Use tenant-1 fallback');

      // Test tenant-2 context
      const tenant2Context = { ...testTenantContext, tenant_id: 'tenant-2' };
      const executionContext2 = {
        tenantContext: tenant2Context,
        workflowId: 'test-workflow-2',
        stepId: 'tender_analysis',
        agentType: 'tender_analysis',
        inputData: { tender_document: 'Test content' },
        checkpointData: {},
        timeoutSeconds: 300
      };

      const response2 = await agentCoordinator.executeAgent(executionContext2);
      expect(response2.error_info?.recovery_suggestions).toContain('Use tenant-2 fallback');
    });
  });
});