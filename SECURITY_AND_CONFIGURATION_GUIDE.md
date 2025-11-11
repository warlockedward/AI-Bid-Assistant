# 安全和配置指南

## 概述

本指南说明如何安全地配置系统，避免敏感信息泄露。

---

## 🔒 安全原则

### 1. 永不硬编码敏感信息

❌ **错误做法**:
```python
API_KEY = "sk-abc123..."  # 永远不要这样做！
API_BASE = "http://192.168.1.100:3001/v1"  # 不要硬编码IP
```

✅ **正确做法**:
```python
API_KEY = os.getenv("OPENAI_API_KEY")
API_BASE = os.getenv("OPENAI_API_BASE")
```

### 2. 使用环境变量

所有敏感信息应通过环境变量配置：
- API密钥
- 服务器地址
- 数据库连接字符串
- 其他凭证

### 3. 不提交敏感文件

确保以下文件在 `.gitignore` 中：
- `.env`
- `.env.local`
- `.env.production`
- `python-backend/config/llm_user_config.json`

---

## 📝 配置方法

### 方法1: 环境变量（推荐用于生产环境）

```bash
# 设置环境变量
export OPENAI_API_KEY="your-api-key"
export OPENAI_API_BASE="http://your-server:port/v1"
export LLM_MODEL="Qwen3-QwQ-32B"

# 验证
echo $OPENAI_API_KEY
echo $OPENAI_API_BASE
```

### 方法2: .env文件（推荐用于开发环境）

```bash
# 1. 复制示例文件
cp .env.example .env

# 2. 编辑 .env 文件
nano .env

# 3. 填入实际值
OPENAI_API_KEY=your-actual-api-key
OPENAI_API_BASE=http://your-actual-server:port/v1
```

### 方法3: 前端配置界面（推荐用于用户配置）

1. 访问 `http://localhost:3000/settings`
2. 在LLM配置面板中输入配置
3. 点击"测试连接"验证
4. 点击"保存配置"

**注意**: 前端配置会保存到 `python-backend/config/llm_user_config.json`

---

## 🔧 环境变量列表

### 后端环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `OPENAI_API_KEY` | ✅ | - | API密钥 |
| `OPENAI_API_BASE` | ✅ | - | API基础URL |
| `LLM_MODEL` | ❌ | Qwen3-QwQ-32B | LLM模型名称 |
| `VLM_MODEL` | ❌ | Qwen2.5-VL-32B-Instruct | VLM模型名称 |
| `EMBEDDING_MODEL` | ❌ | bge-m3 | Embedding模型名称 |
| `RERANK_MODEL` | ❌ | bge-reranker-v2-minicpm-layerwise | Rerank模型名称 |
| `DEFAULT_TEMPERATURE` | ❌ | 0.7 | 默认温度参数 |
| `DEFAULT_MAX_TOKENS` | ❌ | 2000 | 默认最大token数 |
| `DEFAULT_TOP_P` | ❌ | 0.9 | 默认Top P参数 |
| `TIMEOUT` | ❌ | 60 | 超时时间（秒） |
| `MAX_RETRIES` | ❌ | 3 | 最大重试次数 |
| `CACHE_ENABLED` | ❌ | true | 是否启用缓存 |
| `CACHE_TTL` | ❌ | 3600 | 缓存TTL（秒） |
| `MAX_CONCURRENT` | ❌ | 10 | 最大并发请求数 |

### 前端环境变量（Next.js）

前端环境变量必须以 `NEXT_PUBLIC_` 开头才能在浏览器中访问：

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `NEXT_PUBLIC_OPENAI_API_BASE` | ❌ | - | API基础URL（前端默认值） |
| `NEXT_PUBLIC_LLM_MODEL` | ❌ | Qwen3-QwQ-32B | LLM模型名称 |
| `NEXT_PUBLIC_VLM_MODEL` | ❌ | Qwen2.5-VL-32B-Instruct | VLM模型名称 |
| `NEXT_PUBLIC_EMBEDDING_MODEL` | ❌ | bge-m3 | Embedding模型名称 |
| `NEXT_PUBLIC_RERANK_MODEL` | ❌ | bge-reranker-v2-minicpm-layerwise | Rerank模型名称 |

**注意**: 
- `NEXT_PUBLIC_` 变量会暴露在浏览器中，不要包含敏感信息
- API密钥不应该设置为 `NEXT_PUBLIC_` 变量
- 用户应该通过配置界面输入API密钥

---

## 🚀 部署配置

### 开发环境

```bash
# 1. 创建 .env.local 文件
cp .env.local.example .env.local

# 2. 编辑配置
nano .env.local

# 3. 启动服务
npm run dev
python python-backend/main_api.py
```

### 生产环境

```bash
# 1. 设置环境变量（不使用 .env 文件）
export OPENAI_API_KEY="production-key"
export OPENAI_API_BASE="https://production-server/v1"

# 2. 构建前端
npm run build

# 3. 启动服务
npm start
gunicorn python-backend.main_api:app
```

