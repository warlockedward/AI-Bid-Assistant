#!/bin/bash

echo "🔧 修复智能投标系统问题..."

# 1. 修复数据库连接问题
echo "🔧 修复数据库连接..."
# 确保数据库URL配置正确
if [ -f ".env" ]; then
    # 检查是否需要更新数据库URL
    if grep -q "DATABASE_URL=postgresql://postgres:password@localhost:5432/intelligent_bid_system" .env; then
        echo "✅ 数据库URL配置正确"
    else
        echo "🔄 更新数据库URL配置..."
        sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:password@localhost:5432/intelligent_bid_system|' .env
    fi
fi

# 2. 修复Python后端环境变量
echo "🔧 修复Python后端环境变量..."
if [ -f "python-backend/.env" ]; then
    if grep -q "DATABASE_URL=postgresql://postgres:password@localhost:5432/intelligent_bid_system" python-backend/.env; then
        echo "✅ Python后端数据库URL配置正确"
    else
        echo "🔄 更新Python后端数据库URL配置..."
        sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:password@localhost:5432/intelligent_bid_system|' python-backend/.env
    fi
fi

# 3. 修复数据库启动脚本
echo "🔧 修复数据库启动脚本..."
if [ -f "start-database.sh" ]; then
    chmod +x start-database.sh
    echo "✅ 数据库启动脚本权限已修复"
fi

# 4. 修复Python后端依赖安装
echo "🔧 检查Python后端依赖..."
cd python-backend
if [ -f "requirements.txt" ]; then
    echo "📦 安装Python依赖..."
    pip3 install --user -r requirements.txt >/dev/null 2>&1 || echo "⚠️  依赖安装可能需要手动执行"
fi
cd ..

# 5. 修复前端依赖
echo "🔧 检查前端依赖..."
if [ -f "package.json" ]; then
    echo "📦 安装前端依赖..."
    npm install >/dev/null 2>&1 || echo "⚠️  前端依赖安装可能需要手动执行"
fi

# 6. 生成Prisma客户端
echo "🔧 生成Prisma客户端..."
npx prisma generate >/dev/null 2>&1 || echo "⚠️  Prisma客户端生成可能需要手动执行"

echo "✅ 问题修复完成！"
echo ""
echo "🎯 下一步操作:"
echo "  1. 启动数据库: ./start-database.sh"
echo "  2. 创建演示数据: node create-demo-data.js"
echo "  3. 启动系统: ./start-system.sh"