import { createHash } from 'node:crypto'
import { guardStrategyKpis } from '@/lib/ai/strategyKpiGuard'
import { guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import { guardStrategyOutputContract } from '@/lib/ai/strategyOutputContractGuard'

export const CAMPAIGN_SNAPSHOT_SCHEMA_VERSION = 1

export const CAMPAIGN_SNAPSHOT_SCOPE = {
  STRATEGY_APPROVAL: 'STRATEGY_APPROVAL',
  CONTENT_APPROVAL: 'CONTENT_APPROVAL',
  CONTENT_MEDIA_APPROVAL: 'CONTENT_MEDIA_APPROVAL',
  SCHEDULE_DECISION: 'SCHEDULE_DECISION',
  PAID_BUDGET_APPROVAL: 'PAID_BUDGET_APPROVAL',
  PAID_LAUNCH_APPROVAL: 'PAID_LAUNCH_APPROVAL',
} as const

export type CampaignSnapshotScope = typeof CAMPAIGN_SNAPSHOT_SCOPE[keyof typeof CAMPAIGN_SNAPSHOT_SCOPE]

type JsonRecord = Record<string, unknown>

const STRATEGY_BRAND_FIELDS = [
  'brandName', 'industry', 'description',
  'toneKeywords', 'avoidKeywords', 'writingStyle',
  'targetAudience', 'audienceAge', 'audienceLocation', 'audiencePainPoints', 'audienceDesires',
  'primaryOffer', 'secondaryOffers', 'pricePoint', 'uniqueAdvantages',
  'visualStyle', 'colorPalette', 'logoUrl',
  'winningHooks', 'winningAngles', 'failedAngles', 'topPlatforms',
  'competitors', 'competitorNotes', 'strategicNotes',
  'businessGoal', 'marketingBudget', 'conversionDestination', 'leadHandling',
  'customerObjections', 'complianceNotes', 'averageOrderValue', 'grossMargin',
  'customerLifetimeValue', 'salesCycleLength', 'seasonality', 'pastAdResults',
  'languagePreference', 'verifiedProof', 'websiteUrl', 'contentSamples',
] as const

export interface CampaignSnapshotReference {
  id: string
  version: number
  scope: string
  payloadHash: string
}

export interface StrategyApprovalSnapshotView {
  campaign: {
    id: string
    name: string
    goal: string
    audience: string | null
    platforms: unknown
    aiOutput: JsonRecord
  }
}

export interface SnapshotContentPost {
  id: string
  platform?: unknown
  publishTarget?: unknown
  caption?: unknown
  imagePrompt?: unknown
  videoPrompt?: unknown
  imageUrl?: unknown
  link?: unknown
  uploadedMediaId?: unknown
  sourceMediaId?: unknown
  mediaSource?: unknown
  generationStatus?: unknown
  isVideoPost?: unknown
  contentPlanIndex?: unknown
  variantGroup?: unknown
  variantLabel?: unknown
  scheduledAt?: unknown
}

function normalizedJson(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalizedJson)
  if (!value || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return null
    return value === undefined ? null : value
  }

  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizedJson(entry)]),
  )
}

export function canonicalSnapshotJson(value: unknown): string {
  return JSON.stringify(normalizedJson(value))
}

export function hashCampaignSnapshotPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalSnapshotJson(payload)).digest('hex')
}

function strategyBrandDecision(brandProfile: unknown): JsonRecord | null {
  if (!brandProfile || typeof brandProfile !== 'object' || Array.isArray(brandProfile)) return null
  const brand = brandProfile as JsonRecord
  return Object.fromEntries(STRATEGY_BRAND_FIELDS.map((field) => [field, brand[field] ?? null]))
}

