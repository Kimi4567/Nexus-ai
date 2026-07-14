import 'server-only'

import { prisma } from '@/lib/prisma'
import {
  buildPaidStrategyExecutionContext,
  inspectPaidStrategySource,
  type PaidStrategySourceCampaign,
  type PaidStrategySourceTruth,
} from '@/lib/paidStrategySource'
import type { StrategyDecisionEvent } from '@/lib/strategyApproval'

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
}): Promise<{
  campaign: PaidStrategySourceCampaign
  truth: PaidStrategySourceTruth
  executionContext: string
}> {
  if (!input.campaignId) {
    throw new PaidStrategySourceError('PAID_STRATEGY_REQUIRED', 422)
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, workspace: { ownerId: input.userId } },
    select: sourceSelect,
  })
  if (!campaign) throw new PaidStrategySourceError('PAID_STRATEGY_NOT_FOUND', 404)

  const latestDecision = await prisma.marketingLearningEvent.findFirst({
    where: {
      workspaceId: campaign.workspaceId,
      campaignId: campaign.id,
      eventType: { in: ['STRATEGY_APPROVED', 'STRATEGY_APPROVAL_REVOKED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { eventType: true, createdAt: true, source: true },
  })
  const truth = inspectPaidStrategySource(campaign, decisionEvent(latestDecision))

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
    campaign,
    truth,
    executionContext: buildPaidStrategyExecutionContext(campaign.aiOutput),
  }
}

export { sourceSelect, decisionEvent }