### Docker部署

```dockerfile
# Dockerfile
FROM node:18-alpine

# 不要在Dockerfile中硬编码敏感信息
# 使用环境变量或secrets

ENV NODE_ENV=production

COPY . .
RUN npm install
RUN npm run build

CMD ["npm", "start"]
```

```bash
# 运行时传入环境变量
docker run -e OPENAI_API_KEY="your-key" \
           -e OPENAI_API_BASE="http://server/v1" \
           your-image
```

---

## 🔐 安全最佳实践

### 1. API密钥管理

✅ **推荐做法**:
- 使用环境变量
- 使用密钥管理服务（AWS Secrets Manager, Azure Key Vault）
- 定期轮换密钥
- 为不同环境使用不同的密钥

❌ **避免做法**:
- 硬编码在代码中
- 提交到版本控制
- 在日志中打印
- 通过URL传递

### 2. 配置文件安全

```bash
# 确保配置文件权限正确
chmod 600 .env
chmod 600 python-backend/config/llm_user_config.json

# 检查 .gitignore
cat .gitignore | grep -E "\.env|config.*json"
```

### 3. 前端安全

```typescript
// ❌ 错误：在前端暴露API密钥
const API_KEY = "sk-abc123...";

// ✅ 正确：让用户通过配置界面输入
const { config } = useLLMConfig();
// config.apiKey 来自用户输入，存储在后端
```

### 4. 日志安全

```python
# ❌ 错误：记录敏感信息
logger.info(f"API Key: {api_key}")

# ✅ 正确：脱敏记录
logger.info(f"API Key: {api_key[:8]}...")
```

---

## 🧪 测试配置

### 检查环境变量

```bash
# 检查是否设置
env | grep OPENAI

# 或使用Python
python -c "import os; print(os.getenv('OPENAI_API_KEY', 'NOT SET'))"
```

### 测试连接

```bash
# 使用测试脚本
python python-backend/tests/test_llm_client.py

# 或使用curl
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     $OPENAI_API_BASE/models
```

---

## 📋 配置检查清单

### 部署前检查

- [ ] 所有敏感信息都使用环境变量
- [ ] `.env` 文件在 `.gitignore` 中
- [ ] 没有硬编码的API密钥
- [ ] 没有硬编码的服务器地址
- [ ] 配置文件权限正确（600）
- [ ] 生产环境使用不同的密钥
- [ ] 日志不包含敏感信息
- [ ] 前端不暴露API密钥

### 代码审查检查

```bash
# 搜索可能的硬编码密钥
grep -r "sk-" --include="*.py" --include="*.ts" --include="*.tsx"

# 搜索可能的硬编码IP
grep -r "192\." --include="*.py" --include="*.ts" --include="*.tsx"

# 搜索可能的硬编码URL
grep -r "http://" --include="*.py" --include="*.ts" --include="*.tsx"
```

---

## 🆘 故障排查

### 问题1: 环境变量未生效

**检查**:
```bash
# 确认环境变量已设置
echo $OPENAI_API_KEY

# 检查 .env 文件
cat .env

# 重新加载环境变量
source .env
```

### 问题2: 前端无法读取环境变量

**原因**: Next.js 只能读取 `NEXT_PUBLIC_` 开头的变量

**解决**:
```bash
# 在 .env 中添加
NEXT_PUBLIC_OPENAI_API_BASE=http://your-server/v1

# 重启开发服务器
npm run dev
```

### 问题3: 配置未保存

**检查**:
```bash
# 检查配置文件是否存在
ls -la python-backend/config/llm_user_config.json

# 检查文件权限
chmod 644 python-backend/config/llm_user_config.json
```

---

## 📚 相关文档

- [LLM集成指南](./LLM_INTEGRATION_GUIDE.md)
- [前端配置指南](./FRONTEND_LLM_CONFIG_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)

---

## 🔄 配置优先级

系统按以下优先级读取配置：

1. **用户配置** (最高优先级)
   - 通过前端配置界面保存
   - 存储在 `python-backend/config/llm_user_config.json`

2. **环境变量**
   - 系统环境变量
   - `.env` 文件

3. **默认值** (最低优先级)
   - 代码中的默认值

---

## ✅ 安全检查命令

```bash
# 运行安全检查
./scripts/security-check.sh

# 或手动检查
echo "检查硬编码密钥..."
grep -r "sk-" --include="*.py" --include="*.ts" --include="*.tsx" . || echo "✅ 未发现硬编码密钥"

echo "检查 .gitignore..."
grep -q "\.env" .gitignore && echo "✅ .env 已在 .gitignore 中" || echo "❌ 需要添加 .env 到 .gitignore"

echo "检查配置文件权限..."
[ -f .env ] && ls -l .env | grep -q "rw-------" && echo "✅ .env 权限正确" || echo "⚠️  建议设置 .env 权限为 600"
```

---

**最后更新**: 2024-11-10  
**版本**: 1.0.0  
**状态**: ✅ 已完成
