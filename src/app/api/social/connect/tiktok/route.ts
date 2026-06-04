/**
 * GET /api/social/connect/tiktok
 * Initiates TikTok OAuth 2.0 flow.
 * Returns { url } — frontend redirects the user there.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clientKey = process.env.TIKTOK_CLIENT_KEY
    if (!clientKey) {
      return NextResponse.json({ error: 'TikTok App not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/social/callback/tiktok`

    // CSRF state — encode userId + timestamp
    const state = Buffer.from(
      JSON.stringify({ userId: user.id, ts: Date.now() })
    ).toString('base64url')

    const params = new URLSearchParams({
      client_key:    clientKey,
      response_type: 'code',
      // video.upload is for chunk uploads — we use PULL_FROM_URL, so only video.publish needed
      scope:         'user.info.basic,video.publish',
      redirect_uri:  redirectUri,
      state,
    })

    const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('[Social Connect TikTok] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to initiate TikTok OAuth' }, { status: 500 })
  }
}
