'use client';

import { message } from 'antd';

// OCR引擎枚举
export type OCREngine = 'mineru' | 'marker-pdf' | 'olmocr';

// OCR模型性能信息
export interface EnginePerformance {
  accuracy: number;
  speed: 'fast' | 'medium' | 'slow';
  supportedFormats: string[];
}

// OCR模型信息
export interface OCRModelInfo {
  id: OCREngine;
  name: string;
  description: string;
  provider: string;
  version: string;
  performance: EnginePerformance;
  isAvailable: boolean;
}

// OCR配置
export interface OCRConfig {
  defaultEngine: OCREngine;
  availableEngines: OCREngine[];
  engineInfo: Record<OCREngine, EnginePerformance>;
}

// OCR处理选项
export interface OCRProcessingOptions {
  engine?: OCREngine;
  fileBuffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

// OCR处理结果
export interface OCRResult {
  success: boolean;
  content: string;
  engineUsed: OCREngine;
  processingTime: number;
  accuracy: number;
  error?: string;
}

class OCRService {
  private config: OCRConfig;
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/python';
    // 默认配置
    this.config = {
      defaultEngine: 'marker-pdf',
      availableEngines: ['mineru', 'marker-pdf', 'olmocr'],
      engineInfo: {
        'mineru': {
          accuracy: 95,
          speed: 'medium',
          supportedFormats: ['PDF', 'DOC', 'DOCX']
        },
        'marker-pdf': {
          accuracy: 92,
          speed: 'fast',
          supportedFormats: ['PDF']
        },
        'olmocr': {
          accuracy: 97,
          speed: 'slow',
          supportedFormats: ['PDF', 'JPG', 'PNG', 'TIFF']
        }
      }
    };
    
    // 初始化配置
    this.initializeConfig();
  }

  /**
   * 初始化OCR配置
   */
  private async initializeConfig(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/ocr/config`);
      if (response.ok) {
        const config = await response.json();
        this.config.defaultEngine = config.default_engine;
        this.config.availableEngines = config.available_engines;
      }
    } catch (error) {
      console.warn('Failed to fetch OCR config, using default config:', error);
    }
  }

  /**
   * 获取OCR配置
   */
  getConfig(): OCRConfig {
    return { ...this.config };
  }

  /**
   * 检查引擎是否可用
   */
  isEngineAvailable(engine: OCREngine): boolean {
    return this.config.availableEngines.includes(engine);
  }

  /**
   * 获取引擎性能信息
   */
  getEnginePerformance(engine: OCREngine): EnginePerformance {
    return this.config.engineInfo[engine] || {
      accuracy: 90,
      speed: 'medium',
      supportedFormats: ['PDF']
    };
  }

  /**
   * 处理文档OCR识别
   */
  async processDocument(options: OCRProcessingOptions): Promise<OCRResult> {
    const engine = options.engine || this.config.defaultEngine;
    const startTime = Date.now();

    // 验证引擎可用性
    if (!this.isEngineAvailable(engine)) {
      return {
        success: false,
        content: '',
        engineUsed: engine,
        processingTime: 0,
        accuracy: 0,
        error: `OCR引擎 "${engine}" 不可用`
      };
    }

    try {
      // 创建FormData对象
      const formData = new FormData();
      const file = new File([options.fileBuffer], options.fileName, {
        type: options.mimeType
      });
      
      formData.append('file', file);
      if (engine) {
        formData.append('engine', engine);
      }

      // 调用后端OCR API
      const response = await fetch(`${this.baseUrl}/ocr/process`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: result.success,
        content: result.content,
        engineUsed: result.engine_used,
        processingTime: result.processing_time,
        accuracy: result.accuracy,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        engineUsed: engine,
        processingTime: Date.now() - startTime,
        accuracy: 0,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取可用的OCR引擎列表
   */
  async getAvailableEngines(): Promise<OCRModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ocr/engines`);
      if (response.ok) {
        const data = await response.json();
        const engines: OCRModelInfo[] = [];
        
        data.engines.forEach((engineId: OCREngine) => {
          const performance = data.engine_info[engineId] || {
            accuracy: 90,
            speed: 'medium',
            supportedFormats: ['PDF']
          };
          
          let modelInfo: OCRModelInfo;
          switch (engineId) {
            case 'mineru':
              modelInfo = {
                id: 'mineru',
                name: 'MinerU',
                description: '专业的PDF文档解析工具，支持复杂布局和表格识别',
                provider: 'MinerU',
                version: '1.0.0',
                performance,
                isAvailable: true
              };
              break;
            case 'marker-pdf':
              modelInfo = {
                id: 'marker-pdf',
                name: 'Marker PDF',
                description: '快速PDF解析引擎，适用于大多数文档类型',
                provider: 'Marker',
                version: '2.1.0',
                performance,
                isAvailable: true
              };
              break;
            case 'olmocr':
              modelInfo = {
                id: 'olmocr',
                name: 'OLM OCR',
                description: '光学字符识别引擎，支持多语言和手写体识别',
                provider: 'OLM',
                version: '3.2.1',
                performance,
                isAvailable: true
              };
              break;
            default:
              modelInfo = {
                id: engineId,
                name: engineId,
                description: 'OCR引擎',
                provider: 'Unknown',
                version: '1.0.0',
                performance,
                isAvailable: true
              };
          }
          
          engines.push(modelInfo);
        });
        
        return engines;
      } else {
        throw new Error('Failed to fetch available engines');
      }
    } catch (error) {
      console.warn('Failed to fetch available engines, using default:', error);
      // 返回默认引擎信息
      return [
        {
          id: 'mineru',
          name: 'MinerU',
          description: '专业的PDF文档解析工具，支持复杂布局和表格识别',
          provider: 'MinerU',
          version: '1.0.0',
          performance: {
            accuracy: 95,
            speed: 'medium',
            supportedFormats: ['PDF', 'DOC', 'DOCX']
          },
          isAvailable: true
        },
        {
          id: 'marker-pdf',
          name: 'Marker PDF',
          description: '快速PDF解析引擎，适用于大多数文档类型',
          provider: 'Marker',
          version: '2.1.0',
          performance: {
            accuracy: 92,
            speed: 'fast',
            supportedFormats: ['PDF']
          },
          isAvailable: true
        },
        {
          id: 'olmocr',
          name: 'OLM OCR',
          description: '光学字符识别引擎，支持多语言和手写体识别',
          provider: 'OLM',
          version: '3.2.1',
          performance: {
            accuracy: 97,
            speed: 'slow',
            supportedFormats: ['PDF', 'JPG', 'PNG', 'TIFF']
          },
          isAvailable: true
        }
      ];
    }
  }
}

// 创建单例实例
export const ocrService = new OCRService();