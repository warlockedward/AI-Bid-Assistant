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
  theme
} from 'antd';
import { 
  ApiOutlined, 
  ThunderboltOutlined, 
  SettingOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined
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

  useEffect(() => {
    // 加载配置
    configManager.loadConfig().then(setConfig);
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
    onModelChange?.(currentProvider, model);
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
            
            <div>
              <Text strong style={{ display: 'block', marginBottom: '8px' }}>Select Model:</Text>
              <Select 
                value={currentModel} 
                onChange={handleModelChange}
                disabled={disabled}
                style={{ width: '100%' }}
              >
                {configManager.getModelConfig(currentProvider)?.availableModels.map((model) => (
                  <Option key={model} value={model}>
                    <Space>
                      <span>{model}</span>
                      {model === configManager.getModelConfig(currentProvider)?.defaultModel && (
                        <Badge status="processing" text="Default" />
                      )}
                    </Space>
                  </Option>
                ))}
              </Select>
            </div>

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