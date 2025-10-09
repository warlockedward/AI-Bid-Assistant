import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 数据库配置
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/intelligent_bid_system")

# 延迟导入SQLAlchemy相关模块，避免循环导入
def get_engine():
    from sqlalchemy import create_engine
    return create_engine(DATABASE_URL)

def get_sessionmaker():
    from sqlalchemy.orm import sessionmaker
    return sessionmaker(autocommit=False, autoflush=False, bind=get_engine())

def get_base():
    from tenants.models import Base
    return Base

# 创建会话工厂
SessionLocal = get_sessionmaker()


def create_tables():
    """创建所有数据库表。"""
    Base = get_base()
    Base.metadata.create_all(bind=get_engine())


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