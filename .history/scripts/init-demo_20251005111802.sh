#!/bin/bash

# 初始化演示数据脚本

echo "开始初始化演示数据..."

# 检查是否已安装依赖
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm，请先安装 Node.js"
    exit 1
fi

# 安装 ts-node 如果尚未安装
if ! command -v ts-node &> /dev/null; then
    echo "安装 ts-node..."
    npm install -g ts-node
fi

# 检查 Prisma Client 是否已生成
if [ ! -d "node_modules/.prisma/client" ]; then
    echo "生成 Prisma Client..."
    npx prisma generate
fi

# 运行初始化脚本
echo "运行演示数据初始化脚本..."
ts-node scripts/init-demo-data.ts

echo "演示数据初始化完成!"