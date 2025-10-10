#!/usr/bin/env python3
"""
综合测试脚本 - 验证AI投标助手系统的完整功能
"""

import sys
import os
import asyncio
import logging
from datetime import datetime


# 添加项目路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'python-backend'))

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_imports():
    """测试所有模块导入"""
    logger.info("开始测试模块导入...")
    
    # 测试基础模块
    try:
        # 只导入模块，不导入具体类
        import fastapi
        import pydantic
        logger.info("✓ 基础FastAPI模块导入成功")
    except ImportError as e:
        logger.error(f"✗ 基础模块导入失败: {e}")
        return False
    
    # 测试AutoGen模块
    try:
        # 只导入模块，不导入具体类
        import autogen_agentchat
        import autogen_ext
        logger.info("✓ AutoGen模块导入成功")
    except ImportError as e:
        logger.error(f"✗ AutoGen模块导入失败: {e}")
        return False
    
    # 测试数据库模块
    try:
        # 只导入模块，不导入具体类
        import sqlalchemy
        logger.info("✓ 数据库模块导入成功")
    except ImportError as e:
        logger.error(f"✗ 数据库模块导入失败: {e}")
        return False
    
    # 测试代理模块
    try:
        # 只导入模块，不导入具体类
        import agents.base_agent
        import agents.tender_analysis_agent
        import agents.knowledge_retrieval_agent
        import agents.content_generation_agent
        import agents.compliance_verification_agent
        import agents.agent_manager
        logger.info("✓ 代理模块导入成功")
    except ImportError as e:
        logger.error(f"✗ 代理模块导入失败: {e}")
        return False
    
    # 测试API模块
    try:
        # 只导入模块，不导入具体类
        import api.agents
        import api.workflow_sync
        import api.websocket_sync
        logger.info("✓ API模块导入成功")
    except ImportError as e:
        logger.error(f"✗ API模块导入失败: {e}")
        return False
    
    # 测试租户模块
    try:
        # 只导入模块，不导入具体类
        import tenants.context
        import tenants.models
        logger.info("✓ 租户模块导入成功")
    except ImportError as e:
        logger.error(f"✗ 租户模块导入失败: {e}")
        return False
    
    # 测试工作流模块
    try:
        # 只导入模块，不导入具体类
        import workflows.repository
        logger.info("✓ 工作流模块导入成功")
    except ImportError as e:
        logger.error(f"✗ 工作流模块导入失败: {e}")
        return False
    
    # 测试监控模块
    try:
        # 只导入模块，不导入具体类
        import monitoring.logger
        import monitoring.metrics
        logger.info("✓ 监控模块导入成功")
    except ImportError as e:
        logger.error(f"✗ 监控模块导入失败: {e}")
        return False
    
    return True


def test_agent_creation():
    """测试代理创建"""
    logger.info("开始测试代理创建...")
    
    try:
        # 创建测试租户配置
        tenant_settings = {
            "ai_models": {
                "primary": "gpt-4"
            },
            "openai_api_key": "test-key",
            "openai_base_url": "https://api.openai.com/v1"
        }
        
        # 测试基础代理
        from agents.tender_analysis_agent import TenderAnalysisAgent
        tender_agent = TenderAnalysisAgent("test_tenant", tenant_settings)
        logger.info("✓ 招标分析代理创建成功")
        
        from agents.knowledge_retrieval_agent import KnowledgeRetrievalAgent
        knowledge_agent = KnowledgeRetrievalAgent("test_tenant", tenant_settings)
        logger.info("✓ 知识检索代理创建成功")
        
        from agents.content_generation_agent import ContentGenerationAgent
        content_agent = ContentGenerationAgent("test_tenant", tenant_settings)
        logger.info("✓ 内容生成代理创建成功")
        
        from agents.compliance_verification_agent import ComplianceVerificationAgent
        compliance_agent = ComplianceVerificationAgent("test_tenant", tenant_settings)
        logger.info("✓ 合规验证代理创建成功")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ 代理创建测试失败: {e}")
        return False


def test_workflow_manager():
    """测试工作流管理器"""
    logger.info("开始测试工作流管理器...")
    
    try:
        from agents.agent_manager import AgentWorkflowManager
        workflow_manager = AgentWorkflowManager()
        logger.info("✓ 工作流管理器创建成功")
        
        # 检查方法是否存在
        assert hasattr(workflow_manager, 'start_workflow')
        assert hasattr(workflow_manager, 'get_workflow_status')
        logger.info("✓ 工作流管理器方法检查通过")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ 工作流管理器测试失败: {e}")
        return False


