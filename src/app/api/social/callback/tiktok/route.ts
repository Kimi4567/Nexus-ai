/**
 * GET /api/social/callback/tiktok
 * TikTok OAuth 2.0 callback — exchanges code for token,
 * fetches user info, saves Integration.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code       = searchParams.get('code')
  const state      = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // User denied access
  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/connections?social=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=missing_params`)
  }

  // Decode + validate state
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.userId
    if (Date.now() - decoded.ts > 60 * 60 * 1000) throw new Error('stale')
  } catch {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=invalid_state`)
  }

  try {
    const clientKey    = process.env.TIKTOK_CLIENT_KEY!
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!
    const redirectUri  = `${baseUrl}/api/social/callback/tiktok`

    // ── Exchange code for access token ──────────────────────────────────────
    const tokenRes = await fetch('https://open.tiktok.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key:    clientKey,
        client_secret: clientSecret,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  redirectUri,
      }),
    })
    const tokenData = await tokenRes.json()
    console.log('[TikTok OAuth] Token response:', JSON.stringify(tokenData))

    if (!tokenData.access_token) {
      console.error('[TikTok OAuth] Token exchange failed:', tokenData)
      return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=token_exchange`)
    }

    const accessToken  = tokenData.access_token as string
    const refreshToken = tokenData.refresh_token as string | null
    const openId       = tokenData.open_id as string
    const expiresAt    = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null

    // ── Fetch TikTok user info ────────────────────────────────────────────
    let displayName = 'TikTok User'
    let avatarUrl: string | null = null
    try {
      const profileRes = await fetch(
        'https://open.tiktok.com/v2/user/info/?fields=open_id,display_name,avatar_url',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const profileData = await profileRes.json()
      console.log('[TikTok OAuth] Profile response:', JSON.stringify(profileData))
      const profile = profileData.data?.user || {}
      displayName = profile.display_name || 'TikTok User'
      avatarUrl   = profile.avatar_url   || null
    } catch (profileErr) {
      console.error('[TikTok OAuth] Profile fetch failed (non-fatal):', profileErr)
    }

    console.log('[TikTok OAuth] userId:', userId, '| openId:', openId, '| name:', displayName)

    // ── Ensure User + Workspace exist ────────────────────────────────────
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: `user-${userId.slice(0, 8)}@nexus.internal`, name: displayName },
      update: {},
    }).catch((e) => console.error('[TikTok OAuth] User upsert failed:', e))

    let workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
    if (!workspace) {
      const slug     = `workspace-${userId.slice(0, 8)}`
      const existing = await prisma.workspace.findUnique({ where: { slug } })
      workspace = await prisma.workspace.create({
        data: {
          name:    `${displayName}'s Workspace`,
          slug:    existing ? `workspace-${userId.slice(0, 12)}-${Date.now()}` : slug,
          ownerId: userId,
        },
      })
    }

    // ── Upsert Integration ─────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const TK_TYPE = 'TIKTOK' as any
    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: TK_TYPE } },
      create: {
        workspaceId:  workspace.id,
        type:         TK_TYPE,
        status:       'CONNECTED',
        accessToken,
        refreshToken: refreshToken || null,
        accountId:    openId,
        accountName:  displayName,
        config: {
          openId,
          avatarUrl,
          expiresAt:   expiresAt?.toISOString() || null,
          connectedAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date(),
      },
      update: {
        status:       'CONNECTED',
        accessToken,
        refreshToken: refreshToken || null,
        accountId:    openId,
        accountName:  displayName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: {
          openId,
          avatarUrl,
          expiresAt:   expiresAt?.toISOString() || null,
          connectedAt: new Date().toISOString(),
        } as any,
        lastSyncedAt: new Date(),
      },
    })
    console.log('[TikTok OAuth] Integration saved!')

    return NextResponse.redirect(`${baseUrl}/connections?social=connected&platform=tiktok`)

  } catch (err) {
    console.error('[TikTok OAuth] Unhandled error:', err)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=server_error`)
  }
}
