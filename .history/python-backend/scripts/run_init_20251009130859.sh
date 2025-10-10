#!/bin/bash

echo "🚀 运行系统初始化脚本..."

# 检查是否在正确的目录
if [ ! -f "requirements.txt" ]; then
    echo "❌ 请在python-backend目录运行此脚本"
    exit 1
fi

# 检查必要的Python包是否已安装
echo "📚 检查必要的Python依赖..."
python -c "import sqlalchemy, psycopg2, alembic" 2>/dev/null || {
    echo "安装必要的Python依赖..."
    pip install -q sqlalchemy psycopg2-binary alembic
    echo "依赖安装完成"
}

# 运行初始化脚本
echo "⚙️  执行初始化..."
python scripts/init_admin.py

echo "✅ 初始化脚本执行完成!"