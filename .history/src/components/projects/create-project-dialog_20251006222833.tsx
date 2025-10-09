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
  Space
} from 'antd';
import { 
  UploadOutlined, 
  FileTextOutlined,
  PlusOutlined
} from '@ant-design/icons';

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

  const handleSubmit = async (values: any) => {
    if (!values.tenderDocument || values.tenderDocument.fileList.length === 0) {
      message.error('请上传招标文件');
      return;
    }

    setLoading(true);
    try {
      // 读取文件内容
      const file = values.tenderDocument.fileList[0].originFileObj;
      const fileContent = await readFileContent(file);
      
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
            content: fileContent
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
    onClose();
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
      width={520}
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