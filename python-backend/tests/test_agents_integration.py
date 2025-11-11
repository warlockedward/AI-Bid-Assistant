"""
智能体集成测试
测试智能体系统的各个组件和协作功能
"""
import pytest
import asyncio
from datetime import datetime
from typing import Dict, Any

# 导入智能体组件
from python-backend.agents.collaborative_workflow import (
    CollaborativeWorkflow,
    HumanInterventionManager
)
from python-backend.agents.error_handling import (
    RetryConfig,
    CheckpointManager,
    ErrorRecoveryManager,
    with_retry
)
from python-backend.agents.quality_control import (
    ContentQualityChecker,
    QualityScorer,
    QualityOptimizer
)
from python-backend.agents.monitoring import (
    MetricsCollector,
    PerformanceMonitor,
    AlertManager
)
from python-backend.agents.performance_optimization import (
    CacheManager,
    ParallelExecutor,
    ResourceOptimizer,
    with_cache
)


class TestErrorHandling:
    """测试错误处理机制"""
    
    def test_retry_config(self):
        """测试重试配置"""
        config = RetryConfig(
            max_retries=3,
            initial_delay=1.0,
            exponential_base=2.0
        )
        
        # 测试延迟计算
        delay_0 = config.get_delay(0)
        delay_1 = config.get_delay(1)
        delay_2 = config.get_delay(2)
        
        assert delay_0 >= 0.5  # 有抖动
        assert delay_1 > delay_0
        assert delay_2 > delay_1
    
    def test_checkpoint_manager(self):
        """测试检查点管理"""
        manager = CheckpointManager()
        
        # 保存检查点
        workflow_id = "test_workflow_1"
        stage = "analysis"
        data = {"result": "test_data"}
        
        manager.save_checkpoint(workflow_id, stage, data)
        
        # 加载检查点
        loaded_data = manager.load_checkpoint(workflow_id, stage)
        assert loaded_data == data
        
        # 回滚
        manager.save_checkpoint(workflow_id, "generation", {"result": "gen_data"})
        rollback_data = manager.rollback_to_checkpoint(workflow_id, stage)
        assert rollback_data == data
        
        # 清除
        manager.clear_checkpoints(workflow_id)
        assert manager.load_checkpoint(workflow_id, stage) is None
    
    @pytest.mark.asyncio
    async def test_retry_decorator(self):
        """测试重试装饰器"""
        attempt_count = 0
        
        @with_retry(retry_config=RetryConfig(max_retries=2, initial_delay=0.1))
        async def flaky_function():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 2:
                raise ValueError("Temporary error")
            return "success"
        
        result = await flaky_function()
        assert result == "success"
        assert attempt_count == 2


class TestQualityControl:
    """测试质量控制机制"""
    
    def test_content_length_check(self):
        """测试内容长度检查"""
        checker = ContentQualityChecker()
        
        # 正常长度
        result = checker.check_content_length("a" * 500)
        assert result["passed"] is True
        
        # 过短
        result = checker.check_content_length("short", min_length=100)
        assert result["passed"] is False
        assert result["issue"] == "content_too_short"
        
        # 过长
        result = checker.check_content_length("a" * 60000, max_length=50000)
        assert result["passed"] is False
        assert result["issue"] == "content_too_long"
    
    def test_professional_terminology_check(self):
        """测试专业术语检查"""
        checker = ContentQualityChecker()
        
        # 充足的专业术语
        content = "系统架构设计采用微服务技术方案，通过性能优化提升系统可靠性"
        result = checker.check_professional_terminology(content, min_term_count=3)
        assert result["passed"] is True
        assert result["term_count"] >= 3
        
        # 不足的专业术语
        content = "这是一个简单的文本"
        result = checker.check_professional_terminology(content, min_term_count=5)
        assert result["passed"] is False
    
    def test_structure_check(self):
        """测试结构检查"""
        checker = ContentQualityChecker()
        
        # 完整结构
        content = {
            "technical": "技术内容" * 20,
            "commercial": "商务内容" * 20,
            "implementation": "实施内容" * 20
        }
        result = checker.check_structure(
            content,
            ["technical", "commercial", "implementation"]
        )
        assert result["passed"] is True
        
        # 缺失章节
        incomplete_content = {"technical": "技术内容" * 20}
        result = checker.check_structure(
            incomplete_content,
            ["technical", "commercial", "implementation"]
        )
        assert result["passed"] is False
        assert len(result["missing_sections"]) == 2
    
    def test_quality_scorer(self):
        """测试质量评分"""
        content = {"section1": "content" * 50}
        
        # 高质量
        quality_checks = {
            "overall_passed": True,
            "issues": [],
            "warnings": [],
            "checks": {
                "structure": {"passed": True},
                "terminology": {"passed": True}
            }
        }
        score = QualityScorer.calculate_quality_score(content, quality_checks)
        assert score >= 0.8
        
        # 低质量
        quality_checks = {
            "overall_passed": False,
            "issues": ["issue1", "issue2"],
            "warnings": ["warning1"],
            "checks": {}
        }
        score = QualityScorer.calculate_quality_score(content, quality_checks)
        assert score < 0.7
    
    def test_quality_level(self):
        """测试质量等级"""
        assert QualityScorer.get_quality_level(0.95) == "excellent"
        assert QualityScorer.get_quality_level(0.85) == "good"
        assert QualityScorer.get_quality_level(0.75) == "acceptable"
        assert QualityScorer.get_quality_level(0.65) == "needs_improvement"
        assert QualityScorer.get_quality_level(0.50) == "poor"


