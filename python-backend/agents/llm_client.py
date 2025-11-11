"""
统一LLM客户端
支持LLM、VLM、Embedding和Rerank的OpenAI兼容接口
"""
import os
from typing import Dict, Any, List, Optional, Union
import logging
from openai import AsyncOpenAI
import base64
from pathlib import Path

logger = logging.getLogger(__name__)


class LLMClient:
    """统一的LLM客户端"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        llm_model: str = "Qwen3-QwQ-32B",
        vlm_model: str = "Qwen2.5-VL-32B-Instruct",
        embedding_model: str = "bge-m3",
        rerank_model: str = "bge-reranker-v2-minicpm-layerwise"
    ):
        """
        初始化LLM客户端
        
        Args:
            api_key: API密钥，默认从环境变量OPENAI_API_KEY读取
            api_base: API基础URL，默认从环境变量OPENAI_API_BASE读取
            llm_model: LLM模型名称
            vlm_model: VLM模型名称
            embedding_model: Embedding模型名称
            rerank_model: Rerank模型名称
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.api_base = api_base or os.getenv("OPENAI_API_BASE")
        
        if not self.api_key:
            raise ValueError("API key is required. Set OPENAI_API_KEY environment variable.")
        
        if not self.api_base:
            raise ValueError("API base URL is required. Set OPENAI_API_BASE environment variable.")
        
        # 创建异步客户端
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.api_base
        )
        
        # 模型配置
        self.llm_model = llm_model
        self.vlm_model = vlm_model
        self.embedding_model = embedding_model
        self.rerank_model = rerank_model
        
        logger.info(f"LLM Client initialized with base URL: {self.api_base}")
        logger.info(f"Models - LLM: {llm_model}, VLM: {vlm_model}, Embedding: {embedding_model}, Rerank: {rerank_model}")
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        model: Optional[str] = None,
        stream: bool = False,
        **kwargs
    ) -> Union[str, Any]:
        """
        聊天补全
        
        Args:
            messages: 消息列表，格式: [{"role": "user", "content": "..."}]
            temperature: 温度参数
            max_tokens: 最大token数
            model: 模型名称，默认使用llm_model
            stream: 是否流式输出
            **kwargs: 其他参数
            
        Returns:
            生成的文本内容
        """
        try:
            model_name = model or self.llm_model
            
            logger.debug(f"Chat completion request - Model: {model_name}, Messages: {len(messages)}")
            
            response = await self.client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=stream,
                **kwargs
            )
            
            if stream:
                return response
            
            content = response.choices[0].message.content
            logger.debug(f"Chat completion response - Length: {len(content)}")
            
            return content
            
        except Exception as e:
            logger.error(f"Chat completion failed: {str(e)}")
            raise
    
    async def vision_completion(
        self,
        text: str,
        image_path: Optional[str] = None,
        image_url: Optional[str] = None,
        image_base64: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs
    ) -> str:
        """
        视觉语言模型补全
        
        Args:
            text: 文本提示
            image_path: 图片文件路径
            image_url: 图片URL
            image_base64: 图片base64编码
            temperature: 温度参数
            max_tokens: 最大token数
            **kwargs: 其他参数
            
        Returns:
            生成的文本内容
        """
        try:
            # 准备图片内容
            if image_path:
                with open(image_path, "rb") as f:
                    image_data = base64.b64encode(f.read()).decode()
                image_content = f"data:image/jpeg;base64,{image_data}"
            elif image_base64:
                image_content = f"data:image/jpeg;base64,{image_base64}"
            elif image_url:
                image_content = image_url
            else:
                raise ValueError("Must provide image_path, image_url, or image_base64")
            
            # 构建消息
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text},
                        {"type": "image_url", "image_url": {"url": image_content}}
                    ]
                }
            ]
            
            logger.debug(f"Vision completion request - Model: {self.vlm_model}")
            
            response = await self.client.chat.completions.create(
                model=self.vlm_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            content = response.choices[0].message.content
            logger.debug(f"Vision completion response - Length: {len(content)}")
            
            return content
            
        except Exception as e:
            logger.error(f"Vision completion failed: {str(e)}")
            raise
    
    async def create_embedding(
        self,
        text: Union[str, List[str]],
        model: Optional[str] = None
    ) -> Union[List[float], List[List[float]]]:
        """
        创建文本嵌入
        
        Args:
            text: 文本或文本列表
            model: 模型名称，默认使用embedding_model
            
        Returns:
            嵌入向量或嵌入向量列表
        """
        try:
            model_name = model or self.embedding_model
            
            # 确保输入是列表
            is_single = isinstance(text, str)
            texts = [text] if is_single else text
            
            logger.debug(f"Embedding request - Model: {model_name}, Texts: {len(texts)}")
            
            response = await self.client.embeddings.create(
                model=model_name,
                input=texts
            )
            
            embeddings = [item.embedding for item in response.data]
            
            logger.debug(f"Embedding response - Vectors: {len(embeddings)}, Dimensions: {len(embeddings[0])}")
            
            return embeddings[0] if is_single else embeddings
            
        except Exception as e:
            logger.error(f"Embedding creation failed: {str(e)}")
            raise
    
    async def rerank(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None,
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        文档重排序
        
        Args:
            query: 查询文本
            documents: 文档列表
            top_k: 返回前k个结果
            model: 模型名称，默认使用rerank_model
            
        Returns:
            重排序后的文档列表，包含index、score和document
        """
        try:
            model_name = model or self.rerank_model
            
            logger.debug(f"Rerank request - Model: {model_name}, Documents: {len(documents)}")
            
            # 注意：这里使用自定义的rerank接口
            # 如果API不支持，需要使用embedding计算相似度
            try:
                # 尝试使用rerank API
                response = await self.client.post(
                    "/rerank",
                    json={
                        "model": model_name,
                        "query": query,
                        "documents": documents,
                        "top_k": top_k or len(documents)
                    }
                )
                results = response.json()["results"]
            except Exception:
                # 降级到embedding相似度计算
                logger.warning("Rerank API not available, using embedding similarity")
                results = await self._rerank_with_embeddings(query, documents, top_k)
            
            logger.debug(f"Rerank response - Results: {len(results)}")
            
            return results
            
        except Exception as e:
            logger.error(f"Rerank failed: {str(e)}")
            raise
    
    async def _rerank_with_embeddings(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """使用embedding计算相似度进行重排序"""
        import numpy as np
        
        # 获取query和documents的embeddings
        query_embedding = await self.create_embedding(query)
        doc_embeddings = await self.create_embedding(documents)
        
        # 计算余弦相似度
        query_vec = np.array(query_embedding)
        doc_vecs = np.array(doc_embeddings)
        
        # 归一化
        query_norm = query_vec / np.linalg.norm(query_vec)
        doc_norms = doc_vecs / np.linalg.norm(doc_vecs, axis=1, keepdims=True)
        
        # 计算相似度
        similarities = np.dot(doc_norms, query_norm)
        
        # 排序
        sorted_indices = np.argsort(similarities)[::-1]
        
        # 构建结果
        results = []
        k = top_k or len(documents)
        for idx in sorted_indices[:k]:
            results.append({
                "index": int(idx),
                "score": float(similarities[idx]),
                "document": documents[idx]
            })
        
        return results
    
    async def stream_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        model: Optional[str] = None,
        **kwargs
    ):
        """
        流式聊天补全
        
        Args:
            messages: 消息列表
            temperature: 温度参数
            max_tokens: 最大token数
            model: 模型名称
            **kwargs: 其他参数
            
        Yields:
            生成的文本片段
        """
        try:
            model_name = model or self.llm_model
            
            logger.debug(f"Stream chat completion request - Model: {model_name}")
            
            stream = await self.client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                **kwargs
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Stream chat completion failed: {str(e)}")
            raise


# 全局客户端实例
_global_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    """获取全局LLM客户端实例"""
    global _global_client
    
    if _global_client is None:
        _global_client = LLMClient()
    
    return _global_client


def set_llm_client(client: LLMClient):
    """设置全局LLM客户端实例"""
    global _global_client
    _global_client = client
