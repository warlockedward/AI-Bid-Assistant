/**
 * LLM配置Hook
 * 提供LLM配置的读取和更新功能
 */
import { useState, useEffect, useCallback } from 'react';

export interface LLMConfig {
  apiKey: string;
  apiBase: string;
  llmModel: string;
  vlmModel: string;
  embeddingModel: string;
  rerankModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopP: number;
  timeout: number;
  maxRetries: number;
  cacheEnabled: boolean;
  cacheTtl: number;
  maxConcurrentRequests: number;
}

export interface UseLLMConfigReturn {
  config: LLMConfig | null;
  loading: boolean;
  error: string | null;
  loadConfig: () => Promise<void>;
  saveConfig: (config: LLMConfig) => Promise<boolean>;
  testConnection: (config: LLMConfig) => Promise<{ success: boolean; message: string }>;
  resetConfig: () => Promise<boolean>;
}

export function useLLMConfig(tenantId: string = 'default'): UseLLMConfigReturn {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/settings/llm-config?tenant_id=${tenantId}`);
      if (!response.ok) {
        throw new Error('Failed to load configuration');
      }
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to load LLM config:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const saveConfig = useCallback(
    async (newConfig: LLMConfig): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/settings/llm-config?tenant_id=${tenantId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newConfig),
        });

        if (!response.ok) {
          throw new Error('Failed to save configuration');
        }

        const result = await response.json();
        if (result.success) {
          setConfig(newConfig);
          return true;
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to save LLM config:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [tenantId]
  );

  const testConnection = useCallback(
    async (testConfig: LLMConfig): Promise<{ success: boolean; message: string }> => {
      try {
        const response = await fetch('/api/settings/llm-config/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testConfig),
        });

        const result = await response.json();
        return {
          success: result.success,
          message: result.message,
        };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Connection test failed',
        };
      }
    },
    []
  );

  const resetConfig = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/settings/llm-config?tenant_id=${tenantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to reset configuration');
      }

      await loadConfig();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to reset LLM config:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [tenantId, loadConfig]);

  // 初始加载
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    testConnection,
    resetConfig,
  };
}

export default useLLMConfig;
