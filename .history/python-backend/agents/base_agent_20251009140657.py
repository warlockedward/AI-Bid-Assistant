import asyncio
import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import autogen_agentchat.agents
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient
from datetime import datetime
import logging
from monitoring.logger import logger as monitoring_logger
from monitoring.metrics import metrics_collector, AgentMetrics

class BaseAgent(ABC):
    """AutoGen代理基类"""
    
    def __init__(self, tenant_id: str, tenant_settings: Dict[str, Any]):
        self.tenant_id = tenant_id
        self.tenant_settings = tenant_settings
        self.logger = logging.getLogger(f"{self.__class__.__name__}_{tenant_id}")
        
        # 配置LLM
        self.model_client = self._get_model_client()
        
        # 创建AutoGen代理
        self.autogen_agent = self._create_autogen_agent()
    
    def _get_model_client(self) -> OpenAIChatCompletionClient:
        """获取模型客户端"""
        return OpenAIChatCompletionClient(
            model=self.tenant_settings.get("ai_models", {}).get("primary", "gpt-4"),
            api_key=self.tenant_settings.get("openai_api_key", ""),
            base_url=self.tenant_settings.get("openai_base_url", "https://api.openai.com/v1"),
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
            duration = (time.time() - start_time) * 1000  # Convert to milliseconds
            
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
    async def _execute_impl(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """实际的代理执行逻辑，由子类实现"""
        pass
    
    async def _chat_with_agent(self, message: str) -> str:
        """与AutoGen代理对话"""
        # 使用最新的AgentChat API运行代理
        result = await self.autogen_agent.run(task=message)
        return result.content
    
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