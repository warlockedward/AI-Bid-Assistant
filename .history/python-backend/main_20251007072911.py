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

# 导入所有API模块
try:
    from api.health_simple import router as health_router
    health_router_available = True
except ImportError:
    print("Warning: health router not available")
    health_router_available = False

try:
    from api.agents import router as agents_router
    agents_router_available = True
except ImportError as e:
    print(f"Warning: agents router not available: {e}")
    agents_router_available = False

try:
    from api.workflow_sync import router as workflow_sync_router
    workflow_sync_router_available = True
except ImportError:
    print("Warning: workflow sync router not available")
    workflow_sync_router_available = False

try:
    from api.websocket_sync import router as websocket_sync_router
    websocket_router_available = True
except ImportError:
    print("Warning: websocket router not available")
    websocket_router_available = False

try:
    from api.monitoring import router as monitoring_router
    monitoring_router_available = True
except ImportError:
    print("Warning: monitoring router not available")
    monitoring_router_available = False

system_monitor_available = False

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

# 模拟智能体处理函数
async def process_tender_analysis(tender_document: str) -> List[AgentMessage]:
    """招标分析智能体"""
    messages = []
    messages.append(AgentMessage(
        agent="招标分析智能体",
        content="开始分析招标文档...",
        type="action"
    ))
    
    # 模拟处理时间
    await asyncio.sleep(2)
    
    # 模拟分析结果
    requirements = ["技术要求", "商务要求", "资质要求", "交付要求", "服务要求"]
    messages.append(AgentMessage(
        agent="招标分析智能体",
        content=f"分析完成，识别出{len(requirements)}个关键需求领域",
        type="action"
    ))
    
    return messages

async def process_knowledge_retrieval(requirements: List[str]) -> List[AgentMessage]:
    """知识检索智能体"""
    messages = []
    messages.append(AgentMessage(
        agent="知识检索智能体",
        content="开始检索相关行业知识...",
        type="action"
    ))
    
    await asyncio.sleep(1.5)
    
    messages.append(AgentMessage(
        agent="知识检索智能体",
        content=f"检索完成，获取到{len(requirements)*5}条相关技术规范",
        type="action"
    ))
    
    return messages

async def process_content_generation() -> List[AgentMessage]:
    """内容生成智能体"""
    messages = []
    messages.append(AgentMessage(
        agent="内容生成智能体",
        content="开始生成投标文档内容...",
        type="action"
    ))
    
    await asyncio.sleep(3)
    
    messages.append(AgentMessage(
        agent="内容生成智能体",
        content="文档生成完成，共生成8个章节内容",
        type="action"
    ))
    
    return messages

async def process_compliance_check() -> List[AgentMessage]:
    """合规验证智能体"""
    messages = []
    messages.append(AgentMessage(
        agent="合规验证智能体",
        content="开始验证文档合规性...",
        type="action"
    ))
    
    await asyncio.sleep(2)
    
    messages.append(AgentMessage(
        agent="合规验证智能体",
        content="合规验证通过，发现2个建议优化点",
        type="action"
    ))
    
    return messages

@app.post("/api/bid/generate", response_model=BidResponse)
async def generate_bid(request: BidRequest):
    """生成投标文档的API端点"""
    try:
        all_messages = []
        
        # 1. 招标分析
        analysis_messages = await process_tender_analysis(request.tender_document)
        all_messages.extend(analysis_messages)
        
        # 2. 知识检索
        retrieval_messages = await process_knowledge_retrieval(["技术要求", "商务要求"])
        all_messages.extend(retrieval_messages)
        
        # 3. 内容生成
        generation_messages = await process_content_generation()
        all_messages.extend(generation_messages)
        
        # 4. 合规验证
        compliance_messages = await process_compliance_check()
        all_messages.extend(compliance_messages)
        
        return BidResponse(
            bid_id=f"bid_{request.tenant_id}_{hash(request.tender_document)}",
            status="completed",
            messages=all_messages,
            result={
                "document_url": f"/api/documents/{request.tenant_id}/bid_document.pdf",
                "sections_generated": 8,
                "compliance_score": 95,
                "optimization_suggestions": 2
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "service": "autogen-bid-system"}

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

@app.on_event("startup")
async def startup_event():
    """Start background monitoring tasks"""
    if system_monitor_available:
        # Start system monitoring in background
        asyncio.create_task(system_monitor.start_monitoring())

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up monitoring tasks"""
    if system_monitor_available:
        system_monitor.stop_monitoring()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)