import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { summarizePerformanceEvidence } from '@/lib/performanceSummary'
import { summarizeLearningEvidence } from '@/lib/learningOverview'
import { buildPilotProofOverview } from '@/lib/pilotProof'
import { readPerformanceEvidence } from '@/lib/performanceEvidence'
import { readFirstPartyMeasurement } from '@/lib/firstPartyMeasurementService'

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
        pilot: buildPilotProofOverview([], []),
        firstParty: null,
      })
    }

    const [learningSignals, workflowSignals, organicRows, paidRows, firstParty] = await Promise.all([
      db.brainLearning?.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          trigger: true,
          field: true,
          displayName: true,
          icon: true,
          current: true,
          proposed: true,
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
        select: {
          id: true,
          campaignId: true,
          status: true,
          platform: true,
          platformPostId: true,
          publishedAt: true,
          manuallyPublishedAt: true,
          analyticsData: true,
          analyticsUpdatedAt: true,
        },
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
      readFirstPartyMeasurement(workspace.id).catch(error => {
        console.warn('[learning/overview] first-party measurement unavailable:', error instanceof Error ? error.message : error)
        return null
      }),
    ])

    const performance = summarizePerformanceEvidence(
      organicRows.map(row => ({ ...row, platform: String(row.platform) })),
      paidRows.map((row: Record<string, unknown>) => ({
        ...row,
        platform: String((row.adCampaign as { platform?: unknown } | null)?.platform ?? 'UNKNOWN'),
      })),
    )
    const eligiblePerformancePostIds = organicRows.flatMap(row => {
      const evidence = readPerformanceEvidence(row.analyticsData)
      return evidence
        && evidence.quality === 'eligible'
        && evidence.platformPostId === row.platformPostId
        ? [row.id]
        : []
    })

    return NextResponse.json({
      ...summarizeLearningEvidence({
        learningSignals,
        workflowSignals,
        performanceEvidenceRows: performance.totalEvidenceRows,
        eligiblePerformancePostIds,
      }),
      performance,
      pilot: buildPilotProofOverview(organicRows, learningSignals),
      firstParty,
    })
  } catch (error) {
    console.warn('[learning/overview] read failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Learning overview unavailable' }, { status: 500 })
  }
}
