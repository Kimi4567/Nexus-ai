import { prisma } from '@/lib/prisma'
import {
  buildStrategyApprovalContract,
  type StrategyApprovalBlocker,
  type StrategyApprovalContract,
  type StrategyDecisionEvent,
} from '@/lib/strategyApproval'
import {
  reviewBrandTruthConsistency,
  type MarketingBrandProfile,
} from '@/lib/ai/marketingQualityGate'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  buildStrategyApprovalSnapshotPayload,
  hashCampaignSnapshotPayload,
  sanitizeStrategyApprovalAiOutput,
} from '@/lib/campaignSnapshots'
import { applyStrategyApprovalToCampaignEngine } from '@/lib/campaignEnginePersistence'

export class StrategyApprovalError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly blockers: StrategyApprovalBlocker[] = [],
  ) {
    super(code)
  }
}

const campaignSelect = {
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  status: true,
  goal: true,
  audience: true,
  tone: true,
  platforms: true,
  aiOutput: true,
  snapshotVersion: true,
  updatedAt: true,
  workspace: { select: { brandProfile: true } },
} as const

function applyBrandTruthApprovalBlocker(
  contract: StrategyApprovalContract,
  brandProfile: MarketingBrandProfile | null | undefined,
): StrategyApprovalContract {
  const brandTruthReview = reviewBrandTruthConsistency(brandProfile)
  if (brandTruthReview.status !== 'blocked') return contract

  const brandTruthBlocker: StrategyApprovalBlocker = {
    code: 'BRAND_TRUTH_CONFLICT',
    phase: 'approve',
    message: {
      en: 'Brand Brain contains contradictory source data. Correct it before approving or executing this strategy.',
      ar: 'يحتوي Brand Brain على بيانات مصدر متناقضة. صحّحها قبل اعتماد هذه الاستراتيجية أو تنفيذها.',
    },
  }
  return {
    ...contract,
    state: 'blocked',
    canApprove: false,
    approvalBlockers: [
      brandTruthBlocker,
      ...contract.approvalBlockers.filter(blocker => blocker.code !== 'BRAND_TRUTH_CONFLICT'),
    ],
  }
}

export async function getStrategyApprovalContract(
  campaignId: string,
  userId: string,
): Promise<StrategyApprovalContract> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspace: { ownerId: userId } },
    select: campaignSelect,
  })
  if (!campaign) throw new StrategyApprovalError('CAMPAIGN_NOT_FOUND', 404)

  const [latestDecision, publishedPostCount, activeAdCampaignCount] = await Promise.all([
    prisma.marketingLearningEvent.findFirst({
      where: {
        workspaceId: campaign.workspaceId,
        campaignId,
        eventType: { in: ['STRATEGY_APPROVED', 'STRATEGY_APPROVAL_REVOKED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { eventType: true, createdAt: true, source: true },
    }),
    (prisma.socialPost as any).count({
      where: {
        workspaceId: campaign.workspaceId,
        campaignId,
        OR: [{ status: 'PUBLISHED' }, { publishedAt: { not: null } }],
      },
    }) as Promise<number>,
    prisma.adCampaign.count({
      where: {
        workspaceId: campaign.workspaceId,
        organicCampaignId: campaignId,
        status: 'ACTIVE',
      },
    }),
  ])

  const decision: StrategyDecisionEvent | null = latestDecision
    && ['STRATEGY_APPROVED', 'STRATEGY_APPROVAL_REVOKED'].includes(latestDecision.eventType)
    ? {
        eventType: latestDecision.eventType as StrategyDecisionEvent['eventType'],
        createdAt: latestDecision.createdAt.toISOString(),
        source: latestDecision.source,
      }
    : null

  return applyBrandTruthApprovalBlocker(buildStrategyApprovalContract({
    campaign,
    latestDecision: decision,
    publishedPostCount,
    activeAdCampaignCount,
  }), campaign.workspace.brandProfile as MarketingBrandProfile | null)
}

export async function approveCampaignStrategy(
  campaignId: string,
  userId: string,
  source = 'CAMPAIGN_REVIEW',
  expectedStrategyUpdatedAt?: string | null,
): Promise<{ contract: StrategyApprovalContract; unchanged: boolean }> {
  const before = await getStrategyApprovalContract(campaignId, userId)
  if (before.state === 'approved') return { contract: before, unchanged: true }
  if (!before.canApprove) {
    throw new StrategyApprovalError('STRATEGY_APPROVAL_BLOCKED', 409, before.approvalBlockers)
  }
  if (
    expectedStrategyUpdatedAt
    && before.operatingBrief.strategyUpdatedAt !== expectedStrategyUpdatedAt
  ) {
    throw new StrategyApprovalError('STRATEGY_REVIEW_STALE', 409)
  }

  const changed = await prisma.$transaction(async (tx) => {
    const snapshotSource = await tx.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: campaignSelect,
    })
    const currentContract = applyBrandTruthApprovalBlocker(
      buildStrategyApprovalContract({ campaign: snapshotSource }),
      snapshotSource.workspace.brandProfile as MarketingBrandProfile | null,
    )
    if (!currentContract.canApprove) {
      throw new StrategyApprovalError('STRATEGY_APPROVAL_BLOCKED', 409, currentContract.approvalBlockers)
    }
    const safeAiOutput = sanitizeStrategyApprovalAiOutput({
      campaign: snapshotSource,
      brandProfile: snapshotSource.workspace.brandProfile,
    })
    const approvedAt = new Date().toISOString()
    safeAiOutput.nexusEngine = applyStrategyApprovalToCampaignEngine(
      safeAiOutput.nexusEngine,
      true,
      approvedAt,
    )
    const result = await tx.campaign.updateMany({
      where: {
        id: campaignId,
        status: 'DRAFT',
        updatedAt: snapshotSource.updatedAt,
        workspace: { ownerId: userId },
      },
      data: { status: 'ACTIVE', snapshotVersion: { increment: 1 }, aiOutput: safeAiOutput as any },
    })
    if (result.count === 0) {
      throw new StrategyApprovalError('STRATEGY_APPROVAL_CONCURRENT_CHANGE', 409)
    }

    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { workspaceId: true, snapshotVersion: true },
    })
    const payload = buildStrategyApprovalSnapshotPayload({
      campaign: { ...snapshotSource, aiOutput: safeAiOutput },
      brandProfile: snapshotSource.workspace.brandProfile,
      persistedApprovedAiOutput: true,
    })
    const snapshot = await tx.campaignSnapshot.create({
      data: {
        workspaceId: campaign.workspaceId,
        campaignId,
        version: campaign.snapshotVersion,
        scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
        payload: payload as any,
        payloadHash: hashCampaignSnapshotPayload(payload),
        createdById: userId,
      },
    })
    await tx.campaignActivity.create({
      data: {
        campaignId,
        type: 'strategy_approved',
        description: 'Strategy direction approved for content planning',
        metadata: {
          source,
          performanceClaim: false,
          snapshotId: snapshot.id,
          snapshotVersion: snapshot.version,
          snapshotHash: snapshot.payloadHash,
        },
      },
    })
    await tx.marketingLearningEvent.create({
      data: {
        workspaceId: campaign.workspaceId,
        campaignId,
        eventType: 'STRATEGY_APPROVED',
        source,
        actor: 'USER',
        metadata: {
          fromStatus: 'DRAFT',
          toStatus: 'ACTIVE',
          approvalScope: 'STRATEGY_DIRECTION',
          performanceClaim: false,
          snapshotId: snapshot.id,
          snapshotVersion: snapshot.version,
          snapshotHash: snapshot.payloadHash,
        },
      },
    })
    return true
  })

  return {
    contract: await getStrategyApprovalContract(campaignId, userId),
    unchanged: !changed,
  }
}

