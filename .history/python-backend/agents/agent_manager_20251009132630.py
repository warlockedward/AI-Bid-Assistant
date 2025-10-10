"""
基于AutoGen的智能体工作流管理器 - 支持动态模型配置
"""

from typing import Dict, Any, List, Optional, TYPE_CHECKING
from datetime import datetime
import uuid
import asyncio

if TYPE_CHECKING:
    from config import ModelProvider
    from autogen.agentchat import GroupChat, GroupChatManager


# 延迟导入避免循环依赖和环境问题
def get_group_chat_classes():
    """获取GroupChat和GroupChatManager类"""
    try:
        from autogen.agentchat import GroupChat, GroupChatManager
        return GroupChat, GroupChatManager
    except ImportError:
        # Mock classes for development environment
        class GroupChat:
            def __init__(self, *args, **kwargs):
                pass
        
        class GroupChatManager:
            def __init__(self, *args, **kwargs):
                pass
        
        return GroupChat, GroupChatManager


def get_config_module():
    """获取配置模块"""
    try:
        import sys
        import os
        # 添加项目根目录到路径
        project_root = os.path.dirname(
            os.path.dirname(os.path.abspath(__file__)))
        sys.path.append(project_root)
        from config import ModelProvider, get_tenant_config
        return ModelProvider, get_tenant_config
    except ImportError:
        # Handle relative import issues
        try:
            from config import ModelProvider, get_tenant_config
            return ModelProvider, get_tenant_config
        except ImportError:
            # Mock for development
            class ModelProvider:
                OPENAI = "openai"
            
            def get_tenant_config(
                tenant_id: str,
                model_provider=None,
                model_name=None
            ) -> Dict[str, Any]:
                return {
                    "llm_config": [{"model": "gpt-4"}],
                    "workflow_settings": {"max_rounds": 10}
                }
            
            return ModelProvider, get_tenant_config


# Get classes
GroupChat, GroupChatManager = get_group_chat_classes()
ModelProvider, get_tenant_config = get_config_module()


class AgentWorkflowManager:
    """基于AutoGen的智能体工作流管理器 - 支持动态模型配置"""
    
    def __init__(self):
        self.workflows = {}
        self.group_chats = {}
        self.managers = {}
        self.model_configs = {}
        
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
        model_provider=None,
        model_name: Optional[str] = None
    ) -> str:
        """启动新的工作流"""
        if model_provider is None:
            model_provider = ModelProvider.OPENAI
            
        # 获取租户和模型特定的配置
        # 获取租户和模型特定的配置
        config = get_tenant_config(tenant_id, model_provider, model_name)
        self.model_configs[workflow_id] = {
            "provider": model_provider,
            "model_name": model_name,
            "config": config
        }
        
        # 更新代理的LLM配置
        agent_list = [
            tender_agent, 
            knowledge_agent, 
            content_agent, 
            compliance_agent
        ]
        for agent in agent_list:
            if hasattr(agent, 'llm_config'):
                agent.llm_config = config["llm_config"][0]
        
        # 创建代理列表
        agents = [
            tender_agent, 
            knowledge_agent, 
            content_agent, 
            compliance_agent
        ]
        
        # 创建群聊
        group_chat = GroupChat(
            agents=agents,
            messages=[],
            max_round=config["workflow_settings"]["max_rounds"],
            speaker_selection_method="round_robin"
        )
        
        # 创建群聊管理器
        manager = GroupChatManager(
            groupchat=group_chat,
            llm_config=config["llm_config"][0]
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
            "manager": manager,
            "execution_id": str(uuid.uuid4()),
            "chat_history": [],
            "current_step": "initializing",
            "progress": 0.0
        }
        
        self.group_chats[workflow_id] = group_chat
        self.managers[workflow_id] = manager
        
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
            # 确保manager存在
            if workflow_id not in self.managers:
                msg = f"Manager for workflow {workflow_id} not found"
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
            
        except Exception as e:
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
        
        # 使用AutoGen的对话机制
        message = f"""
请分析以下招标文档并提取关键需求：

招标文档：
{document}

具体要求：
{requirements}
"""
        
        # 确保代理有a_generate_reply方法
        if hasattr(tender_agent, 'a_generate_reply'):
            result = await tender_agent.a_generate_reply(
                messages=[{"content": message, "role": "user"}]
            )
        else:
            # 如果没有异步方法，使用同步方法
            result = tender_agent.generate_reply(
                messages=[{"content": message, "role": "user"}]
            )
            
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
        
        # 确保代理有a_generate_reply方法
        if hasattr(knowledge_agent, 'a_generate_reply'):
            result = await knowledge_agent.a_generate_reply(
                messages=[{"content": message, "role": "user"}]
            )
        else:
            # 如果没有异步方法，使用同步方法
            result = knowledge_agent.generate_reply(
                messages=[{"content": message, "role": "user"}]
            )
            
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
        
        # 确保代理有a_generate_reply方法
        if hasattr(content_agent, 'a_generate_reply'):
            result = await content_agent.a_generate_reply(
                messages=[{"content": message, "role": "user"}]
            )
        else:
            # 如果没有异步方法，使用同步方法
            result = content_agent.generate_reply(
                messages=[{"content": message, "role": "user"}]
            )
            
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
        
        # 确保代理有a_generate_reply方法
        if hasattr(compliance_agent, 'a_generate_reply'):
            result = await compliance_agent.a_generate_reply(
                messages=[{"content": message, "role": "user"}]
            )
        else:
            # 如果没有异步方法，使用同步方法
            result = compliance_agent.generate_reply(
                messages=[{"content": message, "role": "user"}]
            )
            
        return self._parse_agent_response(result)
    
    def _parse_agent_response(self, response) -> Dict[str, Any]:
        """解析代理响应"""
        if hasattr(response, 'content'):
            return {"content": response.content, "status": "success"}
        elif isinstance(response, str):
            return {"content": response, "status": "success"}
        else:
            return {"content": str(response), "status": "success"}
    
    def _update_workflow_status(
        self, 
        workflow_id: str, 
        status: str, 
        current_step: str, 
        progress: float, 
        result: Optional[Dict[str, Any]] = None, 
        error: Optional[str] = None
    ):
        """更新工作流状态"""
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
            group_chat = self.group_chats.get(workflow_id)
            if group_chat:
                return [
                    {"role": msg["role"], "content": msg["content"]} 
                    for msg in group_chat.messages
                ]
        return []
    
    def cancel_workflow(self, workflow_id: str):
        """取消工作流"""
        if workflow_id in self.workflows:
            self.workflows[workflow_id]["status"] = "cancelled"
            self.workflows[workflow_id]["last_updated"] = datetime.now()