"""
团队协调器模块
实现智能体之间的任务路由和协调
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from autogen.agentchat import GroupChatManager, GroupChat

logger = logging.getLogger(__name__)


class TeamCoordinator:
    """团队协调器"""
    
    def __init__(self, max_rounds: int = 10, timeout: int = 300):
        self.max_rounds = max_rounds
        self.timeout = timeout
        self.active_groups: Dict[str, GroupChatManager] = {}
        self.task_routing: Dict[str, List[str]] = {}
        self.callback_handlers: Dict[str, Callable] = {}
        
    def setup_round_robin_group(self, group_name: str, agents: List, 
                               admin_agent: Optional[str] = None) -> GroupChatManager:
        """设置轮询群聊"""
        try:
            if not agents:
                raise ValueError("智能体列表不能为空")
            
            group_chat = GroupChat(
                agents=agents,
                messages=[],
                max_round=self.max_rounds,
                admin_name=admin_agent or agents[0].name
            )
            
            manager = GroupChatManager(groupchat=group_chat)
            self.active_groups[group_name] = manager
            
            logger.info(f"轮询群聊 {group_name} 设置成功，包含 {len(agents)} 个智能体")
            return manager
            
        except Exception as e:
            logger.error(f"设置轮询群聊失败: {e}")
            raise
    
    def route_task_by_input(self, user_input: str, available_agents: List[str]) -> List[str]:
        """基于用户输入路由任务到合适的智能体"""
        # 简单的关键词路由逻辑
        routing_rules = {
            "分析": ["tender_analyst"],
            "招标": ["tender_analyst"],
            "检索": ["knowledge_retriever"],
            "知识": ["knowledge_retriever"],
            "生成": ["content_generator"],
            "内容": ["content_generator"],
            "合规": ["compliance_validator"],
            "验证": ["compliance_validator"]
        }
        
        matched_agents = set()
        user_input_lower = user_input.lower()
        
        for keyword, agents in routing_rules.items():
            if keyword in user_input_lower:
                matched_agents.update([agent for agent in agents if agent in available_agents])
        
        # 如果没有匹配到特定智能体，使用所有可用智能体
        if not matched_agents:
            matched_agents = set(available_agents)
        
        return list(matched_agents)
    
    async def run_group_chat_with_timeout(self, group_name: str, initial_message: str, 
                                        timeout: Optional[int] = None) -> Dict[str, Any]:
        """运行带超时的群聊"""
        if group_name not in self.active_groups:
            raise ValueError(f"群聊 {group_name} 不存在")
        
        timeout_seconds = timeout or self.timeout
        start_time = datetime.now()
        
        try:
            # 异步执行群聊
            result = await asyncio.wait_for(
                self._execute_group_chat(group_name, initial_message),
                timeout=timeout_seconds
            )
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"群聊 {group_name} 执行完成，耗时 {duration:.2f} 秒")
            
            return {
                "success": True,
                "messages": result,
                "duration": duration,
                "timeout": False
            }
            
        except asyncio.TimeoutError:
            duration = (datetime.now() - start_time).total_seconds()
            logger.warning(f"群聊 {group_name} 超时，耗时 {duration:.2f} 秒")
            
            return {
                "success": False,
                "messages": [],
                "duration": duration,
                "timeout": True,
                "error": f"群聊执行超时 ({timeout_seconds} 秒)"
            }
            
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"群聊 {group_name} 执行失败: {e}")
            
            return {
                "success": False,
                "messages": [],
                "duration": duration,
                "timeout": False,
                "error": str(e)
            }
    
    async def _execute_group_chat(self, group_name: str, initial_message: str) -> List[Dict]:
        """执行群聊（异步包装）"""
        manager = self.active_groups[group_name]
        
        # 这里需要根据AutoGen的实际异步接口进行调整
        # 目前使用同步调用，实际应该使用异步版本
        try:
            # 模拟异步执行
            await asyncio.sleep(0.1)
            
            # 实际应该调用 manager.a_initiate_chat() 如果支持异步
            # 这里返回模拟结果
            return [
                {"role": "user", "content": initial_message},
                {"role": "assistant", "content": "模拟响应"}
            ]
            
        except Exception as e:
            logger.error(f"群聊执行错误: {e}")
            raise
    
    def register_callback_handler(self, event_type: str, handler: Callable):
        """注册回调处理器"""
        self.callback_handlers[event_type] = handler
        logger.info(f"注册 {event_type} 事件处理器")
    
    def trigger_callback(self, event_type: str, data: Any):
        """触发回调"""
        if event_type in self.callback_handlers:
            try:
                self.callback_handlers[event_type](data)
            except Exception as e:
                logger.error(f"回调处理器执行失败: {e}")
    
    def get_group_status(self, group_name: str) -> Dict[str, Any]:
        """获取群聊状态"""
        if group_name not in self.active_groups:
            return {"error": f"群聊 {group_name} 不存在"}
        
        manager = self.active_groups[group_name]
        group_chat = manager.groupchat
        
        return {
            "group_name": group_name,
            "agent_count": len(group_chat.agents),
            "max_rounds": group_chat.max_round,
            "current_round": len(group_chat.messages),
            "admin_agent": group_chat.admin_name,
            "is_active": True
        }
    
    def cleanup_inactive_groups(self, max_age_minutes: int = 60):
        """清理不活跃的群聊"""
        current_time = datetime.now()
        groups_to_remove = []
        
        # 这里需要根据实际实现来检测不活跃群聊
        # 目前是简化实现
        for group_name in list(self.active_groups.keys()):
            # 模拟检测逻辑 - 实际应该检查最后活动时间
            if "test" in group_name.lower():
                groups_to_remove.append(group_name)
        
        for group_name in groups_to_remove:
            del self.active_groups[group_name]
            logger.info(f"清理不活跃群聊: {group_name}")


class TimeoutManager:
    """超时管理器"""
    
    def __init__(self, default_timeout: int = 300):
        self.default_timeout = default_timeout
        self.active_tasks: Dict[str, asyncio.Task] = {}
        
    async def execute_with_timeout(self, task_id: str, coro, timeout: Optional[int] = None):
        """带超时执行协程"""
        timeout_seconds = timeout or self.default_timeout
        
        try:
            task = asyncio.create_task(coro)
            self.active_tasks[task_id] = task
            
            result = await asyncio.wait_for(task, timeout=timeout_seconds)
            del self.active_tasks[task_id]
            
            return result
            
        except asyncio.TimeoutError:
            if task_id in self.active_tasks:
                self.active_tasks[task_id].cancel()
                del self.active_tasks[task_id]
            raise TimeoutError(f"任务 {task_id} 超时 ({timeout_seconds} 秒)")
        
        except Exception as e:
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
            raise
    
    def cancel_task(self, task_id: str):
        """取消任务"""
        if task_id in self.active_tasks:
            self.active_tasks[task_id].cancel()
            del self.active_tasks[task_id]
            logger.info(f"取消任务: {task_id}")
    
    def get_active_tasks(self) -> List[str]:
        """获取活跃任务列表"""
        return list(self.active_tasks.keys())