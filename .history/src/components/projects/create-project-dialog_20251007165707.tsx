'use client';

import { useState } from 'react';
import { 
  Button, 
  Modal, 
  Form, 
  Input, 
  Upload, 
  message, 
  Typography,
  Space,
  Divider,
  Card
} from 'antd';
import { 
  UploadOutlined, 
  FileTextOutlined,
  PlusOutlined,
  FileImageOutlined
} from '@ant-design/icons';
import { OCRModelSelector } from '@/components/ocr/OCRModelSelector';
import { ocrService } from '@/lib/ocr-service';

const { Title, Text } = Typography;

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectCreated: (project: any) => void;
}

export function CreateProjectDialog({ 
  open, 
  onClose, 
  onProjectCreated 
}: CreateProjectDialogProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [selectedOCREngine, setSelectedOCREngine] = useState<string>(
    ocrService.getConfig().defaultEngine
  );

  const handleSubmit = async (values: any) => {
    if (!values.tenderDocument || values.tenderDocument.fileList.length === 0) {
      message.error('请上传招标文件');
      return;
    }

    setLoading(true);
    try {
      // 读取文件内容
      const file = values.tenderDocument.fileList[0].originFileObj;
      let fileContent = '';
      
      // 检查文件类型，如果是PDF则使用OCR处理
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // 对于PDF文件，我们先读取内容，如果内容为空或很少，再使用OCR
        fileContent = await readFileContent(file);
        
        // 如果内容很少，可能需要OCR处理
        if (fileContent.trim().length < 100) {
          message.info(`使用OCR引擎 "${selectedOCREngine}" 处理PDF文档...`);
          // 这里应该调用实际的OCR服务
          // 暂时使用模拟处理
          const ocrResult = await ocrService.processDocument({
            engine: selectedOCREngine,
            fileBuffer: Buffer.from(await file.arrayBuffer()),
            fileName: file.name,
            mimeType: file.type
          });
          
          if (ocrResult.success) {
            fileContent = ocrResult.content;
            message.success(`OCR处理完成，识别准确率: ${ocrResult.accuracy}%`);
          } else {
            message.warning(`OCR处理失败: ${ocrResult.error}，使用原始文件内容`);
          }
        }
      } else {
        // 非PDF文件直接读取内容
        fileContent = await readFileContent(file);
      }
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          tenderDocument: {
            filename: file.name,
            content: fileContent,
            ocrEngine: selectedOCREngine // 保存使用的OCR引擎信息
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // 根据API响应结构调整
        const projectData = result.data?.project;
        if (projectData) {
          onProjectCreated(projectData);
          form.resetFields();
          setFileList([]);
          setSelectedOCREngine(ocrService.getConfig().defaultEngine);
          message.success('项目创建成功');
        } else {
          throw new Error('创建项目失败：无效的响应格式');
        }
      } else {
        throw new Error('创建项目失败');
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      message.error('创建项目失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  const handleCancel = () => {
    form.resetFields();
    setFileList([]);
    setSelectedOCREngine(ocrService.getConfig().defaultEngine);
    onClose();
  };

  const handleOCRModelChange = (modelId: string) => {
    setSelectedOCREngine(modelId);
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusOutlined />
          <span>创建新项目</span>
        </div>
      }
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
      >
        <Form.Item
          label="项目名称"
          name="name"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="输入项目名称" />
        </Form.Item>

        <Form.Item
          label="项目描述"
          name="description"
        >
          <Input.TextArea 
            placeholder="输入项目描述（可选）" 
            rows={3}
            showCount
            maxLength={500}
          />
        </Form.Item>

        <Form.Item
          label="招标文件"
          name="tenderDocument"
          valuePropName="fileList"
          getValueFromEvent={normFile}
          rules={[{ required: true, message: '请上传招标文件' }]}
        >
          <Upload
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList }) => setFileList(fileList)}
            accept=".txt,.doc,.docx,.pdf"
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>点击上传</Button>
            <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
              支持 TXT, DOC, DOCX, PDF 格式
            </Text>
          </Upload>
        </Form.Item>

        {fileList.length > 0 && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f0f5ff', 
            borderRadius: '4px',
            border: '1px solid #d6e4ff',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileTextOutlined style={{ color: '#1890ff' }} />
              <div>
                <Text strong>{fileList[0].name}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {(fileList[0].size / 1024).toFixed(1)} KB
                </Text>
              </div>
            </div>
          </div>
        )}

        {/* OCR Model Selection */}
        {fileList.length > 0 && (
          <Card 
            size="small" 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileImageOutlined />
                <span>OCR引擎选择</span>
              </div>
            }
            style={{ marginBottom: '16px' }}
          >
            <OCRModelSelector 
              selectedModel={selectedOCREngine}
              onModelChange={handleOCRModelChange}
            />
          </Card>
        )}

        <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel} disabled={loading}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              创建项目
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}