export async function revokeCampaignStrategyApproval(
  campaignId: string,
  userId: string,
  reason: string | null,
  source = 'CAMPAIGN_REVIEW',
): Promise<{ contract: StrategyApprovalContract; unchanged: boolean }> {
  const before = await getStrategyApprovalContract(campaignId, userId)
  if (before.state !== 'approved' && before.state !== 'blocked') return { contract: before, unchanged: true }
  if (!before.canRevoke) {
    throw new StrategyApprovalError('STRATEGY_REVOCATION_BLOCKED', 409, before.revokeBlockers)
  }

  const cleanReason = reason?.trim().slice(0, 500) || null
  const changed = await prisma.$transaction(async (tx) => {
    const current = await tx.campaign.findFirst({
      where: { id: campaignId, status: 'ACTIVE', workspace: { ownerId: userId } },
      select: { aiOutput: true },
    })
    if (!current) return false
    const currentOutput = current.aiOutput && typeof current.aiOutput === 'object' && !Array.isArray(current.aiOutput)
      ? current.aiOutput as Record<string, unknown>
      : {}
    const revokedAt = new Date().toISOString()
    const nextOutput = {
      ...currentOutput,
      nexusEngine: applyStrategyApprovalToCampaignEngine(
        currentOutput.nexusEngine,
        false,
        revokedAt,
      ),
    }
    const result = await tx.campaign.updateMany({
      where: { id: campaignId, status: 'ACTIVE', workspace: { ownerId: userId } },
      data: { status: 'DRAFT', aiOutput: nextOutput as any },
    })
    if (result.count === 0) return false

    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { workspaceId: true },
    })
    await tx.campaignActivity.create({
      data: {
        campaignId,
        type: 'strategy_approval_revoked',
        description: cleanReason
          ? `Strategy approval revoked: ${cleanReason}`
          : 'Strategy approval revoked',
        metadata: { source, reason: cleanReason },
      },
    })
    await tx.marketingLearningEvent.create({
      data: {
        workspaceId: campaign.workspaceId,
        campaignId,
        eventType: 'STRATEGY_APPROVAL_REVOKED',
        source,
        actor: 'USER',
        metadata: {
          fromStatus: 'ACTIVE',
          toStatus: 'DRAFT',
          reason: cleanReason,
        },
      },
    })
    return true
  })

  return {
    contract: await getStrategyApprovalContract(campaignId, userId),
    unchanged: !changed,
  }
}
