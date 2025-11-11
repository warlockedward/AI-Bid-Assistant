"""
LLM客户端使用示例
演示如何使用统一LLM客户端进行各种操作
"""
import asyncio
import os
from python-backend.agents.llm_client import LLMClient
from python-backend.config.llm_config import get_llm_config


async def example_basic_chat():
    """示例1: 基础聊天"""
    print("\n=== 示例1: 基础聊天 ===\n")
    
    # 获取配置
    config = get_llm_config("demo")
    
    # 创建客户端
    client = LLMClient(
        api_key=config["api_key"],
        api_base=config["api_base"],
        llm_model=config["llm_model"]
    )
    
    # 简单对话
    messages = [
        {"role": "system", "content": "你是一个专业的招标文件分析专家。"},
        {"role": "user", "content": "请列出招标文件分析的5个关键步骤。"}
    ]
    
    response = await client.chat_completion(
        messages=messages,
        temperature=0.7,
        max_tokens=500
    )
    
    print(f"响应:\n{response}\n")


async def example_multi_turn_chat():
    """示例2: 多轮对话"""
    print("\n=== 示例2: 多轮对话 ===\n")
    
    client = LLMClient()
    
    # 对话历史
    messages = [
        {"role": "system", "content": "你是一个专业的投标顾问。"}
    ]
    
    # 第一轮
    messages.append({"role": "user", "content": "什么是技术方案？"})
    response1 = await client.chat_completion(messages=messages, max_tokens=200)
    messages.append({"role": "assistant", "content": response1})
    print(f"用户: 什么是技术方案？")
    print(f"助手: {response1}\n")
    
    # 第二轮
    messages.append({"role": "user", "content": "它包含哪些主要内容？"})
    response2 = await client.chat_completion(messages=messages, max_tokens=300)
    messages.append({"role": "assistant", "content": response2})
    print(f"用户: 它包含哪些主要内容？")
    print(f"助手: {response2}\n")


async def example_with_agent():
    """示例3: 在智能体中使用"""
    print("\n=== 示例3: 在智能体中使用 ===\n")
    
    from python-backend.agents.tender_analysis_agent import TenderAnalysisAgent
    
    # 创建智能体
    config = {
        "openai_api_key": os.getenv("OPENAI_API_KEY"),
        "openai_base_url": os.getenv("OPENAI_API_BASE"),
        "ai_models": {"primary": "Qwen3-QwQ-32B"}
    }
    
    agent = TenderAnalysisAgent("demo", config)
    
    # 使用智能体分析文档
    tender_doc = """
    项目名称：智慧城市管理平台
    预算：500万元
    工期：6个月
    技术要求：
    1. 采用微服务架构
    2. 支持10万并发用户
    3. 数据安全等级：三级
    """
    
    result = await agent.process({
        "operation": "analyze_document",
        "document": tender_doc
    })
    
    print(f"分析结果:")
    print(f"  文档类型: {result.get('document_type', 'N/A')}")
    print(f"  关键信息: {result.get('key_info', {})}")
    print()


async def example_embedding_and_rerank():
    """示例4: 嵌入和重排序"""
    print("\n=== 示例4: 嵌入和重排序 ===\n")
    
    client = LLMClient()
    
    # 创建嵌入
    texts = [
        "招标文件分析是投标的第一步",
        "需求提取需要仔细阅读文档",
        "风险评估帮助识别潜在问题"
    ]
    
    print("生成嵌入...")
    embeddings = await client.create_embedding(texts)
    print(f"✅ 生成了 {len(embeddings)} 个嵌入向量")
    print(f"   向量维度: {len(embeddings[0])}\n")
    
    # 文档重排序
    query = "如何分析招标文件"
    documents = [
        "招标文件分析包括需求提取、风险评估等步骤",
        "今天天气很好",
        "投标文档需要符合招标要求",
        "午餐吃什么好呢",
        "技术方案是投标的核心部分"
    ]
    
    print("重排序文档...")
    results = await client.rerank(
        query=query,
        documents=documents,
        top_k=3
    )
    
    print(f"✅ 重排序完成，返回前3个最相关的文档:\n")
    for i, result in enumerate(results, 1):
        print(f"   {i}. [相关度: {result['score']:.4f}]")
        print(f"      {result['document']}\n")


