/**
 * Workflow definitions for the intelligent bid system
 * Defines the standard workflows for bid document generation
 */

import { WorkflowDefinition, WorkflowStep } from '../types/workflow';

/**
 * Standard bid document generation workflow
 */
export const BID_DOCUMENT_GENERATION_WORKFLOW: WorkflowDefinition = {
  id: 'bid-document-generation',
  name: 'Bid Document Generation',
  description: 'Complete workflow for generating professional bid documents with AI assistance',
  version: '1.0.0',
  steps: [
    {
      id: 'tender-analysis',
      name: 'Tender Analysis',
      description: 'Analyze tender document and extract requirements',
      agent_type: 'tender-analysis',
      timeout_seconds: 300,
      is_checkpoint: true,
      retry_count: 3,
      dependencies: [],
      input_schema: {
        tender_document: 'string',
        analysis_depth: 'string'
      },
      output_schema: {
        requirements: 'array',
        compliance_criteria: 'array',
        risk_factors: 'array',
        key_dates: 'object'
      }
    },
    {
      id: 'knowledge-retrieval',
      name: 'Knowledge Retrieval',
      description: 'Retrieve relevant knowledge and best practices',
      agent_type: 'knowledge-retrieval',
      timeout_seconds: 180,
      is_checkpoint: false,
      retry_count: 2,
      dependencies: ['tender-analysis'],
      input_schema: {
        requirements: 'array',
        industry_sector: 'string'
      },
      output_schema: {
        relevant_knowledge: 'array',
        best_practices: 'array',
        templates: 'array'
      }
    },
    {
      id: 'content-generation',
      name: 'Content Generation',
      description: 'Generate bid document sections with AI assistance',
      agent_type: 'content-generation',
      timeout_seconds: 600,
      is_checkpoint: true,
      retry_count: 3,
      dependencies: ['tender-analysis', 'knowledge-retrieval'],
      input_schema: {
        requirements: 'array',
        knowledge_base: 'array',
        sections: 'array',
        writing_style: 'string'
      },
      output_schema: {
        generated_sections: 'object',
        word_count: 'number',
        confidence_scores: 'object'
      }
    },
    {
      id: 'compliance-verification',
      name: 'Compliance Verification',
      description: 'Verify compliance with tender requirements',
      agent_type: 'compliance-verification',
      timeout_seconds: 240,
      is_checkpoint: true,
      retry_count: 2,
      dependencies: ['content-generation'],
      input_schema: {
        generated_content: 'object',
        compliance_criteria: 'array',
        requirements: 'array'
      },
      output_schema: {
        compliance_score: 'number',
        compliance_issues: 'array',
        recommendations: 'array',
        approval_status: 'string'
      }
    }
  ],
  tenant_id: undefined,
  created_by: 'system',
  created_at: new Date(),
  updated_at: new Date(),
  is_active: true,
  metadata: {
    category: 'bid-generation',
    tags: ['ai-assisted', 'document-generation', 'compliance'],
    estimated_duration_minutes: 20,
    complexity: 'medium'
  }
};

/**
 * Quick bid section generation workflow
 */
export const QUICK_BID_SECTION_WORKFLOW: WorkflowDefinition = {
  id: 'quick-bid-section',
  name: 'Quick Bid Section Generation',
  description: 'Fast generation of individual bid document sections',
  version: '1.0.0',
  steps: [
    {
      id: 'section-analysis',
      name: 'Section Analysis',
      description: 'Analyze section requirements',
      agent_type: 'tender-analysis',
      timeout_seconds: 120,
      is_checkpoint: false,
      retry_count: 2,
      dependencies: [],
      input_schema: {
        section_type: 'string',
        requirements: 'array',
        context: 'string'
      },
      output_schema: {
        section_requirements: 'array',
        key_points: 'array'
      }
    },
    {
      id: 'quick-content-generation',
      name: 'Quick Content Generation',
      description: 'Generate section content quickly',
      agent_type: 'content-generation',
      timeout_seconds: 300,
      is_checkpoint: true,
      retry_count: 3,
      dependencies: ['section-analysis'],
      input_schema: {
        section_type: 'string',
        requirements: 'array',
        writing_style: 'string',
        length_target: 'number'
      },
      output_schema: {
        generated_content: 'string',
        word_count: 'number',
        confidence_score: 'number'
      }
    }
  ],
  tenant_id: undefined,
  created_by: 'system',
  created_at: new Date(),
  updated_at: new Date(),
  is_active: true,
  metadata: undefined
};

/**
 * Bid document review and optimization workflow
 */
