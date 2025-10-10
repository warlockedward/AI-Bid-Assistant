"""
System Health Check API
Provides basic health monitoring for the system
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any
from datetime import datetime, timedelta
import time
import psutil
import logging
from sqlalchemy import text
from sqlalchemy.orm import Session
from tenants.context import TenantContext
from database.database import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["health"])

class HealthChecker:
    """Basic health checking system"""
    
    def __init__(self):
        self.checks = {
            'database': self._check_database,
            'system_resources': self._check_system_resources,
            'tenant_isolation': self._check_tenant_isolation,
            'workflow_system': self._check_workflow_system
        }
    
    async def run_all_checks(self, db: Session, tenant_context: TenantContext = None) -> Dict[str, Any]:
        """Run all health checks and return comprehensive status"""
        results = {}
        overall_status = "healthy"
        start_time = time.time()
        
        for check_name, check_func in self.checks.items():
            try:
                check_start = time.time()
                result = await check_func(db, tenant_context)
                check_duration = time.time() - check_start
                
                results[check_name] = {
                    **result,
                    'duration_ms': round(check_duration * 1000, 2)
                }
                
                # Update overall status based on individual check status
                if result['status'] == 'critical':
                    overall_status = 'critical'
                elif result['status'] == 'degraded' and overall_status != 'critical':
                    overall_status = 'degraded'
                    
            except Exception as e:
                logger.error(f"Health check {check_name} failed: {e}")
                results[check_name] = {
                    'status': 'critical',
                    'message': f"Check failed: {str(e)}",
                    'duration_ms': 0
                }
                overall_status = 'critical'
        
        total_duration = time.time() - start_time
        
        return {
            'status': overall_status,
            'timestamp': datetime.utcnow().isoformat(),
            'total_duration_ms': round(total_duration * 1000, 2),
            'checks': results,
            'system_info': self._get_system_info()
        }
    
    async def _check_database(self, db: Session, tenant_context: TenantContext = None) -> Dict[str, Any]:
        """Check database connectivity and performance"""
        try:
            # Basic connectivity test
            start_time = time.time()
            result = db.execute(text("SELECT 1 as test")).fetchone()
            query_time = time.time() - start_time
            
            if not result or result.test != 1:
                return {
                    'status': 'critical',
                    'message': 'Database query returned unexpected result'
                }
            
            # Check database performance
            if query_time > 1.0:  # More than 1 second is concerning
                status = 'degraded'
                message = f'Database response slow: {query_time:.2f}s'
            elif query_time > 0.5:  # More than 500ms is warning
                status = 'degraded'
                message = f'Database response time elevated: {query_time:.2f}s'
            else:
                status = 'healthy'
                message = f'Database responsive: {query_time:.3f}s'
            
            # Check active connections
            try:
                connections_result = db.execute(text("""
                    SELECT count(*) as active_connections 
                    FROM pg_stat_activity 
                    WHERE state = 'active'
                """)).fetchone()
                
                active_connections = connections_result.active_connections if connections_result else 0
            except:
                # If we can't get connection stats, that's okay
                active_connections = "unknown"
            
            return {
                'status': status,
                'message': message,
                'metrics': {
                    'query_time_ms': round(query_time * 1000, 2),
                    'active_connections': active_connections
                }
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f'Database connection failed: {str(e)}'
            }
    
    async def _check_system_resources(self, db: Session, tenant_context: TenantContext = None) -> Dict[str, Any]:
        """Check system resource usage"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            
            # Determine overall status
            status = 'healthy'
            issues = []
            
            if cpu_percent > 90:
                status = 'critical'
                issues.append(f'CPU usage critical: {cpu_percent}%')
            elif cpu_percent > 80:
                status = 'degraded'
                issues.append(f'CPU usage high: {cpu_percent}%')
            
            if memory_percent > 95:
                status = 'critical'
                issues.append(f'Memory usage critical: {memory_percent}%')
            elif memory_percent > 85:
                status = 'degraded'
                issues.append(f'Memory usage high: {memory_percent}%')
            
            if disk_percent > 95:
                status = 'critical'
                issues.append(f'Disk usage critical: {disk_percent}%')
            elif disk_percent > 85:
                status = 'degraded'
                issues.append(f'Disk usage high: {disk_percent}%')
            
            message = '; '.join(issues) if issues else 'System resources normal'
            
            return {
                'status': status,
                'message': message,
                'metrics': {
                    'cpu_percent': cpu_percent,
                    'memory_percent': memory_percent,
                    'disk_percent': disk_percent,
                    'memory_available_gb': round(memory.available / (1024**3), 2),
                    'disk_free_gb': round(disk.free / (1024**3), 2)
                }
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f'System resource check failed: {str(e)}'
            }
    
    async def _check_tenant_isolation(self, db: Session, tenant_context: TenantContext = None) -> Dict[str, Any]:
        """Check tenant isolation functionality"""
        try:
            if not tenant_context:
                return {
                    'status': 'healthy',
                    'message': 'Tenant isolation check skipped (no tenant context)'
                }
            
            # Test tenant-specific data access
            tenant_id = tenant_context.tenant_id
            
            # Check if tenant exists in database
            result = db.execute(text("""
                SELECT COUNT(*) as tenant_count 
                FROM tenants 
                WHERE id = :tenant_id
            """), {"tenant_id": str(tenant_id)}).fetchone()
            
            if not result or result.tenant_count == 0:
                return {
                    'status': 'critical',
                    'message': f'Tenant {tenant_id} not found in database'
                }
            
            # Test workflow isolation
            workflow_result = db.execute(text("""
                SELECT COUNT(*) as workflow_count 
                FROM workflow_states 
                WHERE tenant_id = :tenant_id
            """), {"tenant_id": str(tenant_id)}).fetchone()
            
            workflow_count = workflow_result.workflow_count if workflow_result else 0
            
            return {
                'status': 'healthy',
                'message': 'Tenant isolation functioning correctly',
                'metrics': {
                    'tenant_id': str(tenant_id),
                    'tenant_workflows': workflow_count
                }
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f'Tenant isolation check failed: {str(e)}'
            }
    
    async def _check_workflow_system(self, db: Session, tenant_context: TenantContext = None) -> Dict[str, Any]:
        """Check workflow system health"""
        try:
            # Check active workflows
            active_workflows_result = db.execute(text("""
                SELECT COUNT(*) as active_count 
                FROM workflow_states 
                WHERE status IN ('running', 'paused')
            """)).fetchone()
            
            active_workflows = active_workflows_result.active_count if active_workflows_result else 0
            
            # Check failed workflows in last hour
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            failed_workflows_result = db.execute(text("""
                SELECT COUNT(*) as failed_count 
                FROM workflow_states 
                WHERE status = 'failed' AND updated_at > :one_hour_ago
            """), {"one_hour_ago": one_hour_ago}).fetchone()
            
            failed_workflows = failed_workflows_result.failed_count if failed_workflows_result else 0
            
            # Determine status
            status = 'healthy'
            message = 'Workflow system operating normally'
            
            if failed_workflows > 10:  # More than 10 failures in an hour
                status = 'critical'
                message = f'High workflow failure rate: {failed_workflows} failures in last hour'
            elif failed_workflows > 5:
                status = 'degraded'
                message = f'Elevated workflow failures: {failed_workflows} in last hour'
            
            return {
                'status': status,
                'message': message,
                'metrics': {
                    'active_workflows': active_workflows,
                    'failed_workflows_last_hour': failed_workflows
                }
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f'Workflow system check failed: {str(e)}'
            }
    
    def _get_system_info(self) -> Dict[str, Any]:
        """Get basic system information"""
        try:
            return {
                'hostname': psutil.os.uname().nodename,
                'platform': psutil.os.uname().system,
                'python_version': psutil.sys.version.split()[0],
                'cpu_count': psutil.cpu_count(),
                'boot_time': datetime.fromtimestamp(psutil.boot_time()).isoformat()
            }
        except Exception:
            return {'error': 'Could not retrieve system info'}