class TestMonitoring:
    """测试监控机制"""
    
    def test_metrics_collector(self):
        """测试指标收集"""
        collector = MetricsCollector()
        
        # 记录指标
        collector.record_metric("test_metric", 100.0, {"tag": "test"})
        collector.record_metric("test_metric", 200.0, {"tag": "test"})
        
        # 获取统计
        stats = collector.get_metric_stats("test_metric")
        assert stats["count"] == 2
        assert stats["min"] == 100.0
        assert stats["max"] == 200.0
        assert stats["avg"] == 150.0
        
        # 计数器
        collector.increment_counter("test_counter", 5)
        collector.increment_counter("test_counter", 3)
        assert collector.get_counter_value("test_counter") == 8
        
        # 仪表
        collector.set_gauge("test_gauge", 42.0)
        assert collector.get_gauge_value("test_gauge") == 42.0
    
    def test_performance_monitor(self):
        """测试性能监控"""
        collector = MetricsCollector()
        monitor = PerformanceMonitor(collector)
        
        # 记录LLM调用
        monitor.record_llm_call("test_agent", 1.5, True, 1000)
        monitor.record_llm_call("test_agent", 2.0, True, 1200)
        
        # 记录内容质量
        monitor.record_content_quality("technical", 0.85)
        monitor.record_content_quality("commercial", 0.90)
        
        # 获取摘要
        summary = monitor.get_performance_summary()
        assert "llm_calls" in summary
        assert "content_quality" in summary
    
    def test_alert_manager(self):
        """测试告警管理"""
        collector = MetricsCollector()
        alert_manager = AlertManager(collector)
        
        # 添加告警规则
        alert_manager.add_alert_rule(
            "test_alert",
            "test_metric",
            "gt",
            100.0,
            "warning"
        )
        
        # 触发告警
        collector.record_metric("test_metric", 150.0)
        alert_manager.check_alerts()
        
        # 检查活跃告警
        active_alerts = alert_manager.get_active_alerts()
        assert len(active_alerts) > 0
        
        # 解决告警
        alert_manager.resolve_alert("test_alert")
        assert len(alert_manager.get_active_alerts()) == 0


