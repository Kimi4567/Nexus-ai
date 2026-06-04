/**
 * GET /api/social/connect/linkedin
 * Initiates LinkedIn OAuth 2.0 flow.
 * Scopes: openid, profile, email, w_member_social
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'

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

    // State carries the user ID + timestamp for CSRF protection
    const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64url')

    const scopes = ['openid', 'profile', 'email', 'w_member_social'].join(' ')

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
