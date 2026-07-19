import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState, isOAuthStateConfigured } from '@/lib/oauthState'
import { getMetaOrganicScopes, META_GRAPH_VERSION } from '@/lib/socialPlatformConfig'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await adminClient.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (!appId || !appSecret || !isOAuthStateConfigured()) {
      return NextResponse.json({
        code: 'META_OAUTH_NOT_CONFIGURED',
        error: 'Meta OAuth is not configured',
      }, { status: 503 })
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const redirectUri = `${baseUrl}/api/social/callback/meta`

    const state = createOAuthState(user.id, 'meta')

    const scopes = getMetaOrganicScopes().join(',')

    const metaOAuthUrl =
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth` +
      `?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${state}` +
      `&response_type=code`

    return NextResponse.json({ url: metaOAuthUrl })
  } catch (err: any) {
    console.error('[Social Connect Meta] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to initiate Meta OAuth' }, { status: 500 })
  }
}
