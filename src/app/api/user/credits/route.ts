export const dynamic = 'force-dynamic'

/**
 * GET /api/user/credits
 * Returns current credit balance and subscription status for the authenticated user.
 * Called by /start page to show remaining campaigns before the user submits.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { getCreditAccountSnapshot } from '@/lib/credits/accountSnapshot'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await getCreditAccountSnapshot(user.id)
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const isFree = account.user.subscriptionStatus === 'FREE'

    return NextResponse.json({
      creditsRemaining: account.credits.remaining,
      subscriptionStatus: account.user.subscriptionStatus,
      monthlyGenerations: account.user.monthlyGenerations,
      isUnlimited: account.credits.isUnlimited,
      isFree,
    })
  } catch (err: any) {
    console.error('[api/user/credits]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
