"""
性能优化
实现缓存、并行处理和资源优化
"""
from typing import Dict, Any, Optional, Callable, TypeVar
import asyncio
import hashlib
import json
from datetime import datetime, timedelta
from functools import wraps
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CacheManager:
    """缓存管理器"""
    
    def __init__(self, default_ttl: int = 3600):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl  # 默认过期时间（秒）
    
    def _generate_cache_key(self, *args, **kwargs) -> str:
        """生成缓存键"""
        key_data = {
            "args": args,
            "kwargs": kwargs
        }
        key_str = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        if key in self.cache:
            entry = self.cache[key]
            
            # 检查是否过期
            if datetime.now() < entry["expires_at"]:
                logger.debug(f"Cache hit: {key}")
                return entry["value"]
            else:
                # 过期，删除
                del self.cache[key]
                logger.debug(f"Cache expired: {key}")
        
        logger.debug(f"Cache miss: {key}")
        return None
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ):
        """设置缓存"""
        ttl = ttl or self.default_ttl
        expires_at = datetime.now() + timedelta(seconds=ttl)
        
        self.cache[key] = {
            "value": value,
            "expires_at": expires_at,
            "created_at": datetime.now()
        }
        
        logger.debug(f"Cache set: {key} (TTL: {ttl}s)")
    
    def delete(self, key: str):
        """删除缓存"""
        if key in self.cache:
            del self.cache[key]
            logger.debug(f"Cache deleted: {key}")
    
    def clear(self):
        """清空缓存"""
        self.cache.clear()
        logger.info("Cache cleared")
    
    def cleanup_expired(self):
        """清理过期缓存"""
        now = datetime.now()
        expired_keys = [
            key for key, entry in self.cache.items()
            if now >= entry["expires_at"]
        ]
        
        for key in expired_keys:
            del self.cache[key]
        
        if expired_keys:
            logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        total_entries = len(self.cache)
        total_size = sum(
            len(json.dumps(entry["value"], ensure_ascii=False))
            for entry in self.cache.values()
        )
        
        return {
            "total_entries": total_entries,
            "total_size_bytes": total_size,
            "total_size_mb": total_size / (1024 * 1024)
        }


def with_cache(
    cache_manager: CacheManager,
    ttl: Optional[int] = None,
    key_prefix: str = ""
):
    """缓存装饰器"""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            # 生成缓存键
            cache_key = key_prefix + cache_manager._generate_cache_key(*args, **kwargs)
            
            # 尝试从缓存获取
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 存入缓存
            cache_manager.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


class ParallelExecutor:
    """并行执行器"""
    
    @staticmethod
    async def execute_parallel(
        tasks: list,
        max_concurrent: int = 5
    ) -> list:
        """并行执行任务（限制并发数）"""
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def execute_with_semaphore(task):
            async with semaphore:
                return await task
        
        results = await asyncio.gather(
            *[execute_with_semaphore(task) for task in tasks],
            return_exceptions=True
        )
        
        return results
    
    @staticmethod
    async def execute_batch(
        items: list,
        process_func: Callable,
        batch_size: int = 10,
        max_concurrent: int = 3
    ) -> list:
        """批量执行（分批+并行）"""
        results = []
        
        # 分批
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            
            # 并行处理批次
            batch_tasks = [process_func(item) for item in batch]
            batch_results = await ParallelExecutor.execute_parallel(
                batch_tasks,
                max_concurrent
            )
            
            results.extend(batch_results)
        
        return results


