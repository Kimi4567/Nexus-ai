import { createHash } from 'node:crypto'
import { guardStrategyKpis } from '@/lib/ai/strategyKpiGuard'
import { guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import { guardStrategyOutputContract } from '@/lib/ai/strategyOutputContractGuard'
import { hasUsableConversionDestination } from '@/lib/strategyBriefReadiness'

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
  brandProfile: JsonRecord | null
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

export interface SnapshotScheduledPost extends SnapshotContentPost {
  approvedSnapshotId?: unknown
  mediaApprovalSnapshotId?: unknown
  integrationId?: unknown
  pageId?: unknown
  pageName?: unknown
  platformOptions?: unknown
  autoPublishConsentAt?: unknown
  publishMode?: unknown
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
    goal?: unknown
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
    leadHandling: typeof brand.leadHandling === 'string' ? brand.leadHandling : null,
    hasConversionDestination: hasUsableConversionDestination(
      brand.conversionDestination,
      typeof input.campaign.goal === 'string' ? input.campaign.goal : null,
    ),
    conversionDestination: typeof brand.conversionDestination === 'string'
      ? brand.conversionDestination
      : null,
    allowedCompetitors: Array.isArray(brand.competitors)
      ? brand.competitors.filter((value): value is string => typeof value === 'string')
      : [],
    goal: typeof brand.businessGoal === 'string' && brand.businessGoal.trim()
      ? brand.businessGoal
      : typeof input.campaign.goal === 'string'
        ? input.campaign.goal
        : null,
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

function schedulePostDecision(
  post: SnapshotScheduledPost,
  publishMode: 'MANUAL' | 'AUTO',
): JsonRecord {
  return {
    postId: post.id,
    approvedSnapshotId: post.approvedSnapshotId ?? null,
    mediaApprovalSnapshotId: post.mediaApprovalSnapshotId ?? null,
    contentHash: hashContentDecision(post),
    scheduledAt: post.scheduledAt instanceof Date ? post.scheduledAt.toISOString() : post.scheduledAt ?? null,
    publishMode,
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
  }
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
  /**
   * The ACTIVE Campaign row already contains the exact guarded strategy that
   * was approved. Do not run today's guards over that historical decision
   * again: guard rules evolve and are not guaranteed to be idempotent across
   * releases. Snapshot verification must compare the persisted decision, not
   * reinterpret it with newer product policy.
   */
  persistedApprovedAiOutput?: boolean
}): JsonRecord {
  const aiOutput = input.persistedApprovedAiOutput
    ? normalizedJson(
        input.campaign.aiOutput && typeof input.campaign.aiOutput === 'object' && !Array.isArray(input.campaign.aiOutput)
          ? input.campaign.aiOutput
          : {},
      ) as JsonRecord
    : sanitizeStrategyApprovalAiOutput(input)

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
  const brandProfile = value.brandProfile && typeof value.brandProfile === 'object' && !Array.isArray(value.brandProfile)
    ? normalizedJson(value.brandProfile) as JsonRecord
    : null

  return {
    brandProfile,
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
  qualityOverride?: {
    explicitlyConfirmed: true
    weakMedia: Array<{
      postId: string
      contentPlanIndex: number | null
      mediaId: string
      score: number
      verdict: string
    }>
  }
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
    ...(input.qualityOverride ? { qualityOverride: input.qualityOverride } : {}),
  }) as JsonRecord
}

export function buildScheduleDecisionSnapshotPayload(input: {
  campaignId: string
  strategySnapshot: CampaignSnapshotReference
  publishMode: 'MANUAL' | 'AUTO'
  posts: Array<SnapshotScheduledPost & {
    approvedSnapshotId: string
    mediaApprovalSnapshotId: string
  }>
}): JsonRecord {
  const posts = input.posts
    .map((post) => schedulePostDecision(post, input.publishMode))
    .sort((left, right) => String(left.postId).localeCompare(String(right.postId)))

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

export type ScheduleSnapshotReview =
  | { ok: true }
  | {
      ok: false
      code:
        | 'SCHEDULE_DECISION_SNAPSHOT_REQUIRED'
        | 'SCHEDULE_DECISION_SNAPSHOT_INVALID'
        | 'SCHEDULE_CHANGED_AFTER_APPROVAL'
    }

/**
 * Verifies the exact execution decision immediately before provider submission.
 * A snapshot ID alone is not evidence: destination, time, publish mode, approved
 * revisions, provider options, and explicit consent must all still match.
 */
export function reviewPostAgainstScheduleDecisionSnapshot(
  post: SnapshotScheduledPost,
  snapshot: { scope?: unknown; payload?: unknown } | null | undefined,
): ScheduleSnapshotReview {
  if (!snapshot) return { ok: false, code: 'SCHEDULE_DECISION_SNAPSHOT_REQUIRED' }
  if (snapshot.scope !== CAMPAIGN_SNAPSHOT_SCOPE.SCHEDULE_DECISION) {
    return { ok: false, code: 'SCHEDULE_DECISION_SNAPSHOT_INVALID' }
  }
  if (!snapshot.payload || typeof snapshot.payload !== 'object' || Array.isArray(snapshot.payload)) {
    return { ok: false, code: 'SCHEDULE_DECISION_SNAPSHOT_INVALID' }
  }

  const payload = snapshot.payload as JsonRecord
  const publishMode = payload.publishMode
  if (publishMode !== 'MANUAL' && publishMode !== 'AUTO') {
    return { ok: false, code: 'SCHEDULE_DECISION_SNAPSHOT_INVALID' }
  }
  const posts = Array.isArray(payload.posts) ? payload.posts : []
  const expected = posts.find((entry) => (
    entry
    && typeof entry === 'object'
    && !Array.isArray(entry)
    && (entry as JsonRecord).postId === post.id
  ))
  if (!expected) return { ok: false, code: 'SCHEDULE_DECISION_SNAPSHOT_INVALID' }

  const currentMode = post.publishMode === 'AUTO' ? 'AUTO' : 'MANUAL'
  const actual = schedulePostDecision(post, currentMode)
  if (canonicalSnapshotJson(expected) !== canonicalSnapshotJson(actual)) {
    return { ok: false, code: 'SCHEDULE_CHANGED_AFTER_APPROVAL' }
  }
  return { ok: true }
}