export function sanitizeStrategyApprovalAiOutput(input: {
  campaign: {
    platforms?: unknown
    aiOutput?: unknown
  }
  brandProfile?: unknown
}): JsonRecord {
  const raw = input.campaign.aiOutput && typeof input.campaign.aiOutput === 'object' && !Array.isArray(input.campaign.aiOutput)
    ? input.campaign.aiOutput as JsonRecord
    : {}
  const brand = input.brandProfile && typeof input.brandProfile === 'object' && !Array.isArray(input.brandProfile)
    ? input.brandProfile as JsonRecord
    : {}
  const language = typeof raw.language === 'string' ? raw.language : null
  const strategyType = raw.strategyType === 'paid' || raw.strategyType === 'full' ? raw.strategyType : 'organic'
  const allowedNumbers = [brand.marketingBudget, brand.pastAdResults]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const verifiedProof = Array.isArray(brand.verifiedProof)
    ? brand.verifiedProof.filter((value): value is string => typeof value === 'string')
    : []
  const allowedClaimText = [
    brand.description,
    brand.primaryOffer,
    brand.pricePoint,
    brand.languagePreference,
    ...(Array.isArray(brand.uniqueAdvantages) ? brand.uniqueAdvantages : []),
    brand.complianceNotes,
    ...verifiedProof,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const guarded = guardStrategyKpis(
    guardStrategyProof(raw, {
      verifiedProof,
      budgetText: typeof brand.marketingBudget === 'string' ? brand.marketingBudget : null,
      allowedClaimText,
    }),
    allowedNumbers,
    { language },
  ) as JsonRecord
  const rawStrategy = guarded.strategy && typeof guarded.strategy === 'object' && !Array.isArray(guarded.strategy)
    ? guarded.strategy as JsonRecord
    : guarded
  const strategy = guardStrategyOutputContract(rawStrategy, {
    allowedPlatforms: Array.isArray(input.campaign.platforms)
      ? input.campaign.platforms.filter((value): value is string => typeof value === 'string')
      : [],
    language,
    strategyType,
    organicPostCount: typeof raw.organicPostCount === 'number' ? raw.organicPostCount : undefined,
    hasLeadHandling: typeof brand.leadHandling === 'string' && brand.leadHandling.trim().length > 0,
    hasConversionDestination: typeof brand.conversionDestination === 'string' && brand.conversionDestination.trim().length > 0,
    allowedCompetitors: Array.isArray(brand.competitors)
      ? brand.competitors.filter((value): value is string => typeof value === 'string')
      : [],
  }) as JsonRecord

  return normalizedJson(
    guarded.strategy && typeof guarded.strategy === 'object' && !Array.isArray(guarded.strategy)
      ? { ...guarded, strategy }
      : strategy,
  ) as JsonRecord
}

function contentDecision(post: SnapshotContentPost): JsonRecord {
  return {
    postId: post.id,
    platform: post.platform ?? null,
    publishTarget: post.publishTarget ?? null,
    caption: post.caption ?? null,
    imagePrompt: post.imagePrompt ?? null,
    videoPrompt: post.videoPrompt ?? null,
    imageUrl: post.imageUrl ?? null,
    link: post.link ?? null,
    uploadedMediaId: post.uploadedMediaId ?? null,
    sourceMediaId: post.sourceMediaId ?? null,
    mediaSource: post.mediaSource ?? null,
    generationStatus: post.generationStatus ?? null,
    isVideoPost: post.isVideoPost === true,
    contentPlanIndex: post.contentPlanIndex ?? null,
    variantGroup: post.variantGroup ?? null,
    variantLabel: post.variantLabel ?? null,
    scheduledAt: post.scheduledAt instanceof Date
      ? post.scheduledAt.toISOString()
      : post.scheduledAt ?? null,
  }
}

function copyDecision(post: SnapshotContentPost): JsonRecord {
  return {
    postId: post.id,
    platform: post.platform ?? null,
    publishTarget: post.publishTarget ?? null,
    caption: post.caption ?? null,
    link: post.link ?? null,
    contentPlanIndex: post.contentPlanIndex ?? null,
    variantGroup: post.variantGroup ?? null,
    variantLabel: post.variantLabel ?? null,
  }
}

function mediaDecision(post: SnapshotContentPost): JsonRecord {
  return {
    postId: post.id,
    imagePrompt: post.imagePrompt ?? null,
    videoPrompt: post.videoPrompt ?? null,
    imageUrl: post.imageUrl ?? null,
    uploadedMediaId: post.uploadedMediaId ?? null,
    sourceMediaId: post.sourceMediaId ?? null,
    mediaSource: post.mediaSource ?? null,
    generationStatus: post.generationStatus ?? null,
    isVideoPost: post.isVideoPost === true,
  }
}

export function hashContentDecision(post: SnapshotContentPost): string {
  return hashCampaignSnapshotPayload(contentDecision(post))
}

export function hashCopyDecision(post: SnapshotContentPost): string {
  return hashCampaignSnapshotPayload(copyDecision(post))
}

export function hashMediaDecision(post: SnapshotContentPost): string {
  return hashCampaignSnapshotPayload(mediaDecision(post))
}

export function buildStrategyApprovalSnapshotPayload(input: {
  campaign: {
    id: string
    name?: unknown
    description?: unknown
    goal?: unknown
    audience?: unknown
    tone?: unknown
    platforms?: unknown
    aiOutput?: unknown
  }
  brandProfile?: unknown
}): JsonRecord {
  const aiOutput = sanitizeStrategyApprovalAiOutput(input)

  return normalizedJson({
    schemaVersion: CAMPAIGN_SNAPSHOT_SCHEMA_VERSION,
    scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
    campaign: {
      id: input.campaign.id,
      name: input.campaign.name ?? null,
      description: input.campaign.description ?? null,
      goal: input.campaign.goal ?? null,
      audience: input.campaign.audience ?? null,
      tone: input.campaign.tone ?? null,
      platforms: input.campaign.platforms ?? [],
    },
    strategyOrder: {
      strategyType: aiOutput.strategyType ?? null,
      strategyDuration: aiOutput.strategyDuration ?? null,
      strategyOrder: aiOutput.strategyOrder ?? null,
      strategyDeliverables: aiOutput.strategyDeliverables ?? null,
      organicPostCount: aiOutput.organicPostCount ?? null,
      detailedCalendarDays: aiOutput.detailedCalendarDays ?? null,
      language: aiOutput.language ?? null,
    },
    strategy: aiOutput.strategy ?? aiOutput,
    qualityGate: aiOutput.qualityGate ?? null,
    sentinelReview: aiOutput.sentinelReview ?? null,
    brandProfile: strategyBrandDecision(input.brandProfile),
  }) as JsonRecord
}

/**
 * Reads the exact approved strategy handoff without falling back to the live
 * Campaign row. Paid execution uses this view so a later strategy edit cannot
 * silently change audience, objective, positioning, or channel direction.
 */
export function readStrategyApprovalSnapshotPayload(payload: unknown): StrategyApprovalSnapshotView | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = payload as JsonRecord
  if (value.scope !== CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL) return null

  const campaign = value.campaign
  if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign)) return null
  const campaignValue = campaign as JsonRecord
  if (
    typeof campaignValue.id !== 'string'
    || typeof campaignValue.name !== 'string'
    || typeof campaignValue.goal !== 'string'
  ) return null

  const strategyOrder = value.strategyOrder && typeof value.strategyOrder === 'object' && !Array.isArray(value.strategyOrder)
    ? value.strategyOrder as JsonRecord
    : {}
  const strategy = value.strategy && typeof value.strategy === 'object' && !Array.isArray(value.strategy)
    ? value.strategy as JsonRecord
    : null
  if (!strategy) return null

  return {
    campaign: {
      id: campaignValue.id,
      name: campaignValue.name,
      goal: campaignValue.goal,
      audience: typeof campaignValue.audience === 'string' ? campaignValue.audience : null,
      platforms: campaignValue.platforms ?? [],
      aiOutput: normalizedJson({
        ...strategyOrder,
        strategy,
        qualityGate: value.qualityGate ?? null,
        sentinelReview: value.sentinelReview ?? null,
      }) as JsonRecord,
    },
  }
}

