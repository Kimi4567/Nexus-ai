/**
 * GET /api/campaigns/[id]/performance
 *
 * Returns only platform-API evidence that passes the minimum sample contract.
 * Legacy analytics blobs and tiny samples remain visible as status counts but
 * never enter KPI totals, rankings, trends, or learning prompts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  readPerformanceEvidence,
  summarizePerformanceEvidence,
  type PerformanceEvidence,
} from '@/lib/performanceEvidence'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true, name: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const [publishedPosts, allPosts, scheduledPosts] = await Promise.all([
      (prisma.socialPost as any).findMany({
        where: {
          campaignId: params.id,
          workspaceId: campaign.workspaceId,
          status: 'PUBLISHED',
        },
        select: {
          id: true,
          platform: true,
          caption: true,
          imageUrl: true,
          publishedAt: true,
          platformUrl: true,
          analyticsData: true,
          analyticsFetched: true,
          variantLabel: true,
        },
        orderBy: { publishedAt: 'desc' },
      }),
      (prisma.socialPost as any).count({
        where: { campaignId: params.id, workspaceId: campaign.workspaceId },
      }),
      (prisma.socialPost as any).count({
        where: { campaignId: params.id, workspaceId: campaign.workspaceId, status: 'SCHEDULED' },
      }),
    ]) as [Array<{
      id: string
      platform: string
      caption: string
      imageUrl: string | null
      publishedAt: Date | null
      platformUrl: string | null
      analyticsData: unknown
      analyticsFetched: boolean
      variantLabel: string | null
    }>, number, number]

    const evidenceSummary = summarizePerformanceEvidence(publishedPosts)
    const eligiblePosts = publishedPosts
      .map((post) => ({ post, evidence: readPerformanceEvidence(post.analyticsData) }))
      .filter((item): item is { post: typeof publishedPosts[number]; evidence: PerformanceEvidence } => (
        item.evidence?.quality === 'eligible' && item.evidence.platform === item.post.platform
      ))

    let totalLikes = 0
    let totalComments = 0
    let totalShares = 0
    for (const { evidence } of eligiblePosts) {
      totalLikes += evidence.likes
      totalComments += evidence.comments
      totalShares += evidence.shares
    }

    const publishedByPlatform = new Map<string, number>()
    for (const post of publishedPosts) {
      publishedByPlatform.set(post.platform, (publishedByPlatform.get(post.platform) ?? 0) + 1)
    }
    const platformBreakdown = Object.fromEntries(
      Object.entries(evidenceSummary.byPlatform).map(([platform, data]) => [platform, {
        publishedPosts: publishedByPlatform.get(platform) ?? 0,
        evidencePosts: data?.posts ?? 0,
        reach: data?.reach ?? 0,
        impressions: data?.impressions ?? 0,
        engagements: data?.engagementCount ?? 0,
        clicks: data?.clicks ?? 0,
        avgEngagementRate: data?.engagementRate ?? 0,
      }]),
    )

    const topPosts = eligiblePosts
      .map(({ post, evidence }) => ({
        id: post.id,
        platform: post.platform,
        caption: post.caption.slice(0, 200),
        imageUrl: post.imageUrl,
        publishedAt: post.publishedAt,
        platformUrl: post.platformUrl,
        engagementRate: evidence.engagementRate,
        engagementCount: evidence.engagementCount,
        likes: evidence.likes,
        comments: evidence.comments,
        shares: evidence.shares,
        clicks: evidence.clicks,
        reach: evidence.reach,
        impressions: evidence.impressions,
        denominator: evidence.denominator,
        variantLabel: post.variantLabel,
        source: evidence.source,
      }))
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5)

    const trendMap = new Map<string, { date: string; engagements: number; posts: number }>()
    for (const { post, evidence } of eligiblePosts) {
      if (!post.publishedAt) continue
      const day = post.publishedAt.toISOString().slice(0, 10)
      const existing = trendMap.get(day) ?? { date: day, engagements: 0, posts: 0 }
      existing.engagements += evidence.engagementCount
      existing.posts++
      trendMap.set(day, existing)
    }

    const pendingAnalytics = publishedPosts.filter((post) => !post.analyticsFetched).length
    const awaitingEligibleEvidence = Math.max(0, publishedPosts.length - evidenceSummary.eligiblePosts)

    return NextResponse.json({
      campaignId: params.id,
      campaignName: campaign.name,
      evidenceContract: {
        source: 'platform_api',
        minimumDenominator: 100,
        crossPlatformComparison: false,
        conversionOrRevenueAttribution: false,
      },
      summary: {
        totalPosts: allPosts,
        publishedPosts: publishedPosts.length,
        scheduledPosts,
        pendingAnalytics,
        awaitingEligibleEvidence,
        eligibleEvidencePosts: evidenceSummary.eligiblePosts,
        insufficientSamplePosts: evidenceSummary.insufficientSamplePosts,
        unverifiedLegacyPosts: evidenceSummary.unverifiedPosts,
        totalReach: evidenceSummary.reach,
        totalImpressions: evidenceSummary.impressions,
        totalLikes,
        totalComments,
        totalShares,
        totalClicks: evidenceSummary.clicks,
        totalEngagements: evidenceSummary.engagementCount,
        avgEngagementRate: evidenceSummary.engagementRate,
      },
      platformBreakdown,
      topPosts,
      trend: Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    })
  } catch (err) {
    console.error('[performance GET]', err)
    return NextResponse.json({ error: 'Failed to load performance data' }, { status: 500 })
  }
}
