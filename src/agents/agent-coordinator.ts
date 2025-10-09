/**
 * Agent coordinator implementation
 * Integrates agents with workflow orchestration and provides automatic checkpointing
 */

import { TenantContext } from '../types/tenant';
import { 
  AgentRequest, 
  AgentResponse, 
  WorkflowError, 
  ErrorSeverity,
  WorkflowStatus 
} from '../types/workflow';
import { workflowStateManager } from '../workflows/workflow-state';
import { checkpointManager } from '../workflows/checkpoint-manager';
import { pythonAPI } from '../lib/python-api';

export interface AgentCoordinatorConfig {
  maxRetries: number;
  retryDelays: number[];
  defaultTimeout: number;
  enableAutoCheckpointing: boolean;
}

export interface AgentExecutionContext {
  tenantContext: TenantContext;
  workflowId: string;
  stepId: string;
  agentType: string;
  inputData: Record<string, any>;
  checkpointData: Record<string, any>;
  timeoutSeconds?: number;
}

export interface TenantRecoveryStrategy {
  tenantId: string;
  maxRetries: number;
  retryDelays: number[];
  fallbackActions: string[];
  escalationThreshold: number;
  notificationSettings: {
    email?: string;
    webhook?: string;
  };
}

export class AgentCoordinator {
  private config: AgentCoordinatorConfig;
  private tenantRecoveryStrategies: Map<string, TenantRecoveryStrategy> = new Map();
  private activeExecutions: Map<string, AgentExecutionContext> = new Map();

  constructor(config?: Partial<AgentCoordinatorConfig>) {
    this.config = {
      maxRetries: 3,
      retryDelays: [1000, 2000, 4000], // Exponential backoff
      defaultTimeout: 300000, // 5 minutes
      enableAutoCheckpointing: true,
      ...config
    };
  }

