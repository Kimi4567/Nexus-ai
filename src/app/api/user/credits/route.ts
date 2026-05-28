/**
 * GET /api/user/credits
 * Returns current credit balance and subscription status for the authenticated user.
 * Called by /start page to show remaining campaigns before the user submits.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const FREE_COMPLIMENTARY_RUNS = 3

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

    // First-time free user — they will get 3 on first run
    const creditsToShow = isFree && freshUser.aiCredits === 0 && freshUser.monthlyGenerations === 0
      ? FREE_COMPLIMENTARY_RUNS
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
