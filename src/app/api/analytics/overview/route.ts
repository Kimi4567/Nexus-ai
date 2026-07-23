/**
 * GET /api/analytics/overview
 * Returns real workspace analytics: campaign stats, published posts,
 * credit usage, and last 6 months of activity for chart rendering.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { FREE_STARTER_CREDITS, PLANS_CREDITS, getUsageSummary, getMonthlyActivity } from '@/lib/credits'
import { summarizePerformanceEvidence } from '@/lib/performanceSummary'
import { readFirstPartyMeasurement } from '@/lib/firstPartyMeasurementService'
import { summarizeFirstPartyMeasurement } from '@/lib/firstPartyMeasurement'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requestedCampaignId = new URL(req.url).searchParams.get('campaignId')?.trim().slice(0, 100) || null

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
    const monthlyTotal = PLANS_CREDITS[plan] ?? FREE_STARTER_CREDITS
    const creditsRemaining = user?.aiCredits ?? 0

    // Real usage from the credit ledger (shared with /api/dashboard/stats).
    // Never (monthlyTotal - remaining), which underflows to 0 when rollover
    // credits exceed the plan quota.
    const usageSummary = await getUsageSummary(userId)
    const creditsUsedThisMonth = usageSummary.creditsUsedThisMonth

    if (!workspace) {
      const performance = summarizePerformanceEvidence([], [])
      const firstParty = summarizeFirstPartyMeasurement([], [])
      return NextResponse.json({
        campaigns: 0, activeCampaigns: 0, draftCampaigns: 0,
        generations: usageSummary.generationsTotal, publishedPosts: 0,
        creditsRemaining, creditsUsedThisMonth, monthlyTotal, isUnlimited, plan,
        monthlyActivity: [],
        topCampaigns: [],
        measurementCampaigns: [],
        measurementScope: { campaignId: null, campaignName: null, cohort: 'WORKSPACE' },
        performance,
        firstParty,
      })
    }

    const requestedCampaign = requestedCampaignId ? await prisma.campaign.findFirst({
      where: { id: requestedCampaignId, workspaceId: workspace.id },
      select: { id: true, name: true },
    }) : null
    if (requestedCampaignId && !requestedCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
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

    // ── Published posts + trusted performance evidence ──────────────────────
    const [publishedPosts, organicAnalyticsRows, paidAnalyticsRows, firstParty, measurementCampaigns] = await Promise.all([
      prisma.socialPost.count({
        where: { workspaceId: workspace.id, status: 'PUBLISHED' },
      }).catch(() => 0),
      prisma.socialPost.findMany({
        where: {
          workspaceId: workspace.id,
          status: 'PUBLISHED',
        },
        select: {
          platform: true,
          analyticsData: true,
          analyticsUpdatedAt: true,
        },
      }).catch(() => []),
      db.adPerformanceSnapshot?.findMany({
        where: {
          adCampaign: { workspaceId: workspace.id },
          dataSource: { in: ['api', 'meta_api', 'ga4'] },
        },
        select: {
          dataSource: true,
          date: true,
          syncedAt: true,
          impressions: true,
          reach: true,
          postEngagements: true,
          clicks: true,
          conversions: true,
          spend: true,
          ctr: true,
          roas: true,
          adCampaign: { select: { platform: true } },
        },
        orderBy: { date: 'asc' },
        take: 180,
      }).catch(() => []) ?? [],
      readFirstPartyMeasurement(workspace.id, requestedCampaign?.id ?? null).catch(error => {
        console.warn('[analytics/overview] first-party measurement unavailable:', error instanceof Error ? error.message : error)
        return null
      }),
      prisma.campaign.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: { id: true, name: true, status: true },
      }).catch(() => []),
    ])

    const performance = summarizePerformanceEvidence(
      organicAnalyticsRows.map(row => ({ ...row, platform: String(row.platform) })),
      paidAnalyticsRows.map((row: Record<string, unknown>) => ({
        ...row,
        platform: String((row.adCampaign as { platform?: unknown } | null)?.platform ?? 'UNKNOWN'),
      })),
    )

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
      measurementCampaigns,
      measurementScope: {
        campaignId: requestedCampaign?.id ?? null,
        campaignName: requestedCampaign?.name ?? null,
        cohort: requestedCampaign ? 'CAMPAIGN_ACQUISITION' : 'WORKSPACE',
      },
      performance,
      firstParty,
    })
  } catch (err: unknown) {
    console.warn('[analytics/overview] DB query failed:', err instanceof Error ? err.message : err)
    const performance = summarizePerformanceEvidence([], [])
    return NextResponse.json({
      campaigns: 0, activeCampaigns: 0, draftCampaigns: 0,
      generations: 0, publishedPosts: 0, visualsCount: 0,
      creditsRemaining: 0, creditsUsedThisMonth: 0, monthlyTotal: FREE_STARTER_CREDITS,
      isUnlimited: false, plan: 'FREE',
      monthlyActivity: [],
      topCampaigns: [],
      measurementCampaigns: [],
      measurementScope: { campaignId: null, campaignName: null, cohort: 'WORKSPACE' },
      performance,
      firstParty: null,
    })
  }
}
