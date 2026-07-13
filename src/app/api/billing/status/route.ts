/**
 * GET /api/billing/status
 * Returns the current user's subscription plan, credits, and period end.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { isBillingConfigured, isCreditWalletPurchaseConfigured, PLAN_CREDITS } from '@/lib/stripe'
import { resolveBillingStatusPlan } from '@/lib/billingStatusPlan'
import { FREE_STARTER_CREDITS } from '@/lib/credits'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'

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

    const maxCredits = PLAN_CREDITS[planName] ?? FREE_STARTER_CREDITS
    const storedCredits = dbUser.aiCredits ?? 0
    const isFreeStarterEligible =
      !isActive &&
      String(dbUser.subscriptionStatus ?? '').toUpperCase() === 'FREE' &&
      storedCredits === 0 &&
      (dbUser.monthlyGenerations ?? 0) === 0
    let displayCredits =
      storedCredits > 0
        ? storedCredits
        : isFreeStarterEligible
          ? FREE_STARTER_CREDITS
          : 0
    let usedCredits = maxCredits === -1 ? 0 : Math.max(0, maxCredits - displayCredits)

    const walletEnabled = isCreditWalletEnabled()
    let creditBreakdown: null | {
      monthly: number
      purchased: number
      trial: number
      other: number
      nextPurchasedExpiry: Date | null
    } = null

    if (walletEnabled) {
      const now = new Date()
      const grants = await prisma.creditGrant.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          remaining: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { type: true, remaining: true, expiresAt: true },
      })
      creditBreakdown = grants.reduce((summary, grant) => {
        const amount = Math.max(0, grant.remaining)
        if (grant.type === 'MONTHLY') summary.monthly += amount
        else if (grant.type === 'PURCHASED') {
          summary.purchased += amount
          if (grant.expiresAt && (!summary.nextPurchasedExpiry || grant.expiresAt < summary.nextPurchasedExpiry)) {
            summary.nextPurchasedExpiry = grant.expiresAt
          }
        } else if (grant.type === 'TRIAL') summary.trial += amount
        else summary.other += amount
        return summary
      }, { monthly: 0, purchased: 0, trial: 0, other: 0, nextPurchasedExpiry: null as Date | null })

      // The ledger is authoritative when the wallet is enabled. Deriving the
      // response here prevents an expired grant from lingering in the scalar
      // cache and being shown as spendable.
      const ledgerBalance =
        creditBreakdown.monthly +
        creditBreakdown.purchased +
        creditBreakdown.trial +
        creditBreakdown.other
      const pendingStarterCredits = isFreeStarterEligible && ledgerBalance === 0

      displayCredits = pendingStarterCredits ? FREE_STARTER_CREDITS : ledgerBalance
      const renewableRemaining = pendingStarterCredits
        ? FREE_STARTER_CREDITS
        : isActive
          ? creditBreakdown.monthly
          : creditBreakdown.trial
      usedCredits = maxCredits === -1 ? 0 : Math.max(0, maxCredits - renewableRemaining)

      // The starter grant is created lazily on the first AI action. Keep the
      // wallet breakdown hidden until it exists so the UI does not claim that
      // an uncreated ledger grant is already spendable.
      if (pendingStarterCredits) creditBreakdown = null
    }

    return NextResponse.json({
      plan: planName,
      status: dbUser.subscriptionStatus,
      hasActiveSubscription: isActive,
      billingEnabled: isBillingConfigured(),
      creditPurchasesEnabled:
        walletEnabled && isBillingConfigured() && isCreditWalletPurchaseConfigured(),
      creditBreakdown,
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
