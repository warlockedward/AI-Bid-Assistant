from autogen.agentchat import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager
from typing import Dict, Any, List, Optional, Callable
import asyncio
import json
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AutoGenBaseAgent(AssistantAgent):
    """基于AutoGen原生框架的基础代理类"""
    
    def __init__(
        self,
        name: str,
        system_message: str,
        tenant_id: str,
        tenant_settings: Dict[str, Any],
        llm_config: Optional[Dict[str, Any]] = None,
        human_input_mode: str = "NEVER",
        max_consecutive_auto_reply: int = 10,
        **kwargs
    ):
        # 使用租户配置构建LLM配置
        if llm_config is None:
            llm_config = self._build_llm_config(tenant_settings)
        
        # 调用AutoGen原生构造函数
        super().__init__(
            name=name,
            system_message=system_message,
            llm_config=llm_config,
            human_input_mode=human_input_mode,
            max_consecutive_auto_reply=max_consecutive_auto_reply,
            **kwargs
        )
        
        self.tenant_id = tenant_id
        self.tenant_settings = tenant_settings
        self.execution_history = []
        
        # 注册函数调用能力
        self._register_functions()
    
    def _build_llm_config(self, tenant_settings: Dict[str, Any]) -> Dict[str, Any]:
        """根据租户设置构建LLM配置"""
        return {
            "config_list": [
                {
                    "model": tenant_settings.get("llm_model", "gpt-4"),
                    "api_key": tenant_settings.get("openai_api_key", ""),
                    "base_url": tenant_settings.get("openai_base_url", "https://api.openai.com/v1"),
                    "temperature": tenant_settings.get("temperature", 0.7),
                    "max_tokens": tenant_settings.get("max_tokens", 2000)
                }
            ],
            "timeout": 120,
            "cache_seed": None,  # 禁用缓存以确保每次都是新的响应
        }
    
    def _register_functions(self):
        """注册代理可调用的函数 - 子类应重写此方法"""
        pass
    
    def log_execution(self, action: str, details: Dict[str, Any]):
        """记录执行历史"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "agent": self.name,
            "action": action,
            "details": details
        }
        self.execution_history.append(log_entry)
        logger.info(f"[{self.name}] {action}: {details}")
    
    async def a_execute_task(self, task_description: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """异步执行任务 - 使用AutoGen的原生对话能力"""
        try:
            self.log_execution("task_start", {"task": task_description, "context": context})
            
            # 构建任务消息
            task_message = self._build_task_message(task_description, context or {})
            
            # 使用AutoGen的原生generate_reply方法
            messages = [{"role": "user", "content": task_message}]
            
            # 异步生成回复
            reply = await self.a_generate_reply(messages=messages)
            
            # 解析和处理回复
            result = self._process_reply(reply, task_description, context)
            
            self.log_execution("task_complete", {"result_summary": result.get("summary", "")})
            
            return result
            
        except Exception as e:
            error_result = {
                "status": "error",
                "error": str(e),
                "task": task_description,
                "timestamp": datetime.now().isoformat()
            }
            self.log_execution("task_error", {"error": str(e)})
            return error_result
    
    def _build_task_message(self, task_description: str, context: Dict[str, Any]) -> str:
        """构建任务消息 - 子类应重写此方法"""
        return f"请执行以下任务：{task_description}\n\n上下文信息：{json.dumps(context, ensure_ascii=False, indent=2)}"
    
    def _process_reply(self, reply: str, task_description: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """处理代理回复 - 子类应重写此方法"""
        return {
            "status": "success",
            "reply": reply,
            "task": task_description,
            "timestamp": datetime.now().isoformat(),
            "summary": reply[:200] + "..." if len(reply) > 200 else reply
        }


class AutoGenFunctionAgent(AutoGenBaseAgent):
    """支持函数调用的AutoGen代理基类"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 启用函数调用
        if self.llm_config:
            self.llm_config["functions"] = self._get_function_schemas()
    
    def _get_function_schemas(self) -> List[Dict[str, Any]]:
        """获取函数模式定义 - 子类应重写此方法"""
        return []
    
    def _register_functions(self):
        """注册函数调用处理器"""
        # 注册所有可调用函数
        for func_name, func_handler in self._get_function_handlers().items():
            self.register_function(
                function_map={func_name: func_handler}
            )
    
    def _get_function_handlers(self) -> Dict[str, Callable]:
        """获取函数处理器映射 - 子类应重写此方法"""
        return {}


