import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/tokenCrypto'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Handle user denial or Meta-side error
  if (errorParam) {
    const desc = errorDescription ? encodeURIComponent(errorDescription.slice(0, 120)) : errorParam
    console.error('[Meta OAuth] Error from Meta:', errorParam, errorDescription)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=${desc}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=missing_params`)
  }

  // Decode state to get userId
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.userId
    console.log('[Meta OAuth] State decoded, userId:', userId, 'age:', Date.now() - decoded.ts, 'ms')
    // Reject stale states (> 60 min)
    if (Date.now() - decoded.ts > 60 * 60 * 1000) throw new Error('stale')
  } catch (e) {
    console.error('[Meta OAuth] State decode failed:', e)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=invalid_state`)
  }

  const appId = process.env.META_APP_ID!
  const appSecret = process.env.META_APP_SECRET!
  const redirectUri = `${baseUrl}/api/social/callback/meta`

  // Exchange code for access token
  let tokenData: any
  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`
    )
    tokenData = await tokenRes.json()
  } catch (fetchErr) {
    console.error('[Meta OAuth] Token fetch network error:', fetchErr)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=network_error`)
  }

  if (tokenData.error || !tokenData.access_token) {
    const errMsg = tokenData.error?.message || tokenData.error?.type || 'token_exchange'
    console.error('[Meta OAuth] Token exchange failed:', tokenData)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=${encodeURIComponent(errMsg.slice(0, 120))}`)
  }

  const shortToken = tokenData.access_token

  // Exchange for long-lived token (60 days)
  let longToken = shortToken
  try {
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${shortToken}`
    )
    const longTokenData = await longTokenRes.json()
    longToken = longTokenData.access_token || shortToken
  } catch {
    console.warn('[Meta OAuth] Long-lived token exchange failed — using short-lived token')
  }

  // Fetch user profile + pages
  let me: any = {}
  let pagesData: any = { data: [] }
  try {
    const [meRes, pagesRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${longToken}`),
      fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longToken}`),
    ])
    me = await meRes.json()
    pagesData = await pagesRes.json()
  } catch (fetchErr) {
    console.error('[Meta OAuth] Profile fetch network error:', fetchErr)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=profile_fetch_failed`)
  }

  const pages = (pagesData.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    accessToken: encryptToken(p.access_token),    // Encrypted at rest
    igAccountId: p.instagram_business_account?.id || null,
  }))

  console.log('[Meta OAuth] me:', me?.id, me?.name, '| pages:', pages.length)

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
    console.log('[Meta OAuth] No workspace found, creating one for userId:', userId)
    let slug = `workspace-${userId.slice(0, 8)}`
    // ensure slug uniqueness
    const existing = await prisma.workspace.findUnique({ where: { slug } })
    if (existing) slug = `workspace-${userId.slice(0, 12)}-${Date.now()}`
    workspace = await prisma.workspace.create({
      data: { name: me.name ? `${me.name}'s Workspace` : 'My Workspace', slug, ownerId: userId },
    })
    console.log('[Meta OAuth] Workspace created:', workspace.id)
  }

  console.log('[Meta OAuth] workspace found:', workspace.id)

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
          connectedAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date(),
      },
    })
    console.log('[Meta OAuth] Integration saved successfully!')
  } catch (dbErr) {
    console.error('[Meta OAuth] DB upsert failed:', dbErr)
    return NextResponse.redirect(`${baseUrl}/connections?social=error&msg=db_error`)
  }

  return NextResponse.redirect(`${baseUrl}/connections?social=connected&platform=meta`)
}
