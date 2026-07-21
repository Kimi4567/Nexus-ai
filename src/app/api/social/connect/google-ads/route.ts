import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState, isOAuthStateConfigured, oauthStateMaxAgeSeconds } from '@/lib/oauthState'
import { GOOGLE_ADS_SCOPE } from '@/lib/adPlatforms/googleAdsApi'
import {
  createGoogleAdsOAuthNonce,
  googleAdsOAuthNonceHash,
} from '@/lib/googleAdsOAuth'

export const dynamic = 'force-dynamic'

const OAUTH_COOKIE = 'nexus_google_ads_oauth'

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    if (!clientId || !clientSecret || !developerToken || !isOAuthStateConfigured()) {
      return NextResponse.json({
        error: 'Google Ads OAuth or developer token is not configured yet',
        code: 'GOOGLE_ADS_NOT_CONFIGURED',
      }, { status: 503 })
    }

    const nonce = createGoogleAdsOAuthNonce()
    const state = createOAuthState(user.id, 'google_ads', googleAdsOAuthNonceHash(nonce))
    const redirectUri = `${appUrl()}/api/social/callback/google-ads`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_ADS_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    })
    const response = NextResponse.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    })
    response.cookies.set(OAUTH_COOKIE, nonce, {
      httpOnly: true,
      secure: appUrl().startsWith('https://'),
      sameSite: 'lax',
      path: '/api/social/callback/google-ads',
      maxAge: oauthStateMaxAgeSeconds('google_ads'),
    })
    return response
  } catch (error) {
    console.error('[Google Ads Connect]', error)
    return NextResponse.json({ error: 'Failed to initiate Google Ads OAuth' }, { status: 500 })
  }
}
