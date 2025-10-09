import { BaseAgent } from './base-agent';
import { AgentConfig, TenderDocument, Requirement, DocumentClassification } from '@/types';

export class TenderAnalysisAgent extends BaseAgent {
  constructor(tenantContext: any, tenantSettings: any) {
    const config: AgentConfig = {
      name: 'TenderAnalysisAgent',
      systemMessage: `你是一个专业的招标文件分析专家。你的任务是：
1. 分析招标文件的结构和内容
2. 提取关键需求和要求
3. 对文件进行分类和复杂度评估
4. 识别合规性要求

请以结构化的方式分析文件，确保不遗漏任何重要信息。`,
      llmConfig: {
        model: 'gpt-4',
        apiKey: '',
        temperature: 0.3,
        maxTokens: 4000,
        timeout: 30000
      },
      humanInputMode: 'NEVER',
      maxConsecutiveAutoReply: 1
    };

    super(config, tenantContext, tenantSettings);
  }

  async execute(input: { tenderDocument: TenderDocument }): Promise<{
    requirements: Requirement[];
    classification: DocumentClassification;
    analysis: string;
  }> {
    this.log('开始分析招标文件', { documentId: input.tenderDocument.id });

    try {
      const messages = [
        {
          role: 'system',
          content: this.config.systemMessage
        },
        {
          role: 'user',
          content: `请分析以下招标文件：

文件名：${input.tenderDocument.filename}
内容：
${input.tenderDocument.content}

请提供：
1. 提取的关键需求列表
2. 文件分类信息
3. 详细分析报告`
        }
      ];

      const response = await this.callLLM(messages);

      // 解析LLM响应并结构化数据
      const requirements = await this.extractRequirements(input.tenderDocument, response);
      const classification = await this.classifyDocument(input.tenderDocument, response);

      this.log('招标文件分析完成', {
        requirementsCount: requirements.length,
        classification: classification.type
      });

      return {
        requirements,
        classification,
        analysis: response
      };

    } catch (error) {
      this.logError('招标文件分析失败', error);
      throw error;
    }
  }

  private async extractRequirements(
    document: TenderDocument, 
    analysis: string
  ): Promise<Requirement[]> {
    // 这里应该解析LLM响应并提取结构化的需求
    // 暂时返回模拟数据
    return [
      {
        id: `req_${Date.now()}_1`,
        section: '技术要求',
        content: '系统应支持多租户架构',
        priority: 'high',
        category: '技术规格',
        complianceRules: ['ISO27001', 'GDPR']
      },
      {
        id: `req_${Date.now()}_2`,
        section: '商务要求',
        content: '项目交付周期不超过6个月',
        priority: 'medium',
        category: '项目管理',
        complianceRules: ['合同法']
      }
    ];
  }

  private async classifyDocument(
    document: TenderDocument,
    analysis: string
  ): Promise<DocumentClassification> {
    // 这里应该基于分析结果对文档进行分类
    // 暂时返回模拟数据
    return {
      industry: 'IT服务',
      type: '软件开发',
      complexity: 'medium',
      estimatedWorkload: 120
    };
  }
}