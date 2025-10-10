"""
应用配置模块
统一管理前后端配置，包括数据库、AI模型、安全和租户相关配置
"""

import os
from typing import Dict, Any, List, Optional
from enum import Enum

from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class ModelProvider(Enum):
    """AI模型提供商枚举"""
    OPENAI = "openai"
    VLLM = "vllm"
    FASTGPT = "fastgpt"


class Config:
    """应用配置类 - 统一前后端配置管理"""

    # ===========================================
    # 数据库配置
    # ===========================================
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost/bid_system"
    )

    # ===========================================
    # OpenAI配置
    # ===========================================
    OPENAI_CONFIG = {
        "api_url": os.getenv("OPENAI_API_URL", "https://api.openai.com/v1"),
        "api_key": os.getenv("OPENAI_API_KEY", ""),
        "default_model": os.getenv("OPENAI_DEFAULT_MODEL", "gpt-4"),
        "available_models": os.getenv(
            "OPENAI_AVAILABLE_MODELS",
            "gpt-4,gpt-4-turbo,gpt-3.5-turbo,gpt-4o"
        ).split(","),
        "temperature": 0.1,
        "timeout": 600,
        "max_tokens": 4000
    }

    # ===========================================
    # VLLM配置
    # ===========================================
    VLLM_CONFIG = {
        "api_url": os.getenv("VLLM_API_URL", "http://localhost:8000"),
        "api_key": os.getenv("VLLM_API_KEY", ""),
        "default_model": os.getenv("VLLM_DEFAULT_MODEL", "llama-2-7b-chat"),
        "available_models": os.getenv(
            "VLLM_AVAILABLE_MODELS",
            "llama-2-7b-chat,llama-2-13b-chat,codellama-7b-instruct"
        ).split(","),
        "temperature": 0.1,
        "timeout": 120,
        "max_tokens": 2000
    }

    # ===========================================
    # FastGPT RAG配置
    # ===========================================
    FASTGPT_CONFIG = {
        "api_url": os.getenv("FASTGPT_API_URL", "http://localhost:3000"),
        "api_key": os.getenv("FASTGPT_API_KEY", ""),
        "timeout": 30
    }

    # ===========================================
    # 安全配置
    # ===========================================
    SECURITY_CONFIG = {
        "jwt_secret": os.getenv(
            "JWT_SECRET",
            "your-secret-key-change-in-production"
        ),
        "jwt_algorithm": "HS256",
        "jwt_expire_minutes": 60,
        "nextauth_secret": os.getenv("NEXTAUTH_SECRET", "")
    }

    # ===========================================
    # 租户配置
    # ===========================================
    TENANT_CONFIG = {
        "default_tenant": "default",
        "max_agents_per_tenant": int(os.getenv("MAX_AGENTS_PER_TENANT", "10")),
        "max_concurrent_workflows": int(
            os.getenv("MAX_CONCURRENT_WORKFLOWS", "5")
        )
    }

    # ===========================================
    # 工作流配置
    # ===========================================
    WORKFLOW_CONFIG = {
        "max_rounds": int(os.getenv("WORKFLOW_MAX_ROUNDS", "20")),
        "timeout_seconds": int(os.getenv("WORKFLOW_TIMEOUT_SECONDS", "3600")),
        "retry_attempts": int(os.getenv("WORKFLOW_RETRY_ATTEMPTS", "3"))
    }


