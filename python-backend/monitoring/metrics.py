"""
Metrics collection system for Python backend
"""

import time
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
from .logger import logger

@dataclass
class MetricData:
    name: str
    value: float
    unit: str
    timestamp: str
    tags: Dict[str, str]

@dataclass
class AgentMetrics:
    agent_id: str
    agent_type: str
    tenant_id: str
    workflow_id: Optional[str]
    operation: str
    duration: float
    status: str  # 'success', 'error', 'timeout'
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    rag_queries: Optional[int] = None

@dataclass
class SystemMetrics:
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    active_agents: int = 0
    active_tenants: int = 0
    error_rate: float = 0.0
    response_time: float = 0.0

class MetricsCollector:
    def __init__(self, max_metrics: int = 10000):
        self.metrics: deque = deque(maxlen=max_metrics)
        self.max_metrics = max_metrics

    def _create_metric(
        self,
        name: str,
        value: float,
        unit: str,
        tags: Optional[Dict[str, str]] = None
    ) -> MetricData:
        return MetricData(
            name=name,
            value=value,
            unit=unit,
            timestamp=datetime.utcnow().isoformat(),
            tags=tags or {}
        )

    def _add_metric(self, metric: MetricData) -> None:
        self.metrics.append(metric)
        
        # Log metric for external collection
        logger.info("Metric collected", {
            "component": "metrics",
            "metadata": asdict(metric)
        })

    def record_agent_operation(self, metrics: AgentMetrics) -> None:
        """Record metrics for agent operations"""
        tags = {
            "agent_id": metrics.agent_id,
            "agent_type": metrics.agent_type,
            "tenant_id": metrics.tenant_id,
            "operation": metrics.operation,
            "status": metrics.status
        }

        if metrics.workflow_id:
            tags["workflow_id"] = metrics.workflow_id

        # Record operation count
        self._add_metric(self._create_metric(
            "agent.operation",
            1,
            "count",
            tags
        ))

        # Record duration
        self._add_metric(self._create_metric(
            "agent.duration",
            metrics.duration,
            "milliseconds",
            tags
        ))

        # Record token usage if available
        if metrics.input_tokens is not None:
            self._add_metric(self._create_metric(
                "agent.tokens.input",
                metrics.input_tokens,
                "count",
                tags
            ))

        if metrics.output_tokens is not None:
            self._add_metric(self._create_metric(
                "agent.tokens.output",
                metrics.output_tokens,
                "count",
                tags
            ))

        if metrics.rag_queries is not None:
            self._add_metric(self._create_metric(
                "agent.rag.queries",
                metrics.rag_queries,
                "count",
                tags
            ))

    def record_system_metrics(self, metrics: SystemMetrics) -> None:
        """Record system-level metrics"""
        tags = {"component": "system"}

        if metrics.cpu_usage is not None:
            self._add_metric(self._create_metric(
                "system.cpu.usage",
                metrics.cpu_usage,
                "percent",
                tags
            ))

        if metrics.memory_usage is not None:
            self._add_metric(self._create_metric(
                "system.memory.usage",
                metrics.memory_usage,
                "bytes",
                tags
            ))

        self._add_metric(self._create_metric(
            "system.agents.active",
            metrics.active_agents,
            "count",
            tags
        ))

        self._add_metric(self._create_metric(
            "system.tenants.active",
            metrics.active_tenants,
            "count",
            tags
        ))

        self._add_metric(self._create_metric(
            "system.error.rate",
            metrics.error_rate,
            "percent",
            tags
        ))

        self._add_metric(self._create_metric(
            "system.response.time",
            metrics.response_time,
            "milliseconds",
            tags
        ))

    def record_custom_metric(
        self,
        name: str,
        value: float,
        unit: str,
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Record a custom metric"""
        self._add_metric(self._create_metric(name, value, unit, tags))

    def get_metrics(
        self,
        name: Optional[str] = None,
        tenant_id: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Get metrics with optional filtering"""
        filtered_metrics = list(self.metrics)

        if name:
            filtered_metrics = [m for m in filtered_metrics if m.name == name]

        if tenant_id:
            filtered_metrics = [m for m in filtered_metrics if m.tags.get("tenant_id") == tenant_id]

        if since:
            since_str = since.isoformat()
            filtered_metrics = [m for m in filtered_metrics if m.timestamp >= since_str]

        # Convert to dict and limit results
        result = [asdict(m) for m in filtered_metrics[-limit:]]
        return result

    def get_aggregated_metrics(
        self,
        name: str,
        aggregation: str,  # 'sum', 'avg', 'min', 'max', 'count'
        group_by: Optional[str] = None,
        since: Optional[datetime] = None
    ) -> Dict[str, float]:
        """Get aggregated metrics"""
        metrics = self.get_metrics(name, since=since)
        
        if not group_by:
            values = [m["value"] for m in metrics]
            if not values:
                return {}
                
            if aggregation == "sum":
                return {"total": sum(values)}
            elif aggregation == "avg":
                return {"average": sum(values) / len(values)}
            elif aggregation == "min":
                return {"minimum": min(values)}
            elif aggregation == "max":
                return {"maximum": max(values)}
            elif aggregation == "count":
                return {"count": len(values)}
            else:
                return {}

        # Group by specified tag
        grouped = defaultdict(list)
        for metric in metrics:
            key = metric["tags"].get(group_by, "unknown")
            grouped[key].append(metric["value"])

        result = {}
        for key, values in grouped.items():
            if aggregation == "sum":
                result[key] = sum(values)
            elif aggregation == "avg":
                result[key] = sum(values) / len(values)
            elif aggregation == "min":
                result[key] = min(values)
            elif aggregation == "max":
                result[key] = max(values)
            elif aggregation == "count":
                result[key] = len(values)

        return result

    def get_health_metrics(self) -> Dict[str, Any]:
        """Get health check metrics"""
        now = datetime.utcnow()
        five_minutes_ago = datetime.fromtimestamp(now.timestamp() - 5 * 60)
        
        recent_metrics = self.get_metrics(since=five_minutes_ago)
        error_metrics = [m for m in recent_metrics 
                        if "error" in m["name"] or m["tags"].get("status") == "error"]
        
        error_rate = (len(error_metrics) / len(recent_metrics) * 100) if recent_metrics else 0

        checks = {
            "metrics_collecting": len(recent_metrics) > 0,
            "low_error_rate": error_rate < 5,
            "system_responsive": True  # Could add more sophisticated checks
        }

        all_healthy = all(checks.values())
        status = "healthy" if all_healthy else ("unhealthy" if error_rate > 20 else "degraded")

        return {
            "status": status,
            "checks": checks,
            "metrics": {
                "error_rate": error_rate,
                "total_metrics": len(self.metrics),
                "recent_metrics": len(recent_metrics)
            }
        }

# Global metrics collector instance
metrics_collector = MetricsCollector()