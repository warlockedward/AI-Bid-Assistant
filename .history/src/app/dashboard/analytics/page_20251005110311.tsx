import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
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
  theme
} from 'antd'
import { 
  BarChartOutlined, 
  TrendingUpOutlined, 
  TrendingDownOutlined, 
  AimOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarCircleOutlined,
  TeamOutlined,
  FileTextOutlined,
  CalendarOutlined,
  DownloadOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.tenantId) {
    redirect('/auth/signin')
  }

  // 模拟分析数据
  const analytics = {
    overview: {
      totalBids: 45,
      wonBids: 12,
      winRate: 26.7,
      totalValue: 2850000,
      avgBidTime: 4.2
    },
    monthlyTrends: [
      { month: '1月', bids: 8, won: 2, value: 450000 },
      { month: '2月', bids: 12, won: 3, value: 680000 },
      { month: '3月', bids: 15, won: 4, value: 920000 },
      { month: '4月', bids: 10, won: 3, value: 800000 }
    ],
    topPerformers: [
      { category: '技术服务', bids: 18, won: 6, winRate: 33.3 },
      { category: '软件开发', bids: 15, won: 4, winRate: 26.7 },
      { category: '系统集成', bids: 12, won: 2, winRate: 16.7 }
    ],
    recentActivity: [
      { 
        id: '1',
        project: '企业管理系统',
        status: 'won',
        value: 350000,
        date: '2024-01-15',
        duration: 3.5
      },
      {
        id: '2', 
        project: '医院信息化项目',
        status: 'lost',
        value: 280000,
        date: '2024-01-12',
        duration: 5.2
      },
      {
        id: '3',
        project: '智慧城市平台',
        status: 'pending',
        value: 520000,
        date: '2024-01-10',
        duration: 4.8
      }
    ]
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'won':
        return <Badge status="success" text="中标" />
      case 'lost':
        return <Badge status="error" text="未中标" />
      case 'pending':
        return <Badge status="warning" text="进行中" />
      default:
        return <Badge status="default" text="未知" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'lost':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: '0 0 8px 0' }}>分析报告</Title>
            <Text type="secondary">投标项目的数据分析和绩效报告</Text>
          </div>
          <Button type="primary" icon={<DownloadOutlined />}>
            导出报告
          </Button>
        </div>
      </div>

      {/* 概览统计 */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={12} lg={4.8}>
          <Card>
            <Statistic
              title="总投标数"
              value={analytics.overview.totalBids}
              prefix={<FileTextOutlined />}
              suffix="+12%"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={12} lg={4.8}>
          <Card>
            <Statistic
              title="中标数量"
              value={analytics.overview.wonBids}
              prefix={<AimOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              suffix="+8%"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={12} lg={4.8}>
          <Card>
            <Statistic
              title="中标率"
              value={analytics.overview.winRate}
              suffix="%"
              prefix={<TrendingUpOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
              suffix="+2.3%"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={12} lg={4.8}>
          <Card>
            <Statistic
              title="总合同金额"
              value={(analytics.overview.totalValue / 10000).toFixed(0)}
              suffix="万"
              prefix={<DollarCircleOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
              suffix="+15%"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={12} lg={4.8}>
          <Card>
            <Statistic
              title="平均投标时间"
              value={analytics.overview.avgBidTime}
              suffix="天"
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
              suffix="-0.8天"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        {/* 月度趋势 */}
        <Col xs={24} lg={12}>
          <Card title={<Space><TrendingUpOutlined />月度投标趋势</Space>}>
            <List
              dataSource={analytics.monthlyTrends}
              renderItem={(trend, index) => (
                <List.Item>
                  <List.Item.Meta
                    title={trend.month}
                    description={
                      <Space>
                        <Text type="secondary">投标: {trend.bids}</Text>
                        <Text type="success">中标: {trend.won}</Text>
                      </Space>
                    }
                  />
                  <div>
                    <Text strong>¥{(trend.value / 10000).toFixed(0)}万</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 分类表现 */}
        <Col xs={24} lg={12}>
          <Card title={<Space><AimOutlined />分类表现</Space>}>
            <List
              dataSource={analytics.topPerformers}
              renderItem={(performer, index) => (
                <List.Item>
                  <List.Item.Meta
                    title={performer.category}
                    description={
                      <Text type="secondary">
                        {performer.bids} 个投标 • {performer.won} 个中标
                      </Text>
                    }
                  />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#1677ff', fontWeight: 'bold' }}>{performer.winRate}%</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>中标率</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近活动 */}
      <Card title={<Space><CalendarOutlined />最近项目活动</Space>} style={{ marginBottom: '24px' }}>
        <List
          dataSource={analytics.recentActivity}
          renderItem={(activity) => (
            <List.Item
              actions={[
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold' }}>¥{(activity.value / 10000).toFixed(0)}万</div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>合同金额</Text>
                </div>,
                getStatusBadge(activity.status)
              ]}
            >
              <List.Item.Meta
                avatar={getStatusIcon(activity.status)}
                title={activity.project}
                description={
                  <Text type="secondary">
                    投标时间: {activity.duration} 天 • 日期: {activity.date}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* 空状态提示 */}
      <Card style={{ 
        border: '2px dashed #d9d9d9', 
        textAlign: 'center',
        padding: '48px 0'
      }}>
        <Space direction="vertical">
          <BarChartOutlined style={{ fontSize: '48px', color: '#bfbfbf' }} />
          <Title level={4}>更多分析功能即将推出</Title>
          <Text type="secondary" style={{ maxWidth: '400px' }}>
            我们正在开发更多高级分析功能，包括预测分析、竞争对手分析等
          </Text>
          <Button>
            <TeamOutlined /> 联系我们了解更多
          </Button>
        </Space>
      </Card>
    </div>
  )
}