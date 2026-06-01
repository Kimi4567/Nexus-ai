/**
 * GET /api/social/analytics?campaignId=xxx
 *
 * Pulls real post-level insights from Meta Graph API for all published
 * SocialPosts belonging to the given campaign.
 *
 * Per post: impressions, reach, engaged_users (from post insights endpoint)
 * Returns campaign totals + per-post breakdown.
 *
 * Sprint S — Real Analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const revalidate = 0 // always fresh

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaignId')
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

  // Verify campaign belongs to user
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspace: { ownerId: user.id } },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Get all published posts for this campaign
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = await (prisma as any).socialPost.findMany({
    where: { campaignId, status: 'PUBLISHED' },
    include: { integration: { select: { accessToken: true, config: true } } },
    orderBy: { publishedAt: 'desc' },
    take: 20,
  })

  if (posts.length === 0) {
    return NextResponse.json({ posts: [], totals: { impressions: 0, reach: 0, engagement: 0, posts: 0 } })
  }

  // Fetch insights for each post from Meta Graph API
  const postsWithInsights = await Promise.all(
    posts.map(async (post: any) => {
      if (!post.platformPostId || !post.integration?.accessToken) {
        return { ...post, insights: null }
      }

      // Find the page access token from config
      const pages: any[] = post.integration.config?.pages || []
      const page = pages.find((p: any) => p.id === post.pageId)
      const pageToken = page?.accessToken || post.integration.accessToken

      try {
        const insightsRes = await fetch(
          `https://graph.facebook.com/v19.0/${post.platformPostId}/insights` +
          `?metric=post_impressions,post_impressions_unique,post_engaged_users,post_clicks` +
          `&access_token=${pageToken}`,
          { next: { revalidate: 300 } } // cache 5 min
        )

        if (!insightsRes.ok) {
          const errData = await insightsRes.json().catch(() => ({}))
          console.warn('[analytics] Insights fetch failed for post', post.platformPostId, errData?.error?.message)
          return { ...post, insights: null, insightsError: errData?.error?.message }
        }

        const insightsData = await insightsRes.json()
        const metrics: Record<string, number> = {}

        for (const item of insightsData.data || []) {
          const val = item.values?.[0]?.value ?? item.value ?? 0
          metrics[item.name] = typeof val === 'object' ? Object.values(val as Record<string, number>).reduce((a, b) => a + b, 0) : val
        }

        return {
          id: post.id,
          platform: post.platform,
          pageId: post.pageId,
          pageName: post.pageName,
          caption: post.caption,
          imageUrl: post.imageUrl,
          platformPostId: post.platformPostId,
          platformUrl: post.platformUrl,
          publishedAt: post.publishedAt,
          insights: {
            impressions: metrics['post_impressions'] || 0,
            reach: metrics['post_impressions_unique'] || 0,
            engagement: metrics['post_engaged_users'] || 0,
            clicks: metrics['post_clicks'] || 0,
          },
        }
      } catch (err: any) {
        console.error('[analytics] Error fetching insights:', err.message)
        return {
          id: post.id,
          platform: post.platform,
          pageName: post.pageName,
          caption: post.caption,
          imageUrl: post.imageUrl,
          platformUrl: post.platformUrl,
          publishedAt: post.publishedAt,
          insights: null,
        }
      }
    })
  )

  // Compute totals
  const totals = postsWithInsights.reduce(
    (acc, p) => {
      if (p.insights) {
        acc.impressions += p.insights.impressions
        acc.reach += p.insights.reach
        acc.engagement += p.insights.engagement
        acc.clicks += p.insights.clicks || 0
      }
      acc.posts += 1
      return acc
    },
    { impressions: 0, reach: 0, engagement: 0, clicks: 0, posts: 0 }
  )

  return NextResponse.json({ posts: postsWithInsights, totals })
}
