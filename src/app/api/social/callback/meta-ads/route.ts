/**
 * GET /api/social/callback/meta-ads
 *
 * Handles the OAuth callback for Meta Ads connection.
 *
 * On success:
 *   1. Exchange auth code for short-lived token
 *   2. Exchange for long-lived token (60 days)
 *   3. Fetch all ad accounts accessible to the user via /me/adaccounts
 *   4. Upsert each ad account into the AdAccount table
 *   5. Redirect to /paid-campaigns?connected=meta
 *
 * Data model:
 *   - AdAccount.platform = META
 *   - AdAccount.platformAccountId = "act_XXXXXXXXX" (Meta's format)
 *   - AdAccount.accessToken = encrypted long-lived user token
 *   - AdAccount.currency = account billing currency
 *   - AdAccount.timeZone = account timezone
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import { META_ADS_SCOPES, META_GRAPH_VERSION, metaGraphUrl } from '@/lib/socialPlatformConfig'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MetaAdAccount = {
  id: string
  name: string
  account_status: number  // 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_RISK_REVIEW
  currency: string
  timezone_name: string
  owner?: string
  business?: { id: string; name: string }
}

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (errorParam) {
    const desc = errorDescription
      ? encodeURIComponent(errorDescription.slice(0, 120))
      : errorParam
    console.error('[Meta Ads OAuth] Error from Meta:', errorParam, errorDescription)
    return NextResponse.redirect(`${baseUrl}/paid-campaigns?error=${desc}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/paid-campaigns?error=missing_params`)
  }

  let userId: string
  try {
    userId = verifyOAuthState(state, 'meta_ads').userId
  } catch (e) {
    console.error('[Meta Ads OAuth] State verification failed:', e)
    return NextResponse.redirect(`${baseUrl}/paid-campaigns?error=invalid_state`)
  }

  const appId = process.env.META_APP_ID!
  const appSecret = process.env.META_APP_SECRET!
  const redirectUri = `${baseUrl}/api/social/callback/meta-ads`

  // Step 1: Exchange code for short-lived token
  let shortToken: string
  try {
    const tokenRes = await fetch(
      `${metaGraphUrl('oauth/access_token')}` +
      `?client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`
    )
    const tokenData = await tokenRes.json()
    if (tokenData.error || !tokenData.access_token) {
      const msg = tokenData.error?.message || 'token_exchange_failed'
      // Keep OAuth credentials out of logs even when a provider returns a
      // mixed success/error payload.
      console.error('[Meta Ads OAuth] Token exchange failed:', {
        error: tokenData.error?.message || tokenData.error || 'unknown',
        code: tokenData.error?.code || null,
      })
      return NextResponse.redirect(
        `${baseUrl}/paid-campaigns?error=${encodeURIComponent(msg.slice(0, 120))}`
      )
    }
    shortToken = tokenData.access_token
  } catch (fetchErr) {
    console.error('[Meta Ads OAuth] Token fetch network error:', fetchErr)
    return NextResponse.redirect(`${baseUrl}/paid-campaigns?error=network_error`)
  }

  // Step 2: Exchange for long-lived token (60 days)
  let longToken = shortToken
  try {
    const longTokenRes = await fetch(
      `${metaGraphUrl('oauth/access_token')}` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${shortToken}`
    )
    const longTokenData = await longTokenRes.json()
    if (longTokenData.access_token) longToken = longTokenData.access_token
  } catch {
    console.warn('[Meta Ads OAuth] Long-lived token exchange failed — using short-lived token')
  }

  // Step 3: Fetch user identity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let me: any = {}
  try {
    const meRes = await fetch(
      `${metaGraphUrl('me')}?fields=id,name&access_token=${encodeURIComponent(longToken)}`
    )
    me = await meRes.json()
  } catch { /* non-fatal */ }

  // Step 4: Fetch all accessible ad accounts
  // Meta returns all accounts the user has any role on (advertiser, admin, etc.)
  // Fields: id, name, account_status, currency, timezone_name, owner, business
  let adAccounts: MetaAdAccount[] = []
  try {
    const accountsRes = await fetch(
      `${metaGraphUrl('me/adaccounts')}` +
      `?fields=id,name,account_status,currency,timezone_name,owner,business` +
      `&access_token=${longToken}`
    )
    const accountsData = await accountsRes.json()
    adAccounts = accountsData.data || []
    console.log(`[Meta Ads OAuth] Found ${adAccounts.length} ad accounts for user ${userId}`)
  } catch (fetchErr) {
    console.error('[Meta Ads OAuth] Ad accounts fetch failed:', fetchErr)
    // Non-fatal: save the connection anyway with no accounts yet
  }

  // Step 4b: Fetch Facebook Pages managed by this user
  // Page ID is required for creating ad creatives
  let pages: Array<{ id: string; name: string; access_token?: string }> = []
  try {
    const pagesRes = await fetch(
      `${metaGraphUrl('me/accounts')}` +
      `?fields=id,name,access_token,category` +
      `&access_token=${longToken}`
    )
    const pagesData = await pagesRes.json()
    pages = pagesData.data || []
    console.log(`[Meta Ads OAuth] Found ${pages.length} Facebook Pages for user ${userId}`)
  } catch { /* non-fatal */ }

  // Step 5: Ensure Prisma user + workspace exist
  let realEmail: string | undefined
  try {
    const { data: supaUser } = await adminClient.auth.admin.getUserById(userId)
    realEmail = supaUser?.user?.email
  } catch { /* non-fatal */ }

  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: realEmail || `user-${userId.slice(0, 8)}@nexus.internal`,
      name: me.name || 'User',
    },
    update: {
      name: me.name || undefined,
      ...(realEmail ? { email: realEmail } : {}),
    },
  }).catch(() => {})

  let workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
  if (!workspace) {
    const slug = `workspace-${userId.slice(0, 8)}-${Date.now()}`
    workspace = await prisma.workspace.create({
      data: {
        name: me.name ? `${me.name}'s Workspace` : 'My Workspace',
        slug,
        ownerId: userId,
      },
    })
  }

  // Step 6: Upsert each ad account into AdAccount table
  // Meta account IDs come as "act_XXXXXXXXX" — strip prefix for platformAccountId
  const encryptedToken = encryptToken(longToken)
  const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days

  // Use the first active page as the default page for ad creatives
  const primaryPage = pages.find(p => p.id) || null

  let savedCount = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any
  for (const account of adAccounts) {
    try {
      // account_status: 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_RISK_REVIEW
      const isActive = account.account_status === 1

      await db.adAccount.upsert({
        where: {
          workspaceId_platform_platformAccountId: {
            workspaceId: workspace.id,
            platform: 'META',
            platformAccountId: account.id, // keeps "act_XXXXX" format
          },
        },
        create: {
          workspaceId: workspace.id,
          platform: 'META',
          platformAccountId: account.id,
          platformAccountName: account.name,
          businessId: account.business?.id || null,
          businessName: account.business?.name || null,
          accessToken: encryptedToken,
          tokenExpiresAt: tokenExpiry,
          currency: account.currency || 'USD',
          timeZone: account.timezone_name || 'UTC',
          status: isActive ? 'ACTIVE' : 'DISCONNECTED',
          hasApiAccess: false, // set to true once Meta App Review is approved
          permissionScopes: [...META_ADS_SCOPES],
          // Save primary page ID for ad creative creation
          pageId: primaryPage?.id || null,
          pageName: primaryPage?.name || null,
        },
        update: {
          platformAccountName: account.name,
          businessId: account.business?.id || null,
          businessName: account.business?.name || null,
          accessToken: encryptedToken,
          tokenExpiresAt: tokenExpiry,
          currency: account.currency || 'USD',
          timeZone: account.timezone_name || 'UTC',
          status: isActive ? 'ACTIVE' : 'DISCONNECTED',
          lastSyncAt: new Date(),
          permissionScopes: [...META_ADS_SCOPES],
          hasApiAccess: false,
          // Update page ID if not yet set
          ...(primaryPage?.id ? { pageId: primaryPage.id, pageName: primaryPage.name } : {}),
        },
      })
      savedCount++
    } catch (dbErr) {
      console.error('[Meta Ads OAuth] Failed to save ad account:', account.id, dbErr)
    }
  }

  console.log(`[Meta Ads OAuth] Saved ${savedCount}/${adAccounts.length} ad accounts for workspace ${workspace.id}`)

  // Redirect to paid campaigns section with success signal
  const accountCount = adAccounts.length
  return NextResponse.redirect(
    `${baseUrl}/paid-campaigns?connected=meta&accounts=${accountCount}`
  )
  } catch (err: any) {
    console.error('[Meta Ads OAuth] Unexpected error:', err?.message)
    return NextResponse.redirect(`${baseUrl}/paid-campaigns?social=error&msg=unexpected_error`)
  }
}
