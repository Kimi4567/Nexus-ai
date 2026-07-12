import { prisma } from '@/lib/prisma'
import {
  buildStrategyApprovalContract,
  type StrategyApprovalBlocker,
  type StrategyApprovalContract,
  type StrategyDecisionEvent,
} from '@/lib/strategyApproval'

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
  status: true,
  goal: true,
  audience: true,
  platforms: true,
  aiOutput: true,
  updatedAt: true,
} as const

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

  return buildStrategyApprovalContract({
    campaign,
    latestDecision: decision,
    publishedPostCount,
    activeAdCampaignCount,
  })
}

export async function approveCampaignStrategy(
  campaignId: string,
  userId: string,
  source = 'CAMPAIGN_REVIEW',
): Promise<{ contract: StrategyApprovalContract; unchanged: boolean }> {
  const before = await getStrategyApprovalContract(campaignId, userId)
  if (before.state === 'approved') return { contract: before, unchanged: true }
  if (!before.canApprove) {
    throw new StrategyApprovalError('STRATEGY_APPROVAL_BLOCKED', 409, before.approvalBlockers)
  }

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.campaign.updateMany({
      where: { id: campaignId, status: 'DRAFT', workspace: { ownerId: userId } },
      data: { status: 'ACTIVE' },
    })
    if (result.count === 0) return false

    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { workspaceId: true },
    })
    await tx.campaignActivity.create({
      data: {
        campaignId,
        type: 'strategy_approved',
        description: 'Strategy direction approved for content planning',
        metadata: { source, performanceClaim: false },
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
  if (before.state !== 'approved') return { contract: before, unchanged: true }
  if (!before.canRevoke) {
    throw new StrategyApprovalError('STRATEGY_REVOCATION_BLOCKED', 409, before.revokeBlockers)
  }

  const cleanReason = reason?.trim().slice(0, 500) || null
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.campaign.updateMany({
      where: { id: campaignId, status: 'ACTIVE', workspace: { ownerId: userId } },
      data: { status: 'DRAFT' },
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
