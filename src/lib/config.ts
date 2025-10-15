/**
 * 前端配置管理 - 与后端配置保持一致
 */

export interface ModelConfig {
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  availableModels: string[];
  temperature?: number;
  timeout?: number;
  maxTokens?: number;
}

export interface SystemConfig {
  openai: ModelConfig;
  vllm: ModelConfig;
  fastgpt: {
    apiUrl: string;
    apiKey: string;
    timeout?: number;
  };
  workflow: {
    maxRounds: number;
    timeoutSeconds: number;
    retryAttempts: number;
  };
  tenant: {
    maxAgentsPerTenant: number;
    maxConcurrentWorkflows: number;
  };
}

export enum ModelProvider {
  OPENAI = 'openai',
  VLLM = 'vllm',
  FASTGPT = 'fastgpt'
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: SystemConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 从服务器获取配置
   */
  async loadConfig(): Promise<SystemConfig> {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to load configuration');
      }
      this.config = await response.json();
      return this.config!;
    } catch (error) {
      console.error('Error loading configuration:', error);
      // 返回默认配置
      return this.getDefaultConfig();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SystemConfig {
    if (!this.config) {
      return this.getDefaultConfig();
    }
    return this.config;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): SystemConfig {
    return {
      openai: {
        apiUrl: process.env.NEXT_PUBLIC_OPENAI_API_URL || 'https://api.openai.com/v1',
        apiKey: '', // 前端不存储API密钥
        defaultModel: process.env.NEXT_PUBLIC_OPENAI_DEFAULT_MODEL || 'gpt-4',
        availableModels: (process.env.NEXT_PUBLIC_OPENAI_AVAILABLE_MODELS || 'gpt-4,gpt-4-turbo,gpt-3.5-turbo,gpt-4o').split(','),
        temperature: 0.1,
        timeout: 600,
        maxTokens: 4000
      },
      vllm: {
        apiUrl: process.env.NEXT_PUBLIC_VLLM_API_URL || 'http://localhost:8000',
        apiKey: '', // 前端不存储API密钥
        defaultModel: process.env.NEXT_PUBLIC_VLLM_DEFAULT_MODEL || 'llama-2-7b-chat',
        availableModels: (process.env.NEXT_PUBLIC_VLLM_AVAILABLE_MODELS || 'llama-2-7b-chat,llama-2-13b-chat,codellama-7b-instruct').split(','),
        temperature: 0.1,
        timeout: 120,
        maxTokens: 2000
      },
      fastgpt: {
        apiUrl: process.env.NEXT_PUBLIC_FASTGPT_API_URL || 'http://localhost:3000',
        apiKey: '', // 前端不存储API密钥
        timeout: 30
      },
      workflow: {
        maxRounds: parseInt(process.env.NEXT_PUBLIC_WORKFLOW_MAX_ROUNDS || '20'),
        timeoutSeconds: parseInt(process.env.NEXT_PUBLIC_WORKFLOW_TIMEOUT_SECONDS || '3600'),
        retryAttempts: parseInt(process.env.NEXT_PUBLIC_WORKFLOW_RETRY_ATTEMPTS || '3')
      },
      tenant: {
        maxAgentsPerTenant: parseInt(process.env.NEXT_PUBLIC_MAX_AGENTS_PER_TENANT || '10'),
        maxConcurrentWorkflows: parseInt(process.env.NEXT_PUBLIC_MAX_CONCURRENT_WORKFLOWS || '5')
      }
    };
  }

  /**
   * 获取指定提供商的模型配置
   */
  getModelConfig(provider: ModelProvider): ModelConfig | null {
    const config = this.getConfig();
    switch (provider) {
      case ModelProvider.OPENAI:
        return config.openai;
      case ModelProvider.VLLM:
        return config.vllm;
      default:
        return null;
    }
  }

  /**
   * 获取所有可用模型
   */
  getAvailableModels(): Record<string, string[]> {
    const config = this.getConfig();
    return {
      openai: config.openai.availableModels,
      vllm: config.vllm.availableModels
    };
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig: Partial<SystemConfig>): Promise<boolean> {
    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to update configuration');
      }

      // 重新加载配置
      await this.loadConfig();
      return true;
    } catch (error) {
      console.error('Error updating configuration:', error);
      return false;
    }
  }

  /**
   * 验证配置
   */
  validateConfig(config: SystemConfig): string[] {
    const errors: string[] = [];

    // 验证OpenAI配置
    if (!config.openai.apiUrl) {
      errors.push('OpenAI API URL is required');
    }
    if (!config.openai.defaultModel) {
      errors.push('OpenAI default model is required');
    }
    if (config.openai.availableModels.length === 0) {
      errors.push('At least one OpenAI model must be available');
    }

    // 验证VLLM配置
    if (!config.vllm.apiUrl) {
      errors.push('VLLM API URL is required');
    }
    if (!config.vllm.defaultModel) {
      errors.push('VLLM default model is required');
    }

    // 验证工作流配置
    if (config.workflow.maxRounds <= 0) {
      errors.push('Workflow max rounds must be greater than 0');
    }
    if (config.workflow.timeoutSeconds <= 0) {
      errors.push('Workflow timeout must be greater than 0');
    }

    return errors;
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();

// 导出便捷函数
export const getConfig = () => configManager.getConfig();
export const getModelConfig = (provider: ModelProvider) => configManager.getModelConfig(provider);
export const getAvailableModels = () => configManager.getAvailableModels();