/**
 * GET /api/dashboard/stats
 * Returns real-time dashboard stats for the current user:
 * - campaign counts (total, active, this month)
 * - generation counts
 * - published posts count
 * - recent activity feed (bilingual)
 * - credits remaining + monthly total (for progress bar)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { FREE_STARTER_CREDITS, PLANS_CREDITS, getUsageSummary } from '@/lib/credits'
import { hasRealPerformanceAnalytics } from '@/lib/performanceEvidence'

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

    const [
      user,
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
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { aiCredits: true, subscriptionStatus: true, name: true, monthlyGenerations: true },
      }),

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
            where: { workspaceId, status: { in: ['APPROVED', 'SCHEDULED', 'PUBLISHED'] } },
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
    ])

    const postsWithAnalytics = analyticsRows.filter((row: { analyticsData: unknown }) =>
      hasRealPerformanceAnalytics(row.analyticsData)
    ).length

    // AI generations + credits-used from the ledger (shared with analytics).
    const usageSummary = await getUsageSummary(userId)

    // Calculate % change for campaigns
    const campaignChange =
      campaignsLastMonth > 0
        ? Math.round(((campaignsThisMonth - campaignsLastMonth) / campaignsLastMonth) * 100)
        : campaignsThisMonth > 0
        ? 100
        : 0

    // Map activity types to bilingual labels and agent names
    const agentMap: Record<string, string> = {
      created: 'NEX',
      generated: 'NEX',
      updated: 'VEX',
      published: 'VEX',
      analyzed: 'PULSE',
      scheduled: 'PULSE',
      monitored: 'Sentinel',
    }

    const activityLabelMapAr: Record<string, string> = {
      created:   'تم إنشاء حملة جديدة',
      generated: 'تم توليد محتوى AI',
      updated:   'تم تحديث الحملة',
      published: 'تم نشر الحملة',
      analyzed:  'تم تحليل الأداء',
      scheduled: 'تم جدولة المحتوى',
      monitored: 'تم رصد المنافسين',
    }
    const activityLabelMapEn: Record<string, string> = {
      created:   'New campaign created',
      generated: 'AI content generated',
      updated:   'Campaign updated',
      published: 'Campaign published',
      analyzed:  'Performance analyzed',
      scheduled: 'Content scheduled',
      monitored: 'Competitors monitored',
    }

    const activities = recentActivities.map((a) => ({
      id: a.id,
      actionAr: activityLabelMapAr[a.type] || a.description || 'نشاط جديد',
      actionEn: activityLabelMapEn[a.type] || a.description || 'New activity',
      action: activityLabelMapAr[a.type] || a.description || 'نشاط جديد', // legacy key
      agent: agentMap[a.type] || 'NEX',
      campaign: a.campaign?.name || '',
      time: getRelativeTime(a.createdAt),
      timeAr: getRelativeTimeAr(a.createdAt),
      timeEn: getRelativeTimeEn(a.createdAt),
    }))

    // Monthly credit total for progress bar (plan-based)
    const plan = user?.subscriptionStatus ?? 'FREE'
    const creditsMonthlyTotal = plan === 'FREE' ? FREE_STARTER_CREDITS
      : (PLANS_CREDITS[plan as keyof typeof PLANS_CREDITS] ?? FREE_STARTER_CREDITS)
    const creditsRemaining = user?.aiCredits ?? 0
    const isUnlimited = creditsRemaining === -1

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
