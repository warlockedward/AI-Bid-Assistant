'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Button, 
  Card, 
  Input, 
  Spin, 
  Empty, 
  Row, 
  Col,
  Space,
  Typography
} from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  FilterOutlined 
} from '@ant-design/icons';
import { ProjectCard } from '@/components/projects/project-card';

const { Title, Text } = Typography;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const result = await response.json();
        // 根据API响应结构调整
        const projectsData = result.data?.projects || [];
        setProjects(projectsData);
      } else {
        // 处理错误响应
        console.error('获取项目列表失败:', response.status, response.statusText);
        setProjects([]); // 确保设置默认值
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
      setProjects([]); // 确保设置默认值
    } finally {
      setLoading(false);
    }
  };

  const handleProjectCreated = (newProject: any) => {
    setProjects([newProject, ...projects]);
    setShowCreateDialog(false);
  };

  const filteredProjects = (projects || []).filter((project: any) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: '0 0 8px 0' }}>项目管理</Title>
          <Text type="secondary">管理您的投标项目和工作流</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateDialog(true)}>
          创建项目
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Input
          placeholder="搜索项目..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
        <Button icon={<FilterOutlined />}>筛选</Button>
      </div>

      {/* 项目列表 */}
      {filteredProjects.length > 0 ? (
        <Row gutter={[24, 24]}>
          {filteredProjects.map((project: any) => (
            <Col xs={24} sm={12} lg={8} key={project.id}>
              <ProjectCard project={project} />
            </Col>
          ))}
        </Row>
      ) : (
        <Card style={{ textAlign: 'center', padding: '48px 0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <Text strong style={{ fontSize: '16px' }}>
                  {searchTerm ? '未找到匹配的项目' : '暂无项目'}
                </Text>
                <Text type="secondary">
                  {searchTerm ? '尝试调整搜索条件' : '创建您的第一个投标项目'}
                </Text>
              </Space>
            }
          >
            {!searchTerm && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateDialog(true)}>
                创建项目
              </Button>
            )}
          </Empty>
        </Card>
      )}
    </div>
  );
}