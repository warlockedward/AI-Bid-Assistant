import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface AISuggestion {
  id: string
  type: 'improvement' | 'addition' | 'style' | 'compliance'
  title: string
  description: string
  suggestedText?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sectionId, content, sectionType } = await request.json()

    // Mock AI suggestions based on section type and content
    const suggestions: AISuggestion[] = generateMockSuggestions(sectionType, content)

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Error generating AI suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}

function generateMockSuggestions(sectionType: string, content: string): AISuggestion[] {
  const suggestions: AISuggestion[] = []

  // Generate suggestions based on section type
  if (sectionType.includes('Executive Summary')) {
    suggestions.push({
      id: 'exec-1',
      type: 'improvement',
      title: 'Strengthen Value Proposition',
      description: 'Consider highlighting unique competitive advantages more prominently',
      suggestedText: 'Our solution delivers 40% faster implementation compared to industry standards, with proven ROI within 6 months.'
    })

    suggestions.push({
      id: 'exec-2',
      type: 'style',
      title: 'Executive Tone',
      description: 'Use more confident, executive-level language',
    })
  }

  if (sectionType.includes('Technical Approach')) {
    suggestions.push({
      id: 'tech-1',
      type: 'addition',
      title: 'Add Architecture Diagram',
      description: 'Include a high-level system architecture diagram',
      suggestedText: '[Architecture Diagram: High-level system overview showing data flow, integration points, and security layers]'
    })

    suggestions.push({
      id: 'tech-2',
      type: 'compliance',
      title: 'Security Standards',
      description: 'Mention specific security compliance standards (ISO 27001, SOC 2)',
      suggestedText: 'Our solution is fully compliant with ISO 27001 and SOC 2 Type II standards, ensuring enterprise-grade security.'
    })
  }

  if (sectionType.includes('Timeline')) {
    suggestions.push({
      id: 'timeline-1',
      type: 'improvement',
      title: 'Add Buffer Time',
      description: 'Consider adding buffer time for critical milestones',
    })

    suggestions.push({
      id: 'timeline-2',
      type: 'addition',
      title: 'Risk Mitigation',
      description: 'Include contingency plans for potential delays',
      suggestedText: 'Contingency Plan: In case of unforeseen delays, we maintain a 15% buffer in our timeline and can deploy additional resources to maintain delivery commitments.'
    })
  }

  if (sectionType.includes('Pricing')) {
    suggestions.push({
      id: 'pricing-1',
      type: 'improvement',
      title: 'Value Justification',
      description: 'Better justify pricing with ROI calculations',
      suggestedText: 'Based on industry benchmarks, this investment typically generates 3-5x ROI within the first year through operational efficiency gains.'
    })
  }

  // Add general suggestions if content is short
  if (content.length < 500) {
    suggestions.push({
      id: 'general-1',
      type: 'addition',
      title: 'Expand Content',
      description: 'This section could benefit from more detailed information',
    })
  }

  return suggestions
}