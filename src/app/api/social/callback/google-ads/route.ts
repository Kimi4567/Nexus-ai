import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminClient } from '@/lib/supabaseAuth'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import {
  discoverGoogleAdsConnection,
  exchangeGoogleAdsAuthorizationCode,
  googleAdsAccessTier,
  googleAdsAccountExecutionBlocker,
  GoogleAdsOAuthError,
  GOOGLE_ADS_SCOPE,
} from '@/lib/adPlatforms/googleAdsApi'
import { googleAdsOAuthContextMatches } from '@/lib/googleAdsOAuth'
import { captureOperationalError } from '@/lib/observability/operationalError'
import { getRequestBaseUrl } from '@/lib/requestBaseUrl'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const OAUTH_COOKIE = 'nexus_google_ads_oauth'

// AdAccount currently predates strict Prisma typing in this route family.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

function redirect(baseUrl: string, path: string): NextResponse {
  const response = NextResponse.redirect(`${baseUrl}${path}`)
  response.cookies.set(OAUTH_COOKIE, '', {
    httpOnly: true,
    secure: baseUrl.startsWith('https://'),
    sameSite: 'lax',
    path: '/api/social/callback/google-ads',
    maxAge: 0,
  })
  return response
}

function errorRedirect(baseUrl: string, message: string): NextResponse {
  return redirect(baseUrl, `/connections?social=error&msg=${encodeURIComponent(message.slice(0, 120))}`)
}

