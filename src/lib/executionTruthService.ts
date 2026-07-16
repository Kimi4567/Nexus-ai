import { prisma } from '@/lib/prisma'
import { buildStrategyApprovalContract, type StrategyDecisionEvent } from '@/lib/strategyApproval'
import {
  buildWorkspaceExecutionTruth,
  type CampaignExecutionSnapshot,
  type ExecutionPostCounts,
  type WorkspaceExecutionTruth,
} from '@/lib/executionTruth'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { normalizeStrategyEvidenceLedger } from '@/lib/strategy/strategyEvidenceLedger'

type StatusCountRow = {
  campaignId: string | null
  status: string
  _count: { _all: number }
}

type CampaignCountRow = {
  campaignId: string | null
  _count: { _all: number }
}

type AdCampaignCountRow = {
  organicCampaignId: string | null
  _count: { _all: number }
}

function emptyCounts(): ExecutionPostCounts {
  return { draft: 0, approved: 0, approvedMissingApproval: 0, approvedMissingMedia: 0, scheduled: 0, invalidScheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0, overdueScheduled: 0 }
}

function normalizeStatus(status: string): 'draft' | 'approved' | 'scheduled' | 'published' | 'failed' | null {
  switch (status) {
    case 'DRAFT': return 'draft'
    case 'APPROVED': return 'approved'
    case 'SCHEDULED': return 'scheduled'
    case 'PUBLISHED': return 'published'
    case 'FAILED': return 'failed'
    default: return null
  }
}

export async function getWorkspaceExecutionTruth(
  userId: string,
  options: { campaignId?: string | null } = {},
): Promise<WorkspaceExecutionTruth> {
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!workspace) return buildWorkspaceExecutionTruth([])

  return getWorkspaceExecutionTruthByWorkspaceId(workspace.id, options)
}

