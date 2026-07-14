import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminClient } from '@/lib/supabaseAuth'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import {
  discoverGoogleAdsAccounts,
  exchangeGoogleAdsAuthorizationCode,
  googleAdsAccessTier,
  googleAdsAccountCanExecute,
  GoogleAdsOAuthError,
  GOOGLE_ADS_SCOPE,
} from '@/lib/adPlatforms/googleAdsApi'
import { googleAdsOAuthContextMatches } from '@/lib/googleAdsOAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const OAUTH_COOKIE = 'nexus_google_ads_oauth'

// AdAccount currently predates strict Prisma typing in this route family.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const providerError = searchParams.get('error')
  if (providerError) {
    return errorRedirect(searchParams.get('error_description') || providerError)
  }
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const nonce = req.cookies.get(OAUTH_COOKIE)?.value
  if (!code || !state || !nonce) return errorRedirect('missing_oauth_context')

  let userId: string
  try {
    const payload = verifyOAuthState(state, 'google_ads')
    if (!payload.context || !googleAdsOAuthContextMatches(payload.context, nonce)) {
      return errorRedirect('invalid_oauth_context')
    }
    userId = payload.userId
  } catch {
    return errorRedirect('invalid_state')
  }

  try {
    const redirectUri = `${appUrl()}/api/social/callback/google-ads`
    const token = await exchangeGoogleAdsAuthorizationCode({ code, redirectUri })
    const accounts = await discoverGoogleAdsAccounts(token.accessToken)
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
    for (const account of accounts) {
      const hasApiAccess = googleAdsAccountCanExecute(account.testAccount)
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
          lastError: hasApiAccess
            ? null
            : `Connection verified, but GOOGLE_ADS_ACCESS_TIER=${googleAdsAccessTier()} does not authorize this account for execution.`,
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
          lastError: hasApiAccess
            ? null
            : `Connection verified, but GOOGLE_ADS_ACCESS_TIER=${googleAdsAccessTier()} does not authorize this account for execution.`,
          lastErrorAt: hasApiAccess ? null : now,
        },
      })
    }

    return redirect(`/connections?social=connected&platform=google_ads&accounts=${accounts.length}`)
  } catch (error) {
    if (error instanceof GoogleAdsOAuthError) {
      console.error('[Google Ads OAuth] token_exchange_failed', {
        status: error.status,
        code: error.code,
        description: error.description,
        redirectOrigin: appUrl(),
      })
    } else {
      console.error('[Google Ads OAuth]', error)
    }
    return errorRedirect(error instanceof Error ? error.message : 'google_ads_connection_failed')
  }
}
