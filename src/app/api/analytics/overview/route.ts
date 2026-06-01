/**
 * GET /api/analytics/overview
 * Returns real workspace analytics: campaign stats, published posts,
 * credit usage, and last 6 months of activity for chart rendering.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { PLANS_CREDITS } from '@/lib/credits'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const monthlyTotal = PLANS_CREDITS[plan] ?? 15
    const creditsRemaining = user?.aiCredits ?? 0
    const creditsUsedThisMonth = isUnlimited
      ? user?.monthlyGenerations ?? 0
      : Math.max(0, monthlyTotal - creditsRemaining)

    if (!workspace) {
      return NextResponse.json({
        campaigns: 0, activeCampaigns: 0, draftCampaigns: 0,
        generations: 0, publishedPosts: 0,
        creditsRemaining, creditsUsedThisMonth, monthlyTotal, isUnlimited, plan,
        monthlyActivity: [],
        topCampaigns: [],
      })
    }

    // ── Campaign counts ─────────────────────────────────────────────────────
    const [
      campaigns,
      activeCampaigns,
      draftCampaigns,
      generations,
    ] = await Promise.all([
      prisma.campaign.count({ where: { workspaceId: workspace.id } }).catch(() => 0),
      prisma.campaign.count({ where: { workspaceId: workspace.id, status: 'ACTIVE' } }).catch(() => 0),
      prisma.campaign.count({ where: { workspaceId: workspace.id, status: 'DRAFT' } }).catch(() => 0),
      prisma.generation.count({ where: { campaign: { workspaceId: workspace.id } } }).catch(() => 0),
    ])

    // ── Published posts ─────────────────────────────────────────────────────
    const publishedPosts = await prisma.socialPost.count({
      where: { workspaceId: workspace.id, status: 'PUBLISHED' },
    }).catch(() => 0)

    // ── Monthly activity (last 6 months of Usage records) ──────────────────
    const now = new Date()
    const usage = await prisma.usage.findMany({
      where: { userId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 6,
    }).catch(() => [])

    // Build last 6 calendar months and fill in usage data
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthlyActivity = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const month = d.getMonth() + 1
      const year = d.getFullYear()
      const record = usage.find((u: { month: number; year: number; generationsCount: number; aiCreditsUsed: number }) =>
        u.month === month && u.year === year
      )
      return {
        label: monthNames[d.getMonth()],
        month,
        year,
        generations: record?.generationsCount ?? 0,
        creditsUsed: record?.aiCreditsUsed ?? 0,
      }
    })

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
    })
  } catch (err: unknown) {
    console.warn('[analytics/overview] DB query failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({
      campaigns: 0, activeCampaigns: 0, draftCampaigns: 0,
      generations: 0, publishedPosts: 0, visualsCount: 0,
      creditsRemaining: 0, creditsUsedThisMonth: 0, monthlyTotal: 15,
      isUnlimited: false, plan: 'FREE',
      monthlyActivity: [],
      topCampaigns: [],
    })
  }
}
