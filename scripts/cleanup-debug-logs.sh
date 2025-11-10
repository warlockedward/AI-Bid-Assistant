#!/bin/bash

# 清理调试日志脚本
# 此脚本会查找并报告项目中的console.log使用情况

echo "🔍 扫描项目中的调试日志..."
echo ""

# 排除node_modules和其他不需要检查的目录
EXCLUDE_DIRS="node_modules|.next|.git|dist|build|coverage"

# 查找TypeScript/JavaScript文件中的console.log
echo "📝 TypeScript/JavaScript文件中的console.log:"
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  | grep -Ev "$EXCLUDE_DIRS" \
  | xargs grep -n "console\.log" \
  | grep -v "// console.log" \
  | grep -v "logger" \
  | wc -l

echo ""
echo "📝 Python文件中的print语句:"
find . -type f -name "*.py" \
  | grep -Ev "$EXCLUDE_DIRS" \
  | xargs grep -n "print(" \
  | grep -v "# print" \
  | wc -l

echo ""
echo "✅ 扫描完成"
echo ""
echo "建议："
echo "1. 将console.log替换为统一的logger系统"
echo "2. 将print语句替换为logging模块"
echo "3. 在生产环境中禁用调试日志"
