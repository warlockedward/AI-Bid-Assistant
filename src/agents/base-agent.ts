import { AgentConfig, LLMConfig, Tenant } from '@/types';
import { TenantContext } from '@/tenants/tenant-context';
import { memorySystem } from './memory-system';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected tenantId: string;
  protected tenantSettings: any;
  protected tenantContext: TenantContext;
  protected memorySystem = memorySystem;

  constructor(config: AgentConfig, tenantContext: TenantContext, tenantSettings: any) {
    this.config = config;
    this.tenantId = tenantContext.tenant_id;
    this.tenantSettings = tenantSettings;
    this.tenantContext = tenantContext;
  }

  abstract execute(input: any): Promise<any>;

  protected getLLMConfig(): LLMConfig {
    return {
      ...this.config.llmConfig,
      model: this.config.llmConfig?.model || this.tenantSettings.aiModels?.primary || 'gpt-4',
      apiKey: this.config.llmConfig?.apiKey || process.env.OPENAI_API_KEY || '',
      temperature: this.config.llmConfig?.temperature ?? 0.7,
      maxTokens: this.config.llmConfig?.maxTokens || 4000,
      timeout: this.config.llmConfig?.timeout || 30000
    };
  }

  protected async callLLM(messages: any[], options?: Partial<LLMConfig>): Promise<string> {
    const llmConfig = { ...this.getLLMConfig(), ...options };
    
    try {
      // Get user preferences and writing style from memory
      const writingStyle = await memorySystem.getWritingStyle(
        this.tenantContext,
        'agent_specific',
        this.config.name
      );
      
      // Get rejection patterns to avoid previous mistakes
      const rejectionPatterns = await memorySystem.getRejectionPatterns(
        this.tenantContext,
        undefined, // content_type - will be set by specific agents
        this.config.name,
        30 // days back
      );
      
      // Enhance messages with user preferences
      const enhancedMessages = await this.enhanceMessagesWithPreferences(
        messages,
        writingStyle,
        rejectionPatterns
      );
      
      // 这里将集成实际的LLM调用
      // 暂时返回模拟响应
      console.log(`Agent ${this.config.name} calling LLM with config:`, llmConfig);
      console.log('Enhanced Messages:', enhancedMessages);
      
      // 模拟LLM响应
      const response = `Response from ${this.config.name} agent for tenant ${this.tenantId}`;
      
      // Store interaction in memory
      await memorySystem.storeInteraction(
        this.tenantContext,
        'llm_call',
        {
          agent_name: this.config.name,
          messages: enhancedMessages,
          response: response,
          llm_config: llmConfig
        },
        ['llm', 'interaction', this.config.name],
        7 // expires in 7 days
      );
      
      return response;
    } catch (error) {
      console.error(`LLM call failed for agent ${this.config.name}:`, error);
      throw error;
    }
  }

  /**
   * Enhance messages with user preferences and rejection patterns.
   */
  protected async enhanceMessagesWithPreferences(
    messages: any[],
    writingStyle: Record<string, any>,
    rejectionPatterns: any[]
  ): Promise<any[]> {
    const enhancedMessages = [...messages];
    
    // Add system message with user preferences if available
    if (Object.keys(writingStyle).length > 0 || rejectionPatterns.length > 0) {
      const preferenceInstructions = [];
      
      // Add writing style preferences
      if (writingStyle.tone) {
        preferenceInstructions.push(`Use a ${writingStyle.tone.value} tone`);
      }
      if (writingStyle.formality) {
        preferenceInstructions.push(`Maintain ${writingStyle.formality.value} formality level`);
      }
      if (writingStyle.length_preference) {
        preferenceInstructions.push(`Keep content ${writingStyle.length_preference.value}`);
      }
      
      // Add rejection pattern avoidance
      if (rejectionPatterns.length > 0) {
        const commonReasons = rejectionPatterns
          .map(p => p.feedback_reason)
          .filter(r => r)
          .slice(0, 3); // Top 3 most recent reasons
        
        if (commonReasons.length > 0) {
          preferenceInstructions.push(
            `Avoid these issues from previous feedback: ${commonReasons.join(', ')}`
          );
        }
      }
      
      if (preferenceInstructions.length > 0) {
        enhancedMessages.unshift({
          role: 'system',
          content: `User preferences: ${preferenceInstructions.join('. ')}.`
        });
      }
    }
    
    return enhancedMessages;
  }

  /**
   * Record user feedback for this agent's output.
   */
  async recordFeedback(
    feedbackType: string,
    feedbackValue: string,
    contentType: string,
    originalContent?: string,
    modifiedContent?: string,
    feedbackReason?: string,
    workflowId?: string
  ): Promise<boolean> {
    return await memorySystem.recordFeedback(
      this.tenantContext,
      {
        feedback_type: feedbackType,
        feedback_value: feedbackValue,
        content_type: contentType,
        agent_name: this.config.name,
        original_content: originalContent,
        modified_content: modifiedContent,
        feedback_reason: feedbackReason,
        workflow_id: workflowId
      }
    );
  }

  /**
   * Get user preferences for this agent.
   */
  async getUserPreferences(category?: string): Promise<Record<string, any>> {
    return await memorySystem.getPreferences(
      this.tenantContext,
      category,
      'agent_specific',
      this.config.name
    );
  }

  protected log(message: string, data?: any) {
    console.log(`[${this.config.name}][${this.tenantId}] ${message}`, data || '');
  }

  protected logError(message: string, error?: any) {
    console.error(`[${this.config.name}][${this.tenantId}] ERROR: ${message}`, error || '');
  }
}