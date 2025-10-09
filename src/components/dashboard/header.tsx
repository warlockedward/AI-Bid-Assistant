'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { 
  UserOutlined, 
  LogoutOutlined, 
  SettingOutlined, 
  BellOutlined, 
  SearchOutlined, 
  ThunderboltOutlined,
  StarOutlined,
  CrownOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { Avatar, Badge, Button, Dropdown, Input, Layout, Menu, Space, theme, Typography } from 'antd';
import type { MenuProps } from 'antd';

const { Header } = Layout;
const { Text } = Typography;

interface DashboardHeaderProps {
  user: {
    name?: string | null;
    email: string;
    tenant?: {
      name: string;
    };
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { token } = theme.useToken();
  
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <UserOutlined />,
    },
    {
      key: 'settings',
      label: '系统设置',
      icon: <SettingOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => signOut(),
    },
  ];

  return (
    <Header style={{ 
      background: '#fff', 
      padding: '0 16px',
      borderBottom: '1px solid #f0f0f0',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        height: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Logo和标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                background: 'linear-gradient(135deg, #1677ff, #0050b3)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ThunderboltOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div style={{ 
                position: 'absolute', 
                top: -2, 
                right: -2, 
                width: 12, 
                height: 12, 
                background: 'linear-gradient(135deg, #faad14, #ff4d4f)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <StarOutlined style={{ color: '#fff', fontSize: 6 }} />
              </div>
            </div>
            <div>
              <Text strong style={{ fontSize: 16 }}>智能投标系统</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {user.tenant?.name || '智能投标平台'}
              </Text>
            </div>
          </div>
          
          {/* 搜索栏 */}
          <div style={{ width: 300 }}>
            <Input
              placeholder="搜索项目、文档..."
              prefix={<SearchOutlined />}
              style={{ borderRadius: 20 }}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* 通知 */}
          <Badge count={3} size="small">
            <Button 
              type="text" 
              icon={<BellOutlined />} 
              style={{ fontSize: 18 }}
            />
          </Badge>
          
          {/* 用户信息 */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 20
            }}>
              <Avatar 
                size="small" 
                style={{ 
                  backgroundColor: '#1677ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <UserOutlined style={{ fontSize: 14 }} />
              </Avatar>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Text strong style={{ fontSize: 14 }}>
                  {user.name || '用户'}
                  <CrownOutlined style={{ color: '#faad14', fontSize: 12, marginLeft: 4 }} />
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {user.email}
                </Text>
              </div>
            </div>
          </Dropdown>
        </div>
      </div>
    </Header>
  );
}