def test_tenant_context():
    """测试租户上下文"""
    logger.info("开始测试租户上下文...")
    
    try:
        import uuid
        from tenants.context import TenantContext
        
        # 创建测试上下文
        context = TenantContext(
            tenant_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            sso_provider="test",
            sso_id="test123",
            preferences={"test": "value"},
            tenant_name="Test Tenant",
            user_email="test@example.com",
            user_name="Test User"
        )
        
        # 测试方法
        context.set_preference("new_key", "new_value")
        assert context.get_preference("new_key") == "new_value"
        logger.info("✓ 租户上下文功能测试通过")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ 租户上下文测试失败: {e}")
        return False


def test_models():
    """测试数据库模型"""
    logger.info("开始测试数据库模型...")
    
    try:
        from tenants.models import Tenant, User, TenantConfig, WorkflowState, WorkflowCheckpoint
        logger.info("✓ 数据库模型导入成功")
        
        # 测试模型创建（不实际保存到数据库）
        tenant = Tenant(name="Test Tenant", domain="test.example.com")
        user = User(email="test@example.com", name="Test User")
        config = TenantConfig(tenant_id="test-tenant-id")
        
        logger.info("✓ 数据库模型实例化成功")
        return True
        
    except Exception as e:
        logger.error(f"✗ 数据库模型测试失败: {e}")
        return False


def test_api_endpoints():
    """测试API端点"""
    logger.info("开始测试API端点...")
    
    try:
        from fastapi import FastAPI
        from api.agents import router as agents_router
        from api.workflow_sync import router as workflow_router
        
        # 创建测试应用
        app = FastAPI()
        app.include_router(agents_router)
        app.include_router(workflow_router)
        
        # 检查路由是否存在
        routes = [route.path for route in app.routes]
        assert "/api/analyze-tender" in routes
        assert "/api/workflows/{workflow_id}" in routes
        logger.info("✓ API端点测试通过")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ API端点测试失败: {e}")
        return False


async def test_async_functionality():
    """测试异步功能"""
    logger.info("开始测试异步功能...")
    
    try:
        # 测试异步函数
        async def test_async_func():
            await asyncio.sleep(0.1)
            return "success"
        
        result = await test_async_func()
        assert result == "success"
        logger.info("✓ 异步功能测试通过")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ 异步功能测试失败: {e}")
        return False


def test_monitoring():
    """测试监控功能"""
    logger.info("开始测试监控功能...")
    
    try:
        from monitoring.metrics import AgentMetrics
        
        # 创建测试指标
        metrics = AgentMetrics(
            agent_id="test_agent",
            agent_type="test_type",
            tenant_id="test_tenant",
            workflow_id="test_workflow",
            operation="test_operation",
            duration=100.0,
            status="success"
        )
        
        # 记录指标
        from monitoring.metrics import metrics_collector
        metrics_collector.record_agent_operation(metrics)
        
        logger.info("✓ 监控功能测试通过")
        return True
        
    except Exception as e:
        logger.error(f"✗ 监控功能测试失败: {e}")
        return False


def main():
    """主测试函数"""
    logger.info("开始执行AI投标助手系统综合测试")
    logger.info("=" * 50)
    
    start_time = datetime.now()
    
    # 执行所有测试
    tests = [
        ("模块导入测试", test_imports),
        ("代理创建测试", test_agent_creation),
        ("工作流管理器测试", test_workflow_manager),
        ("租户上下文测试", test_tenant_context),
        ("数据库模型测试", test_models),
        ("API端点测试", test_api_endpoints),
        ("异步功能测试", test_async_functionality),
        ("监控功能测试", test_monitoring)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = asyncio.run(test_func())
            else:
                result = test_func()
            results.append((test_name, result))
            status = "✓ 通过" if result else "✗ 失败"
            logger.info(f"{test_name}: {status}")
        except Exception as e:
            results.append((test_name, False))
            logger.error(f"{test_name}: ✗ 异常 - {e}")
    
    # 统计结果
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    logger.info("=" * 50)
    logger.info(f"测试完成: {passed}/{total} 通过, 耗时: {duration:.2f}秒")
    
    if passed == total:
        logger.info("🎉 所有测试通过!")
        return True
    else:
        logger.error(f"❌ {total - passed} 个测试失败")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)