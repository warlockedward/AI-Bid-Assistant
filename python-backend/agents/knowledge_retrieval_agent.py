"""
知识检索代理 - 基于AutoGen原生框架
"""

from typing import Dict, Any, Optional

import httpx

from autogen_agentchat.agents import AssistantAgent

from .base_agent import BaseAgent
from .prompt_templates import KnowledgeRetrievalPrompt


class KnowledgeRetrievalAgent(BaseAgent):
    """知识检索代理 - 基于AutoGen原生框架"""
    
    def __init__(self, tenant_id: str, config: Dict[str, Any]):
        super().__init__(tenant_id, config)
        self.config = config
        self.fastgpt_url = config.get("fastgpt_url", "http://localhost:3001")

    def _create_autogen_agent(self) -> AssistantAgent:
        """创建AutoGen代理实例"""
        # 使用标准化的高质量提示词
        system_message = KnowledgeRetrievalPrompt.get_system_message()
        
        return AssistantAgent(
            name=f"knowledge_retriever_{self.tenant_id}",
            model_client=self.model_client,
            system_message=system_message
        )

    async def _execute_impl(
        self, 
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """执行知识检索任务"""
        operation = input_data.get("operation", "search_knowledge_base")
        query = input_data.get("query", "")
        filters = input_data.get("filters", {})
        industry = input_data.get("industry", "")
        standard_type = input_data.get("standard_type", "all")
        domain = input_data.get("domain", "")
        practice_type = input_data.get("practice_type", "implementation")
        requirements = input_data.get("requirements", {})
        context = input_data.get("context", {})

        try:
            if operation == "search_knowledge_base":
                return await self.search_knowledge_base(query, filters)
            elif operation == "retrieve_industry_standards":
                return await self.retrieve_industry_standards(industry, 
                                                              standard_type)
            elif operation == "get_best_practices":
                return await self.get_best_practices(domain, practice_type)
            elif operation == "find_similar_cases":
                return await self.find_similar_cases(requirements)
            elif operation == "provide_contextual_knowledge":
                return {"knowledge": await self.provide_contextual_knowledge(
                    context)}
            else:
                # 默认操作
                return await self.search_knowledge_base(query, filters)

        except Exception as error:
            raise RuntimeError(
                f"Knowledge retrieval failed: {str(error)}"
            ) from error

    async def search_knowledge_base(
        self, 
        query: str, 
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """搜索知识库"""
        try:
            # 集成FastGPT RAG系统
            timeout = self.config.get("fastgpt_timeout", 30.0)
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.fastgpt_url}/api/v1/search",
                    json={
                        "query": query,
                        "filters": filters or {},
                        "top_k": 10
                    },
                    timeout=timeout
                )
                
                if response.status_code == 200:
                    results = response.json()
                    return {
                        "success": True,
                        "results": results.get("data", []),
                        "count": len(results.get("data", []))
                    }
                else:
                    error_msg = f"搜索失败: HTTP {response.status_code}"
                    raise RuntimeError(error_msg)
                    
        except httpx.RequestError as e:
            error_msg = f"知识库请求错误: {str(e)}"
            raise RuntimeError(error_msg) from e
        except Exception as e:
            if isinstance(e, RuntimeError):
                raise
            error_msg = f"知识库搜索失败: {str(e)}"
            raise RuntimeError(error_msg) from e
    
    async def retrieve_industry_standards(
        self, 
        industry: str, 
        standard_type: str = "all"
    ) -> Dict[str, Any]:
        """检索行业标准"""
        query = f"{industry}行业 {standard_type}标准规范"
        return await self.search_knowledge_base(query)
    
    async def get_best_practices(
        self, 
        domain: str, 
        practice_type: str = "implementation"
    ) -> Dict[str, Any]:
        """获取最佳实践"""
        query = f"{domain}领域 {practice_type}最佳实践"
        return await self.search_knowledge_base(query)
    
    async def find_similar_cases(
        self, 
        requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """查找类似案例"""
        # 根据需求构建搜索查询
        query_parts = []
        if requirements.get("technical"):
            query_parts.append("技术方案")
        if requirements.get("commercial"):
            query_parts.append("商务方案")
        
        query = " ".join(query_parts) + " 成功案例"
        return await self.search_knowledge_base(query)
    
    async def format_knowledge_results(
        self, 
        results: Dict[str, Any]
    ) -> str:
        """格式化知识检索结果 - 使用LLM生成智能摘要"""
        if not results.get("success") or not results.get("results"):
            return "未找到相关信息"
        
        try:
            import json
            
            # 使用LLM生成知识摘要
            summary_prompt = f"""
请对以下知识检索结果进行整合和摘要：

【检索结果】
{json.dumps(results["results"][:5], ensure_ascii=False, indent=2)}

【任务要求】
1. 提取关键信息和核心观点
2. 去除重复内容
3. 按主题组织信息
4. 生成连贯的知识摘要（300-500字）
5. 突出与投标相关的要点

请使用Markdown格式输出。
"""
            
            summary = await self._chat_with_agent(summary_prompt)
            return summary
            
        except Exception as e:
            # 降级到简单格式化
            formatted = "## 知识检索结果\n\n"
            for i, item in enumerate(results["results"][:5], 1):
                formatted += f"{i}. **{item.get('title', '无标题')}**\n"
                formatted += f"   内容: {item.get('content', '')[:200]}...\n"
                formatted += f"   相关性: {item.get('score', 0):.2f}\n\n"
            
            return formatted

    async def provide_contextual_knowledge(
        self, 
        context: Dict[str, Any]
    ) -> str:
        """提供上下文相关知识 - 使用LLM智能分析上下文"""
        requirements = context.get("requirements", {})
        analysis = context.get("analysis", {})
        
        try:
            import json
            
            # 使用LLM分析上下文并生成检索策略
            strategy_prompt = f"""
基于以下项目上下文，确定需要检索的知识类型：

【需求信息】
{json.dumps(requirements, ensure_ascii=False, indent=2)}

【分析结果】
{json.dumps(analysis, ensure_ascii=False, indent=2)}

【任务】
分析上下文，列出3-5个最重要的知识检索查询，每个查询应该：
1. 针对具体的需求或风险
2. 有助于投标方案的制定
3. 提供可操作的信息

请以JSON数组格式返回：
["查询1", "查询2", "查询3"]
"""
            
            response = await self._chat_with_agent(strategy_prompt)
            
            # 解析查询列表
            import re
            json_match = re.search(r'\[.*?\]', response, re.DOTALL)
            if json_match:
                knowledge_queries = json.loads(json_match.group())
            else:
                # 降级到规则基础的查询
                knowledge_queries = []
                if requirements.get("technical"):
                    knowledge_queries.append("技术实施方案参考")
                if analysis.get("risks"):
                    knowledge_queries.append("风险应对策略")
            
            # 执行检索并汇总结果
            all_results = []
            for query in knowledge_queries[:3]:  # 限制最多3个查询
                results = await self.search_knowledge_base(query)
                if results.get("success"):
                    all_results.extend(results["results"])
            
            # 使用LLM格式化结果
            return await self.format_knowledge_results({
                "success": True,
                "results": all_results
            })
            
        except Exception as e:
            # 降级方案
            knowledge_queries = []
            if requirements.get("technical"):
                knowledge_queries.append("技术实施方案参考")
            if analysis.get("risks"):
                knowledge_queries.append("风险应对策略")
            
            all_results = []
            for query in knowledge_queries:
                results = await self.search_knowledge_base(query)
                if results.get("success"):
                    all_results.extend(results["results"])
            
            return await self.format_knowledge_results({
                "success": True,
                "results": all_results
            })
