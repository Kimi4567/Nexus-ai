/**
 * GET /api/cron/fetch-analytics
 * Runs daily at 08:00 UTC.
 *
 * FL2-B: Real Analytics Feedback Loop
 * For every post published 24-72 hours ago that hasn't had analytics fetched yet:
 *   1. Fetch engagement data from Meta Insights API or LinkedIn Analytics
 *   2. Store in SocialPost.analyticsData
 *   3. Compare to workspace average engagement rate
 *   4. Posts with above-average engagement → extract hook → feed Brand Brain
 *
 * This closes the real performance loop: actual results → Brand Brain → better future content.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'
import { runBrainLearning } from '@/lib/brain-learning'

export const dynamic = 'force-dynamic'

// ── Analytics helpers ─────────────────────────────────────────────────────────

interface PostMetrics {
  likes: number
  comments: number
  shares: number
  impressions: number
  reach: number
  engagementRate: number  // (likes+comments+shares) / reach * 100
}

/** Fetch Meta post insights via Graph API */
async function fetchMetaInsights(
  platformPostId: string,
  pageToken: string,
): Promise<PostMetrics | null> {
  try {
    const fields = 'likes.summary(true),comments.summary(true),shares,impressions,reach'
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${platformPostId}?fields=${fields}&access_token=${pageToken}`,
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.error) return null

    const likes    = data.likes?.summary?.total_count     ?? 0
    const comments = data.comments?.summary?.total_count  ?? 0
    const shares   = data.shares?.count                   ?? 0
    const impressions = data.impressions ?? 0
    const reach       = data.reach ?? Math.max(impressions, 1)
    const engagementRate = reach > 0
      ? parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2))
      : 0

    return { likes, comments, shares, impressions, reach, engagementRate }
  } catch {
    return null
  }
}

/** Fetch LinkedIn post stats via UGC API */
async function fetchLinkedInInsights(
  platformPostId: string,
  accessToken: string,
): Promise<PostMetrics | null> {
  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(platformPostId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.serviceErrorCode) return null

    const likes    = data.likesSummary?.totalLikes    ?? 0
    const comments = data.commentsSummary?.totalFirstLevelComments ?? 0
    const shares   = data.shareStatistics?.shareCount ?? 0
    const impressions = data.shareStatistics?.impressionCount ?? 0
    const reach       = impressions
    const engagementRate = reach > 0
      ? parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2))
      : 0

    return { likes, comments, shares, impressions, reach, engagementRate }
  } catch {
    return null
  }
}

/** Extract the opening hook (first sentence or ≤100 chars) from a caption */
function extractHook(caption: string): string {
  const first = caption.split(/[.!?\n]/)[0]?.trim() ?? ''
  return first.slice(0, 100)
}

/** Merge incoming strings into existing array, dedup, keep last N */
function mergeUnique(existing: string[] | null | undefined, incoming: string[], limit = 25): string[] {
  const current = Array.isArray(existing) ? existing : []
  const next = incoming.filter(s => typeof s === 'string' && s.trim().length > 0)
  return Array.from(new Set([...current, ...next])).slice(-limit)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    postsChecked: 0,
    analyticsStored: 0,
    brandBrainUpdates: 0,
    aboveAveragePosts: 0,
    errors: [] as string[],
  }

  try {
    const now = new Date()
    const min24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const max72h = new Date(now.getTime() - 72 * 60 * 60 * 1000)

    // Posts published 24-72h ago that haven't had analytics fetched
    const posts = await (prisma.socialPost as any).findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: max72h, lte: min24h },
        analyticsFetched: false,
        platformPostId: { not: null },
      },
      include: { integration: true },
      take: 50,
    }) as Array<{
      id: string
      workspaceId: string
      platform: string
      platformPostId: string
      caption: string
      integration: any
      pageId: string | null
    }>

    results.postsChecked = posts.length

    // Process each post
    const workspaceBrainUpdates = new Map<string, string[]>()

    for (const post of posts) {
      try {
        const integration = post.integration
        if (!integration?.accessToken) continue

        const pages: any[] = (integration.config as any)?.pages ?? []
        const page = pages.find((p: any) => p.id === post.pageId)
        const rawToken = page?.accessToken ?? integration.accessToken
        const token = decryptToken(rawToken) ?? rawToken

        let metrics: PostMetrics | null = null
        const platformStr = String(post.platform)

        if (platformStr === 'META') {
          metrics = await fetchMetaInsights(post.platformPostId, token)
        } else if (platformStr === 'LINKEDIN') {
          metrics = await fetchLinkedInInsights(post.platformPostId, token)
        }

        // Store whatever we got (even null marks it as fetched)
        await (prisma.socialPost as any).update({
          where: { id: post.id },
          data: {
            analyticsData: metrics ?? undefined,
            analyticsUpdatedAt: new Date(),
            analyticsFetched: true,
          },
        })

        if (metrics) results.analyticsStored++
      } catch (err: any) {
        results.errors.push(`Post ${post.id}: ${err.message}`)
      }
    }

    // ── Compute workspace averages + identify above-average posts ──────────────
    // Only run if we stored some analytics
    if (results.analyticsStored > 0) {
      // Re-query posts that now have analytics, grouped by workspace
      const analyticsGroups = await (prisma.socialPost as any).groupBy({
        by: ['workspaceId'],
        where: {
          status: 'PUBLISHED',
          analyticsFetched: true,
          analyticsData: { not: null },
        },
        _count: { id: true },
      }) as Array<{ workspaceId: string; _count: { id: number } }>

      for (const group of analyticsGroups) {
        const wsId = group.workspaceId
        try {
          // Get all posts with analytics for this workspace
          const wsPosts = await (prisma.socialPost as any).findMany({
            where: {
              workspaceId: wsId,
              status: 'PUBLISHED',
              analyticsFetched: true,
              analyticsData: { not: null },
            },
            select: { id: true, caption: true, platform: true, analyticsData: true },
          }) as Array<{ id: string; caption: string; platform: string; analyticsData: any }>

          if (wsPosts.length < 2) continue // need at least 2 posts to compute average

          // Compute average engagement rate
          const rates = wsPosts
            .map(p => (p.analyticsData as any)?.engagementRate ?? 0)
            .filter(r => r > 0)
          if (rates.length === 0) continue

          const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length
          const threshold = avgRate * 1.2  // 20% above average = "winning"

          // Extract hooks from winning posts
          const winningHooks: string[] = wsPosts
            .filter(p => ((p.analyticsData as any)?.engagementRate ?? 0) >= threshold)
            .map(p => extractHook(p.caption))
            .filter(h => h.length > 15)

          if (winningHooks.length === 0) continue

          // ── Direct fast-path update: merge winning hooks into Brand Brain ──────
          // This is the silent fast path — always runs, no user review needed.
          const brand = await prisma.brandProfile.findUnique({
            where: { workspaceId: wsId },
            select: { winningHooks: true },
          })
          if (!brand) continue

          await prisma.brandProfile.update({
            where: { workspaceId: wsId },
            data: { winningHooks: mergeUnique(brand.winningHooks, winningHooks, 25) },
          })

          results.brandBrainUpdates++
          results.aboveAveragePosts += winningHooks.length

          workspaceBrainUpdates.set(wsId, winningHooks)

          // ── PL4: Rich Performance Intelligence Loop via proposal system ────────
          // Runs alongside the fast path — uses GPT-4o to analyse WHICH patterns
          // correlated with above-average engagement and propose specific Brand Brain
          // updates across ALL fields (not just hooks). User reviews in BrainLearningPanel.
          const allPostsForAnalysis = wsPosts.map(p => ({
            caption: typeof p.caption === 'string' ? p.caption.slice(0, 400) : '',
            platform: String(p.platform),
            metrics: p.analyticsData ?? {},
            performance: ((p.analyticsData as any)?.engagementRate ?? 0) >= threshold
              ? 'above_average'
              : 'average',
          })).filter(p => p.caption.length > 10)

          if (allPostsForAnalysis.length >= 2) {
            runBrainLearning({
              workspaceId: wsId,
              trigger: 'post_performance',
              payload: {
                posts: allPostsForAnalysis,
                avgEngagementRate: avgRate,
                threshold,
              },
            }).catch(() => null) // fire-and-forget — never block the cron
          }
        } catch (err: any) {
          results.errors.push(`Workspace ${wsId}: ${err.message}`)
        }
      }
    }
  } catch (err: any) {
    results.errors.push(`Top-level: ${err.message}`)
  }

  return NextResponse.json({ ok: true, ...results, ts: new Date().toISOString() })
}
