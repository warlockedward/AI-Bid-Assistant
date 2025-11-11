"""
LLM配置文件
统一管理LLM相关配置
"""
import os
from typing import Dict, Any


# 默认LLM配置
DEFAULT_LLM_CONFIG: Dict[str, Any] = {
    # API配置
    "api_key": os.getenv("OPENAI_API_KEY", ""),
    "api_base": os.getenv("OPENAI_API_BASE", ""),
    
    # 模型配置
    "llm_model": os.getenv("LLM_MODEL", "Qwen3-QwQ-32B"),
    "vlm_model": os.getenv("VLM_MODEL", "Qwen2.5-VL-32B-Instruct"),
    "embedding_model": os.getenv("EMBEDDING_MODEL", "bge-m3"),
    "rerank_model": os.getenv("RERANK_MODEL", "bge-reranker-v2-minicpm-layerwise"),
    
    # 默认参数
    "default_temperature": 0.7,
    "default_max_tokens": 2000,
    "default_top_p": 0.9,
    
    # 超时配置
    "timeout": 60.0,
    "connect_timeout": 10.0,
    
    # 重试配置
    "max_retries": 3,
    "retry_delay": 1.0,
    
    # 缓存配置
    "cache_enabled": True,
    "cache_ttl": 3600,  # 1小时
    
    # 并发配置
    "max_concurrent_requests": 10,
    
    # 日志配置
    "log_requests": True,
    "log_responses": False,  # 响应可能很长，默认不记录
}


# 租户特定配置（示例）
TENANT_CONFIGS: Dict[str, Dict[str, Any]] = {
    "demo": {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "api_base": os.getenv("OPENAI_API_BASE"),
        "llm_model": "Qwen3-QwQ-32B",
        "default_temperature": 0.7,
        "default_max_tokens": 2000,
    },
    "production": {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "api_base": os.getenv("OPENAI_API_BASE"),
        "llm_model": "Qwen3-QwQ-32B",
        "default_temperature": 0.6,  # 更保守的温度
        "default_max_tokens": 3000,
    }
}


def get_llm_config(tenant_id: str = None) -> Dict[str, Any]:
    """
    获取LLM配置
    
    Args:
        tenant_id: 租户ID，如果提供则返回租户特定配置
        
    Returns:
        LLM配置字典
    """
    if tenant_id and tenant_id in TENANT_CONFIGS:
        # 合并默认配置和租户配置
        config = DEFAULT_LLM_CONFIG.copy()
        config.update(TENANT_CONFIGS[tenant_id])
        return config
    
    return DEFAULT_LLM_CONFIG.copy()


def update_tenant_config(tenant_id: str, config: Dict[str, Any]):
    """
    更新租户配置
    
    Args:
        tenant_id: 租户ID
        config: 配置字典
    """
    if tenant_id not in TENANT_CONFIGS:
        TENANT_CONFIGS[tenant_id] = {}
    
    TENANT_CONFIGS[tenant_id].update(config)


# 模型能力配置
MODEL_CAPABILITIES = {
    "Qwen3-QwQ-32B": {
        "type": "llm",
        "max_tokens": 32768,
        "supports_function_calling": True,
        "supports_vision": False,
        "context_window": 32768,
    },
    "Qwen2.5-VL-32B-Instruct": {
        "type": "vlm",
        "max_tokens": 32768,
        "supports_function_calling": False,
        "supports_vision": True,
        "context_window": 32768,
    },
    "bge-m3": {
        "type": "embedding",
        "dimensions": 1024,
        "max_input_length": 8192,
    },
    "bge-reranker-v2-minicpm-layerwise": {
        "type": "rerank",
        "max_documents": 100,
        "max_query_length": 512,
    }
}


def get_model_capability(model_name: str) -> Dict[str, Any]:
    """
    获取模型能力信息
    
    Args:
        model_name: 模型名称
        
    Returns:
        模型能力字典
    """
    return MODEL_CAPABILITIES.get(model_name, {})


# 提示词配置
PROMPT_CONFIGS = {
    "max_prompt_length": 4000,  # 最大提示词长度
    "preserve_sections": ["核心需求", "技术要求", "商务条款"],  # 优先保留的章节
    "truncate_strategy": "smart",  # smart: 智能截断, simple: 简单截断
}


# 质量控制配置
QUALITY_CONFIGS = {
    "min_response_length": 50,  # 最小响应长度
    "max_response_length": 10000,  # 最大响应长度
    "quality_threshold": 0.7,  # 质量阈值
    "enable_quality_check": True,  # 启用质量检查
    "enable_content_filter": True,  # 启用内容过滤
}


# 性能配置
PERFORMANCE_CONFIGS = {
    "enable_caching": True,  # 启用缓存
    "cache_ttl": 3600,  # 缓存TTL（秒）
    "enable_batching": True,  # 启用批处理
    "batch_size": 10,  # 批处理大小
    "max_concurrent": 5,  # 最大并发数
}
