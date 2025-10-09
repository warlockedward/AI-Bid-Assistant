'use client';

import React from 'react';
import { Layout } from 'antd';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';

// cSpell:ignore Sider

const { Content, Sider } = Layout;

export default function DashboardLayoutClient({
  children,
  user
}: {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    tenant: { name: string };
  };
}) {
  return (
    <Layout hasSider style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          overflow: 'auto'
        }}
        theme="light"
      >
        <div style={{ height: '100%' }}>
          <DashboardSidebar />
        </div>
      </Sider>
      
      <Layout 
        style={{ 
          marginLeft: 240,
          minHeight: '100vh'
        }}
      >
        <DashboardHeader user={user} />
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 16, background: '#fff', minHeight: '100%' }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}