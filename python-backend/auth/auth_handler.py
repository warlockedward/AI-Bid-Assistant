from typing import Dict, Any, Optional
import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, Header
from pydantic import BaseModel

SECRET_KEY = "your-secret-key-here"  # 应该从环境变量获取


class TenantContext(BaseModel):
    """Tenant context for API requests"""
    tenant_id: str
    user_id: str
    tenant_settings: Dict[str, Any] = {}


def verify_token(token: str) -> Dict[str, Any]:
    """验证JWT令牌"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return {
            "user_id": payload.get("user_id"),
            "tenant_id": payload.get("tenant_id"),
            "tenant_settings": payload.get("tenant_settings", {})
        }
    except jwt.ExpiredSignatureError:
        raise Exception("令牌已过期")
    except jwt.InvalidTokenError:
        raise Exception("无效令牌")


def create_token(user_id: str, tenant_id: str, tenant_settings: Dict[str, Any] = None) -> str:
    """创建JWT令牌"""
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "tenant_settings": tenant_settings or {},
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


async def get_current_tenant(
    authorization: Optional[str] = Header(None)
) -> TenantContext:
    """Get current tenant context from authorization header"""
    if not authorization:
        # For testing purposes, return a default tenant context
        return TenantContext(
            tenant_id="test-tenant-id",
            user_id="test-user-id",
            tenant_settings={}
        )
    
    try:
        # Extract token from "Bearer <token>" format
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            token = authorization
        
        # Verify and decode token
        payload = verify_token(token)
        
        return TenantContext(
            tenant_id=payload["tenant_id"],
            user_id=payload["user_id"],
            tenant_settings=payload.get("tenant_settings", {})
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {str(e)}"
        )