/**
 * GET /api/analytics/overview
 * Returns real workspace analytics: campaign stats, published posts,
 * credit usage, and last 6 months of activity for chart rendering.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { PLANS_CREDITS, getUsageSummary, getMonthlyActivity } from '@/lib/credits'
import { summarizePerformanceEvidence } from '@/lib/performanceEvidence'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // ── Core workspace ──────────────────────────────────────────────────────
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    })

    // ── User credit state ───────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCredits: true, monthlyGenerations: true, subscriptionStatus: true },
    })

    const plan = (user?.subscriptionStatus ?? 'FREE') as string
    const isUnlimited = plan === 'AGENCY'
    const monthlyTotal = PLANS_CREDITS[plan] ?? 15
    const creditsRemaining = user?.aiCredits ?? 0

    // Real usage from the credit ledger (shared with /api/dashboard/stats).
    // Never (monthlyTotal - remaining), which underflows to 0 when rollover
    // credits exceed the plan quota.
    const usageSummary = await getUsageSummary(userId)
    const creditsUsedThisMonth = usageSummary.creditsUsedThisMonth

    if (!workspace) {
      return NextResponse.json({
        campaigns: 0, activeCampaigns: 0, draftCampaigns: 0,
        generations: usageSummary.generationsTotal, publishedPosts: 0,
        creditsRemaining, creditsUsedThisMonth, monthlyTotal, isUnlimited, plan,
        monthlyActivity: [],
        topCampaigns: [],
        performanceEvidence: {
          eligiblePosts: 0, insufficientSamplePosts: 0, unverifiedPosts: 0,
          awaitingCollection: 0, impressions: 0, reach: 0,
          engagementCount: 0, clicks: 0, engagementRate: 0, byPlatform: {},
        },
      })
    }

    // ── Campaign counts ─────────────────────────────────────────────────────
    const [
      campaigns,
      activeCampaigns,
      draftCampaigns,
    ] = await Promise.all([
      prisma.campaign.count({ where: { workspaceId: workspace.id } }).catch(() => 0),
      prisma.campaign.count({ where: { workspaceId: workspace.id, status: 'ACTIVE' } }).catch(() => 0),
      prisma.campaign.count({ where: { workspaceId: workspace.id, status: 'DRAFT' } }).catch(() => 0),
    ])
    // AI generations = real spend events from the ledger (shared definition).
    const generations = usageSummary.generationsTotal

    // ── Published posts ─────────────────────────────────────────────────────
    const [publishedPosts, evidenceRows, awaitingCollection] = await Promise.all([
      prisma.socialPost.count({
        where: { workspaceId: workspace.id, status: 'PUBLISHED' },
      }).catch(() => 0),
      (prisma.socialPost as any).findMany({
        where: {
          workspaceId: workspace.id,
          status: 'PUBLISHED',
          analyticsFetched: true,
        },
        select: { platform: true, analyticsData: true },
        orderBy: { publishedAt: 'desc' },
        take: 200,
      }).catch(() => []),
      prisma.socialPost.count({
        where: { workspaceId: workspace.id, status: 'PUBLISHED', analyticsFetched: false },
      }).catch(() => 0),
    ])
    const performanceEvidence = summarizePerformanceEvidence(evidenceRows)

    // ── Monthly activity (last 6 months) — from the credit ledger ──────────
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthlyActivity = (await getMonthlyActivity(userId, 6)).map(a => ({
      label: monthNames[a.month - 1],
      month: a.month,
      year: a.year,
      generations: a.generations,
      creditsUsed: a.creditsUsed,
    }))

    // ── Top campaigns by generation count ──────────────────────────────────
    const topCampaigns = await prisma.campaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        _count: { select: { generations: true } },
      },
    }).catch(() => [])

    // ── Visuals count ───────────────────────────────────────────────────────
    const visualsCount = await db.generatedVisual?.count({
      where: { workspaceId: workspace.id, isArchived: false, status: 'COMPLETED' },
    }).catch(() => 0) ?? 0

    return NextResponse.json({
      campaigns,
      activeCampaigns,
      draftCampaigns,
      generations,
      publishedPosts,
      visualsCount,
      creditsRemaining,
      creditsUsedThisMonth,
      monthlyTotal,
      isUnlimited,
      plan,
      monthlyActivity,
      topCampaigns,
      performanceEvidence: {
        ...performanceEvidence,
        awaitingCollection,
      },
    })
  } catch (err: unknown) {
    console.warn('[analytics/overview] DB query failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({
      campaigns: 0, activeCampaigns: 0, draftCampaigns: 0,
      generations: 0, publishedPosts: 0, visualsCount: 0,
      creditsRemaining: 0, creditsUsedThisMonth: 0, monthlyTotal: 15,
      isUnlimited: false, plan: 'FREE',
      monthlyActivity: [],
      topCampaigns: [],
      performanceEvidence: {
        eligiblePosts: 0, insufficientSamplePosts: 0, unverifiedPosts: 0,
        awaitingCollection: 0, impressions: 0, reach: 0,
        engagementCount: 0, clicks: 0, engagementRate: 0, byPlatform: {},
      },
    })
  }
}
