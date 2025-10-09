import { BaseAgent } from './base-agent';
import { AgentConfig, GeneratedContent, ContentStatus } from '@/types';

export class ContentGenerationAgent extends BaseAgent {
  constructor(tenantContext: any, tenantSettings: any) {
    const config: AgentConfig = {
      name: 'ContentGenerationAgent',
      systemMessage: `你是一个专业的投标文档内容生成专家。你的任务是：
1. 根据招标需求和检索到的知识生成高质量的投标内容
2. 确保内容符合招标文件的要求和格式
3. 保持内容的连贯性和专业性
4. 针对不同章节生成相应的内容

请生成结构清晰、逻辑严密、专业准确的投标文档内容。`,
      llmConfig: {
        model: 'gpt-4',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 6000,
        timeout: 45000
      },
      humanInputMode: 'NEVER',
      maxConsecutiveAutoReply: 1
    };

    super(config, tenantContext, tenantSettings);
  }

  async execute(input: {
    section: string;
    requirements: any[];
    knowledgeBase: any[];
    context: any;
    previousSections?: GeneratedContent[];
  }): Promise<{
    content: string;
    metadata: any;
    suggestions: string[];
  }> {
    this.log('开始生成内容', { section: input.section });

    try {
      // 调用Python后端API生成内容
      const response = await this.callPythonAPI(input);

      // 处理生成的内容
      const processedContent = await this.processGeneratedContent(response, input);

      this.log('内容生成完成', {
        section: input.section,
        contentLength: processedContent.content.length
      });

      return processedContent;

    } catch (error) {
      this.logError('内容生成失败', error);
      throw error;
    }
  }

  private buildContext(input: any): string {
    let context = `章节：${input.section}\n`;
    
    if (input.previousSections && input.previousSections.length > 0) {
      context += '\n已生成的前序章节：\n';
      input.previousSections.forEach((section: GeneratedContent) => {
        context += `- ${section.section}: ${section.content.substring(0, 200)}...\n`;
      });
    }

    if (input.context) {
      context += `\n项目背景：${JSON.stringify(input.context)}\n`;
    }

    return context;
  }

  private async processGeneratedContent(response: string, input: any): Promise<{
    content: string;
    metadata: any;
    suggestions: string[];
  }> {
    // 这里可以添加内容后处理逻辑
    // 例如：格式化、质量检查、建议生成等

    return {
      content: response,
      metadata: {
        section: input.section,
        wordCount: response.split(' ').length,
        generatedAt: new Date(),
        version: 1
      },
      suggestions: [
        '建议添加更多具体的技术细节',
        '可以考虑增加相关案例说明',
        '建议补充风险控制措施'
      ]
    };
  }

  async generateSegmentedContent(input: {
    fullDocument: any;
    segmentSize: number;
    overlapSize: number;
  }): Promise<GeneratedContent[]> {
    this.log('开始分段内容生成', {
      segmentSize: input.segmentSize,
      overlapSize: input.overlapSize
    });

    const segments = this.createSegments(input.fullDocument, input.segmentSize, input.overlapSize);
    const generatedSegments: GeneratedContent[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      try {
        const result = await this.execute({
          section: `段落_${i + 1}`,
          requirements: segment.requirements,
          knowledgeBase: segment.knowledgeBase,
          context: segment.context,
          previousSections: generatedSegments
        });

        const generatedContent: GeneratedContent = {
          id: `content_${Date.now()}_${i}`,
          section: `段落_${i + 1}`,
          content: result.content,
          agentId: this.config.name,
          version: 1,
          status: ContentStatus.DRAFT,
          generatedAt: new Date()
        };

        generatedSegments.push(generatedContent);

        // 保持上下文连贯性
        await this.sleep(1000); // 避免API限流

      } catch (error) {
        this.logError(`段落 ${i + 1} 生成失败`, error);
        throw error;
      }
    }

    this.log('分段内容生成完成', { segmentCount: generatedSegments.length });
    return generatedSegments;
  }

