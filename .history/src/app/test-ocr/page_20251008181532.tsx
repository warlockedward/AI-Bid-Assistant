'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Space, Typography, message, Upload, Modal } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { ocrService, type OCRModelInfo, type OCRResult } from '@/lib/ocr-service';
import { OCRModelSelector } from '@/components/ocr/OCRModelSelector';

const { Title, Text } = Typography;

export default function TestOCRPage() {
  const [engines, setEngines] = useState<OCRModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>('marker-pdf');
  const [fileList, setFileList] = useState<any[]>([]);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取OCR配置
        const ocrConfig = ocrService.getConfig();
        setConfig(ocrConfig);
        
        // 获取可用引擎
        const availableEngines = await ocrService.getAvailableEngines();
        setEngines(availableEngines);
        
        // 设置默认引擎
        setSelectedEngine(ocrConfig.defaultEngine);
      } catch (error) {
        console.error('Failed to fetch OCR data:', error);
        message.error('获取OCR数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleTestOCR = async () => {
    if (fileList.length === 0) {
      message.warning('请先上传文件');
      return;
    }

    setProcessing(true);
    try {
      const file = fileList[0].originFileObj;
      const arrayBuffer = await file.arrayBuffer();
      
      const result = await ocrService.processDocument({
        engine: selectedEngine as any,
        fileBuffer: arrayBuffer,
        fileName: file.name,
        mimeType: file.type
      });
      
      setOcrResult(result);
      
      if (result.success) {
        message.success(`OCR处理成功，识别准确率: ${result.accuracy}%`);
      } else {
        message.error(`OCR处理失败: ${result.error}`);
      }
    } catch (error) {
      console.error('OCR处理失败:', error);
      message.error('OCR处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleEngineChange = (engineId: string) => {
    setSelectedEngine(engineId);
  };

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>OCR服务测试</Title>
      
      <Card title="OCR配置信息" style={{ marginBottom: '24px' }}>
        <Space direction="vertical">
          <Text><strong>默认引擎:</strong> {config?.defaultEngine}</Text>
          <Text><strong>可用引擎:</strong> {config?.availableEngines?.join(', ')}</Text>
        </Space>
      </Card>

      <Card title="OCR引擎选择" style={{ marginBottom: '24px' }}>
        <OCRModelSelector 
          selectedModel={selectedEngine}
          onModelChange={handleEngineChange}
        />
      </Card>

      <Card title="文件上传" style={{ marginBottom: '24px' }}>
        <Upload
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList }) => setFileList(fileList)}
          accept=".txt,.doc,.docx,.pdf,.jpg,.png,.tiff"
          maxCount={1}
        >
          <Button icon={<UploadOutlined />}>点击上传文件</Button>
        </Upload>
        
        {fileList.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <Text strong>已选择文件:</Text>
            <Text style={{ marginLeft: '8px' }}>{fileList[0].name}</Text>
          </div>
        )}
      </Card>

      <Button 
        type="primary" 
        onClick={handleTestOCR}
        loading={processing}
        disabled={fileList.length === 0}
        style={{ marginBottom: '24px' }}
      >
        测试OCR处理
      </Button>

      {ocrResult && (
        <Card title="OCR处理结果" style={{ marginBottom: '24px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text><strong>处理状态:</strong> {ocrResult.success ? '成功' : '失败'}</Text>
            <Text><strong>使用引擎:</strong> {ocrResult.engineUsed}</Text>
            <Text><strong>处理时间:</strong> {ocrResult.processingTime}ms</Text>
            {ocrResult.accuracy > 0 && (
              <Text><strong>识别准确率:</strong> {ocrResult.accuracy}%</Text>
            )}
            {ocrResult.error && (
              <Text type="danger"><strong>错误信息:</strong> {ocrResult.error}</Text>
            )}
            {ocrResult.content && (
              <div>
                <Text strong>识别内容:</Text>
                <div style={{ 
                  marginTop: '8px', 
                  padding: '12px', 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ocrResult.content}</pre>
                </div>
              </div>
            )}
          </Space>
        </Card>
      )}

      <Card title="OCR引擎列表" style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {engines.map((engine) => (
            <Card 
              key={engine.id} 
              size="small" 
              title={engine.name}
              extra={engine.isAvailable ? '可用' : '不可用'}
            >
              <Space direction="vertical">
                <Text type="secondary">{engine.description}</Text>
                <Text>提供商: {engine.provider}</Text>
                <Text>版本: {engine.version}</Text>
                <Text>准确率: {engine.performance.accuracy}%</Text>
                <Text>速度: {engine.performance.speed}</Text>
                <Text>支持格式: {engine.performance.supportedFormats.join(', ')}</Text>
              </Space>
            </Card>
          ))}
        </Space>
      </Card>
    </div>
  );
}