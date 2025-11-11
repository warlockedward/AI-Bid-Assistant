# 前端LLM配置指南

## 概述

前端LLM配置系统允许用户通过Web界面灵活配置大语言模型设置，无需修改代码。配置会自动同步到后端，确保前后端一致性。

---

## 功能特性

### ✅ 已实现功能

1. **可视化配置界面**
   - 友好的表单界面
   - 实时验证
   - 配置预览

2. **多模型支持**
   - LLM模型配置
   - VLM模型配置
   - Embedding模型配置
   - Rerank模型配置

3. **高级参数配置**
   - 温度（Temperature）
   - 最大Token数
   - Top P
   - 超时设置
   - 重试次数
   - 缓存配置

4. **连接测试**
   - 实时测试API连接
   - 验证模型可用性
   - 显示详细错误信息

5. **配置管理**
   - 保存配置
   - 恢复默认值
   - 多租户支持

---

## 架构设计

### 前后端交互流程

```
┌─────────────────────────────────────────────────────┐
│                   前端 (React)                       │
├─────────────────────────────────────────────────────┤
│  LLMConfigPanel (UI组件)                            │
│    ├─ 表单输入                                       │
│    ├─ 验证逻辑                                       │
│    └─ 用户交互                                       │
├─────────────────────────────────────────────────────┤
│  useLLMConfig (Hook)                                │
│    ├─ loadConfig()                                  │
│    ├─ saveConfig()                                  │
│    ├─ testConnection()                              │
│    └─ resetConfig()                                 │
├─────────────────────────────────────────────────────┤
│  API调用 (Fetch)                                     │
│    ├─ GET /api/settings/llm-config                 │
│    ├─ POST /api/settings/llm-config                │
│    ├─ POST /api/settings/llm-config/test           │
│    └─ DELETE /api/settings/llm-config              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│                 后端 (FastAPI)                       │
├─────────────────────────────────────────────────────┤
│  settings_routes.py (API路由)                       │
│    ├─ get_llm_configuration()                      │
│    ├─ save_llm_configuration()                     │
│    ├─ test_llm_connection()                        │
│    └─ delete_llm_configuration()                   │
├─────────────────────────────────────────────────────┤
│  llm_user_config.json (配置文件)                    │
│    └─ 持久化存储用户配置                             │
├─────────────────────────────────────────────────────┤
│  LLMClient (客户端)                                  │
│    └─ 使用配置进行实际LLM调用                        │
└─────────────────────────────────────────────────────┘
```

---

## 使用指南

### 1. 访问配置页面

```typescript
// 在路由中添加设置页面
import SettingsPage from './pages/settings';

// 路由配置
<Route path="/settings" element={<SettingsPage />} />
```

### 2. 使用LLM配置Hook

```typescript
import { useLLMConfig } from './hooks/useLLMConfig';

function MyComponent() {
  const {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    testConnection,
    resetConfig
  } = useLLMConfig('default');

  // 使用配置
  useEffect(() => {
    if (config) {
      console.log('Current LLM model:', config.llmModel);
    }
  }, [config]);

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {config && (
        <div>
          <p>Model: {config.llmModel}</p>
          <p>API Base: {config.apiBase}</p>
        </div>
      )}
    </div>
  );
}
```

### 3. 保存配置

```typescript
const handleSave = async () => {
  const newConfig = {
    apiKey: 'sk-...',
    apiBase: 'http://192.254.90.4:3001/v1',
    llmModel: 'Qwen3-QwQ-32B',
    // ... 其他配置
  };

  const success = await saveConfig(newConfig);
  if (success) {
    console.log('Configuration saved successfully');
  }
};
```

### 4. 测试连接

```typescript
const handleTest = async () => {
  const result = await testConnection(config);
  if (result.success) {
    console.log('Connection test passed:', result.message);
  } else {
    console.error('Connection test failed:', result.message);
  }
};
```

---

## API接口文档

### GET /api/settings/llm-config

获取LLM配置

**参数**:
- `tenant_id` (query, optional): 租户ID，默认为"default"

