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
    const desc = searchParams.get('error_description') || errorParam
    console.error('[LinkedIn OAuth] Error from LinkedIn:', errorParam, desc)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=${encodeURIComponent(desc.slice(0, 120))}`)
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
    console.error('[LinkedIn OAuth] Token fetch network error:', fetchErr)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=network_error`)
  }

  if (!tokenData.access_token) {
    const errMsg = tokenData.error_description || tokenData.error || 'token_exchange'
    console.error('[LinkedIn OAuth] Token exchange failed:', tokenData)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=${encodeURIComponent(errMsg.slice(0, 120))}`)
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
    console.error('[LinkedIn OAuth] Profile fetch network error:', fetchErr)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=profile_fetch_failed`)
  }

  if (!profile.sub) {
    const errMsg = profile.message || profile.error || 'profile_fetch'
    console.error('[LinkedIn OAuth] Profile fetch failed:', profile)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=${encodeURIComponent(errMsg.slice(0, 120))}`)
  }

  const personId   = profile.sub as string          // LinkedIn member URN id
  const name       = profile.name || profile.given_name || 'LinkedIn User'
  const email      = profile.email || `${userId}@placeholder.nexus`
  const pictureUrl = profile.picture || null

  console.log('[LinkedIn OAuth] userId:', userId, '| personId:', personId, '| name:', name)

  // ── Ensure User + Workspace exist ────────────────────────────────────────
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, name },
    update: { name },
  }).catch(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: `user-${userId.slice(0,8)}@nexus.internal`, name },
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
          expiresAt: expiresAt?.toISOString() || null,
          connectedAt: new Date().toISOString(),
        } as any,
        lastSyncedAt: new Date(),
      },
    })
    console.log('[LinkedIn OAuth] Integration saved!')
  } catch (dbErr) {
    console.error('[LinkedIn OAuth] DB upsert failed:', dbErr)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=db_error`)
  }

  return NextResponse.redirect(`${baseUrl}/connections?social=connected&platform=linkedin`)
  } catch (err: any) {
    console.error('[LinkedIn OAuth] Unexpected error:', err?.message)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=unexpected_error`)
  }
}
