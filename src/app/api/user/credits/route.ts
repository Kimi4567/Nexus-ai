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

    // First-time free user — display the starter balance that is granted on first spend.
    const creditsToShow = isFree && freshUser.aiCredits === 0 && freshUser.monthlyGenerations === 0
      ? FREE_STARTER_CREDITS
      : freshUser.aiCredits

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