class ResourceOptimizer:
    """资源优化器"""
    
    @staticmethod
    def optimize_prompt_length(
        prompt: str,
        max_length: int = 4000,
        preserve_sections: Optional[list] = None
    ) -> str:
        """优化提示词长度"""
        if len(prompt) <= max_length:
            return prompt
        
        logger.warning(
            f"Prompt too long ({len(prompt)} chars), "
            f"truncating to {max_length} chars"
        )
        
        # 如果指定了保留章节，尝试保留这些部分
        if preserve_sections:
            preserved_text = ""
            for section in preserve_sections:
                if section in prompt:
                    # 提取章节内容
                    start = prompt.find(section)
                    end = prompt.find("\n\n", start)
                    if end == -1:
                        end = len(prompt)
                    preserved_text += prompt[start:end] + "\n\n"
            
            if len(preserved_text) <= max_length:
                return preserved_text
        
        # 简单截断
        return prompt[:max_length] + "\n\n[内容已截断]"
    
    @staticmethod
    def batch_llm_calls(
        prompts: list,
        batch_size: int = 5
    ) -> list:
        """批量LLM调用（分组）"""
        batches = []
        for i in range(0, len(prompts), batch_size):
            batch = prompts[i:i + batch_size]
            batches.append(batch)
        return batches
    
    @staticmethod
    def estimate_token_count(text: str) -> int:
        """估算token数量（简单估算）"""
        # 中文：1字符 ≈ 1.5 tokens
        # 英文：1单词 ≈ 1.3 tokens
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars
        
        estimated_tokens = int(chinese_chars * 1.5 + other_chars * 0.3)
        return estimated_tokens
    
    @staticmethod
    def optimize_for_cost(
        prompt: str,
        max_tokens: int = 2000,
        target_cost_reduction: float = 0.3
    ) -> Dict[str, Any]:
        """优化成本"""
        original_tokens = ResourceOptimizer.estimate_token_count(prompt)
        
        if original_tokens <= max_tokens:
            return {
                "optimized_prompt": prompt,
                "original_tokens": original_tokens,
                "optimized_tokens": original_tokens,
                "cost_reduction": 0.0
            }
        
        # 计算目标长度
        target_length = int(len(prompt) * (1 - target_cost_reduction))
        
        # 优化提示词
        optimized_prompt = ResourceOptimizer.optimize_prompt_length(
            prompt,
            target_length
        )
        
        optimized_tokens = ResourceOptimizer.estimate_token_count(optimized_prompt)
        actual_reduction = (original_tokens - optimized_tokens) / original_tokens
        
        return {
            "optimized_prompt": optimized_prompt,
            "original_tokens": original_tokens,
            "optimized_tokens": optimized_tokens,
            "cost_reduction": actual_reduction
        }


class MemoryOptimizer:
    """内存优化器"""
    
    @staticmethod
    def compress_large_dict(
        data: Dict[str, Any],
        max_value_length: int = 1000
    ) -> Dict[str, Any]:
        """压缩大字典"""
        compressed = {}
        
        for key, value in data.items():
            if isinstance(value, str) and len(value) > max_value_length:
                # 截断长字符串
                compressed[key] = value[:max_value_length] + "...[truncated]"
            elif isinstance(value, dict):
                # 递归压缩
                compressed[key] = MemoryOptimizer.compress_large_dict(
                    value,
                    max_value_length
                )
            elif isinstance(value, list) and len(value) > 100:
                # 截断长列表
                compressed[key] = value[:100] + ["...[truncated]"]
            else:
                compressed[key] = value
        
        return compressed
    
    @staticmethod
    def cleanup_old_data(
        data_dict: Dict[str, Any],
        max_age: timedelta,
        timestamp_key: str = "timestamp"
    ) -> Dict[str, Any]:
        """清理旧数据"""
        cutoff_time = datetime.now() - max_age
        cleaned = {}
        
        for key, value in data_dict.items():
            if isinstance(value, dict) and timestamp_key in value:
                timestamp = datetime.fromisoformat(value[timestamp_key])
                if timestamp > cutoff_time:
                    cleaned[key] = value
            else:
                cleaned[key] = value
        
        removed_count = len(data_dict) - len(cleaned)
        if removed_count > 0:
            logger.info(f"Cleaned up {removed_count} old entries")
        
        return cleaned


# 全局实例
cache_manager = CacheManager(default_ttl=3600)
parallel_executor = ParallelExecutor()
resource_optimizer = ResourceOptimizer()
memory_optimizer = MemoryOptimizer()
