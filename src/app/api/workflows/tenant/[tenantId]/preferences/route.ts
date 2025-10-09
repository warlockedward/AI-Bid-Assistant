import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface TenantPreferences {
  autoRetry: boolean
  maxRetries: number
  notificationEmail: string
  defaultTimeout: number
  enableLogging: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

// Mock storage - in production, this would be in database
const mockPreferences: Record<string, TenantPreferences> = {}

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tenantId } = params

    // Verify user has access to this tenant
    if (session.user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // In production, fetch from database
    // const preferences = await db.tenantPreferences.findUnique({
    //   where: { tenantId }
    // })

    const preferences = mockPreferences[tenantId] || {
      autoRetry: true,
      maxRetries: 3,
      notificationEmail: '',
      defaultTimeout: 3600,
      enableLogging: true,
      logLevel: 'info' as const
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Error fetching tenant preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tenantId } = params

    // Verify user has access to this tenant
    if (session.user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const preferences: TenantPreferences = await request.json()

    // Validate preferences
    if (preferences.maxRetries < 1 || preferences.maxRetries > 10) {
      return NextResponse.json(
        { error: 'Max retries must be between 1 and 10' },
        { status: 400 }
      )
    }

    if (preferences.defaultTimeout < 60 || preferences.defaultTimeout > 7200) {
      return NextResponse.json(
        { error: 'Default timeout must be between 60 and 7200 seconds' },
        { status: 400 }
      )
    }

    if (!['debug', 'info', 'warn', 'error'].includes(preferences.logLevel)) {
      return NextResponse.json(
        { error: 'Invalid log level' },
        { status: 400 }
      )
    }

    // In production, save to database
    // await db.tenantPreferences.upsert({
    //   where: { tenantId },
    //   update: preferences,
    //   create: { tenantId, ...preferences }
    // })

    mockPreferences[tenantId] = preferences

    return NextResponse.json({ 
      success: true,
      message: 'Preferences updated successfully',
      preferences 
    })
  } catch (error) {
    console.error('Error updating tenant preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}