"""
智能体管理器模块
实现基于AutoGen的智能体初始化和配置
"""
import logging
from typing import Dict, List, Optional, Any
from autogen.agentchat import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager
from autogen.agentchat.agent import ConversableAgent

logger = logging.getLogger(__name__)


class BaseAgent:
    """基础智能体类"""
    
    def __init__(self, name: str, system_message: str, **kwargs):
        self.name = name
        self.system_message = system_message
        self.config = kwargs
        self.agent: Optional[ConversableAgent] = None
        
    def initialize(self, llm_config: Dict[str, Any]) -> ConversableAgent:
        """初始化智能体"""
        raise NotImplementedError("子类必须实现initialize方法")


class BidAgentManager:
    """投标智能体管理器"""
    
    def __init__(self, llm_config: Dict[str, Any]):
        self.llm_config = llm_config
        self.agents: Dict[str, ConversableAgent] = {}
        self.group_chats: Dict[str, GroupChat] = {}
        
    def initialize_agent(self, name: str, system_message: str, **kwargs) -> ConversableAgent:
        """初始化单个智能体"""
        try:
            agent = AssistantAgent(
                name=name,
                system_message=system_message,
                llm_config=self.llm_config,
                **kwargs
            )
            self.agents[name] = agent
            logger.info(f"智能体 {name} 初始化成功")
            return agent
        except Exception as e:
            logger.error(f"智能体 {name} 初始化失败: {e}")
            raise
    
    def initialize_user_proxy(self, name: str, **kwargs) -> UserProxyAgent:
        """初始化用户代理智能体"""
        try:
            agent = UserProxyAgent(
                name=name,
                code_execution_config=False,
                human_input_mode="NEVER",
                **kwargs
            )
            self.agents[name] = agent
            logger.info(f"用户代理 {name} 初始化成功")
            return agent
        except Exception as e:
            logger.error(f"用户代理 {name} 初始化失败: {e}")
            raise
    
    def create_group_chat(self, group_name: str, agent_names: List[str], 
                         max_round: int = 10) -> GroupChatManager:
        """创建群聊管理器"""
        try:
            agents = [self.agents[name] for name in agent_names if name in self.agents]
            
            if not agents:
                raise ValueError(f"未找到指定的智能体: {agent_names}")
            
            group_chat = GroupChat(
                agents=agents,
                messages=[],
                max_round=max_round,
                admin_name=agent_names[0]  # 第一个智能体作为管理员
            )
            
            manager = GroupChatManager(
                groupchat=group_chat,
                llm_config=self.llm_config
            )
            
            self.group_chats[group_name] = group_chat
            logger.info(f"群聊 {group_name} 创建成功，包含 {len(agents)} 个智能体")
            return manager
            
        except Exception as e:
            logger.error(f"群聊 {group_name} 创建失败: {e}")
            raise
    
    def register_tool(self, agent_name: str, tool_function, tool_name: str, 
                     description: str) -> bool:
        """为智能体注册工具函数"""
        try:
            if agent_name not in self.agents:
                logger.error(f"智能体 {agent_name} 不存在")
                return False
            
            # 使用AutoGen的函数注册功能
            self.agents[agent_name].register_function(
                function_map={
                    tool_name: {
                        "function": tool_function,
                        "description": description
                    }
                }
            )
            logger.info(f"为智能体 {agent_name} 注册工具 {tool_name} 成功")
            return True
            
        except Exception as e:
            logger.error(f"注册工具失败: {e}")
            return False
    
    def get_agent_status(self) -> Dict[str, Any]:
        """获取所有智能体状态"""
        status = {
            "total_agents": len(self.agents),
            "active_groups": len(self.group_chats),
            "agents": {},
            "groups": {}
        }
        
        for name, agent in self.agents.items():
            status["agents"][name] = {
                "type": type(agent).__name__,
                "initialized": agent is not None
            }
        
        for name, group in self.group_chats.items():
            status["groups"][name] = {
                "agent_count": len(group.agents),
                "max_rounds": group.max_round,
                "current_round": len(group.messages)
            }
        
        return status


class VLLMClient:
    """VLLM客户端配置"""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = 30
        
    def get_llm_config(self, model: str = "gpt-3.5-turbo") -> Dict[str, Any]:
        """获取LLM配置"""
        config = {
            "config_list": [
                {
                    "model": model,
                    "api_key": self.api_key or "sk-placeholder",
                    "base_url": f"{self.base_url}/v1",
                    "api_type": "open_ai"
                }
            ],
            "timeout": self.timeout,
            "temperature": 0.7,
            "cache_seed": None
        }
        return config
    
    def test_connection(self) -> bool:
        """测试连接"""
        try:
            import requests
            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except Exception:
            return False


def create_default_llm_config() -> Dict[str, Any]:
    """创建默认LLM配置"""
    return {
        "config_list": [
            {
                "model": "gpt-3.5-turbo",
                "api_key": "sk-placeholder",
                "api_type": "open_ai"
            }
        ],
        "timeout": 60,
        "temperature": 0.7
    }