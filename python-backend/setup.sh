#!/bin/bash

echo "🚀 设置智能投标系统Python后端..."

# 检查Python版本
python_version=$(python3 --version 2>&1 | grep -o '[0-9]\+\.[0-9]\+')
echo "检测到Python版本: $python_version"

# 检查Python版本是否满足要求
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
    echo "❌ 需要Python 3.8或更高版本"
    exit 1
fi

# 安装依赖到用户目录
echo "📚 安装Python依赖包到用户目录..."
pip3 install --user --upgrade pip
pip3 install --user -r requirements.txt

# 验证安装
echo "🔍 验证依赖安装..."
python3 -c "
try:
    import fastapi, uvicorn, pydantic
    print('✅ 所有依赖安装成功')
except ImportError as e:
    print('❌ 依赖安装失败:', e)
    exit(1)
"

echo "✅ Python后端设置完成！"
echo ""
echo "🎯 启动服务:"
echo "  cd python-backend"
echo "  python3 minimal-start.py"
echo ""
echo "📖 API文档: http://localhost:8000/docs"