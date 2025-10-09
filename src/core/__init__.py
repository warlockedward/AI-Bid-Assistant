"""
核心模块 - 智能体框架基础
"""
from .agents import BidAgentManager, BaseAgent
from .coordinator import TeamCoordinator

__all__ = ["BidAgentManager", "BaseAgent", "TeamCoordinator"]