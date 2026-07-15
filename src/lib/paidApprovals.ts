import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  hashCampaignSnapshotPayload,
  type CampaignSnapshotReference,
} from '@/lib/campaignSnapshots'

type JsonRecord = Record<string, unknown>

export interface PaidApprovalCampaign {
  id: string
  workspaceId: string
  organicCampaignId?: string | null
  strategySnapshotId?: string | null
  adAccountId?: string | null
  platform: unknown
  objective: unknown
  name: unknown
  budgetType: unknown
  dailyBudget?: unknown
  lifetimeBudget?: unknown
  currency: unknown
  startDate?: Date | string | null
  endDate?: Date | string | null
  trackingUrls?: unknown
  platformCampaignId?: unknown
  platformStatus?: unknown
  status?: unknown
}

export interface PaidApprovalAdSet {
  id: string
  platformAdSetId?: unknown
  name?: unknown
  status?: unknown
  dailyBudget?: unknown
  lifetimeBudget?: unknown
  bidStrategy?: unknown
  bidAmount?: unknown
  targeting?: unknown
  placements?: unknown
  optimizationGoal?: unknown
  billingEvent?: unknown
  ads?: Array<{
    id: string
    platformAdId?: unknown
    platformCreativeId?: unknown
    name?: unknown
    status?: unknown
    format?: unknown
    primaryText?: unknown
    headline?: unknown
    description?: unknown
    callToAction?: unknown
    destinationUrl?: unknown
    imageUrl?: unknown
    videoUrl?: unknown
    carouselCards?: unknown
    creativeSpecs?: unknown
    specsValidated?: unknown
  }>
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function snapshotReference(snapshot: CampaignSnapshotReference): JsonRecord {
  return {
    id: snapshot.id,
    version: snapshot.version,
    scope: snapshot.scope,
    payloadHash: snapshot.payloadHash,
  }
}

export function buildPaidBudgetApprovalPayload(input: {
  campaign: PaidApprovalCampaign
  strategySnapshot: CampaignSnapshotReference
}): JsonRecord {
  return {
    schemaVersion: 1,
    scope: CAMPAIGN_SNAPSHOT_SCOPE.PAID_BUDGET_APPROVAL,
    adCampaignId: input.campaign.id,
    sourceCampaignId: input.campaign.organicCampaignId ?? null,
    strategySnapshot: snapshotReference(input.strategySnapshot),
    execution: {
      name: input.campaign.name ?? null,
      platform: input.campaign.platform ?? null,
      objective: input.campaign.objective ?? null,
      adAccountId: input.campaign.adAccountId ?? null,
      budgetType: input.campaign.budgetType ?? null,
      dailyBudget: input.campaign.dailyBudget ?? null,
      lifetimeBudget: input.campaign.lifetimeBudget ?? null,
      currency: input.campaign.currency ?? null,
      startDate: isoDate(input.campaign.startDate),
      endDate: isoDate(input.campaign.endDate),
      trackingUrls: input.campaign.trackingUrls ?? null,
    },
    approval: {
      budgetReviewed: true,
      trackingReviewed: true,
      platformDraftOnly: true,
      spendAuthorized: false,
    },
  }
}

function adDecision(ad: NonNullable<PaidApprovalAdSet['ads']>[number]): JsonRecord {
  return {
    id: ad.id,
    platformAdId: ad.platformAdId ?? null,
    platformCreativeId: ad.platformCreativeId ?? null,
    name: ad.name ?? null,
    status: ad.status ?? null,
    format: ad.format ?? null,
    primaryText: ad.primaryText ?? null,
    headline: ad.headline ?? null,
    description: ad.description ?? null,
    callToAction: ad.callToAction ?? null,
    destinationUrl: ad.destinationUrl ?? null,
    imageUrl: ad.imageUrl ?? null,
    videoUrl: ad.videoUrl ?? null,
    carouselCards: ad.carouselCards ?? null,
    creativeSpecs: ad.creativeSpecs ?? null,
    specsValidated: ad.specsValidated === true,
  }
}

export function buildPaidLaunchApprovalPayload(input: {
  campaign: PaidApprovalCampaign
  strategySnapshot: CampaignSnapshotReference
  budgetApprovalSnapshot: CampaignSnapshotReference
  adSets: PaidApprovalAdSet[]
}): JsonRecord {
  const adSets = input.adSets
    .map((adSet) => ({
      id: adSet.id,
      platformAdSetId: adSet.platformAdSetId ?? null,
      name: adSet.name ?? null,
      status: adSet.status ?? null,
      dailyBudget: adSet.dailyBudget ?? null,
      lifetimeBudget: adSet.lifetimeBudget ?? null,
      bidStrategy: adSet.bidStrategy ?? null,
      bidAmount: adSet.bidAmount ?? null,
      targeting: adSet.targeting ?? null,
      placements: adSet.placements ?? null,
      optimizationGoal: adSet.optimizationGoal ?? null,
      billingEvent: adSet.billingEvent ?? null,
      ads: (adSet.ads ?? [])
        .map((ad) => ({
          id: ad.id,
          decisionHash: hashCampaignSnapshotPayload(adDecision(ad)),
          decision: adDecision(ad),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))

  return {
    schemaVersion: 1,
    scope: CAMPAIGN_SNAPSHOT_SCOPE.PAID_LAUNCH_APPROVAL,
    adCampaignId: input.campaign.id,
    sourceCampaignId: input.campaign.organicCampaignId ?? null,
    strategySnapshot: snapshotReference(input.strategySnapshot),
    budgetApprovalSnapshot: snapshotReference(input.budgetApprovalSnapshot),
    platformDraft: {
      platform: input.campaign.platform ?? null,
      platformCampaignId: input.campaign.platformCampaignId ?? null,
      platformStatus: input.campaign.platformStatus ?? null,
      localStatus: input.campaign.status ?? null,
    },
    execution: buildPaidBudgetApprovalPayload({
      campaign: input.campaign,
      strategySnapshot: input.strategySnapshot,
    }).execution,
    adSets,
    approval: {
      platformObjectsReviewed: true,
      creativeAndCopyReviewed: true,
      budgetReviewedAgain: true,
      deliveryAndSpendAuthorized: true,
    },
  }
}

export function paidApprovalMatchesCurrent(
  snapshot: { scope?: unknown; payload?: unknown; payloadHash?: unknown } | null | undefined,
  expectedScope: string,
  expectedPayload: JsonRecord,
): boolean {
  if (!snapshot || snapshot.scope !== expectedScope || typeof snapshot.payloadHash !== 'string') return false
  return snapshot.payloadHash === hashCampaignSnapshotPayload(snapshot.payload)
    && snapshot.payloadHash === hashCampaignSnapshotPayload(expectedPayload)
}
