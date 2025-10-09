import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Mock content storage - in production, this would be in a database
const mockContent: Record<string, string> = {
  'executive-summary': `
# Executive Summary

Our comprehensive bid proposal presents a cutting-edge solution designed to meet and exceed your organization's requirements. With over 15 years of industry experience and a proven track record of successful implementations, we are uniquely positioned to deliver exceptional value.

## Key Highlights

- **Proven Expertise**: Successfully delivered 200+ similar projects with 98% client satisfaction
- **Innovative Approach**: Leveraging latest technologies including AI/ML and cloud-native architecture  
- **Competitive Pricing**: 15% below market average while maintaining premium quality standards
- **Rapid Deployment**: 40% faster implementation timeline compared to industry benchmarks
- **Comprehensive Support**: 24/7 support with dedicated account management

## Value Proposition

Our solution will transform your operations by:
- Reducing operational costs by 25-30%
- Improving efficiency by 40%
- Enhancing user experience and satisfaction
- Ensuring scalability for future growth
- Providing robust security and compliance

We are committed to your success and look forward to partnering with you on this transformative journey.
  `,
  'technical-approach': `
# Technical Approach

## Solution Architecture

Our technical approach is built on a modern, scalable architecture that ensures reliability, performance, and security. The solution leverages cloud-native technologies and follows industry best practices.

### Core Components

1. **Microservices Architecture**
   - Containerized services using Docker and Kubernetes
   - API-first design with RESTful and GraphQL endpoints
   - Event-driven communication patterns

2. **Data Management**
   - Multi-tier data storage strategy
   - Real-time data processing capabilities
   - Comprehensive backup and disaster recovery

3. **Security Framework**
   - Zero-trust security model
   - End-to-end encryption
   - Multi-factor authentication
   - Regular security audits and penetration testing

### Implementation Methodology

We follow an Agile development methodology with:
- Sprint-based delivery cycles
- Continuous integration and deployment
- Automated testing at all levels
- Regular stakeholder feedback sessions

### Technology Stack

- **Frontend**: React/Next.js with TypeScript
- **Backend**: Node.js/Python with microservices
- **Database**: PostgreSQL with Redis caching
- **Cloud**: AWS/Azure with multi-region deployment
- **Monitoring**: Comprehensive observability stack
  `,
  'project-timeline': `
# Project Timeline

## Phase 1: Project Initiation (Weeks 1-2)
- Project kickoff and team onboarding
- Requirements validation and finalization
- Environment setup and access provisioning
- Stakeholder alignment sessions

## Phase 2: Design and Planning (Weeks 3-6)
- Detailed technical design
- User experience design and prototyping
- Infrastructure planning and setup
- Security architecture review

## Phase 3: Development (Weeks 7-16)
- Core system development
- API development and integration
- Frontend development
- Database design and implementation

## Phase 4: Testing and Quality Assurance (Weeks 17-20)
- Unit and integration testing
- Performance testing and optimization
- Security testing and vulnerability assessment
- User acceptance testing

## Phase 5: Deployment and Go-Live (Weeks 21-22)
- Production deployment
- Data migration and validation
- Go-live support
- Initial user training

## Phase 6: Post-Launch Support (Weeks 23-26)
- Monitoring and optimization
- Bug fixes and minor enhancements
- Knowledge transfer
- Project closure and documentation

### Key Milestones
- Week 6: Design approval
- Week 16: Development completion
- Week 20: Testing completion
- Week 22: Go-live
- Week 26: Project closure
  `,
  'team-qualifications': `
# Team Qualifications

## Project Leadership

### John Smith - Project Manager
- **Experience**: 12+ years in enterprise software delivery
- **Certifications**: PMP, Agile Certified Practitioner
- **Notable Projects**: Led 50+ successful implementations
- **Expertise**: Risk management, stakeholder communication

### Sarah Johnson - Technical Lead
- **Experience**: 15+ years in software architecture
- **Certifications**: AWS Solutions Architect, Azure Expert
- **Notable Projects**: Designed systems serving 10M+ users
- **Expertise**: Scalable architecture, cloud technologies

## Development Team

### Frontend Team (4 developers)
- React/Next.js specialists with 5+ years experience
- UI/UX design expertise
- Accessibility and performance optimization
- Mobile-responsive development

### Backend Team (6 developers)
- Microservices architecture specialists
- API design and development experts
- Database optimization professionals
- DevOps and CI/CD specialists

### Quality Assurance Team (3 testers)
- Automated testing framework experts
- Performance and security testing specialists
- User acceptance testing coordinators

## Specialized Consultants

### Security Consultant
- **Experience**: 10+ years in cybersecurity
- **Certifications**: CISSP, CEH, CISM
- **Expertise**: Penetration testing, compliance auditing

### Data Architect
- **Experience**: 8+ years in data engineering
- **Certifications**: Google Cloud Data Engineer
- **Expertise**: Data modeling, ETL processes, analytics

## Team Commitment
- Dedicated team members for project duration
- Flexible resource scaling based on project needs
- Regular training and skill development
- 24/7 support coverage during critical phases
  `,
  'pricing-structure': `
# Pricing Structure

## Investment Overview

Our competitive pricing structure is designed to provide exceptional value while ensuring project success. The total investment includes all necessary components for a complete solution.

### Phase-Based Pricing

| Phase | Description | Duration | Investment |
|-------|-------------|----------|------------|
| Phase 1 | Project Initiation | 2 weeks | $25,000 |
| Phase 2 | Design & Planning | 4 weeks | $75,000 |
| Phase 3 | Development | 10 weeks | $350,000 |
| Phase 4 | Testing & QA | 4 weeks | $100,000 |
| Phase 5 | Deployment | 2 weeks | $50,000 |
| Phase 6 | Support | 4 weeks | $40,000 |

**Total Project Investment: $640,000**

### What's Included

#### Development Services
- Complete system design and architecture
- Full-stack development (frontend and backend)
- Database design and implementation
- API development and integration
- Security implementation
- Performance optimization

#### Quality Assurance
- Comprehensive testing strategy
- Automated test suite development
- Performance and load testing
- Security testing and validation
- User acceptance testing support

#### Deployment and Support
- Production environment setup
- Deployment automation
- Go-live support (24/7 for first week)
- Documentation and training materials
- 30-day warranty period

### Payment Schedule
- 20% upon contract signing
- 30% at design approval (end of Phase 2)
- 30% at development completion (end of Phase 3)
- 15% at successful deployment (end of Phase 5)
- 5% upon project completion and acceptance

### Additional Services (Optional)
- Extended support: $15,000/month
- Additional training sessions: $5,000/session
- Custom integrations: $25,000-$75,000 (depending on complexity)
- Performance monitoring setup: $20,000

### Value Proposition
- 15% below market average for similar projects
- Fixed-price guarantee (no hidden costs)
- ROI typically achieved within 6-12 months
- Comprehensive warranty and support included
  `
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId, sectionId } = params

    // In production, fetch from database based on workflowId and sectionId
    const content = mockContent[sectionId] || ''

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Error fetching workflow content:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    )
  }
}