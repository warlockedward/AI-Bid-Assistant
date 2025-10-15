import { getSession } from 'next-auth/react';

const API_BASE_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

// 类型定义
export interface WorkflowRequest {
  project_id: string;
  tenant_id: string;
  user_id: string;
  tender_document: string;
  requirements: string[];
  generation_requirements: Record<string, any>;
  tenant_settings?: Record<string, any>;
}

export interface WorkflowStatus {
  execution_id: string;
  status: string;
  current_step: string;
  steps: WorkflowStep[];
  progress: number;
  execution_time: number;
  human_review_pending: string[];
}

export interface WorkflowStep {
  step_name: string;
  description: string;
  start_time: string;
  end_time?: string;
  status: string;
  execution_time?: number;
  error?: string;
}

export interface AgentConversation {
  agent: string;
  timestamp: string;
  input: string;
  output: string;
  status: string;
}

export interface HumanFeedback {
  workflow_id: string;
  review_type: string;
  feedback: {
    action: 'continue' | 'reject' | 'modify';
    comments?: string;
    modifications?: Record<string, any>;
  };
}

export interface TenderAnalysisResult {
  document_summary: {
    project_name: string;
    project_type: string;
    deadline: string;
    budget_range: string;
    key_requirements: string[];
  };
  technical_requirements: {
    mandatory_requirements: Array<{
      requirement_id: string;
      description: string;
      category: string;
      priority: string;
    }>;
    optional_requirements: Array<{
      requirement_id: string;
      description: string;
      category: string;
      priority: string;
    }>;
  };
  evaluation_criteria: {
    technical_score_weight: number;
    commercial_score_weight: number;
    criteria_details: Array<{
      criterion: string;
      weight: number;
      description: string;
    }>;
  };
  risk_analysis: {
    high_risks: string[];
    medium_risks: string[];
    low_risks: string[];
  };
  bidding_strategy: {
    win_probability: {
      estimated_probability: string;
      confidence_level: string;
    };
    recommended_approach: string[];
    key_differentiators: string[];
  };
}

// API客户端类
class PythonAPIClient {
  private async getAuthHeaders() {
    const session = await getSession();
    if (!session?.user) {
      throw new Error('未找到认证令牌');
    }
    
    return {
      'Authorization': `Bearer ${session.user.id}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // 工作流管理
  async startWorkflow(request: WorkflowRequest): Promise<{
    status: string;
    workflow_id: string;
    message: string;
    timestamp: string;
  }> {
    return this.request('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getWorkflowStatus(workflowId: string): Promise<{
    status: string;
    workflow_status: WorkflowStatus;
    chat_history: AgentConversation[];
    execution_history: any[];
    timestamp: string;
  }> {
    return this.request(`/api/workflows/${workflowId}`);
  }

  async getWorkflowConversation(workflowId: string): Promise<{
    status: string;
    conversation: AgentConversation[];
    timestamp: string;
  }> {
    return this.request(`/api/workflows/${workflowId}/conversation`);
  }

  async submitHumanFeedback(feedback: HumanFeedback): Promise<{
    status: string;
    feedback_result: any;
    timestamp: string;
  }> {
    return this.request('/api/workflows/human-feedback', {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  }

  async controlWorkflow(workflowId: string, action: 'pause' | 'resume' | 'cancel'): Promise<{
    message: string;
    workflow_id: string;
  }> {
    return this.request(`/api/workflows/${workflowId}/control`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async listActiveWorkflows(): Promise<{
    status: string;
    active_workflows: Array<{
      workflow_id: string;
      execution_id: string;
      status: string;
      progress: number;
      current_step: string;
    }>;
    count: number;
    timestamp: string;
  }> {
    return this.request('/api/workflows');
  }

  // 单独的代理调用
  async analyzeTenderDocument(request: {
    filename: string;
    content: string;
    project_id: string;
    tenant_id: string;
  }): Promise<{
    agent_type: string;
    status: string;
    output: TenderAnalysisResult;
    timestamp: string;
  }> {
    return this.request('/api/analyze-tender', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async retrieveKnowledge(
    query: string,
    context: Record<string, any>,
    tenantId: string
  ): Promise<{
    agent_type: string;
    status: string;
    output: any;
    timestamp: string;
  }> {
    const params = new URLSearchParams({
      query,
      context: JSON.stringify(context),
      tenant_id: tenantId,
    });

    return this.request(`/api/retrieve-knowledge?${params}`);
  }

  async generateContent(
    section: string,
    requirements: Array<Record<string, any>>,
    knowledgeBase: Array<Record<string, any>>,
    tenantId: string
  ): Promise<{
    agent_type: string;
    status: string;
    output: any;
    timestamp: string;
  }> {
    const params = new URLSearchParams({
      section,
      requirements: JSON.stringify(requirements),
      knowledge_base: JSON.stringify(knowledgeBase),
      tenant_id: tenantId,
    });

    return this.request(`/api/generate-content?${params}`);
  }

  async verifyCompliance(
    generatedContent: Array<Record<string, any>>,
    requirements: Array<Record<string, any>>,
    complianceRules: string[],
    tenantId: string
  ): Promise<{
    agent_type: string;
    status: string;
    output: any;
    timestamp: string;
  }> {
    const params = new URLSearchParams({
      generated_content: JSON.stringify(generatedContent),
      requirements: JSON.stringify(requirements),
      compliance_rules: JSON.stringify(complianceRules),
      tenant_id: tenantId,
    });

    return this.request(`/api/verify-compliance?${params}`);
  }

  // 健康检查
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
  }> {
    return this.request('/health');
  }
}

// 导出单例实例
export const pythonAPI = new PythonAPIClient();

// 工具函数
export const formatWorkflowStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'running': '运行中',
    'completed': '已完成',
    'failed': '失败',
    'waiting_for_review': '等待审核',
    'paused': '已暂停',
    'cancelled': '已取消',
    'stopped': '已停止'
  };
  
  return statusMap[status] || status;
};

export const formatStepName = (stepName: string): string => {
  const stepMap: Record<string, string> = {
    'tender_analysis': '招标文档分析',
    'knowledge_retrieval': '知识检索',
    'content_generation': '内容生成',
    'compliance_verification': '合规验证'
  };
  
  return stepMap[stepName] || stepName;
};

export const getStepProgress = (steps: WorkflowStep[]): number => {
  if (!steps.length) return 0;
  
  const completedSteps = steps.filter(step => 
    step.status === 'success' || step.status === 'completed'
  ).length;
  
  return Math.round((completedSteps / steps.length) * 100);
};

export const getEstimatedTimeRemaining = (steps: WorkflowStep[]): string => {
  const completedSteps = steps.filter(step => 
    step.status === 'success' || step.status === 'completed'
  );
  
  if (completedSteps.length === 0) return '估算中...';
  
  const avgTimePerStep = completedSteps.reduce((sum, step) => {
    return sum + (step.execution_time || 0);
  }, 0) / completedSteps.length;
  
  const remainingSteps = steps.length - completedSteps.length;
  const estimatedSeconds = avgTimePerStep * remainingSteps;
  
  if (estimatedSeconds < 60) return `约 ${Math.round(estimatedSeconds)} 秒`;
  if (estimatedSeconds < 3600) return `约 ${Math.round(estimatedSeconds / 60)} 分钟`;
  return `约 ${Math.round(estimatedSeconds / 3600)} 小时`;
};

// 错误处理工具
export class PythonAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'PythonAPIError';
  }
}

export const handleAPIError = (error: any): string => {
  if (error instanceof PythonAPIError) {
    return error.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return '发生未知错误，请稍后重试';
};