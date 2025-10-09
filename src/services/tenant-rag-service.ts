/**
 * Tenant-aware RAG (Retrieval-Augmented Generation) service.
 * Integrates with tenant-specific knowledge bases and provides fallback strategies.
 */

import { TenantContext } from '@/tenants/tenant-context';
import axios, { AxiosResponse } from 'axios';

export interface RAGQuery {
  query: string;
  context?: Record<string, any>;
  filters?: Record<string, any>;
  maxResults?: number;
  minRelevanceScore?: number;
}

export interface RAGResult {
  id: string;
  title: string;
  content: string;
  relevance: number;
  source: string;
  metadata?: Record<string, any>;
}

export interface RAGResponse {
  results: RAGResult[];
  totalResults: number;
  averageRelevance: number;
  sources: string[];
  queryId?: string;
  processingTime?: number;
}

export interface TenantRAGConfig {
  primaryEndpoint?: string;
  fallbackEndpoints?: string[];
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  knowledgeBaseIds?: string[];
  defaultFilters?: Record<string, any>;
  enableFallback?: boolean;
  minRelevanceScore?: number;
  maxResults?: number;
}

export class TenantRAGService {
  private defaultConfig: TenantRAGConfig = {
    timeout: 30000,
    retryAttempts: 3,
    enableFallback: true,
    minRelevanceScore: 0.3,
    maxResults: 10
  };

  /**
   * Query knowledge base with tenant-specific configuration.
   */
  async query(
    tenantContext: TenantContext,
    ragQuery: RAGQuery
  ): Promise<RAGResponse> {
    const config = await this.getTenantRAGConfig(tenantContext);
    
    // Try primary endpoint first
    if (config.primaryEndpoint) {
      try {
        return await this.queryEndpoint(config.primaryEndpoint, ragQuery, config);
      } catch (error) {
        console.warn(`Primary RAG endpoint failed for tenant ${tenantContext.tenant_id}:`, error);
        
        if (!config.enableFallback) {
          throw error;
        }
      }
    }

    // Try fallback endpoints
    if (config.fallbackEndpoints && config.fallbackEndpoints.length > 0) {
      for (const endpoint of config.fallbackEndpoints) {
        try {
          console.log(`Trying fallback RAG endpoint: ${endpoint}`);
          return await this.queryEndpoint(endpoint, ragQuery, config);
        } catch (error) {
          console.warn(`Fallback RAG endpoint ${endpoint} failed:`, error);
          continue;
        }
      }
    }

    // If all endpoints fail, return mock data
    console.warn(`All RAG endpoints failed for tenant ${tenantContext.tenant_id}, using mock data`);
    return this.getMockRAGResponse(ragQuery);
  }

