"""
LLM客户端测试
测试与OpenAI兼容服务器的连接和功能
"""
import asyncio
import os
from python-backend.agents.llm_client import LLMClient


async def test_llm_connection():
    """测试LLM连接"""
    print("=== 测试LLM客户端连接 ===\n")
    
    # 检查环境变量是否已设置
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  警告: OPENAI_API_KEY 环境变量未设置")
        print("请设置环境变量或创建 .env 文件")
        return None
    
    if not os.getenv("OPENAI_API_BASE"):
        print("⚠️  警告: OPENAI_API_BASE 环境变量未设置")
        print("请设置环境变量或创建 .env 文件")
        return None
    
    # 创建客户端
    client = LLMClient(
        llm_model="Qwen3-QwQ-32B",
        vlm_model="Qwen2.5-VL-32B-Instruct",
        embedding_model="bge-m3",
        rerank_model="bge-reranker-v2-minicpm-layerwise"
    )
    
    print(f"✅ 客户端创建成功")
    print(f"   API Base: {client.api_base}")
    print(f"   LLM Model: {client.llm_model}")
    print(f"   VLM Model: {client.vlm_model}")
    print(f"   Embedding Model: {client.embedding_model}")
    print(f"   Rerank Model: {client.rerank_model}\n")
    
    return client


async def test_chat_completion(client: LLMClient):
    """测试聊天补全"""
    print("=== 测试聊天补全 ===\n")
    
    try:
        messages = [
            {"role": "system", "content": "你是一个专业的招标文件分析专家。"},
            {"role": "user", "content": "请简要说明招标文件分析的主要步骤。"}
        ]
        
        print("发送请求...")
        response = await client.chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        
        print(f"✅ 聊天补全成功")
        print(f"   响应长度: {len(response)} 字符")
        print(f"   响应内容:\n{response[:200]}...\n")
        
        return True
        
    except Exception as e:
        print(f"❌ 聊天补全失败: {str(e)}\n")
        return False


async def test_embedding(client: LLMClient):
    """测试文本嵌入"""
    print("=== 测试文本嵌入 ===\n")
    
    try:
        text = "这是一个测试文本，用于生成嵌入向量。"
        
        print("发送请求...")
        embedding = await client.create_embedding(text)
        
        print(f"✅ 嵌入生成成功")
        print(f"   向量维度: {len(embedding)}")
        print(f"   前10个值: {embedding[:10]}\n")
        
        return True
        
    except Exception as e:
        print(f"❌ 嵌入生成失败: {str(e)}\n")
        return False


async def test_batch_embedding(client: LLMClient):
    """测试批量嵌入"""
    print("=== 测试批量嵌入 ===\n")
    
    try:
        texts = [
            "第一个测试文本",
            "第二个测试文本",
            "第三个测试文本"
        ]
        
        print("发送请求...")
        embeddings = await client.create_embedding(texts)
        
        print(f"✅ 批量嵌入成功")
        print(f"   文本数量: {len(texts)}")
        print(f"   嵌入数量: {len(embeddings)}")
        print(f"   向量维度: {len(embeddings[0])}\n")
        
        return True
        
    except Exception as e:
        print(f"❌ 批量嵌入失败: {str(e)}\n")
        return False


async def test_rerank(client: LLMClient):
    """测试文档重排序"""
    print("=== 测试文档重排序 ===\n")
    
    try:
        query = "招标文件分析"
        documents = [
            "招标文件分析是投标过程的第一步",
            "天气预报显示明天会下雨",
            "需求提取是招标分析的核心任务",
            "今天的午餐很美味",
            "风险评估帮助识别潜在问题"
        ]
        
        print("发送请求...")
        results = await client.rerank(
            query=query,
            documents=documents,
            top_k=3
        )
        
        print(f"✅ 重排序成功")
        print(f"   原始文档数: {len(documents)}")
        print(f"   返回结果数: {len(results)}")
        print(f"\n   排序结果:")
        for i, result in enumerate(results, 1):
            print(f"   {i}. [分数: {result['score']:.4f}] {result['document']}")
        print()
        
        return True
        
    except Exception as e:
        print(f"❌ 重排序失败: {str(e)}\n")
        return False


async def test_stream_completion(client: LLMClient):
    """测试流式补全"""
    print("=== 测试流式补全 ===\n")
    
    try:
        messages = [
            {"role": "user", "content": "请用一句话介绍人工智能。"}
        ]
        
        print("发送流式请求...")
        print("响应: ", end="", flush=True)
        
        full_response = ""
        async for chunk in client.stream_chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=100
        ):
            print(chunk, end="", flush=True)
            full_response += chunk
        
        print(f"\n\n✅ 流式补全成功")
        print(f"   总长度: {len(full_response)} 字符\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ 流式补全失败: {str(e)}\n")
        return False


async def main():
    """主测试函数"""
    print("\n" + "="*60)
    print("LLM客户端功能测试")
    print("="*60 + "\n")
    
    try:
        # 测试连接
        client = await test_llm_connection()
        
        # 运行各项测试
        results = {
            "聊天补全": await test_chat_completion(client),
            "文本嵌入": await test_embedding(client),
            "批量嵌入": await test_batch_embedding(client),
            "文档重排序": await test_rerank(client),
            "流式补全": await test_stream_completion(client)
        }
        
        # 打印测试总结
        print("="*60)
        print("测试总结")
        print("="*60 + "\n")
        
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ 通过" if result else "❌ 失败"
            print(f"   {test_name}: {status}")
        
        print(f"\n   总计: {passed}/{total} 测试通过")
        print(f"   成功率: {passed/total*100:.1f}%\n")
        
        if passed == total:
            print("🎉 所有测试通过！LLM客户端工作正常。\n")
        else:
            print("⚠️  部分测试失败，请检查配置和网络连接。\n")
        
    except Exception as e:
        print(f"\n❌ 测试过程出错: {str(e)}\n")


if __name__ == "__main__":
    asyncio.run(main())
