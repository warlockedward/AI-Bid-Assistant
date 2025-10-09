"""
Enhanced system monitoring service with alerting and performance tracking
"""

import asyncio
import psutil
import time
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from .metrics import metrics_collector, SystemMetrics, AgentMetrics
from .logger import logger

class SystemMonitor:
    def __init__(self, collection_interval: int = 60):
        self.collection_interval = collection_interval
        self.running = False
        self.active_agents = set()
        self.active_tenants = set()
        self.agent_performance = {}  # Track agent performance metrics
        self.alert_thresholds = {
            "cpu_usage": 80.0,
            "memory_usage": 85.0,
            "disk_usage": 90.0,
            "error_rate": 10.0,
            "response_time": 5000.0  # 5 seconds
        }
        self.frontend_url = "http://localhost:3000"  # Should be configurable

    async def start_monitoring(self):
        """Start the system monitoring loop"""
        self.running = True
        logger.info("Starting system monitoring", {
            "component": "system-monitor",
            "interval": self.collection_interval
        })
        
        while self.running:
            try:
                await self.collect_system_metrics()
                await asyncio.sleep(self.collection_interval)
            except Exception as error:
                logger.error("Error collecting system metrics", {
                    "component": "system-monitor"
                }, error)
                await asyncio.sleep(self.collection_interval)

    def stop_monitoring(self):
        """Stop the system monitoring"""
        self.running = False
        logger.info("Stopping system monitoring", {
            "component": "system-monitor"
        })

    async def collect_system_metrics(self):
        """Collect and record system metrics"""
        try:
            # Get CPU usage
            cpu_usage = psutil.cpu_percent(interval=1)
            
            # Get memory usage
            memory = psutil.virtual_memory()
            memory_usage = memory.used
            
            # Calculate error rate from recent metrics
            error_rate = self._calculate_error_rate()
            
            # Get average response time
            response_time = self._calculate_avg_response_time()
            
            # Record system metrics
            system_metrics = SystemMetrics(
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                active_agents=len(self.active_agents),
                active_tenants=len(self.active_tenants),
                error_rate=error_rate,
                response_time=response_time
            )
            
            metrics_collector.record_system_metrics(system_metrics)
            
            # Check for alerts
            await self._check_system_alerts(system_metrics)
            
            # Send metrics to frontend if configured
            await self._send_metrics_to_frontend(system_metrics)
            
            logger.debug("System metrics collected", {
                "component": "system-monitor",
                "cpu_usage": cpu_usage,
                "memory_usage_mb": memory_usage / 1024 / 1024,
                "active_agents": len(self.active_agents),
                "active_tenants": len(self.active_tenants),
                "error_rate": error_rate
            })
            
        except Exception as error:
            logger.error("Failed to collect system metrics", {
                "component": "system-monitor"
            }, error)

    def register_agent_activity(self, agent_id: str, tenant_id: str):
        """Register agent activity"""
        self.active_agents.add(agent_id)
        self.active_tenants.add(tenant_id)
        
        # Initialize performance tracking for new agents
        if agent_id not in self.agent_performance:
            self.agent_performance[agent_id] = {
                "total_operations": 0,
                "successful_operations": 0,
                "failed_operations": 0,
                "total_duration": 0.0,
                "last_activity": datetime.utcnow(),
                "tenant_id": tenant_id
            }

    def unregister_agent_activity(self, agent_id: str, tenant_id: str):
        """Unregister agent activity"""
        self.active_agents.discard(agent_id)
        # Keep tenant active if other agents are still active for this tenant
        if not any(aid.endswith(f"_{tenant_id}") for aid in self.active_agents):
            self.active_tenants.discard(tenant_id)
    
    def record_agent_operation(self, agent_id: str, operation: str, duration: float, success: bool, tenant_id: str):
        """Record agent operation metrics"""
        if agent_id not in self.agent_performance:
            self.agent_performance[agent_id] = {
                "total_operations": 0,
                "successful_operations": 0,
                "failed_operations": 0,
                "total_duration": 0.0,
                "last_activity": datetime.utcnow(),
                "tenant_id": tenant_id
            }
        
        perf = self.agent_performance[agent_id]
        perf["total_operations"] += 1
        perf["total_duration"] += duration
        perf["last_activity"] = datetime.utcnow()
        
        if success:
            perf["successful_operations"] += 1
        else:
            perf["failed_operations"] += 1
        
        # Record metrics
        agent_metrics = AgentMetrics(
            agent_id=agent_id,
            agent_type=agent_id.split("-")[0] if "-" in agent_id else agent_id,
            tenant_id=tenant_id,
            workflow_id=None,  # Could be enhanced to track workflow
            operation=operation,
            duration=duration,
            status="success" if success else "error"
        )
        
        metrics_collector.record_agent_operation(agent_metrics)
        
        logger.info("Agent operation recorded", {
            "component": "system-monitor",
            "agent_id": agent_id,
            "operation": operation,
            "duration": duration,
            "success": success,
            "tenant_id": tenant_id
        })

    def _calculate_error_rate(self) -> float:
        """Calculate error rate from recent metrics"""
        try:
            from datetime import datetime, timedelta
            
            # Get metrics from last 5 minutes
            five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
            recent_metrics = metrics_collector.get_metrics(since=five_minutes_ago)
            
            if not recent_metrics:
                return 0.0
            
            error_metrics = [m for m in recent_metrics 
                           if "error" in m["name"] or m["tags"].get("status") == "error"]
            
            return (len(error_metrics) / len(recent_metrics)) * 100
            
        except Exception:
            return 0.0

    def _calculate_avg_response_time(self) -> float:
        """Calculate average response time from recent metrics"""
        try:
            from datetime import datetime, timedelta
            
            # Get duration metrics from last 5 minutes
            five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
            duration_metrics = metrics_collector.get_metrics(
                name="agent.duration",
                since=five_minutes_ago
            )
            
            if not duration_metrics:
                return 0.0
            
            total_time = sum(m["value"] for m in duration_metrics)
            return total_time / len(duration_metrics)
            
        except Exception:
            return 0.0

    def get_system_status(self) -> Dict[str, Any]:
        """Get current system status"""
        try:
            cpu_usage = psutil.cpu_percent()
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                "cpu": {
                    "usage_percent": cpu_usage,
                    "count": psutil.cpu_count()
                },
                "memory": {
                    "total": memory.total,
                    "available": memory.available,
                    "used": memory.used,
                    "percent": memory.percent
                },
                "disk": {
                    "total": disk.total,
                    "used": disk.used,
                    "free": disk.free,
                    "percent": (disk.used / disk.total) * 100
                },
                "agents": {
                    "active_count": len(self.active_agents),
                    "active_agents": list(self.active_agents)
                },
                "tenants": {
                    "active_count": len(self.active_tenants),
                    "active_tenants": list(self.active_tenants)
                }
            }
            
        except Exception as error:
            logger.error("Failed to get system status", {
                "component": "system-monitor"
            }, error)
            return {}
    
    async def _check_system_alerts(self, metrics: SystemMetrics):
        """Check system metrics against alert thresholds"""
        alerts = []
        
        # CPU usage alert
        if metrics.cpu_usage and metrics.cpu_usage > self.alert_thresholds["cpu_usage"]:
            alerts.append({
                "type": "high_cpu_usage",
                "severity": "high",
                "message": f"CPU usage is {metrics.cpu_usage:.1f}%",
                "value": metrics.cpu_usage,
                "threshold": self.alert_thresholds["cpu_usage"]
            })
        
        # Memory usage alert
        if metrics.memory_usage:
            memory_percent = (metrics.memory_usage / psutil.virtual_memory().total) * 100
            if memory_percent > self.alert_thresholds["memory_usage"]:
                alerts.append({
                    "type": "high_memory_usage",
                    "severity": "high",
                    "message": f"Memory usage is {memory_percent:.1f}%",
                    "value": memory_percent,
                    "threshold": self.alert_thresholds["memory_usage"]
                })
        
        # Error rate alert
        if metrics.error_rate > self.alert_thresholds["error_rate"]:
            alerts.append({
                "type": "high_error_rate",
                "severity": "medium",
                "message": f"Error rate is {metrics.error_rate:.1f}%",
                "value": metrics.error_rate,
                "threshold": self.alert_thresholds["error_rate"]
            })
        
        # Response time alert
        if metrics.response_time > self.alert_thresholds["response_time"]:
            alerts.append({
                "type": "slow_response_time",
                "severity": "medium",
                "message": f"Average response time is {metrics.response_time:.0f}ms",
                "value": metrics.response_time,
                "threshold": self.alert_thresholds["response_time"]
            })
        
        # Send alerts if any
        for alert in alerts:
            await self._send_alert(alert)
    
    async def _send_alert(self, alert: Dict[str, Any]):
        """Send alert to frontend and log"""
        logger.warn(f"System alert: {alert['message']}", {
            "component": "system-monitor",
            "alert_type": alert["type"],
            "severity": alert["severity"],
            "value": alert["value"],
            "threshold": alert["threshold"]
        })
        
        # Try to send to frontend alerting system
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.frontend_url}/api/monitoring/alerts",
                    json={
                        "source": "python-backend",
                        "alert": alert,
                        "timestamp": datetime.utcnow().isoformat()
                    },
                    timeout=5.0
                )
        except Exception as e:
            logger.debug("Failed to send alert to frontend", {
                "component": "system-monitor",
                "error": str(e)
            })
    
    async def _send_metrics_to_frontend(self, metrics: SystemMetrics):
        """Send metrics to frontend for real-time monitoring"""
        try:
            metrics_data = {
                "source": "python-backend",
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": {
                    "cpu_usage": metrics.cpu_usage,
                    "memory_usage": metrics.memory_usage,
                    "active_agents": metrics.active_agents,
                    "active_tenants": metrics.active_tenants,
                    "error_rate": metrics.error_rate,
                    "response_time": metrics.response_time
                },
                "agent_performance": {
                    agent_id: {
                        "total_operations": perf["total_operations"],
                        "success_rate": (perf["successful_operations"] / perf["total_operations"] * 100) if perf["total_operations"] > 0 else 0,
                        "avg_duration": (perf["total_duration"] / perf["total_operations"]) if perf["total_operations"] > 0 else 0,
                        "last_activity": perf["last_activity"].isoformat()
                    }
                    for agent_id, perf in self.agent_performance.items()
                }
            }
            
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.frontend_url}/api/monitoring/metrics",
                    json=metrics_data,
                    timeout=5.0
                )
                
        except Exception as e:
            logger.debug("Failed to send metrics to frontend", {
                "component": "system-monitor",
                "error": str(e)
            })
    
    def get_agent_performance_report(self) -> Dict[str, Any]:
        """Get detailed agent performance report"""
        report = {
            "total_agents": len(self.agent_performance),
            "active_agents": len(self.active_agents),
            "agents": {}
        }
        
        for agent_id, perf in self.agent_performance.items():
            success_rate = (perf["successful_operations"] / perf["total_operations"] * 100) if perf["total_operations"] > 0 else 0
            avg_duration = (perf["total_duration"] / perf["total_operations"]) if perf["total_operations"] > 0 else 0
            
            report["agents"][agent_id] = {
                "total_operations": perf["total_operations"],
                "successful_operations": perf["successful_operations"],
                "failed_operations": perf["failed_operations"],
                "success_rate": success_rate,
                "average_duration": avg_duration,
                "last_activity": perf["last_activity"].isoformat(),
                "tenant_id": perf["tenant_id"],
                "is_active": agent_id in self.active_agents
            }
        
        return report
    
    def cleanup_inactive_agents(self, max_age_hours: int = 24):
        """Clean up performance data for agents inactive for more than max_age_hours"""
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        
        inactive_agents = [
            agent_id for agent_id, perf in self.agent_performance.items()
            if perf["last_activity"] < cutoff_time and agent_id not in self.active_agents
        ]
        
        for agent_id in inactive_agents:
            del self.agent_performance[agent_id]
        
        if inactive_agents:
            logger.info("Cleaned up inactive agent performance data", {
                "component": "system-monitor",
                "cleaned_agents": len(inactive_agents),
                "remaining_agents": len(self.agent_performance)
            })

# Global system monitor instance
system_monitor = SystemMonitor()