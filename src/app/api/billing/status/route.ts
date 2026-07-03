/**
 * GET /api/billing/status
 * Returns the current user's subscription plan, credits, and period end.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { isBillingConfigured, PLAN_CREDITS } from '@/lib/stripe'
import { resolveBillingStatusPlan } from '@/lib/billingStatusPlan'
import { FREE_STARTER_CREDITS } from '@/lib/credits'

export const dynamic = 'force-dynamic'

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
        monthlyGenerations: true,
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
    // Stripe Subscription is preferred, but the admin console can mark internal
    // QA/customer accounts ACTIVE without a Stripe row. Keep billing truth
    // aligned with the rest of the app so paid quotas do not render as FREE.
    const planStatus = resolveBillingStatusPlan({
      subscriptionPlan: subscription?.plan,
      subscriptionStatus: subscription?.status,
      userSubscriptionStatus: dbUser.subscriptionStatus,
    })
    const planName = planStatus.plan
    const isActive = planStatus.hasActiveSubscription

    const maxCredits = PLAN_CREDITS[planName] ?? 10  // 10 = FREE_STARTER_CREDITS default
    const storedCredits = dbUser.aiCredits ?? 0
    const isFreeStarterEligible =
      !isActive &&
      String(dbUser.subscriptionStatus ?? '').toUpperCase() === 'FREE' &&
      storedCredits === 0 &&
      (dbUser.monthlyGenerations ?? 0) === 0
    const displayCredits =
      storedCredits > 0
        ? storedCredits
        : isFreeStarterEligible
          ? FREE_STARTER_CREDITS
          : 0
    const usedCredits = maxCredits === -1 ? 0 : Math.max(0, maxCredits - displayCredits)

    return NextResponse.json({
      plan: planName,
      status: dbUser.subscriptionStatus,
      hasActiveSubscription: isActive,
      billingEnabled: isBillingConfigured(),
      credits: {
        remaining: displayCredits,
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
