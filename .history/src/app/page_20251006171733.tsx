'use client';

import React from 'react';
import Link from 'next/link';
import { Button, Card, Col, Row, Space, Typography, theme, ConfigProvider } from 'antd';
import { 
  RobotOutlined, 
  ThunderboltOutlined, 
  StarOutlined, 
  RocketOutlined,
  CheckCircleOutlined,
  UsergroupAddOutlined,
  SafetyCertificateOutlined,
  BarChartOutlined,
  GlobalOutlined,
  BulbOutlined,
  RightOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';

// cSpell:ignore Usergroup hoverable

const { Title, Text, Paragraph } = Typography;

export default function HomePage() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          colorInfo: '#1677ff',
        }
      }}
    >
      <HomePageContent />
    </ConfigProvider>
  );
}

function HomePageContent() {
  const { token } = theme.useToken();
  
  const features = [
    {
      icon: <BulbOutlined />,
      title: 'AI智能分析',
      description: '深度学习算法分析招标文件，提取关键信息',
      color: token?.colorPrimary || '#1677ff'
    },
    {
      icon: <RocketOutlined />,
      title: '自动化工作流',
      description: '端到端自动化投标流程，提高效率10倍',
      color: token?.colorSuccess || '#52c41a'
    },
    {
      icon: <SafetyCertificateOutlined />,
      title: '企业级安全',
      description: '多租户架构，数据隔离，符合企业安全标准',
      color: token?.colorInfo || '#1677ff'
    },
    {
      icon: <BarChartOutlined />,
      title: '数据洞察',
      description: '实时分析投标成功率，优化策略决策',
      color: token?.colorWarning || '#faad14'
    }
  ];

  const stats = [
    { label: '投标成功率', value: '85%', icon: <BarChartOutlined /> },
    { label: '处理时间节省', value: '90%', icon: <ThunderboltOutlined /> },
    { label: '企业用户', value: '500+', icon: <UsergroupAddOutlined /> },
    { label: '全球覆盖', value: '50+', icon: <GlobalOutlined /> }
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: `linear-gradient(135deg, #f0f2f5 0%, #e6f4ff 100%)`,
      padding: 24
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 导航栏 */}
        <nav style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 0',
          marginBottom: 48
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              background: 'linear-gradient(135deg, #1677ff, #0050b3)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <RobotOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <Title level={4} style={{ margin: 0 }}>智能投标系统</Title>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/auth/signin">
              <Button type="text">登录</Button>
            </Link>
            <Link href="/auth/signup">
              <Button type="primary">免费试用</Button>
            </Link>
          </div>
        </nav>

        {/* 主要内容 */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          {/* 英雄区域 */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: 24 
            }}>
              <div style={{ position: 'relative' }}>
                <div style={{ 
                  width: 120, 
                  height: 120, 
                  background: 'linear-gradient(135deg, #1677ff, #0050b3)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(3deg)',
                  transition: 'transform 0.3s',
                }}>
                  <RocketOutlined style={{ color: '#fff', fontSize: 48 }} />
                </div>
                <div style={{ 
                  position: 'absolute', 
                  top: -8, 
                  right: -8, 
                  width: 24, 
                  height: 24, 
                  background: 'linear-gradient(135deg, #faad14, #ff4d4f)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'bounce 1s infinite'
                }}>
                  <StarOutlined style={{ color: '#fff', fontSize: 12 }} />
                </div>
              </div>
            </div>
            
            <Title level={1} style={{ marginBottom: 16 }}>
              <span style={{ background: 'linear-gradient(135deg, #1677ff, #0050b3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                AI驱动的
              </span>
              <br />
              智能投标平台
            </Title>
            
            <Paragraph style={{ fontSize: 18, color: '#666', marginBottom: 24 }}>
              利用人工智能技术，自动化分析招标文件，生成高质量投标方案，
              <br />
              让您的投标成功率提升85%，处理时间节省90%
            </Paragraph>
            
            <Space size="large">
              <Link href="/auth/signup">
                <Button type="primary" size="large" icon={<ArrowRightOutlined />}>
                  立即开始
                </Button>
              </Link>
              
              <Link href="/system-test">
                <Button size="large">查看演示</Button>
              </Link>
            </Space>
            
            {/* 特色标签 */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 24, 
              marginTop: 24,
              color: '#999'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>免费试用</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>无需信用卡</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>即时部署</span>
              </div>
            </div>
          </div>

          {/* 统计数据 */}
          <div style={{ marginBottom: 48 }}>
            <Row gutter={[24, 24]} justify="center">
              {stats.map((stat, index) => (
                <Col xs={12} sm={6} key={stat.label}>
                  <Card 
                    style={{ 
                      textAlign: 'center',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)'
                    }}
                    bodyStyle={{ padding: 16 }}
                  >
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      background: 'linear-gradient(135deg, #1677ff, #0050b3)',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px'
                    }}>
                      {React.cloneElement(stat.icon as React.ReactElement, { 
                        style: { color: '#fff', fontSize: 20 } 
                      })}
                    </div>
                    <Title level={3} style={{ margin: '0 0 8px 0' }}>{stat.value}</Title>
                    <Text type="secondary">{stat.label}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          {/* 功能特色 */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ marginBottom: 24 }}>
              <Title level={2}>为什么选择我们？</Title>
              <Paragraph style={{ fontSize: 18, color: '#666' }}>
                领先的AI技术，为您的投标业务赋能
              </Paragraph>
            </div>
            
            <Row gutter={[24, 24]}>
              {features.map((feature, index) => (
                <Col xs={24} sm={12} lg={6} key={feature.title}>
                  <Card 
                    hoverable
                    style={{ 
                      border: 'none',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      background: `linear-gradient(135deg, ${feature.color}DD, ${feature.color}FF)`,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px'
                    }}>
                      {React.cloneElement(feature.icon as React.ReactElement, { 
                        style: { color: '#fff', fontSize: 20 } 
                      })}
                    </div>
                    <Title level={4} style={{ marginBottom: 4 }}>{feature.title}</Title>
                    <Text type="secondary">{feature.description}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          {/* CTA区域 */}
          <Card style={{ 
            background: 'linear-gradient(135deg, #e6f4ff, #bae0ff)',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)',
            border: 'none'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: 24 
            }}>
              <div style={{ 
                width: 64, 
                height: 64, 
                background: 'linear-gradient(135deg, #1677ff, #0050b3)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ThunderboltOutlined style={{ color: '#fff', fontSize: 24 }} />
              </div>
            </div>
            
            <Title level={2}>准备好开始您的AI投标之旅了吗？</Title>
            <Paragraph style={{ 
              color: '#666', 
              marginBottom: 24,
              maxWidth: 600,
              margin: '0 auto 24px'
            }}>
              加入数百家企业，体验AI驱动的智能投标系统，
              让技术为您的业务增长助力
            </Paragraph>
            
            <Space size="large">
              <Link href="/auth/signup">
                <Button type="primary" size="large" icon={<RocketOutlined />}>
                  免费开始试用
                </Button>
              </Link>
              
              <Link href="/auth/signin">
                <Button size="large">已有账户？登录</Button>
              </Link>
            </Space>
          </Card>
        </div>

        {/* 页脚 */}
        <footer style={{ 
          borderTop: '1px solid #f0f0f0',
          paddingTop: 16,
          marginTop: 48,
          textAlign: 'center'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 4,
            marginBottom: 8
          }}>
            <div style={{ 
              width: 24, 
              height: 24, 
              background: 'linear-gradient(135deg, #1677ff, #0050b3)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
            </div>
            <Text strong>智能投标系统</Text>
          </div>
          <Text type="secondary">© 2024 智能投标系统. 基于AutoGen技术构建. 保留所有权利.</Text>
        </footer>
      </div>
    </div>
  );
}