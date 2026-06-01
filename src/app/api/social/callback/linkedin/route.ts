/**
 * GET /api/social/callback/linkedin
 * LinkedIn OAuth 2.0 callback — exchanges code for token,
 * fetches profile via OIDC userinfo endpoint, saves Integration.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // User denied access
  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/connections?social=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=missing_params`)
  }

  // Decode + validate state
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.userId
    if (Date.now() - decoded.ts > 60 * 60 * 1000) throw new Error('stale')
  } catch {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=invalid_state`)
  }

  const clientId     = process.env.LINKEDIN_CLIENT_ID!
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!
  const redirectUri  = `${baseUrl}/api/social/callback/linkedin`

  // ── Exchange code for access token ────────────────────────────────────────
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
  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    console.error('[LinkedIn OAuth] Token exchange failed:', tokenData)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=token_exchange`)
  }

  const accessToken = tokenData.access_token as string
  // LinkedIn tokens last 60 days by default
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null

  // ── Fetch member profile via OIDC userinfo ────────────────────────────────
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const profile = await profileRes.json()

  if (!profile.sub) {
    console.error('[LinkedIn OAuth] Profile fetch failed:', profile)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=profile_fetch`)
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
}
