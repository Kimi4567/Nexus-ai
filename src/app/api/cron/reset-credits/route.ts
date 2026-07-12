/**
 * GET /api/cron/reset-credits
 * Monthly cron — resets AI credits for all active paid subscribers.
 * Runs on the 1st of each month at 00:05 UTC.
 * Protected by CRON_SECRET env var (set in Vercel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLAN_CREDITS as STRIPE_PLAN_CREDITS } from '@/lib/stripe'
import { ensureMonthlyGrant, syncCachedWalletBalance } from '@/lib/credits/creditGrants'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'
import { cronAuthError } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

// Map uppercase DB enum values to the lowercase keys used in PLAN_CREDITS
const PLAN_CREDITS: Record<string, number> = {
  STARTER:  STRIPE_PLAN_CREDITS['starter']  ?? 300,
  PRO:      STRIPE_PLAN_CREDITS['pro']      ?? 300,
  BUSINESS: STRIPE_PLAN_CREDITS['business'] ?? 1000,
  AGENCY:   STRIPE_PLAN_CREDITS['agency']   ?? 1000,
}

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime())
}

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  let resetCount = 0
  let errorCount = 0
  let grantCreatedCount = 0
  let grantSkippedCount = 0
  let grantErrorCount = 0

  try {
    // Find all active paid subscriptions
    const activeSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        plan: { in: ['STARTER', 'PRO', 'BUSINESS', 'AGENCY'] as any[] },
      },
      select: {
        userId: true,
        plan: true,
        monthlyCredits: true,
        stripeId: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    })

    console.log(`[CreditReset] Processing ${activeSubs.length} active subscriptions`)

    for (const sub of activeSubs) {
      const credits = PLAN_CREDITS[sub.plan] ?? sub.monthlyCredits
      try {
        const canCreateMonthlyGrant =
          credits > 0 &&
          Boolean(sub.stripeId) &&
          isValidDate(sub.currentPeriodStart) &&
          isValidDate(sub.currentPeriodEnd)

        if (isCreditWalletEnabled()) {
          if (!canCreateMonthlyGrant) {
            grantSkippedCount++
            continue
          }
          const { created } = await (prisma as any).$transaction(async (tx: any) => {
            const grant = await ensureMonthlyGrant(sub.userId, {
              stripeSubscriptionId: sub.stripeId as string,
              currentPeriodStart: sub.currentPeriodStart as Date,
              currentPeriodEnd: sub.currentPeriodEnd as Date,
              amount: credits,
            }, tx)
            await syncCachedWalletBalance(sub.userId, tx)
            return grant
          })
          resetCount++
          if (created) grantCreatedCount++
          else grantSkippedCount++
          continue
        }

        // Legacy scalar path remains available until the wallet flag is enabled.
        await prisma.user.update({
          where: { id: sub.userId },
          data: { aiCredits: credits },
        })
        resetCount++

        if (!canCreateMonthlyGrant) {
          grantSkippedCount++
          continue
        }

        try {
          const { created } = await ensureMonthlyGrant(sub.userId, {
            stripeSubscriptionId: sub.stripeId as string,
            currentPeriodStart: sub.currentPeriodStart as Date,
            currentPeriodEnd: sub.currentPeriodEnd as Date,
            amount: credits,
          })
          if (created) grantCreatedCount++
        } catch (grantError: any) {
          grantErrorCount++
          console.error(`[CreditReset] Grant sync failed for userId=${sub.userId}:`, grantError.message)
        }
      } catch (e: any) {
        console.error(`[CreditReset] Failed for userId=${sub.userId}:`, e.message)
        errorCount++
      }
    }

    console.log(`[CreditReset] Done. Reset: ${resetCount}, Errors: ${errorCount}`)

    return NextResponse.json({
      ok: true,
      processed: activeSubs.length,
      reset: resetCount,
      errors: errorCount,
      grantsCreated: grantCreatedCount,
      grantsSkipped: grantSkippedCount,
      grantErrors: grantErrorCount,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[CreditReset] Fatal error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
