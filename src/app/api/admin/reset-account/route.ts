/**
 * POST /api/admin/reset-account
 * Admin-only. Wipes all data for a given userId and resets them to a clean
 * FREE account — keeping the User row and Supabase auth intact.
 *
 * Body: { userId: string, confirm: "RESET" }
 *
 * What gets deleted:
 *  - Workspaces + everything that cascades (campaigns, brand profile, social posts,
 *    media, integrations, agent runs, agent suggestions, agent reports, visuals,
 *    upload sessions, calendar events, paid campaign packs, etc.)
 *  - Subscription row
 *  - Usage rows
 *  - RateLimitEntry rows for this user
 *
 * What's preserved:
 *  - User row (email, name, id)
 *  - Supabase auth (not touched — we don't have service-role access here)
 *
 * After reset the user is restored to:
 *  - subscriptionStatus: FREE
 *  - aiCredits: 30 (free starter)
 *  - monthlyGenerations: 0
 *  - stripeCustomerId: null
 *  - referralCode: kept (non-sensitive)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const FREE_STARTER_CREDITS = 30

export async function POST(req: NextRequest) {
  // ── Admin guard ────────────────────────────────────────────────────────────
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  })
  if (caller?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  // ── Validate body ──────────────────────────────────────────────────────────
  let body: { userId?: string; confirm?: string }
  try { body = await req.json() } catch { body = {} }

  const { userId, confirm } = body

  if (!userId)             return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (confirm !== 'RESET') return NextResponse.json({ error: 'confirm must be "RESET"' }, { status: 400 })

  // ── Verify target user exists ──────────────────────────────────────────────
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const log: string[] = []

  try {
    // 1. Delete all workspaces — cascades everything beneath them
    //    (campaigns, brand profiles, social posts, media, integrations,
    //     agent runs, suggestions, reports, visuals, uploads, etc.)
    const wsResult = await prisma.workspace.deleteMany({ where: { ownerId: userId } })
    log.push(`Deleted ${wsResult.count} workspace(s) + all cascaded data`)

    // 2. Delete Subscription row
    const subResult = await prisma.subscription.deleteMany({ where: { userId } })
    log.push(`Deleted ${subResult.count} subscription row(s)`)

    // 3. Delete Usage rows
    const usageResult = await (prisma as any).usage.deleteMany({ where: { userId } }).catch(() => ({ count: 0 }))
    log.push(`Deleted ${usageResult.count} usage row(s)`)

    // 4. Delete RateLimitEntry rows for this user
    const rlResult = await (prisma as any).rateLimitEntry.deleteMany({
      where: { key: { startsWith: `ai:${userId}` } },
    }).catch(() => ({ count: 0 }))
    const rlChat = await (prisma as any).rateLimitEntry.deleteMany({
      where: { key: { startsWith: `chat:${userId}` } },
    }).catch(() => ({ count: 0 }))
    const rlCheckout = await (prisma as any).rateLimitEntry.deleteMany({
      where: { key: { startsWith: `checkout:${userId}` } },
    }).catch(() => ({ count: 0 }))
    log.push(`Deleted ${rlResult.count + rlChat.count + rlCheckout.count} rate-limit entry/entries`)

    // 5. Reset User to clean FREE state
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'FREE',
        aiCredits:          FREE_STARTER_CREDITS,
        monthlyGenerations: 0,
        stripeCustomerId:   null,
        lastLoginAt:        null,
        preferences:        {},
      },
    })
    log.push(`Reset user to FREE / ${FREE_STARTER_CREDITS} credits`)

    return NextResponse.json({
      ok:     true,
      userId,
      email:  target.email,
      log,
      message: 'Account reset complete. User can log in with the same credentials and start fresh.',
    })

  } catch (err: any) {
    console.error('[admin/reset-account]', err)
    return NextResponse.json({ error: err.message, log }, { status: 500 })
  }
}
