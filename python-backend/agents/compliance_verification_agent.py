from autogen.agentchat import AssistantAgent
from typing import Dict, Any, List, Optional
import json

class ComplianceVerificationAgent(AssistantAgent):
    """合规验证代理 - 基于AutoGen原生框架"""
    
    def __init__(self, tenant_id: str, config: Dict[str, Any]):
        system_message = """你是一个专业的合规验证专家。你的主要职责是：
1. 验证投标内容是否符合招标要求和行业标准
2. 检查技术方案、商务条款的合规性
3. 识别潜在的风险和不符合项
4. 提供改进建议和优化方案

请确保验证全面、准确，为最终投标质量提供保障。"""
        
        llm_config = {
            "config_list": config.get("llm_config", []),
            "temperature": 0.1,
            "timeout": 600,
        }
        
        super().__init__(
            name=f"compliance_verifier_{tenant_id}",
            system_message=system_message,
            llm_config=llm_config,
            human_input_mode="NEVER"
        )
        
        self.tenant_id = tenant_id
        self.config = config
        
        # 注册函数调用
        self.register_function(
            function_map={
                "verify_technical_compliance": self.verify_technical_compliance,
                "verify_commercial_compliance": self.verify_commercial_compliance,
                "check_requirement_coverage": self.check_requirement_coverage,
                "assess_overall_quality": self.assess_overall_quality,
                "generate_compliance_report": self.generate_compliance_report
            }
        )
    
    def verify_technical_compliance(self, requirements: Dict[str, Any],
                                 content: Dict[str, Any]) -> Dict[str, Any]:
        """验证技术合规性"""
        compliance_results = {
            "met_requirements": [],
            "missing_requirements": [],
            "partial_requirements": [],
            "technical_issues": []
        }
        
        # 检查技术要求覆盖
        tech_requirements = requirements.get("technical", [])
        tech_content = content.get("technical", {})
        
        for req in tech_requirements:
            if self._is_requirement_covered(req, tech_content):
                compliance_results["met_requirements"].append(req)
            else:
                compliance_results["missing_requirements"].append(req)
        
        # 检查技术问题
        compliance_results["technical_issues"] = self._identify_technical_issues(tech_content)
        
        return compliance_results
    
    def verify_commercial_compliance(self, requirements: Dict[str, Any],
                                  content: Dict[str, Any]) -> Dict[str, Any]:
        """验证商务合规性"""
        compliance_results = {
            "commercial_standards": [],
            "pricing_issues": [],
            "contract_issues": [],
            "risk_items": []
        }
        
        # 检查商务标准
        commercial_content = content.get("commercial", {})
        compliance_results["commercial_standards"] = self._check_commercial_standards(commercial_content)
        
        # 检查定价问题
        compliance_results["pricing_issues"] = self._check_pricing_issues(commercial_content)
        
        # 检查合同条款
        compliance_results["contract_issues"] = self._check_contract_issues(commercial_content)
        
        # 风险评估
        compliance_results["risk_items"] = self._assess_commercial_risks(commercial_content)
        
        return compliance_results
    
    def check_requirement_coverage(self, requirements: Dict[str, Any],
                                content: Dict[str, Any]) -> Dict[str, Any]:
        """检查需求覆盖度"""
        coverage_analysis = {
            "total_requirements": 0,
            "covered_requirements": 0,
            "coverage_rate": 0.0,
            "coverage_details": {}
        }
        
        # 统计各类需求
        all_requirements = []
        for req_type, req_list in requirements.items():
            all_requirements.extend(req_list)
        
        coverage_analysis["total_requirements"] = len(all_requirements)
        
        # 检查覆盖情况
        covered_count = 0
        coverage_details = {}
        
        for req_type, req_list in requirements.items():
            coverage_details[req_type] = {
                "total": len(req_list),
                "covered": 0,
                "missing": []
            }
            
            for req in req_list:
                if self._is_requirement_covered(req, content):
                    coverage_details[req_type]["covered"] += 1
                    covered_count += 1
                else:
                    coverage_details[req_type]["missing"].append(req)
        
        coverage_analysis["covered_requirements"] = covered_count
        coverage_analysis["coverage_rate"] = float(covered_count) / max(1, coverage_analysis["total_requirements"])
        coverage_analysis["coverage_details"] = coverage_details
        
        return coverage_analysis
    
    def assess_overall_quality(self, content: Dict[str, Any],
                            compliance_results: Dict[str, Any]) -> Dict[str, Any]:
        """评估整体质量"""
        quality_assessment = {
            "overall_score": 0,
            "technical_score": 0,
            "commercial_score": 0,
            "compliance_score": 0,
            "recommendations": []
        }
        
        # 技术质量评分
        tech_coverage = compliance_results.get("technical_coverage", {})
        tech_score = self._calculate_technical_score(tech_coverage)
        quality_assessment["technical_score"] = tech_score
        
        # 商务质量评分
        commercial_coverage = compliance_results.get("commercial_coverage", {})
        commercial_score = self._calculate_commercial_score(commercial_coverage)
        quality_assessment["commercial_score"] = commercial_score
        
        # 合规性评分
        compliance_score = self._calculate_compliance_score(compliance_results)
        quality_assessment["compliance_score"] = compliance_score
        
        # 综合评分
        overall_score = (
            tech_score * 0.4 +
            commercial_score * 0.3 +
            compliance_score * 0.3
        )
        quality_assessment["overall_score"] = overall_score
        
        # 生成建议
        quality_assessment["recommendations"] = self._generate_recommendations(
            content, compliance_results, quality_assessment
        )
        
        return quality_assessment
    
    def generate_compliance_report(self, verification_results: Dict[str, Any]) -> str:
        """生成合规报告"""
        overall_score = verification_results.get('overall_score', 0)
        technical_score = verification_results.get('technical_score', 0)
        commercial_score = verification_results.get('commercial_score', 0)
        
        report = f"""
# 合规验证报告

## 总体评估
- 综合评分: {overall_score:.1f}/10
- 技术合规: {technical_score:.1f}/10
- 商务合规: {commercial_score:.1f}/10

## 详细分析
{self._format_compliance_details(verification_results)}

## 改进建议
{self._format_recommendations(verification_results)}
"""
        return report
    
    def _is_requirement_covered(self, requirement: str, content: Dict[str, Any]) -> bool:
        """检查需求是否被覆盖"""
        content_text = json.dumps(content, ensure_ascii=False)
        return requirement.lower() in content_text.lower()
    
    def _identify_technical_issues(self, tech_content: Dict[str, Any]) -> List[str]:
        """识别技术问题"""
        issues = []
        if not tech_content.get("architecture"):
            issues.append("缺少系统架构设计")
        if not tech_content.get("performance"):
            issues.append("缺少性能指标说明")
        return issues
    
    def _check_commercial_standards(self, commercial_content: Dict[str, Any]) -> List[str]:
        """检查商务标准"""
        standards = []
        if commercial_content.get("pricing_strategy"):
            standards.append("定价策略符合行业标准")
        if commercial_content.get("payment_terms"):
            standards.append("付款条款合理")
        return standards
    
    def _check_pricing_issues(self, commercial_content: Dict[str, Any]) -> List[str]:
        """检查定价问题"""
        issues = []
        pricing = commercial_content.get("pricing_strategy", "")
        if not pricing or "合理" not in pricing:
            issues.append("定价策略需要进一步优化")
        return issues
    
    def _check_contract_issues(self, commercial_content: Dict[str, Any]) -> List[str]:
        """检查合同问题"""
        issues = []
        if not commercial_content.get("warranty_support"):
            issues.append("缺少保修支持说明")
        return issues
    
    def _assess_commercial_risks(self, commercial_content: Dict[str, Any]) -> List[str]:
        """评估商务风险"""
        risks = []
        if "灵活" not in json.dumps(commercial_content, ensure_ascii=False):
            risks.append("商务条款灵活性不足")
        return risks
    
    def _calculate_technical_score(self, tech_coverage: Dict[str, Any]) -> float:
        """计算技术评分"""
        coverage_rate = tech_coverage.get("coverage_rate", 0)
        return coverage_rate * 10
    
    def _calculate_commercial_score(self, commercial_coverage: Dict[str, Any]) -> float:
        """计算商务评分"""
        coverage_rate = commercial_coverage.get("coverage_rate", 0)
        return coverage_rate * 10
    
    def _calculate_compliance_score(self, compliance_results: Dict[str, Any]) -> float:
        """计算合规评分"""
        technical_issues = len(compliance_results.get("technical_issues", []))
        commercial_issues = len(compliance_results.get("commercial_issues", []))
        
        total_issues = technical_issues + commercial_issues
        if total_issues == 0:
            return 10.0
        elif total_issues <= 2:
            return 8.0
        elif total_issues <= 5:
            return 6.0
        else:
            return 4.0
    
    def _generate_recommendations(self, content: Dict[str, Any], 
                                compliance_results: Dict[str, Any],
                                quality_assessment: Dict[str, Any]) -> List[str]:
        """生成改进建议"""
        recommendations = []
        
        # 基于技术问题生成建议
        tech_issues = compliance_results.get("technical_issues", [])
        if tech_issues:
            recommendations.append("优化技术方案，补充缺失的技术细节")
        
        # 基于商务问题生成建议
        commercial_issues = compliance_results.get("commercial_issues", [])
        if commercial_issues:
            recommendations.append("完善商务条款，提高灵活性")
        
        # 基于评分生成建议
        if quality_assessment["overall_score"] < 8:
            recommendations.append("整体方案需要进一步优化，建议重新审查")
        
        return recommendations
    
    def _format_compliance_details(self, verification_results: Dict[str, Any]) -> str:
        """格式化合规详情"""
        details = ""
        
        tech_coverage = verification_results.get("technical_coverage", {})
        if tech_coverage:
            details += f"技术需求覆盖度: {tech_coverage.get('coverage_rate', 0)*100:.1f}%\n"
        
        commercial_coverage = verification_results.get("commercial_coverage", {})
        if commercial_coverage:
            details += f"商务需求覆盖度: {commercial_coverage.get('coverage_rate', 0)*100:.1f}%\n"
        
        return details
    
    def _format_recommendations(self, verification_results: Dict[str, Any]) -> str:
        """格式化建议"""
        recommendations = verification_results.get("recommendations", [])
        if not recommendations:
            return "方案质量良好，无需重大修改"
        
        formatted = ""
        for i, rec in enumerate(recommendations, 1):
            formatted += f"{i}. {rec}\n"
        return formatted