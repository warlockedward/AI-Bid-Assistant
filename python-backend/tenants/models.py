"""
Tenant-related SQLAlchemy models for multi-tenant bid system.
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func

Base = declarative_base()


class Tenant(Base):
    """
    Tenant model for multi-tenant isolation.
    Each tenant represents an organization using the bid system.
    """
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    domain = Column(String(255), nullable=True, unique=True)
    config = Column(JSON, nullable=True, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    tenant_config = relationship("TenantConfig", back_populates="tenant", uselist=False, cascade="all, delete-orphan")

    @validates('name')
    def validate_name(self, key, name):
        if not name or len(name.strip()) < 2:
            raise ValueError("Tenant name must be at least 2 characters long")
        return name.strip()

    @validates('domain')
    def validate_domain(self, key, domain):
        if domain and not domain.strip():
            return None
        return domain.strip() if domain else None

    def __repr__(self):
        return f"<Tenant(id={self.id}, name='{self.name}', domain='{self.domain}')>"


class User(Base):
    """
    User model with tenant association and SSO support.
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    sso_provider = Column(String(100), nullable=True)
    sso_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    preferences = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="users")

    @validates('email')
    def validate_email(self, key, email):
        if not email or '@' not in email:
            raise ValueError("Valid email address is required")
        return email.lower().strip()

    @validates('name')
    def validate_name(self, key, name):
        if not name or len(name.strip()) < 1:
            raise ValueError("User name is required")
        return name.strip()

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', tenant_id={self.tenant_id})>"


class TenantConfig(Base):
    """
    Tenant-specific configuration for customizing system behavior.
    """
    __tablename__ = "tenant_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, unique=True)
    rag_api_url = Column(String(500), nullable=True)
    llm_endpoint = Column(String(500), nullable=True)
    features = Column(JSON, nullable=True, default=dict)
    workflow_settings = Column(JSON, nullable=True, default=dict)
    ui_customization = Column(JSON, nullable=True, default=dict)
    notification_settings = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="tenant_config")

    @validates('rag_api_url')
    def validate_rag_api_url(self, key, url):
        if url and not url.startswith(('http://', 'https://')):
            raise ValueError("RAG API URL must be a valid HTTP/HTTPS URL")
        return url

    @validates('llm_endpoint')
    def validate_llm_endpoint(self, key, endpoint):
        if endpoint and not endpoint.startswith(('http://', 'https://')):
            raise ValueError("LLM endpoint must be a valid HTTP/HTTPS URL")
        return endpoint

    def get_feature_flag(self, feature_name: str, default: bool = False) -> bool:
        """Get a feature flag value for this tenant."""
        if not self.features:
            return default
        return self.features.get(feature_name, default)

    def set_feature_flag(self, feature_name: str, enabled: bool):
        """Set a feature flag for this tenant."""
        if not self.features:
            self.features = {}
        else:
            # Create a copy to trigger SQLAlchemy change detection
            self.features = dict(self.features)
        self.features[feature_name] = enabled

    def __repr__(self):
        return f"<TenantConfig(id={self.id}, tenant_id={self.tenant_id})>"


class WorkflowState(Base):
    """
    Workflow state model for tracking multi-step workflow execution.
    Provides checkpoint and recovery capabilities with tenant isolation.
    """
    __tablename__ = "workflow_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), nullable=False, unique=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    workflow_type = Column(String(100), nullable=False)  # e.g., "bid_generation", "document_analysis"
    current_step = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="running")  # running, paused, completed, failed, cancelled
    state_data = Column(JSON, nullable=False, default=dict)
    workflow_metadata = Column(JSON, nullable=True, default=dict)  # Additional workflow metadata
    error_info = Column(JSON, nullable=True)  # Error details if status is failed
    timeout_at = Column(DateTime(timezone=True), nullable=True)  # When workflow should timeout
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User")
    checkpoints = relationship("WorkflowCheckpoint", back_populates="workflow_state", cascade="all, delete-orphan")

    @validates('status')
    def validate_status(self, key, status):
        valid_statuses = {"running", "paused", "completed", "failed", "cancelled"}
        if status not in valid_statuses:
            raise ValueError(f"Status must be one of: {valid_statuses}")
        return status

    @validates('workflow_type')
    def validate_workflow_type(self, key, workflow_type):
        if not workflow_type or len(workflow_type.strip()) < 1:
            raise ValueError("Workflow type is required")
        return workflow_type.strip()

    @validates('current_step')
    def validate_current_step(self, key, current_step):
        if not current_step or len(current_step.strip()) < 1:
            raise ValueError("Current step is required")
        return current_step.strip()

    def is_active(self) -> bool:
        """Check if workflow is in an active state."""
        return self.status in {"running", "paused"}

    def is_completed(self) -> bool:
        """Check if workflow has completed (successfully or with failure)."""
        return self.status in {"completed", "failed", "cancelled"}

    def get_latest_checkpoint(self) -> Optional['WorkflowCheckpoint']:
        """Get the most recent checkpoint for this workflow."""
        if not self.checkpoints:
            return None
        return max(self.checkpoints, key=lambda cp: cp.step_index)

    def __repr__(self):
        return f"<WorkflowState(id={self.id}, workflow_id={self.workflow_id}, status='{self.status}', step='{self.current_step}')>"


class WorkflowCheckpoint(Base):
    """
    Workflow checkpoint model for saving intermediate state during execution.
    Enables recovery from specific points in case of failures.
    """
    __tablename__ = "workflow_checkpoints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_state_id = Column(UUID(as_uuid=True), ForeignKey("workflow_states.id"), nullable=False)
    step_name = Column(String(100), nullable=False)
    step_index = Column(Integer, nullable=False)  # Sequential step number for ordering
    checkpoint_data = Column(JSON, nullable=False, default=dict)
    agent_outputs = Column(JSON, nullable=True, default=dict)  # Outputs from agents at this step
    execution_time_ms = Column(Integer, nullable=True)  # Time taken for this step
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    workflow_state = relationship("WorkflowState", back_populates="checkpoints")

    @validates('step_name')
    def validate_step_name(self, key, step_name):
        if not step_name or len(step_name.strip()) < 1:
            raise ValueError("Step name is required")
        return step_name.strip()

    @validates('step_index')
    def validate_step_index(self, key, step_index):
        if step_index < 0:
            raise ValueError("Step index must be non-negative")
        return step_index

    def __repr__(self):
        return f"<WorkflowCheckpoint(id={self.id}, step='{self.step_name}', index={self.step_index})>"