/**
 * GET /api/cron/fetch-analytics
 *
 * Collects real post metrics from connected platform APIs and turns only
 * sufficiently large, platform-local samples into reviewed Brand Brain hook
 * proposals. No AI model is called and nothing is promoted to durable memory
 * until the user accepts a proposal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'
import {
  buildPerformanceEvidence,
  planPerformanceLearning,
  type EvidencePlatform,
  type RawPlatformMetrics,
} from '@/lib/performanceEvidence'
import { cronAuthError } from '@/lib/cronAuth'
import { linkedInHeaders, metaGraphUrl } from '@/lib/socialPlatformConfig'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function metricValue(data: unknown, name: string): number {
  const list = data && typeof data === 'object' && Array.isArray((data as any).data)
    ? (data as any).data
    : []
  const item = list.find((entry: any) => entry?.name === name)
  const raw = item?.values?.[0]?.value ?? item?.value ?? 0
  if (typeof raw === 'number') return raw
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .reduce<number>((sum, value) => sum + (Number(value) || 0), 0)
  }
  return Number(raw) || 0
}

async function fetchMetaInsights(platformPostId: string, pageToken: string): Promise<RawPlatformMetrics | null> {
  try {
    const base = metaGraphUrl(encodeURIComponent(platformPostId))
    const [insightsRes, actionsRes] = await Promise.all([
      fetch(`${base}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users,post_clicks&access_token=${encodeURIComponent(pageToken)}`),
      fetch(`${base}?fields=likes.summary(true),comments.summary(true),shares&access_token=${encodeURIComponent(pageToken)}`),
    ])
    if (!insightsRes.ok) return null

    const insights = await insightsRes.json()
    const actions = actionsRes.ok ? await actionsRes.json() : {}
    if (insights?.error) return null

    return {
      likes: actions?.likes?.summary?.total_count ?? 0,
      comments: actions?.comments?.summary?.total_count ?? 0,
      shares: actions?.shares?.count ?? 0,
      impressions: metricValue(insights, 'post_impressions'),
      reach: metricValue(insights, 'post_impressions_unique'),
      clicks: metricValue(insights, 'post_clicks'),
      engagedUsers: metricValue(insights, 'post_engaged_users'),
    }
  } catch {
    return null
  }
}

function linkedinUrn(prefix: 'organization' | 'share', value: string): string {
  return value.startsWith('urn:li:') ? value : `urn:li:${prefix}:${value}`
}

async function fetchLinkedInInsights(
  platformPostId: string,
  organizationId: string,
  accessToken: string,
): Promise<RawPlatformMetrics | null> {
  try {
    const organizationUrn = linkedinUrn('organization', organizationId)
    const shareUrn = linkedinUrn('share', platformPostId)
    const query = new URLSearchParams({
      q: 'organizationalEntity',
      organizationalEntity: organizationUrn,
      shares: `List(${shareUrn})`,
    })
    const res = await fetch(`https://api.linkedin.com/rest/organizationalEntityShareStatistics?${query.toString()}`, {
      headers: linkedInHeaders(accessToken),
    })
    if (!res.ok) return null
    const data = await res.json()
    const stats = data?.elements?.[0]?.totalShareStatistics
    if (!stats) return null

    return {
      likes: stats.likeCount ?? 0,
      comments: stats.commentCount ?? 0,
      shares: stats.shareCount ?? 0,
      clicks: stats.clickCount ?? 0,
      impressions: stats.impressionCount ?? 0,
      reach: stats.uniqueImpressionsCount ?? 0,
    }
  } catch {
    return null
  }
}

async function fetchTikTokInsights(platformPostId: string, accessToken: string): Promise<RawPlatformMetrics | null> {
  try {
    const fields = 'id,share_url,like_count,comment_count,share_count,view_count'
    const res = await fetch(`https://open.tiktokapis.com/v2/video/query/?fields=${encodeURIComponent(fields)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filters: { video_ids: [platformPostId] } }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || (data?.error?.code && data.error.code !== 'ok')) return null
    const video = Array.isArray(data?.data?.videos)
      ? data.data.videos.find((item: any) => String(item?.id) === platformPostId) || data.data.videos[0]
      : null
    if (!video) return null
    const views = Number(video.view_count) || 0
    return {
      likes: Number(video.like_count) || 0,
      comments: Number(video.comment_count) || 0,
      shares: Number(video.share_count) || 0,
      impressions: views,
      reach: views,
    }
  } catch {
    return null
  }
}

async function fetchYouTubeInsights(platformPostId: string, accessToken: string): Promise<RawPlatformMetrics | null> {
  try {
    const query = new URLSearchParams({ part: 'statistics', id: platformPostId })
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return null
    const statistics = Array.isArray(data?.items) ? data.items[0]?.statistics : null
    if (!statistics) return null
    const views = Number(statistics.viewCount) || 0
    // The Data API exposes views, likes, and comments here; it does not expose
    // unique reach, impressions, shares, or conversions. Views are therefore
    // the explicit denominator and no unavailable metric is invented.
    return {
      likes: Number(statistics.likeCount) || 0,
      comments: Number(statistics.commentCount) || 0,
      shares: 0,
      impressions: views,
      reach: 0,
    }
  } catch {
    return null
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  const results = {
    postsChecked: 0,
    analyticsStored: 0,
    analyticsRetryable: 0,
    learningProposalsCreated: 0,
    aboveBaselinePosts: 0,
    errors: [] as string[],
  }

  try {
    const now = new Date()
    const olderThan24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const newerThan14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const retryBefore = new Date(now.getTime() - 12 * 60 * 60 * 1000)

    const posts = await (prisma.socialPost as any).findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: newerThan14d, lte: olderThan24h },
        analyticsFetched: false,
        platformPostId: { not: null },
        platform: { in: ['META', 'LINKEDIN', 'TIKTOK', 'YOUTUBE'] },
        OR: [{ analyticsUpdatedAt: null }, { analyticsUpdatedAt: { lte: retryBefore } }],
      },
      include: { integration: true },
      orderBy: { publishedAt: 'asc' },
      take: 50,
    }) as Array<{
      id: string
      workspaceId: string
      platform: EvidencePlatform
      platformPostId: string
      integration: any
      pageId: string | null
    }>

    results.postsChecked = posts.length
    const affected = new Map<string, Set<EvidencePlatform>>()

    for (const post of posts) {
      try {
        const integration = post.integration
        if (!integration?.accessToken) {
          results.analyticsRetryable++
          continue
        }

        const pages: any[] = (integration.config as any)?.pages ?? []
        const page = pages.find((entry: any) => entry.id === post.pageId || entry.igAccountId === post.pageId)
        const rawToken = page?.accessToken ?? integration.accessToken
        const token = decryptToken(rawToken) ?? rawToken

        const metrics = post.platform === 'META'
          ? await fetchMetaInsights(post.platformPostId, token)
          : post.platform === 'TIKTOK'
            ? await fetchTikTokInsights(post.platformPostId, token)
            : post.platform === 'YOUTUBE'
              ? await fetchYouTubeInsights(post.platformPostId, token)
              : post.pageId
                ? await fetchLinkedInInsights(post.platformPostId, post.pageId, token)
                : null

        if (!metrics) {
          await (prisma.socialPost as any).update({
            where: { id: post.id },
            data: { analyticsUpdatedAt: now },
          })
          results.analyticsRetryable++
          continue
        }

        const evidence = buildPerformanceEvidence({
          platform: post.platform,
          platformPostId: post.platformPostId,
          collectedAt: now,
          metrics,
        })
        await (prisma.socialPost as any).update({
          where: { id: post.id },
          data: {
            analyticsData: evidence,
            analyticsUpdatedAt: now,
            analyticsFetched: true,
          },
        })
        results.analyticsStored++
        const platforms = affected.get(post.workspaceId) ?? new Set<EvidencePlatform>()
        platforms.add(post.platform)
        affected.set(post.workspaceId, platforms)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown analytics error'
        results.errors.push(`Post ${post.id}: ${message}`)
      }
    }

    for (const [workspaceId, platforms] of affected) {
      try {
        const since = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        const [evidencePosts, existingProposals, brandProfile] = await Promise.all([
          (prisma.socialPost as any).findMany({
            where: {
              workspaceId,
              platform: { in: [...platforms] },
              status: 'PUBLISHED',
              analyticsFetched: true,
            },
            orderBy: { publishedAt: 'desc' },
            take: 200,
            select: { id: true, caption: true, platform: true, analyticsData: true },
          }),
          (prisma.brainLearning as any).findMany({
            where: {
              workspaceId,
              trigger: 'post_performance',
              field: 'winningHooks',
              status: { in: ['pending', 'accepted'] },
              createdAt: { gte: since },
            },
            select: { proposed: true },
            take: 100,
          }),
          prisma.brandProfile.findUnique({
            where: { workspaceId },
            select: { winningHooks: true },
          }),
        ])

        const knownHooks = new Set<string>([
          ...(brandProfile?.winningHooks ?? []),
          ...existingProposals.flatMap((proposal: { proposed: unknown }) => stringArray(proposal.proposed)),
        ].map((hook) => hook.trim().toLocaleLowerCase()))

        const plans = planPerformanceLearning(evidencePosts)
          .map((plan) => ({
            ...plan,
            candidateHooks: plan.candidateHooks.filter((hook) => !knownHooks.has(hook.trim().toLocaleLowerCase())),
          }))
          .filter((plan) => plan.candidateHooks.length > 0)

        if (plans.length === 0) continue
        await (prisma.brainLearning as any).createMany({
          data: plans.map((plan) => ({
            workspaceId,
            campaignId: null,
            trigger: 'post_performance',
            field: 'winningHooks',
            displayName: 'Evidence-backed Hook Candidates',
            icon: '📊',
            current: brandProfile?.winningHooks ?? [],
            proposed: plan.candidateHooks,
            reason: plan.reason,
            status: 'pending',
          })),
        })
        results.learningProposalsCreated += plans.length
        results.aboveBaselinePosts += plans.reduce((sum, plan) => sum + plan.evidencePostIds.length, 0)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown evidence planning error'
        results.errors.push(`Workspace ${workspaceId}: ${message}`)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analytics job error'
    results.errors.push(`Top-level: ${message}`)
  }

  return NextResponse.json({
    ok: results.errors.length === 0,
    source: 'platform-api-evidence',
    aiUsed: false,
    autoLearningApplied: false,
    ...results,
    ts: new Date().toISOString(),
  })
}
