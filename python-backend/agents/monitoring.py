"""
监控和指标收集
实现智能体性能监控、指标收集和告警
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import time

logger = logging.getLogger(__name__)


class MetricsCollector:
    """指标收集器"""
    
    def __init__(self):
        self.metrics: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.counters: Dict[str, int] = defaultdict(int)
        self.gauges: Dict[str, float] = {}
    
    def record_metric(
        self,
        metric_name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None
    ):
        """记录指标"""
        metric_entry = {
            "timestamp": datetime.now().isoformat(),
            "value": value,
            "tags": tags or {}
        }
        self.metrics[metric_name].append(metric_entry)
        
        # 保持最近1000条记录
        if len(self.metrics[metric_name]) > 1000:
            self.metrics[metric_name] = self.metrics[metric_name][-1000:]
    
    def increment_counter(self, counter_name: str, value: int = 1):
        """增加计数器"""
        self.counters[counter_name] += value
    
    def set_gauge(self, gauge_name: str, value: float):
        """设置仪表值"""
        self.gauges[gauge_name] = value
    
    def get_metric_stats(
        self,
        metric_name: str,
        time_window: Optional[timedelta] = None
    ) -> Dict[str, Any]:
        """获取指标统计"""
        if metric_name not in self.metrics:
            return {}
        
        metrics = self.metrics[metric_name]
        
        # 时间窗口过滤
        if time_window:
            cutoff_time = datetime.now() - time_window
            metrics = [
                m for m in metrics
                if datetime.fromisoformat(m["timestamp"]) > cutoff_time
            ]
        
        if not metrics:
            return {}
        
        values = [m["value"] for m in metrics]
        
        return {
            "count": len(values),
            "min": min(values),
            "max": max(values),
            "avg": sum(values) / len(values),
            "latest": values[-1] if values else None
        }
    
    def get_counter_value(self, counter_name: str) -> int:
        """获取计数器值"""
        return self.counters.get(counter_name, 0)
    
    def get_gauge_value(self, gauge_name: str) -> Optional[float]:
        """获取仪表值"""
        return self.gauges.get(gauge_name)
    
    def reset_counter(self, counter_name: str):
        """重置计数器"""
        self.counters[counter_name] = 0
    
    def get_all_metrics_summary(self) -> Dict[str, Any]:
        """获取所有指标摘要"""
        return {
            "metrics": {
                name: self.get_metric_stats(name, timedelta(hours=1))
                for name in self.metrics.keys()
            },
            "counters": dict(self.counters),
            "gauges": dict(self.gauges)
        }


class PerformanceMonitor:
    """性能监控器"""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
        self.active_operations: Dict[str, float] = {}
    
    def start_operation(self, operation_id: str):
        """开始操作计时"""
        self.active_operations[operation_id] = time.time()
    
    def end_operation(
        self,
        operation_id: str,
        operation_type: str,
        success: bool = True
    ):
        """结束操作计时"""
        if operation_id in self.active_operations:
            start_time = self.active_operations[operation_id]
            duration = time.time() - start_time
            
            # 记录执行时间
            self.metrics_collector.record_metric(
                f"{operation_type}_duration",
                duration,
                {"success": str(success)}
            )
            
            # 更新计数器
            counter_name = f"{operation_type}_{'success' if success else 'failure'}"
            self.metrics_collector.increment_counter(counter_name)
            
            del self.active_operations[operation_id]
            
            logger.info(
                f"Operation {operation_type} completed in {duration:.2f}s "
                f"(success={success})"
            )
    
    def record_llm_call(
        self,
        agent_name: str,
        duration: float,
        success: bool,
        token_count: Optional[int] = None
    ):
        """记录LLM调用"""
        self.metrics_collector.record_metric(
            "llm_call_duration",
            duration,
            {"agent": agent_name, "success": str(success)}
        )
        
        counter_name = f"llm_calls_{agent_name}_{'success' if success else 'failure'}"
        self.metrics_collector.increment_counter(counter_name)
        
        if token_count:
            self.metrics_collector.record_metric(
                "llm_token_usage",
                token_count,
                {"agent": agent_name}
            )
    
    def record_content_quality(
        self,
        content_type: str,
        quality_score: float
    ):
        """记录内容质量"""
        self.metrics_collector.record_metric(
            "content_quality_score",
            quality_score,
            {"type": content_type}
        )
    
    def record_workflow_completion(
        self,
        workflow_type: str,
        duration: float,
        success: bool,
        iterations: int = 1
    ):
        """记录工作流完成"""
        self.metrics_collector.record_metric(
            "workflow_duration",
            duration,
            {"type": workflow_type, "success": str(success)}
        )
        
        self.metrics_collector.record_metric(
            "workflow_iterations",
            iterations,
            {"type": workflow_type}
        )
        
        counter_name = f"workflows_{workflow_type}_{'success' if success else 'failure'}"
        self.metrics_collector.increment_counter(counter_name)
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """获取性能摘要"""
        return {
            "llm_calls": {
                "total": sum(
                    v for k, v in self.metrics_collector.counters.items()
                    if k.startswith("llm_calls_")
                ),
                "success_rate": self._calculate_success_rate("llm_calls"),
                "avg_duration": self.metrics_collector.get_metric_stats(
                    "llm_call_duration",
                    timedelta(hours=1)
                ).get("avg", 0)
            },
            "workflows": {
                "total": sum(
                    v for k, v in self.metrics_collector.counters.items()
                    if k.startswith("workflows_")
                ),
                "success_rate": self._calculate_success_rate("workflows"),
                "avg_duration": self.metrics_collector.get_metric_stats(
                    "workflow_duration",
                    timedelta(hours=1)
                ).get("avg", 0)
            },
            "content_quality": {
                "avg_score": self.metrics_collector.get_metric_stats(
                    "content_quality_score",
                    timedelta(hours=1)
                ).get("avg", 0)
            }
        }
    
    def _calculate_success_rate(self, operation_prefix: str) -> float:
        """计算成功率"""
        success_count = sum(
            v for k, v in self.metrics_collector.counters.items()
            if k.startswith(f"{operation_prefix}_") and k.endswith("_success")
        )
        failure_count = sum(
            v for k, v in self.metrics_collector.counters.items()
            if k.startswith(f"{operation_prefix}_") and k.endswith("_failure")
        )
        
        total = success_count + failure_count
        return success_count / total if total > 0 else 0.0


class AlertManager:
    """告警管理器"""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
        self.alert_rules: List[Dict[str, Any]] = []
        self.active_alerts: List[Dict[str, Any]] = []
        self.alert_history: List[Dict[str, Any]] = []
    
    def add_alert_rule(
        self,
        rule_name: str,
        metric_name: str,
        condition: str,
        threshold: float,
        severity: str = "warning"
    ):
        """添加告警规则"""
        rule = {
            "name": rule_name,
            "metric_name": metric_name,
            "condition": condition,  # "gt", "lt", "eq"
            "threshold": threshold,
            "severity": severity,
            "enabled": True
        }
        self.alert_rules.append(rule)
        logger.info(f"Alert rule added: {rule_name}")
    
    def check_alerts(self):
        """检查告警"""
        for rule in self.alert_rules:
            if not rule["enabled"]:
                continue
            
            # 获取指标值
            metric_stats = self.metrics_collector.get_metric_stats(
                rule["metric_name"],
                timedelta(minutes=5)
            )
            
            if not metric_stats:
                continue
            
            current_value = metric_stats.get("avg", 0)
            
            # 检查条件
            triggered = False
            if rule["condition"] == "gt" and current_value > rule["threshold"]:
                triggered = True
            elif rule["condition"] == "lt" and current_value < rule["threshold"]:
                triggered = True
            elif rule["condition"] == "eq" and current_value == rule["threshold"]:
                triggered = True
            
            if triggered:
                self._trigger_alert(rule, current_value)
    
    def _trigger_alert(self, rule: Dict[str, Any], current_value: float):
        """触发告警"""
        alert = {
            "rule_name": rule["name"],
            "metric_name": rule["metric_name"],
            "severity": rule["severity"],
            "current_value": current_value,
            "threshold": rule["threshold"],
            "timestamp": datetime.now().isoformat(),
            "status": "active"
        }
        
        # 检查是否已经存在相同的活跃告警
        existing = next(
            (a for a in self.active_alerts if a["rule_name"] == rule["name"]),
            None
        )
        
        if not existing:
            self.active_alerts.append(alert)
            self.alert_history.append(alert)
            logger.warning(
                f"Alert triggered: {rule['name']} - "
                f"{current_value} {rule['condition']} {rule['threshold']}"
            )
    
    def resolve_alert(self, rule_name: str):
        """解决告警"""
        self.active_alerts = [
            a for a in self.active_alerts
            if a["rule_name"] != rule_name
        ]
        logger.info(f"Alert resolved: {rule_name}")
    
    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """获取活跃告警"""
        return self.active_alerts
    
    def get_alert_history(
        self,
        time_window: Optional[timedelta] = None
    ) -> List[Dict[str, Any]]:
        """获取告警历史"""
        if not time_window:
            return self.alert_history
        
        cutoff_time = datetime.now() - time_window
        return [
            a for a in self.alert_history
            if datetime.fromisoformat(a["timestamp"]) > cutoff_time
        ]


# 全局实例
metrics_collector = MetricsCollector()
performance_monitor = PerformanceMonitor(metrics_collector)
alert_manager = AlertManager(metrics_collector)

# 配置默认告警规则
alert_manager.add_alert_rule(
    "llm_call_failure_rate_high",
    "llm_call_duration",
    "lt",
    0.8,  # 成功率低于80%
    "critical"
)

alert_manager.add_alert_rule(
    "workflow_duration_high",
    "workflow_duration",
    "gt",
    300.0,  # 超过5分钟
    "warning"
)

alert_manager.add_alert_rule(
    "content_quality_low",
    "content_quality_score",
    "lt",
    0.7,  # 质量分数低于0.7
    "warning"
)
