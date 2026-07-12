/**
 * GET /api/social/analytics?campaignId=xxx
 *
 * Reads the canonical evidence stored by the analytics collector. This route
 * does not make a second set of live provider calls, so dashboard totals,
 * campaign performance, and Brand Brain learning share one definition.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { readPerformanceEvidence } from '@/lib/performanceEvidence'

export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const userId = await getServerUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaignId = req.nextUrl.searchParams.get('campaignId')
    if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const posts = await (prisma.socialPost as any).findMany({
      where: { campaignId, workspaceId: campaign.workspaceId, status: 'PUBLISHED' },
      select: {
        id: true,
        platform: true,
        pageName: true,
        caption: true,
        imageUrl: true,
        platformUrl: true,
        publishedAt: true,
        analyticsData: true,
        analyticsFetched: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    })

    const totals = {
      impressions: 0,
      reach: 0,
      engagement: 0,
      clicks: 0,
      posts: posts.length,
      eligiblePosts: 0,
      insufficientSamplePosts: 0,
      awaitingCollection: 0,
    }

    const responsePosts = posts.map((post: any) => {
      const evidence = readPerformanceEvidence(post.analyticsData)
      const isEligible = evidence?.quality === 'eligible' && evidence.platform === post.platform
      if (isEligible && evidence) {
        totals.impressions += evidence.impressions
        totals.reach += evidence.reach
        totals.engagement += evidence.engagementCount
        totals.clicks += evidence.clicks ?? 0
        totals.eligiblePosts++
      } else if (evidence?.quality === 'insufficient_sample' && evidence.platform === post.platform) {
        totals.insufficientSamplePosts++
      } else {
        totals.awaitingCollection++
      }

      return {
        id: post.id,
        platform: post.platform,
        pageName: post.pageName,
        caption: post.caption,
        imageUrl: post.imageUrl,
        platformUrl: post.platformUrl,
        publishedAt: post.publishedAt,
        insights: isEligible && evidence ? {
          impressions: evidence.impressions,
          reach: evidence.reach,
          engagement: evidence.engagementCount,
          clicks: evidence.clicks ?? 0,
          engagementRate: evidence.engagementRate,
          source: evidence.source,
        } : null,
        insightsError: evidence?.quality === 'insufficient_sample'
          ? 'INSUFFICIENT_SAMPLE'
          : 'AWAITING_COLLECTION',
      }
    })

    return NextResponse.json({
      posts: responsePosts,
      totals,
      evidenceContract: {
        source: 'platform_api',
        minimumDenominator: 100,
        conversionOrRevenueAttribution: false,
      },
    })
  } catch (err) {
    console.error('[social/analytics]', err)
    return NextResponse.json({ error: 'Failed to load analytics evidence' }, { status: 500 })
  }
}
