import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  // Handle user denial
  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/settings?social=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/settings?social=error&msg=missing_params`)
  }

  // Decode state to get userId
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.userId
    // Reject stale states (> 10 min)
    if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error('stale')
  } catch {
    return NextResponse.redirect(`${baseUrl}/settings?social=error&msg=invalid_state`)
  }

  const appId = process.env.META_APP_ID!
  const appSecret = process.env.META_APP_SECRET!
  const redirectUri = `${baseUrl}/api/social/callback/meta`

  // Exchange code for access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token` +
    `?client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code=${code}`
  )
  const tokenData = await tokenRes.json()

  if (tokenData.error || !tokenData.access_token) {
    console.error('[Meta OAuth] Token exchange failed:', tokenData)
    return NextResponse.redirect(`${baseUrl}/settings?social=error&msg=token_exchange`)
  }

  const shortToken = tokenData.access_token

  // Exchange for long-lived token (60 days)
  const longTokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&fb_exchange_token=${shortToken}`
  )
  const longTokenData = await longTokenRes.json()
  const longToken = longTokenData.access_token || shortToken

  // Fetch user profile + pages
  const [meRes, pagesRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${longToken}`),
    fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longToken}`),
  ])

  const me = await meRes.json()
  const pagesData = await pagesRes.json()

  const pages = (pagesData.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    igAccountId: p.instagram_business_account?.id || null,
  }))

  // Find the user's workspace
  const workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
  if (!workspace) {
    return NextResponse.redirect(`${baseUrl}/settings?social=error&msg=no_workspace`)
  }

  // Upsert integration
  await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId: workspace.id, type: 'META' } },
    create: {
      workspaceId: workspace.id,
      type: 'META',
      status: 'CONNECTED',
      accessToken: longToken,
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
      accessToken: longToken,
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

  return NextResponse.redirect(`${baseUrl}/settings?social=connected&platform=meta`)
}
