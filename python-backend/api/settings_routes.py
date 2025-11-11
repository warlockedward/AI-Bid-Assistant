"""
设置API路由
处理LLM配置的CRUD操作
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
import os
import json
from pathlib import Path

from python-backend.agents.llm_client import LLMClient
from python-backend.config.llm_config import (
    get_llm_config,
    update_tenant_config,
    DEFAULT_LLM_CONFIG
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


class LLMConfigModel(BaseModel):
    """LLM配置模型"""
    apiKey: str = Field(..., description="API密钥")
    apiBase: str = Field(..., description="API基础URL")
    llmModel: str = Field(default="Qwen3-QwQ-32B", description="LLM模型名称")
    vlmModel: str = Field(default="Qwen2.5-VL-32B-Instruct", description="VLM模型名称")
    embeddingModel: str = Field(default="bge-m3", description="Embedding模型名称")
    rerankModel: str = Field(default="bge-reranker-v2-minicpm-layerwise", description="Rerank模型名称")
    defaultTemperature: float = Field(default=0.7, ge=0, le=2, description="默认温度")
    defaultMaxTokens: int = Field(default=2000, ge=1, le=32000, description="默认最大token数")
    defaultTopP: float = Field(default=0.9, ge=0, le=1, description="默认Top P")
    timeout: int = Field(default=60, ge=10, le=300, description="超时时间（秒）")
    maxRetries: int = Field(default=3, ge=0, le=10, description="最大重试次数")
    cacheEnabled: bool = Field(default=True, description="是否启用缓存")
    cacheTtl: int = Field(default=3600, ge=60, le=86400, description="缓存TTL（秒）")
    maxConcurrentRequests: int = Field(default=10, ge=1, le=50, description="最大并发请求数")


class TestConnectionResponse(BaseModel):
    """测试连接响应"""
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None


# 配置文件路径
CONFIG_DIR = Path("python-backend/config")
CONFIG_FILE = CONFIG_DIR / "llm_user_config.json"


def load_user_config() -> Dict[str, Any]:
    """加载用户配置"""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_user_config(config: Dict[str, Any]):
    """保存用户配置"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def convert_to_backend_format(frontend_config: LLMConfigModel) -> Dict[str, Any]:
    """将前端配置转换为后端格式"""
    return {
        "api_key": frontend_config.apiKey,
        "api_base": frontend_config.apiBase,
        "llm_model": frontend_config.llmModel,
        "vlm_model": frontend_config.vlmModel,
        "embedding_model": frontend_config.embeddingModel,
        "rerank_model": frontend_config.rerankModel,
        "default_temperature": frontend_config.defaultTemperature,
        "default_max_tokens": frontend_config.defaultMaxTokens,
        "default_top_p": frontend_config.defaultTopP,
        "timeout": frontend_config.timeout,
        "max_retries": frontend_config.maxRetries,
        "cache_enabled": frontend_config.cacheEnabled,
        "cache_ttl": frontend_config.cacheTtl,
        "max_concurrent_requests": frontend_config.maxConcurrentRequests,
    }


def convert_to_frontend_format(backend_config: Dict[str, Any]) -> Dict[str, Any]:
    """将后端配置转换为前端格式"""
    return {
        "apiKey": backend_config.get("api_key", ""),
        "apiBase": backend_config.get("api_base", os.getenv("OPENAI_API_BASE", "")),
        "llmModel": backend_config.get("llm_model", os.getenv("LLM_MODEL", "Qwen3-QwQ-32B")),
        "vlmModel": backend_config.get("vlm_model", os.getenv("VLM_MODEL", "Qwen2.5-VL-32B-Instruct")),
        "embeddingModel": backend_config.get("embedding_model", os.getenv("EMBEDDING_MODEL", "bge-m3")),
        "rerankModel": backend_config.get("rerank_model", os.getenv("RERANK_MODEL", "bge-reranker-v2-minicpm-layerwise")),
        "defaultTemperature": backend_config.get("default_temperature", float(os.getenv("DEFAULT_TEMPERATURE", "0.7"))),
        "defaultMaxTokens": backend_config.get("default_max_tokens", int(os.getenv("DEFAULT_MAX_TOKENS", "2000"))),
        "defaultTopP": backend_config.get("default_top_p", float(os.getenv("DEFAULT_TOP_P", "0.9"))),
        "timeout": backend_config.get("timeout", int(os.getenv("TIMEOUT", "60"))),
        "maxRetries": backend_config.get("max_retries", int(os.getenv("MAX_RETRIES", "3"))),
        "cacheEnabled": backend_config.get("cache_enabled", os.getenv("CACHE_ENABLED", "true").lower() == "true"),
        "cacheTtl": backend_config.get("cache_ttl", int(os.getenv("CACHE_TTL", "3600"))),
        "maxConcurrentRequests": backend_config.get("max_concurrent_requests", int(os.getenv("MAX_CONCURRENT", "10"))),
    }


