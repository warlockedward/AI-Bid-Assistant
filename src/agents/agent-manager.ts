import { TenderAnalysisAgent } from './tender-analysis-agent';
import { KnowledgeRetrievalAgent } from './knowledge-retrieval-agent';
import { ContentGenerationAgent } from './content-generation-agent';
import { ComplianceVerificationAgent } from './compliance-verification-agent';
import { BaseAgent } from './base-agent';
import { AgentType, AgentStatus, WorkflowExecution, WorkflowStep } from '@/types';
import { TenantContext } from '@/tenants/tenant-context';
import { prisma, withTenantIsolation } from '@/lib/database';
import { websocketManager } from '@/lib/websocket-server';

export class AgentManager {
  private agents: Map<string, BaseAgent> = new Map();
  private tenantId: string;
  private tenantSettings: any;
  private tenantContext: TenantContext;

  constructor(tenantId: string, tenantSettings: any) {
    this.tenantId = tenantId;
    this.tenantSettings = tenantSettings;
    this.tenantContext = {
      tenant_id: tenantId,
      user_id: 'system', // 系统用户
      tenant_name: tenantSettings?.name || 'Default Tenant',
      user_email: 'system@system.local',
      user_name: 'System User',
      permissions: ['admin'],
      preferences: tenantSettings || {},
      created_at: new Date(),
      updated_at: new Date()
    };
    this.initializeAgents();
  }

  private initializeAgents() {
    // 初始化所有代理
    this.agents.set(AgentType.TENDER_ANALYSIS, new TenderAnalysisAgent(this.tenantContext, this.tenantSettings));
    this.agents.set(AgentType.KNOWLEDGE_RETRIEVAL, new KnowledgeRetrievalAgent(this.tenantContext, this.tenantSettings));
    this.agents.set(AgentType.CONTENT_GENERATION, new ContentGenerationAgent(this.tenantContext, this.tenantSettings));
    this.agents.set(AgentType.COMPLIANCE_VERIFICATION, new ComplianceVerificationAgent(this.tenantContext, this.tenantSettings));
  }

