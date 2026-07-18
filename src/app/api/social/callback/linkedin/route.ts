/**
 * GET /api/social/callback/linkedin
 * LinkedIn OAuth 2.0 callback — exchanges code for token,
 * fetches profile via OIDC userinfo endpoint, saves Integration.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'
import { verifyOAuthState } from '@/lib/oauthState'
import {
  LINKEDIN_API_VERSION,
  linkedInHeaders,
} from '@/lib/socialPlatformConfig'
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

  // User denied access or LinkedIn-side error
  if (errorParam) {
    console.warn('[LinkedIn OAuth] Provider authorization was not granted')
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=authorization_not_granted`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=missing_params`)
  }

  let userId: string
  try {
    userId = verifyOAuthState(state, 'linkedin').userId
  } catch {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=invalid_state`)
  }

  const clientId     = process.env.LINKEDIN_CLIENT_ID!
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!
  const redirectUri  = `${baseUrl}/api/social/callback/linkedin`

  // ── Exchange code for access token ────────────────────────────────────────
  let tokenData: any
  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    })
    tokenData = await tokenRes.json()
  } catch (fetchErr) {
    await captureOperationalError(fetchErr, {
      operation: 'oauth.linkedin-token-exchange',
      route: '/api/social/callback/linkedin',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 502,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=network_error`)
  }

  if (!tokenData.access_token) {
    await captureOperationalError(
      Object.assign(new Error('LinkedIn token exchange rejected'), { code: tokenData.error_code || tokenData.error }),
      {
        operation: 'oauth.linkedin-token-exchange',
        route: '/api/social/callback/linkedin',
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

  const accessToken = tokenData.access_token as string
  // LinkedIn tokens last 60 days by default
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null

  // ── Fetch member profile via OIDC userinfo ────────────────────────────────
  let profile: any = {}
  try {
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    profile = await profileRes.json()
  } catch (fetchErr) {
    await captureOperationalError(fetchErr, {
      operation: 'oauth.linkedin-profile-fetch',
      route: '/api/social/callback/linkedin',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 502,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=profile_fetch_failed`)
  }

  if (!profile.sub) {
    await captureOperationalError(new Error('LinkedIn profile response was incomplete'), {
      operation: 'oauth.linkedin-profile-invalid',
      route: '/api/social/callback/linkedin',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 502,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=profile_fetch_failed`)
  }

  const personId   = profile.sub as string          // LinkedIn member URN id
  const name       = profile.name || profile.given_name || 'LinkedIn User'
  // LinkedIn may omit email from OIDC userinfo. Reuse the verified Supabase
  // email (or an existing Prisma email) instead of inventing a placeholder
  // address that can collide with the real account.
  let authEmail: string | undefined
  try {
    const { data: supaUser } = await adminClient.auth.admin.getUserById(userId)
    authEmail = supaUser?.user?.email || undefined
  } catch { /* the existing Prisma row is still a safe fallback */ }
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  }).catch(() => null)
  const email = profile.email || authEmail || existingUser?.email || `user-${userId.slice(0, 8)}@nexus.internal`
  const pictureUrl = profile.picture || null

  // Company Page identities are separate from the member identity. This call
  // succeeds for approved Community Management scopes and degrades to an empty
  // list during pre-approval development without breaking member publishing.
  const organizations: Array<{ id: string; name: string; urn: string }> = []
  try {
    const aclUrl = new URL('https://api.linkedin.com/rest/organizationAcls')
    aclUrl.searchParams.set('q', 'roleAssignee')
    aclUrl.searchParams.set('role', 'ADMINISTRATOR')
    aclUrl.searchParams.set('state', 'APPROVED')
    aclUrl.searchParams.set('count', '25')
    const aclRes = await fetch(aclUrl, { headers: linkedInHeaders(accessToken), cache: 'no-store' })
    if (aclRes.ok) {
      const aclData = await aclRes.json()
      const urns = Array.from(new Set<string>(
        (Array.isArray(aclData?.elements) ? aclData.elements : [])
          .map((entry: any) => entry?.organizationTarget || entry?.organization)
          .filter((value: unknown): value is string => typeof value === 'string' && value.includes('urn:li:organization:')),
      )).slice(0, 25)
      const details = await Promise.all(urns.map(async (urn) => {
        const id = urn.split(':').pop() || ''
        if (!id) return null
        try {
          const organizationRes = await fetch(
            `https://api.linkedin.com/rest/organizations/${encodeURIComponent(id)}`,
            { headers: linkedInHeaders(accessToken), cache: 'no-store' },
          )
          const organization = organizationRes.ok ? await organizationRes.json() : null
          const localizedName = organization?.localizedName
            || Object.values(organization?.name?.localized || {})[0]
            || `LinkedIn Page ${id}`
          return { id, urn, name: String(localizedName) }
        } catch {
          return { id, urn, name: `LinkedIn Page ${id}` }
        }
      }))
      organizations.push(...details.filter((item): item is { id: string; name: string; urn: string } => Boolean(item)))
    }
  } catch (organizationError) {
    console.warn('[LinkedIn OAuth] Organization discovery unavailable:', organizationError)
  }

  const grantedScopes = typeof tokenData.scope === 'string' && tokenData.scope.trim()
    ? tokenData.scope.split(/[ ,]+/).filter(Boolean)
    : []
  const scopeEvidence = typeof tokenData.scope === 'string' && tokenData.scope.trim()
    ? 'provider_response'
    : 'unavailable'
  const defaultOrganizationId = organizations.length === 1 ? organizations[0].id : null

  console.log('[LinkedIn OAuth] Verified member profile')

  // ── Ensure User + Workspace exist ────────────────────────────────────────
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, name },
    update: { name, ...(profile.email || authEmail ? { email } : {}) },
  }).catch(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email, name },
      update: {},
    }).catch(() => {})
  })

  let workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
  if (!workspace) {
    const slug = `workspace-${userId.slice(0, 8)}`
    const existing = await prisma.workspace.findUnique({ where: { slug } })
    workspace = await prisma.workspace.create({
      data: {
        name: `${name}'s Workspace`,
        slug: existing ? `workspace-${userId.slice(0, 12)}-${Date.now()}` : slug,
        ownerId: userId,
      },
    })
  }

  // ── Upsert Integration ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LI_TYPE = 'LINKEDIN' as any
  try {
    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: LI_TYPE } },
      create: {
        workspaceId: workspace.id,
        type: LI_TYPE,
        status: 'CONNECTED',
        accessToken: encryptToken(accessToken),
        accountId: personId,
        accountName: name,
        config: {
          personId,
          pictureUrl,
          email,
          scopes: grantedScopes,
          scopeEvidence,
          apiVersion: LINKEDIN_API_VERSION,
          organizations,
          organizationId: defaultOrganizationId,
          expiresAt: expiresAt?.toISOString() || null,
          connectedAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date(),
      },
      update: {
        status: 'CONNECTED',
        accessToken: encryptToken(accessToken),
        accountId: personId,
        accountName: name,
        config: {
          personId,
          pictureUrl,
          email,
          scopes: grantedScopes,
          scopeEvidence,
          apiVersion: LINKEDIN_API_VERSION,
          organizations,
          organizationId: defaultOrganizationId,
          expiresAt: expiresAt?.toISOString() || null,
          connectedAt: new Date().toISOString(),
        } as any,
        lastSyncedAt: new Date(),
      },
    })
    console.log('[LinkedIn OAuth] Integration saved!')
  } catch (dbErr) {
    await captureOperationalError(dbErr, {
      operation: 'oauth.linkedin-save-connection',
      route: '/api/social/callback/linkedin',
      component: 'database',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=db_error`)
  }

  return NextResponse.redirect(`${baseUrl}/connections?social=connected&platform=linkedin`)
  } catch (err: unknown) {
    await captureOperationalError(err, {
      operation: 'oauth.linkedin-callback',
      route: '/api/social/callback/linkedin',
      component: 'oauth',
      method: 'GET',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=unexpected_error`)
  }
}
