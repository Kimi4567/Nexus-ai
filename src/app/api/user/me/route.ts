/**
 * GET /api/user/me
 * Returns current user's profile + subscription status.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ensureDbUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  // ensureDbUser creates the Prisma row if missing and always syncs real email
  const authUser = await ensureDbUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = authUser.id

  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        aiCredits: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, currentPeriodEnd: true, monthlyCredits: true },
    }).catch(() => null),
  ])

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar,
    aiCredits: user.aiCredits,
    subscriptionStatus: user.subscriptionStatus,
    plan: subscription?.plan || 'FREE',
    planStatus: subscription?.status || 'FREE',
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    monthlyCredits: subscription?.monthlyCredits || 30,
    createdAt: user.createdAt,
  })
}
