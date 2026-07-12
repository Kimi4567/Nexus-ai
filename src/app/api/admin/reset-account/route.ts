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
 *  - aiCredits: 0 (the normal 10-credit trial is granted atomically on first use)
 *  - monthlyGenerations: 0
 *  - stripeCustomerId: null
 *  - referralCode: kept (non-sensitive)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

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

  try {
    const summary = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `account-reset:${userId}`)
      const memberships = await tx.workspaceMember.deleteMany({ where: { userId } })
      await tx.uploadSession.deleteMany({ where: { userId } })
      const workspaces = await tx.workspace.deleteMany({ where: { ownerId: userId } })
      const subscriptions = await tx.subscription.deleteMany({ where: { userId } })
      const usage = await tx.usage.deleteMany({ where: { userId } })
      // Delete debit transactions first; allocation rows cascade. Then remove
      // all grant buckets so purchased/referral balances cannot reappear.
      const creditTransactions = await tx.creditTransaction.deleteMany({ where: { userId } })
      const creditGrants = await tx.creditGrant.deleteMany({ where: { userId } })
      const rateLimits = await tx.rateLimitRecord.deleteMany({
        where: {
          OR: [
            { key: { startsWith: `ai:${userId}` } },
            { key: { startsWith: `chat:${userId}` } },
            { key: { startsWith: `checkout:${userId}` } },
            { key: { startsWith: `upload-session:${userId}` } },
          ],
        },
      })
      await tx.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'FREE',
          aiCredits: 0,
          monthlyGenerations: 0,
          stripeCustomerId: null,
          lastLoginAt: null,
          preferences: {},
        },
      })
      return {
        workspaces: workspaces.count,
        memberships: memberships.count,
        subscriptions: subscriptions.count,
        usage: usage.count,
        creditTransactions: creditTransactions.count,
        creditGrants: creditGrants.count,
        rateLimits: rateLimits.count,
      }
    })

    const log = [
      `Deleted ${summary.workspaces} workspace(s) and cascaded workspace data`,
      `Removed ${summary.memberships} membership(s) from other workspaces and cleared pending uploads`,
      `Deleted ${summary.subscriptions} subscription row(s) and ${summary.usage} usage row(s)`,
      `Deleted ${summary.creditTransactions} credit transaction(s) and ${summary.creditGrants} grant bucket(s)`,
      `Deleted ${summary.rateLimits} rate-limit record(s)`,
      'Reset user to FREE / 0 cached credits; the standard 10-credit trial is created on first use',
    ]

    return NextResponse.json({
      ok:     true,
      userId,
      email:  target.email,
      log,
      message: 'Account reset complete. User can log in with the same credentials and start fresh.',
    })

  } catch (err: any) {
    console.error('[admin/reset-account]', err)
    return NextResponse.json({ error: 'Account reset failed' }, { status: 500 })
  }
}
