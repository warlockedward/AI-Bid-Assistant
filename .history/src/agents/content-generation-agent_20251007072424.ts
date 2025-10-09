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
}