import { NextRequest, NextResponse } from 'next/server'
import { cronAuthError } from '@/lib/cronAuth'
import { reconcileStaleCreditReservations } from '@/lib/credits/reconcileReservations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  try {
    const reconciliation = await reconcileStaleCreditReservations()
    return NextResponse.json({
      ok: reconciliation.failed === 0,
      reconciliation,
    }, { status: reconciliation.failed === 0 ? 200 : 503 })
  } catch (error) {
    console.error('[Cron:reconcile-credit-reservations]', error)
    return NextResponse.json({ error: 'Credit reservation reconciliation failed' }, { status: 500 })
  }
}
