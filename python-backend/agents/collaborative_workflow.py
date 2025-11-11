"""
智能体协作工作流
实现智能体间的对话、反馈和协作机制
"""
from typing import Dict, Any, List, Optional
import asyncio
import json
from datetime import datetime

from .tender_analysis_agent import TenderAnalysisAgent
from .knowledge_retrieval_agent import KnowledgeRetrievalAgent
from .content_generation_agent import ContentGenerationAgent
from .compliance_verification_agent import ComplianceVerificationAgent


class CollaborativeWorkflow:
    """智能体协作工作流管理器"""
    
    def __init__(self, tenant_id: str, config: Dict[str, Any]):
        self.tenant_id = tenant_id
        self.config = config
        
        # 初始化智能体
        self.tender_analyst = TenderAnalysisAgent(tenant_id, config)
        self.knowledge_retriever = KnowledgeRetrievalAgent(tenant_id, config)
        self.content_generator = ContentGenerationAgent(tenant_id, config)
        self.compliance_verifier = ComplianceVerificationAgent(tenant_id, config)
        
        # 协作历史
        self.collaboration_history: List[Dict[str, Any]] = []
    
    async def execute_collaborative_workflow(
        self,
        tender_document: str,
        max_iterations: int = 3
    ) -> Dict[str, Any]:
        """执行协作工作流"""
        workflow_id = f"workflow_{self.tenant_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            # 第一阶段：分析和知识检索
            analysis_result = await self._phase_1_analysis(tender_document)
            
            # 第二阶段：协作内容生成
            content_result = await self._phase_2_collaborative_generation(
                analysis_result, max_iterations
            )
            
            # 第三阶段：最终验证和优化
            final_result = await self._phase_3_final_verification(
                analysis_result, content_result
            )
            
            return {
                "workflow_id": workflow_id,
                "success": True,
                "analysis": analysis_result,
                "content": content_result,
                "verification": final_result,
                "collaboration_history": self.collaboration_history
            }
            
        except Exception as e:
            return {
                "workflow_id": workflow_id,
                "success": False,
                "error": str(e),
                "collaboration_history": self.collaboration_history
            }
    
    async def _phase_1_analysis(self, tender_document: str) -> Dict[str, Any]:
        """第一阶段：分析和知识检索"""
        self._log_collaboration("phase_1_start", "开始分析阶段")
        
        # 并行执行分析和初步知识检索
        analysis_task = self.tender_analyst.process({
            "operation": "full_analysis",
            "document": tender_document
        })
        
        # 等待分析完成
        analysis_result = await analysis_task
        
        # 基于分析结果进行上下文知识检索
        knowledge_result = await self.knowledge_retriever.provide_contextual_knowledge({
            "requirements": analysis_result.get("requirements", {}),
            "analysis": analysis_result.get("analysis", {})
        })
        
        result = {
            "analysis": analysis_result,
            "knowledge": knowledge_result
        }
        
        self._log_collaboration("phase_1_complete", "分析阶段完成", result)
        return result
    
    async def _phase_2_collaborative_generation(
        self,
        analysis_result: Dict[str, Any],
        max_iterations: int
    ) -> Dict[str, Any]:
        """第二阶段：协作内容生成"""
        self._log_collaboration("phase_2_start", "开始协作生成阶段")
        
        requirements = analysis_result["analysis"].get("requirements", {})
        knowledge = analysis_result.get("knowledge", "")
        
        # 初始内容生成
        content = await self._generate_initial_content(requirements, knowledge)
        
        # 迭代优化循环
        for iteration in range(max_iterations):
            self._log_collaboration(
                "iteration_start", 
                f"开始第{iteration + 1}轮优化",
                {"iteration": iteration + 1}
            )
            
            # 合规验证
            verification = await self._verify_content(requirements, content)
            
            # 检查是否需要优化
            if self._is_content_acceptable(verification):
                self._log_collaboration(
                    "iteration_success", 
                    f"第{iteration + 1}轮优化成功，内容质量达标"
                )
                break
            
            # 生成改进建议
            improvement_suggestions = await self._generate_improvement_suggestions(
                verification, content
            )
            
            # 基于建议优化内容
            content = await self._refine_content(
                content, improvement_suggestions, requirements, knowledge
            )
            
            self._log_collaboration(
                "iteration_complete", 
                f"第{iteration + 1}轮优化完成",
                {"suggestions": improvement_suggestions}
            )
        
        result = {
            "content": content,
            "iterations": min(iteration + 1, max_iterations),
            "final_verification": verification
        }
        
        self._log_collaboration("phase_2_complete", "协作生成阶段完成", result)
        return result
    
    async def _phase_3_final_verification(
        self,
        analysis_result: Dict[str, Any],
        content_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """第三阶段：最终验证和优化"""
        self._log_collaboration("phase_3_start", "开始最终验证阶段")
        
        requirements = analysis_result["analysis"].get("requirements", {})
        content = content_result.get("content", {})
        
        # 全面合规验证
        final_verification = await self.compliance_verifier.process({
            "operation": "full_verification",
            "requirements": requirements,
            "content": content
        })
        
        # 生成最终报告
        final_report = await self._generate_final_report(
            analysis_result, content_result, final_verification
        )
        
        result = {
            "verification": final_verification,
            "report": final_report,
            "approval_status": self._determine_approval_status(final_verification)
        }
        
        self._log_collaboration("phase_3_complete", "最终验证阶段完成", result)
        return result
    
    async def _generate_initial_content(
        self,
        requirements: Dict[str, Any],
        knowledge: str
    ) -> Dict[str, Any]:
        """生成初始内容"""
        # 并行生成各部分内容
        tasks = []
        
        # 技术方案
        tasks.append(
            self.content_generator.generate_technical_proposal(
                requirements, 
                {"knowledge": knowledge}
            )
        )
        
        # 商务方案
        tasks.append(
            self.content_generator.generate_commercial_proposal(
                requirements, 
                {"knowledge": knowledge}
            )
        )
        
        # 实施计划
        tasks.append(
            self.content_generator.generate_implementation_plan(
                requirements, 
                {"risks": []}
            )
        )
        
        # 等待所有任务完成
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        content = {}
        if not isinstance(results[0], Exception):
            content["technical"] = results[0]
        if not isinstance(results[1], Exception):
            content["commercial"] = results[1]
        if not isinstance(results[2], Exception):
            content["implementation"] = results[2]
        
        return content
    
    async def _verify_content(
        self,
        requirements: Dict[str, Any],
        content: Dict[str, Any]
    ) -> Dict[str, Any]:
        """验证内容质量"""
        return await self.compliance_verifier.process({
            "operation": "full_verification",
            "requirements": requirements,
            "content": content
        })
    
    def _is_content_acceptable(self, verification: Dict[str, Any]) -> bool:
        """判断内容是否可接受"""
        overall_score = verification.get("overall_score", 0)
        coverage_rate = verification.get("coverage_analysis", {}).get("coverage_rate", 0)
        
        # 设定接受标准
        return overall_score >= 7.0 and coverage_rate >= 0.8
    
    async def _generate_improvement_suggestions(
        self,
        verification: Dict[str, Any],
        content: Dict[str, Any]
    ) -> List[str]:
        """生成改进建议"""
        try:
            suggestions_prompt = f"""
基于以下合规验证结果，生成具体的改进建议：

【验证结果】
{json.dumps(verification, ensure_ascii=False, indent=2)[:1500]}

【当前内容概要】
{json.dumps({k: str(v)[:200] + "..." for k, v in content.items()}, ensure_ascii=False, indent=2)}

【任务】
针对发现的问题，生成3-5个具体、可操作的改进建议。
每个建议应该：
1. 明确指出需要改进的部分
2. 提供具体的改进方向
3. 说明改进的预期效果

请以JSON数组格式返回：
["建议1", "建议2", "建议3"]
"""
            
            response = await self.content_generator._chat_with_agent(suggestions_prompt)
            
            # 解析建议列表
            import re
            json_match = re.search(r'\[.*?\]', response, re.DOTALL)
            if json_match:
                suggestions = json.loads(json_match.group())
                return suggestions
            else:
                # 降级方案
                return self._generate_fallback_suggestions(verification)
                
        except Exception as e:
            return self._generate_fallback_suggestions(verification)
    
    def _generate_fallback_suggestions(self, verification: Dict[str, Any]) -> List[str]:
        """生成降级建议"""
        suggestions = []
        
        issues = verification.get("issues", [])
        for issue in issues[:3]:
            suggestions.append(f"改进{issue.get('type', '内容')}：{issue.get('suggestion', '请完善相关内容')}")
        
        if not suggestions:
            suggestions.append("请完善内容的专业性和完整性")
        
        return suggestions
    
    async def _refine_content(
        self,
        content: Dict[str, Any],
        suggestions: List[str],
        requirements: Dict[str, Any],
        knowledge: str
    ) -> Dict[str, Any]:
        """基于建议优化内容"""
        refined_content = content.copy()
        
        for section, section_content in content.items():
            if section_content:
                refinement_prompt = f"""
请基于以下改进建议优化{section}部分的内容：

【当前内容】
{json.dumps(section_content, ensure_ascii=False, indent=2)[:1000]}

【改进建议】
{chr(10).join(f"- {suggestion}" for suggestion in suggestions)}

【需求参考】
{json.dumps(requirements, ensure_ascii=False, indent=2)[:1000]}

【知识参考】
{knowledge[:1000]}

请生成改进后的内容，保持原有结构，提升质量和完整性。
"""
                
                try:
                    refined_section = await self.content_generator._chat_with_agent(
                        refinement_prompt
                    )
                    # 这里可以添加更复杂的解析逻辑
                    refined_content[section] = {
                        "content": refined_section, 
                        "refined": True
                    }
                except Exception as e:
                    # 保持原内容
                    pass
        
        return refined_content
    
    async def _generate_final_report(
        self,
        analysis_result: Dict[str, Any],
        content_result: Dict[str, Any],
        verification_result: Dict[str, Any]
    ) -> str:
        """生成最终报告"""
        report_prompt = f"""
基于以下信息生成投标项目的最终报告：

【分析结果】
{json.dumps(analysis_result, ensure_ascii=False, indent=2)[:1000]}

【内容生成结果】
迭代次数：{content_result.get('iterations', 0)}
内容质量：已优化

【验证结果】
{json.dumps(verification_result, ensure_ascii=False, indent=2)[:1000]}

请生成一份简洁的项目报告（300-500字），包含：
1. 项目概况
2. 主要成果
3. 质量评估
4. 建议和下一步
"""
        
        try:
            report = await self.content_generator._chat_with_agent(report_prompt)
            return report
        except Exception as e:
            return f"项目报告生成完成。协作工作流执行成功，共进行{content_result.get('iterations', 0)}轮优化。"
    
    def _determine_approval_status(self, verification: Dict[str, Any]) -> str:
        """确定审批状态"""
        overall_score = verification.get("overall_score", 0)
        coverage_rate = verification.get("coverage_analysis", {}).get("coverage_rate", 0)
        
        if overall_score >= 8.0 and coverage_rate >= 0.9:
            return "approved"
        elif overall_score >= 6.0 and coverage_rate >= 0.7:
            return "needs_minor_revision"
        else:
            return "needs_major_revision"
    
    def _log_collaboration(
        self,
        event_type: str,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ):
        """记录协作历史"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "message": message,
            "data": data or {}
        }
        self.collaboration_history.append(log_entry)


class HumanInterventionManager:
    """人工干预管理器"""
    
    def __init__(self):
        self.intervention_points: List[Dict[str, Any]] = []
        self.user_feedback: List[Dict[str, Any]] = []
    
    def add_intervention_point(
        self,
        workflow_id: str,
        stage: str,
        content: Dict[str, Any],
        reason: str
    ):
        """添加人工干预点"""
        intervention = {
            "id": f"intervention_{len(self.intervention_points)}",
            "workflow_id": workflow_id,
            "stage": stage,
            "content": content,
            "reason": reason,
            "timestamp": datetime.now().isoformat(),
            "status": "pending"
        }
        self.intervention_points.append(intervention)
        return intervention["id"]
    
    def submit_user_feedback(
        self,
        intervention_id: str,
        feedback: Dict[str, Any]
    ):
        """提交用户反馈"""
        feedback_entry = {
            "intervention_id": intervention_id,
            "feedback": feedback,
            "timestamp": datetime.now().isoformat()
        }
        self.user_feedback.append(feedback_entry)
        
        # 更新干预点状态
        for intervention in self.intervention_points:
            if intervention["id"] == intervention_id:
                intervention["status"] = "completed"
                intervention["feedback"] = feedback
                break
    
    def get_pending_interventions(self) -> List[Dict[str, Any]]:
        """获取待处理的干预点"""
        return [
            intervention for intervention in self.intervention_points
            if intervention["status"] == "pending"
        ]
