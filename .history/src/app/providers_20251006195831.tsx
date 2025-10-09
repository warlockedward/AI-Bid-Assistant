'use client';

import React from 'react';
import { ConfigProvider } from 'antd';
import { SessionProvider } from 'next-auth/react';
import StyledComponentsRegistry from './antd-registry';
import zhCN from 'antd/locale/zh_CN';

// cSpell:ignore sider

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StyledComponentsRegistry>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1677ff',
            colorLink: '#1677ff',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorInfo: '#1677ff',
            borderRadius: 6,
          },
          components: {
            Layout: {
              headerBg: '#ffffff',
              siderBg: '#ffffff',
            },
            Menu: {
              itemBg: '#ffffff',
              itemHoverBg: '#f5f5f5',
              itemSelectedBg: '#e6f4ff',
              itemSelectedColor: '#1677ff',
            },
          },
        }}
      >
        <SessionProvider>{children}</SessionProvider>
      </ConfigProvider>
    </StyledComponentsRegistry>
  );
}