/**
 * GET /api/campaigns/[id]/performance
 *
 * FL2-C: ROI Dashboard
 * Returns aggregate performance data for a campaign:
 * - Total reach, impressions, engagement
 * - Per-platform breakdown
 * - Top 5 performing posts (by engagementRate)
 * - Engagement trend over time (daily)
 * - Posts without analytics yet (pending)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { hasRealPerformanceAnalytics } from '@/lib/performanceEvidence'

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

    // Load all published posts with analytics
    const publishedPosts = await (prisma.socialPost as any).findMany({
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
    }) as Array<{
      id: string
      platform: string
      caption: string
      imageUrl: string | null
      publishedAt: string | null
      platformUrl: string | null
      analyticsData: any
      analyticsFetched: boolean
      variantLabel: string | null
    }>

    // ── Aggregate totals ──────────────────────────────────────────────────────
    let totalReach       = 0
    let totalImpressions = 0
    let totalLikes       = 0
    let totalComments    = 0
    let totalShares      = 0
    const postsWithData = publishedPosts.filter(p => hasRealPerformanceAnalytics(p.analyticsData))

    for (const post of postsWithData) {
      const d = post.analyticsData as any
      totalReach       += d.reach       ?? 0
      totalImpressions += d.impressions ?? 0
      totalLikes       += d.likes       ?? 0
      totalComments    += d.comments    ?? 0
      totalShares      += d.shares      ?? 0
    }

    const totalEngagements = totalLikes + totalComments + totalShares
    const avgEngagementRate = totalReach > 0
      ? parseFloat(((totalEngagements / totalReach) * 100).toFixed(2))
      : 0

    // ── Platform breakdown ────────────────────────────────────────────────────
    const platformMap = new Map<string, {
      posts: number
      reach: number
      impressions: number
      engagements: number
      avgEngagementRate: number
    }>()

    for (const post of postsWithData) {
      const key = String(post.platform)
      const existing = platformMap.get(key) ?? {
        posts: 0, reach: 0, impressions: 0, engagements: 0, avgEngagementRate: 0,
      }
      existing.posts++
      if (post.analyticsData) {
        const d = post.analyticsData as any
        existing.reach       += d.reach       ?? 0
        existing.impressions += d.impressions ?? 0
        existing.engagements += (d.likes ?? 0) + (d.comments ?? 0) + (d.shares ?? 0)
      }
      platformMap.set(key, existing)
    }

    // Compute avg engagement rate per platform
    for (const [key, val] of platformMap.entries()) {
      val.avgEngagementRate = val.reach > 0
        ? parseFloat(((val.engagements / val.reach) * 100).toFixed(2))
        : 0
      platformMap.set(key, val)
    }

    const platformBreakdown = Object.fromEntries(platformMap)

    // ── Top 5 posts by engagement rate ────────────────────────────────────────
    const topPosts = postsWithData
      .map(p => ({
        id:              p.id,
        platform:        p.platform,
        caption:         p.caption.slice(0, 200),
        imageUrl:        p.imageUrl,
        publishedAt:     p.publishedAt,
        platformUrl:     p.platformUrl,
        engagementRate:  (p.analyticsData as any)?.engagementRate ?? 0,
        likes:           (p.analyticsData as any)?.likes           ?? 0,
        comments:        (p.analyticsData as any)?.comments        ?? 0,
        shares:          (p.analyticsData as any)?.shares          ?? 0,
        reach:           (p.analyticsData as any)?.reach           ?? 0,
        variantLabel:    p.variantLabel,
      }))
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5)

    // ── Daily engagement trend ────────────────────────────────────────────────
    const trendMap = new Map<string, { date: string; engagements: number; posts: number }>()
    for (const post of postsWithData) {
      if (!post.publishedAt) continue
      const day = post.publishedAt.toString().slice(0, 10)  // YYYY-MM-DD
      const existing = trendMap.get(day) ?? { date: day, engagements: 0, posts: 0 }
      const d = post.analyticsData as any
      existing.engagements += (d.likes ?? 0) + (d.comments ?? 0) + (d.shares ?? 0)
      existing.posts++
      trendMap.set(day, existing)
    }
    const trend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // ── Status summary ────────────────────────────────────────────────────────
    const allPosts = await (prisma.socialPost as any).count({
      where: { campaignId: params.id, workspaceId: campaign.workspaceId },
    })
    const scheduledPosts = await (prisma.socialPost as any).count({
      where: { campaignId: params.id, workspaceId: campaign.workspaceId, status: 'SCHEDULED' },
    })
    const pendingAnalytics = publishedPosts.filter(p => !p.analyticsFetched).length

    return NextResponse.json({
      campaignId:   params.id,
      campaignName: campaign.name,
      summary: {
        totalPosts:        allPosts,
        publishedPosts:    publishedPosts.length,
        postsWithAnalytics: postsWithData.length,
        scheduledPosts,
        pendingAnalytics,
        totalReach,
        totalImpressions,
        totalLikes,
        totalComments,
        totalShares,
        totalEngagements,
        avgEngagementRate,
      },
      platformBreakdown,
      topPosts,
      trend,
    })
  } catch (err: any) {
    console.error('[performance GET]', err)
    return NextResponse.json({ error: 'Failed to load performance data' }, { status: 500 })
  }
}
