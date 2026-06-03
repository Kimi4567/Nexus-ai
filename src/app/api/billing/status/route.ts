/**
 * GET /api/billing/status
 * Returns the current user's subscription plan, credits, and period end.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { PLAN_CREDITS } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  try {
    // ── Authenticate ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Fetch user + subscription ───────────────────────────────────────────
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        subscriptionStatus: true,
        aiCredits: true,
        stripeCustomerId: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
        monthlyCredits: true,
        cancelledAt: true,
      },
    })

    // ── Derive plan name ────────────────────────────────────────────────────
    const planRaw = subscription?.plan?.toString().toLowerCase() ?? 'free'
    const isActive = ['ACTIVE', 'active'].includes(subscription?.status?.toString() ?? '')
    const planName = isActive ? planRaw : 'free'

    const maxCredits = PLAN_CREDITS[planName] ?? 20  // 20 = FREE_STARTER_CREDITS default
    const usedCredits = maxCredits === -1 ? 0 : Math.max(0, maxCredits - (dbUser.aiCredits ?? 0))

    return NextResponse.json({
      plan: planName,
      status: dbUser.subscriptionStatus,
      hasActiveSubscription: isActive,
      credits: {
        remaining: dbUser.aiCredits ?? 0,
        used: usedCredits,
        max: maxCredits,         // -1 = unlimited
      },
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelledAt: subscription?.cancelledAt ?? null,
      stripeCustomerId: dbUser.stripeCustomerId ?? null,
    })
  } catch (err: any) {
    console.error('[Billing Status] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to fetch billing status' }, { status: 500 })
  }
}
