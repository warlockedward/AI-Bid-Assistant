'use client';

import Link from 'next/link';
import { 
  Card, 
  Button, 
  Tag, 
  Space, 
  Typography,
  theme
} from 'antd';
import { 
  CalendarOutlined, 
  FileTextOutlined, 
  ApiOutlined, 
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string;
    status: string;
    createdAt: string;
    tenderDocument?: {
      filename: string;
    };
    workflowExecutions?: Array<{
      status: string;
      startedAt: string;
    }>;
    generatedContent?: Array<{
      status: string;
    }>;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { token } = theme.useToken();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'default';
      case 'ANALYZING': return 'processing';
      case 'GENERATING': return 'warning';
      case 'REVIEWING': return 'purple';
      case 'APPROVED': return 'success';
      case 'SUBMITTED': return 'blue';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DRAFT': return '草稿';
      case 'ANALYZING': return '分析中';
      case 'GENERATING': return '生成中';
      case 'REVIEWING': return '审核中';
      case 'APPROVED': return '已批准';
      case 'SUBMITTED': return '已提交';
      default: return status;
    }
  };

  const latestWorkflow = project.workflowExecutions?.[0];
  const pendingReviews = project.generatedContent?.filter(c => c.status === 'PENDING_REVIEW').length || 0;

  return (
    <Card 
      style={{ 
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)',
        height: '100%'
      }}
      bodyStyle={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <Title level={5} style={{ margin: '0 0 8px 0' }}>
              {project.name}
            </Title>
            {project.description && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {project.description}
              </Text>
            )}
          </div>
          <Tag color={getStatusColor(project.status)}>
            {getStatusText(project.status)}
          </Tag>
        </div>

        <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: '16px' }}>
          {project.tenderDocument && (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
              <FileTextOutlined style={{ marginRight: '8px', color: token?.colorTextSecondary }} />
              <Text type="secondary" ellipsis={{ tooltip: project.tenderDocument.filename }}>
                {project.tenderDocument.filename}
              </Text>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
            <CalendarOutlined style={{ marginRight: '8px', color: token?.colorTextSecondary }} />
            <Text type="secondary">
              创建于 {new Date(project.createdAt).toLocaleDateString()}
            </Text>
          </div>

          {latestWorkflow && (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
              <ApiOutlined style={{ marginRight: '8px', color: token?.colorTextSecondary }} />
              <Text type="secondary">
                工作流: {latestWorkflow.status === 'RUNNING' ? '运行中' : '已完成'}
              </Text>
            </div>
          )}

          {pendingReviews > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
              <ClockCircleOutlined style={{ marginRight: '8px', color: token?.colorWarning }} />
              <Text type="warning">
                {pendingReviews} 个待审核项目
              </Text>
            </div>
          )}
        </Space>
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        borderTop: `1px solid ${token?.colorBorder}`, 
        paddingTop: '16px',
        marginTop: 'auto'
      }}>
        <Space size="small">
          {project.status === 'APPROVED' && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircleOutlined style={{ color: token?.colorSuccess, marginRight: '4px' }} />
              <Text type="success" style={{ fontSize: '12px' }}>已批准</Text>
            </div>
          )}
          {pendingReviews > 0 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <ExclamationCircleOutlined style={{ color: token?.colorWarning, marginRight: '4px' }} />
              <Text type="warning" style={{ fontSize: '12px' }}>需要审核</Text>
            </div>
          )}
        </Space>
        
        <Link href={`/dashboard/projects/${project.id}`}>
          <Button type="primary" size="small">
            查看详情
          </Button>
        </Link>
      </div>
    </Card>
  );
}