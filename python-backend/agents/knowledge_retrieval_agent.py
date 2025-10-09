from autogen.agentchat import AssistantAgent
from typing import Dict, Any, List, Optional
import httpx
from datetime import datetime

class KnowledgeRetrievalAgent(AssistantAgent):
    """知识检索代理 - 基于AutoGen原生框架"""
    
    def __init__(self, tenant_id: str, config: Dict[str, Any]):
        system_message = """你是一个专业的知识检索专家。你的主要职责是：
1. 根据招标需求从知识库中检索相关信息
2. 提供行业最佳实践、技术标准和成功案例
3. 协助其他代理获取专业知识和参考资料
4. 确保检索的信息准确、相关、及时

请确保检索的信息能够有效支持投标内容的生成。"""
        
        llm_config = {
            "config_list": config.get("llm_config", []),
            "temperature": 0.1,
            "timeout": 600,
        }
        
        super().__init__(
            name=f"knowledge_retriever_{tenant_id}",
            system_message=system_message,
            llm_config=llm_config,
            human_input_mode="NEVER"
        )
        
        self.tenant_id = tenant_id
        self.config = config
        self.fastgpt_url = config.get("fastgpt_url", "http://localhost:3001")
        
        # 注册函数调用
        self.register_function(
            function_map={
                "search_knowledge_base": self.search_knowledge_base,
                "retrieve_industry_standards": self.retrieve_industry_standards,
                "get_best_practices": self.get_best_practices,
                "find_similar_cases": self.find_similar_cases
            }
        )
    
    async def search_knowledge_base(self, query: str, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """搜索知识库"""
        try:
            # 集成FastGPT RAG系统
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.fastgpt_url}/api/v1/search",
                    json={
                        "query": query,
                        "filters": filters or {},
                        "top_k": 10
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    results = response.json()
                    return {
                        "success": True,
                        "results": results.get("data", []),
                        "count": len(results.get("data", []))
                    }
                else:
                    return {
                        "success": False,
                        "error": f"搜索失败: {response.status_code}",
                        "results": []
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "results": []
            }
    
    async def retrieve_industry_standards(self, industry: str, standard_type: str = "all") -> Dict[str, Any]:
        """检索行业标准"""
        query = f"{industry}行业 {standard_type}标准规范"
        return await self.search_knowledge_base(query)
    
    async def get_best_practices(self, domain: str, practice_type: str = "implementation") -> Dict[str, Any]:
        """获取最佳实践"""
        query = f"{domain}领域 {practice_type}最佳实践"
        return await self.search_knowledge_base(query)
    
    async def find_similar_cases(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """查找类似案例"""
        # 根据需求构建搜索查询
        query_parts = []
        if requirements.get("technical"):
            query_parts.append("技术方案")
        if requirements.get("commercial"):
            query_parts.append("商务方案")
        
        query = " ".join(query_parts) + " 成功案例"
        return await self.search_knowledge_base(query)
    
    def format_knowledge_results(self, results: Dict[str, Any]) -> str:
        """格式化知识检索结果"""
        if not results.get("success") or not results.get("results"):
            return "未找到相关信息"
        
        formatted = "## 知识检索结果\n\n"
        for i, item in enumerate(results["results"][:5], 1):
            formatted += f"{i}. **{item.get('title', '无标题')}**\n"
            formatted += f"   内容: {item.get('content', '')[:200]}...\n"
            formatted += f"   相关性: {item.get('score', 0):.2f}\n\n"
        
        return formatted
    
    async def provide_contextual_knowledge(self, context: Dict[str, Any]) -> str:
        """提供上下文相关知识"""
        requirements = context.get("requirements", {})
        analysis = context.get("analysis", {})
        
        # 根据上下文智能检索
        knowledge_queries = []
        
        # 基于技术需求检索
        if requirements.get("technical"):
            knowledge_queries.append("技术实施方案参考")
        
        # 基于风险评估检索
        if analysis.get("risks"):
            knowledge_queries.append("风险应对策略")
        
        # 执行检索并汇总结果
        all_results = []
        for query in knowledge_queries:
            results = await self.search_knowledge_base(query)
            if results.get("success"):
                all_results.extend(results["results"])
        
        return self.format_knowledge_results({
            "success": True,
            "results": all_results
        })