/**
 * GET /api/social/callback/tiktok
 * TikTok OAuth 2.0 callback — exchanges code for token,
 * fetches user info, saves Integration.
 *
 * Uses TikTok's documented form-encoded authorization-code exchange only.
 * A failed provider charge or response must never be hidden by a second,
 * undocumented exchange attempt.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import { captureOperationalError } from '@/lib/observability/operationalError'
import { resolveTikTokRedirectUri } from '@/lib/tiktokOAuth'
import { queryTikTokCreatorInfo } from '@/lib/tiktokPublishing'

/** Normalize app base URL — no trailing slash */
function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/** Exchange a code exactly once using TikTok's documented request shape. */
async function exchangeAuthorizationCode(
  params: {
    clientKey: string
    clientSecret: string
    code: string
    redirectUri: string
  }
): Promise<Record<string, unknown>> {
  const { clientKey, clientSecret, code, redirectUri } = params

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    redirect: 'manual',
    cache: 'no-store',
  })

  const status     = res.status
  const text       = await res.text()

  if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
    throw new Error(`token_html_${status}`)
  }

  const data: Record<string, unknown> = JSON.parse(text)

  // TikTok V2 token: flat { access_token, open_id, ... }
  // Some versions nest under data: { data: { access_token, ... } }
  const flat = (data.data && typeof data.data === 'object')
    ? (data.data as Record<string, unknown>)
    : data

  if (!res.ok || !flat.access_token || !flat.open_id) {
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
    const redirectUri  = resolveTikTokRedirectUri(baseUrl)

    if (!clientKey || !clientSecret) {
      console.error('[TikTok] Missing env vars — TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET not set')
      return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=missing_env`)
    }

    // One deterministic exchange prevents duplicate or untraceable attempts.
    let tokenData: Record<string, unknown>
    try {
      tokenData = await exchangeAuthorizationCode({ clientKey, clientSecret, code, redirectUri })
    } catch (exchangeError) {
      await captureOperationalError(exchangeError, {
        operation: 'oauth.tiktok-token-exchange',
        route: '/api/social/callback/tiktok',
        component: 'oauth',
        method: 'GET',
        requestId: req.headers?.get?.('x-vercel-id') ?? null,
        statusCode: 502,
        retryable: false,
      })
      return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=token_exchange_failed`)
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
    let profileEvidence: 'provider_response' | 'unavailable' = 'unavailable'
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
      if (!profileRes.ok) throw new Error(`TikTok profile request failed with ${profileRes.status}`)
      const profileText = await profileRes.text()
      const profileData = JSON.parse(profileText)
      const profile = profileData.data?.user || {}
      displayName = profile.display_name || 'TikTok User'
      avatarUrl   = profile.avatar_url   || null
      profileEvidence = profile.open_id === openId ? 'provider_response' : 'unavailable'
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

    // Direct Post requires a provider-confirmed creator-info response so the
    // user can review the privacy levels and interaction restrictions that
    // TikTok currently allows. Reconnecting must be able to complete this
    // readiness check; otherwise Connections remains permanently unverified.
    let creatorInfoVerifiedAt: string | null = null
    let privacyLevelOptions: string[] = []
    let creatorUsername: string | null = null
    if (scopes.includes('video.publish')) {
      try {
        const creator = await queryTikTokCreatorInfo(accessToken)
        creatorInfoVerifiedAt = new Date().toISOString()
        privacyLevelOptions = creator.privacyLevelOptions
        creatorUsername = creator.creatorUsername
      } catch (creatorInfoError) {
        await captureOperationalError(creatorInfoError, {
          operation: 'oauth.tiktok-creator-info',
          route: '/api/social/callback/tiktok',
          component: 'oauth',
          method: 'GET',
          requestId: req.headers?.get?.('x-vercel-id') ?? null,
          statusCode: 502,
          retryable: true,
          severity: 'warning',
        })
      }
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
          profileEvidence,
          scopes,
          scopeEvidence,
          creatorInfoVerifiedAt,
          privacyLevelOptions,
          creatorUsername,
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
          profileEvidence,
          scopes,
          scopeEvidence,
          creatorInfoVerifiedAt,
          privacyLevelOptions,
          creatorUsername,
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
