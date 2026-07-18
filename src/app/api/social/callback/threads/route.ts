import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import { threadsApiUrl } from '@/lib/socialPlatformConfig'
import { threadsOAuthNonceHash } from '@/lib/threadsPublishing'
import { captureOperationalError } from '@/lib/observability/operationalError'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const OAUTH_COOKIE = 'nexus_threads_oauth'

type TokenResponse = {
  access_token?: string
  user_id?: string | number
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

type DebugTokenData = {
  app_id?: string
  user_id?: string
  is_valid?: boolean
  expires_at?: number
  scopes?: unknown
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

async function json(response: Response): Promise<Record<string, any>> {
  const text = await response.text()
  if (!text) return {}
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return { message: text.slice(0, 300) }
  }
}

async function debugAccessToken(input: {
  accessToken: string
  clientId: string
  clientSecret: string
}): Promise<{ scopes: string[]; expiresAt: string | null; verified: boolean; userId: string | null }> {
  const appTokenUrl = new URL(threadsApiUrl('oauth/access_token'))
  appTokenUrl.search = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: input.clientId,
    client_secret: input.clientSecret,
  }).toString()
  const appTokenResponse = await fetch(appTokenUrl, { cache: 'no-store' })
  const appToken = await json(appTokenResponse)
  if (!appTokenResponse.ok || typeof appToken.access_token !== 'string') {
    return { scopes: [], expiresAt: null, verified: false, userId: null }
  }

  const debugUrl = new URL(threadsApiUrl('debug_token'))
  debugUrl.searchParams.set('input_token', input.accessToken)
  const debugResponse = await fetch(debugUrl, {
    headers: { Authorization: `Bearer ${appToken.access_token}` },
    cache: 'no-store',
  })
  const debug = await json(debugResponse)
  const data = (debug.data && typeof debug.data === 'object' ? debug.data : {}) as DebugTokenData
  const matchesApp = !data.app_id || data.app_id === input.clientId
  const verified = debugResponse.ok && data.is_valid === true && matchesApp
  const scopes = verified && Array.isArray(data.scopes)
    ? data.scopes.filter((scope): scope is string => typeof scope === 'string')
    : []
  const expiresAt = verified && Number(data.expires_at) > 0
    ? new Date(Number(data.expires_at) * 1000).toISOString()
    : null
  return {
    scopes,
    expiresAt,
    verified,
    userId: verified && data.user_id ? String(data.user_id) : null,
  }
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
    const payload = verifyOAuthState(state, 'threads')
    if (!payload.context || !safeEqual(payload.context, threadsOAuthNonceHash(nonce))) {
      return errorRedirect('invalid_oauth_context')
    }
    userId = payload.userId
  } catch {
    return errorRedirect('invalid_state')
  }

  const clientId = process.env.THREADS_APP_ID
  const clientSecret = process.env.THREADS_APP_SECRET
  if (!clientId || !clientSecret) return errorRedirect('threads_oauth_not_configured')

  try {
    const callbackUrl = `${appUrl()}/api/social/callback/threads`
    const tokenUrl = new URL(threadsApiUrl('oauth/access_token'))
    tokenUrl.search = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl,
    }).toString()
    const shortResponse = await fetch(tokenUrl, { method: 'POST', cache: 'no-store' })
    const shortToken = await json(shortResponse) as TokenResponse
    if (!shortResponse.ok || !shortToken.access_token || !shortToken.user_id) {
      await captureOperationalError(
        Object.assign(new Error('Threads short token exchange rejected'), { code: shortToken.error }),
        {
          operation: 'oauth.threads-short-token-exchange',
          route: '/api/social/callback/threads',
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

    const longUrl = new URL(threadsApiUrl('access_token'))
    longUrl.search = new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: clientSecret,
    }).toString()
    const longResponse = await fetch(longUrl, {
      headers: { Authorization: `Bearer ${shortToken.access_token}` },
      cache: 'no-store',
    })
    const longToken = await json(longResponse) as TokenResponse
    if (!longResponse.ok || !longToken.access_token || !longToken.expires_in) {
      await captureOperationalError(
        Object.assign(new Error('Threads long token exchange rejected'), { code: longToken.error }),
        {
          operation: 'oauth.threads-long-token-exchange',
          route: '/api/social/callback/threads',
          component: 'oauth',
          method: 'GET',
          requestId: req.headers?.get?.('x-vercel-id') ?? null,
          statusCode: 502,
          retryable: true,
        },
      )
      return errorRedirect('long_lived_token_exchange_failed')
    }

    const profileUrl = new URL(threadsApiUrl('me'))
    profileUrl.searchParams.set('fields', 'id,username,name,threads_profile_picture_url,threads_biography')
    const [profileResponse, tokenEvidence] = await Promise.all([
      fetch(profileUrl, {
        headers: { Authorization: `Bearer ${longToken.access_token}` },
        cache: 'no-store',
      }),
      debugAccessToken({ accessToken: longToken.access_token, clientId, clientSecret }),
    ])
    const profile = await json(profileResponse)
    if (!profileResponse.ok || typeof profile.id !== 'string' || typeof profile.username !== 'string') {
      await captureOperationalError(new Error('Threads profile response was incomplete'), {
        operation: 'oauth.threads-profile-fetch',
        route: '/api/social/callback/threads',
        component: 'oauth',
        method: 'GET',
        requestId: req.headers?.get?.('x-vercel-id') ?? null,
        statusCode: 502,
        retryable: true,
      })
      return errorRedirect('threads_profile_lookup_failed')
    }
    if (String(profile.id) !== String(shortToken.user_id)) {
      return errorRedirect('threads_identity_mismatch')
    }
    if (tokenEvidence.userId && tokenEvidence.userId !== String(profile.id)) {
      return errorRedirect('threads_token_identity_mismatch')
    }

    const now = new Date()
    const tokenExpiresAt = tokenEvidence.expiresAt
      || new Date(now.getTime() + Number(longToken.expires_in) * 1000).toISOString()
    const username = profile.username.trim()
    const accountName = typeof profile.name === 'string' && profile.name.trim()
      ? profile.name.trim()
      : username
    const accessTier = process.env.THREADS_ACCESS_TIER?.toUpperCase() === 'LIVE' ? 'LIVE' : 'DEVELOPMENT'

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

    const config = {
      username,
      profileUrl: `https://www.threads.net/@${encodeURIComponent(username)}`,
      pictureUrl: typeof profile.threads_profile_picture_url === 'string' ? profile.threads_profile_picture_url : null,
      biography: typeof profile.threads_biography === 'string' ? profile.threads_biography : null,
      scopes: tokenEvidence.scopes,
      requestedScopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
      scopeEvidence: tokenEvidence.verified ? 'provider_response' : 'unavailable',
      accessTier,
      accessTierEvidence: 'operator_configuration',
      expiresAt: tokenExpiresAt,
      connectedAt: now.toISOString(),
      tokenRefreshedAt: now.toISOString(),
    }

    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: 'THREADS' } },
      create: {
        workspaceId: workspace.id,
        type: 'THREADS',
        status: 'CONNECTED',
        accessToken: encryptToken(longToken.access_token),
        refreshToken: null,
        accountId: String(profile.id),
        accountName,
        config,
        lastSyncedAt: now,
      },
      update: {
        status: 'CONNECTED',
        accessToken: encryptToken(longToken.access_token),
        refreshToken: null,
        accountId: String(profile.id),
        accountName,
        config,
        lastSyncedAt: now,
      },
    })

    return redirect('/connections?social=connected&platform=threads')
  } catch (error) {
    await captureOperationalError(error, {
      operation: 'oauth.threads-callback',
      route: '/api/social/callback/threads',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return errorRedirect('threads_connection_failed')
  }
}
