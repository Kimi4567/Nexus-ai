/**
 * GET /api/dashboard/stats
 * Returns real-time dashboard stats for the current user:
 * - campaign counts (total, active, this month)
 * - generation counts
 * - recent activity feed
 * - credits remaining
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

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
      totalGenerations,
      generationsThisMonth,
      recentActivities,
      recentCampaigns,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { aiCredits: true, subscriptionStatus: true, name: true },
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

      // Total AI generations
      workspaceId
        ? prisma.generation.count({
            where: { campaign: { workspaceId } },
          })
        : Promise.resolve(0),

      // Generations this month
      workspaceId
        ? prisma.generation.count({
            where: {
              campaign: { workspaceId },
              createdAt: { gte: startOfMonth },
            },
          })
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
    ])

    // Calculate % change for campaigns
    const campaignChange =
      campaignsLastMonth > 0
        ? Math.round(((campaignsThisMonth - campaignsLastMonth) / campaignsLastMonth) * 100)
        : campaignsThisMonth > 0
        ? 100
        : 0

    // Map activity types to Arabic labels and agent names
    const agentMap: Record<string, string> = {
      created: 'NEX',
      generated: 'NEX',
      updated: 'VEX',
      published: 'VEX',
      analyzed: 'PULSE',
      scheduled: 'PULSE',
      monitored: 'Sentinel',
    }

    const activityLabelMap: Record<string, string> = {
      created: 'تم إنشاء حملة جديدة',
      generated: 'تم توليد محتوى AI',
      updated: 'تم تحديث الحملة',
      published: 'تم نشر الحملة',
      analyzed: 'تم تحليل الأداء',
      scheduled: 'تم جدولة المحتوى',
      monitored: 'تم رصد المنافسين',
    }

    const activities = recentActivities.map((a) => ({
      id: a.id,
      action: activityLabelMap[a.type] || a.description || 'نشاط جديد',
      agent: agentMap[a.type] || 'NEX',
      campaign: a.campaign?.name || '',
      time: getRelativeTime(a.createdAt),
    }))

    return NextResponse.json({
      stats: {
        campaigns: {
          total: totalCampaigns,
          thisMonth: campaignsThisMonth,
          change: campaignChange,
        },
        generations: {
          total: totalGenerations,
          thisMonth: generationsThisMonth,
        },
        credits: {
          remaining: user?.aiCredits ?? 0,
          plan: user?.subscriptionStatus ?? 'FREE',
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

function getRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'منذ لحظات'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  return `منذ ${days} يوم`
}
