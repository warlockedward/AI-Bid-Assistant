'use client'

import { useState, useEffect } from 'react';
import { 
  Card, 
  Select, 
  Space, 
  Typography, 
  Row, 
  Col,
  Badge,
  theme,
  Input,
  Switch,
  Button
} from 'antd';
import { 
  ApiOutlined, 
  ThunderboltOutlined, 
  SettingOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { configManager, ModelProvider, ModelConfig } from '@/lib/config';

const { Text, Title } = Typography;
const { Option } = Select;

interface ModelSelectorProps {
  onModelChange?: (provider: ModelProvider, model: string) => void;
  selectedProvider?: ModelProvider;
  selectedModel?: string;
  disabled?: boolean;
}

export function ModelSelector({ 
  onModelChange, 
  selectedProvider = ModelProvider.OPENAI, 
  selectedModel,
  disabled = false 
}: ModelSelectorProps) {
  const { token } = theme.useToken();
  const { t } = useLanguage();
  const [config, setConfig] = useState(configManager.getConfig());
  const [currentProvider, setCurrentProvider] = useState<ModelProvider>(selectedProvider);
  const [currentModel, setCurrentModel] = useState<string>(selectedModel || '');
  const [customModel, setCustomModel] = useState<string>('');
  const [useCustomModel, setUseCustomModel] = useState<boolean>(false);
  const [customModels, setCustomModels] = useState<Record<ModelProvider, string[]>>({
    [ModelProvider.OPENAI]: [],
    [ModelProvider.VLLM]: [],
    [ModelProvider.FASTGPT]: []
  });

  useEffect(() => {
    // 加载配置
    configManager.loadConfig().then(setConfig);
    
    // 从localStorage加载自定义模型
    const savedCustomModels = localStorage.getItem('customModels');
    if (savedCustomModels) {
      try {
        setCustomModels(JSON.parse(savedCustomModels));
      } catch (e) {
        console.error('Failed to parse custom models from localStorage', e);
      }
    }
  }, []);

  useEffect(() => {
    // 设置默认模型
    if (!currentModel && config) {
      const modelConfig = configManager.getModelConfig(currentProvider);
      if (modelConfig) {
        setCurrentModel(modelConfig.defaultModel);
      }
    }
  }, [currentProvider, config, currentModel]);

  const handleProviderChange = (provider: string) => {
    const newProvider = provider as ModelProvider;
    setCurrentProvider(newProvider);
    
    // 重置自定义模型选项
    setUseCustomModel(false);
    setCustomModel('');
    
    // 设置该提供商的默认模型
    const modelConfig = configManager.getModelConfig(newProvider);
    if (modelConfig) {
      const defaultModel = modelConfig.defaultModel;
      setCurrentModel(defaultModel);
      onModelChange?.(newProvider, defaultModel);
    }
  };

  const handleModelChange = (model: string) => {
    setCurrentModel(model);
    setCustomModel(model); // 同步到自定义模型输入框
    onModelChange?.(currentProvider, model);
  };

  const handleCustomModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomModel(value);
    setCurrentModel(value);
    onModelChange?.(currentProvider, value);
  };

  const handleUseCustomModelChange = (checked: boolean) => {
    setUseCustomModel(checked);
    if (!checked && config) {
      // 切换回预定义模型时，使用默认模型
      const modelConfig = configManager.getModelConfig(currentProvider);
      if (modelConfig) {
        setCurrentModel(modelConfig.defaultModel);
        onModelChange?.(currentProvider, modelConfig.defaultModel);
      }
    } else if (checked && customModel) {
      // 使用自定义模型
      setCurrentModel(customModel);
      onModelChange?.(currentProvider, customModel);
    }
  };

  const handleAddCustomModel = () => {
    if (customModel.trim() && !customModels[currentProvider].includes(customModel.trim())) {
      const newCustomModels = {
        ...customModels,
        [currentProvider]: [...customModels[currentProvider], customModel.trim()]
      };
      setCustomModels(newCustomModels);
      localStorage.setItem('customModels', JSON.stringify(newCustomModels));
    }
  };

  const handleRemoveCustomModel = (model: string) => {
    const newCustomModels = {
      ...customModels,
      [currentProvider]: customModels[currentProvider].filter(m => m !== model)
    };
    setCustomModels(newCustomModels);
    localStorage.setItem('customModels', JSON.stringify(newCustomModels));
    
    // 如果删除的是当前选择的模型，重置为默认模型
    if (currentModel === model) {
      const modelConfig = configManager.getModelConfig(currentProvider);
      if (modelConfig) {
        setCurrentModel(modelConfig.defaultModel);
        onModelChange?.(currentProvider, modelConfig.defaultModel);
      }
    }
  };

  const getProviderIcon = (provider: ModelProvider) => {
    switch (provider) {
      case ModelProvider.OPENAI:
        return <ApiOutlined />;
      case ModelProvider.VLLM:
        return <ThunderboltOutlined />;
      default:
        return <SettingOutlined />;
    }
  };

  const getProviderStatus = (provider: ModelProvider) => {
    const modelConfig = configManager.getModelConfig(provider);
    if (!modelConfig) return 'unavailable';
    
    // 检查API密钥是否配置（通过检查配置API）
    return 'available'; // 简化实现
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'unavailable':
        return 'error';
      default:
        return 'default';
    }
  };

  const renderProviderCard = (provider: ModelProvider, modelConfig: ModelConfig | null) => {
    if (!modelConfig) return null;

    const status = getProviderStatus(provider);
    const isSelected = currentProvider === provider;

    return (
      <Card 
        size="small"
        style={{ 
          height: '100%',
          borderColor: isSelected ? token?.colorPrimary : token?.colorBorder,
          backgroundColor: isSelected ? token?.colorPrimaryBg : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
        styles={{ body: { height: '100%' } }}
        onClick={() => !disabled && handleProviderChange(provider)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              {getProviderIcon(provider)}
              <Text strong style={{ textTransform: 'capitalize' }}>{provider}</Text>
            </Space>
            <Space>
              {status === 'available' ? (
                <CheckCircleOutlined style={{ color: token?.colorSuccess }} />
              ) : (
                <CloseCircleOutlined style={{ color: token?.colorError }} />
              )}
              <Badge 
                status={getStatusColor(status)} 
                text={isSelected ? 'Selected' : 'Available'} 
              />
            </Space>
          </div>
          
          <div style={{ 
            borderTop: `1px solid ${token?.colorBorder}`, 
            paddingTop: '12px',
            marginTop: '8px'
          }}>
            <Space direction="vertical" size="small">
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Default:</Text>
                <Text style={{ fontSize: '12px', marginLeft: '4px' }}>{modelConfig.defaultModel}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Models:</Text>
                <Text style={{ fontSize: '12px', marginLeft: '4px' }}>{modelConfig.availableModels.length}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Endpoint:</Text>
                <Text style={{ fontSize: '12px', marginLeft: '4px' }} ellipsis={{ tooltip: modelConfig.apiUrl }}>
                  {modelConfig.apiUrl}
                </Text>
              </div>
            </Space>
          </div>
        </Space>
      </Card>
    );
  };

  // 获取当前提供商的所有可用模型（包括预定义和自定义）
  const getAllAvailableModels = () => {
    const modelConfig = configManager.getModelConfig(currentProvider);
    if (!modelConfig) return [];
    
    const predefinedModels = modelConfig.availableModels;
    const userDefinedModels = customModels[currentProvider] || [];
    
    // 合并并去重
    const combinedModels = [...predefinedModels, ...userDefinedModels];
    return Array.from(new Set(combinedModels));
  };

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Provider Selection */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <SettingOutlined />
          AI Model Provider
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            {renderProviderCard(ModelProvider.OPENAI, configManager.getModelConfig(ModelProvider.OPENAI))}
          </Col>
          <Col xs={24} sm={12}>
            {renderProviderCard(ModelProvider.VLLM, configManager.getModelConfig(ModelProvider.VLLM))}
          </Col>
        </Row>
      </div>

      {/* Model Selection */}
      <div>
        <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ApiOutlined />
          Model Selection
        </Title>
        <Card size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>
                Selected Provider: <Text type="success" style={{ textTransform: 'capitalize' }}>{currentProvider}</Text>
              </Text>
            </div>
            
            {/* 自定义模型开关 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Switch 
                checked={useCustomModel} 
                onChange={handleUseCustomModelChange}
              />
              <Text>使用自定义模型</Text>
            </div>
            
            {useCustomModel ? (
              // 自定义模型输入
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>自定义模型名称:</Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Input 
                    value={customModel} 
                    onChange={handleCustomModelChange}
                    placeholder="输入模型名称，例如: gpt-4-1106-preview"
                    disabled={disabled}
                  />
                  <Button 
                    icon={<PlusOutlined />} 
                    onClick={handleAddCustomModel}
                    disabled={disabled || !customModel.trim() || customModels[currentProvider].includes(customModel.trim())}
                  >
                    添加到列表
                  </Button>
                </Space.Compact>
              </div>
            ) : (
              // 预定义模型选择
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>选择模型:</Text>
                <Select 
                  value={currentModel} 
                  onChange={handleModelChange}
                  disabled={disabled}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="children"
                >
                  {getAllAvailableModels().map((model) => (
                    <Option key={model} value={model}>
                      <Space>
                        <span>{model}</span>
                        {model === configManager.getModelConfig(currentProvider)?.defaultModel && (
                          <Badge status="processing" text="Default" />
                        )}
                        {customModels[currentProvider].includes(model) && (
                          <Badge status="success" text="Custom" />
                        )}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </div>
            )}

            {/* 自定义模型列表管理 */}
            {customModels[currentProvider].length > 0 && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>自定义模型列表:</Text>
                <div style={{ 
                  maxHeight: '120px', 
                  overflowY: 'auto',
                  border: `1px solid ${token?.colorBorder}`,
                  borderRadius: '4px',
                  padding: '8px'
                }}>
                  {customModels[currentProvider].map((model) => (
                    <div 
                      key={model} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '4px 8px',
                        marginBottom: '4px',
                        backgroundColor: token?.colorFillAlter,
                        borderRadius: '4px'
                      }}
                    >
                      <Text>{model}</Text>
                      <Button 
                        type="text" 
                        icon={<DeleteOutlined />} 
                        onClick={() => handleRemoveCustomModel(model)}
                        size="small"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Model Info */}
            {currentModel && (
              <Card 
                size="small" 
                style={{ 
                  backgroundColor: token?.colorFillAlter,
                  border: `1px solid ${token?.colorBorder}`
                }}
              >
                <Title level={5} style={{ marginTop: 0, marginBottom: '16px' }}>Model Configuration</Title>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text type="secondary">Provider:</Text>
                    <Text style={{ marginLeft: '8px', textTransform: 'capitalize' }}>{currentProvider}</Text>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">Model:</Text>
                    <Text style={{ marginLeft: '8px' }}>{currentModel}</Text>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">Temperature:</Text>
                    <Text style={{ marginLeft: '8px' }}>
                      {configManager.getModelConfig(currentProvider)?.temperature || 0.1}
                    </Text>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">Max Tokens:</Text>
                    <Text style={{ marginLeft: '8px' }}>
                      {configManager.getModelConfig(currentProvider)?.maxTokens || 'N/A'}
                    </Text>
                  </Col>
                </Row>
              </Card>
            )}
          </Space>
        </Card>
      </div>
    </div>
  );
}