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
    except ImportError:
        raise ImportError(
            "SQLAlchemy not installed. Please run: pip install sqlalchemy"
        )


def get_sessionmaker():
    """获取会话工厂。"""
    try:
        from sqlalchemy.orm import sessionmaker
        return sessionmaker(
            autocommit=False, 
            autoflush=False, 
            bind=get_engine()
        )
    except ImportError:
        raise ImportError(
            "SQLAlchemy not installed. Please run: pip install sqlalchemy"
        )


def get_base():
    """获取基础模型。"""
    try:
        from tenants.models import Base
        return Base
    except ImportError:
        raise ImportError("Tenant models not available")


# 创建会话工厂
SessionLocal = None
try:
    SessionLocal = get_sessionmaker()
except Exception:
    # 在缺少依赖时延迟初始化
    pass


def create_tables():
    """创建所有数据库表。"""
    try:
        Base = get_base()
        Base.metadata.create_all(bind=get_engine())
    except Exception as e:
        print(f"创建数据库表失败: {e}")


def get_db():
    """获取数据库会话。"""
    if SessionLocal is None:
        raise RuntimeError("Database session maker not initialized")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session():
    """获取数据库会话（用于非FastAPI使用）。"""
    if SessionLocal is None:
        raise RuntimeError("Database session maker not initialized")
    
    return SessionLocal()