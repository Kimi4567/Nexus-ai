import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import { META_GRAPH_VERSION, metaGraphUrl } from '@/lib/socialPlatformConfig'
import { captureOperationalError } from '@/lib/observability/operationalError'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')
  // Handle user denial or Meta-side error
  if (errorParam) {
    console.warn('[Meta OAuth] Provider authorization was not granted')
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=authorization_not_granted`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=missing_params`)
  }

  let userId: string
  try {
    userId = verifyOAuthState(state, 'meta').userId
  } catch (e) {
    console.warn('[Meta OAuth] State verification failed')
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=invalid_state`)
  }

  const appId = process.env.META_APP_ID!
  const appSecret = process.env.META_APP_SECRET!
  const redirectUri = `${baseUrl}/api/social/callback/meta`

  // Exchange code for access token
  let tokenData: any
  try {
    const tokenRes = await fetch(
      `${metaGraphUrl('oauth/access_token')}` +
      `?client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`
    )
    tokenData = await tokenRes.json()
  } catch (fetchErr) {
    await captureOperationalError(fetchErr, {
      operation: 'oauth.meta-token-exchange',
      route: '/api/social/callback/meta',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 502,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=network_error`)
  }

  if (tokenData.error || !tokenData.access_token) {
    await captureOperationalError(
      Object.assign(new Error('Meta token exchange rejected'), { code: tokenData.error?.code || tokenData.error?.type }),
      {
        operation: 'oauth.meta-token-exchange',
        route: '/api/social/callback/meta',
        component: 'oauth',
        method: 'GET',
        requestId: req.headers?.get?.('x-vercel-id') ?? null,
        statusCode: 400,
        retryable: false,
        severity: 'warning',
      },
    )
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=token_exchange_failed`)
  }

  const shortToken = tokenData.access_token

  // Exchange for long-lived token (60 days)
  let longToken = shortToken
  let tokenExpiresAt: Date | null = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
    : null
  try {
    const longTokenRes = await fetch(
      `${metaGraphUrl('oauth/access_token')}` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${shortToken}`
    )
    const longTokenData = await longTokenRes.json()
    longToken = longTokenData.access_token || shortToken
    if (longTokenData.expires_in) {
      tokenExpiresAt = new Date(Date.now() + Number(longTokenData.expires_in) * 1000)
    }
  } catch {
    console.warn('[Meta OAuth] Long-lived token exchange failed — using short-lived token')
  }

  // Fetch user profile + pages
  let me: any = {}
  let pagesData: any = { data: [] }
  let grantedScopes: string[] = []
  try {
    const [meRes, pagesRes, permissionsRes] = await Promise.all([
      fetch(`${metaGraphUrl('me')}?fields=id,name,picture&access_token=${encodeURIComponent(longToken)}`),
      fetch(`${metaGraphUrl('me/accounts')}?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(longToken)}`),
      fetch(`${metaGraphUrl('me/permissions')}?access_token=${encodeURIComponent(longToken)}`),
    ])
    me = await meRes.json()
    pagesData = await pagesRes.json()
    const permissionsData = permissionsRes.ok ? await permissionsRes.json() : { data: [] }
    grantedScopes = (Array.isArray(permissionsData?.data) ? permissionsData.data : [])
      .filter((entry: any) => entry?.status === 'granted' && typeof entry?.permission === 'string')
      .map((entry: any) => entry.permission)
  } catch (fetchErr) {
    await captureOperationalError(fetchErr, {
      operation: 'oauth.meta-profile-fetch',
      route: '/api/social/callback/meta',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 502,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=profile_fetch_failed`)
  }

  const pages = (pagesData.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    accessToken: encryptToken(p.access_token),    // Encrypted at rest
    igAccountId: p.instagram_business_account?.id || null,
  }))

  console.log(`[Meta OAuth] Verified profile with ${pages.length} page connection candidates`)

  // FLOW-01 fix: get real email from Supabase Auth — Meta /me doesn't return email
  // by default. Never store a placeholder email that conflicts with the real account.
  let realEmail: string | undefined
  try {
    const { data: supaUser } = await adminClient.auth.admin.getUserById(userId)
    realEmail = supaUser?.user?.email
  } catch { /* non-fatal */ }

  // Ensure User record exists in Prisma (Supabase Auth doesn't auto-create these)
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: realEmail || `user-${userId.slice(0,8)}@nexus.internal`,
      name: me.name || 'User',
    },
    update: {
      // Only update name — never overwrite email with Meta data
      name: me.name || undefined,
      ...(realEmail ? { email: realEmail } : {}),
    },
  }).catch(() => {}) // user row may already exist — that's fine

  // Find or create the user's workspace
  let workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
  if (!workspace) {
    console.log('[Meta OAuth] No workspace found; creating one')
    let slug = `workspace-${userId.slice(0, 8)}`
    // ensure slug uniqueness
    const existing = await prisma.workspace.findUnique({ where: { slug } })
    if (existing) slug = `workspace-${userId.slice(0, 12)}-${Date.now()}`
    workspace = await prisma.workspace.create({
      data: { name: me.name ? `${me.name}'s Workspace` : 'My Workspace', slug, ownerId: userId },
    })
    console.log('[Meta OAuth] Workspace created')
  }

  console.log('[Meta OAuth] Workspace ready')

  // Upsert integration
  try {
    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: 'META' } },
      create: {
        workspaceId: workspace.id,
        type: 'META',
        status: 'CONNECTED',
        accessToken: encryptToken(longToken),
        accountId: me.id,
        accountName: me.name,
        config: {
          pages,
          pictureUrl: me.picture?.data?.url || null,
          scopes: grantedScopes,
          scopeEvidence: 'provider_response',
          graphVersion: META_GRAPH_VERSION,
          expiresAt: tokenExpiresAt?.toISOString() || null,
          connectedAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date(),
      },
      update: {
        status: 'CONNECTED',
        accessToken: encryptToken(longToken),
        accountId: me.id,
        accountName: me.name,
        config: {
          pages,
          pictureUrl: me.picture?.data?.url || null,
          scopes: grantedScopes,
          scopeEvidence: 'provider_response',
          graphVersion: META_GRAPH_VERSION,
          expiresAt: tokenExpiresAt?.toISOString() || null,
          connectedAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date(),
      },
    })
    console.log('[Meta OAuth] Integration saved successfully!')
  } catch (dbErr) {
    await captureOperationalError(dbErr, {
      operation: 'oauth.meta-save-connection',
      route: '/api/social/callback/meta',
      component: 'database',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=db_error`)
  }

  return NextResponse.redirect(`${baseUrl}/connections?social=connected&platform=meta`)
  } catch (err: unknown) {
    await captureOperationalError(err, {
      operation: 'oauth.meta-callback',
      route: '/api/social/callback/meta',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=unexpected_error`)
  }
}
