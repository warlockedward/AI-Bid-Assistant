"""
弹性工作流引擎
实现带检查点的容错工作流执行
"""
import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


class WorkflowStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class WorkflowStep:
    """工作流步骤定义"""
    id: str
    name: str
    agent_type: str
    config: Dict[str, Any]
    dependencies: List[str]
    timeout: int = 300
    retry_count: int = 3
    retry_delay: int = 30


@dataclass
class WorkflowState:
    """工作流状态"""
    workflow_id: str
    tenant_id: str
    current_step: str
    status: WorkflowStatus
    steps_completed: List[str]
    steps_failed: List[str]
    state_data: Dict[str, Any]
    checkpoint_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None
    retry_count: int = 0


class ResilientWorkflowEngine:
    """弹性工作流引擎"""
    
    def __init__(self, storage_backend, max_retries: int = 5):
        self.storage = storage_backend
        self.max_retries = max_retries
        self.active_workflows: Dict[str, asyncio.Task] = {}
        self.agent_factories: Dict[str, Callable] = {}
        
    async def execute_workflow(
        self, 
        workflow_id: str, 
        tenant_id: str,
        steps: List[WorkflowStep],
        initial_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """执行弹性工作流"""
        try:
            # 创建工作流状态
            workflow_state = WorkflowState(
                workflow_id=workflow_id,
                tenant_id=tenant_id,
                current_step=steps[0].id if steps else "",
                status=WorkflowStatus.RUNNING,
                steps_completed=[],
                steps_failed=[],
                state_data=initial_data,
                checkpoint_data={},
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            # 保存初始状态
            await self.storage.save_workflow_state(workflow_state)
            
            # 异步执行工作流
            task = asyncio.create_task(
                self._execute_workflow_steps(workflow_state, steps)
            )
            self.active_workflows[workflow_id] = task
            
            # 等待完成或超时
            result = await asyncio.wait_for(task, timeout=3600)  # 1小时超时
            
            return {
                "success": True,
                "workflow_id": workflow_id,
                "result": result
            }
            
        except asyncio.TimeoutError:
            logger.error(f"工作流 {workflow_id} 执行超时")
            await self._handle_workflow_timeout(workflow_id)
            return {
                "success": False,
                "workflow_id": workflow_id,
                "error": "工作流执行超时"
            }
        except Exception as e:
            logger.error(f"工作流 {workflow_id} 执行失败: {e}")
            return {
                "success": False,
                "workflow_id": workflow_id,
                "error": str(e)
            }
    
    async def _execute_workflow_steps(
        self, 
        workflow_state: WorkflowState,
        steps: List[WorkflowStep]
    ) -> Dict[str, Any]:
        """执行工作流步骤"""
        remaining_steps = self._get_executable_steps(steps, workflow_state)
        
        while remaining_steps:
            current_step = remaining_steps[0]
            
            try:
                # 更新当前步骤
                workflow_state.current_step = current_step.id
                workflow_state.updated_at = datetime.now()
                
                # 保存检查点
                await self._save_checkpoint(workflow_state)
                
                # 执行步骤
                step_result = await self._execute_step_with_retry(
                    current_step, workflow_state
                )
                
                # 更新状态数据
                workflow_state.state_data.update(step_result)
                workflow_state.steps_completed.append(current_step.id)
                workflow_state.updated_at = datetime.now()
                
                # 保存状态
                await self.storage.save_workflow_state(workflow_state)
                
                logger.info(f"步骤 {current_step.name} 执行完成")
                
            except Exception as e:
                logger.error(f"步骤 {current_step.name} 执行失败: {e}")
                workflow_state.steps_failed.append(current_step.id)
                workflow_state.error_message = str(e)
                workflow_state.status = WorkflowStatus.FAILED
                workflow_state.updated_at = datetime.now()
                
                await self.storage.save_workflow_state(workflow_state)
                raise
            
            # 获取下一个可执行步骤
            remaining_steps = self._get_executable_steps(steps, workflow_state)
        
        # 工作流完成
        workflow_state.status = WorkflowStatus.COMPLETED
        workflow_state.updated_at = datetime.now()
        await self.storage.save_workflow_state(workflow_state)
        
        logger.info(f"工作流 {workflow_state.workflow_id} 执行完成")
        return workflow_state.state_data
    
    async def _execute_step_with_retry(
        self, 
        step: WorkflowStep, 
        workflow_state: WorkflowState
    ) -> Dict[str, Any]:
        """带重试机制的步骤执行"""
        last_error = None
        
        for attempt in range(step.retry_count + 1):
            try:
                # 创建智能体实例
                agent = self.agent_factories[step.agent_type](
                    tenant_id=workflow_state.tenant_id,
                    config=step.config
                )
                
                # 执行步骤
                result = await asyncio.wait_for(
                    agent.execute(workflow_state.state_data),
                    timeout=step.timeout
                )
                
                return result
                
            except Exception as e:
                last_error = e
                logger.warning(
                    f"步骤 {step.name} 第 {attempt + 1} 次尝试失败: {e}"
                )
                
                if attempt < step.retry_count:
                    await asyncio.sleep(step.retry_delay * (2 ** attempt))  # 指数退避
                else:
                    logger.error(f"步骤 {step.name} 所有重试尝试均失败")
                    raise last_error
        
        raise last_error  # 这行应该不会执行到
    
    def _get_executable_steps(
        self, 
        steps: List[WorkflowStep], 
        workflow_state: WorkflowState
    ) -> List[WorkflowStep]:
        """获取可执行的步骤"""
        executable = []
        
        for step in steps:
            # 跳过已完成的步骤
            if step.id in workflow_state.steps_completed:
                continue
            
            # 跳过已失败的步骤
            if step.id in workflow_state.steps_failed:
                continue
            
            # 检查依赖是否满足
            dependencies_met = all(
                dep in workflow_state.steps_completed 
                for dep in step.dependencies
            )
            
            if dependencies_met:
                executable.append(step)
        
        return executable
    
    async def _save_checkpoint(self, workflow_state: WorkflowState):
        """保存检查点"""
        workflow_state.checkpoint_data = {
            "state_data": workflow_state.state_data.copy(),
            "steps_completed": workflow_state.steps_completed.copy(),
            "timestamp": datetime.now().isoformat()
        }
        await self.storage.save_checkpoint(workflow_state.workflow_id, workflow_state.checkpoint_data)
    
    async def resume_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """恢复中断的工作流"""
        try:
            # 加载工作流状态
            workflow_state = await self.storage.load_workflow_state(workflow_id)
            if not workflow_state:
                raise ValueError(f"工作流 {workflow_id} 不存在")
            
            # 加载步骤定义
            steps = await self.storage.load_workflow_steps(workflow_id)
            
            # 恢复执行
            workflow_state.status = WorkflowStatus.RUNNING
            workflow_state.updated_at = datetime.now()
            
            await self.storage.save_workflow_state(workflow_state)
            
            # 重新执行
            return await self._execute_workflow_steps(workflow_state, steps)
            
        except Exception as e:
            logger.error(f"恢复工作流 {workflow_id} 失败: {e}")
            raise
    
    async def _handle_workflow_timeout(self, workflow_id: str):
        """处理工作流超时"""
        try:
            if workflow_id in self.active_workflows:
                self.active_workflows[workflow_id].cancel()
                del self.active_workflows[workflow_id]
            
            # 更新工作流状态
            workflow_state = await self.storage.load_workflow_state(workflow_id)
            if workflow_state:
                workflow_state.status = WorkflowStatus.FAILED
                workflow_state.error_message = "工作流执行超时"
                workflow_state.updated_at = datetime.now()
                await self.storage.save_workflow_state(workflow_state)
                
        except Exception as e:
            logger.error(f"处理工作流超时失败: {e}")
    
    def register_agent_factory(self, agent_type: str, factory: Callable):
        """注册智能体工厂"""
        self.agent_factories[agent_type] = factory
        logger.info(f"注册智能体类型: {agent_type}")
    
    async def get_workflow_status(self, workflow_id: str) -> Optional[WorkflowState]:
        """获取工作流状态"""
        return await self.storage.load_workflow_state(workflow_id)
    
    async def cancel_workflow(self, workflow_id: str):
        """取消工作流"""
        if workflow_id in self.active_workflows:
            self.active_workflows[workflow_id].cancel()
            del self.active_workflows[workflow_id]
        
        workflow_state = await self.storage.load_workflow_state(workflow_id)
        if workflow_state:
            workflow_state.status = WorkflowStatus.CANCELLED
            workflow_state.updated_at = datetime.now()
            await self.storage.save_workflow_state(workflow_state)


class MemoryWorkflowStorage:
    """内存工作流存储（开发环境使用）"""
    
    def __init__(self):
        self.workflow_states: Dict[str, WorkflowState] = {}
        self.workflow_steps: Dict[str, List[WorkflowStep]] = {}
        self.checkpoints: Dict[str, Dict[str, Any]] = {}
    
    async def save_workflow_state(self, workflow_state: WorkflowState):
        """保存工作流状态"""
        self.workflow_states[workflow_state.workflow_id] = workflow_state
    
    async def load_workflow_state(self, workflow_id: str) -> Optional[WorkflowState]:
        """加载工作流状态"""
        return self.workflow_states.get(workflow_id)
    
    async def save_checkpoint(self, workflow_id: str, checkpoint_data: Dict[str, Any]):
        """保存检查点"""
        self.checkpoints[workflow_id] = checkpoint_data
    
    async def load_workflow_steps(self, workflow_id: str) -> List[WorkflowStep]:
        """加载工作流步骤"""
        return self.workflow_steps.get(workflow_id, [])
    
    async def save_workflow_steps(self, workflow_id: str, steps: List[WorkflowStep]):
        """保存工作流步骤"""
        self.workflow_steps[workflow_id] = steps


# 使用示例
async def demo_workflow():
    """演示弹性工作流"""
    storage = MemoryWorkflowStorage()
    engine = ResilientWorkflowEngine(storage)
    
    # 定义工作流步骤
    steps = [
        WorkflowStep(
            id="analyze_tender",
            name="招标文件分析",
            agent_type="tender_analysis",
            config={"model": "gpt-4"},
            dependencies=[]
        ),
        WorkflowStep(
            id="retrieve_knowledge",
            name="知识检索",
            agent_type="knowledge_retrieval",
            config={"rag_endpoint": "http://localhost:8001/api/rag"},
            dependencies=["analyze_tender"]
        ),
        # ... 更多步骤
    ]
    
    # 执行工作流
    result = await engine.execute_workflow(
        workflow_id="demo_workflow_001",
        tenant_id="tenant_001",
        steps=steps,
        initial_data={"tender_document": "招标文件内容..."}
    )
    
    return result