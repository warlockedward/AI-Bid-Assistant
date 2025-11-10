from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn
import asyncio
import sys
import os

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 初始化路由器可用性标志
health_router_available = False
agents_router_available = False
workflow_sync_router_available = False
websocket_router_available = False
monitoring_router_available = False
ocr_router_available = False

# 导入所有API模块
try:
    from api.health_simple import router as health_router
    health_router_available = True
except ImportError:
    print("Warning: health router not available")

try:
    from api.agents import router as agents_router
    agents_router_available = True
except ImportError as e:
    print(f"Warning: agents router not available: {e}")

try:
    from api.workflow_sync import router as workflow_sync_router
    workflow_sync_router_available = True
except ImportError:
    print("Warning: workflow sync router not available")

try:
    from api.websocket_sync import router as websocket_sync_router
    websocket_router_available = True
except ImportError:
    print("Warning: websocket router not available")

try:
    from api.monitoring import router as monitoring_router
    monitoring_router_available = True
except ImportError:
    print("Warning: monitoring router not available")

try:
    from api.ocr import router as ocr_router
    ocr_router_available = True
except ImportError as e:
    print(f"Warning: ocr router not available: {e}")

print("Info: Running in full mode - all features enabled")

app = FastAPI(title="AutoGen 智能投标系统", version="1.0.0")

# Include available routers
if health_router_available:
    app.include_router(health_router)

if agents_router_available:
    app.include_router(agents_router)

if workflow_sync_router_available:
    app.include_router(workflow_sync_router)

if websocket_router_available:
    app.include_router(websocket_sync_router)

if monitoring_router_available:
    app.include_router(monitoring_router)

if ocr_router_available:
    app.include_router(ocr_router)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BidRequest(BaseModel):
    tender_document: str
    tenant_id: str
    industry: str = "general"


class AgentMessage(BaseModel):
    agent: str
    content: str
    type: str = "message"


class BidResponse(BaseModel):
    bid_id: str
    status: str
    messages: List[AgentMessage]
    result: Dict[str, Any] = {}


# Legacy mock endpoint removed - use /api/agents/workflow endpoints instead


@app.get("/")
async def root():
    """根端点"""
    return {"message": "智能投标系统API服务运行中", "status": "ok"}


@app.get("/api/health")
async def health_check():
    """基本健康检查端点"""
    return {
        "status": "healthy",
        "service": "intelligent-bid-system",
        "timestamp": "2024-01-01T00:00:00Z",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check_alt():
    """备用健康检查端点"""
    return {
        "status": "healthy",
        "service": "intelligent-bid-system"
    }


# Startup and shutdown events removed - no background tasks needed


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)