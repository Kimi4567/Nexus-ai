import { prisma } from '@/lib/prisma'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  hashCampaignSnapshotPayload,
  type CampaignSnapshotReference,
} from '@/lib/campaignSnapshots'
import {
  buildPaidBudgetApprovalPayload,
  buildPaidLaunchApprovalPayload,
  paidApprovalMatchesCurrent,
} from '@/lib/paidApprovals'

// Paid execution models are intentionally handled through the generated
// runtime client so this service remains usable while additive migrations are
// staged locally before they are applied to Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export class PaidApprovalError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code)
  }
}

function reference(snapshot: {
  id: string
  version: number
  scope: string
  payloadHash: string
}): CampaignSnapshotReference {
  return {
    id: snapshot.id,
    version: snapshot.version,
    scope: snapshot.scope,
    payloadHash: snapshot.payloadHash,
  }
}

function validBudget(campaign: Record<string, unknown>): boolean {
  const value = campaign.budgetType === 'LIFETIME'
    ? Number(campaign.lifetimeBudget)
    : Number(campaign.dailyBudget)
  if (!Number.isFinite(value) || value <= 0) return false

  const startAt = campaign.startDate ? new Date(campaign.startDate as Date | string) : null
  const endAt = campaign.endDate ? new Date(campaign.endDate as Date | string) : null
  return Boolean(
    startAt
    && endAt
    && !Number.isNaN(startAt.getTime())
    && !Number.isNaN(endAt.getTime())
    && endAt.getTime() > startAt.getTime(),
  )
}

async function currentStrategySnapshot(tx: any, campaign: Record<string, any>) {
  if (!campaign.organicCampaignId || !campaign.strategySnapshotId || !campaign.strategySnapshot) {
    throw new PaidApprovalError('PAID_STRATEGY_SNAPSHOT_REQUIRED', 409)
  }
  const latest = await tx.campaignSnapshot.findFirst({
    where: {
      workspaceId: campaign.workspaceId,
      campaignId: campaign.organicCampaignId,
      scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
    },
    orderBy: { version: 'desc' },
  })
  if (!latest || latest.id !== campaign.strategySnapshotId) {
    throw new PaidApprovalError('PAID_STRATEGY_REVISION_CHANGED', 409)
  }
  if (latest.payloadHash !== hashCampaignSnapshotPayload(latest.payload)) {
    throw new PaidApprovalError('PAID_STRATEGY_SNAPSHOT_INVALID', 409)
  }
  return latest
}

async function appendApprovalSnapshot(input: {
  tx: any
  campaign: Record<string, any>
  userId: string
  scope: string
  payload: Record<string, unknown>
}) {
  const source = await input.tx.campaign.update({
    where: { id: input.campaign.organicCampaignId },
    data: { snapshotVersion: { increment: 1 } },
    select: { snapshotVersion: true },
  })
  return input.tx.campaignSnapshot.create({
    data: {
      workspaceId: input.campaign.workspaceId,
      campaignId: input.campaign.organicCampaignId,
      version: source.snapshotVersion,
      scope: input.scope,
      payload: input.payload,
      payloadHash: hashCampaignSnapshotPayload(input.payload),
      createdById: input.userId,
    },
  })
}

export async function approvePaidBudgetDecision(input: {
  adCampaignId: string
  userId: string
}): Promise<{ snapshot: CampaignSnapshotReference; unchanged: boolean }> {
  return db.$transaction(async (tx: any) => {
    const campaign = await tx.adCampaign.findFirst({
      where: { id: input.adCampaignId, workspace: { ownerId: input.userId } },
      include: {
        strategySnapshot: true,
        budgetApprovalSnapshot: true,
      },
    })
    if (!campaign) throw new PaidApprovalError('PAID_CAMPAIGN_NOT_FOUND', 404)
    if (campaign.status !== 'DRAFT' || campaign.platformCampaignId) {
      throw new PaidApprovalError('PAID_DRAFT_NOT_EDITABLE', 409)
    }
    if (!validBudget(campaign)) {
      throw new PaidApprovalError('PAID_BUDGET_APPROVAL_INVALID', 422)
    }

    const strategySnapshot = await currentStrategySnapshot(tx, campaign)
    const payload = buildPaidBudgetApprovalPayload({
      campaign,
      strategySnapshot: reference(strategySnapshot),
    })
    if (paidApprovalMatchesCurrent(
      campaign.budgetApprovalSnapshot,
      CAMPAIGN_SNAPSHOT_SCOPE.PAID_BUDGET_APPROVAL,
      payload,
    )) {
      return { snapshot: reference(campaign.budgetApprovalSnapshot), unchanged: true }
    }

    const snapshot = await appendApprovalSnapshot({
      tx,
      campaign,
      userId: input.userId,
      scope: CAMPAIGN_SNAPSHOT_SCOPE.PAID_BUDGET_APPROVAL,
      payload,
    })
    await tx.adCampaign.update({
      where: { id: campaign.id },
      data: {
        budgetApprovalSnapshotId: snapshot.id,
        launchApprovalSnapshotId: null,
      },
    })
    await tx.campaignActivity.create({
      data: {
        campaignId: campaign.organicCampaignId,
        type: 'paid_budget_approved',
        description: 'Paid budget and paused-platform-draft decision approved',
        metadata: {
          adCampaignId: campaign.id,
          snapshotId: snapshot.id,
          snapshotVersion: snapshot.version,
          snapshotHash: snapshot.payloadHash,
          spendAuthorized: false,
        },
      },
    })
    return { snapshot: reference(snapshot), unchanged: false }
  })
}

