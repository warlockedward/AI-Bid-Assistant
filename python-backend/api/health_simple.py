"""
Simple Health Check API
Provides basic health monitoring for the system
"""

from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "intelligent-bid-system",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@router.get("/health/quick")
async def quick_health_check():
    """Quick health check for load balancers"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }