'use client';

import { useEffect, useState } from 'react';
import { 
  Card, 
  Button, 
  Badge, 
  Row, 
  Col, 
  Statistic, 
  Space, 
  Typography,
  List,
  Spin,
  theme
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined, 
  EyeOutlined, 
  MessageOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface Review {
  id: string;
  title: string;
  project: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  submittedBy: string;
  priority: 'high' | 'medium' | 'low';
  reviewedAt?: string;
  reviewedBy?: string;
  comments?: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟数据加载
    const loadReviews = async () => {
      // 这里应该从API获取真实数据
      const mockReviews: Review[] = [
        {
          id: '1',
          title: '企业软件RFP - 技术方案',
          project: '企业管理系统投标',
          status: 'pending',
          submittedAt: '2024-01-15T10:30:00Z',
          submittedBy: 'AI Agent - 技术方案生成器',
          priority: 'high'
        },
        {
          id: '2', 
          title: '医疗系统投标 - 商务方案',
          project: '医院信息化项目',
          status: 'approved',
          submittedAt: '2024-01-14T15:20:00Z',
          submittedBy: 'AI Agent - 商务方案生成器',
          priority: 'medium',
          reviewedAt: '2024-01-14T16:45:00Z',
          reviewedBy: 'Sarah Johnson'
        },
        {
          id: '3',
          title: '云基础设施项目 - 实施计划',
          project: '云平台建设投标',
          status: 'rejected',
          submittedAt: '2024-01-13T09:15:00Z',
          submittedBy: 'AI Agent - 项目管理生成器',
          priority: 'low',
          reviewedAt: '2024-01-13T14:30:00Z',
          reviewedBy: 'Mike Davis',
          comments: '实施时间安排需要调整，风险评估不够详细'
        }
      ];
      
      setReviews(mockReviews);
      setLoading(false);
    };

    loadReviews();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge status="warning" text="待审核" />;
      case 'approved':
        return <Badge status="success" text="已通过" />;
      case 'rejected':
        return <Badge status="error" text="已拒绝" />;
      default:
        return <Badge status="default" text="未知" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'approved':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'rejected':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge status="error" text="高优先级" />;
      case 'medium':
        return <Badge status="warning" text="中优先级" />;
      case 'low':
        return <Badge status="default" text="低优先级" />;
      default:
        return <Badge status="default" text="普通" />;
    }
  };

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
        <Title level={3} style={{ margin: '0 0 8px 0' }}>审核中心</Title>
        <Text type="secondary">审核AI生成的投标文档内容，确保质量和合规性</Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="待审核"
              value={reviews.filter(r => r.status === 'pending').length}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="已通过"
              value={reviews.filter(r => r.status === 'approved').length}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="已拒绝"
              value={reviews.filter(r => r.status === 'rejected').length}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 审核列表 */}
      <Card title="审核任务">
        <List
          dataSource={reviews}
          renderItem={(review) => (
            <List.Item
              actions={[
                getStatusBadge(review.status),
                <Button size="small" icon={<EyeOutlined />}>
                  查看详情
                </Button>,
                review.status === 'pending' && (
                  <>
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />}>
                      通过
                    </Button>
                    <Button size="small" danger icon={<CloseCircleOutlined />}>
                      拒绝
                    </Button>
                  </>
                )
              ].filter(Boolean) as any}
            >
              <List.Item.Meta
                avatar={getStatusIcon(review.status)}
                title={
                  <Space>
                    <Text strong>{review.title}</Text>
                    {getPriorityBadge(review.priority)}
                  </Space>
                }
                description={
                  <Space direction="vertical">
                    <Text type="secondary">{review.project}</Text>
                    <Space size="small">
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        提交者: {review.submittedBy}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        提交时间: {new Date(review.submittedAt).toLocaleString()}
                      </Text>
                      {review.reviewedAt && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          审核时间: {new Date(review.reviewedAt).toLocaleString()}
                        </Text>
                      )}
                    </Space>
                    {review.comments && (
                      <Card size="small" style={{ 
                        marginTop: '8px',
                        borderColor: '#ff4d4f',
                        backgroundColor: '#fff2f0'
                      }}>
                        <Space>
                          <MessageOutlined style={{ color: '#ff4d4f' }} />
                          <Text type="danger">{review.comments}</Text>
                        </Space>
                      </Card>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* 空状态 */}
      {reviews.length === 0 && (
        <Card style={{ 
          border: '2px dashed #d9d9d9', 
          textAlign: 'center',
          padding: '48px 0'
        }}>
          <Space direction="vertical">
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#bfbfbf' }} />
            <Title level={4}>暂无审核任务</Title>
            <Text type="secondary">
              当AI生成新的投标内容时，审核任务将会出现在这里
            </Text>
          </Space>
        </Card>
      )}
    </div>
  );
}