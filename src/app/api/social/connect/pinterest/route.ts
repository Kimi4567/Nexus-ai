import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState, isOAuthStateConfigured } from '@/lib/oauthState'
import { PINTEREST_CONTENT_SCOPES } from '@/lib/socialPlatformConfig'
import { createPinterestOAuthNonce, pinterestOAuthNonceHash } from '@/lib/pinterestPublishing'

export const dynamic = 'force-dynamic'

const OAUTH_COOKIE = 'nexus_pinterest_oauth'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clientId = process.env.PINTEREST_APP_ID
    const clientSecret = process.env.PINTEREST_APP_SECRET
    if (!clientId || !clientSecret || !isOAuthStateConfigured()) {
      return NextResponse.json({
        error: 'Pinterest OAuth is not configured yet',
        code: 'PINTEREST_OAUTH_NOT_CONFIGURED',
      }, { status: 503 })
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const nonce = createPinterestOAuthNonce()
    const state = createOAuthState(user.id, 'pinterest', pinterestOAuthNonceHash(nonce))
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${appUrl}/api/social/callback/pinterest`,
      response_type: 'code',
      scope: PINTEREST_CONTENT_SCOPES.join(','),
      state,
    })
    const response = NextResponse.json({ url: `https://www.pinterest.com/oauth/?${params.toString()}` })
    response.cookies.set(OAUTH_COOKIE, nonce, {
      httpOnly: true,
      secure: appUrl.startsWith('https://'),
      sameSite: 'lax',
      path: '/api/social/callback/pinterest',
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    console.error('[Social Connect Pinterest]', error)
    return NextResponse.json({ error: 'Failed to initiate Pinterest OAuth' }, { status: 500 })
  }
}
