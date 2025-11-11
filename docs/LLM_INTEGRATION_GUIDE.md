# LLM集成指南

## 概述

本系统已实现统一的LLM客户端，支持与OpenAI兼容的API服务器进行交互，包括：
- **LLM**: 大语言模型（Qwen3-QwQ-32B）
- **VLM**: 视觉语言模型（Qwen2.5-VL-32B-Instruct）
- **Embedding**: 文本嵌入模型（bge-m3）
- **Rerank**: 文档重排序模型（bge-reranker-v2-minicpm-layerwise）

---

## 快速开始

### 1. 环境配置

设置环境变量：

```bash
export OPENAI_API_KEY="sk-vNAqmumBY5MiaStj0fFf4eA0E88544FcB1489f7c9eB6Ed9f"
export OPENAI_API_BASE="http://192.254.90.4:3001/v1"
```

或在代码中设置：

```python
import os
os.environ["OPENAI_API_KEY"] = "sk-vNAqmumBY5MiaStj0fFf4eA0E88544FcB1489f7c9eB6Ed9f"
os.environ["OPENAI_API_BASE"] = "http://192.254.90.4:3001/v1"
```

### 2. 基础使用

```python
from python-backend.agents.llm_client import LLMClient

# 创建客户端
client = LLMClient(
    llm_model="Qwen3-QwQ-32B",
    embedding_model="bge-m3"
)

# 聊天补全
messages = [
    {"role": "system", "content": "你是一个专业助手。"},
    {"role": "user", "content": "你好！"}
]

response = await client.chat_completion(
    messages=messages,
    temperature=0.7,
    max_tokens=2000
)

print(response)
```

---

## 核心功能

### 1. 聊天补全（Chat Completion）

```python
# 基础聊天
response = await client.chat_completion(
    messages=[
        {"role": "system", "content": "你是招标分析专家。"},
        {"role": "user", "content": "请分析这份招标文档..."}
    ],
    temperature=0.7,
    max_tokens=2000
)

# 流式聊天
async for chunk in client.stream_chat_completion(
    messages=messages,
    temperature=0.7,
    max_tokens=2000
):
    print(chunk, end="", flush=True)
```

### 2. 视觉语言模型（Vision）

```python
# 使用图片URL
response = await client.vision_completion(
    text="请描述这张图片",
    image_url="https://example.com/image.jpg",
    temperature=0.7,
    max_tokens=1000
)

# 使用本地图片
response = await client.vision_completion(
    text="请分析这张招标文档截图",
    image_path="/path/to/image.jpg",
    temperature=0.7,
    max_tokens=1000
)

# 使用base64编码
response = await client.vision_completion(
    text="请识别图片中的文字",
    image_base64="iVBORw0KGgoAAAANS...",
    temperature=0.7,
    max_tokens=1000
)
```

### 3. 文本嵌入（Embedding）

```python
# 单个文本
embedding = await client.create_embedding("这是一个测试文本")
print(f"向量维度: {len(embedding)}")

# 批量文本
texts = ["文本1", "文本2", "文本3"]
embeddings = await client.create_embedding(texts)
print(f"生成了 {len(embeddings)} 个嵌入向量")
```

### 4. 文档重排序（Rerank）

```python
query = "招标文件分析"
documents = [
    "招标文件分析是投标的第一步",
    "天气预报显示明天会下雨",
    "需求提取是分析的核心任务"
]

results = await client.rerank(
    query=query,
    documents=documents,
    top_k=2
)

for result in results:
    print(f"[{result['score']:.4f}] {result['document']}")
```

---

## 在智能体中使用

### 方法1：直接使用LLM客户端

```python
from python-backend.agents.base_agent import BaseAgent

class MyAgent(BaseAgent):
    async def _execute_impl(self, input_data):
        # 使用self.llm_client
        response = await self.llm_client.chat_completion(
            messages=[
                {"role": "user", "content": input_data["query"]}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        return {"response": response}
```

### 方法2：使用_chat_with_agent方法

```python
class MyAgent(BaseAgent):
    async def _execute_impl(self, input_data):
        # 使用封装的方法
        response = await self._chat_with_agent(
            message=input_data["query"],
            temperature=0.7,
            max_tokens=2000
        )
        return {"response": response}
```

---

## 配置管理

