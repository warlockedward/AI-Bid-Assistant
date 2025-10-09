/**
 * Integration tests for tenant-aware RAG service.
 * Tests RAG service integration, tenant isolation, and fallback strategies.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios from 'axios';
import { TenantRAGService } from '@/services/tenant-rag-service';
import { TenantContext } from '@/tenants/tenant-context';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TenantRAGService Integration Tests', () => {
  let ragService: TenantRAGService;
  let tenantContext: TenantContext;
  let otherTenantContext: TenantContext;

  beforeEach(() => {
    ragService = new TenantRAGService();
    
    tenantContext = {
      tenantId: 'tenant-123',
      userId: 'user-456',
      userEmail: 'test@example.com',
      userName: 'Test User',
      tenantName: 'Test Tenant'
    };

    otherTenantContext = {
      tenantId: 'tenant-789',
      userId: 'user-101',
      userEmail: 'other@example.com',
      userName: 'Other User',
      tenantName: 'Other Tenant'
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Tenant Configuration', () => {
    it('should load tenant-specific RAG configuration', async () => {
      // Mock tenant config API response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://tenant-specific-rag.example.com',
          rag_api_key: 'tenant-specific-key',
          knowledge_base_ids: ['kb1', 'kb2'],
          rag_timeout: 25000,
          enable_rag_fallback: true
        }
      });

      // Mock RAG API response
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          data: [
            {
              id: 'result1',
              title: 'Test Result',
              content: 'Test content',
              score: 0.9,
              source: 'Test KB'
            }
          ],
          total: 1
        }
      });

      const result = await ragService.query(tenantContext, {
        query: 'test query',
        maxResults: 5
      });

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/tenants/config', {
        headers: {
          'X-Tenant-ID': tenantContext.tenantId,
          'X-User-ID': tenantContext.userId
        }
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://tenant-specific-rag.example.com',
        expect.objectContaining({
          query: 'test query',
          max_results: 5,
          knowledge_base_ids: ['kb1', 'kb2']
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer tenant-specific-key'
          }),
          timeout: 25000
        })
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Test Result');
    });

    it('should use default configuration when tenant config fails', async () => {
      // Mock tenant config API failure
      mockedAxios.get.mockRejectedValueOnce(new Error('Config API failed'));

      // Mock RAG API response with default endpoint
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          data: [
            {
              id: 'default_result',
              title: 'Default Result',
              content: 'Default content',
              score: 0.8
            }
          ]
        }
      });

      // Set environment variable for default endpoint
      process.env.FASTGPT_RAG_ENDPOINT = 'https://default-rag.example.com';

      const result = await ragService.query(tenantContext, {
        query: 'test query'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://default-rag.example.com',
        expect.any(Object),
        expect.any(Object)
      );

      expect(result.results).toHaveLength(1);
    });
  });

  describe('Tenant Isolation', () => {
    it('should use different configurations for different tenants', async () => {
      // Mock different configs for different tenants
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            rag_api_url: 'https://tenant1-rag.example.com',
            rag_api_key: 'tenant1-key'
          }
        })
        .mockResolvedValueOnce({
          data: {
            rag_api_url: 'https://tenant2-rag.example.com',
            rag_api_key: 'tenant2-key'
          }
        });

      // Mock RAG responses
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { data: [{ id: 'tenant1_result' }] }
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { data: [{ id: 'tenant2_result' }] }
        });

      // Query for first tenant
      await ragService.query(tenantContext, { query: 'test1' });

      // Query for second tenant
      await ragService.query(otherTenantContext, { query: 'test2' });

      // Verify different endpoints were called
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        'https://tenant1-rag.example.com',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer tenant1-key'
          })
        })
      );

      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        'https://tenant2-rag.example.com',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer tenant2-key'
          })
        })
      );
    });

    it('should include tenant-specific filters in RAG queries', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://rag.example.com',
          default_rag_filters: {
            department: 'engineering',
            access_level: 'internal'
          }
        }
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { data: [] }
      });

      await ragService.query(tenantContext, {
        query: 'test query',
        filters: { project: 'project1' }
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://rag.example.com',
        expect.objectContaining({
          filters: {
            department: 'engineering',
            access_level: 'internal',
            project: 'project1',
            tenant_id: tenantContext.tenantId
          }
        }),
        expect.any(Object)
      );
    });
  });

  describe('Fallback Strategies', () => {
    it('should use fallback endpoints when primary fails', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://primary-rag.example.com',
          fallback_rag_endpoints: [
            'https://fallback1-rag.example.com',
            'https://fallback2-rag.example.com'
          ],
          enable_rag_fallback: true
        }
      });

      // Primary endpoint fails
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Primary endpoint failed'))
        .mockResolvedValueOnce({
          status: 200,
          data: {
            data: [
              {
                id: 'fallback_result',
                title: 'Fallback Result',
                content: 'Fallback content',
                score: 0.7
              }
            ]
          }
        });

      const result = await ragService.query(tenantContext, {
        query: 'test query'
      });

      // Should have tried primary first, then fallback
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        'https://primary-rag.example.com',
        expect.any(Object),
        expect.any(Object)
      );
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        'https://fallback1-rag.example.com',
        expect.any(Object),
        expect.any(Object)
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('fallback_result');
    });

    it('should return mock data when all endpoints fail', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://primary-rag.example.com',
          fallback_rag_endpoints: ['https://fallback-rag.example.com'],
          enable_rag_fallback: true
        }
      });

      // All endpoints fail
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockRejectedValueOnce(new Error('Fallback failed'));

      const result = await ragService.query(tenantContext, {
        query: 'architecture best practices'
      });

      // Should return mock data
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].source).toBeDefined();
      expect(result.totalResults).toBeGreaterThan(0);
    });

    it('should not use fallback when disabled', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://primary-rag.example.com',
          fallback_rag_endpoints: ['https://fallback-rag.example.com'],
          enable_rag_fallback: false
        }
      });

      mockedAxios.post.mockRejectedValueOnce(new Error('Primary failed'));

      await expect(
        ragService.query(tenantContext, { query: 'test query' })
      ).rejects.toThrow('Primary failed');

      // Should only have tried primary endpoint
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Normalization', () => {
    it('should normalize FastGPT response format', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { rag_api_url: 'https://rag.example.com' }
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          data: [
            {
              id: 'fastgpt_1',
              title: 'FastGPT Result',
              content: 'FastGPT content',
              score: 0.95,
              kb_name: 'FastGPT KB',
              metadata: { category: 'technical' }
            }
          ],
          total: 1,
          query_id: 'fastgpt_query_123'
        }
      });

      const result = await ragService.query(tenantContext, {
        query: 'test query'
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        id: 'fastgpt_1',
        title: 'FastGPT Result',
        content: 'FastGPT content',
        relevance: 0.95,
        source: 'FastGPT KB',
        metadata: { category: 'technical' }
      });
      expect(result.queryId).toBe('fastgpt_query_123');
    });

    it('should normalize generic response format', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { rag_api_url: 'https://rag.example.com' }
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          results: [
            {
              id: 'generic_1',
              title: 'Generic Result',
              content: 'Generic content',
              relevance: 0.8,
              source: 'Generic KB'
            }
          ],
          total_results: 1,
          average_relevance: 0.8,
          sources: ['Generic KB']
        }
      });

      const result = await ragService.query(tenantContext, {
        query: 'test query'
      });

      expect(result.results).toHaveLength(1);
      expect(result.totalResults).toBe(1);
      expect(result.averageRelevance).toBe(0.8);
      expect(result.sources).toEqual(['Generic KB']);
    });
  });

  describe('Health Monitoring', () => {
    it('should check endpoint health status', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://primary-rag.example.com',
          fallback_rag_endpoints: ['https://fallback-rag.example.com']
        }
      });

      // Mock health check responses
      mockedAxios.post
        .mockResolvedValueOnce({ status: 200, data: {} }) // Primary healthy
        .mockRejectedValueOnce(new Error('Fallback offline')); // Fallback unhealthy

      const healthStatus = await ragService.getHealthStatus(tenantContext);

      expect(healthStatus.status).toBe('degraded');
      expect(healthStatus.endpoints).toHaveLength(2);
      expect(healthStatus.endpoints[0].status).toBe('online');
      expect(healthStatus.endpoints[1].status).toBe('offline');
    });

    it('should report healthy status when all endpoints are online', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://primary-rag.example.com',
          fallback_rag_endpoints: ['https://fallback-rag.example.com']
        }
      });

      // All endpoints healthy
      mockedAxios.post
        .mockResolvedValueOnce({ status: 200, data: {} })
        .mockResolvedValueOnce({ status: 200, data: {} });

      const healthStatus = await ragService.getHealthStatus(tenantContext);

      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.endpoints.every(e => e.status === 'online')).toBe(true);
    });

    it('should report unhealthy status when all endpoints are offline', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://primary-rag.example.com',
          fallback_rag_endpoints: ['https://fallback-rag.example.com']
        }
      });

      // All endpoints unhealthy
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Primary offline'))
        .mockRejectedValueOnce(new Error('Fallback offline'));

      const healthStatus = await ragService.getHealthStatus(tenantContext);

      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.endpoints.every(e => e.status === 'offline')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://slow-rag.example.com',
          rag_timeout: 1000
        }
      });

      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 1000ms exceeded'
      });

      const result = await ragService.query(tenantContext, {
        query: 'test query'
      });

      // Should fall back to mock data
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should handle malformed responses gracefully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { rag_api_url: 'https://rag.example.com' }
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          // Malformed response - missing expected fields
          unexpected_field: 'unexpected_value'
        }
      });

      const result = await ragService.query(tenantContext, {
        query: 'test query'
      });

      // Should handle gracefully and return empty results
      expect(result.results).toEqual([]);
      expect(result.totalResults).toBe(0);
    });

    it('should retry on 5xx server errors', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rag_api_url: 'https://rag.example.com',
          rag_retry_attempts: 2
        }
      });

      // First call fails with 500, second succeeds
      mockedAxios.post
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({
          status: 200,
          data: { data: [{ id: 'retry_success' }] }
        });

      const result = await ragService.query(tenantContext, {
        query: 'test query'
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(result.results[0].id).toBe('retry_success');
    });
  });
});