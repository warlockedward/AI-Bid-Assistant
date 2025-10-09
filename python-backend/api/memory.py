"""
Memory system API endpoints for tenant-aware preference and feedback storage.
"""
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.database import get_db
from tenants.context import TenantContext
from memory.tenant_memory import TenantMemoryService
from config import DATABASE_URL

router = APIRouter(prefix="/api/memory", tags=["memory"])

# Initialize memory service
memory_service = TenantMemoryService(DATABASE_URL)


class PreferenceRequest(BaseModel):
    category: str = Field(..., description="Preference category")
    key: str = Field(..., description="Preference key")
    value: Any = Field(..., description="Preference value")
    scope: str = Field(default="global", description="Preference scope")
    scope_id: Optional[str] = Field(default=None, description="Scope identifier")


class FeedbackRequest(BaseModel):
    feedback_type: str = Field(..., description="Type of feedback")
    feedback_value: str = Field(..., description="Feedback value")
    content_type: str = Field(..., description="Type of content")
    agent_name: Optional[str] = Field(default=None, description="Agent name")
    original_content: Optional[str] = Field(default=None, description="Original content")
    modified_content: Optional[str] = Field(default=None, description="Modified content")
    feedback_reason: Optional[str] = Field(default=None, description="Feedback reason")
    workflow_id: Optional[str] = Field(default=None, description="Workflow ID")
    auto_learn: bool = Field(default=True, description="Auto-learn from feedback")


class InteractionRequest(BaseModel):
    interaction_type: str = Field(..., description="Type of interaction")
    interaction_data: Dict[str, Any] = Field(..., description="Interaction data")
    context_tags: Optional[List[str]] = Field(default=None, description="Context tags")
    expires_in_days: Optional[int] = Field(default=None, description="Expiration in days")


def get_tenant_context(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    x_user_id: str = Header(..., alias="X-User-ID")
) -> TenantContext:
    """Extract tenant context from headers."""
    try:
        return TenantContext(
            tenant_id=uuid.UUID(x_tenant_id),
            user_id=uuid.UUID(x_user_id)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid tenant context: {e}")


@router.post("/preferences")
async def store_preference(
    request: PreferenceRequest,
    context: TenantContext = Depends(get_tenant_context)
):
    """Store a user preference with tenant isolation."""
    success = memory_service.store_user_preference(
        context=context,
        category=request.category,
        key=request.key,
        value=request.value,
        scope=request.scope,
        scope_id=request.scope_id
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to store preference")
    
    return {"success": True}


@router.get("/preferences")
async def get_preferences(
    category: Optional[str] = None,
    scope: Optional[str] = None,
    scope_id: Optional[str] = None,
    context: TenantContext = Depends(get_tenant_context)
):
    """Get user preferences with tenant isolation."""
    preferences = memory_service.get_user_preferences(
        context=context,
        category=category,
        scope=scope,
        scope_id=scope_id
    )
    
    return preferences


@router.post("/feedback")
async def record_feedback(
    request: FeedbackRequest,
    context: TenantContext = Depends(get_tenant_context)
):
    """Record user feedback and optionally learn from it."""
    workflow_id = None
    if request.workflow_id:
        try:
            workflow_id = uuid.UUID(request.workflow_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid workflow ID format")
    
    success = memory_service.record_user_feedback(
        context=context,
        feedback_type=request.feedback_type,
        feedback_value=request.feedback_value,
        content_type=request.content_type,
        agent_name=request.agent_name,
        original_content=request.original_content,
        modified_content=request.modified_content,
        feedback_reason=request.feedback_reason,
        workflow_id=workflow_id,
        auto_learn=request.auto_learn
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to record feedback")
    
    return {"success": True}


@router.get("/rejections")
async def get_rejection_patterns(
    content_type: Optional[str] = None,
    agent_name: Optional[str] = None,
    days_back: int = 30,
    context: TenantContext = Depends(get_tenant_context)
):
    """Get patterns from user's rejection history."""
    patterns = memory_service.get_rejection_patterns(
        context=context,
        content_type=content_type,
        agent_name=agent_name,
        days_back=days_back
    )
    
    return patterns


@router.get("/writing-style")
async def get_writing_style(
    scope: str = "global",
    scope_id: Optional[str] = None,
    context: TenantContext = Depends(get_tenant_context)
):
    """Get user's learned writing style preferences."""
    writing_style = memory_service.get_user_writing_style(
        context=context,
        scope=scope,
        scope_id=scope_id
    )
    
    return writing_style


@router.post("/interactions")
async def store_interaction(
    request: InteractionRequest,
    context: TenantContext = Depends(get_tenant_context)
):
    """Store memory of a user interaction."""
    success = memory_service.store_interaction_memory(
        context=context,
        interaction_type=request.interaction_type,
        interaction_data=request.interaction_data,
        context_tags=request.context_tags,
        expires_in_days=request.expires_in_days
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to store interaction")
    
    return {"success": True}


@router.get("/stats")
async def get_memory_stats(
    context: TenantContext = Depends(get_tenant_context)
):
    """Get memory usage statistics."""
    stats = memory_service.get_memory_stats(context)
    
    if "error" in stats:
        raise HTTPException(status_code=500, detail=stats["error"])
    
    return stats


@router.post("/cleanup")
async def cleanup_expired_memories(
    context: TenantContext = Depends(get_tenant_context)
):
    """Clean up expired memories."""
    cleaned_count = memory_service.cleanup_expired_memories(context)
    
    return {"cleaned_count": cleaned_count}


@router.get("/health")
async def memory_health_check():
    """Health check endpoint for memory system."""
    return {"status": "healthy", "service": "memory"}