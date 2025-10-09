'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Button, 
  Input, 
  Row, 
  Col, 
  Space, 
  Typography,
  Spin,
  theme
} from 'antd';
import { 
  FileTextOutlined, 
  UploadOutlined, 
  SearchOutlined, 
  FilterOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface Document {
  id: string;
  title: string;
  description: string;
  updatedAt: string;
  color: string;
}

export default function DocumentsPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    // 模拟数据加载
    const loadDocuments = async () => {
      // 这里应该从API获取真实数据
      const mockDocuments: Document[] = [
        {
          id: '1',
          title: '技术方案模板',
          description: '标准技术方案文档模板，包含项目概述、技术架构、实施计划等章节。',
          updatedAt: '2024-01-15',
          color: '#1677ff'
        },
        {
          id: '2',
          title: '项目管理方案',
          description: '项目管理和实施方案模板，包含团队组织、进度计划、风险管控等内容。',
          updatedAt: '2024-01-10',
          color: '#52c41a'
        },
        {
          id: '3',
          title: '商务方案模板',
          description: '商务投标方案模板，包含报价策略、服务承诺、合同条款等商务内容。',
          updatedAt: '2024-01-08',
          color: '#722ed1'
        }
      ];
      
      setDocuments(mockDocuments);
      setLoading(false);
    };

    loadDocuments();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: '0 0 8px 0' }}>文档管理</Title>
            <Text type="secondary">管理投标文档、模板和生成的内容</Text>
          </div>
          <Button type="primary" icon={<UploadOutlined />}>
            上传文档
          </Button>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <Card style={{ marginBottom: '24px' }} title={<Space><SearchOutlined />搜索文档</Space>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="搜索文档名称或内容..."
            prefix={<SearchOutlined />}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button icon={<FilterOutlined />}>过滤</Button>
          </div>
        </Space>
      </Card>

      {/* 文档列表 */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        {documents.map((doc) => (
          <Col xs={24} sm={12} md={8} key={doc.id}>
            <Card 
              hoverable
              title={
                <Space>
                  <FileTextOutlined style={{ color: doc.color }} />
                  <Text strong>{doc.title}</Text>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">{doc.description}</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    更新于 {doc.updatedAt}
                  </Text>
                  <Button size="small">查看</Button>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 空状态提示 */}
      <Card style={{ 
        border: '2px dashed #d9d9d9', 
        textAlign: 'center',
        padding: '48px 0'
      }}>
        <Space direction="vertical">
          <FileTextOutlined style={{ fontSize: '48px', color: '#bfbfbf' }} />
          <Title level={4}>暂无更多文档</Title>
          <Text type="secondary" style={{ marginBottom: '16px' }}>
            上传您的投标文档模板或生成新的文档内容
          </Text>
          <Button type="primary" icon={<UploadOutlined />}>
            上传第一个文档
          </Button>
        </Space>
      </Card>
    </div>
  );
}