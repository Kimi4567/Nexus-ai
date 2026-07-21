import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState, isOAuthStateConfigured } from '@/lib/oauthState'
import { THREADS_CONTENT_SCOPES } from '@/lib/socialPlatformConfig'
import { createThreadsOAuthNonce, threadsOAuthNonceHash } from '@/lib/threadsPublishing'

export const dynamic = 'force-dynamic'

const OAUTH_COOKIE = 'nexus_threads_oauth'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clientId = process.env.THREADS_APP_ID
    const clientSecret = process.env.THREADS_APP_SECRET
    if (!clientId || !clientSecret || !isOAuthStateConfigured()) {
      return NextResponse.json({
        error: 'Threads OAuth is not configured yet',
        code: 'THREADS_OAUTH_NOT_CONFIGURED',
      }, { status: 503 })
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const nonce = createThreadsOAuthNonce()
    const state = createOAuthState(user.id, 'threads', threadsOAuthNonceHash(nonce))
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${appUrl}/api/social/callback/threads`,
      response_type: 'code',
      scope: THREADS_CONTENT_SCOPES.join(','),
      state,
    })
    const response = NextResponse.json({ url: `https://threads.net/oauth/authorize?${params.toString()}` })
    response.cookies.set(OAUTH_COOKIE, nonce, {
      httpOnly: true,
      secure: appUrl.startsWith('https://'),
      sameSite: 'lax',
      path: '/api/social/callback/threads',
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    console.error('[Social Connect Threads]', error)
    return NextResponse.json({ error: 'Failed to initiate Threads OAuth' }, { status: 500 })
  }
}
