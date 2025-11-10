"""
基于AutoGen的智能体工作流管理器 - 支持动态模型配置
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import asyncio
import threading
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import MaxMessageTermination
from autogen_agentchat.base import TaskResult


class AgentWorkflowManager:
    """基于AutoGen的智能体工作流管理器 - 支持动态模型配置"""
    
    def __init__(self):
        self.workflows = {}
        self.group_chats = {}
        self.model_configs = {}
        self._lock = threading.Lock()  # Add lock for thread-safe operations
        
    async def start_workflow(
        self, 
        workflow_id: str, 
        tender_agent, 
        knowledge_agent, 
        content_agent, 
        compliance_agent, 
        tender_document: str, 
        requirements: Dict[str, Any], 
        tenant_id: str,
        model_provider=None,  # type: ignore
        model_name: Optional[str] = None
    ) -> str:
        """启动新的工作流"""
        # 获取租户和模型特定的配置
        # 注意：这里我们假设配置已经通过代理传递，不再需要单独处理
        
        # 创建群聊团队
        termination_condition = MaxMessageTermination(20)  # 最大20轮对话
        group_chat = RoundRobinGroupChat(
            participants=[
                tender_agent, 
                knowledge_agent, 
                content_agent, 
                compliance_agent
            ],
            termination_condition=termination_condition
        )
        
        # 存储工作流状态
        self.workflows[workflow_id] = {
            "status": "running",
            "start_time": datetime.now(),
            "agents": {
                "tender_analyst": tender_agent,
                "knowledge_retriever": knowledge_agent,
                "content_generator": content_agent,
                "compliance_verifier": compliance_agent
            },
            "group_chat": group_chat,
            "execution_id": str(uuid.uuid4()),
            "chat_history": [],
            "current_step": "initializing",
            "progress": 0.0
        }
        
        self.group_chats[workflow_id] = group_chat
        
        # 启动工作流执行
        task = self._execute_workflow(
            workflow_id, 
            tender_document, 
            requirements
        )
        asyncio.create_task(task)
        
        return self.workflows[workflow_id]["execution_id"]
    
    async def _execute_workflow(
        self, 
        workflow_id: str, 
        tender_document: str, 
        requirements: Dict[str, Any]
    ):
        """执行工作流逻辑"""
        try:
            # 确保group_chat存在
            if workflow_id not in self.group_chats:
                msg = f"Group chat for workflow {workflow_id} not found"
                raise ValueError(msg)
                
            # 步骤1: 招标分析
            self._update_workflow_status(
                workflow_id, 
                "running", 
                "tender_analysis", 
                0.25
            )
            analysis_result = await self._run_tender_analysis(
                workflow_id, 
                tender_document, 
                requirements
            )
            
            # 步骤2: 知识检索
            self._update_workflow_status(
                workflow_id, 
                "running", 
                "knowledge_retrieval", 
                0.5
            )
            knowledge_result = await self._run_knowledge_retrieval(
                workflow_id, 
                analysis_result
            )
            
            # 步骤3: 内容生成
            self._update_workflow_status(
                workflow_id, 
                "running", 
                "content_generation", 
                0.75
            )
            content_result = await self._run_content_generation(
                workflow_id, 
                analysis_result, 
                knowledge_result
            )
            
            # 步骤4: 合规验证
            self._update_workflow_status(
                workflow_id, 
                "running", 
                "compliance_verification", 
                0.9
            )
            compliance_result = await self._run_compliance_verification(
                workflow_id, 
                content_result, 
                requirements
            )
            
            # 完成
            self._update_workflow_status(
                workflow_id, 
                "completed", 
                "finished", 
                1.0, 
                {
                    "analysis": analysis_result,
                    "knowledge": knowledge_result,
                    "content": content_result,
                    "compliance": compliance_result
                }
            )
            
        except ValueError as e:
            self._update_workflow_status(
                workflow_id, 
                "failed", 
                "error", 
                0.0, 
                error=str(e)
            )
    
    async def _run_tender_analysis(
        self, 
        workflow_id: str, 
        document: str, 
        requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """运行招标分析"""
        workflow = self.workflows[workflow_id]
        tender_agent = workflow["agents"]["tender_analyst"]
        
        message = f"""