export async function approvePaidLaunchDecision(input: {
  adCampaignId: string
  userId: string
}): Promise<{ snapshot: CampaignSnapshotReference; unchanged: boolean }> {
  return db.$transaction(async (tx: any) => {
    const campaign = await tx.adCampaign.findFirst({
      where: { id: input.adCampaignId, workspace: { ownerId: input.userId } },
      include: {
        strategySnapshot: true,
        budgetApprovalSnapshot: true,
        launchApprovalSnapshot: true,
        adSets: { include: { ads: true } },
      },
    })
    if (!campaign) throw new PaidApprovalError('PAID_CAMPAIGN_NOT_FOUND', 404)
    if (
      campaign.status !== 'PAUSED'
      || campaign.platformStatus !== 'PAUSED'
      || !campaign.platformCampaignId
    ) {
      throw new PaidApprovalError('PAID_PLATFORM_DRAFT_REQUIRED', 409)
    }

    const strategySnapshot = await currentStrategySnapshot(tx, campaign)
    if (!campaign.budgetApprovalSnapshot) {
      throw new PaidApprovalError('PAID_BUDGET_APPROVAL_REQUIRED', 409)
    }
    const budgetPayload = buildPaidBudgetApprovalPayload({
      campaign,
      strategySnapshot: reference(strategySnapshot),
    })
    if (!paidApprovalMatchesCurrent(
      campaign.budgetApprovalSnapshot,
      CAMPAIGN_SNAPSHOT_SCOPE.PAID_BUDGET_APPROVAL,
      budgetPayload,
    )) {
      throw new PaidApprovalError('PAID_BUDGET_APPROVAL_REQUIRED', 409)
    }

    const adSets = Array.isArray(campaign.adSets) ? campaign.adSets : []
    const platformObjectsComplete = adSets.length > 0 && adSets.every((adSet: Record<string, any>) => (
      Boolean(adSet.platformAdSetId)
      && Array.isArray(adSet.ads)
      && adSet.ads.length > 0
      && adSet.ads.every((ad: Record<string, any>) => Boolean(ad.platformAdId))
    ))
    if (!platformObjectsComplete) {
      throw new PaidApprovalError('PAID_PLATFORM_DRAFT_INCOMPLETE', 409)
    }

    const payload = buildPaidLaunchApprovalPayload({
      campaign,
      strategySnapshot: reference(strategySnapshot),
      budgetApprovalSnapshot: reference(campaign.budgetApprovalSnapshot),
      adSets,
    })
    if (paidApprovalMatchesCurrent(
      campaign.launchApprovalSnapshot,
      CAMPAIGN_SNAPSHOT_SCOPE.PAID_LAUNCH_APPROVAL,
      payload,
    )) {
      return { snapshot: reference(campaign.launchApprovalSnapshot), unchanged: true }
    }

    const snapshot = await appendApprovalSnapshot({
      tx,
      campaign,
      userId: input.userId,
      scope: CAMPAIGN_SNAPSHOT_SCOPE.PAID_LAUNCH_APPROVAL,
      payload,
    })
    await tx.adCampaign.update({
      where: { id: campaign.id },
      data: { launchApprovalSnapshotId: snapshot.id },
    })
    await tx.campaignActivity.create({
      data: {
        campaignId: campaign.organicCampaignId,
        type: 'paid_launch_approved',
        description: 'Paid platform delivery and spend approved',
        metadata: {
          adCampaignId: campaign.id,
          snapshotId: snapshot.id,
          snapshotVersion: snapshot.version,
          snapshotHash: snapshot.payloadHash,
          spendAuthorized: true,
        },
      },
    })
    return { snapshot: reference(snapshot), unchanged: false }
  })
}
