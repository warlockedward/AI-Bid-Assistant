'use client';

import { useState, useRef } from 'react';
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
  Spin,
  Row,
  Col
} from 'antd';
import { 
  MailOutlined, 
  LockOutlined, 
  HomeOutlined, 
  EyeInvisibleOutlined, 
  EyeTwoTone,
  RocketOutlined,
  RobotOutlined,
  StarOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const [form] = Form.useForm();

  const onFinish = async (values: { email: string; password: string; domain: string }) => {
    setLoading(true);
    setError('');

    try {
      console.log('登录请求:', values);
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        domain: values.domain,
        redirect: false
      });
      
      console.log('登录结果:', result);

      if (result?.error) {
        // 根据错误类型显示不同的错误信息
        switch (result.error) {
          case '用户不存在':
            setError('账户不存在，请检查邮箱地址');
            break;
          case '密码错误':
            setError('密码错误，请重新输入');
            break;
          case '账户已被禁用':
            setError('账户已被禁用，请联系管理员');
            break;
          case '认证服务暂时不可用':
            setError('认证服务暂时不可用，请稍后重试');
            break;
          default:
            setError('登录失败，请检查您的凭据');
        }
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('登录错误:', error);
      setError('登录过程中发生未知错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoData = () => {
    form.setFieldsValue({
      email: 'demo@example.com',
      password: 'demo123',
      domain: 'demo'
    });
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
                background: 'linear-gradient(135deg, #1677ff, #0050b3)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: '48px' }} />
              </div>
            </div>
            
            <Title level={2} style={{ marginBottom: '16px' }}>
              智能投标系统
            </Title>
            <Text style={{ fontSize: '18px', color: '#666', marginBottom: '24px' }}>
              AI驱动的下一代投标平台
            </Text>
            
            <Space style={{ marginBottom: '32px' }}>
              <StarOutlined style={{ color: '#faad14' }} />
              <Text strong>安全</Text>
              <Text type="secondary">•</Text>
              <Text strong>智能</Text>
              <Text type="secondary">•</Text>
              <Text strong>高效</Text>
              <StarOutlined style={{ color: '#faad14' }} />
            </Space>
            
            <Card style={{ 
              background: 'linear-gradient(135deg, #e6fffb, #f6ffed)',
              borderColor: '#bfbfbf',
              textAlign: 'left'
            }}>
              <Title level={5} style={{ display: 'flex', alignItems: 'center' }}>
                <RocketOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                演示账户信息
              </Title>
              <Space direction="vertical" size="small">
                <Text><Text strong>邮箱:</Text> demo@example.com</Text>
                <Text><Text strong>密码:</Text> demo123</Text>
                <Text><Text strong>域名:</Text> demo</Text>
              </Space>
            </Card>
          </div>
        </Col>
        
        {/* 右侧登录表单 */}
        <Col xs={24} lg={12}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            height: '100%' 
          }}>
            <Card style={{ 
              maxWidth: '450px',
              margin: '0 auto',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
              borderRadius: '12px'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <Title level={3}>欢迎登录</Title>
                <Text type="secondary">请使用您的账户信息登录系统</Text>
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
                form={form}
                name="login"
                onFinish={onFinish}
                layout="vertical"
              >
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
                
                <Form.Item
                  name="domain"
                  label="企业域名 (可选)"
                >
                  <Input 
                    prefix={<HomeOutlined />} 
                    placeholder="company-domain" 
                  />
                </Form.Item>
                
                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading} 
                    block
                  >
                    {loading ? '登录中...' : '登录'}
                  </Button>
                </Form.Item>
                
                <Form.Item>
                  <Button 
                    type="default" 
                    block
                    onClick={fillDemoData}
                  >
                    <RocketOutlined /> 使用演示账户
                  </Button>
                </Form.Item>
              </Form>
              
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <Text type="secondary">
                  还没有账户？{' '}
                  <Link href="/auth/signup" style={{ color: '#1677ff' }}>
                    立即注册
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