#!/usr/bin/env python3
"""
系统检查脚本 - 验证AI投标助手系统的核心组件
"""

import sys
import os
import logging

# 添加项目路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'python-backend'))

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_python_backend():
    """检查Python后端组件"""
    logger.info("检查Python后端组件...")
    
    # 检查必需的依赖是否可导入
    required_modules = [
        'fastapi',
        'pydantic',
        'autogen_agentchat',
        'autogen_ext',
        'sqlalchemy',
        'uvicorn'
    ]
    
    missing_modules = []
    for module in required_modules:
        try:
            __import__(module)
            logger.info(f"✓ {module} 导入成功")
        except ImportError:
            missing_modules.append(module)
            logger.error(f"✗ {module} 导入失败")
    
    return len(missing_modules) == 0

def check_agent_modules():
    """检查代理模块"""
    logger.info("检查代理模块...")
    
    try:
        # 检查基础代理模块
        from agents.base_agent import BaseAgent
        logger.info("✓ BaseAgent 导入成功")
        
        # 检查具体代理模块
        from agents.tender_analysis_agent import TenderAnalysisAgent
        from agents.knowledge_retrieval_agent import KnowledgeRetrievalAgent
        from agents.content_generation_agent import ContentGenerationAgent
        from agents.compliance_verification_agent import ComplianceVerificationAgent
        logger.info("✓ 所有代理模块导入成功")
        
        return True
    except ImportError as e:
        logger.error(f"✗ 代理模块导入失败: {e}")
        return False

def check_api_modules():
    """检查API模块"""
    logger.info("检查API模块...")
    
    try:
        from api.agents import router as agents_router
        from api.workflow_sync import router as workflow_router
        logger.info("✓ API模块导入成功")
        return True
    except ImportError as e:
        logger.error(f"✗ API模块导入失败: {e}")
        return False

def check_database_models():
    """检查数据库模型"""
    logger.info("检查数据库模型...")
    
    try:
        from tenants.models import Tenant, User, TenantConfig
        from workflows.repository import WorkflowStateRepository
        logger.info("✓ 数据库模型导入成功")
        return True
    except ImportError as e:
        logger.error(f"✗ 数据库模型导入失败: {e}")
        return False

def check_monitoring():
    """检查监控模块"""
    logger.info("检查监控模块...")
    
    try:
        from monitoring.logger import logger as monitoring_logger
        from monitoring.metrics import metrics_collector
        logger.info("✓ 监控模块导入成功")
        return True
    except ImportError as e:
        logger.error(f"✗ 监控模块导入失败: {e}")
        return False

def main():
    """主检查函数"""
    logger.info("开始执行AI投标助手系统检查")
    logger.info("=" * 40)
    
    checks = [
        ("Python后端组件", check_python_backend),
        ("代理模块", check_agent_modules),
        ("API模块", check_api_modules),
        ("数据库模型", check_database_models),
        ("监控模块", check_monitoring)
    ]
    
    results = []
    for check_name, check_func in checks:
        try:
            result = check_func()
            results.append((check_name, result))
            status = "✓ 通过" if result else "✗ 失败"
            logger.info(f"{check_name}: {status}")
        except Exception as e:
            results.append((check_name, False))
            logger.error(f"{check_name}: ✗ 异常 - {e}")
    
    # 统计结果
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    logger.info("=" * 40)
    logger.info(f"检查完成: {passed}/{total} 通过")
    
    if passed == total:
        logger.info("🎉 所有系统检查通过!")
        return True
    else:
        logger.error(f"❌ {total - passed} 个检查失败")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)