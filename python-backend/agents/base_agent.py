import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.base import TaskResult
from autogen_ext.models.openai import OpenAIChatCompletionClient
from datetime import datetime
import logging
from monitoring.logger import logger as monitoring_logger
from monitoring.metrics import metrics_collector, AgentMetrics

from .llm_client import LLMClient, get_llm_client


class BaseAgent(ABC):
    """AutoGen代理基类"""
    
    def __init__(self, tenant_id: str, tenant_settings: Dict[str, Any]):
        self.tenant_id = tenant_id
        self.tenant_settings = tenant_settings
        self.logger = logging.getLogger(
            f"{self.__class__.__name__}_{tenant_id}"
        )
        
        # 配置LLM客户端
        self.llm_client = self._get_llm_client()
        
        # 配置AutoGen模型客户端（用于AutoGen框架）
        self.model_client = self._get_model_client()
        
        # 创建AutoGen代理
        self.autogen_agent = self._create_autogen_agent()
    
    def _get_llm_client(self) -> LLMClient:
        """获取统一LLM客户端"""
        # 尝试从租户设置获取配置
        api_key = self.tenant_settings.get("openai_api_key")
        api_base = self.tenant_settings.get("openai_base_url")
        llm_model = self.tenant_settings.get("ai_models", {}).get("primary", "Qwen3-QwQ-32B")
        
        if api_key and api_base:
            return LLMClient(
                api_key=api_key,
                api_base=api_base,
                llm_model=llm_model
            )
        else:
            # 使用全局客户端
            return get_llm_client()
    
    def _get_model_client(self) -> OpenAIChatCompletionClient:
        """获取AutoGen模型客户端"""
        import os
        return OpenAIChatCompletionClient(
            model=self.tenant_settings.get("ai_models", {}).get("primary", 
                                                                os.getenv("LLM_MODEL", "Qwen3-QwQ-32B")),
            api_key=self.tenant_settings.get("openai_api_key", os.getenv("OPENAI_API_KEY", "")),
            base_url=self.tenant_settings.get("openai_base_url", 
                                              os.getenv("OPENAI_API_BASE", "")),
        )
    
    @abstractmethod
    def _create_autogen_agent(self) -> AssistantAgent:
        """创建具体的AutoGen代理"""
        pass
    
    @abstractmethod
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """执行代理任务"""
        start_time = time.time()
        operation = f"{self.__class__.__name__}_execute"
        
        # Create tenant-aware logger
        tenant_logger = monitoring_logger.with_tenant(self.tenant_id)
        
        tenant_logger.info(f"Starting agent execution: {operation}", {
            "component": "agent",
            "agent_type": self.__class__.__name__,
            "operation": operation
        })
        
        try:
            # Execute the actual agent logic
            result = await self._execute_impl(input_data)
            
            # Calculate execution time
            duration = (time.time() - start_time) * 1000  # Convert to ms
            
            # Record successful execution metrics
            metrics_collector.record_agent_operation(AgentMetrics(
                agent_id=f"{self.__class__.__name__}_{self.tenant_id}",
                agent_type=self.__class__.__name__,
                tenant_id=self.tenant_id,
                workflow_id=input_data.get("workflow_id"),
                operation=operation,
                duration=duration,
                status="success",
                input_tokens=result.get("input_tokens"),
                output_tokens=result.get("output_tokens"),
                rag_queries=result.get("rag_queries")
            ))
            
            tenant_logger.info(f"Agent execution completed: {operation}", {
                "component": "agent",
                "agent_type": self.__class__.__name__,
                "operation": operation,
                "duration": duration,
                "status": "success"
            })
            
            return result
            
        except Exception as error:
            # Calculate execution time for failed operation
            duration = (time.time() - start_time) * 1000
            
            # Record failed execution metrics
            metrics_collector.record_agent_operation(AgentMetrics(
                agent_id=f"{self.__class__.__name__}_{self.tenant_id}",
                agent_type=self.__class__.__name__,
                tenant_id=self.tenant_id,
                workflow_id=input_data.get("workflow_id"),
                operation=operation,
                duration=duration,
                status="error"
            ))
            
            tenant_logger.error(f"Agent execution failed: {operation}", {
                "component": "agent",
                "agent_type": self.__class__.__name__,
                "operation": operation,
                "duration": duration,
                "status": "error"
            }, error)
            
            raise
    
    @abstractmethod
    async def _execute_impl(
        self, 
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """实际的代理执行逻辑，由子类实现"""
        pass
    
    async def _chat_with_agent(
        self, 
        message: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        system_message: Optional[str] = None
    ) -> str:
        """
        与LLM对话 - 使用统一LLM客户端
        
        Args:
            message: 用户消息
            temperature: 温度参数
            max_tokens: 最大token数
            system_message: 系统消息（可选）
            
        Returns:
            LLM生成的响应
        """
        try:
            # 构建消息列表
            messages = []
            
            # 添加系统消息
            if system_message:
                messages.append({"role": "system", "content": system_message})
            elif hasattr(self, 'autogen_agent') and hasattr(self.autogen_agent, '_system_message'):
                # 尝试从AutoGen代理获取系统消息
                messages.append({"role": "system", "content": self.autogen_agent._system_message})
            
            # 添加用户消息
            messages.append({"role": "user", "content": message})
            
            # 调用LLM
            response = await self.llm_client.chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            return response
            
        except Exception as e:
            self.logger.error(f"LLM chat failed: {str(e)}")
            raise
    
    def _log(self, message: str, level: str = "info"):
        """记录日志"""
        timestamp = datetime.now().isoformat()
        log_message = f"[{timestamp}][{self.tenant_id}] {message}"
        
        if level == "error":
            self.logger.error(log_message)
        elif level == "warning":
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)
    
    def _get_timestamp(self) -> str:
        """获取当前时间戳"""
        return datetime.now().isoformat()