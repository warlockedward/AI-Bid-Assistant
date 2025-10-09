"""
WebSocket synchronization API for real-time workflow updates
Provides endpoints for Python agents to send status updates to the frontend
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import asyncio
from datetime import datetime
import logging

from auth.auth_handler import get_current_tenant, TenantContext
from monitoring.logger import logger as structured_logger
from monitoring.metrics import metrics_collector, AgentMetrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/websocket_sync", tags=["websocket_sync"])

# Configuration
FRONTEND_BASE_URL = "http://localhost:3000"  # Should be configurable

class AgentStatusUpdate(BaseModel):
    agent_id: str
    status: str  # 'idle', 'processing', 'completed', 'error', 'waiting_input'
    progress: int = 0
    message: str = ""
    current_task: Optional[str] = None
    requires_response: bool = False
    response_data: Optional[Dict[str, Any]] = None

class WorkflowStatusUpdate(BaseModel):
    status: str  # 'running', 'paused', 'completed', 'error'
    controls: Dict[str, bool] = {
        "canPause": True,
        "canResume": False,
        "canCancel": True
    }
    progress: Optional[Dict[str, Any]] = None

class WorkflowProgressUpdate(BaseModel):
    total_steps: int
    completed_steps: int
    current_step: str
    progress_percentage: float
    estimated_time_remaining: Optional[int] = None
    step_details: Optional[Dict[str, Any]] = None

class UserResponseRequest(BaseModel):
    workflow_id: str
    agent_id: str
    response: str
    timestamp: Optional[str] = None

class WebSocketSyncService:
    """Service for synchronizing with frontend WebSocket"""
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=10.0)
        self.active_workflows: Dict[str, Dict[str, Any]] = {}
    
    async def send_agent_update(self, workflow_id: str, agent_update: AgentStatusUpdate):
        """Send agent status update to frontend WebSocket"""
        try:
            url = f"{FRONTEND_BASE_URL}/api/workflows/sync/agents/{workflow_id}"
            
            payload = {
                "agents": [{
                    "agent_id": agent_update.agent_id,
                    "status": agent_update.status,
                    "progress": agent_update.progress,
                    "message": agent_update.message,
                    "current_task": agent_update.current_task,
                    "requires_response": agent_update.requires_response,
                    "response_data": agent_update.response_data,
                    "timestamp": datetime.now().isoformat()
                }]
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            # Update local tracking
            if workflow_id not in self.active_workflows:
                self.active_workflows[workflow_id] = {
                    "started_at": datetime.now(),
                    "status": "running",
                    "agents": {}
                }
            
            self.active_workflows[workflow_id]["agents"][agent_update.agent_id] = {
                "status": agent_update.status,
                "progress": agent_update.progress,
                "message": agent_update.message,
                "last_update": datetime.now()
            }
            
            # Log with structured logging
            structured_logger.info("Agent update sent via WebSocket", {
                "component": "websocket_sync",
                "operation": "send_agent_update",
                "workflow_id": workflow_id,
                "agent_id": agent_update.agent_id,
                "status": agent_update.status,
                "progress": agent_update.progress
            })
            
            # Record metrics
            metrics_collector.record_custom_metric(
                "websocket.agent_update.sent",
                1,
                "count",
                {
                    "workflow_id": workflow_id,
                    "agent_id": agent_update.agent_id,
                    "status": agent_update.status
                }
            )
            
        except Exception as e:
            structured_logger.error("Failed to send agent update via WebSocket", {
                "component": "websocket_sync",
                "operation": "send_agent_update",
                "workflow_id": workflow_id,
                "agent_id": agent_update.agent_id
            }, e)
            
            metrics_collector.record_custom_metric(
                "websocket.agent_update.failed",
                1,
                "count",
                {
                    "workflow_id": workflow_id,
                    "agent_id": agent_update.agent_id,
                    "error_type": type(e).__name__
                }
            )
            raise
    
    async def send_workflow_update(self, workflow_id: str, workflow_update: WorkflowStatusUpdate):
        """Send workflow status update to frontend WebSocket"""
        try:
            url = f"{FRONTEND_BASE_URL}/api/workflows/sync/status/{workflow_id}"
            
            payload = {
                "status": workflow_update.status,
                "controls": workflow_update.controls,
                "progress": workflow_update.progress
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            logger.info(f"Sent workflow update for workflow {workflow_id}: {workflow_update.status}")
            
        except Exception as e:
            logger.error(f"Failed to send workflow update: {e}")
    
    async def send_progress_update(self, workflow_id: str, progress_update: WorkflowProgressUpdate):
        """Send workflow progress update to frontend WebSocket"""
        try:
            url = f"{FRONTEND_BASE_URL}/api/workflows/sync/progress/{workflow_id}"
            
            payload = {
                "total_steps": progress_update.total_steps,
                "completed_steps": progress_update.completed_steps,
                "current_step": progress_update.current_step,
                "progress_percentage": progress_update.progress_percentage,
                "estimated_time_remaining": progress_update.estimated_time_remaining,
                "step_details": progress_update.step_details
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            logger.info(f"Sent progress update for workflow {workflow_id}: {progress_update.progress_percentage}%")
            
        except Exception as e:
            logger.error(f"Failed to send progress update: {e}")
    
    async def get_user_response(self, workflow_id: str, agent_id: str, timeout: int = 60) -> Optional[str]:
        """Wait for user response from frontend (polling implementation with exponential backoff)"""
        try:
            start_time = datetime.now()
            poll_interval = 1  # Start with 1 second
            max_poll_interval = 5  # Max 5 seconds between polls
            
            while (datetime.now() - start_time).seconds < timeout:
                # Check if response is available via API
                url = f"{FRONTEND_BASE_URL}/api/workflows/sync/user-response/{workflow_id}/{agent_id}"
                
                try:
                    response = await self.client.get(url)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success") and data.get("response"):
                            logger.info(f"Received user response for {workflow_id}/{agent_id}: {data['response']}")
                            return data["response"]
                    elif response.status_code == 404:
                        # Response not available yet, continue polling
                        pass
                    else:
                        logger.warning(f"Unexpected response status {response.status_code} when checking for user response")
                        
                except Exception as e:
                    # Network error or other issue, continue polling
                    logger.debug(f"Error checking for user response (will retry): {e}")
                
                # Wait before next poll with exponential backoff
                await asyncio.sleep(poll_interval)
                poll_interval = min(poll_interval * 1.5, max_poll_interval)
                
            logger.warning(f"Timeout waiting for user response: {workflow_id}/{agent_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error waiting for user response: {e}")
            return None
    
    def register_workflow(self, workflow_id: str, workflow_data: Dict[str, Any]):
        """Register a workflow for monitoring"""
        self.active_workflows[workflow_id] = {
            "started_at": datetime.now(),
            "status": "running",
            "agents": {},
            **workflow_data
        }
    
    def unregister_workflow(self, workflow_id: str):
        """Unregister a workflow from monitoring"""
        if workflow_id in self.active_workflows:
            del self.active_workflows[workflow_id]
    
    async def validate_tenant_workflow_access(self, workflow_id: str, tenant_id: str) -> bool:
        """Validate that a tenant has access to a workflow"""
        try:
            # Check if workflow exists in our tracking
            workflow_data = self.active_workflows.get(workflow_id)
            if not workflow_data:
                # If not in our tracking, check with frontend WebSocket manager
                url = f"{FRONTEND_BASE_URL}/api/workflows/sync/validate-access/{workflow_id}?tenant_id={tenant_id}"
                response = await self.client.get(url)
                return response.status_code == 200
            
            # Check if tenant matches workflow tenant
            return workflow_data.get("tenant_id") == tenant_id
            
        except Exception as e:
            logger.error(f"Error validating tenant workflow access: {e}")
            return False

# Global service instance
websocket_sync_service = WebSocketSyncService()

@router.post("/agent_update/{workflow_id}")
async def send_agent_update(
    workflow_id: str,
    agent_update: AgentStatusUpdate,
    tenant_context: TenantContext = Depends(get_current_tenant)
):
    """Send agent status update to frontend WebSocket"""
    try:
        # Validate tenant access to workflow
        if not await websocket_sync_service.validate_tenant_workflow_access(workflow_id, tenant_context.tenant_id):
            raise HTTPException(status_code=403, detail="Access denied to workflow")
        
        await websocket_sync_service.send_agent_update(workflow_id, agent_update)
        return {
            "success": True,
            "message": "Agent update sent",
            "workflow_id": workflow_id,
            "agent_id": agent_update.agent_id,
            "tenant_id": tenant_context.tenant_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending agent update: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workflow_update/{workflow_id}")
async def send_workflow_update(
    workflow_id: str,
    workflow_update: WorkflowStatusUpdate,
    tenant_context: TenantContext = Depends(get_current_tenant)
):
    """Send workflow status update to frontend WebSocket"""
    try:
        await websocket_sync_service.send_workflow_update(workflow_id, workflow_update)
        return {
            "success": True,
            "message": "Workflow update sent",
            "workflow_id": workflow_id,
            "status": workflow_update.status
        }
    except Exception as e:
        logger.error(f"Error sending workflow update: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/progress_update/{workflow_id}")
async def send_progress_update(
    workflow_id: str,
    progress_update: WorkflowProgressUpdate,
    tenant_context: TenantContext = Depends(get_current_tenant)
):
    """Send workflow progress update to frontend WebSocket"""
    try:
        await websocket_sync_service.send_progress_update(workflow_id, progress_update)
        return {
            "success": True,
            "message": "Progress update sent",
            "workflow_id": workflow_id,
            "progress_percentage": progress_update.progress_percentage
        }
    except Exception as e:
        logger.error(f"Error sending progress update: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/request_user_input/{workflow_id}")
async def request_user_input(
    workflow_id: str,
    agent_id: str,
    message: str,
    timeout: int = 60,
    tenant_context: TenantContext = Depends(get_current_tenant)
):
    """Request user input and wait for response"""
    try:
        # Send agent message requesting input
        agent_update = AgentStatusUpdate(
            agent_id=agent_id,
            status="waiting_input",
            progress=0,
            message=message,
            requires_response=True
        )
        
        await websocket_sync_service.send_agent_update(workflow_id, agent_update)
        
        # Wait for user response
        response = await websocket_sync_service.get_user_response(workflow_id, agent_id, timeout)
        
        if response:
            return {
                "success": True,
                "response": response,
                "workflow_id": workflow_id,
                "agent_id": agent_id
            }
        else:
            return {
                "success": False,
                "message": "Timeout waiting for user response",
                "workflow_id": workflow_id,
                "agent_id": agent_id
            }
            
    except Exception as e:
        logger.error(f"Error requesting user input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{workflow_id}")
async def get_workflow_status(
    workflow_id: str,
    tenant_context: TenantContext = Depends(get_current_tenant)
):
    """Get current workflow status"""
    try:
        workflow_data = websocket_sync_service.active_workflows.get(workflow_id)
        
        if not workflow_data:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        return {
            "workflow_id": workflow_id,
            "status": workflow_data.get("status", "unknown"),
            "started_at": workflow_data.get("started_at"),
            "agents": workflow_data.get("agents", {})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register_workflow/{workflow_id}")
async def register_workflow(
    workflow_id: str,
    workflow_data: Dict[str, Any],
    tenant_context: TenantContext = Depends(get_current_tenant)
):
    """Register a workflow for WebSocket monitoring"""
    try:
        websocket_sync_service.register_workflow(workflow_id, workflow_data)
        
        return {
            "success": True,
            "message": "Workflow registered",
            "workflow_id": workflow_id
        }
        
    except Exception as e:
        logger.error(f"Error registering workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/unregister_workflow/{workflow_id}")
async def unregister_workflow(
    workflow_id: str,
    tenant_context: TenantContext = Depends(get_current_tenant)
):
    """Unregister a workflow from WebSocket monitoring"""
    try:
        websocket_sync_service.unregister_workflow(workflow_id)
        
        return {
            "success": True,
            "message": "Workflow unregistered",
            "workflow_id": workflow_id
        }
        
    except Exception as e:
        logger.error(f"Error unregistering workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper function for agents to use
async def notify_agent_status(
    workflow_id: str,
    agent_id: str,
    status: str,
    progress: int = 0,
    message: str = "",
    current_task: Optional[str] = None,
    requires_response: bool = False
):
    """Helper function for agents to send status updates"""
    agent_update = AgentStatusUpdate(
        agent_id=agent_id,
        status=status,
        progress=progress,
        message=message,
        current_task=current_task,
        requires_response=requires_response
    )
    
    await websocket_sync_service.send_agent_update(workflow_id, agent_update)

async def notify_workflow_status(
    workflow_id: str,
    status: str,
    controls: Optional[Dict[str, bool]] = None,
    progress: Optional[Dict[str, Any]] = None
):
    """Helper function to send workflow status updates"""
    workflow_update = WorkflowStatusUpdate(
        status=status,
        controls=controls or {
            "canPause": status == "running",
            "canResume": status == "paused",
            "canCancel": status in ["running", "paused"]
        },
        progress=progress
    )
    
    await websocket_sync_service.send_workflow_update(workflow_id, workflow_update)

async def notify_workflow_progress(
    workflow_id: str,
    total_steps: int,
    completed_steps: int,
    current_step: str,
    progress_percentage: float,
    estimated_time_remaining: Optional[int] = None,
    step_details: Optional[Dict[str, Any]] = None
):
    """Helper function to send workflow progress updates"""
    progress_update = WorkflowProgressUpdate(
        total_steps=total_steps,
        completed_steps=completed_steps,
        current_step=current_step,
        progress_percentage=progress_percentage,
        estimated_time_remaining=estimated_time_remaining,
        step_details=step_details
    )
    
    await websocket_sync_service.send_progress_update(workflow_id, progress_update)