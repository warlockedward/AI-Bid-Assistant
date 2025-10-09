/**
 * Memory system implementation for tenant-aware preference and feedback storage.
 * Provides TypeScript interface to the Python memory backend.
 */

import { TenantContext } from '../tenants/tenant-context';

export interface UserPreference {
  category: string;
  key: string;
  value: any;
  priority: number;
  confidence: number;
  scope: string;
  scope_id?: string;
  learned: boolean;
}

export interface UserFeedback {
  feedback_type: string;
  feedback_value: string;
  content_type: string;
  agent_name?: string;
  original_content?: string;
  modified_content?: string;
  feedback_reason?: string;
  workflow_id?: string;
}

export interface RejectionPattern {
  content_type: string;
  agent_name?: string;
  feedback_reason?: string;
  original_content?: string;
  modified_content?: string;
  timestamp: string;
  context_data?: Record<string, any>;
}

export interface MemoryStats {
  total_memories: number;
  by_type: Record<string, number>;
  cache_size: number;
  preferences_count: number;
  recent_feedback_count: number;
}

export class TenantMemorySystem {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Store a user preference with tenant isolation.
   */
  async storePreference(
    context: TenantContext,
    category: string,
    key: string,
    value: any,
    scope: string = 'global',
    scopeId?: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': context.tenant_id,
          'X-User-ID': context.user_id,
        },
        body: JSON.stringify({
          category,
          key,
          value,
          scope,
          scope_id: scopeId,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error storing preference:', error);
      return false;
    }
  }

  /**
   * Get user preferences with caching and tenant isolation.
   */
  async getPreferences(
    context: TenantContext,
    category?: string,
    scope?: string,
    scopeId?: string
  ): Promise<Record<string, Record<string, UserPreference>>> {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (scope) params.append('scope', scope);
      if (scopeId) params.append('scope_id', scopeId);

      const response = await fetch(
        `${this.baseUrl}/api/memory/preferences?${params.toString()}`,
        {
          headers: {
            'X-Tenant-ID': context.tenant_id,
            'X-User-ID': context.user_id,
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }
      return {};
    } catch (error) {
      console.error('Error getting preferences:', error);
      return {};
    }
  }

  /**
   * Record user feedback and optionally learn from it.
   */
  async recordFeedback(
    context: TenantContext,
    feedback: UserFeedback,
    autoLearn: boolean = true
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': context.tenant_id,
          'X-User-ID': context.user_id,
        },
        body: JSON.stringify({
          ...feedback,
          auto_learn: autoLearn,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error recording feedback:', error);
      return false;
    }
  }

  /**
   * Get patterns from user's rejection history.
   */
  async getRejectionPatterns(
    context: TenantContext,
    contentType?: string,
    agentName?: string,
    daysBack: number = 30
  ): Promise<RejectionPattern[]> {
    try {
      const params = new URLSearchParams();
      if (contentType) params.append('content_type', contentType);
      if (agentName) params.append('agent_name', agentName);
      params.append('days_back', daysBack.toString());

      const response = await fetch(
        `${this.baseUrl}/api/memory/rejections?${params.toString()}`,
        {
          headers: {
            'X-Tenant-ID': context.tenant_id,
            'X-User-ID': context.user_id,
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Error getting rejection patterns:', error);
      return [];
    }
  }

  /**
   * Get user's learned writing style preferences.
   */
  async getWritingStyle(
    context: TenantContext,
    scope: string = 'global',
    scopeId?: string
  ): Promise<Record<string, UserPreference>> {
    try {
      const params = new URLSearchParams();
      params.append('scope', scope);
      if (scopeId) params.append('scope_id', scopeId);

      const response = await fetch(
        `${this.baseUrl}/api/memory/writing-style?${params.toString()}`,
        {
          headers: {
            'X-Tenant-ID': context.tenant_id,
            'X-User-ID': context.user_id,
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }
      return {};
    } catch (error) {
      console.error('Error getting writing style:', error);
      return {};
    }
  }

  /**
   * Store memory of a user interaction.
   */
  async storeInteraction(
    context: TenantContext,
    interactionType: string,
    interactionData: Record<string, any>,
    contextTags?: string[],
    expiresInDays?: number
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': context.tenant_id,
          'X-User-ID': context.user_id,
        },
        body: JSON.stringify({
          interaction_type: interactionType,
          interaction_data: interactionData,
          context_tags: contextTags,
          expires_in_days: expiresInDays,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error storing interaction:', error);
      return false;
    }
  }

  /**
   * Get memory usage statistics.
   */
  async getMemoryStats(context: TenantContext): Promise<MemoryStats | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/stats`, {
        headers: {
          'X-Tenant-ID': context.tenant_id,
          'X-User-ID': context.user_id,
        },
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return null;
    }
  }

  /**
   * Clean up expired memories.
   */
  async cleanupExpiredMemories(context: TenantContext): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': context.tenant_id,
          'X-User-ID': context.user_id,
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result.cleaned_count || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error cleaning up memories:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const memorySystem = new TenantMemorySystem();