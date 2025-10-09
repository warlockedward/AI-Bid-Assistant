"""
Workflow state repository with tenant isolation for managing workflow persistence.
"""
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from tenants.models import WorkflowState, WorkflowCheckpoint, Tenant, User
from tenants.context import TenantContext


class WorkflowStateRepository:
    """
    Repository for managing workflow state with tenant isolation.
    All operations automatically filter by tenant_id to ensure data isolation.
    """

    def __init__(self, db_session: Session):
        self.db = db_session

    def create_workflow(
        self,
        tenant_context: TenantContext,
        workflow_type: str,
        initial_step: str,
        initial_state_data: Dict[str, Any],
        workflow_metadata: Optional[Dict[str, Any]] = None,
        timeout_hours: Optional[int] = 24
    ) -> WorkflowState:
        """
        Create a new workflow with tenant isolation.
        
        Args:
            tenant_context: Tenant context for isolation
            workflow_type: Type of workflow (e.g., "bid_generation")
            initial_step: Starting step name
            initial_state_data: Initial workflow state data
            workflow_metadata: Optional workflow metadata
            timeout_hours: Hours until workflow times out (default 24)
            
        Returns:
            Created WorkflowState instance
        """
        timeout_at = None
        if timeout_hours:
            timeout_at = datetime.utcnow() + timedelta(hours=timeout_hours)

        workflow_state = WorkflowState(
            tenant_id=tenant_context.tenant_id,
            user_id=tenant_context.user_id,
            workflow_type=workflow_type,
            current_step=initial_step,
            status="running",
            state_data=initial_state_data,
            workflow_metadata=workflow_metadata or {},
            timeout_at=timeout_at
        )

        self.db.add(workflow_state)
        self.db.commit()
        self.db.refresh(workflow_state)
        
        return workflow_state

    def get_workflow(
        self,
        tenant_context: TenantContext,
        workflow_id: uuid.UUID
    ) -> Optional[WorkflowState]:
        """
        Get workflow by ID with tenant isolation.
        
        Args:
            tenant_context: Tenant context for isolation
            workflow_id: Workflow ID to retrieve
            
        Returns:
            WorkflowState if found and belongs to tenant, None otherwise
        """
        return self.db.query(WorkflowState).filter(
            and_(
                WorkflowState.workflow_id == workflow_id,
                WorkflowState.tenant_id == tenant_context.tenant_id
            )
        ).first()

    def update_workflow_step(
        self,
        tenant_context: TenantContext,
        workflow_id: uuid.UUID,
        new_step: str,
        state_data: Dict[str, Any],
        status: Optional[str] = None
    ) -> Optional[WorkflowState]:
        """
        Update workflow step and state data with tenant isolation.
        
        Args:
            tenant_context: Tenant context for isolation
            workflow_id: Workflow ID to update
            new_step: New current step name
            state_data: Updated state data
            status: Optional new status
            
        Returns:
            Updated WorkflowState if found, None otherwise
        """
        workflow = self.get_workflow(tenant_context, workflow_id)
        if not workflow:
            return None

        workflow.current_step = new_step
        workflow.state_data = state_data
        workflow.updated_at = datetime.utcnow()
        
        if status:
            workflow.status = status
            if status in {"completed", "failed", "cancelled"}:
                workflow.completed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(workflow)
        
        return workflow

    def create_checkpoint(
        self,
        tenant_context: TenantContext,
        workflow_id: uuid.UUID,
        step_name: str,
        step_index: int,
        checkpoint_data: Dict[str, Any],
        agent_outputs: Optional[Dict[str, Any]] = None,
        execution_time_ms: Optional[int] = None
    ) -> Optional[WorkflowCheckpoint]:
        """
        Create a checkpoint for a workflow with tenant isolation.
        
        Args:
            tenant_context: Tenant context for isolation
            workflow_id: Workflow ID to create checkpoint for
            step_name: Name of the step being checkpointed
            step_index: Sequential index of the step
            checkpoint_data: Data to save in checkpoint
            agent_outputs: Optional agent outputs from this step
            execution_time_ms: Optional execution time for this step
            
        Returns:
            Created WorkflowCheckpoint if workflow exists, None otherwise
        """
        workflow = self.get_workflow(tenant_context, workflow_id)
        if not workflow:
            return None

        checkpoint = WorkflowCheckpoint(
            workflow_state_id=workflow.id,
            step_name=step_name,
            step_index=step_index,
            checkpoint_data=checkpoint_data,
            agent_outputs=agent_outputs or {},
            execution_time_ms=execution_time_ms
        )

        self.db.add(checkpoint)
        self.db.commit()
        self.db.refresh(checkpoint)
        
        return checkpoint

    def get_workflow_checkpoints(
        self,
        tenant_context: TenantContext,
        workflow_id: uuid.UUID,
        limit: Optional[int] = None
    ) -> List[WorkflowCheckpoint]:
        """
        Get checkpoints for a workflow with tenant isolation.
        
        Args:
            tenant_context: Tenant context for isolation
            workflow_id: Workflow ID to get checkpoints for
            limit: Optional limit on number of checkpoints to return
            
        Returns:
            List of WorkflowCheckpoint instances ordered by step_index
        """
        workflow = self.get_workflow(tenant_context, workflow_id)
        if not workflow:
            return []

        query = self.db.query(WorkflowCheckpoint).filter(
            WorkflowCheckpoint.workflow_state_id == workflow.id
        ).order_by(WorkflowCheckpoint.step_index)

        if limit:
            query = query.limit(limit)

        return query.all()

    def get_latest_checkpoint(
        self,
        tenant_context: TenantContext,
        workflow_id: uuid.UUID
    ) -> Optional[WorkflowCheckpoint]:
        """
        Get the latest checkpoint for a workflow with tenant isolation.
        
        Args:
            tenant_context: Tenant context for isolation
            workflow_id: Workflow ID to get latest checkpoint for
            
        Returns:
            Latest WorkflowCheckpoint if exists, None otherwise
        """
        workflow = self.get_workflow(tenant_context, workflow_id)
        if not workflow:
            return None

        return self.db.query(WorkflowCheckpoint).filter(
            WorkflowCheckpoint.workflow_state_id == workflow.id
        ).order_by(desc(WorkflowCheckpoint.step_index)).first()

    def list_tenant_workflows(
        self,
        tenant_context: TenantContext,
        status_filter: Optional[str] = None,
        workflow_type_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[WorkflowState]:
        """
        List workflows for a tenant with optional filtering.
        
        Args:
            tenant_context: Tenant context for isolation
            status_filter: Optional status to filter by
            workflow_type_filter: Optional workflow type to filter by
            limit: Maximum number of workflows to return
            offset: Number of workflows to skip
            
        Returns:
            List of WorkflowState instances for the tenant
        """
        query = self.db.query(WorkflowState).filter(
            WorkflowState.tenant_id == tenant_context.tenant_id
        )

        if status_filter:
            query = query.filter(WorkflowState.status == status_filter)

        if workflow_type_filter:
            query = query.filter(WorkflowState.workflow_type == workflow_type_filter)

        return query.order_by(desc(WorkflowState.created_at)).offset(offset).limit(limit).all()

    def get_timed_out_workflows(
        self,
        tenant_context: TenantContext
    ) -> List[WorkflowState]:
        """
        Get workflows that have timed out for a tenant.
        
        Args:
            tenant_context: Tenant context for isolation
            
        Returns:
            List of WorkflowState instances that have timed out
        """
        now = datetime.utcnow()
        return self.db.query(WorkflowState).filter(
            and_(
                WorkflowState.tenant_id == tenant_context.tenant_id,
                WorkflowState.timeout_at < now,
                WorkflowState.status.in_(["running", "paused"])
            )
        ).all()

    def mark_workflow_failed(
        self,
        tenant_context: TenantContext,
        workflow_id: uuid.UUID,
        error_info: Dict[str, Any]
    ) -> Optional[WorkflowState]:
        """
        Mark a workflow as failed with error information.
        
        Args:
            tenant_context: Tenant context for isolation
            workflow_id: Workflow ID to mark as failed
            error_info: Error information to store
            
        Returns:
            Updated WorkflowState if found, None otherwise
        """
        workflow = self.get_workflow(tenant_context, workflow_id)
        if not workflow:
            return None

        workflow.status = "failed"
        workflow.error_info = error_info
        workflow.completed_at = datetime.utcnow()
        workflow.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(workflow)
        
        return workflow

    def delete_workflow(
        self,
        tenant_context: TenantContext,
        workflow_id: uuid.UUID
    ) -> bool:
        """
        Delete a workflow and all its checkpoints with tenant isolation.
        
        Args:
            tenant_context: Tenant context for isolation
            workflow_id: Workflow ID to delete
            
        Returns:
            True if workflow was deleted, False if not found
        """
        workflow = self.get_workflow(tenant_context, workflow_id)
        if not workflow:
            return False

        # Checkpoints will be deleted automatically due to cascade
        self.db.delete(workflow)
        self.db.commit()
        
        return True