#!/usr/bin/env python3
"""
测试所有更新后的AutoGen代理
"""


def test_agent_imports():
    """测试代理导入"""
    try:
        from agents.base_agent import BaseAgent
        # 使用导入的类来避免未使用警告
        _ = BaseAgent
        print("✓ BaseAgent 导入成功")
    except Exception as e:
        print(f"✗ BaseAgent 导入失败: {e}")
        return False
    
    try:
        from agents.tender_analysis_agent import TenderAnalysisAgent
        # 使用导入的类来避免未使用警告
        _ = TenderAnalysisAgent
        print("✓ TenderAnalysisAgent 导入成功")
    except Exception as e:
        print(f"✗ TenderAnalysisAgent 导入失败: {e}")
        return False
    
    try:
        from agents.content_generation_agent import ContentGenerationAgent
        # 使用导入的类来避免未使用警告
        _ = ContentGenerationAgent
        print("✓ ContentGenerationAgent 导入成功")
    except Exception as e:
        print(f"✗ ContentGenerationAgent 导入失败: {e}")
        return False
    
    try:
        from agents.knowledge_retrieval_agent import KnowledgeRetrievalAgent
        # 使用导入的类来避免未使用警告
        _ = KnowledgeRetrievalAgent
        print("✓ KnowledgeRetrievalAgent 导入成功")
    except Exception as e:
        print(f"✗ KnowledgeRetrievalAgent 导入失败: {e}")
        return False
    
    try:
        from agents.compliance_verification_agent import (
            ComplianceVerificationAgent
        )
        # 使用导入的类来避免未使用警告
        _ = ComplianceVerificationAgent
        print("✓ ComplianceVerificationAgent 导入成功")
    except Exception as e:
        print(f"✗ ComplianceVerificationAgent 导入失败: {e}")
        return False
    
    try:
        from agents.agent_manager import AgentWorkflowManager
        # 使用导入的类来避免未使用警告
        _ = AgentWorkflowManager
        print("✓ AgentWorkflowManager 导入成功")
    except Exception as e:
        print(f"✗ AgentWorkflowManager 导入失败: {e}")
        return False
    
    return True


def test_agent_classes():
    """测试代理类定义"""
    try:
        from agents.base_agent import BaseAgent
        from agents.tender_analysis_agent import TenderAnalysisAgent
        from agents.content_generation_agent import ContentGenerationAgent
        from agents.knowledge_retrieval_agent import KnowledgeRetrievalAgent
        from agents.compliance_verification_agent import (
            ComplianceVerificationAgent
        )
        from agents.agent_manager import AgentWorkflowManager
        
        # 检查类是否正确定义
        assert hasattr(BaseAgent, '_create_autogen_agent'), (
            "BaseAgent 缺少 _create_autogen_agent 方法"
        )
        assert hasattr(BaseAgent, '_chat_with_agent'), (
            "BaseAgent 缺少 _chat_with_agent 方法"
        )
        assert hasattr(BaseAgent, 'execute'), "BaseAgent 缺少 execute 方法"
        assert hasattr(BaseAgent, '_execute_impl'), (
            "BaseAgent 缺少 _execute_impl 方法"
        )
        print("✓ BaseAgent 类定义正确")
        
        assert hasattr(TenderAnalysisAgent, '_create_autogen_agent'), (
            "TenderAnalysisAgent 缺少 _create_autogen_agent 方法"
        )
        assert hasattr(TenderAnalysisAgent, '_execute_impl'), (
            "TenderAnalysisAgent 缺少 _execute_impl 方法"
        )
        print("✓ TenderAnalysisAgent 类定义正确")
        
        assert hasattr(ContentGenerationAgent, '_create_autogen_agent'), (
            "ContentGenerationAgent 缺少 _create_autogen_agent 方法"
        )
        assert hasattr(ContentGenerationAgent, '_execute_impl'), (
            "ContentGenerationAgent 缺少 _execute_impl 方法"
        )
        print("✓ ContentGenerationAgent 类定义正确")
        
        assert hasattr(KnowledgeRetrievalAgent, '_create_autogen_agent'), (
            "KnowledgeRetrievalAgent 缺少 _create_autogen_agent 方法"
        )
        assert hasattr(KnowledgeRetrievalAgent, '_execute_impl'), (
            "KnowledgeRetrievalAgent 缺少 _execute_impl 方法"
        )
        print("✓ KnowledgeRetrievalAgent 类定义正确")
        
        assert hasattr(ComplianceVerificationAgent, '_create_autogen_agent'), (
            "ComplianceVerificationAgent 缺少 _create_autogen_agent 方法"
        )
        assert hasattr(ComplianceVerificationAgent, '_execute_impl'), (
            "ComplianceVerificationAgent 缺少 _execute_impl 方法"
        )
        print("✓ ComplianceVerificationAgent 类定义正确")
        
        assert hasattr(AgentWorkflowManager, 'start_workflow'), (
            "AgentWorkflowManager 缺少 start_workflow 方法"
        )
        assert hasattr(AgentWorkflowManager, '_execute_workflow'), (
            "AgentWorkflowManager 缺少 _execute_workflow 方法"
        )
        print("✓ AgentWorkflowManager 类定义正确")
        
        return True
    except Exception as e:
        print(f"✗ 代理类定义测试失败: {e}")
        return False


def main():
    """主函数"""
    print("测试更新后的AutoGen代理实现...")
    print("=" * 50)
    
    if test_agent_imports():
        print("\n" + "=" * 50)
        if test_agent_classes():
            print("\n" + "=" * 50)
            print("🎉 所有测试通过！AutoGen代理更新完成。")
            return True
    
    print("\n" + "=" * 50)
    print("❌ 测试失败，请检查代码实现。")
    return False


if __name__ == "__main__":
    main()