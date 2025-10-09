'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Button, 
  Input, 
  Form, 
  Card, 
  Space, 
  Typography,
  Alert,
  Row,
  Col,
  Divider
} from 'antd';
import { 
  UserOutlined, 
  MailOutlined, 
  LockOutlined, 
  HomeOutlined, 
  EyeInvisibleOutlined, 
  EyeTwoTone,
  RocketOutlined,
  CheckCircleOutlined,
  LeftOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const onFinish = async (values: { 
    email: string; 
    password: string; 
    confirmPassword: string;
    name: string; 
    companyName: string; 
    domain: string 
  }) => {
    setLoading(true);
    setError('');

    if (values.password !== values.confirmPassword) {
      setError('密码不匹配');
      setLoading(false);
      return;
    }

    if (values.password.length < 6) {
      setError('密码长度至少6位');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          name: values.name,
          companyName: values.companyName,
          domain: values.domain || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 根据错误代码显示不同的错误信息
        if (data.error?.code) {
          switch (data.error.code) {
            case 'MISSING_REQUIRED_FIELDS':
              setError('请填写所有必填字段');
              break;
            case 'INVALID_EMAIL':
              setError('邮箱格式不正确');
              break;
            case 'WEAK_PASSWORD':
              setError('密码长度至少6位');
              break;
            case 'EMAIL_EXISTS':
              setError('该邮箱已被注册');
              break;
            case 'TENANT_NOT_FOUND':
              setError('指定的企业域名不存在');
              break;
            case 'DATABASE_CONFLICT':
              setError('数据冲突，请稍后重试');
              break;
            case 'INTERNAL_SERVER_ERROR':
              setError('服务器内部错误，请稍后重试');
              break;
            default:
              setError(data.error.message || '注册失败');
          }
        } else {
          setError(data.error || '注册失败');
        }
        setLoading(false);
        return;
      }

      // 注册成功后自动登录
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        domain: values.domain || data.data?.user?.tenant?.domain,
        redirect: false
      });

      if (result?.error) {
        setError('注册成功但登录失败，请手动登录');
        router.push('/auth/signin');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('注册错误:', error);
      setError('网络错误，请检查网络连接后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f0f2f5 0%, #e6f4ff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{ position: 'absolute', top: '24px', left: '24px' }}>
        <Link href="/auth/signin">
          <Button type="text" icon={<LeftOutlined />}>
            返回登录
          </Button>
        </Link>
      </div>
      
      <Row gutter={[48, 0]} style={{ width: '100%', maxWidth: '1200px' }}>
        {/* 左侧介绍区域 */}
        <Col xs={24} lg={12}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            height: '100%',
            textAlign: 'center',
            padding: '48px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: '32px' 
            }}>
              <div style={{ 
                width: '100px', 
                height: '100px', 
                background: 'linear-gradient(135deg, #722ed1, #531dab)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
              }}>
                <RocketOutlined style={{ color: '#fff', fontSize: '48px' }} />
              </div>
            </div>
            
            <Title level={2} style={{ marginBottom: '16px' }}>
              加入AI革命
            </Title>
            <Text style={{ fontSize: '18px', color: '#666', marginBottom: '24px' }}>
              创建您的智能投标账户
            </Text>
            
            <Space style={{ marginBottom: '32px' }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text strong>免费试用</Text>
              <Text type="secondary">•</Text>
              <Text strong>即时开始</Text>
              <Text type="secondary">•</Text>
              <Text strong>无需信用卡</Text>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            </Space>
            
            <Card style={{ 
              background: 'linear-gradient(135deg, #f9f0ff, #f0f5ff)',
              borderColor: '#bfbfbf',
              textAlign: 'left'
            }}>
              <Title level={5} style={{ display: 'flex', alignItems: 'center' }}>
                <RocketOutlined style={{ marginRight: '8px', color: '#722ed1' }} />
                开始您的AI之旅
              </Title>
              <ul style={{ paddingLeft: '20px' }}>
                <li style={{ marginBottom: '8px' }}>AI驱动的投标文档生成</li>
                <li style={{ marginBottom: '8px' }}>自动化工作流管理</li>
                <li style={{ marginBottom: '8px' }}>智能合规检查</li>
                <li>实时协作与审核</li>
              </ul>
            </Card>
          </div>
        </Col>
        
        {/* 右侧注册表单 */}
        <Col xs={24} lg={12}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            height: '100%' 
          }}>
            <Card style={{ 
              maxWidth: '500px',
              margin: '0 auto',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
              borderRadius: '12px'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <Title level={3}>创建账户</Title>
                <Text type="secondary">填写以下信息开始您的智能投标之旅</Text>
              </div>
              
              {error && (
                <Alert 
                  message={error} 
                  type="error" 
                  showIcon 
                  style={{ marginBottom: '24px' }}
                />
              )}
              
              <Form
                name="register"
                onFinish={onFinish}
                layout="vertical"
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="name"
                      label="姓名"
                      rules={[{ required: true, message: '请输入姓名!' }]}
                    >
                      <Input 
                        prefix={<UserOutlined />} 
                        placeholder="张三" 
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="companyName"
                      label="公司名称"
                    >
                      <Input 
                        prefix={<HomeOutlined />} 
                        placeholder="科技有限公司" 
                      />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item
                  name="email"
                  label="邮箱地址"
                  rules={[{ required: true, message: '请输入邮箱地址!' }]}
                >
                  <Input 
                    prefix={<MailOutlined />} 
                    placeholder="user@example.com" 
                  />
                </Form.Item>
                
                <Form.Item
                  name="domain"
                  label="企业域名 (可选 - 加入现有企业)"
                >
                  <Input 
                    prefix={<HomeOutlined />} 
                    placeholder="company-domain" 
                  />
                </Form.Item>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="password"
                      label="密码"
                      rules={[{ required: true, message: '请输入密码!' }]}
                    >
                      <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                        iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="confirmPassword"
                      label="确认密码"
                      rules={[{ required: true, message: '请确认密码!' }]}
                    >
                      <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                        iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading} 
                    block
                    icon={<CheckCircleOutlined />}
                  >
                    {loading ? '注册中...' : '创建账户'}
                  </Button>
                </Form.Item>
              </Form>
              
              <Divider style={{ margin: '24px 0' }}>或</Divider>
              
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">
                  已有账户？{' '}
                  <Link href="/auth/signin" style={{ color: '#722ed1' }}>
                    立即登录
                  </Link>
                </Text>
              </div>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
}