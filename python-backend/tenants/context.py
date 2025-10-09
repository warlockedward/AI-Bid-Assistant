"""
Tenant context management for multi-tenant operations.
"""
import uuid
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime

from tenants.models import Tenant, User, TenantConfig


@dataclass
class TenantContext:
    """
    Context object containing tenant and user information for request processing.
    """
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    sso_provider: Optional[str] = None
    sso_id: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    tenant_name: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    
    def __post_init__(self):
        """Validate context after initialization."""
        if not isinstance(self.tenant_id, uuid.UUID):
            if isinstance(self.tenant_id, str):
                self.tenant_id = uuid.UUID(self.tenant_id)
            else:
                raise ValueError("tenant_id must be a UUID")
        
        if not isinstance(self.user_id, uuid.UUID):
            if isinstance(self.user_id, str):
                self.user_id = uuid.UUID(self.user_id)
            else:
                raise ValueError("user_id must be a UUID")
    
    @classmethod
    def from_user(cls, user: User, tenant: Optional[Tenant] = None) -> "TenantContext":
        """Create TenantContext from User model."""
        if tenant is None:
            tenant = user.tenant
        
        return cls(
            tenant_id=user.tenant_id,
            user_id=user.id,
            sso_provider=user.sso_provider,
            sso_id=user.sso_id,
            preferences=user.preferences or {},
            tenant_name=tenant.name if tenant else None,
            user_email=user.email,
            user_name=user.name
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary for serialization."""
        return {
            "tenant_id": str(self.tenant_id),
            "user_id": str(self.user_id),
            "sso_provider": self.sso_provider,
            "sso_id": self.sso_id,
            "preferences": self.preferences,
            "tenant_name": self.tenant_name,
            "user_email": self.user_email,
            "user_name": self.user_name
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TenantContext":
        """Create TenantContext from dictionary."""
        return cls(
            tenant_id=uuid.UUID(data["tenant_id"]),
            user_id=uuid.UUID(data["user_id"]),
            sso_provider=data.get("sso_provider"),
            sso_id=data.get("sso_id"),
            preferences=data.get("preferences"),
            tenant_name=data.get("tenant_name"),
            user_email=data.get("user_email"),
            user_name=data.get("user_name")
        )
    
    def get_preference(self, key: str, default: Any = None) -> Any:
        """Get a user preference value."""
        if not self.preferences:
            return default
        return self.preferences.get(key, default)
    
    def set_preference(self, key: str, value: Any) -> None:
        """Set a user preference value."""
        if not self.preferences:
            self.preferences = {}
        self.preferences[key] = value
    
    def __str__(self) -> str:
        return f"TenantContext(tenant={self.tenant_name}, user={self.user_email})"
    
    def __repr__(self) -> str:
        return (f"TenantContext(tenant_id={self.tenant_id}, user_id={self.user_id}, "
                f"tenant_name='{self.tenant_name}', user_email='{self.user_email}')")


class TenantContextManager:
    """
    Manager for tenant context operations and validation.
    """
    
    @staticmethod
    def validate_tenant_access(context: TenantContext, resource_tenant_id: uuid.UUID) -> bool:
        """
        Validate that the current context has access to a resource from the specified tenant.
        """
        if not isinstance(resource_tenant_id, uuid.UUID):
            if isinstance(resource_tenant_id, str):
                resource_tenant_id = uuid.UUID(resource_tenant_id)
            else:
                raise ValueError("resource_tenant_id must be a UUID")
        
        return context.tenant_id == resource_tenant_id
    
    @staticmethod
    def create_tenant_filter(context: TenantContext) -> Dict[str, uuid.UUID]:
        """
        Create a filter dictionary for tenant-aware database queries.
        """
        return {"tenant_id": context.tenant_id}
    
    @staticmethod
    def validate_context(context: TenantContext) -> None:
        """
        Validate that a tenant context is properly formed.
        """
        if not context.tenant_id:
            raise ValueError("TenantContext must have a valid tenant_id")
        
        if not context.user_id:
            raise ValueError("TenantContext must have a valid user_id")
        
        if not context.user_email:
            raise ValueError("TenantContext must have a valid user_email")
    
    @staticmethod
    def merge_preferences(
        user_preferences: Optional[Dict[str, Any]], 
        tenant_defaults: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Merge user preferences with tenant defaults.
        User preferences take precedence over tenant defaults.
        """
        merged = {}
        
        if tenant_defaults:
            merged.update(tenant_defaults)
        
        if user_preferences:
            merged.update(user_preferences)
        
        return merged