### 使用配置文件

```python
from python-backend.config.llm_config import get_llm_config

# 获取默认配置
config = get_llm_config()

# 获取租户特定配置
config = get_llm_config("demo")

# 创建客户端
client = LLMClient(
    api_key=config["api_key"],
    api_base=config["api_base"],
    llm_model=config["llm_model"]
)
```

### 更新租户配置

```python
from python-backend.config.llm_config import update_tenant_config

update_tenant_config("my_tenant", {
    "llm_model": "Qwen3-QwQ-32B",
    "default_temperature": 0.8,
    "default_max_tokens": 3000
})
```

---

## 高级功能

### 1. 使用缓存

```python
from python-backend.agents.performance_optimization import with_cache, cache_manager

@with_cache(cache_manager, ttl=3600, key_prefix="analysis_")
async def analyze_document(doc: str) -> str:
    response = await client.chat_completion(
        messages=[{"role": "user", "content": f"分析: {doc}"}],
        max_tokens=1000
    )
    return response

# 第一次调用会请求LLM
result1 = await analyze_document("文档内容")

# 第二次调用会从缓存获取（快速）
result2 = await analyze_document("文档内容")
```

### 2. 错误处理和重试

```python
from python-backend.agents.error_handling import with_retry, RetryConfig

@with_retry(retry_config=RetryConfig(max_retries=3, initial_delay=1.0))
async def chat_with_retry(message: str) -> str:
    return await client.chat_completion(
        messages=[{"role": "user", "content": message}],
        max_tokens=500
    )

# 自动重试，指数退避
response = await chat_with_retry("你好")
```

### 3. 性能监控

```python
from python-backend.agents.monitoring import performance_monitor

# 记录LLM调用
performance_monitor.record_llm_call(
    agent_name="my_agent",
    duration=1.5,
    success=True,
    token_count=1000
)

# 获取性能摘要
summary = performance_monitor.get_performance_summary()
print(f"LLM调用成功率: {summary['llm_calls']['success_rate']:.2%}")
```

### 4. 质量控制

```python
from python-backend.agents.quality_control import content_quality_checker

# 检查生成内容的质量
response = await client.chat_completion(messages=messages)

quality_checks = content_quality_checker.comprehensive_check(
    response,
    required_sections=["introduction", "analysis", "conclusion"]
)

if quality_checks["overall_passed"]:
    print("✅ 质量检查通过")
else:
    print(f"❌ 发现问题: {quality_checks['issues']}")
```

---

## 测试

### 运行LLM客户端测试

```bash
# 测试所有功能
python python-backend/tests/test_llm_client.py

# 运行示例
python python-backend/examples/llm_usage_example.py
```

### 测试输出示例

```
=== 测试LLM客户端连接 ===

✅ 客户端创建成功
   API Base: http://192.254.90.4:3001/v1
   LLM Model: Qwen3-QwQ-32B
   VLM Model: Qwen2.5-VL-32B-Instruct
   Embedding Model: bge-m3
   Rerank Model: bge-reranker-v2-minicpm-layerwise

=== 测试聊天补全 ===

发送请求...
✅ 聊天补全成功
   响应长度: 245 字符
   响应内容:
招标文件分析的主要步骤包括：
1. 文档分类和初步审查
2. 需求提取和整理
3. 技术规范分析
4. 商务条款审查
5. 风险评估和可行性分析...

=== 测试文本嵌入 ===

发送请求...
✅ 嵌入生成成功
   向量维度: 1024
   前10个值: [0.123, -0.456, 0.789, ...]

=== 测试文档重排序 ===

发送请求...
✅ 重排序成功
   原始文档数: 5
   返回结果数: 3

   排序结果:
   1. [分数: 0.8523] 招标文件分析是投标过程的第一步
   2. [分数: 0.7891] 需求提取是招标分析的核心任务
   3. [分数: 0.6234] 风险评估帮助识别潜在问题

测试总结
   聊天补全: ✅ 通过
   文本嵌入: ✅ 通过
   批量嵌入: ✅ 通过
   文档重排序: ✅ 通过
   流式补全: ✅ 通过

   总计: 5/5 测试通过
   成功率: 100.0%

🎉 所有测试通过！LLM客户端工作正常。
```

---

## 模型配置

### 可用模型

