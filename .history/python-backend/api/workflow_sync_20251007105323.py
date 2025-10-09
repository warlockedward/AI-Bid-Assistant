"""
Workflow synchronization API endpoints for TypeScript-Python integration
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uuid


# 延迟导入避免循环依赖
def get_tenant_context_class():
    from tenants.context import TenantContext
    return TenantContext


def get_workflow_repository_class():
    from workflows.repository import WorkflowStateRepository
    return WorkflowStateRepository


def get_db_session_func():
    from database.database import get_db_session
    return get_db_session


router = APIRouter(prefix="/api/workflows", tags=["workflow-sync"])


class WorkflowStateSync(BaseModel):
    workflow_id: str
    tenant_id: str
    user_id: str
    workflow_type: str
    current_step: str
    status: str
    state_data: Dict[str, Any]
    workflow_metadata: Dict[str, Any]
    created_at: str
    updated_at: str


class WorkflowSyncRequest(BaseModel):
    workflow_state: WorkflowStateSync


class CheckpointSync(BaseModel):
    step_name: str
    checkpoint_data: Dict[str, Any]
    step_index: int
    created_at: Optional[str] = None


class AgentResultSync(BaseModel):
    step_id: str
    agent_type: str
    result_data: Dict[str, Any]
    execution_time_ms: int
    status: str


def get_tenant_context(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    authorization: str = Header(..., alias="Authorization")
):
    """Extract tenant context from headers"""
    # Extract user_id from Bearer token (simplified)
    if authorization.startswith("Bearer "):
        user_id = authorization.replace("Bearer ", "")
    else:
        user_id = authorization
    
    TenantContext = get_tenant_context_class()
    return TenantContext(
        tenant_id=uuid.UUID(x_tenant_id),
        user_id=uuid.UUID(user_id),
        sso_provider="",
        sso_id="",
        preferences={}
    )


@router.post("/{workflow_id}/sync")
async def sync_workflow_state(
    workflow_id: str,
    sync_request: WorkflowSyncRequest,
    tenant_context=Depends(get_tenant_context),
    db=Depends(get_db_session_func())
):
    """
    Synchronize workflow state from TypeScript frontend to Python backend
    """
    try:
        WorkflowStateRepository = get_workflow_repository_class()
        repo = WorkflowStateRepository(db)
        workflow_uuid = uuid.UUID(workflow_id)
        
        # Check if workflow exists
        existing_workflow = repo.get_workflow(tenant_context, workflow_uuid)
        
        if existing_workflow:
            # Update existing workflow
            updated_workflow = repo.update_workflow_step(
                tenant_context,
                workflow_uuid,
                sync_request.workflow_state.current_step,
                sync_request.workflow_state.state_data,
                sync_request.workflow_state.status
            )
            
            updated_at = None
            if updated_workflow:
                updated_at = updated_workflow.updated_at.isoformat()
            
            return {
                "status": "success",
                "message": "Workflow state updated",
                "workflow_id": workflow_id,
                "updated_at": updated_at
            }
        else:
            # Create new workflow
            new_workflow = repo.create_workflow(
                tenant_context,
                sync_request.workflow_state.workflow_type,
                sync_request.workflow_state.current_step,
                sync_request.workflow_state.state_data,
                sync_request.workflow_state.workflow_metadata
            )
            
            return {
                "status": "success",
                "message": "Workflow state created",
                "workflow_id": str(new_workflow.workflow_id),
                "created_at": new_workflow.created_at.isoformat()
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync workflow state: {str(e)}")


@router.get("/{workflow_id}")
async def get_workflow_state(
    workflow_id: str,
    tenant_context=Depends(get_tenant_context),
    db=Depends(get_db_session_func())
):
    """
    Get workflow state from Python backend
    """
    try:
        WorkflowStateRepository = get_workflow_repository_class()
        repo = WorkflowStateRepository(db)
        workflow_uuid = uuid.UUID(workflow_id)
        
        workflow = repo.get_workflow(tenant_context, workflow_uuid)
        
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        completed_at = None
        if workflow.completed_at:
            completed_at = workflow.completed_at.isoformat()
        
        return {
            "status": "success",
            "workflow_state": {
                "workflow_id": str(workflow.workflow_id),
                "tenant_id": str(workflow.tenant_id),
                "user_id": str(workflow.user_id),
                "workflow_type": workflow.workflow_type,
                "current_step": workflow.current_step,
                "status": workflow.status,
                "state_data": workflow.state_data,
                "workflow_metadata": workflow.workflow_metadata,
                "error_info": workflow.error_info,
                "created_at": workflow.created_at.isoformat(),
                "updated_at": workflow.updated_at.isoformat(),
                "completed_at": completed_at
            }
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workflow state: {str(e)}")


@router.post("/{workflow_id}/checkpoints")
async def create_checkpoint(
    workflow_id: str,
    checkpoint: CheckpointSync,
    tenant_context=Depends(get_tenant_context),
    db=Depends(get_db_session_func())
):
    """
    Create a checkpoint for a workflow
    """
    try:
        WorkflowStateRepository = get_workflow_repository_class()
        repo = WorkflowStateRepository(db)
        workflow_uuid = uuid.UUID(workflow_id)
        
        # Verify workflow exists and belongs to tenant
        workflow = repo.get_workflow(tenant_context, workflow_uuid)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Create checkpoint
        new_checkpoint = repo.create_checkpoint(
            tenant_context,
            workflow_uuid,
            checkpoint.step_name,
            checkpoint.step_index,
            checkpoint.checkpoint_data
        )
        
        if not new_checkpoint:
            raise HTTPException(status_code=500, detail="Failed to create checkpoint")
        
        return {
            "status": "success",
            "message": "Checkpoint created",
            "checkpoint_id": str(new_checkpoint.id),
            "created_at": new_checkpoint.created_at.isoformat()
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkpoint: {str(e)}")


@router.get("/{workflow_id}/checkpoints")
async def get_checkpoints(
    workflow_id: str,
    limit: Optional[int] = 50,
    tenant_context=Depends(get_tenant_context),
    db=Depends(get_db_session_func())
):
    """
    Get checkpoints for a workflow
    """
    try:
        WorkflowStateRepository = get_workflow_repository_class()
        repo = WorkflowStateRepository(db)
        workflow_uuid = uuid.UUID(workflow_id)
        
        checkpoints = repo.get_workflow_checkpoints(tenant_context, workflow_uuid, limit)
        
        checkpoint_list = []
        for cp in checkpoints:
            agent_outputs = cp.agent_outputs or {}
            execution_time_ms = cp.execution_time_ms or 0
            
            checkpoint_list.append({
                "id": str(cp.id),
                "workflow_state_id": str(cp.workflow_state_id),
                "step_name": cp.step_name,
                "step_index": cp.step_index,
                "checkpoint_data": cp.checkpoint_data,
                "agent_outputs": agent_outputs,
                "execution_time_ms": execution_time_ms,
                "created_at": cp.created_at.isoformat()
            })
        
        return {
            "status": "success",
            "checkpoints": checkpoint_list
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get checkpoints: {str(e)}")


@router.post("/{workflow_id}/agent-result")
async def sync_agent_result(
    workflow_id: str,
    agent_result: AgentResultSync,
    tenant_context=Depends(get_tenant_context),
    db=Depends(get_db_session_func())
):
    """
    Sync agent execution results from Python backend to workflow state
    """
    try:
        WorkflowStateRepository = get_workflow_repository_class()
        repo = WorkflowStateRepository(db)
        workflow_uuid = uuid.UUID(workflow_id)
        
        # Get current workflow state
        workflow = repo.get_workflow(tenant_context, workflow_uuid)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Update workflow state with agent results
        updated_state_data = {
            **workflow.state_data,
            f"{agent_result.step_id}_result": agent_result.result_data,
            f"{agent_result.step_id}_status": agent_result.status,
            f"{agent_result.step_id}_execution_time": agent_result.execution_time_ms
        }
        
        # Update workflow
        updated_workflow = repo.update_workflow_step(
            tenant_context,
            workflow_uuid,
            agent_result.step_id,
            updated_state_data
        )
        
        # Create checkpoint for agent completion
        if updated_workflow and agent_result.status == "completed":
            repo.create_checkpoint(
                tenant_context,
                workflow_uuid,
                f"{agent_result.step_id}_completed",
                len(workflow.checkpoints) + 1,
                agent_result.result_data,
                agent_result.result_data,
                agent_result.execution_time_ms
            )
        
        updated_at = None
        if updated_workflow:
            updated_at = updated_workflow.updated_at.isoformat()
        
        return {
            "status": "success",
            "message": "Agent result synced",
            "workflow_id": workflow_id,
            "step_id": agent_result.step_id,
            "updated_at": updated_at
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync agent result: {str(e)}")


@router.post("/{workflow_id}/error")
async def report_workflow_error(
    workflow_id: str,
    error_info: Dict[str, Any],
    tenant_context=Depends(get_tenant_context),
    db=Depends(get_db_session_func())
):
    """
    Report workflow error from Python backend
    """
    try:
        WorkflowStateRepository = get_workflow_repository_class()
        repo = WorkflowStateRepository(db)
        workflow_uuid = uuid.UUID(workflow_id)
        
        # Mark workflow as failed
        failed_workflow = repo.mark_workflow_failed(
            tenant_context,
            workflow_uuid,
            error_info
        )
        
        if not failed_workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        failed_at = None
        if failed_workflow.completed_at:
            failed_at = failed_workflow.completed_at.isoformat()
        
        return {
            "status": "success",
            "message": "Workflow error reported",
            "workflow_id": workflow_id,
            "error_info": error_info,
            "failed_at": failed_at
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to report workflow error: {str(e)}")


@router.get("/tenant/{tenant_id}/active")
async def get_active_workflows(
    tenant_id: str,
    tenant_context=Depends(get_tenant_context),
    db=Depends(get_db_session_func())
):
    """
    Get all active workflows for a tenant
    """
    try:
        # Verify tenant access
        if str(tenant_context.tenant_id) != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        WorkflowStateRepository = get_workflow_repository_class()
        repo = WorkflowStateRepository(db)
        
        # Get running workflows
        running_workflows = repo.list_tenant_workflows(
            tenant_context,
            status_filter="running",
            limit=100
        )
        
        # Get paused workflows
        paused_workflows = repo.list_tenant_workflows(
            tenant_context,
            status_filter="paused",
            limit=100
        )
        
        all_active = running_workflows + paused_workflows
        
        workflow_list = []
        for wf in all_active:
            workflow_list.append({
                "workflow_id": str(wf.workflow_id),
                "workflow_type": wf.workflow_type,
                "current_step": wf.current_step,
                "status": wf.status,
                "created_at": wf.created_at.isoformat(),
                "updated_at": wf.updated_at.isoformat()
            })
        
        return {
            "status": "success",
            "active_workflows": workflow_list,
            "count": len(all_active)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get active workflows: {str(e)}")