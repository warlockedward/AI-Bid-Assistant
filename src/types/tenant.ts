/**
 * Core tenant-related type definitions for multi-tenant architecture
 */

export interface TenantContext {
  tenant_id: string;
  user_id: string;
  sso_provider?: string;
  sso_id?: string;
  preferences?: Record<string, any>;
  tenant_name?: string;
  user_email?: string;
  user_name?: string;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  config: TenantConfig;
  created_at: Date;
  updated_at: Date;
  status: TenantStatus;
}

export interface TenantConfig {
  id: string;
  tenant_id: string;
  rag_api_url: string;
  llm_endpoint: string;
  features: TenantFeatures;
  branding: TenantBranding;
  created_at: Date;
  updated_at: Date;
}

export interface TenantFeatures {
  workflow_checkpoints: boolean;
  advanced_analytics: boolean;
  custom_agents: boolean;
  api_access: boolean;
  sso_integration: boolean;
  max_concurrent_workflows: number;
}

export interface TenantBranding {
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  theme: 'light' | 'dark' | 'auto';
}

export interface User {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
  sso_provider: string;
  sso_id: string;
  role: UserRole;
  preferences: UserPreferences;
  created_at: Date;
  updated_at: Date;
  last_login: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  workflow_defaults: WorkflowDefaults;
}

export interface NotificationSettings {
  email_enabled: boolean;
  workflow_completion: boolean;
  workflow_errors: boolean;
  system_updates: boolean;
}

export interface WorkflowDefaults {
  auto_save_interval: number;
  default_agent_timeout: number;
  preferred_document_format: string;
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
  EXPIRED = 'expired'
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer'
}

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  expires_at: Date;
  accepted_at?: Date;
  created_at: Date;
}