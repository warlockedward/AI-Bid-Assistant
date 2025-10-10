#!/bin/bash

echo "🚀 启动智能投标系统数据库..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker是否运行
if ! docker info &> /dev/null; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 启动数据库容器，使用5432端口
echo "🐳 启动PostgreSQL数据库容器..."
docker run -d \
  --name bid-system-db \
  -e POSTGRES_DB=intelligent_bid_system \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -v bid-system-db-data:/var/lib/postgresql/data \
  postgres:15

# 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 10

# 检查数据库是否启动成功
if docker exec bid-system-db pg_isready &> /dev/null; then
    echo "✅ 数据库启动成功"
    
    # 初始化数据库
    echo "📋 初始化数据库..."
    docker exec bid-system-db psql -U postgres -d intelligent_bid_system -c "
        CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
    " 2>/dev/null || echo "⚠️  扩展已存在或创建失败"
    
    echo "🎉 数据库准备就绪！"
    echo "   数据库地址: localhost:5432"
    echo "   数据库名: intelligent_bid_system"
    echo "   用户名: postgres"
    echo "   密码: password"
else
    echo "❌ 数据库启动失败"
    exit 1
fi