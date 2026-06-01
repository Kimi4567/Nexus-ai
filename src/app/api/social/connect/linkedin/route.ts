/**
 * GET /api/social/connect/linkedin
 * Initiates LinkedIn OAuth 2.0 flow.
 * Scopes: openid, profile, email, w_member_social
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID
 *   NEXT_PUBLIC_APP_URL
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Verify user is authenticated
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'LinkedIn App not configured' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/social/callback/linkedin`

  // State carries the user ID + timestamp for CSRF protection
  const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64url')

  // w_member_social: post on behalf of the member
  // openid + profile + email: OIDC for profile info
  const scopes = ['openid', 'profile', 'email', 'w_member_social'].join(' ')

  const linkedInOAuthUrl =
    `https://www.linkedin.com/oauth/v2/authorization` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}`

  return NextResponse.json({ url: linkedInOAuthUrl })
}
