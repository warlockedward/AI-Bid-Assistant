#!/bin/bash

echo "🚀 运行系统初始化脚本 (conda环境)..."

# 检查是否在正确的目录
if [ ! -f "requirements.txt" ]; then
    echo "❌ 请在python-backend目录运行此脚本"
    exit 1
fi

# 检查conda命令是否存在
if ! command -v conda &> /dev/null; then
    echo "❌ 未找到conda命令，请确保已安装Anaconda或Miniconda"
    exit 1
fi

# 激活conda虚拟环境
echo "🔧 激活conda虚拟环境 'bid'..."
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate bid

# 检查conda环境是否激活成功
if [ $? -ne 0 ]; then
    echo "❌ conda环境激活失败，请确保已创建'bid'环境"
    echo "💡 创建环境命令: conda create -n bid python=3.9"
    echo "💡 激活环境命令: conda activate bid"
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