import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronAuthError } from '@/lib/cronAuth'
import { decryptToken, encryptToken } from '@/lib/tokenCrypto'
import { metaGraphUrl } from '@/lib/socialPlatformConfig'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function objectConfig(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

async function refreshTikTok(integration: any, now: Date): Promise<'refreshed' | 'skipped' | 'expired' | 'error'> {
  const config = objectConfig(integration.config)
  const expiresAt = config.expiresAt ? new Date(config.expiresAt) : null
  if (expiresAt && expiresAt.getTime() > now.getTime() + 2 * 60 * 60 * 1000 && integration.status === 'CONNECTED') {
    return 'skipped'
  }
  const refreshToken = decryptToken(integration.refreshToken)
  if (!refreshToken) {
    await prisma.integration.update({ where: { id: integration.id }, data: { status: 'EXPIRED' } })
    return 'expired'
  }
  const refreshExpiresAt = config.refreshExpiresAt ? new Date(config.refreshExpiresAt) : null
  if (refreshExpiresAt && refreshExpiresAt <= now) {
    await prisma.integration.update({ where: { id: integration.id }, data: { status: 'EXPIRED' } })
    return 'expired'
  }
  try {
    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || '',
        client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      cache: 'no-store',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.access_token) {
      const terminal = /invalid|expired|revoked/i.test(String(data.error_description || data.error || ''))
      if (terminal) await prisma.integration.update({ where: { id: integration.id }, data: { status: 'EXPIRED' } })
      return terminal ? 'expired' : 'error'
    }
    const nextExpiresAt = new Date(now.getTime() + Number(data.expires_in || 86400) * 1000)
    const nextRefreshExpiresAt = new Date(now.getTime() + Number(data.refresh_expires_in || 31536000) * 1000)
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: 'CONNECTED',
        accessToken: encryptToken(data.access_token),
        refreshToken: encryptToken(data.refresh_token || refreshToken),
        config: {
          ...config,
          scopes: typeof data.scope === 'string' ? data.scope.split(/[ ,]+/).filter(Boolean) : config.scopes,
          scopeEvidence: typeof data.scope === 'string' ? 'provider_response' : config.scopeEvidence,
          expiresAt: nextExpiresAt.toISOString(),
          refreshExpiresAt: nextRefreshExpiresAt.toISOString(),
          tokenRefreshedAt: now.toISOString(),
        },
        lastSyncedAt: now,
      },
    })
    return 'refreshed'
  } catch (error) {
    console.error('[refresh-social-tokens] TikTok', integration.id, error)
    return 'error'
  }
}

async function refreshYouTube(integration: any, now: Date): Promise<'refreshed' | 'skipped' | 'expired' | 'error'> {
  const config = objectConfig(integration.config)
  const expiresAt = config.expiresAt ? new Date(config.expiresAt) : null
  if (expiresAt && expiresAt.getTime() > now.getTime() + 2 * 60 * 60 * 1000 && integration.status === 'CONNECTED') {
    return 'skipped'
  }
  const refreshToken = decryptToken(integration.refreshToken)
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!refreshToken) {
    await prisma.integration.update({ where: { id: integration.id }, data: { status: 'EXPIRED' } })
    return 'expired'
  }
  if (!clientId || !clientSecret) return 'error'

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      cache: 'no-store',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.access_token) {
      const terminal = data.error === 'invalid_grant' || /invalid|expired|revoked/i.test(String(data.error_description || ''))
      if (terminal) await prisma.integration.update({ where: { id: integration.id }, data: { status: 'EXPIRED' } })
      return terminal ? 'expired' : 'error'
    }
    const nextExpiresAt = new Date(now.getTime() + Number(data.expires_in || 3600) * 1000)
    const scopes = typeof data.scope === 'string' && data.scope.trim()
      ? data.scope.split(/\s+/).filter(Boolean)
      : config.scopes
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: 'CONNECTED',
        accessToken: encryptToken(data.access_token),
        config: {
          ...config,
          scopes,
          scopeEvidence: typeof data.scope === 'string' && data.scope.trim() ? 'provider_response' : config.scopeEvidence,
          expiresAt: nextExpiresAt.toISOString(),
          tokenRefreshedAt: now.toISOString(),
        },
        lastSyncedAt: now,
      },
    })
    return 'refreshed'
  } catch (error) {
    console.error('[refresh-social-tokens] YouTube', integration.id, error)
    return 'error'
  }
}

