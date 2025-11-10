import { BaseAgent } from './base-agent';
import { AgentConfig } from '@/types';
import { TenantContext } from '@/tenants/tenant-context';
import { tenantRAGService, RAGQuery, RAGResponse } from '@/services/tenant-rag-service';
import axios from 'axios';

export class KnowledgeRetrievalAgent extends BaseAgent {
  constructor(tenantContext: TenantContext, tenantSettings: any) {
    const config: AgentConfig = {
      name: 'KnowledgeRetrievalAgent',
      systemMessage: `You are a knowledge retrieval expert. Your tasks are:
1. Retrieve relevant industry knowledge and best practices based on bid requirements
2. Get relevant cases and templates from the knowledge base
3. Provide accurate and relevant background information
4. Ensure retrieved information matches current project requirements

Please ensure the retrieved information is accurate, relevant, and up-to-date.`,
      llmConfig: {
        model: 'gpt-4',
        apiKey: '',
        temperature: 0.2,
        maxTokens: 3000,
        timeout: 25000
      },
      humanInputMode: 'NEVER',
      maxConsecutiveAutoReply: 1
    };

    super(config, tenantContext, tenantSettings);
  }

  async execute(input: {
    query: string;
    context: any;
    requirements: any[];
    contentType?: string;
    maxResults?: number;
    minRelevanceScore?: number;
  }): Promise<{
    retrievedKnowledge: any[];
    relevanceScore: number;
    sources: string[];
    processingTime?: number;
    ragHealth?: string;
  }> {
    this.log('Starting knowledge retrieval', { query: input.query });

    try {
      // Prepare RAG query with tenant-specific filters
      const ragQuery: RAGQuery = {
        query: input.query,
        context: {
          ...input.context,
          requirements: input.requirements,
          tenant_id: this.tenantContext.tenant_id,
          user_id: this.tenantContext.user_id
        },
        filters: {
          content_type: input.contentType,
          tenant_id: this.tenantContext.tenant_id
        },
        maxResults: input.maxResults || 10,
        minRelevanceScore: input.minRelevanceScore || 0.3
      };

      // Query tenant-aware RAG service
      const ragResponse: RAGResponse = await tenantRAGService.query(
        this.tenantContext,
        ragQuery
      );
      
      // Get user preferences for knowledge processing
      const userPrefs = await this.getUserPreferences('knowledge_retrieval');
      
      // Use LLM to process and optimize retrieval results
      const messages = [
        {
          role: 'system',
          content: this.config.systemMessage
        },
        {
          role: 'user',
          content: `Based on the following query and retrieval results, provide structured knowledge information:

Query: ${input.query}
Context: ${JSON.stringify(input.context)}
Requirements: ${JSON.stringify(input.requirements)}
User Preferences: ${JSON.stringify(userPrefs)}

Retrieval Results:
${JSON.stringify(ragResponse.results)}

Please format the response as structured knowledge that addresses the query and requirements.`
        }
      ];

      const llmResponse = await this.callLLM(messages);

      const result = {
        retrievedKnowledge: ragResponse.results.map(r => ({
          id: r.id,
          title: r.title,
          content: r.content,
          relevance: r.relevance,
          source: r.source,
          metadata: r.metadata
        })),
        relevanceScore: ragResponse.averageRelevance,
        sources: ragResponse.sources,
        processingTime: ragResponse.processingTime,
        ragHealth: await this.checkRAGHealth()
      };

      this.log('Knowledge retrieval completed', {
        knowledgeCount: result.retrievedKnowledge.length,
        relevanceScore: result.relevanceScore,
        sources: result.sources.length,
        processingTime: result.processingTime
      });

      // Store successful interaction in memory
      await this.recordSuccessfulRetrieval(input, result);

      return result;

    } catch (error) {
      this.logError('Knowledge retrieval failed', error);
      
      // Record failure for learning
      await this.recordRetrievalFailure(input, error);
      
      throw error;
    }
  }

  /**
   * Check RAG service health for this tenant.
   */
  private async checkRAGHealth(): Promise<string> {
    try {
      const healthStatus = await tenantRAGService.getHealthStatus(this.tenantContext);
      return healthStatus.status;
    } catch (error) {
      this.logError('Failed to check RAG health', error);
      return 'unknown';
    }
  }

  /**
   * Record successful knowledge retrieval for learning.
   */
  private async recordSuccessfulRetrieval(
    input: any,
    result: any
  ): Promise<void> {
    try {
      // Store interaction memory for future optimization
      await this.memorySystem.storeInteraction(
        this.tenantContext,
        'knowledge_retrieval_success',
        {
          query: input.query,
          context: input.context,
          results_count: result.retrievedKnowledge.length,
          relevance_score: result.relevanceScore,
          sources: result.sources,
          processing_time: result.processingTime
        },
        ['knowledge_retrieval', 'success', 'rag'],
        30 // expires in 30 days
      );
    } catch (error) {
      this.logError('Failed to record successful retrieval', error);
    }
  }

  /**
   * Record retrieval failure for learning and improvement.
   */
  private async recordRetrievalFailure(
    input: any,
    error: any
  ): Promise<void> {
    try {
      await this.memorySystem.storeInteraction(
        this.tenantContext,
        'knowledge_retrieval_failure',
        {
          query: input.query,
          context: input.context,
          error_message: error.message,
          error_type: error.constructor.name,
          timestamp: new Date().toISOString()
        },
        ['knowledge_retrieval', 'failure', 'rag'],
        7 // expires in 7 days
      );
    } catch (memoryError) {
      this.logError('Failed to record retrieval failure', memoryError);
    }
  }

  /**
   * Get retrieval statistics for this tenant.
   */
  async getRetrievalStats(): Promise<{
    totalQueries: number;
    successRate: number;
    averageRelevance: number;
    commonSources: string[];
    ragHealthHistory: any[];
  }> {
    try {
      // This would typically query the memory system for statistics
      // For now, return mock stats
      return {
        totalQueries: 0,
        successRate: 0.95,
        averageRelevance: 0.82,
        commonSources: ['Technical Knowledge Base', 'Bid Template Library'],
        ragHealthHistory: []
      };
    } catch (error) {
      this.logError('Failed to get retrieval stats', error);
      return {
        totalQueries: 0,
        successRate: 0,
        averageRelevance: 0,
        commonSources: [],
        ragHealthHistory: []
      };
    }
  }

  /**
   * Test RAG connectivity for this tenant.
   */
  async testRAGConnectivity(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const healthStatus = await tenantRAGService.getHealthStatus(this.tenantContext);
      
      return {
        status: healthStatus.status,
        details: {
          endpoints: healthStatus.endpoints,
          timestamp: new Date().toISOString(),
          tenant_id: this.tenantContext.tenant_id
        }
      };
    } catch (error) {
      this.logError('RAG connectivity test failed', error);
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          tenant_id: this.tenantContext.tenant_id
        }
      };
    }
  }
}