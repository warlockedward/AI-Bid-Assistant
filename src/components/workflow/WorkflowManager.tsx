'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  MessageSquare,
  Users,
  FileText,
  Settings
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { 
  pythonAPI, 
  WorkflowRequest, 
  WorkflowStatus, 
  AgentConversation,
  formatWorkflowStatus,
  formatStepName,
  getStepProgress,
  getEstimatedTimeRemaining,
  handleAPIError
} from '@/lib/python-api';

interface WorkflowManagerProps {
  projectId: string;
  tenderDocument?: string;
  requirements?: string[];
  onWorkflowComplete?: (result: any) => void;
}

export default function WorkflowManager({
  projectId,
  tenderDocument = '',
  requirements = [],
  onWorkflowComplete
}: WorkflowManagerProps) {
  const { data: session } = useSession();
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [conversation, setConversation] = useState<AgentConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [currentReview, setCurrentReview] = useState<{
    type: string;
    data: any;
  } | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 启动工作流
  const startWorkflow = useCallback(async () => {
    if (!session?.user) {
      toast.error('请先登录');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const workflowRequest: WorkflowRequest = {
        project_id: projectId,
        tenant_id: session.user.tenantId || '',
        user_id: session.user.id || '',
        tender_document: tenderDocument,
        requirements,
        generation_requirements: {
          format: 'professional',
          language: 'zh-CN',
          include_charts: true,
          include_timeline: true
        }
      };

      const response = await pythonAPI.startWorkflow(workflowRequest);
      setWorkflowId(response.workflow_id);
      toast.success('工作流已启动');
    } catch (err) {
      const errorMessage = handleAPIError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [session, projectId, tenderDocument, requirements]);

  // 获取工作流状态
  const fetchWorkflowStatus = useCallback(async () => {
    if (!workflowId) return;

    try {
      const response = await pythonAPI.getWorkflowStatus(workflowId);
      setWorkflowStatus(response.workflow_status);
      setConversation(response.chat_history);

      // 检查是否需要人工审核
      if (response.workflow_status.human_review_pending.length > 0) {
        const reviewType = response.workflow_status.human_review_pending[0];
        setCurrentReview({
          type: reviewType,
          data: response.workflow_status
        });
        setShowReviewDialog(true);
        setAutoRefresh(false);
      }

      // 工作流完成时的处理
      if (response.workflow_status.status === 'completed' && onWorkflowComplete) {
        onWorkflowComplete(response.workflow_status);
      }
    } catch (err) {
      console.error('获取工作流状态失败:', err);
    }
  }, [workflowId, onWorkflowComplete]);

  // 获取代理对话
  const fetchConversation = useCallback(async () => {
    if (!workflowId) return;

    try {
      const response = await pythonAPI.getWorkflowStatus(workflowId);
      setConversation(response.chat_history);
    } catch (err) {
      console.error('获取对话历史失败:', err);
    }
  }, [workflowId]);

  // 控制工作流
  const controlWorkflow = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!workflowId) return;

    try {
      await pythonAPI.controlWorkflow(workflowId, action);
      toast.success(`工作流已${action === 'pause' ? '暂停' : action === 'resume' ? '恢复' : '取消'}`);
      
      if (action === 'cancel') {
        setWorkflowId(null);
        setWorkflowStatus(null);
        setConversation([]);
      }
    } catch (err) {
      toast.error(handleAPIError(err));
    }
  };

  // 提交人工反馈
  const submitReview = async (action: 'continue' | 'reject' | 'modify') => {
    if (!workflowId || !currentReview) return;

    try {
      await pythonAPI.submitHumanFeedback({
        workflow_id: workflowId,
        review_type: currentReview.type,
        feedback: {
          action,
          comments: reviewFeedback,
          modifications: action === 'modify' ? { suggestions: reviewFeedback } : undefined
        }
      });

      setShowReviewDialog(false);
      setCurrentReview(null);
      setReviewFeedback('');
      setAutoRefresh(true);
      
      toast.success('反馈已提交');
    } catch (err) {
      toast.error(handleAPIError(err));
    }
  };

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || !workflowId) return;

    const interval = setInterval(() => {
      fetchWorkflowStatus();
      fetchConversation();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, workflowId, fetchWorkflowStatus, fetchConversation]);

  // 初始加载
  useEffect(() => {
    if (workflowId) {
      fetchWorkflowStatus();
      fetchConversation();
    }
  }, [workflowId, fetchWorkflowStatus, fetchConversation]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'waiting_for_review':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'waiting_for_review':
        return 'bg-yellow-500';
      case 'paused':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* 工作流控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            AutoGen 智能代理工作流
          </CardTitle>
          <CardDescription>
            多代理协作完成投标文档生成任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!workflowId ? (
                <Button 
                  onClick={startWorkflow} 
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {isLoading ? '启动中...' : '启动工作流'}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controlWorkflow('pause')}
                    disabled={workflowStatus?.status !== 'running'}
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controlWorkflow('resume')}
                    disabled={workflowStatus?.status !== 'paused'}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controlWorkflow('cancel')}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {workflowStatus && (
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  {getStatusIcon(workflowStatus.status)}
                  {formatWorkflowStatus(workflowStatus.status)}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  进度: {workflowStatus.progress}%
                </div>
              </div>
            )}
          </div>

          {error && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 工作流详情 */}
      {workflowStatus && (
        <Tabs defaultValue="progress" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="progress">执行进度</TabsTrigger>
            <TabsTrigger value="conversation">代理对话</TabsTrigger>
            <TabsTrigger value="details">详细信息</TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>执行进度</CardTitle>
                <CardDescription>
                  当前步骤: {formatStepName(workflowStatus.current_step)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>总体进度</span>
                      <span>{workflowStatus.progress}%</span>
                    </div>
                    <Progress value={workflowStatus.progress} className="w-full" />
                  </div>

                  <div className="space-y-3">
                    {workflowStatus.steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(step.status)}`} />
                        <div className="flex-1">
                          <div className="font-medium">{formatStepName(step.step_name)}</div>
                          <div className="text-sm text-muted-foreground">
                            {step.description}
                          </div>
                          {step.execution_time && (
                            <div className="text-xs text-muted-foreground mt-1">
                              执行时间: {step.execution_time.toFixed(1)}秒
                            </div>
                          )}
                        </div>
                        <Badge variant="outline">
                          {formatWorkflowStatus(step.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {workflowStatus.status === 'running' && (
                    <div className="text-sm text-muted-foreground">
                      预计剩余时间: {getEstimatedTimeRemaining(workflowStatus.steps)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  代理对话历史
                </CardTitle>
                <CardDescription>
                  查看各个代理之间的协作过程
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {conversation.map((msg, index) => (
                      <div key={index} className="border-l-2 border-blue-200 pl-4 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">
                            {formatStepName(msg.agent)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                          <Badge 
                            variant={msg.status === 'success' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {msg.status}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <div className="font-medium mb-1">输出:</div>
                          <div className="bg-muted p-2 rounded text-xs">
                            {msg.output}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  详细信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">执行ID</div>
                    <div className="text-muted-foreground font-mono">
                      {workflowStatus.execution_id}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">总执行时间</div>
                    <div className="text-muted-foreground">
                      {workflowStatus.execution_time.toFixed(1)}秒
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">当前步骤</div>
                    <div className="text-muted-foreground">
                      {formatStepName(workflowStatus.current_step)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">待审核项目</div>
                    <div className="text-muted-foreground">
                      {workflowStatus.human_review_pending.length > 0 
                        ? workflowStatus.human_review_pending.join(', ')
                        : '无'
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* 人工审核对话框 */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>人工审核</DialogTitle>
            <DialogDescription>
              请审核当前步骤的结果并提供反馈
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <div className="font-medium mb-2">审核类型</div>
              <Badge>{currentReview?.type}</Badge>
            </div>
            
            <div>
              <div className="font-medium mb-2">反馈意见</div>
              <Textarea
                placeholder="请输入您的反馈意见..."
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => submitReview('reject')}
            >
              拒绝
            </Button>
            <Button
              variant="outline"
              onClick={() => submitReview('modify')}
              disabled={!reviewFeedback.trim()}
            >
              修改
            </Button>
            <Button
              onClick={() => submitReview('continue')}
            >
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}