class ModelConfigManager:
    """AI模型配置管理器"""

    @staticmethod
    def get_model_config(
        provider: ModelProvider,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """获取指定提供商和模型的配置"""
        if provider == ModelProvider.OPENAI:
            config = Config.OPENAI_CONFIG.copy()
            # 如果提供了模型名称，使用该模型名称（支持自定义模型）
            if model_name:
                config["model"] = model_name
            else:
                config["model"] = config["default_model"]
            return config

        elif provider == ModelProvider.VLLM:
            config = Config.VLLM_CONFIG.copy()
            # 如果提供了模型名称，使用该模型名称（支持自定义模型）
            if model_name:
                config["model"] = model_name
            else:
                config["model"] = config["default_model"]
            return config

        elif provider == ModelProvider.FASTGPT:
            return Config.FASTGPT_CONFIG.copy()

        else:
            raise ValueError(f"Unsupported model provider: {provider}")

    @staticmethod
    def get_autogen_config(
        provider: ModelProvider,
        model_name: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """获取AutoGen格式的配置"""
        model_config = ModelConfigManager.get_model_config(
            provider,
            model_name
        )

        if provider == ModelProvider.OPENAI:
            llm_config = {
                "model": model_config["model"],
                "api_key": model_config["api_key"],
                "api_type": "open_ai",
                "base_url": model_config["api_url"],
                "temperature": model_config["temperature"],
                "timeout": model_config["timeout"],
                "max_tokens": model_config["max_tokens"]
            }
        elif provider == ModelProvider.VLLM:
            llm_config = {
                "model": model_config["model"],
                "api_key": model_config["api_key"],
                "api_type": "open_ai",  # VLLM兼容OpenAI API
                "base_url": model_config["api_url"],
                "temperature": model_config["temperature"],
                "timeout": model_config["timeout"],
                "max_tokens": model_config["max_tokens"]
            }
        else:
            raise ValueError(f"AutoGen not supported for provider: {provider}")

        autogen_config = {
            "llm_config": [llm_config],
            "cache_seed": 42,
            "tenant_id": tenant_id,
            "workflow_settings": Config.WORKFLOW_CONFIG
        }

        return autogen_config

    @staticmethod
    def get_available_models() -> Dict[str, List[str]]:
        """获取所有可用的模型列表"""
        return {
            "openai": Config.OPENAI_CONFIG["available_models"],  # type: ignore
            "vllm": Config.VLLM_CONFIG["available_models"]  # type: ignore
        }


def get_tenant_config(
    tenant_id: str,
    provider: ModelProvider = ModelProvider.OPENAI,
    model_name: Optional[str] = None
) -> Dict[str, Any]:
    """获取租户特定配置"""
    config = ModelConfigManager.get_autogen_config(
        provider,
        model_name,
        tenant_id
    )
    return config


def validate_config() -> List[str]:
    """验证配置完整性"""
    errors = []

    # 验证数据库配置
    if not Config.DATABASE_URL.startswith("postgresql://"):
        errors.append("DATABASE_URL must be a PostgreSQL connection string")

    # 验证OpenAI配置
    if not Config.OPENAI_CONFIG["api_key"]:
        errors.append("OPENAI_API_KEY is required")

    if not Config.OPENAI_CONFIG["api_url"]:
        errors.append("OPENAI_API_URL is required")

    # 验证安全配置
    jwt_secret = Config.SECURITY_CONFIG["jwt_secret"]
    if not jwt_secret or jwt_secret == "your-secret-key-change-in-production":
        # 只在生产环境中发出警告
        if os.getenv("ENVIRONMENT", "development") == "production":
            msg = "JWT_SECRET must be set to a secure value in production"
            errors.append(msg)

    # 验证工作流配置
    if Config.WORKFLOW_CONFIG["max_rounds"] <= 0:
        errors.append("WORKFLOW_MAX_ROUNDS must be greater than 0")

    if Config.WORKFLOW_CONFIG["timeout_seconds"] <= 0:
        errors.append("WORKFLOW_TIMEOUT_SECONDS must be greater than 0")

    return errors


def get_config_summary() -> Dict[str, Any]:
    """获取配置摘要（不包含敏感信息）"""
    return {
        "openai": {
            "api_url": Config.OPENAI_CONFIG["api_url"],
            "default_model": Config.OPENAI_CONFIG["default_model"],
            "available_models": Config.OPENAI_CONFIG["available_models"],
            "api_key_configured": bool(Config.OPENAI_CONFIG["api_key"])
        },
        "vllm": {
            "api_url": Config.VLLM_CONFIG["api_url"],
            "default_model": Config.VLLM_CONFIG["default_model"],
            "available_models": Config.VLLM_CONFIG["available_models"],
            "api_key_configured": bool(Config.VLLM_CONFIG["api_key"])
        },
        "fastgpt": {
            "api_url": Config.FASTGPT_CONFIG["api_url"],
            "api_key_configured": bool(Config.FASTGPT_CONFIG["api_key"])
        },
        "workflow": Config.WORKFLOW_CONFIG,
        "tenant": Config.TENANT_CONFIG
    }
