import 'server-only'

import { prisma } from '@/lib/prisma'
import {
  buildPaidStrategyExecutionContext,
  inspectPaidStrategySource,
  type PaidStrategySourceCampaign,
  type PaidStrategySourceTruth,
} from '@/lib/paidStrategySource'
import type { StrategyDecisionEvent } from '@/lib/strategyApproval'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  hashCampaignSnapshotPayload,
  readStrategyApprovalSnapshotPayload,
  type CampaignSnapshotReference,
} from '@/lib/campaignSnapshots'

export class PaidStrategySourceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code)
  }
}

const sourceSelect = {
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

function decisionEvent(value: {
  eventType: string
  createdAt: Date
  source: string
} | null): StrategyDecisionEvent | null {
  if (!value || !['STRATEGY_APPROVED', 'STRATEGY_APPROVAL_REVOKED'].includes(value.eventType)) return null
  return {
    eventType: value.eventType as StrategyDecisionEvent['eventType'],
    createdAt: value.createdAt.toISOString(),
    source: value.source,
  }
}

export async function getPaidStrategySourceForUser(input: {
  campaignId: string
  userId: string
  strategySnapshotId?: string | null
  requirePinnedSnapshot?: boolean
}): Promise<{
  campaign: PaidStrategySourceCampaign
  truth: PaidStrategySourceTruth
  executionContext: string
  snapshot: CampaignSnapshotReference
}> {
  if (!input.campaignId) {
    throw new PaidStrategySourceError('PAID_STRATEGY_REQUIRED', 422)
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, workspace: { ownerId: input.userId } },
    select: sourceSelect,
  })
  if (!campaign) throw new PaidStrategySourceError('PAID_STRATEGY_NOT_FOUND', 404)

  const [latestDecision, latestSnapshot] = await Promise.all([
    prisma.marketingLearningEvent.findFirst({
      where: {
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        eventType: { in: ['STRATEGY_APPROVED', 'STRATEGY_APPROVAL_REVOKED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { eventType: true, createdAt: true, source: true },
    }),
    prisma.campaignSnapshot.findFirst({
      where: {
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
      },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        campaignId: true,
        version: true,
        scope: true,
        payload: true,
        payloadHash: true,
        createdAt: true,
      },
    }),
  ])

  if (!latestSnapshot) {
    throw new PaidStrategySourceError('PAID_STRATEGY_SNAPSHOT_REQUIRED', 422)
  }
  if (input.requirePinnedSnapshot && !input.strategySnapshotId) {
    throw new PaidStrategySourceError('PAID_STRATEGY_SNAPSHOT_REQUIRED', 409)
  }
  if (input.strategySnapshotId && input.strategySnapshotId !== latestSnapshot.id) {
    throw new PaidStrategySourceError('PAID_STRATEGY_REVISION_CHANGED', 409)
  }
  if (latestSnapshot.payloadHash !== hashCampaignSnapshotPayload(latestSnapshot.payload)) {
    throw new PaidStrategySourceError('PAID_STRATEGY_SNAPSHOT_INVALID', 409)
  }

  const snapshotView = readStrategyApprovalSnapshotPayload(latestSnapshot.payload)
  if (
    !snapshotView
    || snapshotView.campaign.id !== campaign.id
    || latestSnapshot.campaignId !== campaign.id
    || latestSnapshot.workspaceId !== campaign.workspaceId
  ) {
    throw new PaidStrategySourceError('PAID_STRATEGY_SNAPSHOT_INVALID', 409)
  }

  const approvedCampaign: PaidStrategySourceCampaign = {
    ...snapshotView.campaign,
    workspaceId: campaign.workspaceId,
    status: campaign.status,
    updatedAt: latestSnapshot.createdAt,
  }
  const truth = inspectPaidStrategySource(approvedCampaign, decisionEvent(latestDecision))

  if (!truth.eligible) {
    const code = truth.reason === 'PAID_SCOPE_REQUIRED'
      ? 'PAID_OR_FULL_STRATEGY_REQUIRED'
      : truth.reason === 'QUALITY_REVIEW_REQUIRED'
        ? 'PAID_STRATEGY_QUALITY_REVIEW_REQUIRED'
      : truth.reason === 'APPROVAL_REQUIRED'
        ? 'PAID_STRATEGY_APPROVAL_REQUIRED'
        : 'PAID_STRATEGY_REQUIRED'
    throw new PaidStrategySourceError(code, 422)
  }

  return {
    campaign: approvedCampaign,
    truth,
    executionContext: buildPaidStrategyExecutionContext(approvedCampaign.aiOutput),
    snapshot: {
      id: latestSnapshot.id,
      version: latestSnapshot.version,
      scope: latestSnapshot.scope,
      payloadHash: latestSnapshot.payloadHash,
    },
  }
}

export { sourceSelect, decisionEvent }
