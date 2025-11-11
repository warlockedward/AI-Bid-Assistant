# 智能体系统使用指南

## 目录
1. [快速开始](#快速开始)
2. [核心功能](#核心功能)
3. [使用示例](#使用示例)
4. [配置说明](#配置说明)
5. [最佳实践](#最佳实践)
6. [故障排查](#故障排查)

---

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 基本配置
```python
# config.py
AGENT_CONFIG = {
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 3000,
    "fastgpt_url": "http://localhost:3001",
    "cache_enabled": True,
    "cache_ttl": 3600,
    "max_retries": 3,
    "max_concurrent": 5
}
```

### 启动协作工作流
```python
from python-backend.agents.agent_manager import AgentWorkflowManager

# 创建管理器
manager = AgentWorkflowManager()

# 启动工作流
workflow_id = await manager.start_collaborative_workflow(
    tenant_id="your_tenant_id",
    tender_document="招标文档内容...",
    config=AGENT_CONFIG,
    max_iterations=3
)

# 获取状态
status = manager.get_collaborative_workflow_status(workflow_id)
print(f"工作流状态: {status['status']}")
print(f"当前阶段: {status['current_step']}")
print(f"进度: {status['progress']}%")
```

---

## 核心功能

### 1. 协作工作流

#### 三阶段流程
```python
from python-backend.agents.collaborative_workflow import CollaborativeWorkflow

workflow = CollaborativeWorkflow(tenant_id, config)

# 执行完整工作流
result = await workflow.execute_collaborative_workflow(
    tender_document="招标文档...",
    max_iterations=3
)

# 结果包含
# - analysis: 分析结果
# - content: 生成的内容
# - verification: 验证结果
# - collaboration_history: 协作历史
```

#### 阶段说明
- **阶段1：分析和知识检索**
  - 并行执行招标分析和知识检索
  - 提取需求、评估风险
  - 检索相关知识和案例

- **阶段2：协作内容生成**
  - 生成技术、商务、实施方案
  - 多轮优化循环（最多3轮）
  - 质量检查和自动改进

- **阶段3：最终验证**
  - 全面合规验证
  - 生成最终报告
  - 确定审批状态

### 2. 错误处理和重试

#### 使用重试装饰器
```python
from python-backend.agents.error_handling import with_retry, RetryConfig

# 自定义重试配置
retry_config = RetryConfig(
    max_retries=3,
    initial_delay=1.0,
    max_delay=60.0,
    exponential_base=2.0,
    jitter=True
)

@with_retry(retry_config=retry_config)
async def process_document(document):
    # 自动重试，指数退避
    result = await analyze(document)
    return result
```

#### 检查点和回滚
```python
from python-backend.agents.error_handling import checkpoint_manager

# 保存检查点
checkpoint_manager.save_checkpoint(
    workflow_id="workflow_123",
    stage="analysis",
    data={"result": analysis_result}
)

# 回滚到检查点
recovered_data = checkpoint_manager.rollback_to_checkpoint(
    workflow_id="workflow_123",
    stage="analysis"
)
```

#### 错误恢复
```python
from python-backend.agents.error_handling import error_recovery_manager

# 记录错误
error_recovery_manager.record_error(
    workflow_id="workflow_123",
    stage="content_generation",
    error=exception,
    context={"attempt": 1}
)

# 检查是否应该重试
if error_recovery_manager.should_retry("workflow_123", "content_generation"):
    # 尝试恢复
    result = await error_recovery_manager.recover_from_error(
        workflow_id="workflow_123",
        stage="content_generation",
        recovery_func=regenerate_content
    )
```

### 3. 质量控制

#### 内容质量检查
```python
from python-backend.agents.quality_control import content_quality_checker

# 综合质量检查
results = content_quality_checker.comprehensive_check(
    content={
        "technical": "技术方案内容...",
        "commercial": "商务方案内容...",
        "implementation": "实施计划内容..."
    },
    required_sections=["technical", "commercial", "implementation"]
)

if results["overall_passed"]:
    print("✅ 质量检查通过")
else:
    print(f"❌ 发现问题: {results['issues']}")
    print(f"⚠️ 警告: {results['warnings']}")
```

#### 质量评分
```python
from python-backend.agents.quality_control import QualityScorer

# 计算质量分数
score = QualityScorer.calculate_quality_score(content, quality_checks)
level = QualityScorer.get_quality_level(score)

print(f"质量分数: {score:.2f}")
print(f"质量等级: {level}")
# excellent, good, acceptable, needs_improvement, poor
```

#### 生成优化建议
```python
from python-backend.agents.quality_control import quality_optimizer

# 生成改进建议
suggestions = quality_optimizer.generate_optimization_suggestions(quality_checks)

for suggestion in suggestions:
    print(f"💡 {suggestion}")
```

### 4. 性能监控

#### 记录指标
```python
from python-backend.agents.monitoring import performance_monitor

# 记录操作
operation_id = "op_123"
performance_monitor.start_operation(operation_id)

# ... 执行操作 ...

performance_monitor.end_operation(
    operation_id,
    "collaborative_workflow",
    success=True
)

# 记录LLM调用
performance_monitor.record_llm_call(
    agent_name="content_generator",
    duration=2.5,
    success=True,
    token_count=1500
)

# 记录内容质量
performance_monitor.record_content_quality(
    content_type="technical_proposal",
    quality_score=0.85
)
```

#### 获取性能摘要
```python
summary = performance_monitor.get_performance_summary()

print(f"LLM调用总数: {summary['llm_calls']['total']}")
print(f"LLM成功率: {summary['llm_calls']['success_rate']:.2%}")
print(f"平均响应时间: {summary['llm_calls']['avg_duration']:.2f}s")
print(f"工作流成功率: {summary['workflows']['success_rate']:.2%}")
print(f"平均内容质量: {summary['content_quality']['avg_score']:.2f}")
```

#### 配置告警
```python
from python-backend.agents.monitoring import alert_manager

# 添加自定义告警规则
alert_manager.add_alert_rule(
    rule_name="high_failure_rate",
    metric_name="llm_call_duration",
    condition="lt",
    threshold=0.7,  # 成功率低于70%
    severity="critical"
)

# 检查告警
alert_manager.check_alerts()

# 获取活跃告警
active_alerts = alert_manager.get_active_alerts()
for alert in active_alerts:
    print(f"🚨 {alert['severity']}: {alert['rule_name']}")
    print(f"   当前值: {alert['current_value']}")
    print(f"   阈值: {alert['threshold']}")
```

### 5. 性能优化

#### 使用缓存
```python
from python-backend.agents.performance_optimization import with_cache, cache_manager

# 缓存装饰器
@with_cache(cache_manager, ttl=3600, key_prefix="analysis_")
async def expensive_analysis(document):
    # 结果会被缓存1小时
    result = await analyze_document(document)
    return result

# 手动缓存操作
cache_manager.set("key", value, ttl=1800)
cached_value = cache_manager.get("key")
cache_manager.delete("key")

# 清理过期缓存
cache_manager.cleanup_expired()

# 获取缓存统计
stats = cache_manager.get_stats()
print(f"缓存条目数: {stats['total_entries']}")
print(f"缓存大小: {stats['total_size_mb']:.2f} MB")
```

#### 并行处理
```python
from python-backend.agents.performance_optimization import parallel_executor

# 并行执行任务
tasks = [process_item(item) for item in items]
results = await parallel_executor.execute_parallel(
    tasks,
    max_concurrent=5  # 限制并发数
)

# 批量处理
results = await parallel_executor.execute_batch(
    items=large_item_list,
    process_func=process_single_item,
    batch_size=10,
    max_concurrent=3
)
```

#### 资源优化
```python
from python-backend.agents.performance_optimization import resource_optimizer

# 优化提示词长度
long_prompt = "..." * 1000
optimized_prompt = resource_optimizer.optimize_prompt_length(
    long_prompt,
    max_length=4000,
    preserve_sections=["核心需求", "技术要求"]
)

# 估算Token数量
text = "这是一个测试文本..."
token_count = resource_optimizer.estimate_token_count(text)
print(f"预估Token数: {token_count}")

# 成本优化
result = resource_optimizer.optimize_for_cost(
    prompt=long_prompt,
    max_tokens=2000,
    target_cost_reduction=0.3  # 目标降低30%成本
)
print(f"原始Token: {result['original_tokens']}")
print(f"优化后Token: {result['optimized_tokens']}")
print(f"成本降低: {result['cost_reduction']:.1%}")
```

### 6. 人工干预

#### 添加干预点
```python
from python-backend.agents.agent_manager import AgentWorkflowManager

manager = AgentWorkflowManager()

# 添加人工干预点
intervention_id = manager.add_human_intervention(
    workflow_id="workflow_123",
    stage="content_generation",
    content={"draft": "初稿内容..."},
    reason="需要人工审核技术方案"
)

# 获取待处理的干预
pending = manager.get_pending_interventions()
for intervention in pending:
    print(f"干预ID: {intervention['id']}")
    print(f"阶段: {intervention['stage']}")
    print(f"原因: {intervention['reason']}")

# 提交反馈
manager.submit_intervention_feedback(
    intervention_id=intervention_id,
    feedback={
        "approved": True,
        "comments": "技术方案合理，建议增加性能指标",
        "modifications": {"add_performance_metrics": True}
    }
)
```

---

## 使用示例

### 示例1：完整的投标文档生成流程

```python
import asyncio
from python-backend.agents.agent_manager import AgentWorkflowManager

async def generate_bid_document():
    # 配置
    config = {
        "model": "gpt-4",
        "temperature": 0.7,
        "max_tokens": 3000,
        "fastgpt_url": "http://localhost:3001"
    }
    
    # 招标文档
    tender_document = """
    项目名称：智慧城市管理平台建设项目
    预算：500万元
    工期：6个月
    
    技术要求：
    1. 采用微服务架构
    2. 支持10万并发用户
    3. 数据安全等级：三级
    4. 提供移动端APP
    
    商务要求：
    1. 提供3年质保
    2. 分期付款
    3. 提供培训服务
    """
    
    # 创建管理器
    manager = AgentWorkflowManager()
    
    # 启动协作工作流
    print("🚀 启动协作工作流...")
    workflow_id = await manager.start_collaborative_workflow(
        tenant_id="company_001",
        tender_document=tender_document,
        config=config,
        max_iterations=3
    )
    
    # 监控进度
    while True:
        status = manager.get_collaborative_workflow_status(workflow_id)
        
        print(f"📊 状态: {status['status']}")
        print(f"📍 阶段: {status['current_step']}")
        print(f"⏱️  进度: {status['progress']:.1f}%")
        
        if status['status'] in ['completed', 'failed']:
            break
        
        await asyncio.sleep(5)
    
    # 获取结果
    if status['status'] == 'completed':
        result = status['result']
        
        print("\n✅ 工作流完成!")
        print(f"📝 优化轮数: {result['content']['iterations']}")
        print(f"⭐ 审批状态: {result['verification']['approval_status']}")
        
        # 保存结果
        with open("bid_document.json", "w", encoding="utf-8") as f:
            import json
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print("💾 结果已保存到 bid_document.json")
    else:
        print(f"\n❌ 工作流失败: {status.get('error')}")

# 运行
asyncio.run(generate_bid_document())
```

### 示例2：带错误处理的内容生成

```python
from python-backend.agents.content_generation_agent import ContentGenerationAgent
from python-backend.agents.error_handling import with_retry, RetryConfig, checkpoint_manager

async def generate_content_with_error_handling():
    # 配置重试
    retry_config = RetryConfig(
        max_retries=3,
        initial_delay=1.0,
        exponential_base=2.0
    )
    
    @with_retry(retry_config=retry_config)
    async def generate_with_retry(agent, requirements, knowledge):
        # 保存检查点
        checkpoint_manager.save_checkpoint(
            "workflow_001",
            "before_generation",
            {"requirements": requirements}
        )
        
        try:
            # 生成内容
            result = await agent.generate_technical_proposal(
                requirements,
                knowledge
            )
            
            # 保存成功检查点
            checkpoint_manager.save_checkpoint(
                "workflow_001",
                "after_generation",
                {"result": result}
            )
            
            return result
            
        except Exception as e:
            print(f"⚠️ 生成失败，尝试从检查点恢复: {e}")
            # 回滚到之前的检查点
            checkpoint_data = checkpoint_manager.rollback_to_checkpoint(
                "workflow_001",
                "before_generation"
            )
            raise  # 重新抛出异常以触发重试
    
    # 创建智能体
    agent = ContentGenerationAgent("tenant_001", config)
    
    # 执行生成
    result = await generate_with_retry(
        agent,
        requirements={"technical": ["微服务架构", "高并发"]},
        knowledge={"best_practices": "..."}
    )
    
    print("✅ 内容生成成功")
    return result
```

### 示例3：质量控制和优化

```python
from python-backend.agents.quality_control import (
    content_quality_checker,
    QualityScorer,
    quality_optimizer
)

async def quality_control_workflow(content):
    # 1. 综合质量检查
    print("🔍 执行质量检查...")
    quality_checks = content_quality_checker.comprehensive_check(
        content,
        required_sections=["technical", "commercial", "implementation"]
    )
    
    # 2. 计算质量分数
    score = QualityScorer.calculate_quality_score(content, quality_checks)
    level = QualityScorer.get_quality_level(score)
    
    print(f"⭐ 质量分数: {score:.2f}")
    print(f"📊 质量等级: {level}")
    
    # 3. 检查是否通过
    if quality_checks["overall_passed"] and score >= 0.8:
        print("✅ 质量检查通过")
        return content
    
    # 4. 生成优化建议
    print("\n💡 生成优化建议...")
    suggestions = quality_optimizer.generate_optimization_suggestions(quality_checks)
    
    for i, suggestion in enumerate(suggestions, 1):
        print(f"   {i}. {suggestion}")
    
    # 5. 应用优化（这里需要调用LLM重新生成）
    print("\n🔄 应用优化建议...")
    # optimized_content = await apply_optimizations(content, suggestions)
    
    return content
```

---

## 配置说明

### 环境变量
```bash
# .env
OPENAI_API_KEY=your_api_key
FASTGPT_URL=http://localhost:3001
CACHE_ENABLED=true
CACHE_TTL=3600
MAX_RETRIES=3
MAX_CONCURRENT=5
```

### 配置文件
```python
# config/agent_config.py
AGENT_CONFIG = {
    # LLM配置
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 3000,
    
    # 知识库配置
    "fastgpt_url": "http://localhost:3001",
    "fastgpt_timeout": 30.0,
    
    # 缓存配置
    "cache_enabled": True,
    "cache_ttl": 3600,  # 1小时
    
    # 重试配置
    "max_retries": 3,
    "initial_delay": 1.0,
    "max_delay": 60.0,
    
    # 并发配置
    "max_concurrent": 5,
    "batch_size": 10,
    
    # 质量控制
    "quality_threshold": 0.7,
    "coverage_threshold": 0.8,
    "max_iterations": 3,
    
    # 监控配置
    "monitoring_enabled": True,
    "alert_enabled": True
}
```

---

## 最佳实践

### 1. 错误处理
- ✅ 始终使用重试装饰器处理不稳定的操作
- ✅ 在关键阶段保存检查点
- ✅ 记录错误历史以便分析
- ✅ 实现降级策略

### 2. 性能优化
- ✅ 对重复查询使用缓存
- ✅ 并行执行独立任务
- ✅ 优化提示词长度以降低成本
- ✅ 定期清理过期缓存

### 3. 质量控制
- ✅ 在内容生成后立即进行质量检查
- ✅ 设置合理的质量阈值
- ✅ 实施多轮优化机制
- ✅ 保留人工审核关键节点

### 4. 监控和告警
- ✅ 记录所有关键操作的指标
- ✅ 设置合理的告警阈值
- ✅ 定期检查性能摘要
- ✅ 分析告警历史以优化系统

### 5. 资源管理
- ✅ 限制并发数以避免过载
- ✅ 使用批量处理大量数据
- ✅ 定期清理旧数据
- ✅ 监控内存使用

---

## 故障排查

### 问题1：LLM调用失败
**症状**: 频繁出现LLM调用超时或失败

**排查步骤**:
1. 检查API密钥是否有效
2. 检查网络连接
3. 查看重试配置是否合理
4. 检查提示词长度是否过长

**解决方案**:
```python
# 增加重试次数和延迟
retry_config = RetryConfig(
    max_retries=5,
    initial_delay=2.0,
    max_delay=120.0
)

# 优化提示词长度
optimized_prompt = resource_optimizer.optimize_prompt_length(
    prompt,
    max_length=3000
)
```

### 问题2：内容质量不达标
**症状**: 生成的内容质量分数持续低于阈值

**排查步骤**:
1. 检查提示词质量
2. 查看质量检查的具体问题
3. 检查知识库是否有相关信息
4. 查看优化建议是否被正确应用

**解决方案**:
```python
# 降低质量阈值或增加优化轮数
workflow = CollaborativeWorkflow(tenant_id, config)
result = await workflow.execute_collaborative_workflow(
    tender_document,
    max_iterations=5  # 增加到5轮
)

# 检查具体问题
quality_checks = content_quality_checker.comprehensive_check(content)
print(f"问题: {quality_checks['issues']}")
print(f"警告: {quality_checks['warnings']}")
```

### 问题3：性能缓慢
**症状**: 工作流执行时间过长

**排查步骤**:
1. 检查是否启用缓存
2. 查看是否有并行处理机会
3. 检查LLM调用是否过多
4. 查看性能监控数据

**解决方案**:
```python
# 启用缓存
cache_manager.set("analysis_result", result, ttl=3600)

# 并行处理
tasks = [task1, task2, task3]
results = await parallel_executor.execute_parallel(tasks, max_concurrent=3)

# 查看性能数据
summary = performance_monitor.get_performance_summary()
print(f"平均响应时间: {summary['llm_calls']['avg_duration']:.2f}s")
```

### 问题4：内存占用过高
**症状**: 系统内存持续增长

**排查步骤**:
1. 检查缓存大小
2. 查看是否有内存泄漏
3. 检查是否清理旧数据

**解决方案**:
```python
# 清理过期缓存
cache_manager.cleanup_expired()

# 压缩大数据
from python-backend.agents.performance_optimization import memory_optimizer
compressed = memory_optimizer.compress_large_dict(large_data, max_value_length=1000)

# 清理旧数据
cleaned = memory_optimizer.cleanup_old_data(
    data_dict,
    max_age=timedelta(days=7)
)
```

---

## 联系支持

如有问题，请查看：
- 📖 [完整文档](./IMPLEMENTATION_COMPLETE_FINAL.md)
- 🐛 [问题追踪](./issues)
- 💬 [讨论区](./discussions)

---

**最后更新**: 2024-11-10  
**版本**: 1.0.0