export async function GET(req: NextRequest) {
  const baseUrl = getRequestBaseUrl(req)
  const { searchParams } = new URL(req.url)
  const providerError = searchParams.get('error')
  if (providerError) {
    return errorRedirect(baseUrl, 'authorization_not_granted')
  }
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const nonce = req.cookies.get(OAUTH_COOKIE)?.value
  if (!code || !state || !nonce) {
    console.warn('[Google Ads OAuth] missing_context', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasNonce: Boolean(nonce),
      callbackOrigin: new URL(req.url).origin,
    })
    return errorRedirect(baseUrl, 'The Google Ads connection session expired. Start the connection again.')
  }

  let userId: string
  try {
    const payload = verifyOAuthState(state, 'google_ads')
    if (!payload.context || !googleAdsOAuthContextMatches(payload.context, nonce)) {
      return errorRedirect(baseUrl, 'invalid_oauth_context')
    }
    userId = payload.userId
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid OAuth state'
    console.warn('[Google Ads OAuth] invalid_state')
    return errorRedirect(
      baseUrl,
      reason.includes('Expired')
        ? 'The Google Ads connection session expired. Start the connection again.'
        : 'The Google Ads connection could not be verified. Start the connection again.',
    )
  }

  try {
    const redirectUri = `${baseUrl}/api/social/callback/google-ads`
    const token = await exchangeGoogleAdsAuthorizationCode({ code, redirectUri })
    const discovery = await discoverGoogleAdsConnection(token.accessToken)
    const accounts = discovery.accounts
    const now = new Date()
    const expiresAt = new Date(now.getTime() + token.expiresIn * 1000)
    const scopes = token.scopes.includes(GOOGLE_ADS_SCOPE)
      ? token.scopes
      : [...new Set([...token.scopes, GOOGLE_ADS_SCOPE])]

    let email: string | undefined
    try {
      const { data } = await adminClient.auth.admin.getUserById(userId)
      email = data.user?.email
    } catch {
      // The Google Ads API account is still provider-verified; email lookup is non-fatal.
    }

    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: email || `user-${userId.slice(0, 8)}@nexus.internal`,
        name: email?.split('@')[0] || 'NEXUS User',
      },
      update: email ? { email } : {},
    })
    let workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          ownerId: userId,
          name: 'My Workspace',
          slug: `workspace-${userId.slice(0, 8)}-${Date.now()}`,
        },
      })
    }

    const encryptedAccessToken = encryptToken(token.accessToken)
    const encryptedRefreshToken = encryptToken(token.refreshToken)
    const primaryManager = discovery.managers[0] || null
    const primaryAccount = accounts[0] || null
    const connectionRole = primaryManager ? 'MANAGER' : 'ADVERTISER'
    const integrationAccountId = primaryManager?.customerId
      || primaryAccount?.loginCustomerId
      || primaryAccount?.customerId
      || null
    const integrationAccountName = primaryManager?.descriptiveName
      || primaryAccount?.managerName
      || primaryAccount?.descriptiveName
      || 'Google Ads'
    const integrationConfig = {
      connectionRole,
      scopes,
      scopeEvidence: 'provider_response',
      connectedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      accessTier: googleAdsAccessTier(),
      advertiserAccountCount: accounts.length,
      advertiserReadiness: accounts.length > 0 ? 'DISCOVERED' : 'NOT_VISIBLE',
      lastDiscoveryAt: now.toISOString(),
      managerAccounts: discovery.managers.map(manager => ({
        customerId: manager.customerId,
        descriptiveName: manager.descriptiveName,
        status: manager.status,
        testAccount: manager.testAccount,
      })),
    }

    await prisma.integration.upsert({
      where: {
        workspaceId_type: {
          workspaceId: workspace.id,
          type: 'GOOGLE',
        },
      },
      create: {
        workspaceId: workspace.id,
        type: 'GOOGLE',
        status: 'CONNECTED',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        accountId: integrationAccountId,
        accountName: integrationAccountName,
        lastSyncedAt: now,
        config: integrationConfig,
      },
      update: {
        status: 'CONNECTED',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        accountId: integrationAccountId,
        accountName: integrationAccountName,
        lastSyncedAt: now,
        config: integrationConfig,
      },
    })

    const discoveredAccountIds = accounts.map(account => account.customerId)
    await db.adAccount.updateMany({
      where: {
        workspaceId: workspace.id,
        platform: 'GOOGLE',
        ...(discoveredAccountIds.length > 0
          ? { platformAccountId: { notIn: discoveredAccountIds } }
          : {}),
      },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        hasApiAccess: false,
        lastError: 'Google Ads no longer exposes this advertiser account to the connected OAuth identity.',
        lastErrorAt: now,
      },
    })

    for (const account of accounts) {
      const executionBlocker = googleAdsAccountExecutionBlocker(
        account.testAccount,
        account.status,
      )
      const hasApiAccess = executionBlocker === null
      await db.adAccount.upsert({
        where: {
          workspaceId_platform_platformAccountId: {
            workspaceId: workspace.id,
            platform: 'GOOGLE',
            platformAccountId: account.customerId,
          },
        },
        create: {
          workspaceId: workspace.id,
          platform: 'GOOGLE',
          status: 'ACTIVE',
          platformAccountId: account.customerId,
          platformAccountName: account.descriptiveName,
          businessId: account.loginCustomerId,
          businessName: account.managerName,
          loginCustomerId: account.loginCustomerId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: expiresAt,
          currency: account.currencyCode,
          timeZone: account.timeZone,
          permissionScopes: scopes,
          hasApiAccess,
          isVerified: false,
          lastSyncAt: now,
          lastError: executionBlocker,
          lastErrorAt: hasApiAccess ? null : now,
        },
        update: {
          status: 'ACTIVE',
          platformAccountName: account.descriptiveName,
          businessId: account.loginCustomerId,
          businessName: account.managerName,
          loginCustomerId: account.loginCustomerId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: expiresAt,
          currency: account.currencyCode,
          timeZone: account.timeZone,
          permissionScopes: scopes,
          hasApiAccess,
          lastSyncAt: now,
          lastError: executionBlocker,
          lastErrorAt: hasApiAccess ? null : now,
        },
      })
    }

    return redirect(baseUrl, `/connections?social=connected&platform=google_ads&accounts=${accounts.length}`)
  } catch (error) {
    await captureOperationalError(error, {
      operation: 'oauth.google-ads-callback',
      route: '/api/social/callback/google-ads',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: error instanceof GoogleAdsOAuthError ? error.status : 500,
      retryable: error instanceof GoogleAdsOAuthError ? error.status >= 500 : true,
      severity: error instanceof GoogleAdsOAuthError && error.status < 500 ? 'warning' : 'error',
    })
    return errorRedirect(
      baseUrl,
      error instanceof GoogleAdsOAuthError ? error.code : 'google_ads_connection_failed',
    )
  }
}