async def example_stream_chat():
    """示例5: 流式对话"""
    print("\n=== 示例5: 流式对话 ===\n")
    
    client = LLMClient()
    
    messages = [
        {"role": "user", "content": "请详细介绍投标流程的各个阶段。"}
    ]
    
    print("流式响应: ", end="", flush=True)
    
    async for chunk in client.stream_chat_completion(
        messages=messages,
        temperature=0.7,
        max_tokens=500
    ):
        print(chunk, end="", flush=True)
    
    print("\n")


async def example_with_caching():
    """示例6: 使用缓存"""
    print("\n=== 示例6: 使用缓存 ===\n")
    
    from python-backend.agents.performance_optimization import with_cache, cache_manager
    
    client = LLMClient()
    
    @with_cache(cache_manager, ttl=300, key_prefix="analysis_")
    async def analyze_with_cache(document: str) -> str:
        """带缓存的分析函数"""
        messages = [
            {"role": "system", "content": "你是招标分析专家。"},
            {"role": "user", "content": f"请分析以下招标文档:\n{document}"}
        ]
        return await client.chat_completion(messages=messages, max_tokens=500)
    
    document = "项目名称：测试项目\n预算：100万元"
    
    # 第一次调用（会调用LLM）
    print("第一次调用（无缓存）...")
    import time
    start = time.time()
    result1 = await analyze_with_cache(document)
    time1 = time.time() - start
    print(f"✅ 完成，耗时: {time1:.2f}秒")
    print(f"   结果长度: {len(result1)} 字符\n")
    
    # 第二次调用（从缓存获取）
    print("第二次调用（有缓存）...")
    start = time.time()
    result2 = await analyze_with_cache(document)
    time2 = time.time() - start
    print(f"✅ 完成，耗时: {time2:.2f}秒")
    print(f"   结果长度: {len(result2)} 字符")
    print(f"   加速比: {time1/time2:.1f}x\n")


async def example_error_handling():
    """示例7: 错误处理"""
    print("\n=== 示例7: 错误处理 ===\n")
    
    from python-backend.agents.error_handling import with_retry, RetryConfig
    
    client = LLMClient()
    
    @with_retry(retry_config=RetryConfig(max_retries=3, initial_delay=1.0))
    async def chat_with_retry(message: str) -> str:
        """带重试的聊天函数"""
        messages = [{"role": "user", "content": message}]
        return await client.chat_completion(messages=messages, max_tokens=200)
    
    try:
        print("发送请求（带自动重试）...")
        response = await chat_with_retry("你好，请介绍一下自己。")
        print(f"✅ 成功获取响应")
        print(f"   响应: {response[:100]}...\n")
    except Exception as e:
        print(f"❌ 请求失败: {str(e)}\n")


async def main():
    """运行所有示例"""
    print("\n" + "="*60)
    print("LLM客户端使用示例")
    print("="*60)
    
    examples = [
        ("基础聊天", example_basic_chat),
        ("多轮对话", example_multi_turn_chat),
        ("嵌入和重排序", example_embedding_and_rerank),
        ("流式对话", example_stream_chat),
        ("使用缓存", example_with_caching),
        ("错误处理", example_error_handling),
    ]
    
    for name, func in examples:
        try:
            await func()
        except Exception as e:
            print(f"\n❌ 示例 '{name}' 执行失败: {str(e)}\n")
    
    print("="*60)
    print("示例演示完成")
    print("="*60 + "\n")


if __name__ == "__main__":
    # 检查环境变量
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ 错误: OPENAI_API_KEY 环境变量未设置")
        print("请设置环境变量:")
        print("  export OPENAI_API_KEY='your-api-key'")
        print("  export OPENAI_API_BASE='http://your-server:port/v1'")
        print("\n或创建 .env 文件（参考 .env.example）")
        exit(1)
    
    if not os.getenv("OPENAI_API_BASE"):
        print("❌ 错误: OPENAI_API_BASE 环境变量未设置")
        print("请设置环境变量:")
        print("  export OPENAI_API_BASE='http://your-server:port/v1'")
        exit(1)
    
    asyncio.run(main())
