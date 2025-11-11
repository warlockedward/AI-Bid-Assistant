"""
主API入口
集成所有API路由
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from python-backend.api.settings_routes import router as settings_router

app = FastAPI(
    title="AI Bid Assistant API",
    description="智能投标助手API",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(settings_router)

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "AI Bid Assistant API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "AI Bid Assistant"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