export function buildContentApprovalSnapshotPayload(input: {
  campaignId: string
  strategySnapshot: CampaignSnapshotReference
  posts: SnapshotContentPost[]
}): JsonRecord {
  const posts = input.posts
    .map((post) => {
      const content = copyDecision(post)
      return {
        postId: post.id,
        copyHash: hashCampaignSnapshotPayload(content),
        content,
      }
    })
    .sort((left, right) => left.postId.localeCompare(right.postId))

  return normalizedJson({
    schemaVersion: CAMPAIGN_SNAPSHOT_SCHEMA_VERSION,
    scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_APPROVAL,
    campaignId: input.campaignId,
    strategySnapshot: input.strategySnapshot,
    posts,
  }) as JsonRecord
}

export function buildMediaApprovalSnapshotPayload(input: {
  campaignId: string
  strategySnapshot: CampaignSnapshotReference
  copyApprovalSnapshotIds: string[]
  posts: SnapshotContentPost[]
}): JsonRecord {
  const posts = input.posts
    .map((post) => {
      const media = mediaDecision(post)
      return {
        postId: post.id,
        mediaHash: hashCampaignSnapshotPayload(media),
        media,
      }
    })
    .sort((left, right) => left.postId.localeCompare(right.postId))

  return normalizedJson({
    schemaVersion: CAMPAIGN_SNAPSHOT_SCHEMA_VERSION,
    scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_MEDIA_APPROVAL,
    campaignId: input.campaignId,
    strategySnapshot: input.strategySnapshot,
    copyApprovalSnapshotIds: [...new Set(input.copyApprovalSnapshotIds)].sort(),
    posts,
  }) as JsonRecord
}

