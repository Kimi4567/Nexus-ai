export const dynamic = 'force-dynamic'

/**
 * GET /api/user/credits
 * Returns current credit balance and subscription status for the authenticated user.
 * Called by /start page to show remaining campaigns before the user submits.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { FREE_STARTER_CREDITS } from '@/lib/credits'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        subscriptionStatus: true,
        aiCredits: true,
        monthlyGenerations: true,
      },
    })

    if (!freshUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const isUnlimited = freshUser.aiCredits === -1
    const isFree = freshUser.subscriptionStatus === 'FREE'

    let authoritativeCredits = freshUser.aiCredits
    if (!isUnlimited && isCreditWalletEnabled()) {
      const aggregate = await prisma.creditGrant.aggregate({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          remaining: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        _sum: { remaining: true },
      })
      authoritativeCredits = Math.max(0, aggregate._sum.remaining ?? 0)
    }

    // First-time free user — the atomic grant is created on first paid action.
    const creditsToShow = isFree && authoritativeCredits === 0 && freshUser.monthlyGenerations === 0
      ? FREE_STARTER_CREDITS
      : authoritativeCredits

    return NextResponse.json({
      creditsRemaining: isUnlimited ? -1 : creditsToShow,
      subscriptionStatus: freshUser.subscriptionStatus,
      monthlyGenerations: freshUser.monthlyGenerations,
      isUnlimited,
      isFree,
    })
  } catch (err: any) {
    console.error('[api/user/credits]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
