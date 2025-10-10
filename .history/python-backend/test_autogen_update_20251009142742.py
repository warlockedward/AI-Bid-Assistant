#!/usr/bin/env python3
"""
测试更新后的AutoGen实现
"""

import asyncio
from typing import Dict, Any
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient
from agents.base_agent import BaseAgent


class TestAgent(BaseAgent):
    """测试代理"""
    
    def __init__(self, tenant_id: str, tenant_settings: Dict[str, Any]):
        super().__init__(tenant_id, tenant_settings)
    
    def _create_autogen_agent(self) -> AssistantAgent:
        """创建测试代理"""
        agent = AssistantAgent(
            name=f"test_agent_{self.tenant_id}",
            model_client=self.model_client,
            system_message="你是一个测试代理，用于验证AutoGen的新API实现。"
        )
        return agent
    
    async def _execute_impl(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """执行测试"""
        message = input_data.get("message", "你好，世界！")
        result = await self._chat_with_agent(message)
        return {"response": result}


async def main():
    """主函数"""
    print("测试更新后的AutoGen实现...")
    
    # 创建测试配置
    tenant_settings = {
        "ai_models": {
            "primary": "gpt-4"
        },
        "openai_api_key": "test-key",
        "openai_base_url": "https://api.openai.com/v1"
    }
    
    # 创建测试代理
    agent = TestAgent("test_tenant", tenant_settings)
    
    # 测试执行
    try:
        result = await agent.execute({"message": "请用中文回复：Hello, AutoGen!"})
        print(f"测试结果: {result}")
        print("AutoGen更新测试成功！")
    except Exception as e:
        print(f"测试失败: {e}")


if __name__ == "__main__":
    asyncio.run(main())