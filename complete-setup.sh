#!/bin/bash

echo "🚀 智能投标系统完整设置..."

# 1. 修复环境变量
echo "🔧 修复环境变量配置..."
if [ -f ".env.example" ] && [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ 前端环境变量文件已创建"
fi

if [ -f "python-backend/.env.example" ] && [ ! -f "python-backend/.env" ]; then
    cp python-backend/.env.example python-backend/.env
    echo "✅ Python后端环境变量文件已创建"
fi

# 2. 安装依赖
echo "📦 安装依赖..."
echo "  安装前端依赖..."
npm install >/dev/null 2>&1 || echo "⚠️  前端依赖安装失败，请手动运行: npm install"

echo "  安装Python后端依赖..."
cd python-backend
pip3 install --user -r requirements.txt >/dev/null 2>&1 || echo "⚠️  Python依赖安装失败，请手动运行: pip3 install -r requirements.txt"
cd ..

# 3. 生成Prisma客户端
echo "🔧 生成Prisma客户端..."
npx prisma generate >/dev/null 2>&1 || echo "⚠️  Prisma客户端生成失败，请手动运行: npx prisma generate"

# 4. 启动数据库
echo "🐳 启动数据库..."
./start-database.sh || echo "⚠️  数据库启动失败，请手动运行: ./start-database.sh"

# 5. 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 10

# 6. 创建演示数据
echo "📋 创建演示数据..."
node create-demo-data.js || echo "⚠️  演示数据创建失败，请手动运行: node create-demo-data.js"

# 7. 启动系统
echo "🚀 启动系统..."
./start-system.sh || echo "⚠️  系统启动失败，请手动运行: ./start-system.sh"

echo "✅ 完整设置完成！"
echo ""
echo "📝 演示账户信息:"
echo "   邮箱: demo@example.com"
echo "   密码: demo123"
echo "   域名: demo"
echo ""
echo "🌐 访问地址:"
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:8000"