请分析以下招标文档并提取关键需求：

招标文档：
{document}

具体要求：
{requirements}
"""
        
        # 使用新的AutoGen API运行代理
        result: TaskResult = await tender_agent.run(task=message)
        return self._parse_agent_response(result)
    
    async def _run_knowledge_retrieval(
        self, 
        workflow_id: str, 
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """运行知识检索"""
        workflow = self.workflows[workflow_id]
        knowledge_agent = workflow["agents"]["knowledge_retriever"]
        
        message = f"""
基于以下招标分析结果，检索相关知识：

分析结果：
{analysis}

请提供相关的行业标准、最佳实践和成功案例。
"""
        
        # 使用新的AutoGen API运行代理
        result: TaskResult = await knowledge_agent.run(task=message)
        return self._parse_agent_response(result)
    
    async def _run_content_generation(
        self, 
        workflow_id: str, 
        analysis: Dict[str, Any], 
        knowledge: Dict[str, Any]
    ) -> Dict[str, Any]:
        """运行内容生成"""
        workflow = self.workflows[workflow_id]
        content_agent = workflow["agents"]["content_generator"]
        
        message = f"""
基于招标分析和相关知识，生成完整的投标方案：

招标分析：
{analysis}

相关知识：
{knowledge}

请生成技术方案、商务方案和实施计划。
"""
        
        # 使用新的AutoGen API运行代理
        result: TaskResult = await content_agent.run(task=message)
        return self._parse_agent_response(result)
    
    async def _run_compliance_verification(
        self, 
        workflow_id: str, 
        content: Dict[str, Any],
        requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """运行合规验证"""
        workflow = self.workflows[workflow_id]
        compliance_agent = workflow["agents"]["compliance_verifier"]
        
        message = f"""
验证以下投标内容是否符合招标要求：

投标内容：
{content}

招标要求：
{requirements}

请进行全面的合规性检查。
"""
        
        # 使用新的AutoGen API运行代理
        result: TaskResult = await compliance_agent.run(task=message)
        return self._parse_agent_response(result)
    
    def _parse_agent_response(self, response: TaskResult) -> Dict[str, Any]:
        """解析代理响应"""
        if response.messages:
            last_message = response.messages[-1]
            if hasattr(last_message, 'content'):
                content = getattr(last_message, 'content', '')
                return {"content": content or "", "status": "success"}
            return {"content": str(last_message), "status": "success"}
        return {"content": "", "status": "success"}
    
    def _update_workflow_status(
        self, 
        workflow_id: str, 
        status: str, 
        current_step: str, 
        progress: float, 
        result: Optional[Dict[str, Any]] = None, 
        error: Optional[str] = None
    ):
        """更新工作流状态 - 线程安全"""
        with self._lock:
            if workflow_id in self.workflows:
                self.workflows[workflow_id].update({
                    "status": status,
                    "current_step": current_step,
                    "progress": progress,
                    "result": result,
                    "error": error,
                    "last_updated": datetime.now()
                })
    
    def get_workflow_status(
        self, 
        workflow_id: str
    ) -> Optional[Dict[str, Any]]:
        """获取工作流状态"""
        return self.workflows.get(workflow_id)
    
    def submit_human_feedback(
        self, 
        workflow_id: str, 
        feedback: Dict[str, Any]
    ):
        """提交人工反馈"""
        if workflow_id in self.workflows:
            workflow_data = self.workflows[workflow_id]
            # 将反馈添加到聊天历史
            if "human_feedback" not in workflow_data:
                workflow_data["human_feedback"] = []
            workflow_data["human_feedback"].append({
                "timestamp": datetime.now(),
                "feedback": feedback
            })
    
    def get_conversation_history(
        self, 
        workflow_id: str
    ) -> List[Dict[str, Any]]:
        """获取对话历史"""
        if workflow_id in self.workflows:
            # 注意：在新的API中，我们需要不同的方式来获取历史
            # 这里简化处理
            return []
        return []
    
    def cancel_workflow(self, workflow_id: str):
        """取消工作流"""
        if workflow_id in self.workflows:
            self.workflows[workflow_id]["status"] = "cancelled"
            self.workflows[workflow_id]["last_updated"] = datetime.now()