  /**
   * Query a specific RAG endpoint.
   */
  private async queryEndpoint(
    endpoint: string,
    ragQuery: RAGQuery,
    config: TenantRAGConfig
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    
    const requestData = {
      query: ragQuery.query,
      context: ragQuery.context || {},
      filters: {
        ...config.defaultFilters,
        ...ragQuery.filters
      },
      max_results: ragQuery.maxResults || config.maxResults || 10,
      min_relevance: ragQuery.minRelevanceScore || 0.3,
      knowledge_base_ids: config.knowledgeBaseIds
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    let attempt = 0;
    const maxAttempts = config.retryAttempts || 3;

    while (attempt < maxAttempts) {
      try {
        const response: AxiosResponse = await axios.post(endpoint, requestData, {
          headers,
          timeout: config.timeout || 30000,
          validateStatus: (status) => status < 500 // Retry on 5xx errors
        });

        if (response.status >= 400) {
          throw new Error(`RAG API returned status ${response.status}: ${response.statusText}`);
        }

        const processingTime = Date.now() - startTime;
        
        return this.normalizeRAGResponse(response.data, processingTime);
        
      } catch (error) {
        attempt++;
        
        if (attempt >= maxAttempts) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retry attempts exceeded');
  }

  /**
   * Get tenant-specific RAG configuration.
   */
  private async getTenantRAGConfig(tenantContext: TenantContext): Promise<TenantRAGConfig> {
    try {
      // Get tenant configuration from API
      const response = await axios.get(`/api/tenants/config`, {
        headers: {
          'X-Tenant-ID': tenantContext.tenant_id,
          'X-User-ID': tenantContext.user_id
        }
      });

      const tenantConfig = response.data;
      
      return {
        ...this.defaultConfig,
        primaryEndpoint: tenantConfig.rag_api_url || process.env.FASTGPT_RAG_ENDPOINT,
        fallbackEndpoints: tenantConfig.fallback_rag_endpoints || [
          process.env.FALLBACK_RAG_ENDPOINT_1,
          process.env.FALLBACK_RAG_ENDPOINT_2
        ].filter(Boolean),
        apiKey: tenantConfig.rag_api_key || process.env.FASTGPT_API_KEY,
        knowledgeBaseIds: tenantConfig.knowledge_base_ids || [],
        defaultFilters: tenantConfig.default_rag_filters || {},
        timeout: tenantConfig.rag_timeout || this.defaultConfig.timeout,
        retryAttempts: tenantConfig.rag_retry_attempts || this.defaultConfig.retryAttempts,
        enableFallback: tenantConfig.enable_rag_fallback !== false
      };
      
    } catch (error) {
      console.warn('Failed to get tenant RAG config, using defaults:', error);
      
      return {
        ...this.defaultConfig,
        primaryEndpoint: process.env.FASTGPT_RAG_ENDPOINT,
        fallbackEndpoints: [
          process.env.FALLBACK_RAG_ENDPOINT_1,
          process.env.FALLBACK_RAG_ENDPOINT_2
        ].filter(Boolean) as string[],
        apiKey: process.env.FASTGPT_API_KEY
      };
    }
  }

  /**
   * Normalize different RAG API response formats.
   */
  private normalizeRAGResponse(data: any, processingTime: number): RAGResponse {
    // Handle different response formats from various RAG providers
    
    // FastGPT format
    if (data.data && Array.isArray(data.data)) {
      return {
        results: data.data.map((item: any, index: number) => ({
          id: item.id || `result_${index}`,
          title: item.title || item.name || `Result ${index + 1}`,
          content: item.content || item.text || '',
          relevance: item.score || item.relevance || 0.5,
          source: item.source || item.kb_name || 'Unknown',
          metadata: item.metadata || {}
        })),
        totalResults: data.total || data.data.length,
        averageRelevance: this.calculateAverageRelevance(data.data),
        sources: this.extractSources(data.data),
        queryId: data.query_id,
        processingTime
      };
    }
    
    // Generic format
    if (data.results && Array.isArray(data.results)) {
      return {
        results: data.results.map((item: any, index: number) => ({
          id: item.id || `result_${index}`,
          title: item.title || `Result ${index + 1}`,
          content: item.content || '',
          relevance: item.relevance || 0.5,
          source: item.source || 'Unknown',
          metadata: item.metadata || {}
        })),
        totalResults: data.total_results || data.results.length,
        averageRelevance: data.average_relevance || this.calculateAverageRelevance(data.results),
        sources: data.sources || this.extractSources(data.results),
        queryId: data.query_id,
        processingTime
      };
    }

    // Fallback for unknown formats
    return {
      results: [],
      totalResults: 0,
      averageRelevance: 0,
      sources: [],
      processingTime
    };
  }

  /**
   * Calculate average relevance score.
   */
  private calculateAverageRelevance(results: any[]): number {
    if (!results || results.length === 0) return 0;
    
    const total = results.reduce((sum, item) => {
      return sum + (item.score || item.relevance || 0.5);
    }, 0);
    
    return total / results.length;
  }

  /**
   * Extract unique sources from results.
   */
  private extractSources(results: any[]): string[] {
    if (!results || results.length === 0) return [];
    
    const sources = new Set<string>();
    results.forEach(item => {
      const source = item.source || item.kb_name || 'Unknown';
      sources.add(source);
    });
    
    return Array.from(sources);
  }

  /**
   * Generate mock RAG response for testing and fallback.
   */
  private getMockRAGResponse(ragQuery: RAGQuery): RAGResponse {
    const mockResults: RAGResult[] = [
      {
        id: 'mock_1',
        title: 'Multi-tenant Architecture Best Practices',
        content: 'Multi-tenant systems should implement proper data isolation, security boundaries, and performance optimization strategies. Key considerations include tenant-specific configurations, scalable data models, and efficient resource allocation.',
        relevance: 0.9,
        source: 'Technical Knowledge Base',
        metadata: {
          category: 'architecture',
          tags: ['multi-tenant', 'best-practices'],
          lastUpdated: '2024-01-15'
        }
      },
      {
        id: 'mock_2',
        title: 'Bid Document Template Standards',
        content: 'Standard bid documents should include executive summary, technical approach, project timeline, team qualifications, and pricing structure. Ensure compliance with industry standards and client requirements.',
        relevance: 0.8,
        source: 'Bid Template Library',
        metadata: {
          category: 'templates',
          tags: ['bid-documents', 'standards'],
          lastUpdated: '2024-01-10'
        }
      },
      {
        id: 'mock_3',
        title: 'Compliance Requirements Framework',
        content: 'Compliance frameworks must address data protection, security standards, audit requirements, and regulatory guidelines. Implement continuous monitoring and documentation processes.',
        relevance: 0.7,
        source: 'Compliance Knowledge Base',
        metadata: {
          category: 'compliance',
          tags: ['regulations', 'framework'],
          lastUpdated: '2024-01-12'
        }
      }
    ];

    // Filter results based on query relevance (simple keyword matching for mock)
    const queryLower = ragQuery.query.toLowerCase();
    const filteredResults = mockResults.filter(result => {
      const contentLower = (result.title + ' ' + result.content).toLowerCase();
      return contentLower.includes(queryLower) || 
             result.metadata?.tags?.some((tag: string) => queryLower.includes(tag));
    });

    return {
      results: filteredResults.slice(0, ragQuery.maxResults || 10),
      totalResults: filteredResults.length,
      averageRelevance: this.calculateAverageRelevance(filteredResults),
      sources: this.extractSources(filteredResults),
      queryId: `mock_${Date.now()}`,
      processingTime: 150
    };
  }

  /**
   * Test RAG endpoint connectivity.
   */
  async testEndpoint(endpoint: string, apiKey?: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await axios.post(endpoint, {
        query: 'test connectivity',
        max_results: 1
      }, {
        headers,
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      return response.status < 400;
      
    } catch (error) {
      console.warn(`RAG endpoint test failed: ${endpoint}`, error);
      return false;
    }
  }

  /**
   * Get RAG service health status for a tenant.
   */
  async getHealthStatus(tenantContext: TenantContext): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    endpoints: Array<{
      url: string;
      status: 'online' | 'offline';
      responseTime?: number;
    }>;
  }> {
    const config = await this.getTenantRAGConfig(tenantContext);
    const endpoints: { url: string; status: "online" | "offline"; responseTime?: number }[] = [];
    
    // Test primary endpoint
    if (config.primaryEndpoint) {
      const startTime = Date.now();
      const isOnline = await this.testEndpoint(config.primaryEndpoint, config.apiKey);
      endpoints.push({
        url: config.primaryEndpoint,
        status: isOnline ? 'online' : 'offline',
        responseTime: isOnline ? Date.now() - startTime : undefined
      });
    }

    // Test fallback endpoints
    if (config.fallbackEndpoints) {
      for (const endpoint of config.fallbackEndpoints) {
        const startTime = Date.now();
        const isOnline = await this.testEndpoint(endpoint, config.apiKey);
        endpoints.push({
          url: endpoint,
          status: isOnline ? 'online' : 'offline',
          responseTime: isOnline ? Date.now() - startTime : undefined
        });
      }
    }

    const onlineCount = endpoints.filter(e => e.status === 'online').length;
    const totalCount = endpoints.length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (onlineCount === totalCount && totalCount > 0) {
      status = 'healthy';
    } else if (onlineCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, endpoints };
  }
}

// Export singleton instance
export const tenantRAGService = new TenantRAGService();