class TestPerformanceOptimization:
    """测试性能优化"""
    
    def test_cache_manager(self):
        """测试缓存管理"""
        cache = CacheManager(default_ttl=3600)
        
        # 设置和获取
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        
        # 缓存未命中
        assert cache.get("nonexistent") is None
        
        # 删除
        cache.delete("key1")
        assert cache.get("key1") is None
        
        # 统计
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        stats = cache.get_stats()
        assert stats["total_entries"] == 2
    
    @pytest.mark.asyncio
    async def test_cache_decorator(self):
        """测试缓存装饰器"""
        cache = CacheManager()
        call_count = 0
        
        @with_cache(cache, ttl=60, key_prefix="test_")
        async def expensive_function(x: int) -> int:
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.1)
            return x * 2
        
        # 第一次调用
        result1 = await expensive_function(5)
        assert result1 == 10
        assert call_count == 1
        
        # 第二次调用（应该从缓存获取）
        result2 = await expensive_function(5)
        assert result2 == 10
        assert call_count == 1  # 没有增加
    
    @pytest.mark.asyncio
    async def test_parallel_executor(self):
        """测试并行执行"""
        executor = ParallelExecutor()
        
        async def task(x: int) -> int:
            await asyncio.sleep(0.1)
            return x * 2
        
        # 并行执行
        tasks = [task(i) for i in range(5)]
        results = await executor.execute_parallel(tasks, max_concurrent=3)
        
        assert len(results) == 5
        assert results == [0, 2, 4, 6, 8]
    
    def test_resource_optimizer(self):
        """测试资源优化"""
        optimizer = ResourceOptimizer()
        
        # 优化提示词长度
        long_prompt = "a" * 10000
        optimized = optimizer.optimize_prompt_length(long_prompt, max_length=5000)
        assert len(optimized) <= 5000
        
        # Token估算
        text = "这是一个测试文本，包含中文和English"
        tokens = optimizer.estimate_token_count(text)
        assert tokens > 0
        
        # 成本优化
        result = optimizer.optimize_for_cost(long_prompt, target_cost_reduction=0.3)
        assert result["cost_reduction"] >= 0.25


class TestHumanIntervention:
    """测试人工干预"""
    
    def test_intervention_manager(self):
        """测试干预管理器"""
        manager = HumanInterventionManager()
        
        # 添加干预点
        intervention_id = manager.add_intervention_point(
            "workflow_1",
            "content_generation",
            {"content": "test"},
            "质量检查"
        )
        
        assert intervention_id is not None
        
        # 获取待处理干预
        pending = manager.get_pending_interventions()
        assert len(pending) == 1
        assert pending[0]["status"] == "pending"
        
        # 提交反馈
        manager.submit_user_feedback(
            intervention_id,
            {"approved": True, "comments": "看起来不错"}
        )
        
        # 检查状态更新
        pending = manager.get_pending_interventions()
        assert len(pending) == 0


class TestIntegration:
    """集成测试"""
    
    @pytest.mark.asyncio
    async def test_workflow_with_error_handling(self):
        """测试带错误处理的工作流"""
        checkpoint_manager = CheckpointManager()
        
        # 模拟工作流
        workflow_id = "test_workflow"
        
        # 阶段1：保存检查点
        checkpoint_manager.save_checkpoint(
            workflow_id,
            "analysis",
            {"result": "analysis_complete"}
        )
        
        # 阶段2：模拟失败和恢复
        try:
            raise ValueError("Simulated error")
        except ValueError:
            # 回滚到检查点
            recovered_data = checkpoint_manager.rollback_to_checkpoint(
                workflow_id,
                "analysis"
            )
            assert recovered_data["result"] == "analysis_complete"
    
    def test_quality_control_with_monitoring(self):
        """测试质量控制和监控集成"""
        checker = ContentQualityChecker()
        collector = MetricsCollector()
        monitor = PerformanceMonitor(collector)
        
        # 检查内容质量
        content = {
            "technical": "系统架构设计采用微服务技术方案" * 10,
            "commercial": "商务方案包含定价策略和付款条款" * 10
        }
        
        quality_checks = checker.comprehensive_check(
            content,
            required_sections=["technical", "commercial"]
        )
        
        # 记录质量分数
        score = QualityScorer.calculate_quality_score(content, quality_checks)
        monitor.record_content_quality("proposal", score)
        
        # 验证监控数据
        stats = collector.get_metric_stats("content_quality_score")
        assert stats["count"] > 0
        assert stats["latest"] == score


# 运行测试的辅助函数
def run_tests():
    """运行所有测试"""
    pytest.main([__file__, "-v", "--tb=short"])


if __name__ == "__main__":
    run_tests()
