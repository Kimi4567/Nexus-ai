/**
 * GET /api/cron/reset-credits
 * Monthly cron — resets AI credits for all active paid subscribers.
 * Runs on the 1st of each month at 00:05 UTC.
 * Protected by CRON_SECRET env var (set in Vercel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLAN_CREDITS as STRIPE_PLAN_CREDITS } from '@/lib/stripe'

// Map uppercase DB enum values to the lowercase keys used in PLAN_CREDITS
const PLAN_CREDITS: Record<string, number> = {
  STARTER:  STRIPE_PLAN_CREDITS['starter']  ?? 300,
  PRO:      STRIPE_PLAN_CREDITS['pro']      ?? 300,
  BUSINESS: STRIPE_PLAN_CREDITS['business'] ?? 1000,
  AGENCY:   STRIPE_PLAN_CREDITS['agency']   ?? 1000,
}

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent abuse
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let resetCount = 0
  let errorCount = 0

  try {
    // Find all active paid subscriptions
    const activeSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        plan: { in: ['STARTER', 'PRO', 'AGENCY'] as any[] },
      },
      select: {
        userId: true,
        plan: true,
        monthlyCredits: true,
      },
    })

    console.log(`[CreditReset] Processing ${activeSubs.length} active subscriptions`)

    for (const sub of activeSubs) {
      const credits = PLAN_CREDITS[sub.plan] ?? sub.monthlyCredits
      try {
        await prisma.user.update({
          where: { id: sub.userId },
          data: { aiCredits: credits },
        })
        resetCount++
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
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[CreditReset] Fatal error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