| 类型 | 模型名称 | 用途 | 上下文窗口 |
|------|----------|------|------------|
| LLM | Qwen3-QwQ-32B | 文本生成、对话 | 32K |
| VLM | Qwen2.5-VL-32B-Instruct | 图像理解 | 32K |
| Embedding | bge-m3 | 文本嵌入 | 8K |
| Rerank | bge-reranker-v2-minicpm-layerwise | 文档重排序 | - |

### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| temperature | float | 0.7 | 温度参数，控制随机性 |
| max_tokens | int | 2000 | 最大生成token数 |
| top_p | float | 0.9 | 核采样参数 |
| stream | bool | False | 是否流式输出 |

---

## 故障排查

### 问题1：连接失败

**症状**: `Connection refused` 或 `Timeout`

**解决方案**:
1. 检查API服务器是否运行：`curl http://192.254.90.4:3001/v1/models`
2. 检查网络连接
3. 验证API_BASE URL是否正确

### 问题2：认证失败

**症状**: `401 Unauthorized`

**解决方案**:
1. 检查API_KEY是否正确
2. 验证环境变量是否设置：`echo $OPENAI_API_KEY`

### 问题3：模型不可用

**症状**: `Model not found`

**解决方案**:
1. 检查模型名称是否正确
2. 查看可用模型列表：`curl http://192.254.90.4:3001/v1/models`

### 问题4：响应慢

**症状**: 请求时间过长

**解决方案**:
1. 启用缓存
2. 减少max_tokens
3. 使用流式输出
4. 检查网络延迟

---

## 最佳实践

### 1. 使用合适的温度参数

```python
# 需要创造性的任务（如内容生成）
temperature = 0.8

# 需要准确性的任务（如数据提取）
temperature = 0.3

# 平衡创造性和准确性
temperature = 0.7  # 默认值
```

### 2. 控制token使用

```python
# 短回答
max_tokens = 500

# 中等长度
max_tokens = 2000  # 默认值

# 长文档
max_tokens = 4000
```

### 3. 使用系统消息

```python
messages = [
    {
        "role": "system",
        "content": "你是一个专业的招标分析专家，拥有15年经验。"
    },
    {
        "role": "user",
        "content": "请分析这份招标文档..."
    }
]
```

### 4. 启用缓存

对于重复的查询，使用缓存可以显著提升性能：

```python
@with_cache(cache_manager, ttl=3600)
async def cached_analysis(doc: str):
    return await client.chat_completion(...)
```

### 5. 错误处理

始终使用try-except和重试机制：

```python
@with_retry(retry_config=RetryConfig(max_retries=3))
async def robust_chat(message: str):
    try:
        return await client.chat_completion(...)
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise
```

---

## API参考

### LLMClient类

```python
class LLMClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        llm_model: str = "Qwen3-QwQ-32B",
        vlm_model: str = "Qwen2.5-VL-32B-Instruct",
        embedding_model: str = "bge-m3",
        rerank_model: str = "bge-reranker-v2-minicpm-layerwise"
    )
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        model: Optional[str] = None,
        stream: bool = False,
        **kwargs
    ) -> str
    
    async def vision_completion(
        self,
        text: str,
        image_path: Optional[str] = None,
        image_url: Optional[str] = None,
        image_base64: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs
    ) -> str
    
    async def create_embedding(
        self,
        text: Union[str, List[str]],
        model: Optional[str] = None
    ) -> Union[List[float], List[List[float]]]
    
    async def rerank(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None,
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]
    
    async def stream_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        model: Optional[str] = None,
        **kwargs
    )
```

---

## 更新日志

### v1.0.0 (2024-11-10)
- ✅ 实现统一LLM客户端
- ✅ 支持聊天补全、视觉、嵌入、重排序
- ✅ 集成到智能体系统
- ✅ 添加缓存和错误处理
- ✅ 完整的测试和文档

---

## 联系支持

如有问题，请参考：
- 📖 [使用指南](./AGENT_SYSTEM_USAGE_GUIDE.md)
- 🧪 [测试文件](./python-backend/tests/test_llm_client.py)
- 💡 [示例代码](./python-backend/examples/llm_usage_example.py)

---

**最后更新**: 2024-11-10  
**版本**: 1.0.0  
**状态**: ✅ 生产就绪
