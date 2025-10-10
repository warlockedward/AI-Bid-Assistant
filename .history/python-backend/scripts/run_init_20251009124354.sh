#!/bin/bash

echo "🚀 运行系统初始化脚本..."

# 检查是否在正确的目录
if [ ! -f "requirements.txt" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 激活conda虚拟环境
echo "🔧 激活conda虚拟环境..."
conda activate bid

# 检查conda环境是否激活成功
if [ $? -ne 0 ]; then
    echo "❌ conda环境激活失败，请确保已创建'bid'环境"
    exit 1
fi

# 安装依赖（如果需要）
echo "📚 检查依赖..."
pip install -q sqlalchemy psycopg2-binary alembic

# 运行初始化脚本
echo "⚙️  执行初始化..."
cd python-backend
python scripts/init_admin.py

echo "✅ 初始化脚本执行完成!"