export function buildScheduleDecisionSnapshotPayload(input: {
  campaignId: string
  strategySnapshot: CampaignSnapshotReference
  publishMode: 'MANUAL' | 'AUTO'
  posts: Array<SnapshotContentPost & {
    approvedSnapshotId: string
    mediaApprovalSnapshotId: string
    integrationId?: unknown
    pageId?: unknown
    pageName?: unknown
    platformOptions?: unknown
    autoPublishConsentAt?: unknown
  }>
}): JsonRecord {
  const posts = input.posts
    .map((post) => ({
      postId: post.id,
      approvedSnapshotId: post.approvedSnapshotId,
      mediaApprovalSnapshotId: post.mediaApprovalSnapshotId,
      contentHash: hashContentDecision(post),
      scheduledAt: post.scheduledAt instanceof Date ? post.scheduledAt.toISOString() : post.scheduledAt ?? null,
      publishMode: input.publishMode,
      destination: {
        integrationId: post.integrationId ?? null,
        pageId: post.pageId ?? null,
        pageName: post.pageName ?? null,
        publishTarget: post.publishTarget ?? post.platform ?? null,
      },
      platformOptions: post.platformOptions ?? null,
      autoPublishConsentAt: post.autoPublishConsentAt instanceof Date
        ? post.autoPublishConsentAt.toISOString()
        : post.autoPublishConsentAt ?? null,
    }))
    .sort((left, right) => left.postId.localeCompare(right.postId))

  return normalizedJson({
    schemaVersion: CAMPAIGN_SNAPSHOT_SCHEMA_VERSION,
    scope: CAMPAIGN_SNAPSHOT_SCOPE.SCHEDULE_DECISION,
    campaignId: input.campaignId,
    strategySnapshot: input.strategySnapshot,
    publishMode: input.publishMode,
    posts,
  }) as JsonRecord
}

function snapshotPostsByHash(
  payload: unknown,
  hashKey: 'copyHash' | 'mediaHash',
): Array<{ postId: string; decisionHash: string }> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const posts = (payload as JsonRecord).posts
  if (!Array.isArray(posts)) return []

  return posts.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const item = entry as JsonRecord
    return typeof item.postId === 'string' && typeof item[hashKey] === 'string'
      ? [{ postId: item.postId, decisionHash: item[hashKey] as string }]
      : []
  })
}

export function readSnapshotStrategyReference(payload: unknown): CampaignSnapshotReference | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = (payload as JsonRecord).strategySnapshot
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const reference = value as JsonRecord
  if (
    typeof reference.id !== 'string'
    || typeof reference.version !== 'number'
    || typeof reference.scope !== 'string'
    || typeof reference.payloadHash !== 'string'
  ) return null

  return {
    id: reference.id,
    version: reference.version,
    scope: reference.scope,
    payloadHash: reference.payloadHash,
  }
}

export type ContentSnapshotReview =
  | { ok: true }
  | { ok: false; code: 'CONTENT_APPROVAL_SNAPSHOT_REQUIRED' | 'CONTENT_APPROVAL_SNAPSHOT_INVALID' | 'CONTENT_CHANGED_AFTER_APPROVAL' }

export function reviewPostAgainstApprovalSnapshot(
  post: SnapshotContentPost,
  snapshot: { scope?: unknown; payload?: unknown } | null | undefined,
): ContentSnapshotReview {
  if (!snapshot) return { ok: false, code: 'CONTENT_APPROVAL_SNAPSHOT_REQUIRED' }
  if (snapshot.scope !== CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_APPROVAL) {
    return { ok: false, code: 'CONTENT_APPROVAL_SNAPSHOT_INVALID' }
  }

  const expected = snapshotPostsByHash(snapshot.payload, 'copyHash').find((entry) => entry.postId === post.id)
  if (!expected) return { ok: false, code: 'CONTENT_APPROVAL_SNAPSHOT_INVALID' }
  if (expected.decisionHash !== hashCopyDecision(post)) {
    return { ok: false, code: 'CONTENT_CHANGED_AFTER_APPROVAL' }
  }
  return { ok: true }
}

export type MediaSnapshotReview =
  | { ok: true }
  | { ok: false; code: 'MEDIA_APPROVAL_SNAPSHOT_REQUIRED' | 'MEDIA_APPROVAL_SNAPSHOT_INVALID' | 'MEDIA_CHANGED_AFTER_APPROVAL' }

export function reviewPostAgainstMediaApprovalSnapshot(
  post: SnapshotContentPost,
  snapshot: { scope?: unknown; payload?: unknown } | null | undefined,
): MediaSnapshotReview {
  if (!snapshot) return { ok: false, code: 'MEDIA_APPROVAL_SNAPSHOT_REQUIRED' }
  if (snapshot.scope !== CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_MEDIA_APPROVAL) {
    return { ok: false, code: 'MEDIA_APPROVAL_SNAPSHOT_INVALID' }
  }

  const expected = snapshotPostsByHash(snapshot.payload, 'mediaHash').find((entry) => entry.postId === post.id)
  if (!expected) return { ok: false, code: 'MEDIA_APPROVAL_SNAPSHOT_INVALID' }
  if (expected.decisionHash !== hashMediaDecision(post)) {
    return { ok: false, code: 'MEDIA_CHANGED_AFTER_APPROVAL' }
  }
  return { ok: true }
}
