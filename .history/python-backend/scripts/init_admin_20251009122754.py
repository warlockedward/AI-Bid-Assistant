#!/usr/bin/env python3
"""
系统初始化脚本
用于创建系统管理员和默认租户
"""

import os
import sys
import uuid

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 延迟导入数据库相关模块
try:
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import create_engine
    from tenants.models import Tenant, User, TenantConfig
    from database.database import DATABASE_URL
except ImportError as e:
    print(f"导入模块失败: {e}")
    print("请确保已安装所有依赖并正确配置Python路径")
    sys.exit(1)


def create_admin_user():
    """创建系统管理员用户和默认租户"""
    
    # 创建数据库引擎
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 检查是否已存在默认租户
        default_tenant = db.query(Tenant).filter(
            Tenant.name == "Default").first()
        
        if not default_tenant:
            print("创建默认租户...")
            default_tenant = Tenant(
                id=uuid.uuid4(),
                name="Default",
                domain="default",
                is_active=True,
                config={
                    "description": "系统默认租户",
                    "created_by": "system_init"
                }
            )
            db.add(default_tenant)
            db.flush()  # 获取ID但不提交事务
            print(f"默认租户创建成功: {default_tenant.id}")
        else:
            print(f"默认租户已存在: {default_tenant.id}")
        
        # 检查是否已存在管理员用户
        admin_user = db.query(User).filter(
            User.email == "admin@system.com").first()
        
        if not admin_user:
            print("创建系统管理员用户...")
            admin_user = User(
                id=uuid.uuid4(),
                email="admin@system.com",
                name="系统管理员",
                tenant_id=default_tenant.id,
                is_active=True,
                preferences={
                    "role": "system_admin",
                    "permissions": [
                        "manage_tenants", 
                        "manage_users", 
                        "view_all_data"
                    ]
                }
            )
            db.add(admin_user)
            print(f"系统管理员创建成功: {admin_user.id}")
        else:
            print(f"系统管理员已存在: {admin_user.id}")
        
        # 检查是否已存在租户配置
        tenant_config = db.query(TenantConfig).filter(
            TenantConfig.tenant_id == default_tenant.id).first()
        
        if not tenant_config:
            print("创建默认租户配置...")
            tenant_config = TenantConfig(
                id=uuid.uuid4(),
                tenant_id=default_tenant.id,
                features={
                    "bid_generation": True,
                    "document_analysis": True,
                    "workflow_management": True,
                    "real_time_collaboration": True
                },
                workflow_settings={
                    "default_timeout_minutes": 30,
                    "max_concurrent_workflows": 10
                },
                ui_customization={
                    "theme": "default",
                    "language": "zh-CN"
                }
            )
            db.add(tenant_config)
            print("默认租户配置创建成功")
        else:
            print("默认租户配置已存在")
        
        # 提交事务
        db.commit()
        print("✅ 系统初始化完成!")
        
        # 输出登录信息
        print("\n📝 登录信息:")
        print(f"  租户ID: {default_tenant.id}")
        print(f"  管理员邮箱: {admin_user.email}")
        print(f"  管理员ID: {admin_user.id}")
        print("\n💡 提示: 请使用以上信息登录系统")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 初始化过程中发生错误: {e}")
        return False
    finally:
        db.close()
    
    return True


def create_demo_tenant():
    """创建演示租户和用户"""
    
    # 创建数据库引擎
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 创建演示租户
        demo_tenant = db.query(Tenant).filter(
            Tenant.name == "Demo Company").first()
        
        if not demo_tenant:
            print("创建演示租户...")
            demo_tenant = Tenant(
                id=uuid.uuid4(),
                name="Demo Company",
                domain="demo",
                is_active=True,
                config={
                    "description": "演示公司租户",
                    "industry": "general",
                    "created_by": "system_init"
                }
            )
            db.add(demo_tenant)
            db.flush()
            print(f"演示租户创建成功: {demo_tenant.id}")
        else:
            print(f"演示租户已存在: {demo_tenant.id}")
        
        # 创建演示用户
        demo_user = db.query(User).filter(
            User.email == "demo@example.com").first()
        
        if not demo_user:
            print("创建演示用户...")
            demo_user = User(
                id=uuid.uuid4(),
                email="demo@example.com",
                name="演示用户",
                tenant_id=demo_tenant.id,
                is_active=True,
                preferences={
                    "role": "demo_user",
                    "permissions": ["create_bids", "view_reports"]
                }
            )
            db.add(demo_user)
            print(f"演示用户创建成功: {demo_user.id}")
        else:
            print(f"演示用户已存在: {demo_user.id}")
        
        # 创建演示租户配置
        demo_config = db.query(TenantConfig).filter(
            TenantConfig.tenant_id == demo_tenant.id).first()
        
        if not demo_config:
            print("创建演示租户配置...")
            demo_config = TenantConfig(
                id=uuid.uuid4(),
                tenant_id=demo_tenant.id,
                features={
                    "bid_generation": True,
                    "document_analysis": True,
                    "workflow_management": True
                },
                workflow_settings={
                    "default_timeout_minutes": 60,
                    "max_concurrent_workflows": 5
                },
                ui_customization={
                    "theme": "light",
                    "language": "zh-CN"
                }
            )
            db.add(demo_config)
            print("演示租户配置创建成功")
        else:
            print("演示租户配置已存在")
        
        # 提交事务
        db.commit()
        print("✅ 演示数据初始化完成!")
        
        # 输出登录信息
        print("\n📝 演示登录信息:")
        print(f"  租户ID: {demo_tenant.id}")
        print(f"  用户邮箱: {demo_user.email}")
        print(f"  用户ID: {demo_user.id}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 演示数据初始化过程中发生错误: {e}")
        return False
    finally:
        db.close()
    
    return True


if __name__ == "__main__":
    print("🚀 智能投标系统初始化工具")
    print("=" * 40)
    
    # 创建管理员和默认租户
    if create_admin_user():
        print("\n" + "=" * 40)
    
    # 创建演示数据
    print("\n创建演示数据...")
    create_demo_tenant()
    
    print("\n🎉 系统初始化完成!")