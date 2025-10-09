"""
FastAPI endpoints for monitoring and metrics
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pydantic import BaseModel

from monitoring.metrics import metrics_collector
from monitoring.logger import logger
from monitoring.system_monitor import system_monitor

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

class MetricRequest(BaseModel):
    name: str
    value: float
    unit: str
    tags: Optional[Dict[str, str]] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    components: Dict[str, Any]

@router.get("/health", response_model=HealthResponse)
async def get_health():
    """Get system health status"""
    try:
        # Get health metrics from metrics collector
        health_metrics = metrics_collector.get_health_metrics()
        
        # Get system status from system monitor
        system_status = system_monitor.get_system_status()
        
        # Determine overall health status
        overall_status = health_metrics["status"]
        if system_status.get("cpu", {}).get("usage_percent", 0) > 90:
            overall_status = "degraded"
        if system_status.get("memory", {}).get("percent", 0) > 90:
            overall_status = "degraded"
        
        health_data = HealthResponse(
            status=overall_status,
            timestamp=datetime.utcnow().isoformat(),
            components={
                "metrics": health_metrics,
                "system": system_status,
                "python_backend": {
                    "status": "healthy",
                    "active_agents": len(system_monitor.active_agents),
                    "active_tenants": len(system_monitor.active_tenants)
                }
            }
        )
        
        logger.info("Health check performed", {
            "component": "monitoring-api",
            "status": overall_status
        })
        
        return health_data
        
    except Exception as error:
        logger.error("Health check failed", {
            "component": "monitoring-api"
        }, error)
        
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(error)
            }
        )

@router.get("/metrics")
async def get_metrics(
    name: Optional[str] = Query(None, description="Metric name filter"),
    tenant_id: Optional[str] = Query(None, description="Tenant ID filter"),
    since: Optional[str] = Query(None, description="ISO timestamp for filtering"),
    limit: int = Query(1000, description="Maximum number of metrics to return"),
    aggregation: Optional[str] = Query(None, description="Aggregation type: sum, avg, min, max, count"),
    group_by: Optional[str] = Query(None, description="Tag to group by for aggregation")
):
    """Get metrics with optional filtering and aggregation"""
    try:
        since_datetime = None
        if since:
            try:
                since_datetime = datetime.fromisoformat(since.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid since timestamp format")
        
        logger.info("Metrics API request", {
            "component": "monitoring-api",
            "name": name,
            "tenant_id": tenant_id,
            "since": since,
            "limit": limit,
            "aggregation": aggregation,
            "group_by": group_by
        })
        
        if aggregation and name:
            # Return aggregated metrics
            aggregated_metrics = metrics_collector.get_aggregated_metrics(
                name=name,
                aggregation=aggregation,
                group_by=group_by,
                since=since_datetime
            )
            
            return {
                "success": True,
                "data": aggregated_metrics,
                "metadata": {
                    "name": name,
                    "aggregation": aggregation,
                    "group_by": group_by,
                    "since": since,
                    "generated_at": datetime.utcnow().isoformat()
                }
            }
        
        # Return raw metrics
        metrics = metrics_collector.get_metrics(
            name=name,
            tenant_id=tenant_id,
            since=since_datetime,
            limit=limit
        )
        
        return {
            "success": True,
            "data": metrics,
            "metadata": {
                "count": len(metrics),
                "name": name,
                "tenant_id": tenant_id,
                "since": since,
                "limit": limit,
                "generated_at": datetime.utcnow().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Error retrieving metrics", {
            "component": "monitoring-api"
        }, error)
        
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "Failed to retrieve metrics",
                "message": str(error)
            }
        )

@router.post("/metrics")
async def record_metric(metric: MetricRequest):
    """Record a custom metric"""
    try:
        metrics_collector.record_custom_metric(
            name=metric.name,
            value=metric.value,
            unit=metric.unit,
            tags=metric.tags
        )
        
        logger.info("Custom metric recorded", {
            "component": "monitoring-api",
            "name": metric.name,
            "value": metric.value,
            "unit": metric.unit,
            "tags": metric.tags
        })
        
        return {
            "success": True,
            "message": "Metric recorded successfully",
            "data": {
                "name": metric.name,
                "value": metric.value,
                "unit": metric.unit,
                "tags": metric.tags,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as error:
        logger.error("Error recording custom metric", {
            "component": "monitoring-api"
        }, error)
        
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "Failed to record metric",
                "message": str(error)
            }
        )

@router.get("/system/status")
async def get_system_status():
    """Get detailed system status"""
    try:
        status = system_monitor.get_system_status()
        
        return {
            "success": True,
            "data": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as error:
        logger.error("Error getting system status", {
            "component": "monitoring-api"
        }, error)
        
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "Failed to get system status",
                "message": str(error)
            }
        )

@router.post("/agents/{agent_id}/register")
async def register_agent_activity(agent_id: str, tenant_id: str):
    """Register agent activity"""
    try:
        system_monitor.register_agent_activity(agent_id, tenant_id)
        
        logger.info("Agent activity registered", {
            "component": "monitoring-api",
            "agent_id": agent_id,
            "tenant_id": tenant_id
        })
        
        return {
            "success": True,
            "message": "Agent activity registered",
            "agent_id": agent_id,
            "tenant_id": tenant_id
        }
        
    except Exception as error:
        logger.error("Error registering agent activity", {
            "component": "monitoring-api",
            "agent_id": agent_id,
            "tenant_id": tenant_id
        }, error)
        
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "Failed to register agent activity",
                "message": str(error)
            }
        )

@router.post("/agents/{agent_id}/unregister")
async def unregister_agent_activity(agent_id: str, tenant_id: str):
    """Unregister agent activity"""
    try:
        system_monitor.unregister_agent_activity(agent_id, tenant_id)
        
        logger.info("Agent activity unregistered", {
            "component": "monitoring-api",
            "agent_id": agent_id,
            "tenant_id": tenant_id
        })
        
        return {
            "success": True,
            "message": "Agent activity unregistered",
            "agent_id": agent_id,
            "tenant_id": tenant_id
        }
        
    except Exception as error:
        logger.error("Error unregistering agent activity", {
            "component": "monitoring-api",
            "agent_id": agent_id,
            "tenant_id": tenant_id
        }, error)
        
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "Failed to unregister agent activity",
                "message": str(error)
            }
        )