/**
 * GET /api/social/connect/tiktok
 * Initiates TikTok OAuth 2.0 flow.
 * Returns { url } — frontend redirects the user there.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientKey  = process.env.TIKTOK_CLIENT_KEY!
  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/social/callback/tiktok`

  // CSRF state — encode userId + timestamp
  const state = Buffer.from(
    JSON.stringify({ userId: user.id, ts: Date.now() })
  ).toString('base64url')

  // TikTok OAuth 2.0 authorization URL (v2)
  const params = new URLSearchParams({
    client_key:    clientKey,
    response_type: 'code',
    scope:         'user.info.basic,video.publish,video.upload',
    redirect_uri:  redirectUri,
    state,
  })

  const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`

  return NextResponse.json({ url })
}
