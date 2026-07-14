import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState } from '@/lib/oauthState'
import { YOUTUBE_CONTENT_SCOPES } from '@/lib/socialPlatformConfig'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'YouTube OAuth is not configured yet' }, { status: 503 })
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${baseUrl}/api/social/callback/youtube`,
      response_type: 'code',
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      scope: YOUTUBE_CONTENT_SCOPES.join(' '),
      state: createOAuthState(user.id, 'youtube'),
    })

    return NextResponse.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  } catch (error) {
    console.error('[Social Connect YouTube]', error)
    return NextResponse.json({ error: 'Failed to initiate YouTube OAuth' }, { status: 500 })
  }
}
