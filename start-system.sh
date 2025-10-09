#!/bin/bash

echo "🚀 启动智能投标系统..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 启动Python后端
echo "🐍 启动Python后端服务..."
cd python-backend

# 检查并设置Python环境
if [ ! -f "requirements.txt" ]; then
    echo "❌ 找不到requirements.txt文件"
    cd ..
    exit 1
fi

# 检查Python依赖
echo "📦 检查Python依赖..."

# 检查是否已安装必要的依赖
echo "检查必要依赖..."
python3 -c "import fastapi, uvicorn; print('✅ 依赖已安装')" 2>/dev/null || {
    echo "安装必要的Python依赖..."
    pip3 install --user fastapi uvicorn[standard] pydantic python-multipart python-dotenv
    echo "依赖安装完成"
}

# 启动Python服务
echo "启动Python后端服务..."
python3 start.py &
PYTHON_PID=$!

cd ..

# 等待Python服务启动
echo "⏳ 等待Python服务启动..."
sleep 3

# 检查Python服务是否启动成功（重试机制）
max_attempts=10
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -s http://localhost:8000/api/health > /dev/null; then
        echo "✅ Python后端服务启动成功"
        break
    else
        if [ $attempt -eq $max_attempts ]; then
            echo "❌ Python后端服务启动失败"
            kill $PYTHON_PID 2>/dev/null
            exit 1
        fi
        echo "尝试 $attempt/$max_attempts - 等待服务启动..."
        sleep 2
        ((attempt++))
    fi
done

# 启动Next.js前端
echo "🌐 启动Next.js前端..."
npm run dev &
NEXTJS_PID=$!

echo ""
echo "🎉 系统启动完成！"
echo ""
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:8000"
echo "📖 API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo '🛑 正在停止服务...'; kill $PYTHON_PID $NEXTJS_PID 2>/dev/null; exit 0" INT
wait