class AutoGenWorkflowOrchestrator:
    """基于AutoGen GroupChat的工作流编排器"""
    
    def __init__(self, tenant_id: str, tenant_settings: Dict[str, Any]):
        self.tenant_id = tenant_id
        self.tenant_settings = tenant_settings
        self.agents = {}
        self.group_chat = None
        self.group_chat_manager = None
        self.execution_history = []
    
    def add_agent(self, agent: AutoGenBaseAgent):
        """添加代理到工作流"""
        self.agents[agent.name] = agent
        logger.info(f"Added agent {agent.name} to workflow orchestrator")
    
    def create_group_chat(self, 
                         max_round: int = 10,
                         admin_name: str = "Admin") -> GroupChat:
        """创建AutoGen GroupChat"""
        
        if not self.agents:
            raise ValueError("No agents added to the orchestrator")
        
        # 创建管理员代理
        from autogen.agentchat import ConversableAgent
        admin_agent = ConversableAgent(
            name=admin_name,
            system_message="你是工作流管理员，负责协调各个专业代理完成投标文档生成任务。",
            llm_config=self._build_admin_llm_config(),
            human_input_mode="NEVER"
        )
        
        # 将管理员添加到代理列表
        all_agents = [admin_agent] + list(self.agents.values())
        
        # 创建GroupChat
        self.group_chat = GroupChat(
            agents=all_agents,
            messages=[],
            max_round=max_round
        )
        
        # 创建GroupChatManager
        self.group_chat_manager = GroupChatManager(
            groupchat=self.group_chat,
            llm_config=self._build_admin_llm_config()
        )
        
        return self.group_chat
    
    def _build_admin_llm_config(self) -> Dict[str, Any]:
        """构建管理员LLM配置"""
        return {
            "config_list": [
                {
                    "model": self.tenant_settings.get("llm_model", "gpt-4"),
                    "api_key": self.tenant_settings.get("openai_api_key", ""),
                    "base_url": self.tenant_settings.get("openai_base_url", "https://api.openai.com/v1"),
                    "temperature": 0.3,  # 管理员使用较低温度以保持一致性
                    "max_tokens": 1000
                }
            ],
            "timeout": 120,
        }
    
    async def a_execute_workflow(self, initial_message: str) -> Dict[str, Any]:
        """异步执行工作流"""
        try:
            if not self.group_chat or not self.group_chat_manager:
                raise ValueError("GroupChat not initialized. Call create_group_chat() first.")
            
            self.log_execution("workflow_start", {"message": initial_message})
            
            # 获取第一个代理（通常是管理员）
            initiator = self.group_chat.agents[0]
            
            # 使用AutoGen的异步聊天功能
            chat_result = await initiator.a_initiate_chat(
                self.group_chat_manager,
                message=initial_message
            )
            
            # 处理聊天结果
            result = self._process_chat_result(chat_result)
            
            self.log_execution("workflow_complete", {"result_summary": result.get("summary", "")})
            
            return result
            
        except Exception as e:
            error_result = {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            self.log_execution("workflow_error", {"error": str(e)})
            return error_result
    
    def _process_chat_result(self, chat_result) -> Dict[str, Any]:
        """处理聊天结果"""
        return {
            "status": "success",
            "chat_history": chat_result.chat_history if hasattr(chat_result, 'chat_history') else [],
            "summary": chat_result.summary if hasattr(chat_result, 'summary') else "Workflow completed",
            "cost": chat_result.cost if hasattr(chat_result, 'cost') else None,
            "timestamp": datetime.now().isoformat()
        }
    
    def log_execution(self, action: str, details: Dict[str, Any]):
        """记录执行历史"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "orchestrator": "AutoGenWorkflowOrchestrator",
            "action": action,
            "details": details
        }
        self.execution_history.append(log_entry)
        logger.info(f"[Orchestrator] {action}: {details}")
    
    def get_chat_history(self) -> List[Dict[str, Any]]:
        """获取聊天历史"""
        if self.group_chat and self.group_chat.messages:
            return [
                {
                    "role": msg.get("role", "unknown"),
                    "name": msg.get("name", "unknown"),
                    "content": msg.get("content", ""),
                    "timestamp": datetime.now().isoformat()
                }
                for msg in self.group_chat.messages
            ]
        return []
    
    def get_execution_history(self) -> List[Dict[str, Any]]:
        """获取完整执行历史"""
        # 合并编排器和所有代理的执行历史
        all_history = self.execution_history.copy()
        
        for agent in self.agents.values():
            if hasattr(agent, 'execution_history'):
                all_history.extend(agent.execution_history)
        
        # 按时间戳排序
        all_history.sort(key=lambda x: x["timestamp"])
        
        return all_history