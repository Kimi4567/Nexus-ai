import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function errorRedirect(message: string): NextResponse {
  return NextResponse.redirect(`${baseUrl()}/connections?social=error&msg=${encodeURIComponent(message.slice(0, 120))}`)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const providerError = searchParams.get('error')
  if (providerError) return errorRedirect(searchParams.get('error_description') || providerError)
  if (!code || !state) return errorRedirect('missing_params')

  let userId: string
  try {
    userId = verifyOAuthState(state, 'youtube').userId
  } catch {
    return errorRedirect('invalid_state')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return errorRedirect('youtube_oauth_not_configured')

  try {
    const redirectUri = `${baseUrl()}/api/social/callback/youtube`
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })
    const tokenData = await tokenResponse.json().catch(() => ({})) as GoogleTokenResponse
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[YouTube OAuth] Token exchange failed', tokenData.error)
      return errorRedirect(tokenData.error_description || tokenData.error || 'token_exchange_failed')
    }

    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true&maxResults=1',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: 'no-store',
      },
    )
    const channelData = await channelResponse.json().catch(() => ({}))
    const channel = Array.isArray(channelData?.items) ? channelData.items[0] : null
    if (!channelResponse.ok || !channel?.id) {
      console.error('[YouTube OAuth] Channel discovery failed', channelData?.error)
      return errorRedirect(channelResponse.ok ? 'youtube_channel_required' : 'youtube_channel_lookup_failed')
    }

    const channelId = String(channel.id)
    const channelName = String(channel?.snippet?.title || 'YouTube Channel')
    const pictureUrl = channel?.snippet?.thumbnails?.default?.url || null
    const scopes = typeof tokenData.scope === 'string'
      ? tokenData.scope.split(/\s+/).filter(Boolean)
      : []
    const now = new Date()
    const expiresAt = tokenData.expires_in
      ? new Date(now.getTime() + Number(tokenData.expires_in) * 1000).toISOString()
      : null

    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: `user-${userId.slice(0, 8)}@nexus.internal`, name: channelName },
      update: {},
    })
    let workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
    if (!workspace) {
      const baseSlug = `workspace-${userId.slice(0, 8)}`
      const existing = await prisma.workspace.findUnique({ where: { slug: baseSlug } })
      workspace = await prisma.workspace.create({
        data: {
          ownerId: userId,
          name: `${channelName}'s Workspace`,
          slug: existing ? `${baseSlug}-${Date.now()}` : baseSlug,
        },
      })
    }

    const existing = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId: workspace.id, type: 'YOUTUBE' } },
      select: { refreshToken: true },
    })
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : existing?.refreshToken || null
    const config = {
      channelId,
      channelUrl: `https://www.youtube.com/channel/${channelId}`,
      pictureUrl,
      scopes,
      scopeEvidence: tokenData.scope ? 'provider_response' : 'unavailable',
      expiresAt,
      connectedAt: now.toISOString(),
    }

    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: 'YOUTUBE' } },
      create: {
        workspaceId: workspace.id,
        type: 'YOUTUBE',
        status: 'CONNECTED',
        accessToken: encryptToken(tokenData.access_token),
        refreshToken: encryptedRefreshToken,
        accountId: channelId,
        accountName: channelName,
        config,
        lastSyncedAt: now,
      },
      update: {
        status: 'CONNECTED',
        accessToken: encryptToken(tokenData.access_token),
        refreshToken: encryptedRefreshToken,
        accountId: channelId,
        accountName: channelName,
        config,
        lastSyncedAt: now,
      },
    })

    return NextResponse.redirect(`${baseUrl()}/connections?social=connected&platform=youtube`)
  } catch (error) {
    console.error('[YouTube OAuth] Unexpected error', error)
    return errorRedirect('youtube_connection_failed')
  }
}
