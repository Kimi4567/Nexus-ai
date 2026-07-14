/**
 * GET /api/billing/status
 * Returns the current user's subscription plan, credits, and period end.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import {
  getBillingMode,
  isBillingConfigured,
  isCreditWalletPurchaseConfigured,
} from '@/lib/stripe'
import { getCreditAccountSnapshot } from '@/lib/credits/accountSnapshot'

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

    // One shared account snapshot powers Billing and Dashboard so a new user
    // cannot see different balances on different product surfaces.
    const account = await getCreditAccountSnapshot(user.id)
    if (!account) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const { user: dbUser, subscription, credits, walletEnabled } = account

    return NextResponse.json({
      plan: account.planName,
      status: dbUser.subscriptionStatus,
      hasActiveSubscription: account.hasActiveSubscription,
      billingEnabled: isBillingConfigured(),
      billingMode: getBillingMode(),
      creditPurchasesEnabled:
        walletEnabled && isBillingConfigured() && isCreditWalletPurchaseConfigured(),
      creditBreakdown: credits.creditBreakdown,
      credits: {
        remaining: credits.remaining,
        used: credits.used,
        max: credits.max,         // -1 = unlimited
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
