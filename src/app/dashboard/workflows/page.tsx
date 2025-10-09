'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { pythonAPI } from '@/lib/python-api';

interface WorkflowExecution {
  execution_id: string;
  project_id: string;
  status: 'running' | 'completed' | 'failed';
  steps: Array<{
    agent: string;
    status: string;
    result?: any;
    error?: string;
  }>;
  created_at: string;
}

export default function WorkflowsPage() {
  const { data: session } = useSession();
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      // 这里应该调用API获取工作流执行列表
      // 暂时使用模拟数据
      setExecutions([]);
    } catch (error) {
      console.error('加载工作流失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewWorkflow = async () => {
    if (!session?.user) return;
    
    try {
      const result = await pythonAPI.startWorkflow({
        tenant_id: session.user.tenantId,
        user_id: session.user.id,
        project_id: 'demo-project',
        tender_document: '示例招标文档内容...',
        requirements: ['技术要求', '商务要求', '合规要求'],
        generation_requirements: {
          format: 'professional',
          language: 'zh-CN'
        },
        tenant_settings: {
          llm_config: {
            model: 'gpt-4',
            api_key: 'demo-key',
            temperature: 0.7,
          },
          fastgpt_config: {
            api_url: 'http://localhost:3001',
            api_key: 'demo-key',
          },
        },
      });
      
      console.log('工作流已启动:', result);
      loadExecutions();
    } catch (error) {
      console.error('启动工作流失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">工作流管理</h1>
        <Button onClick={startNewWorkflow}>
          启动新工作流
        </Button>
      </div>

      <div className="grid gap-6">
        {executions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">暂无工作流执行记录</p>
            <Button onClick={startNewWorkflow}>
              创建第一个工作流
            </Button>
          </div>
        ) : (
          executions.map((execution) => (
            <div
              key={execution.execution_id}
              className="border rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    执行ID: {execution.execution_id}
                  </h3>
                  <p className="text-gray-600">
                    项目: {execution.project_id}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    execution.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : execution.status === 'running'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {execution.status === 'completed' ? '已完成' :
                   execution.status === 'running' ? '运行中' : '失败'}
                </span>
              </div>

              <div className="space-y-2">
                {execution.steps.map((step, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        step.status === 'completed'
                          ? 'bg-green-500'
                          : step.status === 'running'
                          ? 'bg-blue-500'
                          : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm">
                      {step.agent}: {step.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedExecution(execution.execution_id)}
                >
                  查看详情
                </Button>
                {execution.status === 'running' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => pythonAPI.controlWorkflow(execution.execution_id, 'cancel')}
                  >
                    停止
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}