  /**
   * Execute an agent with workflow integration and automatic checkpointing
   */
  async executeAgent(context: AgentExecutionContext): Promise<AgentResponse> {
    const executionId = this.generateExecutionId();
    this.activeExecutions.set(executionId, context);

    try {
      // Pre-execution checkpoint
      if (this.config.enableAutoCheckpointing) {
        await this.createPreExecutionCheckpoint(context);
      }

      // Execute agent with retry logic and tenant-specific recovery
      const response = await this.executeWithTenantRecovery(context);

      // Post-execution checkpoint on success
      if (this.config.enableAutoCheckpointing && response.success) {
        await this.createPostExecutionCheckpoint(context, response);
      }

      // Update workflow state
      await this.updateWorkflowState(context, response);

      return response;

    } catch (error) {
      // Handle execution error with tenant-specific recovery
      return await this.handleAgentError(context, error as Error);
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute agent with tenant-specific recovery strategies
   */
  private async executeWithTenantRecovery(context: AgentExecutionContext): Promise<AgentResponse> {
    const recoveryStrategy = this.getTenantRecoveryStrategy(context.tenantContext.tenant_id);
    const maxRetries = recoveryStrategy?.maxRetries || this.config.maxRetries;
    const retryDelays = recoveryStrategy?.retryDelays || this.config.retryDelays;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create agent request
        const agentRequest: AgentRequest = {
          tenant_context: context.tenantContext,
          workflow_id: context.workflowId,
          step_id: context.stepId,
          input_data: context.inputData,
          checkpoint_data: context.checkpointData,
          timeout_seconds: context.timeoutSeconds || this.config.defaultTimeout / 1000
        };

        // Execute the specific agent
        const response = await this.callSpecificAgent(context.agentType, agentRequest);

        if (response.success) {
          // Log successful execution
          this.logAgentEvent(
            context,
            'info',
            `Agent ${context.agentType} executed successfully on attempt ${attempt + 1}`
          );
          return response;
        } else {
          throw new Error(response.error_info?.message || 'Agent execution failed');
        }

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
          
          this.logAgentEvent(
            context,
            'warn',
            `Agent ${context.agentType} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${lastError.message}`
          );

          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error(`Agent ${context.agentType} failed after ${maxRetries + 1} attempts`);
  }

  /**
   * Call specific agent based on type
   */
  private async callSpecificAgent(agentType: string, request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      let result;
      
      switch (agentType) {
        case 'tender_analysis':
          result = await pythonAPI.analyzeTenderDocument({
            filename: 'document.pdf',
            content: request.input_data.tender_document || '',
            project_id: request.input_data.project_id || '',
            tenant_id: request.tenant_context.tenant_id
          });
          break;

        case 'knowledge_retrieval':
          result = await pythonAPI.retrieveKnowledge(
            request.input_data.query || '',
            request.input_data.context || {},
            request.tenant_context.tenant_id
          );
          break;

        case 'content_generation':
          result = await pythonAPI.generateContent(
            request.input_data.section || '',
            request.input_data.requirements || [],
            request.input_data.knowledge_base || [],
            request.tenant_context.tenant_id
          );
          break;

        case 'compliance_verification':
          result = await pythonAPI.verifyCompliance(
            request.input_data.generated_content || [],
            request.input_data.requirements || [],
            request.input_data.compliance_rules || [],
            request.tenant_context.tenant_id
          );
          break;

        default:
          throw new Error(`Unknown agent type: ${agentType}`);
      }

      return {
        success: true,
        output_data: result.output || {},
        checkpoint_data: {
          agent_type: agentType,
          execution_time: Date.now() - startTime,
          tenant_id: request.tenant_context.tenant_id,
          step_id: request.step_id
        },
        execution_time_ms: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        output_data: {},
        checkpoint_data: {},
        error_info: {
          code: 'AGENT_EXECUTION_ERROR',
          message: (error as Error).message,
          severity: ErrorSeverity.RETRY_REQUIRED,
          step_id: request.step_id,
          timestamp: new Date(),
          recovery_suggestions: [
            'Check agent configuration',
            'Verify input data format',
            'Check tenant permissions',
            'Retry operation'
          ],
          is_recoverable: true
        },
        execution_time_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Create pre-execution checkpoint
   */
  private async createPreExecutionCheckpoint(context: AgentExecutionContext): Promise<void> {
    try {
      const checkpointData = {
        step_id: context.stepId,
        agent_type: context.agentType,
        input_data: context.inputData,
        tenant_id: context.tenantContext.tenant_id,
        timestamp: new Date().toISOString(),
        checkpoint_type: 'pre_execution'
      };

      await checkpointManager.saveCheckpoint(
        context.workflowId,
        `${context.stepId}_pre`,
        checkpointData,
        context.tenantContext
      );

      this.logAgentEvent(context, 'debug', 'Pre-execution checkpoint created');
    } catch (error) {
      this.logAgentEvent(context, 'warn', `Failed to create pre-execution checkpoint: ${(error as Error).message}`);
    }
  }

  /**
   * Create post-execution checkpoint
   */
  private async createPostExecutionCheckpoint(
    context: AgentExecutionContext, 
    response: AgentResponse
  ): Promise<void> {
    try {
      const checkpointData = {
        step_id: context.stepId,
        agent_type: context.agentType,
        output_data: response.output_data,
        execution_time_ms: response.execution_time_ms,
        tenant_id: context.tenantContext.tenant_id,
        timestamp: new Date().toISOString(),
        checkpoint_type: 'post_execution'
      };

      await checkpointManager.saveCheckpoint(
        context.workflowId,
        `${context.stepId}_post`,
        checkpointData,
        context.tenantContext
      );

      this.logAgentEvent(context, 'debug', 'Post-execution checkpoint created');
    } catch (error) {
      this.logAgentEvent(context, 'warn', `Failed to create post-execution checkpoint: ${(error as Error).message}`);
    }
  }

  /**
   * Update workflow state after agent execution
   */
  private async updateWorkflowState(
    context: AgentExecutionContext, 
    response: AgentResponse
  ): Promise<void> {
    try {
      const currentState = workflowStateManager.getWorkflowState(context.workflowId);
      if (!currentState) {
        throw new Error(`Workflow state not found for ${context.workflowId}`);
      }

      // Merge response data into workflow state
      const updatedData = {
        ...currentState.state_data,
        ...response.output_data,
        [`${context.stepId}_result`]: response.output_data,
        [`${context.stepId}_execution_time`]: response.execution_time_ms
      };

      // Determine next step
      const nextStep = response.next_step || this.determineNextStep(context.stepId);

      workflowStateManager.updateWorkflowStep(
        context.workflowId,
        nextStep,
        updatedData,
        response.success ? WorkflowStatus.RUNNING : WorkflowStatus.FAILED
      );

      this.logAgentEvent(context, 'info', `Workflow state updated, next step: ${nextStep}`);
    } catch (error) {
      this.logAgentEvent(context, 'error', `Failed to update workflow state: ${(error as Error).message}`);
    }
  }

  /**
   * Handle agent execution errors with tenant-specific recovery
   */
  private async handleAgentError(
    context: AgentExecutionContext, 
    error: Error
  ): Promise<AgentResponse> {
    const recoveryStrategy = this.getTenantRecoveryStrategy(context.tenantContext.tenant_id);
    
    // Create error checkpoint
    if (this.config.enableAutoCheckpointing) {
      try {
        const errorCheckpointData = {
          step_id: context.stepId,
          agent_type: context.agentType,
          error_message: error.message,
          error_stack: error.stack,
          tenant_id: context.tenantContext.tenant_id,
          timestamp: new Date().toISOString(),
          checkpoint_type: 'error'
        };

        await checkpointManager.saveCheckpoint(
          context.workflowId,
          `${context.stepId}_error`,
          errorCheckpointData,
          context.tenantContext
        );
      } catch (checkpointError) {
        this.logAgentEvent(context, 'error', `Failed to create error checkpoint: ${(checkpointError as Error).message}`);
      }
    }

    // Determine error severity and recovery suggestions
    const errorSeverity = this.classifyError(error, context);
    const recoverySuggestions = this.generateRecoverySuggestions(error, context, recoveryStrategy);

    const workflowError: WorkflowError = {
      code: 'AGENT_EXECUTION_ERROR',
      message: error.message,
      severity: errorSeverity,
      step_id: context.stepId,
      timestamp: new Date(),
      stack_trace: error.stack,
      recovery_suggestions: recoverySuggestions,
      is_recoverable: errorSeverity !== ErrorSeverity.CRITICAL
    };

    // Update workflow state to failed
    workflowStateManager.failWorkflow(context.workflowId, workflowError);

    this.logAgentEvent(context, 'error', `Agent execution failed: ${error.message}`);

    return {
      success: false,
      output_data: {},
      checkpoint_data: {},
      error_info: workflowError,
      execution_time_ms: 0
    };
  }

  /**
   * Configure tenant-specific recovery strategy
   */
  setTenantRecoveryStrategy(tenantId: string, strategy: TenantRecoveryStrategy): void {
    this.tenantRecoveryStrategies.set(tenantId, strategy);
  }

  /**
   * Get tenant-specific recovery strategy
   */
  private getTenantRecoveryStrategy(tenantId: string): TenantRecoveryStrategy | undefined {
    return this.tenantRecoveryStrategies.get(tenantId);
  }

  /**
   * Classify error severity based on error type and context
   */
  private classifyError(error: Error, context: AgentExecutionContext): ErrorSeverity {
    const errorMessage = error.message.toLowerCase();

    // Critical errors that cannot be recovered
    if (errorMessage.includes('authentication') || 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('tenant not found')) {
      return ErrorSeverity.CRITICAL;
    }

    // Errors that need user input
    if (errorMessage.includes('invalid input') ||
        errorMessage.includes('missing required') ||
        errorMessage.includes('user confirmation')) {
      return ErrorSeverity.USER_INPUT_NEEDED;
    }

    // Errors that can be retried
    if (errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('service unavailable')) {
      return ErrorSeverity.RETRY_REQUIRED;
    }

    // Default to recoverable
    return ErrorSeverity.RECOVERABLE;
  }

  /**
   * Generate recovery suggestions based on error and tenant strategy
   */
  private generateRecoverySuggestions(
    error: Error, 
    context: AgentExecutionContext,
    recoveryStrategy?: TenantRecoveryStrategy
  ): string[] {
    const suggestions = [
      `Retry ${context.agentType} agent execution`,
      'Check agent configuration and permissions',
      'Verify input data format and completeness'
    ];

    // Add tenant-specific suggestions
    if (recoveryStrategy?.fallbackActions) {
      suggestions.push(...recoveryStrategy.fallbackActions);
    }

    // Add error-specific suggestions
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('timeout')) {
      suggestions.push('Increase timeout duration', 'Check network connectivity');
    }
    
    if (errorMessage.includes('authentication')) {
      suggestions.push('Refresh authentication tokens', 'Check API keys');
    }

    return suggestions;
  }

  /**
   * Determine next step in workflow (simplified logic)
   */
  private determineNextStep(currentStepId: string): string {
    // This would normally use workflow definition to determine next step
    // For now, return the current step to maintain state
    return currentStepId;
  }

  /**
   * Log agent events with tenant context
   */
  private logAgentEvent(
    context: AgentExecutionContext,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, any>
  ): void {
    const logMessage = `[${context.agentType}][${context.tenantContext.tenant_id}][${context.workflowId}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(logMessage, data || '');
        break;
      case 'info':
        console.info(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }

  /**
   * Utility methods
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get active executions for monitoring
   */
  getActiveExecutions(): Map<string, AgentExecutionContext> {
    return new Map(this.activeExecutions);
  }

  /**
   * Cancel active execution
   */
  cancelExecution(executionId: string): boolean {
    return this.activeExecutions.delete(executionId);
  }
}

// Export singleton instance
export const agentCoordinator = new AgentCoordinator();