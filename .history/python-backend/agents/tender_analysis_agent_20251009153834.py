"""
招标分析代理 - 基于AutoGen原生框架
"""

import re
from typing import Dict, Any, List

from autogen_agentchat.agents import AssistantAgent

from monitoring.logger import logger as monitoring_logger

from .base_agent import BaseAgent


class TenderAnalysisAgent(BaseAgent):
    """招标分析代理 - 基于AutoGen原生框架"""
    
    def __init__(self, tenant_id: str, config: Dict[str, Any]):
        super().__init__(tenant_id, config)
        self.config = config
        
    def _create_autogen_agent(self) -> AssistantAgent:
        """创建AutoGen代理实例"""
        # 系统消息定义代理的专业能力
        system_message = """你是一个专业的招标文件分析专家。你的主要职责是：
1. 分析招标文档，提取关键需求和规格要求
2. 识别技术规范、商务条款和合规要求
3. 评估投标的可行性和风险
4. 生成详细的需求分析报告

请确保分析全面、准确，为后续投标内容生成提供坚实的基础。"""

        return AssistantAgent(
            name=f"tender_analyst_{self.tenant_id}",
            model_client=self.model_client,
            system_message=system_message
        )

    async def _execute_impl(
        self, 
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """实际的代理执行逻辑"""
        document = input_data.get("document", "")
        operation_type = input_data.get("operation", "full_analysis")
        
        tenant_logger = monitoring_logger.with_tenant(self.tenant_id)
        
        try:
            if operation_type == "analyze_document":
                return self.analyze_tender_document(document)
            elif operation_type == "extract_requirements":
                return self.extract_requirements(document)
            elif operation_type == "assess_risks":
                requirements = input_data.get("requirements", {})
                return self.assess_risks(requirements)
            else:
                # Full analysis workflow
                analysis = self.analyze_tender_document(document)
                requirements = self.extract_requirements(document)
                risks = self.assess_risks(requirements)
                
                analysis_data = {
                    "analysis": analysis,
                    "requirements": requirements,
                    "risks": risks
                }
                
                report = self.generate_analysis_report(analysis_data)
                
                return {
                    "analysis": analysis,
                    "requirements": requirements,
                    "risks": risks,
                    "report": report,
                    "input_tokens": len(document.split()) if document else 0,
                    "output_tokens": len(report.split()) if report else 0
                }
            
        except Exception as error:
            tenant_logger.error("Tender analysis failed", {
                "component": "tender-analysis-agent",
                "operation": operation_type
            }, error)
            raise
    
    def analyze_tender_document(self, document: str) -> Dict[str, Any]:
        """分析招标文档主函数"""
        try:
            # 这里可以集成文档解析逻辑
            return {
                "document_type": self._classify_document_type(document),
                "key_sections": self._extract_key_sections(document),
                "deadline": self._extract_deadline(document),
                "budget_range": self._extract_budget_info(document)
            }
        except Exception as e:
            return {"error": str(e)}
    
    def extract_requirements(self, document: str) -> Dict[str, Any]:
        """提取具体需求"""
        # 实现需求提取逻辑
        return {
            "technical": self._extract_technical_requirements(document),
            "commercial": self._extract_commercial_requirements(document),
            "compliance": self._extract_compliance_requirements(document)
        }
    
    def assess_risks(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """评估投标风险"""
        return {
            "technical_risks": self._assess_technical_risks(requirements),
            "commercial_risks": self._assess_commercial_risks(requirements),
            "timeline_risks": self._assess_timeline_risks(requirements)
        }
    
    def generate_analysis_report(self, analysis_data: Dict[str, Any]) -> str:
        """生成分析报告"""
        report = f"""
# 招标文件分析报告

## 文档概况
- 文档类型: {analysis_data.get('document_type', '未知')}
- 关键章节: {', '.join(analysis_data.get('key_sections', []))}

## 需求分析
{self._format_requirements(analysis_data.get('requirements', {}))}

## 风险评估
{self._format_risks(analysis_data.get('risks', {}))}

## 建议
基于分析结果，建议重点关注以上风险点，并在投标内容中充分体现应对策略。
"""
        return report
    
    # 辅助方法
    def _classify_document_type(self, document: str) -> str:
        """分类文档类型"""
        # 简化的分类逻辑
        if "招标" in document and "技术" in document:
            return "技术招标"
        elif "招标" in document and "服务" in document:
            return "服务招标"
        else:
            return "通用招标"
    
    def _extract_key_sections(self, document: str) -> List[str]:
        """提取关键章节"""
        sections = []
        if "技术要求" in document:
            sections.append("技术要求")
        if "商务条款" in document:
            sections.append("商务条款")
        if "评标标准" in document:
            sections.append("评标标准")
        return sections
    
    def _extract_deadline(self, document: str) -> str:
        """提取截止日期"""
        # 简化的日期提取逻辑
        date_pattern = r'\d{4}年\d{1,2}月\d{1,2}日'
        dates = re.findall(date_pattern, document)
        return dates[0] if dates else "未明确"
    
    def _extract_budget_info(self, document: str) -> str:
        """提取预算信息"""
        # 简化的预算提取逻辑
        if "预算" in document:
            return "有预算信息"
        return "未明确"
    
    def _extract_technical_requirements(self, document: str) -> List[str]:
        """提取技术要求"""
        requirements = []
        # 简化的提取逻辑
        if "技术要求" in document:
            requirements.append("技术规格要求")
        if "性能指标" in document:
            requirements.append("性能指标要求")
        return requirements
    
    def _extract_commercial_requirements(self, document: str) -> List[str]:
        """提取商务要求"""
        requirements = []
        if "付款方式" in document:
            requirements.append("付款方式要求")
        if "交付时间" in document:
            requirements.append("交付时间要求")
        return requirements
    
    def _extract_compliance_requirements(self, document: str) -> List[str]:
        """提取合规要求"""
        requirements = []
        if "资质要求" in document:
            requirements.append("资质认证要求")
        if "标准规范" in document:
            requirements.append("标准规范要求")
        return requirements
    
    def _assess_technical_risks(
        self, 
        requirements: Dict[str, Any]
    ) -> List[str]:
        """评估技术风险"""
        risks = []
        tech_reqs = requirements.get("technical", [])
        if len(tech_reqs) > 5:
            risks.append("技术要求复杂，实施难度大")
        return risks
    
    def _assess_commercial_risks(
        self, 
        requirements: Dict[str, Any]
    ) -> List[str]:
        """评估商务风险"""
        risks = []
        if "付款方式要求" in requirements.get("commercial", []):
            risks.append("付款条件可能存在风险")
        return risks
    
    def _assess_timeline_risks(
        self, 
        requirements: Dict[str, Any]
    ) -> List[str]:
        """评估时间风险"""
        risks = []
        if "交付时间要求" in requirements.get("商业", []):
            risks.append("交付时间紧张，可能存在延期风险")
        return risks
    
    def _format_requirements(self, requirements: Dict[str, Any]) -> str:
        """格式化需求"""
        return "\n".join(f"- {req_type}: {', '.join(req_list)}" 
                         for req_type, req_list in requirements.items())
    
    def _format_risks(self, risks: Dict[str, Any]) -> str:
        """格式化风险"""
        return "\n".join(f"- {risk_type}: {', '.join(risk_list)}" 
                         for risk_type, risk_list in risks.items())