async function refreshMeta(integration: any, now: Date): Promise<'refreshed' | 'skipped' | 'expired' | 'error'> {
  const config = objectConfig(integration.config)
  const expiresAt = config.expiresAt ? new Date(config.expiresAt) : null
  if (!expiresAt || expiresAt.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000) return 'skipped'
  const currentToken = decryptToken(integration.accessToken)
  if (!currentToken || !process.env.META_APP_ID || !process.env.META_APP_SECRET) return 'error'
  try {
    const url = new URL(metaGraphUrl('oauth/access_token'))
    url.searchParams.set('grant_type', 'fb_exchange_token')
    url.searchParams.set('client_id', process.env.META_APP_ID)
    url.searchParams.set('client_secret', process.env.META_APP_SECRET)
    url.searchParams.set('fb_exchange_token', currentToken)
    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.error || !data.access_token) {
      const terminal = [102, 190].includes(Number(data?.error?.code))
      if (terminal) await prisma.integration.update({ where: { id: integration.id }, data: { status: 'EXPIRED' } })
      return terminal ? 'expired' : 'error'
    }
    const nextExpiry = new Date(now.getTime() + Number(data.expires_in || 5184000) * 1000)
    const [pagesResponse, permissionsResponse] = await Promise.all([
      fetch(`${metaGraphUrl('me/accounts')}?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(data.access_token)}`, { cache: 'no-store' }),
      fetch(`${metaGraphUrl('me/permissions')}?access_token=${encodeURIComponent(data.access_token)}`, { cache: 'no-store' }),
    ])
    const pagesData = pagesResponse.ok ? await pagesResponse.json().catch(() => ({})) : {}
    const permissionsData = permissionsResponse.ok ? await permissionsResponse.json().catch(() => ({})) : {}
    const refreshedPages = Array.isArray(pagesData?.data)
      ? pagesData.data.map((page: any) => page?.id && page?.access_token ? ({
          id: page.id,
          name: page.name,
          accessToken: encryptToken(page.access_token),
          igAccountId: page.instagram_business_account?.id || null,
        }) : null).filter(Boolean)
      : null
    const grantedScopes = Array.isArray(permissionsData?.data)
      ? permissionsData.data
          .filter((entry: any) => entry?.status === 'granted' && typeof entry?.permission === 'string')
          .map((entry: any) => entry.permission)
      : null
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: 'CONNECTED',
        accessToken: encryptToken(data.access_token),
        config: {
          ...config,
          ...(refreshedPages ? { pages: refreshedPages } : {}),
          ...(grantedScopes ? { scopes: grantedScopes, scopeEvidence: 'provider_response' } : {}),
          expiresAt: nextExpiry.toISOString(),
          tokenRefreshedAt: now.toISOString(),
        },
        lastSyncedAt: now,
      },
    })
    return 'refreshed'
  } catch (error) {
    console.error('[refresh-social-tokens] Meta', integration.id, error)
    return 'error'
  }
}

async function run() {
  const now = new Date()
  const integrations = await prisma.integration.findMany({
    where: { type: { in: ['TIKTOK', 'META', 'LINKEDIN', 'YOUTUBE'] }, status: { in: ['CONNECTED', 'EXPIRED'] } },
  })
  const stats = { checked: integrations.length, refreshed: 0, skipped: 0, expired: 0, errors: 0 }
  for (const integration of integrations) {
    const config = objectConfig(integration.config)
    if (integration.type === 'LINKEDIN') {
      const expiry = config.expiresAt ? new Date(config.expiresAt) : null
      if (expiry && expiry <= now) {
        await prisma.integration.update({ where: { id: integration.id }, data: { status: 'EXPIRED' } })
        stats.expired++
      } else stats.skipped++
      continue
    }
    const result = integration.type === 'TIKTOK'
      ? await refreshTikTok(integration, now)
      : integration.type === 'YOUTUBE'
        ? await refreshYouTube(integration, now)
        : await refreshMeta(integration, now)
    if (result === 'refreshed') stats.refreshed++
    else if (result === 'skipped') stats.skipped++
    else if (result === 'expired') stats.expired++
    else stats.errors++
  }
  return stats
}

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError
  return NextResponse.json({ ok: true, stats: await run() })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
