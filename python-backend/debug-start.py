#!/usr/bin/env python3
"""
调试启动脚本 - 检查环境和依赖
"""
import sys
import os

print("Python版本:", sys.version)
print("Python路径:", sys.executable)
print("当前工作目录:", os.getcwd())

# 检查关键依赖
try:
    import uvicorn
    print("✅ uvicorn 已安装，版本:", uvicorn.__version__)
except ImportError as e:
    print("❌ uvicorn 未安装:", e)

try:
    import fastapi
    print("✅ fastapi 已安装，版本:", fastapi.__version__)
except ImportError as e:
    print("❌ fastapi 未安装:", e)

try:
    from main import app
    print("✅ main.py 导入成功")
except ImportError as e:
    print("❌ main.py 导入失败:", e)

# 如果所有依赖都正常，启动服务
if 'uvicorn' in locals() and 'app' in locals():
    print("🚀 启动服务...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
else:
    print("❌ 依赖检查失败，无法启动服务")
    sys.exit(1)