  async executeWorkflow(bidProjectId: string): Promise<WorkflowExecution> {
    console.log(`[AgentManager][${this.tenantId}] 开始执行工作流`, { bidProjectId });

    const db = withTenantIsolation(this.tenantId);

    // 创建工作流执行记录
    const workflowExecution = await db.workflowExecution.create({
      data: {
        bidProjectId,
        steps: [],
        status: 'RUNNING'
      }
    });

    try {
      // 定义工作流步骤
      const steps: WorkflowStep[] = [
        {
          id: 'step_1',
          name: '招标文件分析',
          agentType: AgentType.TENDER_ANALYSIS,
          dependencies: [],
          status: AgentStatus.PENDING
        },
        {
          id: 'step_2',
          name: '知识检索',
          agentType: AgentType.KNOWLEDGE_RETRIEVAL,
          dependencies: ['step_1'],
          status: AgentStatus.PENDING
        },
        {
          id: 'step_3',
          name: '内容生成',
          agentType: AgentType.CONTENT_GENERATION,
          dependencies: ['step_1', 'step_2'],
          status: AgentStatus.PENDING
        },
        {
          id: 'step_4',
          name: '合规性验证',
          agentType: AgentType.COMPLIANCE_VERIFICATION,
          dependencies: ['step_3'],
          status: AgentStatus.PENDING
        }
      ];

      // 执行工作流步骤
      const executedSteps = await this.executeSteps(steps, bidProjectId);

      // 更新工作流执行状态
      const updatedExecution = await db.workflowExecution.update({
        where: { id: workflowExecution.id },
        data: {
          steps: executedSteps,
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      console.log(`[AgentManager][${this.tenantId}] 工作流执行完成`, { 
        workflowId: updatedExecution.id,
        stepCount: executedSteps.length
      });

      // Map database result to WorkflowExecution interface
      return {
        id: updatedExecution.id,
        bidProjectId: updatedExecution.bidProjectId,
        steps: executedSteps,
        status: updatedExecution.status as 'running' | 'completed' | 'failed' | 'paused',
        startedAt: updatedExecution.startedAt,
        completedAt: updatedExecution.completedAt || undefined,
        error: updatedExecution.error || undefined
      } as WorkflowExecution;

    } catch (error) {
      console.error(`[AgentManager][${this.tenantId}] 工作流执行失败`, error);

      await db.workflowExecution.update({
        where: { id: workflowExecution.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : '未知错误',
          completedAt: new Date()
        }
      });

      throw error;
    }
  }

  private async executeSteps(steps: WorkflowStep[], bidProjectId: string): Promise<WorkflowStep[]> {
    const executedSteps: WorkflowStep[] = [];
    const stepMap = new Map(steps.map(step => [step.id, step]));

    // 按依赖关系执行步骤
    for (const step of steps) {
      // 检查依赖是否完成
      const dependenciesCompleted = step.dependencies.every(depId => {
        const depStep = executedSteps.find(s => s.id === depId);
        return depStep && depStep.status === AgentStatus.COMPLETED;
      });

      if (!dependenciesCompleted && step.dependencies.length > 0) {
        throw new Error(`步骤 ${step.name} 的依赖未完成`);
      }

      try {
        console.log(`[AgentManager][${this.tenantId}] 执行步骤: ${step.name}`);
        
        step.status = AgentStatus.RUNNING;
        step.startedAt = new Date();

        // Broadcast agent start status
        websocketManager.broadcastAgentStatus(bidProjectId, {
          agentId: step.agentType,
          status: 'processing',
          progress: 0,
          message: `Starting ${step.name}`,
          currentTask: step.name
        });

        const agent = this.agents.get(step.agentType);
        if (!agent) {
          throw new Error(`未找到代理类型: ${step.agentType}`);
        }

        // 准备步骤输入
        const stepInput = await this.prepareStepInput(step, executedSteps, bidProjectId);
        
        // 执行代理
        const output = await agent.execute(stepInput);

        step.status = AgentStatus.COMPLETED;
        step.completedAt = new Date();
        step.output = output;

        // Broadcast agent completion status
        websocketManager.broadcastAgentStatus(bidProjectId, {
          agentId: step.agentType,
          status: 'completed',
          progress: 100,
          message: `Completed ${step.name}`
        });

        executedSteps.push(step);

        console.log(`[AgentManager][${this.tenantId}] 步骤完成: ${step.name}`);

      } catch (error) {
        console.error(`[AgentManager][${this.tenantId}] 步骤失败: ${step.name}`, error);
        
        step.status = AgentStatus.FAILED;
        step.completedAt = new Date();

        // Broadcast agent error status
        websocketManager.broadcastAgentStatus(bidProjectId, {
          agentId: step.agentType,
          status: 'error',
          progress: 0,
          message: `Failed: ${step.name} - ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        
        executedSteps.push(step);
        throw error;
      }
    }

    return executedSteps;
  }

  private async prepareStepInput(
    step: WorkflowStep, 
    executedSteps: WorkflowStep[], 
    bidProjectId: string
  ): Promise<any> {
    const db = withTenantIsolation(this.tenantId);

    switch (step.agentType) {
      case AgentType.TENDER_ANALYSIS:
        const bidProject = await db.bidProject.findUnique({
          where: { id: bidProjectId },
          include: { tenderDocument: true }
        });
        return { tenderDocument: bidProject?.tenderDocument };

      case AgentType.KNOWLEDGE_RETRIEVAL:
        const analysisStep = executedSteps.find(s => s.agentType === AgentType.TENDER_ANALYSIS);
        return {
          query: '投标相关知识',
          context: analysisStep?.output,
          requirements: analysisStep?.output?.requirements || []
        };

      case AgentType.CONTENT_GENERATION:
        const analysisOutput = executedSteps.find(s => s.agentType === AgentType.TENDER_ANALYSIS)?.output;
        const knowledgeOutput = executedSteps.find(s => s.agentType === AgentType.KNOWLEDGE_RETRIEVAL)?.output;
        
        return {
          section: '完整投标文档',
          requirements: analysisOutput?.requirements || [],
          knowledgeBase: knowledgeOutput?.retrievedKnowledge || [],
          context: { bidProjectId, analysisOutput, knowledgeOutput }
        };

      case AgentType.COMPLIANCE_VERIFICATION:
        const contentStep = executedSteps.find(s => s.agentType === AgentType.CONTENT_GENERATION);
        const analysisStep2 = executedSteps.find(s => s.agentType === AgentType.TENDER_ANALYSIS);
        
        return {
          generatedContent: contentStep?.output ? [contentStep.output] : [],
          requirements: analysisStep2?.output?.requirements || [],
          complianceRules: this.tenantSettings.complianceRules || [],
          tenderDocument: analysisStep2?.output
        };

      default:
        return {};
    }
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    const db = withTenantIsolation(this.tenantId);
    
    await db.workflowExecution.update({
      where: { id: workflowId },
      data: { status: 'PAUSED' }
    });

    console.log(`[AgentManager][${this.tenantId}] 工作流已暂停`, { workflowId });
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    const db = withTenantIsolation(this.tenantId);
    
    await db.workflowExecution.update({
      where: { id: workflowId },
      data: { status: 'RUNNING' }
    });

    console.log(`[AgentManager][${this.tenantId}] 工作流已恢复`, { workflowId });
  }

  getAgent(agentType: AgentType): BaseAgent | undefined {
    return this.agents.get(agentType);
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowExecution | null> {
    const db = withTenantIsolation(this.tenantId);
    
    return await db.workflowExecution.findUnique({
      where: { id: workflowId }
    }) as WorkflowExecution | null;
  }
}