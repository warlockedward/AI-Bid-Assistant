import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 数据库配置
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/intelligent_bid_system")

# 延迟导入SQLAlchemy相关模块，避免循环导入和依赖问题
def get_engine():
    try:
        from sqlalchemy import create_engine
        return create_engine(DATABASE_URL)
    except ImportError:
        raise ImportError("SQLAlchemy not installed. Please run: pip install sqlalchemy")

def get_sessionmaker():
    try:
        from sqlalchemy.orm import sessionmaker
        return sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    except ImportError:
        raise ImportError("SQLAlchemy not installed. Please run: pip install sqlalchemy")

def get_base():
    try:
        from tenants.models import Base
        return Base
    except ImportError:
        raise ImportError("Tenant models not available")

# 创建会话工厂
SessionLocal = get_sessionmaker()


def create_tables():
    """创建所有数据库表。"""
    try:
        Base = get_base()
        Base.metadata.create_all(bind=get_engine())
    except Exception as e:
        print(f"创建数据库表失败: {e}")


def get_db():
    """获取数据库会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session():
    """获取数据库会话（用于非FastAPI使用）。"""
    return SessionLocal()