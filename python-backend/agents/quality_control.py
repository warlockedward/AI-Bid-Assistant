"""
质量控制机制
实现内容质量检查、验证和优化
"""
from typing import Dict, Any, List, Optional
import re
import logging

logger = logging.getLogger(__name__)


class ContentQualityChecker:
    """内容质量检查器"""
    
    def __init__(self):
        self.min_length = 100
        self.max_length = 50000
        self.professional_terms = [
            "架构", "系统", "技术", "方案", "实现", "性能", "优化",
            "设计", "开发", "部署", "测试", "运维", "安全", "可靠性"
        ]
    
    def check_content_length(
        self,
        content: str,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None
    ) -> Dict[str, Any]:
        """检查内容长度"""
        min_len = min_length or self.min_length
        max_len = max_length or self.max_length
        
        length = len(content)
        
        if length < min_len:
            return {
                "passed": False,
                "issue": "content_too_short",
                "message": f"内容过短（{length}字符），最少需要{min_len}字符",
                "length": length,
                "min_required": min_len
            }
        elif length > max_len:
            return {
                "passed": False,
                "issue": "content_too_long",
                "message": f"内容过长（{length}字符），最多允许{max_len}字符",
                "length": length,
                "max_allowed": max_len
            }
        else:
            return {
                "passed": True,
                "length": length,
                "message": "内容长度合适"
            }
    
    def check_professional_terminology(
        self,
        content: str,
        min_term_count: int = 5
    ) -> Dict[str, Any]:
        """检查专业术语使用"""
        found_terms = []
        for term in self.professional_terms:
            if term in content:
                found_terms.append(term)
        
        term_count = len(found_terms)
        
        if term_count < min_term_count:
            return {
                "passed": False,
                "issue": "insufficient_professional_terms",
                "message": f"专业术语不足（{term_count}个），建议至少使用{min_term_count}个",
                "found_terms": found_terms,
                "term_count": term_count
            }
        else:
            return {
                "passed": True,
                "found_terms": found_terms,
                "term_count": term_count,
                "message": "专业术语使用充分"
            }
    
    def check_structure(
        self,
        content: Dict[str, Any],
        required_sections: List[str]
    ) -> Dict[str, Any]:
        """检查内容结构"""
        missing_sections = []
        empty_sections = []
        
        for section in required_sections:
            if section not in content:
                missing_sections.append(section)
            elif not content[section] or len(str(content[section])) < 50:
                empty_sections.append(section)
        
        if missing_sections or empty_sections:
            return {
                "passed": False,
                "issue": "incomplete_structure",
                "message": "内容结构不完整",
                "missing_sections": missing_sections,
                "empty_sections": empty_sections
            }
        else:
            return {
                "passed": True,
                "message": "内容结构完整"
            }
    
    def check_consistency(
        self,
        content: Dict[str, Any]
    ) -> Dict[str, Any]:
        """检查内容一致性"""
        issues = []
        
        # 检查术语一致性
        content_text = str(content)
        
        # 检查常见的不一致问题
        inconsistencies = {
            "数字格式": [r'\d+', r'[零一二三四五六七八九十百千万]+'],
            "日期格式": [r'\d{4}-\d{2}-\d{2}', r'\d{4}年\d{1,2}月\d{1,2}日'],
        }
        
        for check_name, patterns in inconsistencies.items():
            matches = []
            for pattern in patterns:
                found = re.findall(pattern, content_text)
                if found:
                    matches.append(len(found))
            
            # 如果同时使用多种格式，可能存在不一致
            if len([m for m in matches if m > 0]) > 1:
                issues.append(f"{check_name}不一致")
        
        if issues:
            return {
                "passed": False,
                "issue": "consistency_issues",
                "message": "内容存在一致性问题",
                "issues": issues
            }
        else:
            return {
                "passed": True,
                "message": "内容一致性良好"
            }
    
    def check_format_compliance(
        self,
        content: str,
        format_type: str = "markdown"
    ) -> Dict[str, Any]:
        """检查格式规范"""
        issues = []
        
        if format_type == "markdown":
            # 检查Markdown格式
            if not re.search(r'^#+\s', content, re.MULTILINE):
                issues.append("缺少标题")
            
            # 检查列表格式
            if re.search(r'^\d+\.\s', content, re.MULTILINE):
                # 有序列表存在，检查格式
                if re.search(r'^\d+\.\s*$', content, re.MULTILINE):
                    issues.append("列表项为空")
        
        if issues:
            return {
                "passed": False,
                "issue": "format_issues",
                "message": "格式不符合规范",
                "issues": issues
            }
        else:
            return {
                "passed": True,
                "message": "格式符合规范"
            }
    
    def comprehensive_check(
        self,
        content: Any,
        required_sections: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """综合质量检查"""
        results = {
            "overall_passed": True,
            "checks": {},
            "issues": [],
            "warnings": []
        }
        
        # 转换内容为字符串用于某些检查
        if isinstance(content, dict):
            content_text = str(content)
            
            # 结构检查
            if required_sections:
                structure_check = self.check_structure(content, required_sections)
                results["checks"]["structure"] = structure_check
                if not structure_check["passed"]:
                    results["overall_passed"] = False
                    results["issues"].append(structure_check["message"])
            
            # 一致性检查
            consistency_check = self.check_consistency(content)
            results["checks"]["consistency"] = consistency_check
            if not consistency_check["passed"]:
                results["warnings"].append(consistency_check["message"])
        else:
            content_text = str(content)
        
        # 长度检查
        length_check = self.check_content_length(content_text)
        results["checks"]["length"] = length_check
        if not length_check["passed"]:
            results["overall_passed"] = False
            results["issues"].append(length_check["message"])
        
        # 专业术语检查
        terminology_check = self.check_professional_terminology(content_text)
        results["checks"]["terminology"] = terminology_check
        if not terminology_check["passed"]:
            results["warnings"].append(terminology_check["message"])
        
        # 格式检查
        format_check = self.check_format_compliance(content_text)
        results["checks"]["format"] = format_check
        if not format_check["passed"]:
            results["warnings"].append(format_check["message"])
        
        return results


class QualityScorer:
    """质量评分器"""
    
    @staticmethod
    def calculate_quality_score(
        content: Dict[str, Any],
        quality_checks: Dict[str, Any]
    ) -> float:
        """计算质量分数（0-1.0）"""
        score = 1.0
        
        # 基于检查结果扣分
        if not quality_checks.get("overall_passed", True):
            score -= 0.3
        
        # 基于问题数量扣分
        issues_count = len(quality_checks.get("issues", []))
        score -= issues_count * 0.1
        
        # 基于警告数量扣分
        warnings_count = len(quality_checks.get("warnings", []))
        score -= warnings_count * 0.05
        
        # 基于内容完整性加分
        checks = quality_checks.get("checks", {})
        if checks.get("structure", {}).get("passed"):
            score += 0.1
        if checks.get("terminology", {}).get("passed"):
            score += 0.1
        
        # 确保分数在0-1范围内
        return max(0.0, min(1.0, score))
    
    @staticmethod
    def get_quality_level(score: float) -> str:
        """获取质量等级"""
        if score >= 0.9:
            return "excellent"
        elif score >= 0.8:
            return "good"
        elif score >= 0.7:
            return "acceptable"
        elif score >= 0.6:
            return "needs_improvement"
        else:
            return "poor"


class QualityOptimizer:
    """质量优化器"""
    
    @staticmethod
    def generate_optimization_suggestions(
        quality_checks: Dict[str, Any]
    ) -> List[str]:
        """生成优化建议"""
        suggestions = []
        
        # 基于检查结果生成建议
        checks = quality_checks.get("checks", {})
        
        # 长度问题
        length_check = checks.get("length", {})
        if not length_check.get("passed"):
            if length_check.get("issue") == "content_too_short":
                suggestions.append("增加内容深度和细节，补充更多专业信息")
            elif length_check.get("issue") == "content_too_long":
                suggestions.append("精简内容，去除冗余信息，突出重点")
        
        # 专业术语问题
        terminology_check = checks.get("terminology", {})
        if not terminology_check.get("passed"):
            suggestions.append("增加专业术语的使用，提升内容专业性")
        
        # 结构问题
        structure_check = checks.get("structure", {})
        if not structure_check.get("passed"):
            missing = structure_check.get("missing_sections", [])
            empty = structure_check.get("empty_sections", [])
            if missing:
                suggestions.append(f"补充缺失的章节：{', '.join(missing)}")
            if empty:
                suggestions.append(f"完善空白章节：{', '.join(empty)}")
        
        # 一致性问题
        consistency_check = checks.get("consistency", {})
        if not consistency_check.get("passed"):
            issues = consistency_check.get("issues", [])
            if issues:
                suggestions.append(f"统一格式和术语：{', '.join(issues)}")
        
        # 格式问题
        format_check = checks.get("format", {})
        if not format_check.get("passed"):
            suggestions.append("规范文档格式，确保符合标准")
        
        if not suggestions:
            suggestions.append("内容质量良好，可以进行细节优化")
        
        return suggestions


# 全局实例
content_quality_checker = ContentQualityChecker()
quality_scorer = QualityScorer()
quality_optimizer = QualityOptimizer()
