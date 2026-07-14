import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState } from '@/lib/oauthState'
import { X_CONTENT_SCOPES } from '@/lib/socialPlatformConfig'
import { createXCodeVerifier, xCodeChallenge, xCodeVerifierHash } from '@/lib/xPublishing'

export const dynamic = 'force-dynamic'

const PKCE_COOKIE = 'nexus_x_pkce'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clientId = process.env.X_CLIENT_ID
    const clientSecret = process.env.X_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'X OAuth is not configured yet' }, { status: 503 })
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const verifier = createXCodeVerifier()
    const state = createOAuthState(user.id, 'x', xCodeVerifierHash(verifier))
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: `${appUrl}/api/social/callback/x`,
      scope: X_CONTENT_SCOPES.join(' '),
      state,
      code_challenge: xCodeChallenge(verifier),
      code_challenge_method: 'S256',
    })
    const response = NextResponse.json({ url: `https://x.com/i/oauth2/authorize?${params.toString()}` })
    response.cookies.set(PKCE_COOKIE, verifier, {
      httpOnly: true,
      secure: appUrl.startsWith('https://'),
      sameSite: 'lax',
      path: '/api/social/callback/x',
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    console.error('[Social Connect X]', error)
    return NextResponse.json({ error: 'Failed to initiate X OAuth' }, { status: 500 })
  }
}