@router.get("/llm-config")
async def get_llm_configuration(tenant_id: str = "default"):
    """
    获取LLM配置
    
    Args:
        tenant_id: 租户ID
        
    Returns:
        LLM配置
    """
    try:
        # 首先尝试从用户配置文件加载
        user_config = load_user_config()
        
        if tenant_id in user_config:
            config = user_config[tenant_id]
        else:
            # 使用默认配置
            config = get_llm_config(tenant_id)
        
        # 转换为前端格式
        frontend_config = convert_to_frontend_format(config)
        
        return frontend_config
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load config: {str(e)}")


@router.post("/llm-config")
async def save_llm_configuration(
    config: LLMConfigModel,
    tenant_id: str = "default"
):
    """
    保存LLM配置
    
    Args:
        config: LLM配置
        tenant_id: 租户ID
        
    Returns:
        保存结果
    """
    try:
        # 转换为后端格式
        backend_config = convert_to_backend_format(config)
        
        # 加载现有配置
        user_config = load_user_config()
        
        # 更新租户配置
        user_config[tenant_id] = backend_config
        
        # 保存到文件
        save_user_config(user_config)
        
        # 同时更新内存中的配置
        update_tenant_config(tenant_id, backend_config)
        
        # 更新环境变量（用于全局访问）
        if tenant_id == "default":
            os.environ["OPENAI_API_KEY"] = config.apiKey
            os.environ["OPENAI_API_BASE"] = config.apiBase
        
        return {
            "success": True,
            "message": "配置保存成功",
            "tenant_id": tenant_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {str(e)}")


@router.post("/llm-config/test", response_model=TestConnectionResponse)
async def test_llm_connection(config: LLMConfigModel):
    """
    测试LLM连接
    
    Args:
        config: LLM配置
        
    Returns:
        测试结果
    """
    try:
        # 创建临时客户端进行测试
        client = LLMClient(
            api_key=config.apiKey,
            api_base=config.apiBase,
            llm_model=config.llmModel,
            vlm_model=config.vlmModel,
            embedding_model=config.embeddingModel,
            rerank_model=config.rerankModel
        )
        
        # 测试聊天补全
        try:
            response = await client.chat_completion(
                messages=[{"role": "user", "content": "测试连接"}],
                temperature=0.7,
                max_tokens=50
            )
            
            return TestConnectionResponse(
                success=True,
                message="连接测试成功！LLM响应正常。",
                details={
                    "llm_model": config.llmModel,
                    "response_length": len(response),
                    "api_base": config.apiBase
                }
            )
            
        except Exception as llm_error:
            # LLM测试失败，尝试测试embedding
            try:
                embedding = await client.create_embedding("测试")
                
                return TestConnectionResponse(
                    success=True,
                    message="连接成功，但LLM模型可能不可用。Embedding模型正常。",
                    details={
                        "llm_error": str(llm_error),
                        "embedding_model": config.embeddingModel,
                        "embedding_dimensions": len(embedding)
                    }
                )
                
            except Exception as embed_error:
                return TestConnectionResponse(
                    success=False,
                    message=f"连接失败：{str(llm_error)}",
                    details={
                        "llm_error": str(llm_error),
                        "embedding_error": str(embed_error)
                    }
                )
        
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"连接测试失败：{str(e)}",
            details={"error": str(e)}
        )


@router.get("/llm-config/models")
async def get_available_models():
    """
    获取可用的模型列表
    
    Returns:
        可用模型列表
    """
    return {
        "llm": [
            {
                "value": "Qwen3-QwQ-32B",
                "label": "Qwen3-QwQ-32B (推荐)",
                "contextWindow": "32K",
                "type": "llm"
            },
            {
                "value": "gpt-4",
                "label": "GPT-4",
                "contextWindow": "8K",
                "type": "llm"
            },
            {
                "value": "gpt-3.5-turbo",
                "label": "GPT-3.5 Turbo",
                "contextWindow": "4K",
                "type": "llm"
            }
        ],
        "vlm": [
            {
                "value": "Qwen2.5-VL-32B-Instruct",
                "label": "Qwen2.5-VL-32B (推荐)",
                "contextWindow": "32K",
                "type": "vlm"
            },
            {
                "value": "gpt-4-vision-preview",
                "label": "GPT-4 Vision",
                "contextWindow": "8K",
                "type": "vlm"
            }
        ],
        "embedding": [
            {
                "value": "bge-m3",
                "label": "BGE-M3 (推荐)",
                "dimensions": "1024",
                "type": "embedding"
            },
            {
                "value": "text-embedding-ada-002",
                "label": "Ada-002",
                "dimensions": "1536",
                "type": "embedding"
            }
        ],
        "rerank": [
            {
                "value": "bge-reranker-v2-minicpm-layerwise",
                "label": "BGE Reranker V2 (推荐)",
                "type": "rerank"
            },
            {
                "value": "cohere-rerank",
                "label": "Cohere Rerank",
                "type": "rerank"
            }
        ]
    }


@router.delete("/llm-config")
async def delete_llm_configuration(tenant_id: str = "default"):
    """
    删除LLM配置（恢复默认）
    
    Args:
        tenant_id: 租户ID
        
    Returns:
        删除结果
    """
    try:
        user_config = load_user_config()
        
        if tenant_id in user_config:
            del user_config[tenant_id]
            save_user_config(user_config)
        
        return {
            "success": True,
            "message": "配置已恢复为默认值"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete config: {str(e)}")
