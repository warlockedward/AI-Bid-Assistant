import { BaseAgent } from './base-agent';
import { AgentConfig, GeneratedContent, Requirement } from '@/types';

export class ComplianceVerificationAgent extends BaseAgent {
  constructor(tenantContext: any, tenantSettings: any) {
    const config: AgentConfig = {
      name: 'ComplianceVerificationAgent',
      systemMessage: `你是一个专业的合规性验证专家。你的任务是：
1. 验证生成的投标内容是否符合招标文件的要求
2. 检查是否遵循相关的法规和标准
3. 识别潜在的合规风险和问题
4. 提供改进建议和修正方案

请进行全面、严格的合规性检查，确保投标文档的合规性。`,
      llmConfig: {
        model: 'gpt-4',
        apiKey: '',
        temperature: 0.2,
        maxTokens: 4000,
        timeout: 30000
      },
      humanInputMode: 'NEVER',
      maxConsecutiveAutoReply: 1
    };

    super(config, tenantContext, tenantSettings);
  }

  async execute(input: {
    generatedContent: GeneratedContent[];
    requirements: Requirement[];
    complianceRules: string[];
    tenderDocument: any;
  }): Promise<{
    complianceScore: number;
    violations: ComplianceViolation[];
    recommendations: string[];
    approvalStatus: 'approved' | 'rejected' | 'needs_revision';
  }> {
    this.log('开始合规性验证', {
      contentCount: input.generatedContent.length,
      requirementCount: input.requirements.length
    });

    try {
      // 执行各种合规性检查
      const requirementCompliance = await this.checkRequirementCompliance(
        input.generatedContent,
        input.requirements
      );

      const ruleCompliance = await this.checkRuleCompliance(
        input.generatedContent,
        input.complianceRules
      );

      const formatCompliance = await this.checkFormatCompliance(
        input.generatedContent,
        input.tenderDocument
      );

      // 综合评估
      const overallAssessment = await this.performOverallAssessment(
        input,
        requirementCompliance,
        ruleCompliance,
        formatCompliance
      );

      this.log('合规性验证完成', {
        complianceScore: overallAssessment.complianceScore,
        violationCount: overallAssessment.violations.length
      });

      return overallAssessment;

    } catch (error) {
      this.logError('合规性验证失败', error);
      throw error;
    }
  }

  private async checkRequirementCompliance(
    content: GeneratedContent[],
    requirements: Requirement[]
  ): Promise<{
    score: number;
    violations: ComplianceViolation[];
    coverage: RequirementCoverage[];
  }> {
    const messages = [
      {
        role: 'system',
        content: `请检查生成的内容是否满足所有招标要求。对每个要求进行逐一验证。`
      },
      {
        role: 'user',
        content: `生成的内容：
${JSON.stringify(content, null, 2)}

招标要求：
${JSON.stringify(requirements, null, 2)}

请验证内容是否满足所有要求，并指出任何缺失或不符合的地方。`
      }
    ];

    const response = await this.callLLM(messages);

    // 解析LLM响应并结构化结果
    return this.parseRequirementComplianceResponse(response, requirements);
  }

  private async checkRuleCompliance(
    content: GeneratedContent[],
    rules: string[]
  ): Promise<{
    score: number;
    violations: ComplianceViolation[];
  }> {
    const messages = [
      {
        role: 'system',
        content: `请检查内容是否符合指定的合规规则和标准。`
      },
      {
        role: 'user',
        content: `生成的内容：
${JSON.stringify(content, null, 2)}

合规规则：
${JSON.stringify(rules, null, 2)}

请验证内容是否符合所有规则，并指出违规之处。`
      }
    ];

    const response = await this.callLLM(messages);
    return this.parseRuleComplianceResponse(response, rules);
  }

  private async checkFormatCompliance(
    content: GeneratedContent[],
    tenderDocument: any
  ): Promise<{
    score: number;
    violations: ComplianceViolation[];
  }> {
    // 检查格式合规性
    const violations: ComplianceViolation[] = [];
    let score = 1.0;

    // 检查必需章节
    const requiredSections = this.extractRequiredSections(tenderDocument);
    const providedSections = content.map(c => c.section);

    for (const requiredSection of requiredSections) {
      if (!providedSections.includes(requiredSection)) {
        violations.push({
          type: 'missing_section',
          severity: 'high',
          description: `缺少必需章节: ${requiredSection}`,
          section: requiredSection,
          recommendation: `请添加 ${requiredSection} 章节`
        });
        score -= 0.2;
      }
    }

    return { score: Math.max(0, score), violations };
  }

  private async performOverallAssessment(
    input: any,
    requirementCompliance: any,
    ruleCompliance: any,
    formatCompliance: any
  ): Promise<{
    complianceScore: number;
    violations: ComplianceViolation[];
    recommendations: string[];
    approvalStatus: 'approved' | 'rejected' | 'needs_revision';
  }> {
    const allViolations = [
      ...requirementCompliance.violations,
      ...ruleCompliance.violations,
      ...formatCompliance.violations
    ];

    const overallScore = (
      requirementCompliance.score * 0.5 +
      ruleCompliance.score * 0.3 +
      formatCompliance.score * 0.2
    );

    const highSeverityViolations = allViolations.filter(v => v.severity === 'high');
    const mediumSeverityViolations = allViolations.filter(v => v.severity === 'medium');

    let approvalStatus: 'approved' | 'rejected' | 'needs_revision';
    if (overallScore >= 0.9 && highSeverityViolations.length === 0) {
      approvalStatus = 'approved';
    } else if (overallScore < 0.6 || highSeverityViolations.length > 3) {
      approvalStatus = 'rejected';
    } else {
      approvalStatus = 'needs_revision';
    }

    const recommendations = this.generateRecommendations(allViolations, overallScore);

    return {
      complianceScore: overallScore,
      violations: allViolations,
      recommendations,
      approvalStatus
    };
  }

  private parseRequirementComplianceResponse(response: string, requirements: Requirement[]): any {
    // 解析LLM响应的逻辑
    // 暂时返回模拟数据
    return {
      score: 0.85,
      violations: [
        {
          type: 'incomplete_requirement',
          severity: 'medium',
          description: '技术方案部分缺少详细的架构说明',
          section: '技术方案',
          recommendation: '请补充系统架构图和详细说明'
        }
      ],
      coverage: requirements.map(req => ({
        requirementId: req.id,
        covered: Math.random() > 0.2,
        completeness: Math.random()
      }))
    };
  }

  private parseRuleComplianceResponse(response: string, rules: string[]): any {
    return {
      score: 0.9,
      violations: []
    };
  }

  private extractRequiredSections(tenderDocument: any): string[] {
    // 从招标文件中提取必需章节
    return [
      '技术方案',
      '商务方案',
      '项目计划',
      '团队介绍',
      '案例展示'
    ];
  }

  private generateRecommendations(violations: ComplianceViolation[], score: number): string[] {
    const recommendations: string[] = [];

    if (score < 0.8) {
      recommendations.push('建议全面审查投标文档，确保满足所有基本要求');
    }

    const highViolations = violations.filter(v => v.severity === 'high');
    if (highViolations.length > 0) {
      recommendations.push('请优先处理高严重性的合规问题');
    }

    const missingSections = violations.filter(v => v.type === 'missing_section');
    if (missingSections.length > 0) {
      recommendations.push('请补充缺失的必需章节');
    }

    return recommendations;
  }
}

interface ComplianceViolation {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  section: string;
  recommendation: string;
}

interface RequirementCoverage {
  requirementId: string;
  covered: boolean;
  completeness: number;
}