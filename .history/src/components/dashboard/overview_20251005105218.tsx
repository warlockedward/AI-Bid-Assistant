'use client';

import { 
  Card, 
  Col, 
  Row, 
  Statistic, 
  Table, 
  Tag, 
  Typography, 
  Space, 
  Button,
  theme
} from 'antd';
import { 
  FolderOpenOutlined, 
  PlayCircleOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  StarOutlined,
  ArrowUpOutlined,
  ApiOutlined,
  AimOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface DashboardStats {
  totalProjects: number;
  activeWorkflows: number;
  pendingReviews: number;
  completedProjects: number;
}

interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  workflowExecutions: Array<{
    status: string;
    startedAt: Date;
  }>;
}

interface Workflow {
  id: string;
  status: string;
  startedAt: Date;
  bidProject: {
    name: string;
  };
}

interface DashboardOverviewProps {
  stats: DashboardStats;
  recentProjects: Project[];
  activeWorkflows: Workflow[];
}

export function DashboardOverview({ stats, recentProjects, activeWorkflows }: DashboardOverviewProps) {
  const { token } = theme.useToken();
  
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'DRAFT': 'default',
      'ANALYZING': 'processing',
      'GENERATING': 'warning',
      'REVIEWING': 'purple',
      'APPROVED': 'success',
      'SUBMITTED': 'blue',
      'RUNNING': 'processing',
      'COMPLETED': 'success',
      'FAILED': 'error',
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'DRAFT': '草稿',
      'ANALYZING': '分析中',
      'GENERATING': '生成中',
      'REVIEWING': '审核中',
      'APPROVED': '已批准',
      'SUBMITTED': '已提交',
      'RUNNING': '运行中',
      'COMPLETED': '已完成',
      'FAILED': '失败',
    };
    return texts[status] || status;
  };

  const statCards = [
    {
      title: '总项目数',
      value: stats.totalProjects,
      icon: <FolderOpenOutlined />,
      color: token?.colorPrimary || '#1677ff',
      description: '包含所有状态的项目',
      trend: '+12%'
    },
    {
      title: '活跃工作流',
      value: stats.activeWorkflows,
      icon: <PlayCircleOutlined />,
      color: token?.colorSuccess || '#52c41a',
      description: '正在运行的工作流',
      trend: '+8%'
    },
    {
      title: '待审核内容',
      value: stats.pendingReviews,
      icon: <ClockCircleOutlined />,
      color: token?.colorWarning || '#faad14',
      description: '等待审核的生成内容',
      trend: '-5%'
    },
    {
      title: '已完成项目',
      value: stats.completedProjects,
      icon: <CheckCircleOutlined />,
      color: token?.colorInfo || '#1677ff',
      description: '已批准的项目',
      trend: '+23%'
    },
  ];

  // 最近项目表格列定义
  const projectColumns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
  ];

  // 活跃工作流表格列定义
  const workflowColumns = [
    {
      title: '项目名称',
      dataIndex: ['bidProject', 'name'],
      key: 'projectName',
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (date: Date) => new Date(date).toLocaleString(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 欢迎横幅 */}
      <Card 
        style={{ 
          background: 'linear-gradient(135deg, #e6f4ff, #bae0ff)',
          marginBottom: 24,
          borderRadius: 8
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <div>
            <Title level={3} style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center' }}>
              欢迎回来！
              <StarOutlined style={{ color: '#faad14', fontSize: 20, marginLeft: 8 }} />
            </Title>
            <Text style={{ fontSize: 16, color: '#666' }}>
              您的AI投标助手已准备就绪，让我们开始创造奇迹吧！
            </Text>
          </div>
          <div style={{ display: 'none', md: { display: 'block' } }}>
            <div style={{ 
              width: 80, 
              height: 80, 
              background: 'linear-gradient(135deg, #1677ff, #0050b3)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(3deg)',
              transition: 'transform 0.3s'
            }}>
              <RocketOutlined style={{ color: '#fff', fontSize: 32 }} />
            </div>
          </div>
        </div>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <Card 
              style={{ 
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  background: `linear-gradient(135deg, ${stat.color}22, ${stat.color}44)`,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  color: stat.color
                }}>
                  {stat.icon}
                </div>
                <Space>
                  <ArrowUpOutlined style={{ color: token?.colorSuccess || '#52c41a' }} />
                  <Text strong style={{ color: token?.colorSuccess || '#52c41a' }}>{stat.trend}</Text>
                </Space>
              </div>
              
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">{stat.title}</Text>
                <Title level={2} style={{ margin: '4px 0' }}>{stat.value}</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>{stat.description}</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {/* 最近项目 */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                最近项目
              </div>
            }
            extra={<StarOutlined style={{ color: '#faad14' }} />}
            style={{ borderRadius: 8 }}
          >
            {recentProjects.length > 0 ? (
              <Table 
                dataSource={recentProjects}
                columns={projectColumns}
                pagination={false}
                rowKey="id"
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ 
                  width: 64, 
                  height: 64, 
                  background: '#f0f0f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  opacity: 0.5
                }}>
                  <FolderOpenOutlined style={{ fontSize: 24, color: '#999' }} />
                </div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  暂无项目
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  创建您的第一个投标项目
                </Text>
              </div>
            )}
          </Card>
        </Col>

        {/* 活跃工作流 */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ThunderboltOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                活跃工作流
              </div>
            }
            extra={<ApiOutlined style={{ color: '#1677ff' }} />}
            style={{ borderRadius: 8 }}
          >
            {activeWorkflows.length > 0 ? (
              <Table 
                dataSource={activeWorkflows}
                columns={workflowColumns}
                pagination={false}
                rowKey="id"
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ 
                  width: 64, 
                  height: 64, 
                  background: '#f0f0f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  opacity: 0.5
                }}>
                  <PlayCircleOutlined style={{ fontSize: 24, color: '#999' }} />
                </div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  暂无活跃工作流
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  启动工作流来自动化您的投标流程
                </Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <AimOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            快速操作
          </div>
        }
        extra={<StarOutlined style={{ color: '#faad14' }} />}
        style={{ borderRadius: 8 }}
      >
        <Row gutter={[16, 16]}>
          {[
            {
              title: '创建新项目',
              description: '开始新的投标项目',
              icon: <FolderOpenOutlined />,
              color: '#1677ff',
            },
            {
              title: '上传招标文件',
              description: '分析新的招标需求',
              icon: <FileTextOutlined />,
              color: '#52c41a',
            },
            {
              title: '查看分析报告',
              description: '了解项目进展情况',
              icon: <ThunderboltOutlined />,
              color: '#722ed1',
            }
          ].map((action, index) => (
            <Col xs={24} sm={12} md={8} key={action.title}>
              <Button 
                block
                style={{ 
                  height: 'auto',
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  background: `${action.color}22`,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  color: action.color,
                  marginRight: 12
                }}>
                  {action.icon}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <Text strong style={{ display: 'block' }}>{action.title}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{action.description}</Text>
                </div>
              </Button>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}