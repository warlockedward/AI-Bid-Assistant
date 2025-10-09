/**
 * Workflow state management and orchestration type definitions
 */

export interface WorkflowState {
  workflow_id: string;
  tenant_id: string;
  user_id: string;
  current_step: string;
  state_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  status: WorkflowStatus;
  metadata: WorkflowMetadata;
}

export interface WorkflowMetadata {
  name: string;
  description?: string;
  version: string;
  estimated_duration?: number;
  priority: WorkflowPriority;
  tags: string[];
}

export interface WorkflowCheckpoint {
  id: string;
  workflow_id: string;
  step_id: string;
  checkpoint_data: Record<string, any>;
  created_at: Date;
  is_recoverable: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  agent_type: string;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  timeout_seconds: number;
  retry_count: number;
  dependencies: string[];
  is_checkpoint: boolean;
}

export interface WorkflowDefinition {
  metadata: any;
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStep[];
  tenant_id?: string; // null for system-wide workflows
  created_by: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflow_definition_id: string;
  workflow_state: WorkflowState;
  execution_log: WorkflowLogEntry[];
  started_at: Date;
  completed_at?: Date;
  error_info?: WorkflowError;
}

export interface WorkflowLogEntry {
  id: string;
  workflow_id: string;
  step_id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: Record<string, any>;
}

export interface WorkflowError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  step_id: string;
  timestamp: Date;
  stack_trace?: string;
  recovery_suggestions: string[];
  is_recoverable: boolean;
}

export interface AgentRequest {
  tenant_context: import('./tenant').TenantContext;
  workflow_id: string;
  step_id: string;
  input_data: Record<string, any>;
  checkpoint_data: Record<string, any>;
  timeout_seconds: number;
}

export interface AgentResponse {
  success: boolean;
  output_data: Record<string, any>;
  checkpoint_data: Record<string, any>;
  next_step?: string;
  error_info?: WorkflowError;
  execution_time_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  rag_queries?: number;
}

export interface WorkflowProgress {
  workflow_id: string;
  total_steps: number;
  completed_steps: number;
  current_step: string;
  progress_percentage: number;
  estimated_remaining_time?: number;
  last_updated: Date;
}

export interface WorkflowRequest {
  tenant_id: string;
  user_id: string;
  project_id: string;
  tender_document: string;
  requirements: string[];
  generation_requirements?: {
    format: string;
    language: string;
  };
  tenant_settings: {
    llm_config: {
      model: string;
      api_key: string;
      temperature: number;
    };
    fastgpt_config: {
      api_url: string;
      api_key: string;
    };
  };
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RECOVERING = 'recovering'
}

export enum WorkflowPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export enum ErrorSeverity {
  RECOVERABLE = 'recoverable',
  RETRY_REQUIRED = 'retry_required',
  USER_INPUT_NEEDED = 'user_input_needed',
  CRITICAL = 'critical'
}

// Workflow orchestration interfaces
export interface WorkflowOrchestrator {
  startWorkflow(definition: WorkflowDefinition, context: import('./tenant').TenantContext): Promise<WorkflowExecution>;
  pauseWorkflow(workflowId: string): Promise<void>;
  resumeWorkflow(workflowId: string): Promise<void>;
  cancelWorkflow(workflowId: string): Promise<void>;
  getWorkflowStatus(workflowId: string): Promise<WorkflowProgress>;
  recoverWorkflow(workflowId: string, fromCheckpoint?: string): Promise<WorkflowExecution>;
}

export interface CheckpointManager {
  saveCheckpoint(workflowId: string, stepId: string, data: Record<string, any>): Promise<WorkflowCheckpoint>;
  getLatestCheckpoint(workflowId: string): Promise<WorkflowCheckpoint | null>;
  getCheckpoint(workflowId: string, stepId: string): Promise<WorkflowCheckpoint | null>;
  listCheckpoints(workflowId: string): Promise<WorkflowCheckpoint[]>;
}