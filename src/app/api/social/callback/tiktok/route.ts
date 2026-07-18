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
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import { captureOperationalError } from '@/lib/observability/operationalError'

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

  // redirect:'follow' — let fetch follow any redirects, then inspect the final URL
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: commonHeaders,
    body,
    redirect: 'follow',
    cache: 'no-store',
  })

  const status     = res.status
  const redirected = res.redirected
  const finalUrl   = res.url
  const text       = await res.text()

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

  // User denied access
  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/connections?social=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=missing_params`)
  }

  let userId: string
  try {
    userId = verifyOAuthState(state, 'tiktok').userId
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
    } catch {
      console.warn('[TikTok] Primary token exchange method failed; trying fallback')
      try {
        tokenData = await attemptTokenExchange('basic_auth', exchangeParams)
      } catch (basicErr) {
        await captureOperationalError(basicErr, {
          operation: 'oauth.tiktok-token-exchange',
          route: '/api/social/callback/tiktok',
          component: 'oauth',
          method: 'GET',
          requestId: req.headers?.get?.('x-vercel-id') ?? null,
          statusCode: 502,
          retryable: true,
        })
        return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=token_exchange_failed`)
      }
    }

    const accessToken  = tokenData.access_token as string
    const refreshToken = (tokenData.refresh_token as string | undefined) ?? null
    const openId       = tokenData.open_id as string
    const expiresAt    = tokenData.expires_in
      ? new Date(Date.now() + (tokenData.expires_in as number) * 1000)
      : null
    const refreshExpiresAt = tokenData.refresh_expires_in
      ? new Date(Date.now() + Number(tokenData.refresh_expires_in) * 1000)
      : null
    const scopes = typeof tokenData.scope === 'string' && tokenData.scope.trim()
      ? tokenData.scope.split(/[ ,]+/).filter(Boolean)
      : []
    const scopeEvidence = typeof tokenData.scope === 'string' && tokenData.scope.trim()
      ? 'provider_response'
      : 'unavailable'

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
      const profileData = JSON.parse(profileText)
      const profile = profileData.data?.user || {}
      displayName = profile.display_name || 'TikTok User'
      avatarUrl   = profile.avatar_url   || null
    } catch (profileErr) {
      await captureOperationalError(profileErr, {
        operation: 'oauth.tiktok-profile-fetch',
        route: '/api/social/callback/tiktok',
        component: 'oauth',
        method: 'GET',
        requestId: req.headers?.get?.('x-vercel-id') ?? null,
        statusCode: 502,
        retryable: true,
        severity: 'warning',
      })
    }

    // ── Ensure User + Workspace exist ─────────────────────────────────────
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: `user-${userId.slice(0, 8)}@nexus.internal`, name: displayName },
      update: {},
    }).catch((error) => captureOperationalError(error, {
      operation: 'oauth.tiktok-user-upsert',
      route: '/api/social/callback/tiktok',
      component: 'database',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
      severity: 'warning',
    }))

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
        accessToken:  encryptToken(accessToken),
        refreshToken: refreshToken ? encryptToken(refreshToken) : null,
        accountId:    openId,
        accountName:  displayName,
        config: {
          openId,
          avatarUrl,
          scopes,
          scopeEvidence,
          expiresAt:   expiresAt?.toISOString() ?? null,
          refreshExpiresAt: refreshExpiresAt?.toISOString() ?? null,
          connectedAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date(),
      },
      update: {
        status:       'CONNECTED',
        accessToken:  encryptToken(accessToken),
        refreshToken: refreshToken ? encryptToken(refreshToken) : null,
        accountId:    openId,
        accountName:  displayName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: {
          openId,
          avatarUrl,
          scopes,
          scopeEvidence,
          expiresAt: expiresAt?.toISOString() ?? null,
          refreshExpiresAt: refreshExpiresAt?.toISOString() ?? null,
          connectedAt: new Date().toISOString(),
        } as any,
        lastSyncedAt: new Date(),
      },
    })

    return NextResponse.redirect(`${baseUrl}/connections?social=connected&platform=tiktok`)

  } catch (err) {
    await captureOperationalError(err, {
      operation: 'oauth.tiktok-callback',
      route: '/api/social/callback/tiktok',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=tiktok_connection_failed`)
  }
}
