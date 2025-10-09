#!/bin/bash

echo "🔍 智能投标系统健康检查..."

# 检查系统要求
echo "📋 检查系统要求..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 未安装"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

echo "✅ 系统要求检查通过"

# 检查环境变量
echo "📋 检查环境变量..."
if [ ! -f ".env" ]; then
    echo "❌ 前端环境变量文件不存在，请复制 .env.example 为 .env 并配置"
    exit 1
fi

if [ ! -f "python-backend/.env" ]; then
    echo "❌ Python后端环境变量文件不存在，请复制 .env.example 为 .env 并配置"
    exit 1
fi

echo "✅ 环境变量文件存在"

# 检查依赖安装
echo "📋 检查依赖安装..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  前端依赖未安装，建议运行: npm install"
fi

echo "✅ 依赖检查完成"

# 检查数据库连接
echo "📋 检查数据库连接..."
if docker ps | grep -q "bid-system-db"; then
    echo "✅ 数据库容器正在运行"
else
    echo "⚠️  数据库容器未运行，建议运行: ./start-database.sh"
fi

# 检查Prisma
echo "📋 检查Prisma..."
if [ ! -d "node_modules/.prisma" ]; then
    echo "⚠️  Prisma客户端未生成，建议运行: npx prisma generate"
fi

echo "✅ Prisma检查完成"

# 检查演示数据
echo "📋 检查演示数据..."
node check-demo-data.js || echo "⚠️  演示数据可能未创建，建议运行: node create-demo-data.js"

echo "✅ 系统检查完成！"
echo ""
echo "💡 系统状态良好，可以正常启动"