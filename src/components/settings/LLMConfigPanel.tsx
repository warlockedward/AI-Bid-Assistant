/**
 * LLM配置面板组件
 * 允许用户配置大语言模型设置
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface LLMConfig {
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

interface ModelCapability {
  type: string;
  maxTokens?: number;
  contextWindow?: number;
  supportsVision?: boolean;
  supportsFunctionCalling?: boolean;
  dimensions?: number;
}

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: '',
  apiBase: process.env.NEXT_PUBLIC_OPENAI_API_BASE || '',
  llmModel: process.env.NEXT_PUBLIC_LLM_MODEL || 'Qwen3-QwQ-32B',
  vlmModel: process.env.NEXT_PUBLIC_VLM_MODEL || 'Qwen2.5-VL-32B-Instruct',
  embeddingModel: process.env.NEXT_PUBLIC_EMBEDDING_MODEL || 'bge-m3',
  rerankModel: process.env.NEXT_PUBLIC_RERANK_MODEL || 'bge-reranker-v2-minicpm-layerwise',
  defaultTemperature: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE || '0.7'),
  defaultMaxTokens: parseInt(process.env.NEXT_PUBLIC_DEFAULT_MAX_TOKENS || '2000'),
  defaultTopP: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_TOP_P || '0.9'),
  timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || '60'),
  maxRetries: parseInt(process.env.NEXT_PUBLIC_MAX_RETRIES || '3'),
  cacheEnabled: process.env.NEXT_PUBLIC_CACHE_ENABLED !== 'false',
  cacheTtl: parseInt(process.env.NEXT_PUBLIC_CACHE_TTL || '3600'),
  maxConcurrentRequests: parseInt(process.env.NEXT_PUBLIC_MAX_CONCURRENT || '10'),
};

const AVAILABLE_MODELS = {
  llm: [
    { value: 'Qwen3-QwQ-32B', label: 'Qwen3-QwQ-32B (推荐)', contextWindow: '32K' },
    { value: 'gpt-4', label: 'GPT-4', contextWindow: '8K' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', contextWindow: '4K' },
  ],
  vlm: [
    { value: 'Qwen2.5-VL-32B-Instruct', label: 'Qwen2.5-VL-32B (推荐)', contextWindow: '32K' },
    { value: 'gpt-4-vision-preview', label: 'GPT-4 Vision', contextWindow: '8K' },
  ],
  embedding: [
    { value: 'bge-m3', label: 'BGE-M3 (推荐)', dimensions: '1024' },
    { value: 'text-embedding-ada-002', label: 'Ada-002', dimensions: '1536' },
  ],
  rerank: [
    { value: 'bge-reranker-v2-minicpm-layerwise', label: 'BGE Reranker V2 (推荐)' },
    { value: 'cohere-rerank', label: 'Cohere Rerank' },
  ],
};

export const LLMConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  // 检测配置变化
  useEffect(() => {
    const changed = JSON.stringify(config) !== JSON.stringify(originalConfig);
    setHasChanges(changed);
  }, [config, originalConfig]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/llm-config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setOriginalConfig(data);
      }
    } catch (error) {
      console.error('Failed to load LLM config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setOriginalConfig(config);
        setTestResult({
          success: true,
          message: '配置保存成功！',
        });
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: '配置保存失败：' + (error as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/settings/llm-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const result = await response.json();
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? '连接测试成功！' : '连接测试失败'),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: '连接测试失败：' + (error as Error).message,
      });
    } finally {
      setTesting(false);
    }
  };

  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
  };

  const handleChange = (field: keyof LLMConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        大语言模型配置
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        配置LLM、VLM、Embedding和Rerank模型的连接参数
      </Typography>

      {testResult && (
        <Alert
          severity={testResult.success ? 'success' : 'error'}
          onClose={() => setTestResult(null)}
          sx={{ mb: 2 }}
        >
          {testResult.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* API配置 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                API配置
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="API Key"
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => handleChange('apiKey', e.target.value)}
                    placeholder="sk-..."
                    helperText="OpenAI兼容API的密钥"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="API Base URL"
                    value={config.apiBase}
                    onChange={(e) => handleChange('apiBase', e.target.value)}
                    placeholder="http://your-server:port/v1"
                    helperText="API服务器的基础URL"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 模型配置 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                模型配置
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>LLM模型</InputLabel>
                    <Select
                      value={config.llmModel}
                      onChange={(e) => handleChange('llmModel', e.target.value)}
                      label="LLM模型"
                    >
                      {AVAILABLE_MODELS.llm.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                          {model.label}
                          <Chip
                            label={model.contextWindow}
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>VLM模型</InputLabel>
                    <Select
                      value={config.vlmModel}
                      onChange={(e) => handleChange('vlmModel', e.target.value)}
                      label="VLM模型"
                    >
                      {AVAILABLE_MODELS.vlm.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                          {model.label}
                          <Chip
                            label={model.contextWindow}
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Embedding模型</InputLabel>
                    <Select
                      value={config.embeddingModel}
                      onChange={(e) => handleChange('embeddingModel', e.target.value)}
                      label="Embedding模型"
                    >
                      {AVAILABLE_MODELS.embedding.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                          {model.label}
                          <Chip
                            label={model.dimensions}
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Rerank模型</InputLabel>
                    <Select
                      value={config.rerankModel}
                      onChange={(e) => handleChange('rerankModel', e.target.value)}
                      label="Rerank模型"
                    >
                      {AVAILABLE_MODELS.rerank.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                          {model.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 高级配置 */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">高级配置</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="默认温度"
                    type="number"
                    value={config.defaultTemperature}
                    onChange={(e) =>
                      handleChange('defaultTemperature', parseFloat(e.target.value))
                    }
                    inputProps={{ min: 0, max: 2, step: 0.1 }}
                    helperText="控制输出随机性 (0-2)"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="默认最大Token数"
                    type="number"
                    value={config.defaultMaxTokens}
                    onChange={(e) =>
                      handleChange('defaultMaxTokens', parseInt(e.target.value))
                    }
                    inputProps={{ min: 100, max: 32000, step: 100 }}
                    helperText="最大生成长度"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Top P"
                    type="number"
                    value={config.defaultTopP}
                    onChange={(e) =>
                      handleChange('defaultTopP', parseFloat(e.target.value))
                    }
                    inputProps={{ min: 0, max: 1, step: 0.1 }}
                    helperText="核采样参数 (0-1)"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="超时时间（秒）"
                    type="number"
                    value={config.timeout}
                    onChange={(e) =>
                      handleChange('timeout', parseInt(e.target.value))
                    }
                    inputProps={{ min: 10, max: 300, step: 10 }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="最大重试次数"
                    type="number"
                    value={config.maxRetries}
                    onChange={(e) =>
                      handleChange('maxRetries', parseInt(e.target.value))
                    }
                    inputProps={{ min: 0, max: 10, step: 1 }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="最大并发请求数"
                    type="number"
                    value={config.maxConcurrentRequests}
                    onChange={(e) =>
                      handleChange('maxConcurrentRequests', parseInt(e.target.value))
                    }
                    inputProps={{ min: 1, max: 50, step: 1 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.cacheEnabled}
                        onChange={(e) =>
                          handleChange('cacheEnabled', e.target.checked)
                        }
                      />
                    }
                    label="启用缓存"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="缓存TTL（秒）"
                    type="number"
                    value={config.cacheTtl}
                    onChange={(e) =>
                      handleChange('cacheTtl', parseInt(e.target.value))
                    }
                    inputProps={{ min: 60, max: 86400, step: 60 }}
                    disabled={!config.cacheEnabled}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* 操作按钮 */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={resetToDefaults}
              disabled={loading}
            >
              恢复默认
            </Button>
            <Button
              variant="outlined"
              onClick={testConnection}
              disabled={loading || testing}
              startIcon={testing ? <RefreshIcon /> : <CheckCircleIcon />}
            >
              {testing ? '测试中...' : '测试连接'}
            </Button>
            <Button
              variant="contained"
              onClick={saveConfig}
              disabled={loading || !hasChanges}
              startIcon={<SaveIcon />}
            >
              保存配置
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LLMConfigPanel;
