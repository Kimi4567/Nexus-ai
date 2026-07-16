import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import { xCodeVerifierHash } from '@/lib/xPublishing'
import { captureOperationalError } from '@/lib/observability/operationalError'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PKCE_COOKIE = 'nexus_x_pkce'

type XTokenResponse = {
  token_type?: string
  expires_in?: number
  access_token?: string
  refresh_token?: string
  scope?: string
  error?: string
  error_description?: string
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function redirect(path: string): NextResponse {
  const response = NextResponse.redirect(`${appUrl()}${path}`)
  response.cookies.delete(PKCE_COOKIE)
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const providerError = searchParams.get('error')
  if (providerError) return errorRedirect('authorization_not_granted')
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const verifier = req.cookies.get(PKCE_COOKIE)?.value
  if (!code || !state || !verifier) return errorRedirect('missing_oauth_context')

  let userId: string
  try {
    const payload = verifyOAuthState(state, 'x')
    if (!payload.context || !safeEqual(payload.context, xCodeVerifierHash(verifier))) {
      return errorRedirect('invalid_pkce_context')
    }
    userId = payload.userId
  } catch {
    return errorRedirect('invalid_state')
  }

  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  if (!clientId || !clientSecret) return errorRedirect('x_oauth_not_configured')

  try {
    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${appUrl()}/api/social/callback/x`,
        code_verifier: verifier,
      }),
      cache: 'no-store',
    })
    const tokenData = await tokenResponse.json().catch(() => ({})) as XTokenResponse
    if (!tokenResponse.ok || !tokenData.access_token) {
      await captureOperationalError(
        Object.assign(new Error('X token exchange rejected'), { code: tokenData.error }),
        {
          operation: 'oauth.x-token-exchange',
          route: '/api/social/callback/x',
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

    const profileResponse = await fetch('https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: 'no-store',
    })
    const profileData = await profileResponse.json().catch(() => ({}))
    const profile = profileData?.data
    if (!profileResponse.ok || !profile?.id || !profile?.username) {
      await captureOperationalError(new Error('X profile response was incomplete'), {
        operation: 'oauth.x-profile-fetch',
        route: '/api/social/callback/x',
        component: 'oauth',
        method: 'GET',
        requestId: req.headers?.get?.('x-vercel-id') ?? null,
        statusCode: 502,
        retryable: true,
      })
      return errorRedirect('x_profile_lookup_failed')
    }

    const accountId = String(profile.id)
    const username = String(profile.username)
    const accountName = String(profile.name || `@${username}`)
    const scopes = typeof tokenData.scope === 'string'
      ? tokenData.scope.split(/\s+/).filter(Boolean)
      : []
    const now = new Date()
    const expiresAt = tokenData.expires_in
      ? new Date(now.getTime() + Number(tokenData.expires_in) * 1000).toISOString()
      : null

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
      where: { workspaceId_type: { workspaceId: workspace.id, type: 'X' } },
      select: { refreshToken: true },
    })
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : existing?.refreshToken || null
    const config = {
      username,
      profileUrl: `https://x.com/${encodeURIComponent(username)}`,
      pictureUrl: profile.profile_image_url || null,
      scopes,
      scopeEvidence: tokenData.scope ? 'provider_response' : 'unavailable',
      expiresAt,
      connectedAt: now.toISOString(),
    }

    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: 'X' } },
      create: {
        workspaceId: workspace.id,
        type: 'X',
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

    return redirect('/connections?social=connected&platform=x')
  } catch (error) {
    await captureOperationalError(error, {
      operation: 'oauth.x-callback',
      route: '/api/social/callback/x',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return errorRedirect('x_connection_failed')
  }
}
