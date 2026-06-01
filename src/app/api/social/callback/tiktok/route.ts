/**
 * GET /api/social/callback/tiktok
 * TikTok OAuth 2.0 callback — exchanges code for token,
 * fetches user info, saves Integration.
 *
 * Strategy: tries two token-exchange methods in order:
 *   1. Body params (standard)
 *   2. Basic Auth (client_key:client_secret in Authorization header)
 * Uses redirect:'manual' to prevent fetch from silently following
 * TikTok's error redirects to HTML pages.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Normalize app base URL — no trailing slash */
function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/** Attempt a single token exchange and return { tokenData } or throw */
async function attemptTokenExchange(
  method: 'body' | 'basic_auth',
  params: {
    clientKey: string
    clientSecret: string
    code: string
    redirectUri: string
  }
): Promise<Record<string, unknown>> {
  const { clientKey, clientSecret, code, redirectUri } = params

  const commonHeaders: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; NexusAI/1.0)',
  }

  let body: URLSearchParams
  if (method === 'body') {
    body = new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri })
  } else {
    // Basic Auth — credentials in Authorization header, not body
    const creds = Buffer.from(`${clientKey}:${clientSecret}`).toString('base64')
    commonHeaders['Authorization'] = `Basic ${creds}`
    body = new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: redirectUri })
  }

  console.log(`[TikTok] attemptTokenExchange method=${method} redirect_uri=${redirectUri} client_key_prefix=${clientKey.slice(0, 8)}`)

  // redirect:'follow' — let fetch follow any redirects, then inspect the final URL
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: commonHeaders,
    body,
    redirect: 'follow',
    cache: 'no-store',
  })

  const status      = res.status
  const redirected  = res.redirected          // true if fetch followed a redirect
  const finalUrl    = res.url                  // final URL after any redirects
  const contentType = res.headers.get('content-type') ?? ''
  const allHeaders  = Object.fromEntries([...res.headers.entries()])

  console.log(`[TikTok] method=${method} status=${status} redirected=${redirected} finalUrl=${finalUrl} content-type=${contentType}`)
  console.log(`[TikTok] all headers: ${JSON.stringify(allHeaders)}`)

  const text = await res.text()
  console.log(`[TikTok] method=${method} raw body (first 1500): ${text.slice(0, 1500)}`)

  // If we were redirected to an HTML page, reject immediately
  if (redirected) {
    throw new Error(`token_redirected_to_${finalUrl.slice(0, 80)}`)
  }

  if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
    throw new Error(`token_html_${status}`)
  }

  const data: Record<string, unknown> = JSON.parse(text)

  // TikTok V2 token: flat { access_token, open_id, ... }
  // Some versions nest under data: { data: { access_token, ... } }
  const flat = (data.data && typeof data.data === 'object')
    ? (data.data as Record<string, unknown>)
    : data

  if (!flat.access_token) {
    const errCode = (flat.error as string) ?? (flat.error_code as string) ?? (data.error as string) ?? 'unknown'
    const errMsg  = (flat.error_description as string) ?? (flat.message as string) ?? ''
    console.error(`[TikTok] method=${method} token error: ${errCode} — ${errMsg}`, data)
    throw new Error(`token_${errCode}`)
  }

  return flat
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code       = searchParams.get('code')
  const state      = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const baseUrl = getBaseUrl()

  console.log('[TikTok] Callback hit — baseUrl:', baseUrl, '| code present:', !!code, '| state present:', !!state, '| error:', errorParam)

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
    console.log('[TikTok] State decoded — userId:', userId, '| age_ms:', Date.now() - decoded.ts)
  } catch {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=invalid_state`)
  }

  try {
    const clientKey    = process.env.TIKTOK_CLIENT_KEY!
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!
    const redirectUri  = `${baseUrl}/api/social/callback/tiktok`

    if (!clientKey || !clientSecret) {
      console.error('[TikTok] Missing env vars — TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET not set')
      return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=missing_env`)
    }

    // ── Exchange code for access token — try body method first, then Basic Auth ──
    let tokenData: Record<string, unknown>
    const exchangeParams = { clientKey, clientSecret, code, redirectUri }

    try {
      tokenData = await attemptTokenExchange('body', exchangeParams)
      console.log('[TikTok] Token exchange succeeded via body method')
    } catch (bodyErr) {
      const bodyErrMsg = bodyErr instanceof Error ? bodyErr.message : String(bodyErr)
      console.warn('[TikTok] Body method failed:', bodyErrMsg, '— trying Basic Auth...')
      try {
        tokenData = await attemptTokenExchange('basic_auth', exchangeParams)
        console.log('[TikTok] Token exchange succeeded via Basic Auth method')
      } catch (basicErr) {
        const basicErrMsg = basicErr instanceof Error ? basicErr.message : String(basicErr)
        console.error('[TikTok] Both token exchange methods failed. body:', bodyErrMsg, '| basic:', basicErrMsg)
        return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=${encodeURIComponent(bodyErrMsg)}`)
      }
    }

    const accessToken  = tokenData.access_token as string
    const refreshToken = (tokenData.refresh_token as string | undefined) ?? null
    const openId       = tokenData.open_id as string
    const expiresAt    = tokenData.expires_in
      ? new Date(Date.now() + (tokenData.expires_in as number) * 1000)
      : null

    // ── Fetch TikTok user info ──────────────────────────────────────────────
    let displayName = 'TikTok User'
    let avatarUrl: string | null = null
    try {
      const profileRes = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'Mozilla/5.0 (compatible; NexusAI/1.0)',
          },
          cache: 'no-store',
        }
      )
      const profileText = await profileRes.text()
      console.log('[TikTok] Profile response:', profileText.slice(0, 500))
      const profileData = JSON.parse(profileText)
      const profile = profileData.data?.user || {}
      displayName = profile.display_name || 'TikTok User'
      avatarUrl   = profile.avatar_url   || null
    } catch (profileErr) {
      console.error('[TikTok] Profile fetch failed (non-fatal):', profileErr)
    }

    console.log('[TikTok] userId:', userId, '| openId:', openId, '| name:', displayName)

    // ── Ensure User + Workspace exist ─────────────────────────────────────
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: `user-${userId.slice(0, 8)}@nexus.internal`, name: displayName },
      update: {},
    }).catch((e) => console.error('[TikTok] User upsert failed:', e))

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

    // ── Upsert Integration ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const TK_TYPE = 'TIKTOK' as any
    await prisma.integration.upsert({
      where:  { workspaceId_type: { workspaceId: workspace.id, type: TK_TYPE } },
      create: {
        workspaceId:  workspace.id,
        type:         TK_TYPE,
        status:       'CONNECTED',
        accessToken,
        refreshToken,
        accountId:    openId,
        accountName:  displayName,
        config: {
          openId,
          avatarUrl,
          expiresAt:   expiresAt?.toISOString() ?? null,
          connectedAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date(),
      },
      update: {
        status:       'CONNECTED',
        accessToken,
        refreshToken,
        accountId:    openId,
        accountName:  displayName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { openId, avatarUrl, expiresAt: expiresAt?.toISOString() ?? null, connectedAt: new Date().toISOString() } as any,
        lastSyncedAt: new Date(),
      },
    })
    console.log('[TikTok] Integration saved! openId:', openId)

    return NextResponse.redirect(`${baseUrl}/connections?social=connected&platform=tiktok`)

  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100)
    console.error('[TikTok] Unhandled error:', err)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=${encodeURIComponent(errMsg)}`)
  }
}
