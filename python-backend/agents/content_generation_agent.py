# cSpell:ignore autogen agentchat
from typing import Dict, Any
from autogen_agentchat.agents import AssistantAgent
from .base_agent import BaseAgent
from .prompt_templates import ContentGenerationPrompt


class ContentGenerationAgent(BaseAgent):
    """内容生成代理 - 基于AutoGen原生框架"""

    def __init__(self, tenant_id: str, config: Dict[str, Any]):
        super().__init__(tenant_id, config)
        self.config = config

    def _create_autogen_agent(self) -> AssistantAgent:
        """创建AutoGen代理实例"""
        # 使用标准化的高质量提示词
        system_message = ContentGenerationPrompt.get_system_message()

        agent = AssistantAgent(
            name=f"content_generator_{self.tenant_id}",
            model_client=self.model_client,
            system_message=system_message
        )

        return agent

    async def _execute_impl(
        self, 
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """执行内容生成任务"""
        operation = input_data.get("operation", "generate_content")
        requirements = input_data.get("requirements", {})
        knowledge = input_data.get("knowledge", {})
        analysis = input_data.get("analysis", {})
        risks = input_data.get("risks", {})
        all_content = input_data.get("all_content", {})
        feedback = input_data.get("feedback", {})

        try:
            if operation == "generate_technical_proposal":
                result = self.generate_technical_proposal(requirements, 
                                                          knowledge)
            elif operation == "generate_commercial_proposal":
                result = self.generate_commercial_proposal(requirements, 
                                                           analysis)
            elif operation == "generate_implementation_plan":
                result = self.generate_implementation_plan(requirements, 
                                                           risks)
            elif operation == "generate_executive_summary":
                result = {"summary": self.generate_executive_summary(
                    all_content)}
            elif operation == "review_and_refine_content":
                result = self.review_and_refine_content(all_content, 
                                                        feedback)
            else:
                # 默认操作
                result = self.generate_technical_proposal(requirements, 
                                                          knowledge)

            return result

        except Exception as error:
            raise RuntimeError(
                f"Content generation failed: {str(error)}"
            ) from error

    async def generate_technical_proposal(
        self,
        requirements: Dict[str, Any],
        knowledge: Dict[str, Any]
    ) -> Dict[str, Any]:
        """生成技术方案 - 使用LLM动态生成"""
        try:
            import json
            
            # 构建详细的生成提示词
            generation_prompt = f"""
基于以下招标需求和知识库信息，生成专业的技术方案：

【招标需求】
{json.dumps(requirements, ensure_ascii=False, indent=2)}

【相关知识】
{json.dumps(knowledge, ensure_ascii=False, indent=2)}

【生成要求】
请生成包含以下四个部分的技术方案（每部分500-800字）：

1. 系统架构（architecture）：
   - 详细说明技术架构设计
   - 包括层次划分、技术选型、扩展性设计
   - 突出架构的先进性和合理性

2. 功能实现（functionality）：
   - 逐项说明如何实现招标要求的功能
   - 提供具体的实现方案和技术路线
   - 体现功能的完整性和创新性

3. 性能保证（performance）：
   - 提供具体的性能指标和承诺
   - 说明性能优化策略和技术手段
   - 确保满足或超越招标要求

4. 技术优势（technical_advantages）：
   - 突出我们的技术特色和竞争优势
   - 说明技术团队和项目经验
   - 体现技术实力和创新能力

请使用Markdown格式，专业、具体、有说服力。避免空洞的套话。
"""
            
            # 使用LLM生成内容
            response = await self._chat_with_agent(
                generation_prompt,
                temperature=0.7,  # 适中的创造性
                max_tokens=3000   # 足够的输出长度
            )
            
            # 解析生成的内容
            technical_content = self._parse_technical_content(response)
            
            # 质量检查
            quality_score = self._assess_content_quality(technical_content)
            
            if quality_score < 0.7:
                # 如果质量不够，提供反馈重新生成
                refinement_prompt = f"""
之前生成的技术方案质量评分为{quality_score:.2f}，需要改进。

【之前的内容】
{response[:1000]}...

【改进要求】
1. 增加技术细节和专业性
2. 提供更具体的实现方案
3. 突出技术优势和创新点
4. 确保内容与需求高度匹配

请重新生成改进后的技术方案。
"""
                response = await self._chat_with_agent(refinement_prompt)
                technical_content = self._parse_technical_content(response)
            
            return {
                "success": True,
                "content": technical_content,
                "sections": list(technical_content.keys()),
                "quality_score": quality_score,
                "word_count": len(response)
            }
        except Exception as e:
            # 降级到模板方案
            technical_content = {
                "architecture": self._generate_architecture_section(
                    requirements,
                    knowledge
                ),
                "functionality": self._generate_functionality_section(
                    requirements,
                    knowledge
                ),
                "performance": self._generate_performance_section(
                    requirements,
                    knowledge
                ),
                "technical_advantages": self._generate_advantages_section(
                    requirements,
                    knowledge
                )
            }
            return {
                "success": True,
                "content": technical_content,
                "sections": list(technical_content.keys()),
                "fallback": True,
                "error": str(e)
            }

    async def generate_commercial_proposal(
        self,
        requirements: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """生成商务方案 - 使用LLM动态生成"""
        try:
            import json
            
            commercial_prompt = f"""
基于以下招标需求和分析结果，生成专业的商务方案：

【招标需求】
{json.dumps(requirements, ensure_ascii=False, indent=2)[:1500]}

【分析结果】
{json.dumps(analysis, ensure_ascii=False, indent=2)[:1000]}

【生成要求】
请生成包含以下内容的商务方案（1500-2000字）：

1. **定价策略**
   - 总体报价策略和依据
   - 成本构成和利润空间
   - 价格竞争力分析
   - 优惠政策和折扣方案

2. **付款条款**
   - 付款方式和周期
   - 付款节点和比例
   - 发票开具说明

3. **质保服务**
   - 质保期限和范围
   - 质保服务内容
   - 响应时间承诺

4. **商务优势**
   - 我方商务优势
   - 合作保障措施
   - 增值服务

请使用专业、清晰的语言，突出竞争优势。
"""
            
            response = await self._chat_with_agent(
                commercial_prompt,
                temperature=0.7,
                max_tokens=3000
            )
            
            # 解析商务内容
            commercial_content = self._parse_commercial_content(response)
            
            # 质量检查
            quality_score = await self._assess_content_quality(commercial_content)
            
            if quality_score < 0.7:
                # 质量不足，重新生成
                response = await self._chat_with_agent(
                    commercial_prompt + "\n\n请提供更详细和专业的商务方案。",
                    temperature=0.8,
                    max_tokens=3000
                )
                commercial_content = self._parse_commercial_content(response)
            
            return {
                "success": True,
                "content": commercial_content,
                "quality_score": quality_score
            }
            
        except Exception as e:
            # 降级到规则基础生成
            commercial_content = {
                "pricing_strategy": self._generate_pricing_strategy(
                    requirements,
                    analysis
                ),
                "payment_terms": self._generate_payment_terms(
                    requirements,
                    analysis
                ),
                "warranty_support": self._generate_warranty_support(
                    requirements,
                    analysis
                ),
                "commercial_advantages": self._generate_commercial_advantages(
                    requirements,
                    analysis
                )
            }

            return {
                "success": True,
                "content": commercial_content,
                "sections": list(commercial_content.keys()),
                "fallback": True
            }

    async def generate_implementation_plan(
        self,
        requirements: Dict[str, Any],
        risks: Dict[str, Any]
    ) -> Dict[str, Any]:
        """生成实施计划 - 使用LLM动态生成"""
        try:
            import json
            
            implementation_prompt = f"""
基于以下招标需求和风险评估，生成详细的实施计划：

【招标需求】
{json.dumps(requirements, ensure_ascii=False, indent=2)[:1500]}

【风险评估】
{json.dumps(risks, ensure_ascii=False, indent=2)[:1000]}

【生成要求】
请生成包含以下内容的实施计划（1500-2000字）：

1. **项目时间表**
   - 项目阶段划分
   - 关键里程碑
   - 时间节点安排
   - 交付计划

2. **资源配置**
   - 人力资源安排
   - 设备资源配置
   - 预算分配
   - 资源保障措施

3. **风险应对**
   - 主要风险识别
   - 应对策略
   - 应急预案
   - 风险监控机制

4. **质量保障**
   - 质量管理体系
   - 质量控制措施
   - 测试验收标准
   - 持续改进机制

请确保计划具体、可执行、有保障。
"""
            
            response = await self._chat_with_agent(
                implementation_prompt,
                temperature=0.7,
                max_tokens=3000
            )
            
            # 解析实施计划
            implementation_content = self._parse_implementation_content(response)
            
            # 质量检查
            quality_score = await self._assess_content_quality(implementation_content)
            
            if quality_score < 0.7:
                # 质量不足，重新生成
                response = await self._chat_with_agent(
                    implementation_prompt + "\n\n请提供更详细和可执行的实施计划。",
                    temperature=0.8,
                    max_tokens=3000
                )
                implementation_content = self._parse_implementation_content(response)
            
            return {
                "success": True,
                "content": implementation_content,
                "quality_score": quality_score
            }
            
        except Exception as e:
            # 降级到规则基础生成
            implementation_content = {
                "project_timeline": self._generate_timeline(
                    requirements,
                    risks
                ),
                "resource_allocation": self._generate_resource_plan(
                    requirements,
                    risks
                ),
                "risk_mitigation": self._generate_risk_mitigation(
                    requirements,
                    risks
                ),
                "quality_assurance": self._generate_quality_plan(
                    requirements,
                    risks
                )
            }

            return {
                "success": True,
                "content": implementation_content,
                "sections": list(implementation_content.keys()),
                "fallback": True
            }

    async def generate_executive_summary(
        self,
        all_content: Dict[str, Any]
    ) -> str:
        """生成执行摘要 - 使用LLM动态生成"""
        try:
            import json
            
            summary_prompt = f"""
基于以下完整的投标方案内容，生成简洁有力的执行摘要：

【投标方案内容】
{json.dumps(all_content, ensure_ascii=False, indent=2)[:2000]}

【生成要求】
请生成一份执行摘要（500-800字），包含：

1. **项目概述**
   - 项目背景和目标
   - 我方理解和定位

2. **解决方案亮点**
   - 技术方案核心优势
   - 创新点和差异化
   - 成功案例支撑

3. **商务优势**
   - 价格竞争力
   - 服务保障
   - 合作价值

4. **实施保障**
   - 团队实力
   - 实施计划
   - 风险控制

5. **总结陈述**
   - 核心竞争力
   - 合作承诺
   - 预期成果

请使用简洁、有力、专业的语言，突出核心优势和价值主张。
"""
            
            summary = await self._chat_with_agent(
                summary_prompt,
                temperature=0.7,
                max_tokens=1500
            )
            
            return summary
            
        except Exception as e:
            # 降级到简单摘要
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

    def review_and_refine_content(
        self,
        content: Dict[str, Any],
        feedback: Dict[str, Any]
    ) -> Dict[str, Any]:
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
    def _generate_architecture_section(
        self,
        requirements: Dict[str, Any],
        knowledge: Dict[str, Any]
    ) -> str:
        """生成架构章节"""
        return f"""
## 系统架构设计

基于{requirements.get('technical', [])}要求，我们采用分层架构设计：
- 表现层：响应式Web界面
- 业务层：微服务架构
- 数据层：分布式数据库

架构优势：{knowledge.get('advantages', '高可用、易扩展')}
"""

    def _generate_functionality_section(
        self,
        requirements: Dict[str, Any],
        knowledge: Dict[str, Any]
    ) -> str:
        """生成功能章节"""
        return f"""
## 功能实现方案

核心功能实现：
{chr(10).join(f'- {req}' for req in requirements.get('technical', []))}

技术特色：基于{knowledge.get('technologies', '最新技术栈')}实现
"""

    def _generate_performance_section(
        self,
        requirements: Dict[str, Any],
        knowledge: Dict[str, Any]
    ) -> str:
        """生成性能章节"""
        return """
## 性能保证

性能指标：
- 响应时间：< 2秒
- 并发用户：支持1000+并发
- 可用性：99.9%以上

性能优化策略：缓存、负载均衡、数据库优化
"""

    def _generate_advantages_section(
        self,
        requirements: Dict[str, Any],
        knowledge: Dict[str, Any]
    ) -> str:
        """生成优势章节"""
        return """
## 技术优势

我们的技术优势：
1. 成熟的技术栈和丰富的项目经验
2. 强大的技术团队和持续的创新能力
3. 完善的质量保证体系和售后支持
"""

    def _generate_pricing_strategy(
        self,
        requirements: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> str:
        """生成定价策略"""
        return """
## 定价策略

采用分层定价模式：
- 基础版：满足核心需求
- 专业版：包含高级功能
- 企业版：全方位解决方案

定价原则：性价比最优，价值最大化
"""

    def _generate_payment_terms(
        self,
        requirements: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> str:
        """生成付款条款"""
        return """
## 付款方式

分期付款方案：
- 合同签订：30%
- 中期验收：40%
- 最终验收：30%

支持灵活的付款方式协商
"""

    def _generate_warranty_support(
        self,
        requirements: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> str:
        """生成保修支持"""
        return """
## 保修与支持

服务承诺：
- 免费保修期：12个月
- 7×24小时技术支持
- 定期维护和升级服务
"""

    def _generate_commercial_advantages(
        self,
        requirements: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> str:
        """生成商务优势"""
        return """
## 商务优势

我们的优势：
- 丰富的行业经验和成功案例
- 灵活的商务条款和合作模式
- 长期合作的诚意和承诺
"""

    def _generate_timeline(
        self,
        requirements: Dict[str, Any],
        risks: Dict[str, Any]
    ) -> str:
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

    def _generate_resource_plan(
        self,
        requirements: Dict[str, Any],
        risks: Dict[str, Any]
    ) -> str:
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

    def _generate_risk_mitigation(
        self,
        requirements: Dict[str, Any],
        risks: Dict[str, Any]
    ) -> str:
        """生成风险应对"""
        return """
## 风险应对措施

主要风险应对：
- 技术风险：技术预研和原型验证
- 进度风险：严格的项目管理和进度控制
- 质量风险：多层次的质量保证体系
"""

    def _generate_quality_plan(
        self,
        requirements: Dict[str, Any],
        risks: Dict[str, Any]
    ) -> str:
        """生成质量计划"""
        return """
## 质量保证计划

质量保证措施：
- 代码审查和单元测试
- 集成测试和系统测试
- 用户验收测试和性能测试

确保交付质量符合标准
"""

    def _refine_technical_content(
        self,
        technical_content: Dict[str, Any],
        feedback: str
    ) -> Dict[str, Any]:
        """优化技术内容"""
        # 简化的优化逻辑
        refined = technical_content.copy()
        if "详细" in feedback:
            # 增加细节
            pass
        return refined

    def _refine_commercial_content(
        self,
        commercial_content: Dict[str, Any],
        feedback: str
    ) -> Dict[str, Any]:
        """优化商务内容"""
        # 简化的优化逻辑
        refined = commercial_content.copy()
        if "灵活" in feedback:
            # 增加灵活性
            pass
        return refined
    
    def _parse_technical_content(self, response: str) -> Dict[str, Any]:
        """解析LLM生成的技术内容"""
        # 尝试按章节分割内容
        sections = {
            "architecture": "",
            "functionality": "",
            "performance": "",
            "technical_advantages": ""
        }
        
        # 简单的章节识别
        if "系统架构" in response or "架构设计" in response:
            # 提取架构部分
            import re
            arch_match = re.search(
                r'(?:系统架构|架构设计).*?(?=功能实现|$)', 
                response, 
                re.DOTALL
            )
            if arch_match:
                sections["architecture"] = arch_match.group().strip()
        
        if "功能实现" in response or "功能方案" in response:
            func_match = re.search(
                r'(?:功能实现|功能方案).*?(?=性能保证|$)', 
                response, 
                re.DOTALL
            )
            if func_match:
                sections["functionality"] = func_match.group().strip()
        
        if "性能保证" in response or "性能指标" in response:
            perf_match = re.search(
                r'(?:性能保证|性能指标).*?(?=技术优势|$)', 
                response, 
                re.DOTALL
            )
            if perf_match:
                sections["performance"] = perf_match.group().strip()
        
        if "技术优势" in response:
            adv_match = re.search(
                r'技术优势.*$', 
                response, 
                re.DOTALL
            )
            if adv_match:
                sections["technical_advantages"] = adv_match.group().strip()
        
        # 如果没有明确的章节，将整个响应作为架构部分
        if not any(sections.values()):
            sections["architecture"] = response
        
        return sections
    
    def _assess_content_quality(self, content: Dict[str, Any]) -> float:
        """评估内容质量"""
        score = 0.0
        total_checks = 0
        
        # 检查内容完整性
        for section, text in content.items():
            total_checks += 1
            if text and len(text) > 100:  # 至少100字符
                score += 0.25
        
        # 检查专业术语
        professional_terms = [
            "架构", "系统", "技术", "方案", "实现", 
            "性能", "优化", "设计", "开发", "部署"
        ]
        for section, text in content.items():
            if text:
                term_count = sum(1 for term in professional_terms if term in text)
                if term_count >= 3:
                    score += 0.05
        
        # 检查内容长度
        total_length = sum(len(text) for text in content.values())
        if total_length > 1000:
            score += 0.1
        if total_length > 2000:
            score += 0.1
        
        return min(score, 1.0)
    def _pa
rse_commercial_content(self, response: str) -> Dict[str, Any]:
        """解析商务内容"""
        import re
        
        sections = {
            "pricing_strategy": "",
            "payment_terms": "",
            "warranty_support": "",
            "commercial_advantages": ""
        }
        
        # 尝试提取各个章节
        if "定价策略" in response:
            pricing_match = re.search(
                r'(?:定价策略|报价策略).*?(?=付款条款|质保服务|商务优势|$)', 
                response, 
                re.DOTALL
            )
            if pricing_match:
                sections["pricing_strategy"] = pricing_match.group().strip()
        
        if "付款条款" in response or "付款方式" in response:
            payment_match = re.search(
                r'(?:付款条款|付款方式).*?(?=质保服务|商务优势|$)', 
                response, 
                re.DOTALL
            )
            if payment_match:
                sections["payment_terms"] = payment_match.group().strip()
        
        if "质保服务" in response or "质保" in response:
            warranty_match = re.search(
                r'(?:质保服务|质保).*?(?=商务优势|$)', 
                response, 
                re.DOTALL
            )
            if warranty_match:
                sections["warranty_support"] = warranty_match.group().strip()
        
        if "商务优势" in response or "优势" in response:
            adv_match = re.search(
                r'(?:商务优势|优势).*$', 
                response, 
                re.DOTALL
            )
            if adv_match:
                sections["commercial_advantages"] = adv_match.group().strip()
        
        # 如果没有明确的章节，将整个响应作为定价策略部分
        if not any(sections.values()):
            sections["pricing_strategy"] = response
        
        return sections
    
    def _parse_implementation_content(self, response: str) -> Dict[str, Any]:
        """解析实施计划内容"""
        import re
        
        sections = {
            "project_timeline": "",
            "resource_allocation": "",
            "risk_mitigation": "",
            "quality_assurance": ""
        }
        
        # 尝试提取各个章节
        if "项目时间表" in response or "时间表" in response:
            timeline_match = re.search(
                r'(?:项目时间表|时间表).*?(?=资源配置|风险应对|质量保障|$)', 
                response, 
                re.DOTALL
            )
            if timeline_match:
                sections["project_timeline"] = timeline_match.group().strip()
        
        if "资源配置" in response or "资源" in response:
            resource_match = re.search(
                r'(?:资源配置|资源).*?(?=风险应对|质量保障|$)', 
                response, 
                re.DOTALL
            )
            if resource_match:
                sections["resource_allocation"] = resource_match.group().strip()
        
        if "风险应对" in response or "风险" in response:
            risk_match = re.search(
                r'(?:风险应对|风险).*?(?=质量保障|$)', 
                response, 
                re.DOTALL
            )
            if risk_match:
                sections["risk_mitigation"] = risk_match.group().strip()
        
        if "质量保障" in response or "质量" in response:
            quality_match = re.search(
                r'(?:质量保障|质量).*$', 
                response, 
                re.DOTALL
            )
            if quality_match:
                sections["quality_assurance"] = quality_match.group().strip()
        
        # 如果没有明确的章节，将整个响应作为项目时间表部分
        if not any(sections.values()):
            sections["project_timeline"] = response
        
        return sections
