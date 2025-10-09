"""
RAG集成工具模块
实现与FastGPT RAG系统的集成
"""
import logging
import asyncio
from typing import Dict, List, Optional, Any
from autogen.agentchat import FunctionTool

logger = logging.getLogger(__name__)


class RagTools:
    """RAG工具类"""
    
    def __init__(self, rag_api_url: str, api_key: Optional[str] = None):
        self.rag_api_url = rag_api_url.rstrip('/')
        self.api_key = api_key
        self.timeout = 30
        self.max_retries = 3
        
    async def query_rag_system(self, query: str, context: Optional[Dict[str, Any]] = None, 
                              top_k: int = 5) -> Dict[str, Any]:
        """查询RAG系统"""
        for attempt in range(self.max_retries):
            try:
                # 模拟RAG API调用
                # 实际应该调用真实的RAG服务
                await asyncio.sleep(0.1)  # 模拟网络延迟
                
                # 构建请求数据
                request_data = {
                    "query": query,
                    "top_k": top_k,
                    "context": context or {}
                }
                
                # 这里应该使用实际的HTTP客户端调用RAG API
                # response = await self._make_rag_request(request_data)
                
                # 模拟响应
                response = {
                    "success": True,
                    "results": [
                        {
                            "content": f"基于查询 '{query}' 的相关知识片段 {i+1}",
                            "score": 0.9 - (i * 0.1),
                            "source": f"知识库文档_{i+1}.pdf",
                            "metadata": {"page": i+1, "section": "技术规范"}
                        }
                        for i in range(top_k)
                    ],
                    "query_time": 0.15
                }
                
                logger.info(f"RAG查询成功: {query}")
                return response
                
            except Exception as e:
                logger.warning(f"RAG查询尝试 {attempt + 1} 失败: {e}")
                if attempt == self.max_retries - 1:
                    logger.error(f"RAG查询最终失败: {e}")
                    return {
                        "success": False,
                        "error": str(e),
                        "results": []
                    }
                await asyncio.sleep(2 ** attempt)  # 指数退避
    
    async def _make_rag_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """实际调用RAG API"""
        # 这里应该使用httpx或aiohttp进行异步HTTP调用
        # 示例实现：
        # async with httpx.AsyncClient() as client:
        #     headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        #     response = await client.post(
        #         f"{self.rag_api_url}/query",
        #         json=data,
        #         headers=headers,
        #         timeout=self.timeout
        #     )
        #     response.raise_for_status()
        #     return response.json()
        
        # 暂时返回模拟数据
        return {
            "success": True,
            "results": [],
            "query_time": 0.1
        }
    
    def validate_rag_response(self, response: Dict[str, Any]) -> bool:
        """验证RAG响应"""
        if not response.get("success"):
            logger.error("RAG响应失败")
            return False
        
        results = response.get("results", [])
        if not isinstance(results, list):
            logger.error("RAG响应格式错误: results不是列表")
            return False
        
        # 检查每个结果的格式
        for i, result in enumerate(results):
            if not isinstance(result, dict):
                logger.error(f"RAG结果 {i} 格式错误: 不是字典")
                return False
            
            if "content" not in result:
                logger.error(f"RAG结果 {i} 缺少content字段")
                return False
        
        return True
    
    def create_rag_function_tool(self) -> FunctionTool:
        """创建RAG函数工具"""
        
        async def rag_query_function(query: str, top_k: int = 5) -> str:
            """查询RAG系统获取相关知识"""
            try:
                response = await self.query_rag_system(query, top_k=top_k)
                
                if not response.get("success"):
                    return f"RAG查询失败: {response.get('error', '未知错误')}"
                
                results = response.get("results", [])
                if not results:
                    return "未找到相关知识点"
                
                # 格式化结果
                formatted_results = []
                for i, result in enumerate(results, 1):
                    content = result.get("content", "")
                    score = result.get("score", 0)
                    source = result.get("source", "未知来源")
                    
                    formatted_results.append(
                        f"{i}. [相关性: {score:.2f}] {content}\n   来源: {source}"
                    )
                
                return f"找到 {len(results)} 个相关知识点:\n" + "\n".join(formatted_results)
                
            except Exception as e:
                logger.error(f"RAG查询函数执行失败: {e}")
                return f"RAG查询异常: {str(e)}"
        
        return FunctionTool(
            func=rag_query_function,
            name="query_rag_system",
            description="查询RAG知识库获取投标相关的行业知识、标准规范和技术要求"
        )
    
    async def batch_query(self, queries: List[str], top_k: int = 3) -> Dict[str, Any]:
        """批量查询RAG系统"""
        tasks = [self.query_rag_system(query, top_k=top_k) for query in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        batch_result = {}
        for i, (query, result) in enumerate(zip(queries, results)):
            if isinstance(result, Exception):
                batch_result[query] = {
                    "success": False,
                    "error": str(result)
                }
            else:
                batch_result[query] = result
        
        return batch_result


class RagErrorHandler:
    """RAG错误处理器"""
    
    def __init__(self):
        self.error_counts: Dict[str, int] = {}
        self.circuit_breaker_threshold = 5
        
    def should_circuit_break(self, error_type: str) -> bool:
        """检查是否应该触发断路器"""
        count = self.error_counts.get(error_type, 0)
        return count >= self.circuit_breaker_threshold
    
    def record_error(self, error_type: str):
        """记录错误"""
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        logger.warning(f"记录错误类型: {error_type}, 计数: {self.error_counts[error_type]}")
    
    def reset_error_count(self, error_type: str):
        """重置错误计数"""
        if error_type in self.error_counts:
            del self.error_counts[error_type]
            logger.info(f"重置错误类型计数: {error_type}")
    
    def get_error_stats(self) -> Dict[str, int]:
        """获取错误统计"""
        return self.error_counts.copy()


def create_default_rag_tools() -> RagTools:
    """创建默认RAG工具实例"""
    return RagTools(
        rag_api_url="http://localhost:8001/api/rag",
        api_key="rag-api-key-placeholder"
    )