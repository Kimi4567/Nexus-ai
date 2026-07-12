import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState } from '@/lib/oauthState'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await adminClient.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appId = process.env.META_APP_ID
    if (!appId) {
      return NextResponse.json({ error: 'Meta App ID not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/social/callback/meta`

    const state = createOAuthState(user.id, 'meta')

    const scopes = [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
    ].join(',')

    const metaOAuthUrl =
      `https://www.facebook.com/v21.0/dialog/oauth` +
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
