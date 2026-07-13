/**
 * GET /api/social/connect/linkedin
 * Initiates LinkedIn OAuth 2.0 flow.
 * Scopes: openid, profile, email, w_member_social
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState } from '@/lib/oauthState'
import { LINKEDIN_MEMBER_SCOPES, LINKEDIN_ORGANIZATION_SCOPES } from '@/lib/socialPlatformConfig'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await adminClient.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'LinkedIn App not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/social/callback/linkedin`

    const state = createOAuthState(user.id, 'linkedin')

    // Organization scopes are product-gated by LinkedIn. Requesting them before
    // Community Management approval can break the otherwise valid member flow.
    const organizationPublishingEnabled = process.env.LINKEDIN_ORGANIZATION_PUBLISHING_ENABLED === 'true'
    const scopes = [
      ...LINKEDIN_MEMBER_SCOPES,
      ...(organizationPublishingEnabled ? LINKEDIN_ORGANIZATION_SCOPES : []),
    ].join(' ')

    const linkedInOAuthUrl =
      `https://www.linkedin.com/oauth/v2/authorization` +
      `?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${state}`

    return NextResponse.json({ url: linkedInOAuthUrl })
  } catch (err: any) {
    console.error('[Social Connect LinkedIn] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to initiate LinkedIn OAuth' }, { status: 500 })
  }
}
