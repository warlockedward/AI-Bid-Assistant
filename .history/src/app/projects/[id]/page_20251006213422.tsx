'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Upload, 
  Download, 
  Settings, 
  Play,
  ArrowLeft,
  Calendar,
  DollarSign,
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import WorkflowManager from '@/components/workflow/WorkflowManager';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'in_progress' | 'completed' | 'submitted';
  deadline: string;
  budget: string;
  requirements: string[];
  tenderDocument?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    deadline: '',
    budget: '',
    requirements: [] as string[],
    tenderDocument: ''
  });
  const [newRequirement, setNewRequirement] = useState('');
  const [workflowResult, setWorkflowResult] = useState<any>(null);

  // 模拟项目数据加载
  useEffect(() => {
    const loadProject = async () => {
      setIsLoading(true);
      try {
        // 这里应该从API加载真实数据
        const mockProject: Project = {
          id: params.id as string,
          name: '智慧城市建设项目投标',
          description: '某市智慧城市综合建设项目，包含智能交通、智慧政务、数字化管理等多个子系统的建设和运维服务。',
          status: 'draft',
          deadline: '2024-12-31',
          budget: '5000万-8000万',
          requirements: [
            '具备智能交通系统建设经验',
            '拥有政务系统开发资质',
            '提供5年运维服务保障',
            '本地化部署要求',
            '符合国家信息安全等级保护要求'
          ],
          tenderDocument: `
# 智慧城市建设项目招标文件

## 项目概述
本项目旨在建设某市智慧城市综合平台，包含以下主要内容：

### 1. 智能交通系统
- 交通信号智能控制
- 车流量实时监测
- 停车位智能管理
- 公共交通调度优化

### 2. 智慧政务平台
- 政务服务一网通办
- 电子证照系统
- 在线审批流程
- 公众服务门户

### 3. 城市数字化管理
- 城市运行监控中心
- 应急指挥调度系统
- 环境监测网络
- 公共安全防控

## 技术要求
- 采用云原生架构
- 支持微服务部署
- 数据安全等级保护三级
- 7×24小时运维服务

## 投标要求
- 注册资本不少于5000万元
- 具备相关行业经验3年以上
- 拥有软件著作权不少于10项
- 通过ISO27001信息安全认证

## 评标标准
- 技术方案 (40%)
- 商务报价 (30%)
- 企业资质 (20%)
- 项目经验 (10%)
          `,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-20T15:30:00Z'
        };

        setProject(mockProject);
        setEditForm({
          name: mockProject.name,
          description: mockProject.description,
          deadline: mockProject.deadline,
          budget: mockProject.budget,
          requirements: mockProject.requirements,
          tenderDocument: mockProject.tenderDocument || ''
        });
      } catch (error) {
        toast.error('加载项目失败');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      loadProject();
    }
  }, [params.id]);

  const handleSaveProject = async () => {
    try {
      // 这里应该调用API保存项目
      const updatedProject = {
        ...project!,
        ...editForm,
        updatedAt: new Date().toISOString()
      };
      
      setProject(updatedProject);
      setIsEditing(false);
      toast.success('项目已保存');
    } catch (error) {
      toast.error('保存项目失败');
    }
  };

  const addRequirement = () => {
    if (newRequirement.trim()) {
      setEditForm(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement.trim()]
      }));
      setNewRequirement('');
    }
  };

  const removeRequirement = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  const handleWorkflowComplete = (result: any) => {
    setWorkflowResult(result);
    toast.success('工作流执行完成！');
    
    // 更新项目状态
    if (project) {
      setProject({
        ...project,
        status: 'completed',
        updatedAt: new Date().toISOString()
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'submitted':
        return 'bg-purple-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return '草稿';
      case 'in_progress':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'submitted':
        return '已提交';
      default:
        return '未知';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载项目中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>项目不存在或加载失败</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusColor(project.status)}>
                {getStatusText(project.status)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                更新于 {new Date(project.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {isEditing ? '取消编辑' : '编辑项目'}
          </Button>
          {workflowResult && (
            <Button>
              <Download className="h-4 w-4 mr-2" />
              下载结果
            </Button>
          )}
        </div>
      </div>

      {/* 项目概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">截止日期</div>
                <div className="font-medium">{project.deadline}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">预算范围</div>
                <div className="font-medium">{project.budget}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">需求数量</div>
                <div className="font-medium">{project.requirements.length} 项</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">项目概览</TabsTrigger>
          <TabsTrigger value="workflow">智能工作流</TabsTrigger>
          <TabsTrigger value="documents">文档管理</TabsTrigger>
          <TabsTrigger value="results">生成结果</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>项目信息</CardTitle>
              <CardDescription>
                {isEditing ? '编辑项目基本信息' : '查看项目详细信息'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">项目名称</Label>
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">项目描述</Label>
                    <Textarea
                      id="description"
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="deadline">截止日期</Label>
                      <Input
                        id="deadline"
                        type="date"
                        value={editForm.deadline}
                        onChange={(e) => setEditForm(prev => ({ ...prev, deadline: e.target.value }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="budget">预算范围</Label>
                      <Input
                        id="budget"
                        value={editForm.budget}
                        onChange={(e) => setEditForm(prev => ({ ...prev, budget: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>项目需求</Label>
                    <div className="space-y-2">
                      {editForm.requirements.map((req, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input value={req} readOnly />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeRequirement(index)}
                          >
                            删除
                          </Button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="添加新需求..."
                          value={newRequirement}
                          onChange={(e) => setNewRequirement(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addRequirement()}
                        />
                        <Button onClick={addRequirement}>添加</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      取消
                    </Button>
                    <Button onClick={handleSaveProject}>
                      保存
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-medium mb-2">项目描述</h3>
                    <p className="text-muted-foreground">{project.description}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">项目需求</h3>
                    <div className="space-y-2">
                      {project.requirements.map((req, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{req}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow" className="space-y-6">
          <WorkflowManager
            projectId={project.id}
            tenderDocument={project.tenderDocument}
            requirements={project.requirements}
            onWorkflowComplete={handleWorkflowComplete}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                招标文档
              </CardTitle>
              <CardDescription>
                查看和管理项目相关文档
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  <Label htmlFor="tenderDocument">招标文档内容</Label>
                  <Textarea
                    id="tenderDocument"
                    value={editForm.tenderDocument}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tenderDocument: e.target.value }))}
                    rows={15}
                    className="font-mono text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      文档长度: {project.tenderDocument?.length || 0} 字符
                    </div>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      上传文档
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <pre className="whitespace-pre-wrap text-sm">
                      {project.tenderDocument || '暂无文档内容'}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>生成结果</CardTitle>
              <CardDescription>
                查看AI生成的投标文档和分析结果
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workflowResult ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      工作流已完成，生成了完整的投标文档
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium">质量评分</div>
                      <div className="text-2xl font-bold text-green-600">
                        {workflowResult.final_document?.document_metadata?.overall_quality_score || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">合规评分</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {workflowResult.final_document?.document_metadata?.compliance_score || 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Button className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      下载完整投标文档
                    </Button>
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      查看详细分析报告
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    暂无生成结果，请先运行智能工作流
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}