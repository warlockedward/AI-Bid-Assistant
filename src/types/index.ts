/**
 * Core type definitions for the Intelligent Bid System
 * Multi-tenant architecture with workflow orchestration
 */

// Re-export all types for easy importing
export * from './tenant';
export * from './workflow';
export * from './auth';
export * from './agents';

// Legacy types for backward compatibility - keeping existing bid system types
export interface BidProject {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  tenderDocument: TenderDocument;
  status: BidStatus;
  assignedAgents: AgentAssignment[];
  generatedContent: GeneratedContent[];
  reviewHistory: ReviewRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export enum BidStatus {
  DRAFT = 'draft',
  ANALYZING = 'analyzing',
  GENERATING = 'generating',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  SUBMITTED = 'submitted'
}

export interface TenderDocument {
  id: string;
  filename: string;
  content: string;
  extractedRequirements: Requirement[];
  classification: DocumentClassification;
  uploadedAt: Date;
}

export interface Requirement {
  id: string;
  section: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  complianceRules: string[];
}

export interface DocumentClassification {
  industry: string;
  type: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedWorkload: number;
}

export interface AgentAssignment {
  agentType: AgentType;
  agentId: string;
  status: AgentStatus;
  assignedAt: Date;
  completedAt?: Date;
  output?: any;
}

export enum AgentType {
  TENDER_ANALYSIS = 'tender_analysis',
  KNOWLEDGE_RETRIEVAL = 'knowledge_retrieval',
  CONTENT_GENERATION = 'content_generation',
  COMPLIANCE_VERIFICATION = 'compliance_verification'
}

export enum AgentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

export interface GeneratedContent {
  id: string;
  section: string;
  content: string;
  agentId: string;
  version: number;
  status: ContentStatus;
  reviewNotes?: string;
  generatedAt: Date;
}

export enum ContentStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISED = 'revised'
}

export interface ReviewRecord {
  id: string;
  reviewerId: string;
  contentId: string;
  action: ReviewAction;
  comments: string;
  reviewedAt: Date;
}

export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_REVISION = 'request_revision'
}

export interface AgentConfig {
  name: string;
  systemMessage: string;
  llmConfig: LLMConfig;
  humanInputMode: 'NEVER' | 'TERMINATE' | 'ALWAYS';
  maxConsecutiveAutoReply: number;
  codeExecutionConfig?: CodeExecutionConfig;
}

export interface LLMConfig {
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface CodeExecutionConfig {
  workDir: string;
  useDocker: boolean;
  timeout: number;
}

export interface WorkflowExecution {
  id: string;
  bidProjectId: string;
  steps: WorkflowStep[];
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// Legacy workflow step interface for backward compatibility
export interface WorkflowStep {
  id: string;
  name: string;
  agentType: AgentType;
  dependencies: string[];
  status: AgentStatus;
  input?: any;
  output?: any;
  startedAt?: Date;
  completedAt?: Date;
}