/** Internal server/cron entry point. The caller must already own or trust workspaceId. */
export async function getWorkspaceExecutionTruthByWorkspaceId(
  workspaceId: string,
  options: { campaignId?: string | null } = {},
): Promise<WorkspaceExecutionTruth> {

  const campaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      ...(options.campaignId ? { id: options.campaignId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: options.campaignId ? 1 : 100,
    select: {
      id: true,
      name: true,
      status: true,
      goal: true,
      audience: true,
      platforms: true,
      aiOutput: true,
      updatedAt: true,
    },
  })

  if (campaigns.length === 0) return buildWorkspaceExecutionTruth([])

  const campaignIds = campaigns.map((campaign) => campaign.id)
  const db = prisma as any
  const [statusCounts, approvedMissingApprovalCounts, approvedMissingMediaCounts, invalidScheduledCounts, overdueScheduledCounts, eligibleEvidenceCounts, decisionEvents, activeAdCounts, brandProfile] = await Promise.all([
    db.socialPost.groupBy({
      by: ['campaignId', 'status'],
      where: { workspaceId, campaignId: { in: campaignIds } },
      _count: { _all: true },
    }) as Promise<StatusCountRow[]>,
    db.socialPost.groupBy({
      by: ['campaignId'],
      where: {
        workspaceId,
        campaignId: { in: campaignIds },
        status: 'APPROVED',
        approvedSnapshotId: null,
      },
      _count: { _all: true },
    }) as Promise<CampaignCountRow[]>,
    db.socialPost.groupBy({
      by: ['campaignId'],
      where: {
        workspaceId,
        campaignId: { in: campaignIds },
        status: 'APPROVED',
        OR: [
          { imageUrl: null },
          { generationStatus: { not: 'DONE' } },
          { mediaApprovalSnapshotId: null },
        ],
      },
      _count: { _all: true },
    }) as Promise<CampaignCountRow[]>,
    db.socialPost.groupBy({
      by: ['campaignId'],
      where: {
        workspaceId,
        campaignId: { in: campaignIds },
        status: 'SCHEDULED',
        OR: [
          { approvedAt: null },
          { approvedSnapshotId: null },
          { imageUrl: null },
          { generationStatus: { not: 'DONE' } },
          { mediaApprovalSnapshotId: null },
          { scheduledAt: null },
          { scheduledSnapshotId: null },
        ],
      },
      _count: { _all: true },
    }) as Promise<CampaignCountRow[]>,
    db.socialPost.groupBy({
      by: ['campaignId'],
      where: {
        workspaceId,
        campaignId: { in: campaignIds },
        status: 'SCHEDULED',
        scheduledAt: { lt: new Date() },
        publishedAt: null,
        approvedAt: { not: null },
        approvedSnapshotId: { not: null },
        imageUrl: { not: null },
        generationStatus: 'DONE',
        mediaApprovalSnapshotId: { not: null },
        scheduledSnapshotId: { not: null },
      },
      _count: { _all: true },
    }) as Promise<CampaignCountRow[]>,
    db.socialPost.groupBy({
      by: ['campaignId'],
      where: {
        workspaceId,
        campaignId: { in: campaignIds },
        status: 'PUBLISHED',
        analyticsData: { path: ['quality'], equals: 'eligible' },
      },
      _count: { _all: true },
    }) as Promise<CampaignCountRow[]>,
    db.marketingLearningEvent.findMany({
      where: {
        workspaceId,
        campaignId: { in: campaignIds },
        eventType: { in: ['STRATEGY_APPROVED', 'STRATEGY_APPROVAL_REVOKED'] },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['campaignId'],
      select: { campaignId: true, eventType: true, createdAt: true, source: true },
    }) as Promise<Array<{ campaignId: string | null; eventType: string; createdAt: Date; source: string }>>,
    db.adCampaign.groupBy({
      by: ['organicCampaignId'],
      where: { workspaceId, organicCampaignId: { in: campaignIds }, status: 'ACTIVE' },
      _count: { _all: true },
    }) as Promise<AdCampaignCountRow[]>,
    prisma.brandProfile.findUnique({ where: { workspaceId } }),
  ])
  const brandTruthReport = reviewBrandTruthConsistency(brandProfile)

  const countsByCampaign = new Map<string, ExecutionPostCounts>()
  for (const campaignId of campaignIds) countsByCampaign.set(campaignId, emptyCounts())
  for (const row of statusCounts) {
    if (!row.campaignId) continue
    const key = normalizeStatus(row.status)
    const counts = countsByCampaign.get(row.campaignId)
    if (key && counts) counts[key] = row._count._all
  }
  for (const row of approvedMissingMediaCounts) {
    if (!row.campaignId) continue
    const counts = countsByCampaign.get(row.campaignId)
    if (counts) counts.approvedMissingMedia = row._count._all
  }
  for (const row of approvedMissingApprovalCounts) {
    if (!row.campaignId) continue
    const counts = countsByCampaign.get(row.campaignId)
    if (counts) counts.approvedMissingApproval = row._count._all
  }
  for (const row of invalidScheduledCounts) {
    if (!row.campaignId) continue
    const counts = countsByCampaign.get(row.campaignId)
    if (counts) {
      counts.invalidScheduled = row._count._all
      counts.scheduled = Math.max(0, counts.scheduled - row._count._all)
    }
  }
  for (const row of overdueScheduledCounts) {
    if (!row.campaignId) continue
    const counts = countsByCampaign.get(row.campaignId)
    if (counts) counts.overdueScheduled = row._count._all
  }
  for (const counts of countsByCampaign.values()) {
    counts.publishedWithoutAnalytics = counts.published
  }
  for (const row of eligibleEvidenceCounts) {
    if (!row.campaignId) continue
    const counts = countsByCampaign.get(row.campaignId)
    if (counts) counts.publishedWithoutAnalytics = Math.max(0, counts.published - row._count._all)
  }

  const decisions = new Map<string, StrategyDecisionEvent>()
  for (const event of decisionEvents) {
    if (!event.campaignId) continue
    decisions.set(event.campaignId, {
      eventType: event.eventType as StrategyDecisionEvent['eventType'],
      createdAt: event.createdAt.toISOString(),
      source: event.source,
    })
  }

  const activeAds = new Map<string, number>()
  for (const row of activeAdCounts) {
    if (row.organicCampaignId) activeAds.set(row.organicCampaignId, row._count._all)
  }

  const snapshots: CampaignExecutionSnapshot[] = campaigns.map((campaign) => {
    const posts = countsByCampaign.get(campaign.id) ?? emptyCounts()
    const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object' && !Array.isArray(campaign.aiOutput)
      ? campaign.aiOutput as Record<string, unknown>
      : {}
    const strategy = aiOutput.strategy && typeof aiOutput.strategy === 'object' && !Array.isArray(aiOutput.strategy)
      ? aiOutput.strategy as Record<string, unknown>
      : {}
    const approval = buildStrategyApprovalContract({
      campaign: {
        ...campaign,
        status: campaign.status as string,
        goal: campaign.goal as string,
        platforms: campaign.platforms,
      },
      latestDecision: decisions.get(campaign.id) ?? null,
      publishedPostCount: posts.published,
      activeAdCampaignCount: activeAds.get(campaign.id) ?? 0,
    })

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignStatus: campaign.status as string,
      updatedAt: campaign.updatedAt.toISOString(),
      strategyApprovalState: approval.state,
      strategyEvidenceCount: normalizeStrategyEvidenceLedger(strategy.evidenceLedger).length,
      strategyBlockers: [
        ...approval.approvalBlockers.map((blocker) => blocker.code),
        ...(!brandProfile || brandTruthReport.status === 'blocked'
          ? ['BRAND_TRUTH_CONFLICT', ...brandTruthReport.blockers.map((blocker) => blocker.code)]
          : []),
      ],
      posts,
    }
  })

  return buildWorkspaceExecutionTruth(snapshots)
}