export const BID_DOCUMENT_REVIEW_WORKFLOW: WorkflowDefinition = {
  id: 'bid-document-review',
  name: 'Bid Document Review',
  description: 'Comprehensive review and optimization of existing bid documents',
  version: '1.0.0',
  steps: [
    {
      id: 'document-analysis',
      name: 'Document Analysis',
      description: 'Analyze existing bid document structure and content',
      agent_type: 'tender-analysis',
      timeout_seconds: 240,
      is_checkpoint: true,
      retry_count: 2,
      dependencies: [],
      input_schema: {
        document_content: 'string',
        original_requirements: 'array'
      },
      output_schema: {
        content_analysis: 'object',
        structure_analysis: 'object',
        gaps_identified: 'array'
      }
    },
    {
      id: 'compliance-check',
      name: 'Compliance Check',
      description: 'Check compliance against original requirements',
      agent_type: 'compliance-verification',
      timeout_seconds: 300,
      is_checkpoint: true,
      retry_count: 2,
      input_schema: {
        document_content: 'string',
        requirements: 'array',
        compliance_criteria: 'array'
      },
      output_schema: {
        compliance_report: 'object',
        issues_found: 'array',
        recommendations: 'array'
      },
      dependencies: []
    },
    {
      id: 'content-optimization',
      name: 'Content Optimization',
      description: 'Optimize content based on analysis results',
      agent_type: 'content-generation',
      timeout_seconds: 480,
      is_checkpoint: true,
      retry_count: 3,
      input_schema: {
        original_content: 'string',
        optimization_suggestions: 'array',
        target_improvements: 'array'
      },
      output_schema: {
        optimized_content: 'string',
        improvements_made: 'array',
        quality_score: 'number'
      },
      dependencies: []
    }
  ],
  tenant_id: undefined,
  created_by: 'system',
  created_at: new Date(),
  updated_at: new Date(),
  is_active: true,
  metadata: {
    category: 'bid-optimization',
    tags: ['review', 'optimization', 'quality-improvement'],
    estimated_duration_minutes: 15,
    complexity: 'medium'
  }
};

/**
 * Workflow definition registry
 */
export class WorkflowDefinitionRegistry {
  private static definitions: Map<string, WorkflowDefinition> = new Map([
    [BID_DOCUMENT_GENERATION_WORKFLOW.id, BID_DOCUMENT_GENERATION_WORKFLOW],
    [QUICK_BID_SECTION_WORKFLOW.id, QUICK_BID_SECTION_WORKFLOW],
    [BID_DOCUMENT_REVIEW_WORKFLOW.id, BID_DOCUMENT_REVIEW_WORKFLOW]
  ]);

  /**
   * Get workflow definition by ID
   */
  static getDefinition(id: string): WorkflowDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * Get all available workflow definitions
   */
  static getAllDefinitions(): WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Get workflow definitions by category
   */
  static getDefinitionsByCategory(category: string): WorkflowDefinition[] {
    return Array.from(this.definitions.values())
      .filter(def => def.metadata?.category === category);
  }

  /**
   * Get workflow definitions by tag
   */
  static getDefinitionsByTag(tag: string): WorkflowDefinition[] {
    return Array.from(this.definitions.values())
      .filter(def => def.metadata?.tags?.includes(tag));
  }

  /**
   * Register a new workflow definition
   */
  static registerDefinition(definition: WorkflowDefinition): void {
    this.validateDefinition(definition);
    this.definitions.set(definition.id, definition);
  }

  /**
   * Validate workflow definition
   */
  static validateDefinition(definition: WorkflowDefinition): void {
    if (!definition.id) {
      throw new Error('Workflow definition must have an ID');
    }

    if (!definition.name) {
      throw new Error('Workflow definition must have a name');
    }

    if (!definition.steps || definition.steps.length === 0) {
      throw new Error('Workflow definition must have at least one step');
    }

    // Validate each step
    for (const step of definition.steps) {
      this.validateStep(step);
    }

    // Check for duplicate step IDs
    const stepIds = definition.steps.map(step => step.id);
    const uniqueStepIds = new Set(stepIds);
    if (stepIds.length !== uniqueStepIds.size) {
      throw new Error('Workflow definition contains duplicate step IDs');
    }
  }

  /**
   * Validate workflow step
   */
  static validateStep(step: WorkflowStep): void {
    if (!step.id) {
      throw new Error('Workflow step must have an ID');
    }

    if (!step.name) {
      throw new Error('Workflow step must have a name');
    }

    if (!step.agent_type) {
      throw new Error('Workflow step must specify an agent type');
    }

    if (step.timeout_seconds && step.timeout_seconds <= 0) {
      throw new Error('Workflow step timeout must be positive');
    }

    if (step.retry_count && step.retry_count < 0) {
      throw new Error('Workflow step retry count cannot be negative');
    }
  }

  /**
   * Get workflow definition summary for UI
   */
  static getDefinitionSummary(id: string): any {
    const definition = this.getDefinition(id);
    if (!definition) {
      return null;
    }

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      version: definition.version,
      stepCount: definition.steps.length,
      estimatedDuration: definition.metadata?.estimated_duration_minutes,
      complexity: definition.metadata?.complexity,
      category: definition.metadata?.category,
      tags: definition.metadata?.tags
    };
  }
}

// Export commonly used workflows
export const WORKFLOW_DEFINITIONS = {
  BID_DOCUMENT_GENERATION: BID_DOCUMENT_GENERATION_WORKFLOW,
  QUICK_BID_SECTION: QUICK_BID_SECTION_WORKFLOW,
  BID_DOCUMENT_REVIEW: BID_DOCUMENT_REVIEW_WORKFLOW
};