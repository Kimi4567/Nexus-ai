/**
 * GET /api/admin/users
 * Returns all users with plan, credits, workspace + campaign counts.
 * Admin-only — requires role === ADMIN in the database.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { summarizeProviderEconomics } from '@/lib/adminEconomics'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  })
  if (dbUser?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url    = new URL(req.url)
  const page   = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10))
  const limit  = Math.min(200, parseInt(url.searchParams.get('limit') ?? '100', 10))

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: page * limit,
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

    const userIds = users.map(user => user.id)
    const periodStart = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))
    const [subscriptions, economicsTransactions] = await Promise.all([
      userIds.length > 0
        ? prisma.subscription.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, plan: true, status: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
      prisma.creditTransaction.findMany({
        where: {
          createdAt: { gte: periodStart },
          status: { in: ['SETTLED', 'REFUNDED'] },
          creditCost: { gt: 0 },
        },
        select: { action: true, status: true, creditCost: true, providerCostUsd: true },
      }),
    ])
    const subscriptionByUser = new Map(subscriptions.map(subscription => [subscription.userId, subscription]))

    // Flatten campaign count and attach the real billing record. User status
    // alone cannot distinguish Growth from Autopilot or produce accurate MRR.
    const usersWithCampaigns = users.map(u => ({
      ...u,
      campaignCount: u.workspaces.reduce((s, w) => s + w._count.campaigns, 0),
      subscription: subscriptionByUser.get(u.id) ?? null,
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

    const totalUsers = await prisma.user.count()
    const activeSubscriptions = subscriptions.filter(subscription => subscription.status === 'ACTIVE')
    const mrrCents = activeSubscriptions.reduce((sum, subscription) => {
      return sum + Math.max(0, subscription.amount ?? 0)
    }, 0)

    return NextResponse.json({
      users: usersWithCampaigns,
      planCounts,
      recentSignups,
      billing: {
        activeSubscriptions: activeSubscriptions.length,
        mrrUsd: Number((mrrCents / 100).toFixed(2)),
        currency: 'usd',
        source: 'active_subscription_records',
      },
      providerEconomics: summarizeProviderEconomics(economicsTransactions, 30),
      pagination: { page, limit, total: totalUsers, pages: Math.ceil(totalUsers / limit) },
    })
  } catch (err: unknown) {
    console.error('[admin/users GET]', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
