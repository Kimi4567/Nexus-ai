/**
 * GET /api/admin/users
 * Returns all users with plan, credits, workspace + campaign counts.
 * Admin-only — requires role === ADMIN in the database.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  })
  if (dbUser?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionStatus: true,
        aiCredits: true,
        stripeCustomerId: true,
        createdAt: true,
        lastLoginAt: true,
        company: true,
        _count: {
          select: {
            workspaces: true,
          },
        },
        workspaces: {
          select: {
            _count: { select: { campaigns: true } },
          },
        },
      },
    })

    // Flatten campaign count
    const usersWithCampaigns = users.map(u => ({
      ...u,
      campaignCount: u.workspaces.reduce((s, w) => s + w._count.campaigns, 0),
      workspaces: undefined,
    }))

    // Plan breakdown
    const planCounts = await prisma.user.groupBy({
      by: ['subscriptionStatus'],
      _count: { _all: true },
    })

    // Monthly signups for last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const recentSignups = await prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, subscriptionStatus: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      users: usersWithCampaigns,
      planCounts,
      recentSignups,
    })
  } catch (err: unknown) {
    console.error('[admin/users GET]', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