  private createSegments(document: any, segmentSize: number, overlapSize: number): any[] {
    // 这里实现文档分段逻辑
    // 暂时返回模拟分段
    return [
      {
        requirements: document.requirements?.slice(0, 2) || [],
        knowledgeBase: document.knowledgeBase?.slice(0, 3) || [],
        context: { ...document.context, segment: 1 }
      },
      {
        requirements: document.requirements?.slice(1, 3) || [],
        knowledgeBase: document.knowledgeBase?.slice(2, 5) || [],
        context: { ...document.context, segment: 2 }
      }
    ];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async callPythonAPI(input: any): Promise<string> {
    try {
      // Import pythonAPI dynamically to avoid circular dependencies
      const { pythonAPI } = await import('@/lib/python-api');
      
      // 调用Python后端的内容生成API
      const response = await pythonAPI.generateContent(
        input.section,
        input.requirements,
        input.knowledgeBase,
        this.tenantId
      );
      
      // 返回生成的内容
      if (response.status === 'success') {
        // 根据不同的内容类型返回相应的内容
        if (response.output.content) {
          // 如果返回的是完整的content对象
          return this.formatGeneratedContent(response.output.content);
        } else if (response.output.technical_proposal) {
          // 如果返回的是技术方案
          return this.formatTechnicalProposal(response.output.technical_proposal);
        } else if (response.output.commercial_proposal) {
          // 如果返回的是商务方案
          return this.formatCommercialProposal(response.output.commercial_proposal);
        } else {
          // 默认返回字符串化的内容
          return JSON.stringify(response.output, null, 2);
        }
      } else {
        throw new Error(`Python API call failed: ${response.status}`);
      }
    } catch (error) {
      console.error(`Python API call failed for agent ${this.config.name}:`, error);
      throw error;
    }
  }

  // 格式化生成的内容
  private formatGeneratedContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object') {
      // 如果是对象，格式化为Markdown
      let formatted = '';
      
      // 添加标题
      if (content.title) {
        formatted += `# ${content.title}\n\n`;
      }
      
      // 添加各部分内容
      if (content.sections) {
        for (const [sectionName, sectionContent] of Object.entries(content.sections)) {
          formatted += `## ${sectionName}

${sectionContent}

`;
        }
      } else {
        // 如果没有明确的章节结构，直接格式化对象
        formatted += Object.entries(content)
          .map(([key, value]) => `## ${key}

${value}

`)
          .join('');
      }
      
      return formatted;
    }
    
    return String(content);
  }

  // 格式化技术方案
  private formatTechnicalProposal(proposal: any): string {
    let formatted = '# 技术方案\n\n';
    
    if (proposal.architecture) {
      formatted += `## 系统架构设计

${proposal.architecture}

`;
    }
    
    if (proposal.functionality) {
      formatted += `## 功能实现方案

${proposal.functionality}

`;
    }
    
    if (proposal.performance) {
      formatted += `## 性能保证

${proposal.performance}

`;
    }
    
    if (proposal.technical_advantages) {
      formatted += `## 技术优势

${proposal.technical_advantages}

`;
    }
    
    return formatted;
  }

  // 格式化商务方案
  private formatCommercialProposal(proposal: any): string {
    let formatted = '# 商务方案\n\n';
    
    if (proposal.pricing_strategy) {
      formatted += `## 定价策略

${proposal.pricing_strategy}

`;
    }
    
    if (proposal.payment_terms) {
      formatted += `## 付款方式

${proposal.payment_terms}

`;
    }
    
    if (proposal.warranty_support) {
      formatted += `## 保修与支持

${proposal.warranty_support}

`;
    }
    
    if (proposal.commercial_advantages) {
      formatted += `## 商务优势

${proposal.commercial_advantages}

`;
    }
    
    return formatted;
  }
}