**响应**:
```json
{
  "apiKey": "sk-...",
  "apiBase": "http://192.254.90.4:3001/v1",
  "llmModel": "Qwen3-QwQ-32B",
  "vlmModel": "Qwen2.5-VL-32B-Instruct",
  "embeddingModel": "bge-m3",
  "rerankModel": "bge-reranker-v2-minicpm-layerwise",
  "defaultTemperature": 0.7,
  "defaultMaxTokens": 2000,
  "defaultTopP": 0.9,
  "timeout": 60,
  "maxRetries": 3,
  "cacheEnabled": true,
  "cacheTtl": 3600,
  "maxConcurrentRequests": 10
}
```

### POST /api/settings/llm-config

保存LLM配置

**参数**:
- `tenant_id` (query, optional): 租户ID，默认为"default"

**请求体**:
```json
{
  "apiKey": "sk-...",
  "apiBase": "http://192.254.90.4:3001/v1",
  "llmModel": "Qwen3-QwQ-32B",
  // ... 其他配置
}
```

**响应**:
```json
{
  "success": true,
  "message": "配置保存成功",
  "tenant_id": "default"
}
```

### POST /api/settings/llm-config/test

测试LLM连接

**请求体**:
```json
{
  "apiKey": "sk-...",
  "apiBase": "http://192.254.90.4:3001/v1",
  "llmModel": "Qwen3-QwQ-32B",
  // ... 其他配置
}
```

**响应**:
```json
{
  "success": true,
  "message": "连接测试成功！LLM响应正常。",
  "details": {
    "llm_model": "Qwen3-QwQ-32B",
    "response_length": 245,
    "api_base": "http://192.254.90.4:3001/v1"
  }
}
```

### DELETE /api/settings/llm-config

删除配置（恢复默认）

**参数**:
- `tenant_id` (query, optional): 租户ID，默认为"default"

**响应**:
```json
{
  "success": true,
  "message": "配置已恢复为默认值"
}
```

### GET /api/settings/llm-config/models

获取可用模型列表

**响应**:
```json
{
  "llm": [
    {
      "value": "Qwen3-QwQ-32B",
      "label": "Qwen3-QwQ-32B (推荐)",
      "contextWindow": "32K",
      "type": "llm"
    }
  ],
  "vlm": [...],
  "embedding": [...],
  "rerank": [...]
}
```

---

## 配置文件格式

### 前端格式 (camelCase)

```typescript
interface LLMConfig {
  apiKey: string;
  apiBase: string;
  llmModel: string;
  vlmModel: string;
  embeddingModel: string;
  rerankModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopP: number;
  timeout: number;
  maxRetries: number;
  cacheEnabled: boolean;
  cacheTtl: number;
  maxConcurrentRequests: number;
}
```

### 后端格式 (snake_case)

```python
{
  "api_key": str,
  "api_base": str,
  "llm_model": str,
  "vlm_model": str,
  "embedding_model": str,
  "rerank_model": str,
  "default_temperature": float,
  "default_max_tokens": int,
  "default_top_p": float,
  "timeout": int,
  "max_retries": int,
  "cache_enabled": bool,
  "cache_ttl": int,
  "max_concurrent_requests": int
}
```

### 配置文件位置

```
python-backend/config/llm_user_config.json
```

**格式**:
```json
{
  "default": {
    "api_key": "sk-...",
    "api_base": "http://192.254.90.4:3001/v1",
    "llm_model": "Qwen3-QwQ-32B",
    ...
  },
  "tenant_1": {
    ...
  }
}
```

---

## 多租户支持

### 配置不同租户

```typescript
// 租户1的配置
const tenant1Config = useLLMConfig('tenant_1');

// 租户2的配置
const tenant2Config = useLLMConfig('tenant_2');

// 默认租户
const defaultConfig = useLLMConfig('default');
```

### 后端租户隔离

```python
# 获取租户配置
config = get_llm_config(tenant_id="tenant_1")

# 保存租户配置
update_tenant_config("tenant_1", config)
```

---

## 安全考虑

### 1. API Key保护

```typescript
// 前端显示时隐藏API Key
<TextField
  type="password"
  value={config.apiKey}
  // API Key以密码形式显示
/>
```

### 2. 配置验证

