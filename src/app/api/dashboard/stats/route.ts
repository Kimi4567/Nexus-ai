/**
 * GET /api/dashboard/stats
 * Returns current dashboard stats for the authenticated user at request time:
 * - campaign counts (total, active, this month)
 * - generation counts
 * - published posts count
 * - recent activity feed (bilingual)
 * - credits remaining + monthly total (for progress bar)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { getUsageSummary } from '@/lib/credits'
import { getCreditAccountSnapshot } from '@/lib/credits/accountSnapshot'
import { hasRealPerformanceAnalytics } from '@/lib/performanceEvidence'
import { getDashboardActivityPresentation } from '@/lib/dashboardActivity'
import {
  deriveDashboardContentRunwayItem,
  sortDashboardContentRunway,
  type DashboardContentPostInput,
} from '@/lib/dashboardContentRunway'

interface DashboardContentTotalsRow {
  scheduledWithEvidence: number
  manualScheduled: number
  autoDeliveryConfigured: number
  externallyPublished: number
  manuallyPublished: number
  mediaApproved: number
  approvedReady: number
}

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Get user's workspace
    const workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
    const workspaceId = workspace?.id
    const db = prisma as any
    const dashboardPostSelect = {
      id: true,
      campaignId: true,
      platform: true,
      publishTarget: true,
      caption: true,
      imageUrl: true,
      isVideoPost: true,
      contentPlanIndex: true,
      status: true,
      approvedAt: true,
      approvedSnapshotId: true,
      mediaApprovalSnapshotId: true,
      scheduledAt: true,
      scheduledSnapshotId: true,
      publishMode: true,
      integrationId: true,
      integration: { select: { status: true } },
      autoPublishConsentAt: true,
      publishedAt: true,
      manuallyPublishedAt: true,
      platformPostId: true,
      platformUrl: true,
      generationStatus: true,
      mediaSource: true,
      uploadedMediaId: true,
      errorMessage: true,
      updatedAt: true,
    }

    const [
      creditAccount,
      totalCampaigns,
      campaignsThisMonth,
      campaignsLastMonth,
      draftCampaigns,
      recentActivities,
      recentCampaigns,
      publishedPostsTotal,
      publishedPostsThisMonth,
      contentPostsTotal,
      approvedOrLaterPostsTotal,
      analyticsRows,
      scheduledContentCandidates,
      recentContentCandidates,
      contentRunwayTotalsRows,
    ] = await Promise.all([
      getCreditAccountSnapshot(userId),

      // Total campaigns
      workspaceId
        ? prisma.campaign.count({ where: { workspaceId } })
        : Promise.resolve(0),

      // Campaigns created this month
      workspaceId
        ? prisma.campaign.count({
            where: { workspaceId, createdAt: { gte: startOfMonth } },
          })
        : Promise.resolve(0),

      // Campaigns last month (for % change)
      workspaceId
        ? prisma.campaign.count({
            where: {
              workspaceId,
              createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
            },
          })
        : Promise.resolve(0),

      // Draft campaigns across the workspace. This powers dashboard truth copy
      // and must not be guessed from a paginated recent-campaign list.
      workspaceId
        ? prisma.campaign.count({ where: { workspaceId, status: 'DRAFT' } })
        : Promise.resolve(0),

      // Recent activity feed (last 8 actions)
      workspaceId
        ? prisma.campaignActivity.findMany({
            where: { campaign: { workspaceId } },
            orderBy: { createdAt: 'desc' },
            take: 8,
            include: { campaign: { select: { name: true } } },
          })
        : Promise.resolve([]),

      // Recent campaigns
      workspaceId
        ? prisma.campaign.findMany({
            where: { workspaceId },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              name: true,
              status: true,
              thumbnail: true,
              platforms: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),

      // Published social posts (total)
      workspaceId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (prisma as any).socialPost.count({ where: { workspaceId, status: 'PUBLISHED' } })
        : Promise.resolve(0),

      // Published social posts this month
      workspaceId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (prisma as any).socialPost.count({
            where: { workspaceId, status: 'PUBLISHED', publishedAt: { gte: startOfMonth } },
          })
        : Promise.resolve(0),

      // Content posts ever created (any status) — indicates content plan was generated
      workspaceId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (prisma as any).socialPost.count({ where: { workspaceId } })
        : Promise.resolve(0),

      // Approval is a workflow decision, distinct from publishing. Login and
      // first-run routing use this count so approved-but-unpublished work is not
      // incorrectly sent back to content review.
      workspaceId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (prisma as any).socialPost.count({
            where: {
              workspaceId,
              status: { in: ['APPROVED', 'SCHEDULED', 'PROCESSING', 'PUBLISHED'] },
              approvedAt: { not: null },
              approvedSnapshotId: { not: null },
            },
          })
        : Promise.resolve(0),

      // Candidate analytics payloads. Meaningful evidence is checked below so
      // empty objects and workflow metadata cannot masquerade as performance.
      workspaceId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (prisma as any).socialPost.findMany({
            where: { workspaceId, status: 'PUBLISHED', analyticsData: { not: null } },
            select: { analyticsData: true },
          })
        : Promise.resolve([]),

      // The dashboard content runway prioritizes execution work instead of
      // fetching every post in a growing workspace.
      workspaceId
        ? db.socialPost.findMany({
            where: { workspaceId, status: { in: ['SCHEDULED', 'PROCESSING', 'FAILED'] } },
            orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'desc' }],
            take: 12,
            select: dashboardPostSelect,
          })
        : Promise.resolve([]),

      workspaceId
        ? db.socialPost.findMany({
            where: { workspaceId, status: { in: ['APPROVED', 'DRAFT', 'PUBLISHED'] } },
            orderBy: { updatedAt: 'desc' },
            take: 12,
            select: dashboardPostSelect,
          })
        : Promise.resolve([]),

      // One filtered aggregate keeps the dashboard truthful without issuing a
      // separate database round-trip for every status tile.
      workspaceId
        ? prisma.$queryRaw<DashboardContentTotalsRow[]>`
            SELECT
              COUNT(*) FILTER (
                WHERE sp."status" = 'SCHEDULED'
                  AND sp."approvedAt" IS NOT NULL
                  AND sp."approvedSnapshotId" IS NOT NULL
                  AND sp."imageUrl" IS NOT NULL
                  AND sp."generationStatus" = 'DONE'
                  AND sp."mediaApprovalSnapshotId" IS NOT NULL
                  AND sp."scheduledAt" IS NOT NULL
                  AND sp."scheduledSnapshotId" IS NOT NULL
                  AND NULLIF(BTRIM(sp."errorMessage"), '') IS NULL
              )::int AS "scheduledWithEvidence",
              COUNT(*) FILTER (
                WHERE sp."status" = 'SCHEDULED'
                  AND sp."publishMode" = 'MANUAL'
                  AND sp."approvedAt" IS NOT NULL
                  AND sp."approvedSnapshotId" IS NOT NULL
                  AND sp."imageUrl" IS NOT NULL
                  AND sp."generationStatus" = 'DONE'
                  AND sp."mediaApprovalSnapshotId" IS NOT NULL
                  AND sp."scheduledAt" IS NOT NULL
                  AND sp."scheduledSnapshotId" IS NOT NULL
                  AND NULLIF(BTRIM(sp."errorMessage"), '') IS NULL
              )::int AS "manualScheduled",
              COUNT(*) FILTER (
                WHERE sp."status" = 'SCHEDULED'
                  AND sp."publishMode" = 'AUTO'
                  AND sp."approvedAt" IS NOT NULL
                  AND sp."approvedSnapshotId" IS NOT NULL
                  AND sp."imageUrl" IS NOT NULL
                  AND sp."generationStatus" = 'DONE'
                  AND sp."mediaApprovalSnapshotId" IS NOT NULL
                  AND sp."scheduledAt" IS NOT NULL
                  AND sp."scheduledSnapshotId" IS NOT NULL
                  AND sp."integrationId" IS NOT NULL
                  AND sp."autoPublishConsentAt" IS NOT NULL
                  AND NULLIF(BTRIM(sp."errorMessage"), '') IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM "Integration" integration
                    WHERE integration."id" = sp."integrationId"
                      AND integration."workspaceId" = sp."workspaceId"
                      AND integration."status" = 'CONNECTED'
                  )
              )::int AS "autoDeliveryConfigured",
              COUNT(*) FILTER (
                WHERE sp."status" = 'PUBLISHED'
                  AND sp."publishedAt" IS NOT NULL
                  AND (sp."platformPostId" IS NOT NULL OR sp."platformUrl" IS NOT NULL)
              )::int AS "externallyPublished",
              COUNT(*) FILTER (
                WHERE sp."status" = 'PUBLISHED'
                  AND sp."manuallyPublishedAt" IS NOT NULL
              )::int AS "manuallyPublished",
              COUNT(*) FILTER (
                WHERE sp."imageUrl" IS NOT NULL
                  AND sp."generationStatus" = 'DONE'
                  AND sp."mediaApprovalSnapshotId" IS NOT NULL
              )::int AS "mediaApproved",
              COUNT(*) FILTER (
                WHERE sp."status" = 'APPROVED'
                  AND sp."approvedAt" IS NOT NULL
                  AND sp."approvedSnapshotId" IS NOT NULL
                  AND sp."imageUrl" IS NOT NULL
                  AND sp."generationStatus" = 'DONE'
                  AND sp."mediaApprovalSnapshotId" IS NOT NULL
              )::int AS "approvedReady"
            FROM "SocialPost" sp
            WHERE sp."workspaceId" = ${workspaceId}
          `
        : Promise.resolve([]),
    ])

    const postsWithAnalytics = analyticsRows.filter((row: { analyticsData: unknown }) =>
      hasRealPerformanceAnalytics(row.analyticsData)
    ).length

    // AI generations + credits-used from the ledger (shared with analytics).
    const usageSummary = await getUsageSummary(userId)
    const contentRunwaySummary: DashboardContentTotalsRow = contentRunwayTotalsRows[0] ?? {
      scheduledWithEvidence: 0,
      manualScheduled: 0,
      autoDeliveryConfigured: 0,
      externallyPublished: 0,
      manuallyPublished: 0,
      mediaApproved: 0,
      approvedReady: 0,
    }

    const candidateMap = new Map<string, Record<string, any>>()
    for (const post of [...scheduledContentCandidates, ...recentContentCandidates]) {
      candidateMap.set(post.id, post)
    }
    const contentCandidates = Array.from(candidateMap.values())
    const contentCampaignIds = Array.from(new Set(
      contentCandidates
        .map(post => post.campaignId)
        .filter((campaignId): campaignId is string => typeof campaignId === 'string' && campaignId.length > 0),
    ))
    const contentCampaigns = workspaceId && contentCampaignIds.length > 0
      ? await db.campaign.findMany({
          where: { workspaceId, id: { in: contentCampaignIds } },
          select: { id: true, name: true },
        })
      : []
    const contentCampaignNames = new Map<string, string>(
      contentCampaigns.map((campaign: { id: string; name: string }) => [campaign.id, campaign.name]),
    )
    const contentRunwayItems = sortDashboardContentRunway(
      contentCandidates.map(post => deriveDashboardContentRunwayItem({
          ...post,
          campaignName: post.campaignId
            ? contentCampaignNames.get(post.campaignId) || 'Campaign'
            : 'Campaign',
          integrationStatus: post.integration?.status || null,
        } as DashboardContentPostInput, now)),
    ).slice(0, 6)

    // Calculate % change for campaigns
    const campaignChange =
      campaignsLastMonth > 0
        ? Math.round(((campaignsThisMonth - campaignsLastMonth) / campaignsLastMonth) * 100)
        : campaignsThisMonth > 0
        ? 100
        : 0

    const activities = recentActivities.map((activity) => {
      const presentation = getDashboardActivityPresentation(activity.type, activity.description)
      return {
        id: activity.id,
        actionAr: presentation.actionAr,
        actionEn: presentation.actionEn,
        action: presentation.actionAr, // legacy key
        agent: presentation.agent,
        campaign: activity.campaign?.name || '',
        time: getRelativeTime(activity.createdAt),
        timeAr: getRelativeTimeAr(activity.createdAt),
        timeEn: getRelativeTimeEn(activity.createdAt),
      }
    })

    if (!creditAccount) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const plan = creditAccount.user.subscriptionStatus ?? 'FREE'
    const creditsMonthlyTotal = creditAccount.credits.max
    const creditsRemaining = creditAccount.credits.remaining
    const isUnlimited = creditAccount.credits.isUnlimited

    return NextResponse.json({
      stats: {
        campaigns: {
          total: totalCampaigns,
          draft: draftCampaigns,
          thisMonth: campaignsThisMonth,
          change: campaignChange,
        },
        generations: {
          total: usageSummary.generationsTotal,
          thisMonth: usageSummary.generationsThisMonth,
        },
        credits: {
          remaining: creditsRemaining,
          plan,
          monthlyTotal: creditsMonthlyTotal,
          isUnlimited,
          lowCredits: !isUnlimited && creditsRemaining < 5,
        },
        publishedPosts: {
          total: publishedPostsTotal,
          thisMonth: publishedPostsThisMonth,
        },
        contentPosts: {
          total: contentPostsTotal,
          approvedOrLater: approvedOrLaterPostsTotal,
        },
        performanceEvidence: {
          postsWithAnalytics,
        },
      },
      contentRunway: {
        summary: {
          ...contentRunwaySummary,
        },
        items: contentRunwayItems,
      },
      activities,
      recentCampaigns,
    })
  } catch (err: any) {
    console.error('[dashboard/stats]', err)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}

function getRelativeTimeAr(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'منذ لحظات'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  return `منذ ${days} يوم`
}

function getRelativeTimeEn(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getRelativeTime(date: Date): string { return getRelativeTimeAr(date) }
