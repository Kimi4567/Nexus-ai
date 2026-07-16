import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import { pinterestApiUrl } from '@/lib/socialPlatformConfig'
import { pinterestOAuthNonceHash, type PinterestBoard } from '@/lib/pinterestPublishing'
import { captureOperationalError } from '@/lib/observability/operationalError'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const OAUTH_COOKIE = 'nexus_pinterest_oauth'

type PinterestTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  refresh_token_expires_at?: number
  scope?: string
  error?: string
  error_description?: string
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function redirect(path: string): NextResponse {
  const response = NextResponse.redirect(`${appUrl()}${path}`)
  response.cookies.delete(OAUTH_COOKIE)
  return response
}

function errorRedirect(message: string): NextResponse {
  return redirect(`/connections?social=error&msg=${encodeURIComponent(message.slice(0, 120))}`)
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function readPublicBoards(accessToken: string): Promise<PinterestBoard[]> {
  const boards: PinterestBoard[] = []
  const seen = new Set<string>()
  let bookmark: string | null = null
  for (let page = 0; page < 8; page++) {
    const url = new URL(pinterestApiUrl('boards'))
    url.searchParams.set('privacy', 'PUBLIC')
    url.searchParams.set('page_size', '250')
    if (bookmark) url.searchParams.set('bookmark', bookmark)
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !Array.isArray(data?.items)) {
      throw new Error(data?.message || 'pinterest_board_lookup_failed')
    }
    for (const value of data.items) {
      const id = typeof value?.id === 'string' ? value.id : ''
      const name = typeof value?.name === 'string' ? value.name.trim() : ''
      if (!/^\d+$/.test(id) || !name || seen.has(id) || value?.is_ads_only === true) continue
      seen.add(id)
      boards.push({
        id,
        name: name.slice(0, 200),
        privacy: typeof value?.privacy === 'string' ? value.privacy : 'PUBLIC',
        isAdsOnly: false,
      })
    }
    bookmark = typeof data.bookmark === 'string' && data.bookmark ? data.bookmark : null
    if (!bookmark) break
  }
  return boards
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const providerError = searchParams.get('error')
  if (providerError) return errorRedirect('authorization_not_granted')
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const nonce = req.cookies.get(OAUTH_COOKIE)?.value
  if (!code || !state || !nonce) return errorRedirect('missing_oauth_context')

  let userId: string
  try {
    const payload = verifyOAuthState(state, 'pinterest')
    if (!payload.context || !safeEqual(payload.context, pinterestOAuthNonceHash(nonce))) {
      return errorRedirect('invalid_oauth_context')
    }
    userId = payload.userId
  } catch {
    return errorRedirect('invalid_state')
  }

  const clientId = process.env.PINTEREST_APP_ID
  const clientSecret = process.env.PINTEREST_APP_SECRET
  if (!clientId || !clientSecret) return errorRedirect('pinterest_oauth_not_configured')

  try {
    const tokenResponse = await fetch(pinterestApiUrl('oauth/token'), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        redirect_uri: `${appUrl()}/api/social/callback/pinterest`,
        grant_type: 'authorization_code',
        continuous_refresh: 'true',
      }),
      cache: 'no-store',
    })
    const tokenData = await tokenResponse.json().catch(() => ({})) as PinterestTokenResponse
    if (!tokenResponse.ok || !tokenData.access_token) {
      await captureOperationalError(
        Object.assign(new Error('Pinterest token exchange rejected'), { code: tokenData.error }),
        {
          operation: 'oauth.pinterest-token-exchange',
          route: '/api/social/callback/pinterest',
          component: 'oauth',
          method: 'GET',
          requestId: req.headers?.get?.('x-vercel-id') ?? null,
          statusCode: 400,
          retryable: false,
          severity: 'warning',
        },
      )
      return errorRedirect('token_exchange_failed')
    }

    const [profileResponse, boards] = await Promise.all([
      fetch(pinterestApiUrl('user_account'), {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: 'no-store',
      }),
      readPublicBoards(tokenData.access_token),
    ])
    const profile = await profileResponse.json().catch(() => ({}))
    if (!profileResponse.ok || typeof profile?.id !== 'string' || typeof profile?.username !== 'string') {
      await captureOperationalError(new Error('Pinterest profile response was incomplete'), {
        operation: 'oauth.pinterest-profile-fetch',
        route: '/api/social/callback/pinterest',
        component: 'oauth',
        method: 'GET',
        requestId: req.headers?.get?.('x-vercel-id') ?? null,
        statusCode: 502,
        retryable: true,
      })
      return errorRedirect('pinterest_profile_lookup_failed')
    }

    const accountId = String(profile.id)
    const username = String(profile.username)
    const accountName = String(profile.business_name || username)
    const scopes = typeof tokenData.scope === 'string'
      ? tokenData.scope.split(/[ ,]+/).filter(Boolean)
      : []
    const now = new Date()
    const expiresAt = tokenData.expires_in
      ? new Date(now.getTime() + Number(tokenData.expires_in) * 1000).toISOString()
      : null
    const refreshExpiresAt = tokenData.refresh_token_expires_at
      ? new Date(Number(tokenData.refresh_token_expires_at) * 1000).toISOString()
      : tokenData.refresh_token_expires_in
        ? new Date(now.getTime() + Number(tokenData.refresh_token_expires_in) * 1000).toISOString()
        : null
    const accessTier = process.env.PINTEREST_ACCESS_TIER?.toUpperCase() === 'STANDARD' ? 'STANDARD' : 'TRIAL'

    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: `user-${userId.slice(0, 8)}@nexus.internal`, name: accountName },
      update: {},
    })
    let workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
    if (!workspace) {
      const baseSlug = `workspace-${userId.slice(0, 8)}`
      const existingSlug = await prisma.workspace.findUnique({ where: { slug: baseSlug } })
      workspace = await prisma.workspace.create({
        data: {
          ownerId: userId,
          name: `${accountName}'s Workspace`,
          slug: existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug,
        },
      })
    }

    const existing = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId: workspace.id, type: 'PINTEREST' } },
      select: { refreshToken: true },
    })
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : existing?.refreshToken || null
    const config = {
      username,
      profileUrl: `https://www.pinterest.com/${encodeURIComponent(username)}/`,
      pictureUrl: typeof profile.profile_image === 'string' ? profile.profile_image : null,
      boards,
      scopes,
      scopeEvidence: tokenData.scope ? 'provider_response' : 'unavailable',
      accessTier,
      accessTierEvidence: 'operator_configuration',
      expiresAt,
      refreshExpiresAt,
      connectedAt: now.toISOString(),
    }

    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: 'PINTEREST' } },
      create: {
        workspaceId: workspace.id,
        type: 'PINTEREST',
        status: 'CONNECTED',
        accessToken: encryptToken(tokenData.access_token),
        refreshToken: encryptedRefreshToken,
        accountId,
        accountName,
        config,
        lastSyncedAt: now,
      },
      update: {
        status: 'CONNECTED',
        accessToken: encryptToken(tokenData.access_token),
        refreshToken: encryptedRefreshToken,
        accountId,
        accountName,
        config,
        lastSyncedAt: now,
      },
    })

    return redirect('/connections?social=connected&platform=pinterest')
  } catch (error) {
    await captureOperationalError(error, {
      operation: 'oauth.pinterest-callback',
      route: '/api/social/callback/pinterest',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return errorRedirect('pinterest_connection_failed')
  }
}
