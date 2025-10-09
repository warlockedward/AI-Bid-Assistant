import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardHeader } from '@/components/dashboard/header';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { Layout } from 'antd';
import React from 'react';

// cSpell:ignore Sider

const { Content, Sider } = Layout;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

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
        <DashboardHeader user={{
          name: session.user.name || '',
          email: session.user.email || '',
          tenant: { name: '智能投标平台' }
        }} />
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 16, background: '#fff', minHeight: '100%' }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}