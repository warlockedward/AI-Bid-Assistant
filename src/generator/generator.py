"""
投标文件生成器模块
实现分段文档处理和内容生成
"""
import logging
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from autogen.agentchat import AssistantAgent

logger = logging.getLogger(__name__)


class ProposalGenerator:
    """投标文件生成器"""
    
    def __init__(self, llm_config: Dict[str, Any], rag_tools: Any):
        self.llm_config = llm_config
        self.rag_tools = rag_tools
        self.generation_agent: Optional[AssistantAgent] = None
        self.user_confirmation_timeout = 300  # 5分钟
        self.context_integration_enabled = True
        
    def initialize_agent(self) -> AssistantAgent:
        """初始化内容生成智能体"""
        try:
            system_message = """你是一个专业的投标文件撰写专家。你的任务是：
1. 根据招标文件要求生成高质量的投标文件内容
2. 分段处理文档，确保逻辑连贯性
3. 集成用户偏好和上下文信息
4. 生成符合行业标准的专业内容

请确保生成的内容：
- 符合招标文件的技术和商务要求
- 结构清晰，逻辑严谨
- 语言专业，表达准确
- 包含必要的技术细节和实施方案"""
            
            self.generation_agent = AssistantAgent(
                name="content_generator",
                system_message=system_message,
                llm_config=self.llm_config
            )
            
            logger.info("内容生成智能体初始化成功")
            return self.generation_agent
            
        except Exception as e:
            logger.error(f"内容生成智能体初始化失败: {e}")
            raise
    
    async def generate_section(self, section_type: str, requirements: str, 
                             context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """生成文档段落"""
        try:
            # 获取相关知识
            rag_results = await self.rag_tools.query_rag_system(
                f"{section_type} {requirements}",
                top_k=3
            )
            
            # 构建生成提示
            prompt = self._build_generation_prompt(section_type, requirements, 
                                                  rag_results, context)
            
            # 使用智能体生成内容
            if self.generation_agent is None:
                self.initialize_agent()
            
            # 模拟生成过程
            # 实际应该调用智能体的生成方法
            generated_content = await self._simulate_generation(prompt)
            
            return {
                "success": True,
                "section_type": section_type,
                "content": generated_content,
                "rag_context": rag_results.get("results", []),
                "generated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"段落生成失败: {e}")
            return {
                "success": False,
                "section_type": section_type,
                "error": str(e),
                "generated_at": datetime.now().isoformat()
            }
    
    def _build_generation_prompt(self, section_type: str, requirements: str,
                               rag_results: Dict[str, Any], context: Optional[Dict[str, Any]]) -> str:
        """构建生成提示"""
        prompt_parts = [
            f"生成投标文件的 {section_type} 部分",
            f"招标要求: {requirements}",
            ""
        ]
        
        # 添加RAG知识
        if rag_results.get("success") and rag_results.get("results"):
            prompt_parts.append("相关知识点:")
            for i, result in enumerate(rag_results["results"][:3], 1):
                prompt_parts.append(f"{i}. {result.get('content', '')}")
            prompt_parts.append("")
        
        # 添加上下文信息
        if context and self.context_integration_enabled:
            prompt_parts.append("上下文信息:")
            for key, value in context.items():
                if key != "requirements":  # 避免重复
                    prompt_parts.append(f"- {key}: {value}")
            prompt_parts.append("")
        
        prompt_parts.append("请生成专业、完整的内容:")
        
        return "\n".join(prompt_parts)
    
    async def _simulate_generation(self, prompt: str) -> str:
        """模拟内容生成（实际应该使用真实的LLM调用）"""
        await asyncio.sleep(0.5)  # 模拟生成时间
        
        # 基于提示生成模拟内容
        if "技术方案" in prompt:
            return """## 技术方案

### 1. 项目概述
本项目旨在通过先进的技术架构实现高效的系统集成。我们将采用微服务架构，确保系统的可扩展性和可维护性。

### 2. 技术架构
- **前端**: 采用React框架，支持响应式设计
- **后端**: 使用Spring Boot框架，提供RESTful API
- **数据库**: PostgreSQL数据库，支持高并发访问
- **部署**: Docker容器化部署，支持快速扩展

### 3. 技术优势
- 高性能：支持百万级并发访问
- 高可用：多节点部署，自动故障转移
- 易维护：模块化设计，便于升级维护"""
        
        elif "商务响应" in prompt:
            return """## 商务响应

### 1. 公司资质
我公司具备丰富的行业经验，拥有相关资质认证，能够确保项目顺利实施。

### 2. 项目团队
我们将组建专业的项目团队，包括项目经理、技术专家、测试工程师等。

### 3. 服务承诺
- 提供7×24小时技术支持
- 定期系统维护和升级
- 完善的培训服务"""
        
        else:
            return f"""## {prompt.split(' ')[1] if ' ' in prompt else '内容'}

基于招标要求，我们提供以下专业方案：

### 核心优势
1. 技术先进：采用业界领先的技术方案
2. 经验丰富：拥有多个成功案例
3. 服务完善：提供全方位的技术支持

### 实施方案
我们将按照项目管理最佳实践，确保项目按时高质量完成。"""

    async def generate_with_user_confirmation(self, section_type: str, requirements: str,
                                           context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """带用户确认的生成流程"""
        try:
            # 生成初始内容
            generation_result = await self.generate_section(section_type, requirements, context)
            
            if not generation_result["success"]:
                return generation_result
            
            # 等待用户确认（带超时）
            confirmation_result = await self._wait_for_user_confirmation(
                generation_result["content"]
            )
            
            if confirmation_result["confirmed"]:
                generation_result["user_feedback"] = confirmation_result.get("feedback")
                generation_result["confirmed"] = True
            else:
                generation_result["confirmed"] = False
                generation_result["confirmation_timeout"] = confirmation_result.get("timeout", False)
            
            return generation_result
            
        except Exception as e:
            logger.error(f"带确认的生成流程失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "confirmed": False
            }
    
    async def _wait_for_user_confirmation(self, content: str) -> Dict[str, Any]:
        """等待用户确认（模拟实现）"""
        try:
            # 模拟用户确认过程
            # 实际应该集成到UI中等待用户输入
            logger.info("等待用户确认生成内容...")
            
            # 模拟5秒后自动确认（实际应该等待真实用户输入）
            await asyncio.sleep(5)
            
            return {
                "confirmed": True,
                "feedback": "内容质量良好，可以继续",
                "timeout": False
            }
            
        except asyncio.TimeoutError:
            logger.warning("用户确认超时")
            return {
                "confirmed": False,
                "timeout": True,
                "feedback": "确认超时，系统自动继续"
            }
    
    def integrate_user_preferences(self, content: str, preferences: Dict[str, Any]) -> str:
        """集成用户偏好到生成内容中"""
        if not preferences:
            return content
        
        # 简单的偏好集成逻辑
        # 实际应该根据具体偏好进行调整
        integrated_content = content
        
        if "preferred_style" in preferences:
            style = preferences["preferred_style"]
            if style == "formal":
                integrated_content = integrated_content.replace("我们", "本公司")
            elif style == "casual":
                integrated_content = integrated_content.replace("本公司", "我们")
        
        if "technical_depth" in preferences:
            depth = preferences["technical_depth"]
            if depth == "high":
                # 添加更多技术细节
                integrated_content += "\n\n### 技术细节\n- 详细的技术实现方案\n- 性能优化策略"
            elif depth == "low":
                # 简化技术描述
                integrated_content = integrated_content.replace("技术架构", "系统架构")
        
        return integrated_content
    
    async def batch_generate_sections(self, sections: List[Dict[str, str]],
                                    context: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """批量生成多个段落"""
        tasks = []
        for section in sections:
            task = self.generate_section(
                section["type"],
                section["requirements"],
                context
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "success": False,
                    "section_type": sections[i]["type"],
                    "error": str(result)
                })
            else:
                processed_results.append(result)
        
        return processed_results


class ContextPreservation:
    """上下文保持系统"""
    
    def __init__(self):
        self.context_stack: List[Dict[str, Any]] = []
        self.max_context_depth = 10
        
    def push_context(self, context: Dict[str, Any]):
        """压入上下文"""
        if len(self.context_stack) >= self.max_context_depth:
            self.context_stack.pop(0)  # 移除最旧的上下文
        self.context_stack.append(context.copy())
    
    def pop_context(self) -> Optional[Dict[str, Any]]:
        """弹出上下文"""
        if self.context_stack:
            return self.context_stack.pop()
        return None
    
    def get_current_context(self) -> Dict[str, Any]:
        """获取当前上下文"""
        if self.context_stack:
            return self.context_stack[-1].copy()
        return {}
    
    def merge_contexts(self, new_context: Dict[str, Any]) -> Dict[str, Any]:
        """合并新旧上下文"""
        current = self.get_current_context()
        merged = current.copy()
        merged.update(new_context)
        return merged
    
    def preserve_across_segments(self, segment_content: str, 
                               context_key: str = "previous_segments") -> Dict[str, Any]:
        """在段落间保持上下文"""
        current_context = self.get_current_context()
        
        # 记录当前段落信息
        segment_info = {
            "content": segment_content,
            "timestamp": datetime.now().isoformat(),
            "length": len(segment_content)
        }
        
        # 更新上下文
        if context_key not in current_context:
            current_context[context_key] = []
        
        current_context[context_key].append(segment_info)
        
        # 限制历史段落数量
        if len(current_context[context_key]) > 5:
            current_context[context_key] = current_context[context_key][-5:]
        
        return current_context


def create_default_generator(llm_config: Dict[str, Any], rag_tools: Any) -> ProposalGenerator:
    """创建默认生成器实例"""
    return ProposalGenerator(llm_config, rag_tools)