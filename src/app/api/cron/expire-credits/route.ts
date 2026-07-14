/**
 * GET /api/cron/expire-credits
 *
 * Wallet maintenance sweep. Expired grants are excluded from spend/status
 * reads immediately, but this job keeps their ledger status and the legacy
 * `User.aiCredits` cache auditable.
 *
 * The route is a no-op while CREDIT_WALLET_ENABLED is false, so a deployment
 * that has not applied the wallet migration cannot fail because the ledger is
 * absent. Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronAuthError } from '@/lib/cronAuth'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'
import { expireCreditGrants, syncCachedWalletBalance } from '@/lib/credits/creditGrants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  if (!isCreditWalletEnabled()) {
    return NextResponse.json({
      ok: true,
      walletEnabled: false,
      skipped: true,
      expired: 0,
      message: 'Credit wallet is disabled; no ledger maintenance was run.',
      timestamp: new Date().toISOString(),
    })
  }

  try {
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const sweep = await expireCreditGrants(new Date(), tx)
      for (const userId of sweep.userIds) {
        await syncCachedWalletBalance(userId, tx)
      }
      return sweep
    })

    return NextResponse.json({
      ok: true,
      walletEnabled: true,
      skipped: false,
      expired: result.expiredCount,
      usersReconciled: result.userIds.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[CreditExpiry] Fatal:', err?.message || err)
    return NextResponse.json({ error: 'Credit expiry sweep failed' }, { status: 500 })
  }
}
