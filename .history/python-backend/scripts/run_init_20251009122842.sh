#!/bin/bash

echo "🚀 运行系统初始化脚本..."

# 检查是否在正确的目录
if [ ! -f "requirements.txt" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 激活虚拟环境（如果存在）
if [ -d "venv" ]; then
    echo "🔧 激活虚拟环境..."
    source venv/bin/activate
fi

# 安装依赖（如果需要）
echo "📚 检查依赖..."
pip install -q sqlalchemy psycopg2-binary alembic

# 运行初始化脚本
echo "⚙️  执行初始化..."
cd python-backend
python scripts/init_admin.py

echo "✅ 初始化脚本执行完成!"