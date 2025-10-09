from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

class WorkflowExecution(BaseModel):
    id: str
    project_id: str
    tenant_id: str
    status: str
    steps: list
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

class BidProject(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime