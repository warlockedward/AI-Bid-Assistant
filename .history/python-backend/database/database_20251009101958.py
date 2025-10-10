"""
数据库模块
提供数据库连接和会话管理功能
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 数据库配置
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/intelligent_bid_system"
)


def get_engine():
    """获取数据库引擎。"""
    try:
        from sqlalchemy import create_engine
        return create_engine(DATABASE_URL, pool_pre_ping=True)
    except ImportError as exc:
        raise ImportError(
            "SQLAlchemy not installed. Please run: pip install sqlalchemy"
        ) from exc


def get_sessionmaker():
    """获取会话工厂。"""
    try:
        from sqlalchemy.orm import sessionmaker
        return sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine()
        )
    except ImportError as exc:
        raise ImportError(
            "SQLAlchemy not installed. Please run: pip install sqlalchemy"
        ) from exc


def get_base():
    """获取基础模型。"""
    try:
        from tenants.models import Base
        return Base
    except ImportError as exc:
        raise ImportError("Tenant models not available") from exc


# 创建会话工厂
SESSION_LOCAL = None
try:
    SESSION_LOCAL = get_sessionmaker()
except Exception:
    # 在缺少依赖时延迟初始化
    pass


def create_tables():
    """创建所有数据库表。"""
    try:
        base = get_base()
        base.metadata.create_all(bind=get_engine())
    except Exception as e:
        print(f"创建数据库表失败: {e}")


def get_db():
    """获取数据库会话。"""
    if SESSION_LOCAL is None:
        raise RuntimeError("Database session maker not initialized")

    db = SESSION_LOCAL()
    try:
        yield db
    finally:
        db.close()


def get_db_session():
    """获取数据库会话（用于非FastAPI使用）。"""
    if SESSION_LOCAL is None:
        raise RuntimeError("Database session maker not initialized")

    return SESSION_LOCAL()