```python
# 后端验证配置
class LLMConfigModel(BaseModel):
    apiKey: str = Field(..., min_length=10)
    apiBase: str = Field(..., regex=r'^https?://')
    defaultTemperature: float = Field(..., ge=0, le=2)
    # ... 其他验证
```

### 3. 权限控制

```python
# 添加权限检查
@router.post("/llm-config")
async def save_llm_configuration(
    config: LLMConfigModel,
    current_user: User = Depends(get_current_user)
):
    # 检查用户权限
    if not current_user.has_permission("manage_llm_config"):
        raise HTTPException(403, "Permission denied")
    # ...
```

---

## 测试

### 前端测试

```typescript
// 测试配置加载
test('should load LLM config', async () => {
  const { result } = renderHook(() => useLLMConfig('default'));
  
  await waitFor(() => {
    expect(result.current.config).not.toBeNull();
  });
});

// 测试配置保存
test('should save LLM config', async () => {
  const { result } = renderHook(() => useLLMConfig('default'));
  
  const newConfig = { /* ... */ };
  const success = await result.current.saveConfig(newConfig);
  
  expect(success).toBe(true);
});
```

### 后端测试

```python
# 测试API端点
def test_get_llm_config():
    response = client.get("/api/settings/llm-config")
    assert response.status_code == 200
    assert "apiKey" in response.json()

def test_save_llm_config():
    config = {
        "apiKey": "test-key",
        "apiBase": "http://test.com/v1",
        # ...
    }
    response = client.post("/api/settings/llm-config", json=config)
    assert response.status_code == 200
    assert response.json()["success"] is True
```

---

## 故障排查

### 问题1: 配置无法保存

**检查**:
1. 后端API是否运行
2. 网络连接是否正常
3. 配置文件权限是否正确

**解决**:
```bash
# 检查API状态
curl http://localhost:8000/health

# 检查配置文件权限
ls -la python-backend/config/llm_user_config.json

# 创建配置目录
mkdir -p python-backend/config
```

### 问题2: 连接测试失败

**检查**:
1. API Key是否正确
2. API Base URL是否可访问
3. 模型名称是否正确

**解决**:
```bash
# 测试API连接
curl http://192.254.90.4:3001/v1/models

# 验证API Key
curl -H "Authorization: Bearer sk-..." \
  http://192.254.90.4:3001/v1/models
```

### 问题3: 前后端配置不同步

**检查**:
1. 配置格式转换是否正确
2. 是否有缓存问题

**解决**:
```typescript
// 强制重新加载配置
await loadConfig();

// 清除浏览器缓存
localStorage.clear();
```

---

## 部署

### 1. 前端部署

```bash
# 构建前端
npm run build

# 部署到服务器
cp -r dist/* /var/www/html/
```

### 2. 后端部署

```bash
# 启动API服务器
uvicorn python-backend.main_api:app --host 0.0.0.0 --port 8000

# 或使用gunicorn
gunicorn python-backend.main_api:app -w 4 -k uvicorn.workers.UvicornWorker
```

### 3. 环境变量

```bash
# 设置默认配置
export OPENAI_API_KEY="sk-..."
export OPENAI_API_BASE="http://192.254.90.4:3001/v1"
```

---

## 最佳实践

### 1. 配置管理

- ✅ 使用环境变量作为默认值
- ✅ 支持多租户配置
- ✅ 定期备份配置文件
- ✅ 使用版本控制管理配置模板

### 2. 安全性

- ✅ 加密存储API Key
- ✅ 使用HTTPS传输
- ✅ 实施权限控制
- ✅ 定期轮换API Key

### 3. 用户体验

- ✅ 提供实时验证
- ✅ 显示清晰的错误信息
- ✅ 支持配置预览
- ✅ 提供恢复默认值选项

---

## 总结

前端LLM配置系统提供了：

1. ✅ **灵活性** - 无需修改代码即可配置
2. ✅ **一致性** - 前后端配置自动同步
3. ✅ **可用性** - 友好的可视化界面
4. ✅ **可靠性** - 完整的验证和测试
5. ✅ **可扩展性** - 支持多租户和多模型

---

**最后更新**: 2024-11-10  
**版本**: 1.0.0  
**状态**: ✅ 已完成