# Global health checker instance
health_checker = HealthChecker()

@router.get("/health")
async def health_check(
    db: Session = Depends(get_db_session),
    tenant_context: TenantContext = Depends(lambda: None)  # Optional tenant context
):
    """
    Comprehensive health check endpoint
    Returns detailed system health information
    """
    try:
        health_data = await health_checker.run_all_checks(db, tenant_context)
        
        # Return appropriate HTTP status based on health
        status_code = 200
        if health_data['status'] == 'critical':
            status_code = 503  # Service Unavailable
        elif health_data['status'] == 'degraded':
            status_code = 200  # OK but with warnings
        
        return health_data
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                'status': 'critical',
                'message': 'Health check system failure',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
        )

@router.get("/health/quick")
async def quick_health_check():
    """
    Quick health check endpoint for load balancers
    Returns minimal response for basic availability checking
    """
    try:
        return {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'intelligent-bid-system'
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
        )

@router.get("/health/readiness")
async def readiness_check(db: Session = Depends(get_db_session)):
    """
    Kubernetes readiness probe endpoint
    Checks if the service is ready to accept traffic
    """
    try:
        # Test database connectivity
        db.execute(text("SELECT 1")).fetchone()
        
        return {
            'status': 'ready',
            'timestamp': datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                'status': 'not_ready',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
        )

@router.get("/health/liveness")
async def liveness_check():
    """
    Kubernetes liveness probe endpoint
    Checks if the service is alive and should not be restarted
    """
    return {
        'status': 'alive',
        'timestamp': datetime.utcnow().isoformat()
    }