'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeOutlined, 
  FolderOpenOutlined, 
  RobotOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined, 
  SettingOutlined,
  BarChartOutlined,
  BankOutlined,
  PartitionOutlined,
  ApiOutlined,
  MonitorOutlined,
  ThunderboltOutlined,
  StarOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { Menu, theme } from 'antd';
import type { MenuProps } from 'antd';

type MenuItem = Required<MenuProps>['items'][number];

const navigation = [
  { name: '概览', href: '/dashboard', icon: HomeOutlined },
  { name: '项目管理', href: '/dashboard/projects', icon: FolderOpenOutlined },
  { name: '投标工作流', href: '/dashboard/bid-workflow', icon: PartitionOutlined },
  { name: '工作流管理', href: '/dashboard/workflow-management', icon: RobotOutlined },
  { name: '智能体工作台', href: '/dashboard/agent-workspace', icon: ApiOutlined },
  { name: '文档管理', href: '/dashboard/documents', icon: FileTextOutlined },
  { name: '审核中心', href: '/dashboard/reviews', icon: CheckCircleOutlined },
  { name: '数据分析', href: '/dashboard/analytics', icon: BarChartOutlined },
  { name: '系统监控', href: '/dashboard/monitoring', icon: MonitorOutlined },
  { name: '租户管理', href: '/dashboard/tenant', icon: BankOutlined },
  { name: '系统设置', href: '/dashboard/settings', icon: SettingOutlined },
];

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[],
  type?: 'group',
): MenuItem {
  return {
    key,
    icon,
    children,
    label,
    type,
  } as MenuItem;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { token } = theme.useToken();
  
  const items: MenuItem[] = navigation.map(item => 
    getItem(
      <Link href={item.href} style={{ display: 'block', width: '100%' }}>
        {item.name}
      </Link>,
      item.href,
      <item.icon />
    )
  );

  // 添加底部AI助手卡片
  const bottomCard = (
    <div style={{ 
      position: 'absolute', 
      bottom: 24, 
      left: 16, 
      right: 16,
      background: 'linear-gradient(135deg, #e6f4ff, #bae0ff)',
      borderRadius: 8,
      padding: 12,
      cursor: 'pointer'
    }}>
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
            <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <div style={{ 
            position: 'absolute', 
            top: -2, 
            right: -2, 
            width: 10, 
            height: 10, 
            background: 'linear-gradient(135deg, #52c41a, #389e0d)',
            borderRadius: '50%',
            border: '1px solid #fff'
          }}></div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text strong style={{ fontSize: 14 }}>AI 智能助手</Text>
            <StarOutlined style={{ color: '#faad14', fontSize: 12 }} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>随时为您服务</Text>
        </div>
        <RocketOutlined style={{ color: '#1677ff', fontSize: 14 }} />
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8, 
        marginTop: 8 
      }}>
        <div style={{ flex: 1, background: '#ffffff4d', borderRadius: 10, height: 4 }}>
          <div 
            style={{ 
              background: 'linear-gradient(135deg, #52c41a, #389e0d)', 
              height: '100%', 
              borderRadius: 10, 
              width: '80%' 
            }}
          ></div>
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>在线</Text>
      </div>
    </div>
  );

  return (
    <div style={{ 
      height: '100%', 
      position: 'relative',
      background: '#fff'
    }}>
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        items={items}
        style={{ 
          height: '100%', 
          border: 'none',
          background: 'transparent'
        }}
        theme="light"
      />
      {bottomCard}
    </div>
  );
}