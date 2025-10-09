#!/bin/bash

echo "🔍 检查系统依赖..."

# 检查Python
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version)
    echo "✅ $python_version"
else
    echo "❌ Python3 未安装"
    exit 1
fi

# 检查Node.js
if command -v node &> /dev/null; then
    node_version=$(node --version)
    echo "✅ Node.js $node_version"
else
    echo "❌ Node.js 未安装"
    exit 1
fi

# 检查npm
if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    echo "✅ npm $npm_version"
else
    echo "❌ npm 未安装"
    exit 1
fi

# 检查pip
if command -v pip3 &> /dev/null; then
    pip_version=$(pip3 --version)
    echo "✅ $pip_version"
else
    echo "❌ pip3 未安装"
    exit 1
fi

echo ""
echo "🎯 安装Python依赖:"
echo "pip3 install --user fastapi uvicorn[standard] pydantic python-multipart python-dotenv"
echo ""
echo "🎯 安装Node.js依赖:"
echo "npm install"
echo ""
echo "✅ 依赖检查完成！"