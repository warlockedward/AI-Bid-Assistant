/**
 * Agent system type definitions for multi-tenant intelligent bid system
 */

export interface BaseAgentConfig {
  agent_id: string;
  name: string;
  description: string;
  version: string;
  tenant_id?: string; // null for system agents
  is_active: boolean;
  timeout_seconds: number;
  max_retries: number;
  created_at: Date;
  updated_at: Date;
}

export interface AgentCapabilities {
  supported_operations: string[];
  input_formats: string[];
  output_formats: string[];
  required_permissions: string[];
  resource_requirements: ResourceRequirements;
}

export interface ResourceRequirements {
  memory_mb: number;
  cpu_cores: number;
  gpu_required: boolean;
  network_access: boolean;
  external_apis: string[];
}

export interface AgentExecution {
  execution_id: string;
  agent_id: string;
  workflow_id: string;
  tenant_context: import('./tenant').TenantContext;
  input_data: Record<string, any>;
  output_data?: Record<string, any>;
  status: AgentExecutionStatus;
  started_at: Date;
  completed_at?: Date;
  error_info?: import('./workflow').WorkflowError;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  execution_time_ms: number;
  memory_used_mb: number;
  cpu_usage_percent: number;
  api_calls_made: number;
  tokens_consumed: number;
  cost_estimate: number;
}

// Specific agent types for the bid system
export interface ProposalGeneratorConfig extends BaseAgentConfig {
  llm_model: string;
  temperature: number;
  max_tokens: number;
  knowledge_base_ids: string[];
  writing_style_preferences: WritingStylePreferences;
}

export interface WritingStylePreferences {
  tone: 'formal' | 'professional' | 'conversational' | 'technical';
  complexity_level: 'basic' | 'intermediate' | 'advanced' | 'expert';
  industry_focus: string[];
  compliance_standards: string[];
  template_preferences: string[];
}

export interface ProposalScorerConfig extends BaseAgentConfig {
  scoring_criteria: ScoringCriteria[];
  weight_distribution: Record<string, number>;
  benchmark_data_source: string;
}

export interface ScoringCriteria {
  criterion_id: string;
  name: string;
  description: string;
  weight: number;
  scoring_method: 'numeric' | 'categorical' | 'boolean';
  min_value?: number;
  max_value?: number;
  categories?: string[];
}

export interface ProposalComparatorConfig extends BaseAgentConfig {
  comparison_dimensions: string[];
  visualization_preferences: VisualizationPreferences;
  report_format: 'detailed' | 'summary' | 'executive';
}

export interface VisualizationPreferences {
  chart_types: string[];
  color_scheme: string;
  include_raw_data: boolean;
  interactive_elements: boolean;
}

export interface KnowledgeRetrievalConfig extends BaseAgentConfig {
  rag_endpoint: string;
  embedding_model: string;
  similarity_threshold: number;
  max_results: number;
  knowledge_sources: KnowledgeSource[];
}

export interface KnowledgeSource {
  source_id: string;
  name: string;
  type: 'document' | 'database' | 'api' | 'web';
  connection_config: Record<string, any>;
  is_tenant_specific: boolean;
  last_updated: Date;
}

// Agent coordination and management
export interface AgentCoordinator {
  executeAgent(
    agentId: string, 
    request: import('./workflow').AgentRequest
  ): Promise<import('./workflow').AgentResponse>;
  
  getAgentStatus(agentId: string): Promise<AgentStatus>;
  
  listAvailableAgents(
    tenantId: string, 
    capabilities?: string[]
  ): Promise<BaseAgentConfig[]>;
  
  registerAgent(config: BaseAgentConfig): Promise<void>;
  
  updateAgentConfig(agentId: string, config: Partial<BaseAgentConfig>): Promise<void>;
  
  deactivateAgent(agentId: string): Promise<void>;
}

export interface AgentStatus {
  agent_id: string;
  status: AgentHealthStatus;
  current_executions: number;
  max_concurrent_executions: number;
  last_health_check: Date;
  performance_metrics: AgentPerformanceMetrics;
}

export interface AgentPerformanceMetrics {
  average_execution_time_ms: number;
  success_rate_percent: number;
  error_rate_percent: number;
  total_executions: number;
  last_24h_executions: number;
}

// Memory and learning system
export interface AgentMemory {
  tenant_id: string;
  agent_id: string;
  memory_type: MemoryType;
  key: string;
  value: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
  access_count: number;
}

export interface UserFeedback {
  feedback_id: string;
  tenant_id: string;
  user_id: string;
  agent_id: string;
  execution_id: string;
  feedback_type: FeedbackType;
  rating: number; // 1-5 scale
  comments?: string;
  suggested_improvements?: string[];
  created_at: Date;
}

export enum AgentExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export enum AgentHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline'
}

export enum MemoryType {
  USER_PREFERENCES = 'user_preferences',
  INTERACTION_HISTORY = 'interaction_history',
  LEARNED_PATTERNS = 'learned_patterns',
  REJECTION_FEEDBACK = 'rejection_feedback',
  PERFORMANCE_CACHE = 'performance_cache'
}

export enum FeedbackType {
  QUALITY_RATING = 'quality_rating',
  ACCURACY_RATING = 'accuracy_rating',
  USEFULNESS_RATING = 'usefulness_rating',
  BUG_REPORT = 'bug_report',
  FEATURE_REQUEST = 'feature_request',
  GENERAL_COMMENT = 'general_comment'
}