from autogen.agentchat import AssistantAgent
from typing import Dict, Any, List
import json

class ContentGenerationAgent(AssistantAgent):
    """内容生成代理 - 基于AutoGen原生框架"""
    
    def __init__(self, tenant_id: str, config: Dict[str, Any]):
        system_message = """你是一个专业的投标内容生成专家。你的主要职责是：
1. 基于招标分析和相关知识生成高质量的投标内容
2. 按照文档结构分段生成技术方案、商务方案等内容
3. 确保内容符合招标要求和行业标准
4. 与其他代理协作完善内容质量

请确保生成的内容专业、准确、有说服力，能够有效展示投标优势。"""
        
        # 使用前端传递的模型配置
        model_config = config.get("llm_config", {})
        model_name = model_config.get("model", "gpt-4")
        provider = model_config.get("provider", "openai")
        
        # 根据提供商设置配置
        if provider == "openai":
            llm_config = {
                "config_list": [{
                    "model": model_name,
                    "api_key": model_config.get("api_key", ""),
                    "base_url": model_config.get("api_url", "https://api.openai.com/v1"),
                }],
                "temperature": model_config.get("temperature", 0.7),
                "timeout": model_config.get("timeout", 600),
            }
        elif provider == "vllm":
            llm_config = {
                "config_list": [{
                    "model": model_name,
                    "api_key": model_config.get("api_key", ""),
                    "base_url": model_config.get("api_url", "http://localhost:8000"),
                }],
                "temperature": model_config.get("temperature", 0.7),
                "timeout": model_config.get("timeout", 600),
            }
        else:
            # 默认配置
            llm_config = {
                "config_list": config.get("llm_config", []),
                "temperature": 0.7,
                "timeout": 600,
            }
        
        super().__init__(
            name=f"content_generator_{tenant_id}",
            system_message=system_message,
            llm_config=llm_config,
            human_input_mode="NEVER"
        )
        
        self.tenant_id = tenant_id
        self.config = config
        
        # 注册函数调用
        self.register_function(
            function_map={
                "generate_technical_proposal": self.generate_technical_proposal,
                "generate_commercial_proposal": self.generate_commercial_proposal,
                "generate_implementation_plan": self.generate_implementation_plan,
                "generate_executive_summary": self.generate_executive_summary,
                "review_and_refine_content": self.review_and_refine_content
            }
        )
    
    def generate_technical_proposal(self, requirements: Dict[str, Any], 
                                  knowledge: Dict[str, Any]) -> Dict[str, Any]:
        """生成技术方案"""
        try:
            # 基于需求和知识生成技术方案
            technical_content = {
                "architecture": self._generate_architecture_section(requirements, knowledge),
                "functionality": self._generate_functionality_section(requirements, knowledge),
                "performance": self._generate_performance_section(requirements, knowledge),
                "technical_advantages": self._generate_advantages_section(requirements, knowledge)
            }
            
            return {
                "success": True,
                "content": technical_content,
                "sections": list(technical_content.keys())
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def generate_commercial_proposal(self, requirements: Dict[str, Any],
                                   analysis: Dict[str, Any]) -> Dict[str, Any]:
        """生成商务方案"""
        commercial_content = {
            "pricing_strategy": self._generate_pricing_strategy(requirements, analysis),
            "payment_terms": self._generate_payment_terms(requirements, analysis),
            "warranty_support": self._generate_warranty_support(requirements, analysis),
            "commercial_advantages": self._generate_commercial_advantages(requirements, analysis)
        }
        
        return {
            "success": True,
            "content": commercial_content,
            "sections": list(commercial_content.keys())
        }
    
    def generate_implementation_plan(self, requirements: Dict[str, Any],
                                   risks: Dict[str, Any]) -> Dict[str, Any]:
        """生成实施计划"""
        implementation_content = {
            "project_timeline": self._generate_timeline(requirements, risks),
            "resource_allocation": self._generate_resource_plan(requirements, risks),
            "risk_mitigation": self._generate_risk_mitigation(requirements, risks),
            "quality_assurance": self._generate_quality_plan(requirements, risks)
        }
        
        return {
            "success": True,
            "content": implementation_content,
            "sections": list(implementation_content.keys())
        }
    
    def generate_executive_summary(self, all_content: Dict[str, Any]) -> str:
        """生成执行摘要"""
        summary = """
# 投标方案执行摘要

## 方案概述
本投标方案基于对招标文件的深入分析，结合行业最佳实践，为您提供全面的技术、商务和实施解决方案。

## 核心优势
- 技术先进：采用业界领先的技术架构
- 商务合理：具有竞争力的价格和灵活的付款方式
- 实施可靠：详细的风险应对和质量保证措施

## 承诺
我们承诺按时高质量完成项目，确保客户满意。
"""
        return summary
    
    def review_and_refine_content(self, content: Dict[str, Any], 
                                feedback: Dict[str, Any]) -> Dict[str, Any]:
        """根据反馈审阅和优化内容"""
        refined_content = content.copy()
        
        # 根据反馈进行优化
        if feedback.get("technical_feedback"):
            refined_content["technical"] = self._refine_technical_content(
                content.get("technical", {}), 
                feedback["technical_feedback"]
            )
        
        if feedback.get("commercial_feedback"):
            refined_content["commercial"] = self._refine_commercial_content(
                content.get("commercial", {}), 
                feedback["commercial_feedback"]
            )
        
        return refined_content
    
    # 辅助方法
    def _generate_architecture_section(self, requirements: Dict[str, Any], 
                                     knowledge: Dict[str, Any]) -> str:
        """生成架构章节"""
        return f"""
## 系统架构设计

基于{requirements.get('technical', [])}要求，我们采用分层架构设计：
- 表现层：响应式Web界面
- 业务层：微服务架构
- 数据层：分布式数据库

架构优势：{knowledge.get('advantages', '高可用、易扩展')}
"""
    
    def _generate_functionality_section(self, requirements: Dict[str, Any],
                                      knowledge: Dict[str, Any]) -> str:
        """生成功能章节"""
        return f"""
## 功能实现方案

核心功能实现：
{chr(10).join(f'- {req}' for req in requirements.get('technical', []))}

技术特色：基于{knowledge.get('technologies', '最新技术栈')}实现
"""
    
    def _generate_performance_section(self, requirements: Dict[str, Any],
                                   knowledge: Dict[str, Any]) -> str:
        """生成性能章节"""
        return """
## 性能保证

性能指标：
- 响应时间：< 2秒
- 并发用户：支持1000+并发
- 可用性：99.9%以上

性能优化策略：缓存、负载均衡、数据库优化
"""
    
    def _generate_advantages_section(self, requirements: Dict[str, Any],
                                   knowledge: Dict[str, Any]) -> str:
        """生成优势章节"""
        return """
## 技术优势

我们的技术优势：
1. 成熟的技术栈和丰富的项目经验
2. 强大的技术团队和持续的创新能力
3. 完善的质量保证体系和售后支持
"""
    
    def _generate_pricing_strategy(self, requirements: Dict[str, Any],
                                analysis: Dict[str, Any]) -> str:
        """生成定价策略"""
        return """
## 定价策略

采用分层定价模式：
- 基础版：满足核心需求
- 专业版：包含高级功能
- 企业版：全方位解决方案

定价原则：性价比最优，价值最大化
"""
    
    def _generate_payment_terms(self, requirements: Dict[str, Any],
                              analysis: Dict[str, Any]) -> str:
        """生成付款条款"""
        return """
## 付款方式

分期付款方案：
- 合同签订：30%
- 中期验收：40%
- 最终验收：30%

支持灵活的付款方式协商
"""
    
    def _generate_warranty_support(self, requirements: Dict[str, Any],
                                 analysis: Dict[str, Any]) -> str:
        """生成保修支持"""
        return """
## 保修与支持

服务承诺：
- 免费保修期：12个月
- 7×24小时技术支持
- 定期维护和升级服务
"""
    
    def _generate_commercial_advantages(self, requirements: Dict[str, Any],
                                      analysis: Dict[str, Any]) -> str:
        """生成商务优势"""
        return """
## 商务优势

我们的优势：
- 丰富的行业经验和成功案例
- 灵活的商务条款和合作模式
- 长期合作的诚意和承诺
"""
    
    def _generate_timeline(self, requirements: Dict[str, Any],
                         risks: Dict[str, Any]) -> str:
        """生成时间计划"""
        return """
## 项目时间计划

项目实施阶段：
1. 需求分析：2周
2. 设计开发：8周
3. 测试验收：2周
4. 部署上线：1周

总周期：13周
"""
    
    def _generate_resource_plan(self, requirements: Dict[str, Any],
                             risks: Dict[str, Any]) -> str:
        """生成资源计划"""
        return """
## 资源分配

项目团队：
- 项目经理：1人
- 开发工程师：3人
- 测试工程师：1人
- 技术支持：1人

确保项目资源充足
"""
    
    def _generate_risk_mitigation(self, requirements: Dict[str, Any],
                                risks: Dict[str, Any]) -> str:
        """生成风险应对"""
        return """
## 风险应对措施

主要风险应对：
- 技术风险：技术预研和原型验证
- 进度风险：严格的项目管理和进度控制
- 质量风险：多层次的质量保证体系
"""
    
    def _generate_quality_plan(self, requirements: Dict[str, Any],
                             risks: Dict[str, Any]) -> str:
        """生成质量计划"""
        return """
## 质量保证计划

质量保证措施：
- 代码审查和单元测试
- 集成测试和系统测试
- 用户验收测试和性能测试

确保交付质量符合标准
"""
    
    def _refine_technical_content(self, technical_content: Dict[str, Any],
                               feedback: str) -> Dict[str, Any]:
        """优化技术内容"""
        # 简化的优化逻辑
        refined = technical_content.copy()
        if "详细" in feedback:
            # 增加细节
            pass
        return refined
    
    def _refine_commercial_content(self, commercial_content: Dict[str, Any],
                                feedback: str) -> Dict[str, Any]:
        """优化商务内容"""
        # 简化的优化逻辑
        refined = commercial_content.copy()
        if "灵活" in feedback:
            # 增加灵活性
            pass
        return refined