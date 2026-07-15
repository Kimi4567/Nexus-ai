import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { summarizePerformanceEvidence } from '@/lib/performanceSummary'
import { summarizeLearningEvidence } from '@/lib/learningOverview'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    if (!workspace) {
      return NextResponse.json({
        ...summarizeLearningEvidence({ learningSignals: [], workflowSignals: [], performanceEvidenceRows: 0 }),
        performance: summarizePerformanceEvidence([], []),
      })
    }

    const [learningSignals, workflowSignals, organicRows, paidRows] = await Promise.all([
      db.brainLearning?.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          trigger: true,
          field: true,
          displayName: true,
          reason: true,
          evidence: true,
          status: true,
          campaignId: true,
          createdAt: true,
          updatedAt: true,
        },
      }).catch(() => []) ?? [],
      db.marketingLearningEvent?.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          eventType: true,
          actor: true,
          campaignId: true,
          socialPostId: true,
          createdAt: true,
        },
      }).catch(() => []) ?? [],
      prisma.socialPost.findMany({
        where: { workspaceId: workspace.id, status: 'PUBLISHED' },
        select: { platform: true, analyticsData: true, analyticsUpdatedAt: true },
      }).catch(() => []),
      db.adPerformanceSnapshot?.findMany({
        where: {
          adCampaign: { workspaceId: workspace.id },
          dataSource: { in: ['api', 'meta_api', 'ga4'] },
        },
        select: {
          dataSource: true,
          date: true,
          syncedAt: true,
          impressions: true,
          reach: true,
          postEngagements: true,
          clicks: true,
          conversions: true,
          spend: true,
          ctr: true,
          roas: true,
          adCampaign: { select: { platform: true } },
        },
        orderBy: { date: 'desc' },
        take: 180,
      }).catch(() => []) ?? [],
    ])

    const performance = summarizePerformanceEvidence(
      organicRows.map(row => ({ ...row, platform: String(row.platform) })),
      paidRows.map((row: Record<string, unknown>) => ({
        ...row,
        platform: String((row.adCampaign as { platform?: unknown } | null)?.platform ?? 'UNKNOWN'),
      })),
    )

    return NextResponse.json({
      ...summarizeLearningEvidence({
        learningSignals,
        workflowSignals,
        performanceEvidenceRows: performance.totalEvidenceRows,
      }),
      performance,
    })
  } catch (error) {
    console.warn('[learning/overview] read failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Learning overview unavailable' }, { status: 500 })
  }
}
