'use client';

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
  Radio,
  Divider
} from 'antd';
import { 
  FileImageOutlined, 
  ThunderboltOutlined, 
  SettingOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined
} from '@ant-design/icons';
import { useLanguage } from '@/contexts/LanguageContext';

const { Text, Title } = Typography;
const { Option } = Select;

interface OCRModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  version?: string;
  performance: {
    accuracy: number;
    speed: 'fast' | 'medium' | 'slow';
    supportedFormats: string[];
  };
  isAvailable: boolean;
}

interface OCRModelSelectorProps {
  onModelChange?: (modelId: string) => void;
  selectedModel?: string;
  disabled?: boolean;
}

export function OCRModelSelector({ 
  onModelChange, 
  selectedModel = 'marker-pdf',
  disabled = false 
}: OCRModelSelectorProps) {
  const { token } = theme.useToken();
  const { t } = useLanguage();
  const [currentModel, setCurrentModel] = useState<string>(selectedModel);

  // OCR模型配置
  const ocrModels: OCRModel[] = [
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

  useEffect(() => {
    if (selectedModel && selectedModel !== currentModel) {
      setCurrentModel(selectedModel);
    }
  }, [selectedModel, currentModel]);

  const handleModelChange = (modelId: string) => {
    setCurrentModel(modelId);
    onModelChange?.(modelId);
  };

  const getModelIcon = (modelId: string) => {
    switch (modelId) {
      case 'mineru':
        return <FileImageOutlined />;
      case 'marker-pdf':
        return <ThunderboltOutlined />;
      case 'olmocr':
        return <SettingOutlined />;
      default:
        return <FileImageOutlined />;
    }
  };

  const getStatusColor = (isAvailable: boolean) => {
    return isAvailable ? 'success' : 'error';
  };

  const getSpeedColor = (speed: string) => {
    switch (speed) {
      case 'fast':
        return token?.colorSuccess;
      case 'medium':
        return token?.colorWarning;
      case 'slow':
        return token?.colorError;
      default:
        return token?.colorTextSecondary;
    }
  };

  const renderModelCard = (model: OCRModel) => {
    const isSelected = currentModel === model.id;

    return (
      <Card 
        size="small"
        style={{ 
          height: '100%',
          borderColor: isSelected ? token?.colorPrimary : token?.colorBorder,
          backgroundColor: isSelected ? token?.colorPrimaryBg : 'transparent',
          cursor: disabled || !model.isAvailable ? 'not-allowed' : 'pointer',
          opacity: model.isAvailable ? 1 : 0.6
        }}
        styles={{ body: { height: '100%' } }}
        onClick={() => {
          if (!disabled && model.isAvailable) {
            handleModelChange(model.id);
          }
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              {getModelIcon(model.id)}
              <Text strong>{model.name}</Text>
            </Space>
            <Space>
              {model.isAvailable ? (
                <CheckCircleOutlined style={{ color: token?.colorSuccess }} />
              ) : (
                <CloseCircleOutlined style={{ color: token?.colorError }} />
              )}
              <Badge 
                status={getStatusColor(model.isAvailable)} 
                text={isSelected ? 'Selected' : model.isAvailable ? 'Available' : 'Unavailable'} 
              />
            </Space>
          </div>
          
          <div style={{ 
            borderTop: `1px solid ${token?.colorBorder}`, 
            paddingTop: '12px',
            marginTop: '8px'
          }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {model.description}
              </Text>
              
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Provider:</Text>
                <Text style={{ fontSize: '12px', marginLeft: '4px' }}>{model.provider}</Text>
              </div>
              
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Accuracy:</Text>
                <Text style={{ fontSize: '12px', marginLeft: '4px' }}>{model.performance.accuracy}%</Text>
              </div>
              
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Speed:</Text>
                <Text 
                  style={{ 
                    fontSize: '12px', 
                    marginLeft: '4px',
                    color: getSpeedColor(model.performance.speed)
                  }}
                >
                  {model.performance.speed}
                </Text>
              </div>
              
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Formats:</Text>
                <Text style={{ fontSize: '12px', marginLeft: '4px' }}>
                  {model.performance.supportedFormats.join(', ')}
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
      {/* Model Selection Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <FileImageOutlined />
          OCR Model Selection
        </Title>
        <Text type="secondary">
          Select the OCR model to process your uploaded documents. Each model has different performance characteristics.
        </Text>
      </div>

      {/* Model Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {ocrModels.map((model) => (
          <Col xs={24} sm={12} md={8} key={model.id}>
            {renderModelCard(model)}
          </Col>
        ))}
      </Row>

      {/* Model Selection Dropdown */}
      <Card size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Selected Model: </Text>
            <Text type="success">{ocrModels.find(m => m.id === currentModel)?.name}</Text>
          </div>
          
          <Divider style={{ margin: '12px 0' }} />
          
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>Change Model:</Text>
            <Select 
              value={currentModel} 
              onChange={handleModelChange}
              disabled={disabled}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
            >
              {ocrModels.map((model) => (
                <Option 
                  key={model.id} 
                  value={model.id}
                  disabled={!model.isAvailable}
                >
                  <Space>
                    {getModelIcon(model.id)}
                    <span>{model.name}</span>
                    {!model.isAvailable && <Badge status="error" text="Unavailable" />}
                    {model.id === currentModel && <Badge status="processing" text="Current" />}
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
                border: `1px solid ${token?.colorBorder}`,
                marginTop: '16px'
              }}
            >
              <Title level={5} style={{ marginTop: 0, marginBottom: '16px' }}>Model Information</Title>
              <Row gutter={[16, 16]}>
                {ocrModels
                  .find(m => m.id === currentModel)
                  ?.performance && (
                    <>
                      <Col span={12}>
                        <Text type="secondary">Accuracy:</Text>
                        <Text style={{ marginLeft: '8px' }}>
                          {ocrModels.find(m => m.id === currentModel)?.performance.accuracy}%
                        </Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Speed:</Text>
                        <Text 
                          style={{ 
                            marginLeft: '8px',
                            color: getSpeedColor(ocrModels.find(m => m.id === currentModel)?.performance.speed || 'medium')
                          }}
                        >
                          {ocrModels.find(m => m.id === currentModel)?.performance.speed}
                        </Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Supported Formats:</Text>
                        <Text style={{ marginLeft: '8px' }}>
                          {ocrModels.find(m => m.id === currentModel)?.performance.supportedFormats.join(', ')}
                        </Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Provider:</Text>
                        <Text style={{ marginLeft: '8px' }}>
                          {ocrModels.find(m => m.id === currentModel)?.provider}
                        </Text>
                      </Col>
                    </>
                  )}
              </Row>
            </Card>
          )}
        </Space>
      </Card>
    </div>
  );
}