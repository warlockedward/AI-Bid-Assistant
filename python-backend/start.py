#!/usr/bin/env python3
"""
启动AutoGen后端服务
"""
import uvicorn
import os
from main import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"启动AutoGen后端服务...")
    print(f"服务地址: http://{host}:{port}")
    print(f"API文档: http://{host}:{port}/docs")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,  # 禁用reload避免警告
        log_level="info"
    )