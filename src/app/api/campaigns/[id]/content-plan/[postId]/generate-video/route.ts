import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  buildCreditChargeReceipt,
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import {
  validateVideoGenerationConfirmation,
} from '@/lib/contentHubActionSafety'
import {
  getMediaStorageUnavailablePayload,
  getVideoProviderUnavailablePayload,
  isMediaStorageConfigured,
  isVideoProviderConfigured,
} from '@/lib/ai/provider'
import {
  buildCinematicProductAdBrief,
  platformToRunwayRatio,
} from '@/lib/ai/mediaProviderRouter'
import {
  createRunwayMultiShotVideoTask,
  createRunwayProductAdTask,
  retrieveRunwayTask,
  uploadRunwayVideoToCloudinary,
  type RunwayTask,
} from '@/lib/ai/runway'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { buildContentPlanTruthContext, reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'
import {
  MEDIA_REVISION_HISTORY_NOTE,
  isImmutableExecutionPost,
  mediaReviewResetData,
} from '@/lib/contentPostRevision'
import { sanitizeSentryText } from '@/lib/observability/sentryPrivacy'
import { isCronRequestAuthorized } from '@/lib/cronAuth'
import {
  cloudinaryVideoReviewFrames,
  reviewGeneratedMediaQuality,
} from '@/lib/ai/generatedMediaQuality'
import { readMediaIntelligence } from '@/lib/creativeIntelligence'
import {
  assessCinematicProductAdAssets,
  CINEMATIC_PRODUCT_AD_DURATION_SECONDS,
  CINEMATIC_PRODUCT_AD_PROVIDER_COST_USD_ESTIMATE,
  CINEMATIC_PRODUCT_AD_PROVIDER_CREDITS_ESTIMATE,
} from '@/lib/videoAdPreflight'
import { CURRENT_CREDIT_PRICING_VERSION } from '@/lib/credits/pricing'
import { evaluateVideoEconomicsGuard } from '@/lib/videoEconomicsGuard'
import {
  resolvePlatformVideoFormat,
  validatePlatformVideoFormat,
  type PlatformVideoFormat,
} from '@/lib/platformVideoFormat'
import {
  buildProfessionalCampaignFilmBrief,
  PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
  PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS,
  PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_COST_USD_ESTIMATE,
  PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_CREDITS_ESTIMATE,
  type ProfessionalCampaignFilmBrief,
} from '@/lib/professionalCampaignFilm'
import {
  renderAndPersistProfessionalCampaignFilm,
  type ProfessionalCampaignFilmCompositorUsage,
  type StoredProfessionalCampaignFilm,
} from '@/lib/professionalCampaignFilm.server'
import { isRetainedCampaignFilmRepairEligible } from '@/lib/rejectedMediaReview'
import { sourceLinkedProofStatements } from '@/lib/strategy/strategyEvidenceLedger'

// Completion includes durable video upload plus a three-frame visual review.
// Keep this server-side verification window independent from browser polling.
export const maxDuration = 180
const VIDEO_PROVIDER_ECONOMICS_VERSION = 'nexus-video-provider-estimate-2026-07-27-v2'

type Params = { params: Promise<{ id: string; postId: string }> }
const db = prisma as any
const CAMPAIGN_FILM_POST_QA_FAILURE_LIMIT = 2
const CAMPAIGN_FILM_POST_QA_FAILURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000

function isArabicLanguage(language: unknown): boolean {
  return typeof language !== 'string' || language.toLowerCase().startsWith('ar')
}

function videoStartFailureMessage(language: unknown, creditsRestored: boolean): string {
  if (isArabicLanguage(language)) {
    return creditsRestored
      ? 'تعذّر على NEXUS بدء إنتاج الفيديو لدى المزوّد. تم رد الرصيد المحجوز بالكامل، ولم يُنشأ فيديو أو يُنشر أو يُجدول شيء.'
      : 'تعذّر على NEXUS بدء إنتاج الفيديو لدى المزوّد. استرداد الرصيد المحجوز قيد المصالحة التلقائية، ولم يُنشأ فيديو أو يُنشر أو يُجدول شيء.'
  }

  return creditsRestored
    ? 'NEXUS could not start video production with the provider. The full credit reservation was restored; no video was created, published, or scheduled.'
    : 'NEXUS could not start video production with the provider. Credit restoration is pending automatic reconciliation; no video was created, published, or scheduled.'
}

async function getVideoActorUserId(req: NextRequest): Promise<string | null> {
  const delegatedUserId = req.headers.get('x-nexus-internal-user-id')?.trim()
  if (
    delegatedUserId
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(delegatedUserId)
    && isCronRequestAuthorized(req)
  ) {
    return delegatedUserId
  }
  return getServerUserId(req)
}

type StoredGenerationParams = {
  postId?: string
  postUpdatedAt?: string
  referenceMediaId?: string | null
  referenceMediaIds?: string[]
  ratio?: string
  targetFormat?: PlatformVideoFormat
  durationSeconds?: number
  productionRoute?: 'CINEMATIC_PRODUCT_AD' | 'MULTI_SHOT_CAMPAIGN_FILM'
  overlayCopy?: ProfessionalCampaignFilmBrief['overlayCopy']
  pricingVersion?: string
  providerCostEstimate?: { currency: 'USD'; amount: number; providerCredits: number }
  credit?: CreditDeductionOk
}

function generationParams(value: unknown): StoredGenerationParams {
  return value && typeof value === 'object' ? value as StoredGenerationParams : {}
}

function providerFailureCategory(task: RunwayTask): 'INPUT_SAFETY_REJECTED' | 'PROVIDER_FAILED' {
  return /SAFETY/i.test(task.failureCode || '')
    || /content moderation|safety/i.test(task.failure || '')
    ? 'INPUT_SAFETY_REJECTED'
    : 'PROVIDER_FAILED'
}

function safeFailure(task: RunwayTask, productionRoute: StoredGenerationParams['productionRoute']): string {
  console.error('[generate-video] NEXUS video provider task failed', {
    status: task.status,
    failureCode: sanitizeSentryText(task.failureCode || '').slice(0, 120),
    providerFailure: sanitizeSentryText(task.failure || '').slice(0, 300),
  })
  return providerFailureCategory(task) === 'INPUT_SAFETY_REJECTED'
    ? productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
      ? 'NEXUS stopped this campaign-film concept because it did not pass provider safety. No video was created and reserved credits will be restored.'
      : 'NEXUS stopped this product render because the source media did not pass provider safety. Use isolated product-only references or source-locked Motion Design. No video was created and reserved credits will be restored.'
    : 'NEXUS Video Studio could not create a usable video. Reserved credits will be restored.'
}

async function findCampaignContext(userId: string, campaignId: string, postId: string) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspace: { ownerId: userId } },
    include: { workspace: { include: { brandProfile: true } } },
  })
  if (!campaign) return null
  const post = await db.socialPost.findFirst({
    where: { id: postId, campaignId, workspaceId: campaign.workspaceId },
  })
  if (!post) return null
  return { campaign, post, brand: campaign.workspace?.brandProfile ?? null }
}

async function findLatestPostGeneration(campaignId: string, postId: string) {
  const rows = await db.generation.findMany({
    where: { campaignId, type: 'VIDEO', provider: 'runway' },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return rows.find((row: any) => generationParams(row.params).postId === postId) ?? null
}

function isRejectedCampaignFilmAttemptForPost(row: any, postId: string): boolean {
  const params = generationParams(row?.params)
  const metadata = generationMetadata(row?.metadata)
  return params.postId === postId
    && params.productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
    && row?.status === 'FAILED'
    && metadata.qualityStatus === 'REJECTED'
}

async function countRecentRejectedCampaignFilmAttempts(campaignId: string, postId: string): Promise<number> {
  const rows = await db.generation.findMany({
    where: {
      campaignId,
      type: 'VIDEO',
      provider: 'runway',
      status: 'FAILED',
      createdAt: { gte: new Date(Date.now() - CAMPAIGN_FILM_POST_QA_FAILURE_WINDOW_MS) },
    },
    select: { status: true, params: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return rows.filter((row: any) => isRejectedCampaignFilmAttemptForPost(row, postId)).length
}

async function refundGeneration(
  userId: string,
  generation: any,
  reason: string,
  qualityReviewUsage?: { estimatedProviderCostUsd?: number } | null,
  compositorUsage?: ProfessionalCampaignFilmCompositorUsage | null,
): Promise<'refunded' | 'pending' | 'noop'> {
  const params = generationParams(generation.params)
  const deduction = params.credit
  const isCampaignFilm = params.productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
  const estimatedVideoCost = Number(params.providerCostEstimate?.amount ?? (
    isCampaignFilm
      ? PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_COST_USD_ESTIMATE
      : CINEMATIC_PRODUCT_AD_PROVIDER_COST_USD_ESTIMATE
  ))
  const qaCost = Number(qualityReviewUsage?.estimatedProviderCostUsd)
  const compositorCost = Number(compositorUsage?.estimatedCostUsd)
  const voiceoverCost = Number(compositorUsage?.voiceover?.estimatedCostUsd)
  const providerCostUsd = Math.max(0, Number.isFinite(estimatedVideoCost) ? estimatedVideoCost : 0)
    + Math.max(0, Number.isFinite(qaCost) ? qaCost : 0)
    + Math.max(0, Number.isFinite(compositorCost) ? compositorCost : 0)
    + Math.max(0, Number.isFinite(voiceoverCost) ? voiceoverCost : 0)
  const result = await refundCreditDeduction({
    userId,
    action: 'VIDEO_GENERATION',
    deduction,
    reason,
    providerEconomics: {
      providerCostUsd,
      providerPricingVersion: VIDEO_PROVIDER_ECONOMICS_VERSION,
      providerUsage: {
        videoProvider: {
          provider: 'runway',
          productionRoute: params.productionRoute ?? null,
          estimate: params.providerCostEstimate ?? {
            currency: 'USD',
            amount: estimatedVideoCost,
            providerCredits: isCampaignFilm
              ? PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_CREDITS_ESTIMATE
              : CINEMATIC_PRODUCT_AD_PROVIDER_CREDITS_ESTIMATE,
          },
          chargeAssumption: 'conservative-full-provider-estimate; reconcile against provider invoice',
          automaticRetries: 0,
        },
        compositor: compositorUsage ?? null,
        qualityReview: qualityReviewUsage ?? null,
        customerCreditsRestored: true,
      },
    },
  })
  if (!result.ok) return 'pending'
  return result.status === 'refunded' ? 'refunded' : 'noop'
}

function generationMetadata(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function retainedProviderMasterUrl(generation: any): string | null {
  const metadata = generationMetadata(generation.metadata)
  if (typeof metadata.providerStoredUrl === 'string') {
    try {
      const parsed = new URL(metadata.providerStoredUrl)
      if (parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/video/upload/')) {
        return parsed.toString()
      }
    } catch {
      // Fall through to the deterministic Cloudinary public ID used by NEXUS.
    }
  }
  if (typeof generation.output !== 'string') return null
  try {
    const output = new URL(generation.output)
    const cloudName = output.pathname.split('/').filter(Boolean)[0]
    if (output.protocol !== 'https:' || output.hostname !== 'res.cloudinary.com' || !cloudName) return null
    return `https://res.cloudinary.com/${cloudName}/video/upload/nexus/videos/video_${encodeURIComponent(generation.id)}.mp4`
  } catch {
    return null
  }
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const productionRoute = body.productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
    ? 'MULTI_SHOT_CAMPAIGN_FILM' as const
    : 'CINEMATIC_PRODUCT_AD' as const
  const confirmation = validateVideoGenerationConfirmation({
    confirmed: body.explicitVideoGenerationConfirmed,
    acknowledgedCreditCost: body.acknowledgedCreditCost,
    acknowledgedDurationSeconds: body.acknowledgedDurationSeconds,
    acknowledgedNoPublishOrSchedule: body.acknowledgedNoPublishOrSchedule,
    acknowledgedReviewRequired: body.acknowledgedReviewRequired,
    acknowledgedAssetRights: body.acknowledgedAssetRights,
    productionRoute,
  })
  if (!confirmation.ok) {
    return NextResponse.json({
      error: confirmation.error,
      code: 'VIDEO_GENERATION_CONFIRMATION_REQUIRED',
      creditsCharged: false,
    }, { status: 400 })
  }

  const context = await findCampaignContext(userId, params.id, params.postId)
  if (!context) return NextResponse.json({ error: 'Campaign video post not found' }, { status: 404 })
  const { campaign, post, brand } = context
  if (!post.isVideoPost) {
    return NextResponse.json({ error: 'This action is available only for video posts.', code: 'VIDEO_POST_REQUIRED' }, { status: 409 })
  }
  if (isImmutableExecutionPost(post.status)) {
    return NextResponse.json({
      error: 'Published or provider-processing posts are immutable. Create a new draft for a video revision.',
      code: 'PUBLISHED_POST_IMMUTABLE',
    }, { status: 409 })
  }
  if (post.generationStatus === 'REFUND_PENDING') {
    return NextResponse.json({
      error: 'The previous video credit restoration is still pending reconciliation.',
      code: 'CREDIT_RECONCILIATION_PENDING',
    }, { status: 409 })
  }
  if (!canMutateCampaignExecution(String(campaign.status ?? ''), campaign.aiOutput, brand)) {
    return NextResponse.json({
      error: 'Approve the current strategy truth review before generating campaign video.',
      code: 'STRATEGY_TRUTH_REVIEW_REQUIRED',
      redirectTo: `/campaigns/${campaign.id}?tab=strategy`,
    }, { status: 409 })
  }

  const brandReview = reviewBrandTruthConsistency(brand)
  if (brandReview.status === 'blocked') {
    return NextResponse.json({
      error: 'Brand Brain contains contradictory source data. Correct it before generating video.',
      code: 'BRAND_TRUTH_REVIEW_REQUIRED',
      blockers: brandReview.blockers.map(item => item.code),
    }, { status: 409 })
  }

  const strategy = (campaign.aiOutput as any)?.strategy ?? {}
  const contentReview = reviewContentPlanForApproval([{
    caption: post.caption,
    imagePrompt: post.imagePrompt,
    videoPrompt: post.videoPrompt,
    contentPlanIndex: post.contentPlanIndex,
  }], strategy, buildContentPlanTruthContext(brand))
  if (!contentReview.ok) {
    return NextResponse.json({
      error: 'Fix this video post truth review before paying for media.',
      code: 'CONTENT_TRUTH_REVIEW_REQUIRED',
      issues: contentReview.issues,
    }, { status: 409 })
  }

  if (!isVideoProviderConfigured()) {
    return NextResponse.json(getVideoProviderUnavailablePayload(body.language), { status: 503 })
  }
  if (!isMediaStorageConfigured()) {
    return NextResponse.json(getMediaStorageUnavailablePayload(body.language), { status: 503 })
  }

  const active = await findLatestPostGeneration(params.id, params.postId)
  if (active && ['PENDING', 'QUEUED', 'PROCESSING'].includes(active.status)) {
    return NextResponse.json({
      error: 'A professional video is already being generated for this post.',
      code: 'VIDEO_GENERATION_IN_PROGRESS',
      generationId: active.id,
    }, { status: 409 })
  }
  if (productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM') {
    const rejectedAttempts = await countRecentRejectedCampaignFilmAttempts(params.id, params.postId)
    if (rejectedAttempts >= CAMPAIGN_FILM_POST_QA_FAILURE_LIMIT) {
      return NextResponse.json({
        error: 'Concept Film is locked for this post because repeated provider outputs failed NEXUS premium quality review. Upload an approved video asset, use source-locked Motion Design, or switch to Product Fidelity with real references before spending more credits.',
        code: 'CAMPAIGN_FILM_QUALITY_LOCKED',
        creditsCharged: false,
        providerGenerationStarted: false,
        rejectedAttempts,
        recommendedRoutes: ['UPLOAD_APPROVED_VIDEO', 'MOTION_DESIGN', 'PRODUCT_FIDELITY_WITH_REFERENCES'],
      }, { status: 409 })
    }
  }

  const requestedReferenceIds: unknown[] = Array.isArray(body.referenceMediaIds) ? body.referenceMediaIds : []
  const referenceMediaIds: string[] = requestedReferenceIds.length > 0
    ? Array.from(new Set(requestedReferenceIds
        .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
        .map(id => id.trim())))
    : []
  if (productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM' && referenceMediaIds.length > 0) {
    return NextResponse.json({
      error: 'Concept Film does not use product-reference images. Choose Product Fidelity to use real product photos, or remove the references and continue with generated concept scenes.',
      code: 'CAMPAIGN_FILM_REFERENCE_UNSUPPORTED',
      creditsCharged: false,
      providerGenerationStarted: false,
    }, { status: 400 })
  }
  const referenceMediaRows = referenceMediaIds.length > 0
    ? await db.media.findMany({
        where: {
          id: { in: referenceMediaIds },
          workspaceId: campaign.workspaceId,
          type: 'IMAGE',
          OR: [{ campaignId: null }, { campaignId: params.id }],
        },
        select: {
          id: true,
          url: true,
          fileName: true,
          type: true,
          width: true,
          height: true,
          intelligenceStatus: true,
          intelligence: true,
        },
      })
    : []
  const referenceById = new Map(referenceMediaRows.map((media: any) => [media.id, media]))
  const referenceMedia = referenceMediaIds
    .map(id => referenceById.get(id))
    .filter(Boolean) as Array<{
    id: string
    url: string
    fileName: string
    type: string
    width: number | null
    height: number | null
    intelligenceStatus: string
    intelligence: unknown
  }>
  if (referenceMedia.length !== referenceMediaIds.length) {
    return NextResponse.json({
      error: 'One or more selected product references were not found in this workspace or campaign.',
      code: 'REFERENCE_MEDIA_NOT_FOUND',
      creditsCharged: false,
    }, { status: 404 })
  }

  const preflight = productionRoute === 'CINEMATIC_PRODUCT_AD'
    ? assessCinematicProductAdAssets(referenceMedia)
    : null
  if (preflight && !preflight.eligible) {
    const motionDesignRequired = preflight.route === 'MOTION_DESIGN_REQUIRED'
    return NextResponse.json({
      error: motionDesignRequired
        ? 'These assets contain screens, interfaces, demos, or logos. Cinematic generation is blocked because it can distort them; use the source-locked Motion Design route when it is available.'
        : 'The selected product references did not pass paid video preflight. No credits were spent.',
      code: motionDesignRequired ? 'MOTION_DESIGN_REQUIRED' : 'VIDEO_ASSET_PREFLIGHT_FAILED',
      creditsCharged: false,
      preflight,
    }, { status: 422 })
  }

  const recentWorkspaceVideoAttempts = await db.generation.findMany({
    where: {
      type: 'VIDEO',
      provider: 'runway',
      campaign: { workspaceId: campaign.workspaceId },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000) },
    },
    select: { status: true, externalId: true, params: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const economicsGuard = evaluateVideoEconomicsGuard(recentWorkspaceVideoAttempts)
  if (economicsGuard.paused) {
    return NextResponse.json({
      error: 'Cinematic video production is temporarily paused because recent provider or quality failures exceeded the workspace loss limit. No credits were spent.',
      code: 'VIDEO_ECONOMICS_PAUSED',
      creditsCharged: false,
      economicsGuard,
    }, { status: 503 })
  }

  const productAdBrief = buildCinematicProductAdBrief({
    brandName: brand?.brandName || campaign.name,
    description: brand?.description,
    primaryOffer: brand?.primaryOffer,
    verifiedProof: sourceLinkedProofStatements(brand?.verifiedProof),
    uniqueAdvantages: brand?.uniqueAdvantages,
    caption: post.caption,
    videoDirection: post.videoPrompt,
    industry: brand?.industry,
    toneWords: brand?.toneKeywords,
  })
  const campaignFilmBrief = buildProfessionalCampaignFilmBrief({
    brandName: brand?.brandName || campaign.name,
    description: brand?.description,
    primaryOffer: brand?.primaryOffer,
    caption: post.caption,
    videoDirection: post.videoPrompt,
    industry: brand?.industry,
  })
  const durationSeconds = productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
    ? PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS
    : CINEMATIC_PRODUCT_AD_DURATION_SECONDS
  const targetFormat = {
    ...resolvePlatformVideoFormat(post.publishTarget || post.platform),
    durationSeconds,
  }
  const ratio = platformToRunwayRatio(targetFormat.platform, true)
  const providerCostEstimate = productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
    ? {
        currency: 'USD',
        amount: PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_COST_USD_ESTIMATE,
        providerCredits: PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_CREDITS_ESTIMATE,
      }
    : {
        currency: 'USD',
        amount: CINEMATIC_PRODUCT_AD_PROVIDER_COST_USD_ESTIMATE,
        providerCredits: CINEMATIC_PRODUCT_AD_PROVIDER_CREDITS_ESTIMATE,
      }
  const generation = await db.generation.create({
    data: {
      campaignId: params.id,
      type: 'VIDEO',
      prompt: productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
        ? campaignFilmBrief.creativeDirection
        : productAdBrief.userConcept,
      params: {
        postId: params.postId,
        postUpdatedAt: post.updatedAt.toISOString(),
        referenceMediaId: referenceMedia[0]?.id ?? null,
        referenceMediaIds: referenceMedia.map(media => media.id),
        ratio,
        targetFormat,
        durationSeconds,
        productionRoute,
        overlayCopy: productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
          ? campaignFilmBrief.overlayCopy
          : undefined,
        pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
        providerCostEstimate,
        automaticProviderRetries: 0,
      },
      status: 'PENDING',
      provider: 'runway',
    },
  })

  const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'VIDEO_GENERATION')
  if (rateLimitResponse) {
    await db.generation.update({ where: { id: generation.id }, data: { status: 'FAILED', error: 'Rate limit reached before provider execution.' } })
    return rateLimitResponse
  }

  const credit = await checkAndDeductCredits(userId, 'VIDEO_GENERATION', undefined, {
    entityId: post.id,
    entityType: 'social_post_video',
    operationKey: getCreditOperationKey(req, 'VIDEO_GENERATION', 'social_post_video', post.id),
    description: productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
      ? `Ten-second professional three-shot campaign film with sound and branded typography — post #${post.contentPlanIndex ?? post.id}`
      : `Eight-second cinematic product ad from ${referenceMedia.length} qualified product angles — post #${post.contentPlanIndex ?? post.id}`,
  })
  if (!credit.ok) {
    await db.generation.update({ where: { id: generation.id }, data: { status: 'FAILED', error: 'Credits were unavailable before provider execution.' } })
    return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
  }

  try {
    const task = productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
      ? await createRunwayMultiShotVideoTask({
          shots: campaignFilmBrief.shots,
          ratio,
          duration: PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS,
          audio: true,
        })
      : await createRunwayProductAdTask({
          productImages: referenceMedia.map(media => media.url),
          productInfo: productAdBrief.productInfo,
          userConcept: productAdBrief.userConcept,
          ratio,
          duration: CINEMATIC_PRODUCT_AD_DURATION_SECONDS,
        })
    const generatingPost = await db.socialPost.update({
      where: { id: post.id },
      data: { generationStatus: 'GENERATING', errorMessage: null },
      select: { updatedAt: true },
    })
    const nextParams = {
      ...generationParams(generation.params),
      postUpdatedAt: generatingPost.updatedAt.toISOString(),
      credit,
    }
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: task.status === 'THROTTLED' ? 'QUEUED' : 'PROCESSING',
        progress: 1,
        externalId: task.id,
        params: nextParams,
      },
    })

    return NextResponse.json({
      generationId: generation.id,
      status: task.status,
      durationSeconds,
      productionRoute,
      ratio,
      creditsReserved: credit.creditsUsed,
      creditsUsed: 0,
      creditsRemaining: credit.creditsRemaining,
      creditsCharged: false,
      creditReservation: {
        action: 'VIDEO_GENERATION',
        creditsReserved: credit.creditsUsed,
        creditsRemaining: credit.creditsRemaining,
        transactionId: credit.transactionId ?? null,
        operationStatus: 'RESERVED',
      },
      reviewRequired: true,
      published: false,
      scheduled: false,
    }, { status: 202 })
  } catch (error) {
    const internalMessage = sanitizeSentryText(error instanceof Error ? error.message : 'Video generation failed').slice(0, 500)
    console.error('[generate-video] NEXUS Video Studio start failed', internalMessage)
    const refundReason = isArabicLanguage(body.language)
      ? 'تعذّر بدء إنتاج الفيديو لدى المزوّد قبل إنشاء أي أصل.'
      : 'The video provider rejected production before any asset was created.'
    const refund = await refundCreditDeduction({
      userId,
      action: 'VIDEO_GENERATION',
      deduction: credit,
      reason: refundReason,
    })
    const message = videoStartFailureMessage(body.language, refund.ok)
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', error: message, params: { ...generationParams(generation.params), credit } },
    })
    await db.socialPost.update({
      where: { id: post.id },
      data: { generationStatus: refund.ok ? 'FAILED' : 'REFUND_PENDING', errorMessage: message },
    })
    return NextResponse.json({
      error: message,
      code: 'VIDEO_PROVIDER_START_FAILED',
      refunded: refund.ok && refund.status === 'refunded',
      creditsRestored: refund.ok,
      refundPending: !refund.ok,
      creditsCharged: false,
      providerGenerationStarted: false,
    }, { status: 502 })
  }
}

/**
 * Re-composes a campaign film after a NEXUS compositor defect or upgrade. It
 * reuses the retained provider master, makes no generative-video provider
 * request, consumes no user credits, and is allowed once per corrected
 * compositor version. A completed legacy attachment remains untouched unless
 * the replacement passes the same premium QA gate.
 */
export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (body.explicitRetainedRepairConfirmed !== true || body.acknowledgedNoProviderGeneration !== true) {
    return NextResponse.json({
      error: 'Explicit retained-footage repair confirmation is required.',
      code: 'RETAINED_REPAIR_CONFIRMATION_REQUIRED',
      creditsCharged: false,
      providerGenerationStarted: false,
    }, { status: 400 })
  }

  const context = await findCampaignContext(userId, params.id, params.postId)
  if (!context) return NextResponse.json({ error: 'Campaign video post not found' }, { status: 404 })
  if (isImmutableExecutionPost(context.post.status)) {
    return NextResponse.json({ error: 'Published or provider-processing posts cannot be repaired in place.' }, { status: 409 })
  }

  const generation = await findLatestPostGeneration(params.id, params.postId)
  if (!generation || generation.id !== body.generationId || !isRetainedCampaignFilmRepairEligible(generation)) {
    return NextResponse.json({
      error: 'This output is not eligible for the one-time retained-footage repair.',
      code: 'RETAINED_REPAIR_NOT_ELIGIBLE',
      creditsCharged: false,
      providerGenerationStarted: false,
    }, { status: 409 })
  }

  const sourceUrl = retainedProviderMasterUrl(generation)
  if (!sourceUrl) {
    return NextResponse.json({
      error: 'The retained provider master is unavailable; no repair was attempted.',
      code: 'RETAINED_MASTER_UNAVAILABLE',
      creditsCharged: false,
      providerGenerationStarted: false,
    }, { status: 409 })
  }

  const wasCompleted = generation.status === 'COMPLETED'
  const claim = await db.generation.updateMany({
    where: { id: generation.id, status: generation.status, progress: 100 },
    data: { progress: 98 },
  })
  if (claim.count !== 1) {
    return NextResponse.json({
      error: 'This retained-footage repair is already running or was already used.',
      code: 'RETAINED_REPAIR_ALREADY_CLAIMED',
      creditsCharged: false,
      providerGenerationStarted: false,
    }, { status: 409 })
  }

  const attemptedAt = new Date().toISOString()
  const priorMetadata = generationMetadata(generation.metadata)
  await db.generation.update({
    where: { id: generation.id },
    data: { metadata: {
      ...priorMetadata,
      compositorRepairAttemptedAt: attemptedAt,
      compositorRepairStatus: 'PROCESSING',
      compositorRepairVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
    } },
  })

  try {
    const brief = buildProfessionalCampaignFilmBrief({
      brandName: context.brand?.brandName || context.campaign.name,
      description: context.brand?.description,
      primaryOffer: context.brand?.primaryOffer,
      caption: context.post.caption,
      videoDirection: context.post.videoPrompt,
      industry: context.brand?.industry,
    })
    const storedParams = generationParams(generation.params)
    const targetFormat = storedParams.targetFormat
      ?? {
        ...resolvePlatformVideoFormat(context.post.publishTarget || context.post.platform),
        durationSeconds: PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS,
      }
    const stored = await renderAndPersistProfessionalCampaignFilm({
      sourceUrl,
      target: targetFormat,
      generationId: generation.id,
      storageKey: `${generation.id}_compositor_${PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      overlayCopy: brief.overlayCopy,
    })
    const formatValidation = validatePlatformVideoFormat({
      width: stored.width,
      height: stored.height,
      durationSeconds: stored.duration,
      contentType: `video/${stored.format}`,
    }, targetFormat)
    const qualityReview = await reviewGeneratedMediaQuality({
      mediaType: 'VIDEO',
      outputFrames: cloudinaryVideoReviewFrames(stored.url, stored.duration ?? PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS),
      campaignMessage: context.post.caption,
      creativeDirection: context.post.videoPrompt,
      referenceEvidence: [],
      targetFormat,
      formatValidation,
      requireProductAdStructure: true,
      requiresRealProductHero: false,
      qualityStandard: 'PREMIUM',
      approvedOverlayTexts: [
        brief.overlayCopy.brand,
        brief.overlayCopy.hook,
        brief.overlayCopy.benefit,
        brief.overlayCopy.cta,
      ],
    })
    const repairQaCost = Number(qualityReview.providerUsage?.estimatedProviderCostUsd)
    const repairCompositorCost = Number(stored.compositorUsage?.estimatedCostUsd)
    const repairVoiceoverCost = Number(stored.compositorUsage?.voiceover?.estimatedCostUsd)
    const repairProviderCostUsd = Math.max(0, Number.isFinite(repairQaCost) ? repairQaCost : 0)
      + Math.max(0, Number.isFinite(repairCompositorCost) ? repairCompositorCost : 0)
      + Math.max(0, Number.isFinite(repairVoiceoverCost) ? repairVoiceoverCost : 0)
    const compositorRepairProviderUsage = {
      providerCostUsd: Number(repairProviderCostUsd.toFixed(6)),
      compositor: stored.compositorUsage,
      qualityReview: qualityReview.providerUsage ?? null,
      videoProvider: null,
    }

    if (!qualityReview.passed) {
      const message = 'NEXUS repaired the retained typography without a new provider request, but the result still did not pass premium advertising review. No credits were charged.'
      if (wasCompleted) {
        await db.generation.update({
          where: { id: generation.id },
          data: {
            status: 'COMPLETED',
            progress: 100,
            output: generation.output,
            error: generation.error,
            metadata: {
              ...priorMetadata,
              compositorRepairAttemptedAt: attemptedAt,
              compositorRepairStatus: 'REJECTED',
              compositorRepairVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
              compositorRepairQualityReview: qualityReview,
              compositorRepairUsage: stored.compositorUsage,
              compositorRepairProviderUsage,
            },
          },
        })
        return NextResponse.json({
          status: 'FAILED',
          generationId: generation.id,
          error: message,
          retainedAttachmentPreserved: true,
          creditsUsed: 0,
          creditsCharged: false,
          providerGenerationStarted: false,
        }, { status: 422 })
      }
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          progress: 100,
          output: stored.url,
          error: message,
          metadata: {
            ...priorMetadata,
            durationSeconds: stored.duration ?? PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS,
            reviewRequired: true,
            qualityStatus: 'REJECTED',
            qualityReview,
            retainedForAudit: true,
            typographyRepairAttemptedAt: attemptedAt,
            typographyRepairStatus: 'REJECTED',
            compositorRepairAttemptedAt: attemptedAt,
            compositorRepairStatus: 'REJECTED',
            compositorRepairVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
            compositorVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
            compositorUsage: stored.compositorUsage,
            compositorRepairProviderUsage,
          },
        },
      })
      await db.socialPost.update({
        where: { id: params.postId },
        data: { generationStatus: 'FAILED', errorMessage: message },
      })
      return NextResponse.json({
        status: 'FAILED',
        generationId: generation.id,
        error: message,
        creditsUsed: 0,
        creditsCharged: false,
        providerGenerationStarted: false,
      }, { status: 422 })
    }

    const existingMedia = await db.media.findFirst({
      where: { workspaceId: context.campaign.workspaceId, cloudinaryId: stored.publicId },
    })
    const mediaData = {
        workspaceId: context.campaign.workspaceId,
        campaignId: params.id,
        fileName: `${context.campaign.name || 'campaign'}-video-${generation.id}.${stored.format}`,
        type: 'VIDEO',
        mimeType: `video/${stored.format}`,
        url: stored.url,
        cloudinaryId: stored.publicId,
        size: stored.bytes,
        width: stored.width,
        height: stored.height,
        duration: stored.duration,
        category: 'professional-campaign-film-master',
        tags: ['nexus-video-studio', 'professional-campaign-film', 'multi-shot', 'branded-typography', 'retained-repair', 'review-required'],
    }
    const media = existingMedia
      ? await db.media.update({ where: { id: existingMedia.id }, data: mediaData })
      : await db.media.create({ data: mediaData })

    const currentPost = await db.socialPost.findUnique({ where: { id: params.postId } })
    if (!currentPost || isImmutableExecutionPost(currentPost.status)) {
      throw new Error('The post changed to an immutable execution state during retained-footage repair')
    }
    const mediaReset = mediaReviewResetData(currentPost)
    const nextStatus = typeof mediaReset.status === 'string' ? mediaReset.status : currentPost.status
    const reopen = nextStatus !== currentPost.status
    await db.$transaction(async (tx: any) => {
      await tx.socialPost.update({
        where: { id: params.postId },
        data: {
          imageUrl: stored.url,
          sourceMediaId: media.id,
          sourceType: 'AI_GENERATED',
          uploadedMediaId: null,
          mediaSource: 'GENERATE',
          generationStatus: 'DONE',
          errorMessage: null,
          ...mediaReset,
        },
      })
      if (reopen) {
        await tx.postStatusHistory.create({
          data: {
            socialPostId: currentPost.id,
            workspaceId: currentPost.workspaceId,
            fromStatus: currentPost.status,
            toStatus: nextStatus,
            actor: 'SYSTEM',
            note: `${MEDIA_REVISION_HISTORY_NOTE} Retained campaign footage was re-composed after a NEXUS typography defect; no provider generation was started.`,
          },
        })
      }
    })
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        output: stored.url,
        error: null,
        metadata: {
          ...priorMetadata,
          model: 'multi-shot-video-2026-06',
          productionRoute: 'MULTI_SHOT_CAMPAIGN_FILM',
          mediaId: media.id,
          durationSeconds: stored.duration ?? PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS,
          reviewRequired: true,
          attached: true,
          qualityStatus: 'PASSED',
          qualityReview,
          retainedForAudit: false,
          typographyRepairAttemptedAt: attemptedAt,
          typographyRepairStatus: 'PASSED',
          compositorRepairAttemptedAt: attemptedAt,
          compositorRepairStatus: 'PASSED',
          compositorRepairVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
          compositorVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
          compositorUsage: stored.compositorUsage,
          compositorRepairProviderUsage,
        },
      },
    })

    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: generation.id,
      output: stored.url,
      mediaId: media.id,
      attached: true,
      reviewRequired: true,
      creditsUsed: 0,
      creditsCharged: false,
      providerGenerationStarted: false,
      published: false,
      scheduled: false,
    })
  } catch (error) {
    const internalMessage = sanitizeSentryText(error instanceof Error ? error.message : 'Retained campaign-film repair failed').slice(0, 500)
    console.error('[generate-video] retained campaign-film repair failed', internalMessage)
    const message = 'NEXUS could not complete the retained-footage repair. No credits were charged and no provider generation was started.'
    await db.generation.update({
      where: { id: generation.id },
      data: wasCompleted
        ? {
            status: 'COMPLETED',
            progress: 100,
            output: generation.output,
            error: generation.error,
            metadata: {
              ...priorMetadata,
              compositorRepairAttemptedAt: attemptedAt,
              compositorRepairStatus: 'ERROR',
              compositorRepairVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
            },
          }
        : {
            status: 'FAILED',
            progress: 100,
            error: message,
            metadata: {
              ...priorMetadata,
              typographyRepairAttemptedAt: attemptedAt,
              typographyRepairStatus: 'ERROR',
              compositorRepairAttemptedAt: attemptedAt,
              compositorRepairStatus: 'ERROR',
              compositorRepairVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
              compositorVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
            },
          },
    }).catch(() => undefined)
    if (!wasCompleted) {
      await db.socialPost.update({
        where: { id: params.postId },
        data: { generationStatus: 'FAILED', errorMessage: message },
      }).catch(() => undefined)
    }
    return NextResponse.json({
      error: message,
      code: 'RETAINED_REPAIR_FAILED',
      retainedAttachmentPreserved: wasCompleted,
      creditsUsed: 0,
      creditsCharged: false,
      providerGenerationStarted: false,
    }, { status: 502 })
  }
}

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getVideoActorUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const context = await findCampaignContext(userId, params.id, params.postId)
  if (!context) return NextResponse.json({ error: 'Campaign video post not found' }, { status: 404 })

  const generation = await findLatestPostGeneration(params.id, params.postId)
  if (!generation) return NextResponse.json({ status: 'NOT_STARTED', generation: null })
  if (generation.status === 'COMPLETED') {
    const settledCredit = generationParams(generation.params).credit
    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: generation.id,
      output: generation.output,
      mediaId: (generation.metadata as any)?.mediaId ?? null,
      attached: (generation.metadata as any)?.attached === true,
      reviewRequired: true,
      creditsUsed: settledCredit?.creditsUsed ?? 0,
      creditsCharged: Boolean(settledCredit),
      creditCharge: settledCredit
        ? buildCreditChargeReceipt('VIDEO_GENERATION', settledCredit)
        : null,
    })
  }
  if (['FAILED', 'CANCELLED'].includes(generation.status) || !generation.externalId) {
    return NextResponse.json({ status: generation.status, generationId: generation.id, error: generation.error })
  }

  let task: RunwayTask
  try {
    task = await retrieveRunwayTask(generation.externalId)
  } catch {
    return NextResponse.json({
      status: 'PROCESSING',
      generationId: generation.id,
      retryable: true,
      message: 'NEXUS Video Studio status is temporarily unavailable; the task remains active.',
    }, { status: 202 })
  }

  if (['PENDING', 'THROTTLED', 'RUNNING'].includes(task.status)) {
    const status = task.status === 'THROTTLED' ? 'QUEUED' : 'PROCESSING'
    const progress = typeof task.progress === 'number'
      ? Math.max(1, Math.min(95, Math.round(task.progress * (task.progress <= 1 ? 100 : 1))))
      : generation.progress
    await db.generation.update({ where: { id: generation.id }, data: { status, progress } })
    return NextResponse.json({ status: task.status, generationId: generation.id, progress }, { status: 202 })
  }

  if (['FAILED', 'CANCELED', 'CANCELLED'].includes(task.status)) {
    const message = safeFailure(task, generationParams(generation.params).productionRoute)
    const failureCategory = providerFailureCategory(task)
    const refund = await refundGeneration(userId, generation, message)
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: task.status === 'FAILED' ? 'FAILED' : 'CANCELLED',
        error: message,
        metadata: {
          providerTaskId: task.id,
          providerFailureCategory: failureCategory,
          providerFailureCode: sanitizeSentryText(task.failureCode || '').slice(0, 120) || null,
          providerOutputCreated: false,
          reviewRequired: true,
        },
      },
    })
    await db.socialPost.update({
      where: { id: params.postId },
      data: { generationStatus: refund === 'pending' ? 'REFUND_PENDING' : 'FAILED', errorMessage: message },
    })
    return NextResponse.json({
      status: task.status,
      generationId: generation.id,
      error: message,
      refunded: refund === 'refunded',
      refundPending: refund === 'pending',
      failureCategory,
    })
  }

  const providerUrl = task.output?.[0]
  if (task.status !== 'SUCCEEDED' || !providerUrl) {
    return NextResponse.json({ status: 'PROCESSING', generationId: generation.id }, { status: 202 })
  }

  // Only one poller may persist and review a successful provider result. A
  // stale claim can be recovered after two minutes if a worker terminates.
  const verificationClaim = await db.generation.updateMany({
    where: {
      id: generation.id,
      status: { in: ['PROCESSING', 'QUEUED'] },
      OR: [
        { progress: { lt: 99 } },
        { updatedAt: { lt: new Date(Date.now() - 120_000) } },
      ],
    },
    data: { progress: 99 },
  })
  if (verificationClaim.count !== 1) {
    return NextResponse.json({
      status: 'PROCESSING',
      generationId: generation.id,
      progress: 99,
      message: 'NEXUS is verifying and storing the completed video.',
    }, { status: 202 })
  }

  let compositorUsage: ProfessionalCampaignFilmCompositorUsage | null = null
  try {
    const providerStored = await uploadRunwayVideoToCloudinary(providerUrl, generation.id)
    const storedParams = generationParams(generation.params)
    const productionRoute = storedParams.productionRoute ?? 'CINEMATIC_PRODUCT_AD'
    const isCampaignFilm = productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'
    const expectedDurationSeconds = storedParams.durationSeconds ?? CINEMATIC_PRODUCT_AD_DURATION_SECONDS
    if (isCampaignFilm && !storedParams.overlayCopy) {
      throw new Error('The approved campaign-film typography contract is unavailable')
    }
    const targetFormat = storedParams.targetFormat
      ?? {
        ...resolvePlatformVideoFormat(context.post.publishTarget || context.post.platform),
        durationSeconds: expectedDurationSeconds,
      }
    const stored = isCampaignFilm
      ? await renderAndPersistProfessionalCampaignFilm({
          sourceUrl: providerStored.url,
          target: targetFormat,
          generationId: generation.id,
          overlayCopy: storedParams.overlayCopy!,
        })
      : providerStored
    compositorUsage = isCampaignFilm
      ? (stored as StoredProfessionalCampaignFilm).compositorUsage
      : null
    const qaReferenceMedia = storedParams.referenceMediaId
      ? await db.media.findFirst({
          where: {
            id: storedParams.referenceMediaId,
            workspaceId: context.campaign.workspaceId,
            type: { in: ['IMAGE', 'LOGO'] },
          },
          select: { id: true, url: true, intelligenceStatus: true, intelligence: true },
        })
      : null
    if (storedParams.referenceMediaId && !qaReferenceMedia) {
      throw new Error('The reference image is no longer available for required fidelity review')
    }
    const qaReferenceRows = storedParams.referenceMediaIds?.length
      ? await db.media.findMany({
          where: {
            id: { in: storedParams.referenceMediaIds },
            workspaceId: context.campaign.workspaceId,
            type: 'IMAGE',
          },
          select: { id: true, url: true, intelligenceStatus: true, intelligence: true },
        })
      : qaReferenceMedia ? [qaReferenceMedia] : []
    const qaReferencesById = new Map(qaReferenceRows.map((media: any) => [media.id, media]))
    const orderedQaReferences = storedParams.referenceMediaIds?.length
      ? storedParams.referenceMediaIds.map(id => qaReferencesById.get(id)).filter(Boolean)
      : qaReferenceMedia ? [qaReferenceMedia] : []
    if ((storedParams.referenceMediaIds?.length ?? 0) > 0 && orderedQaReferences.length !== storedParams.referenceMediaIds?.length) {
      throw new Error('One or more product references are no longer available for required fidelity review')
    }
    const referenceEvidence = orderedQaReferences.map((media: any) => (
      media.intelligenceStatus === 'READY' ? readMediaIntelligence(media.intelligence) : null
    )).filter(Boolean)
    const formatValidation = validatePlatformVideoFormat({
      width: stored.width,
      height: stored.height,
      durationSeconds: stored.duration,
      contentType: `video/${stored.format}`,
    }, targetFormat)
    const qualityReview = await reviewGeneratedMediaQuality({
      mediaType: 'VIDEO',
      outputFrames: cloudinaryVideoReviewFrames(stored.url, stored.duration ?? expectedDurationSeconds),
      referenceImageUrl: qaReferenceMedia?.url,
      referenceImageUrls: orderedQaReferences.map((media: any) => media.url),
      campaignMessage: context.post.caption,
      creativeDirection: context.post.videoPrompt,
      referenceEvidence,
      targetFormat,
      formatValidation,
      requireProductAdStructure: true,
      requiresRealProductHero: !isCampaignFilm,
      qualityStandard: 'PREMIUM',
      approvedOverlayTexts: isCampaignFilm && storedParams.overlayCopy
        ? [
            storedParams.overlayCopy.brand,
            storedParams.overlayCopy.hook,
            storedParams.overlayCopy.benefit,
            storedParams.overlayCopy.cta,
          ]
        : [],
    })
    if (!qualityReview.passed) {
      const message = 'NEXUS quality review rejected this video because it did not meet the approved creative and platform-delivery requirements. Credits will be restored.'
      const refund = await refundGeneration(
        userId,
        generation,
        message,
        qualityReview.providerUsage ?? null,
        compositorUsage,
      )
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          progress: 100,
          output: stored.url,
          error: message,
          metadata: {
            providerTaskId: task.id,
            providerStoredUrl: providerStored.url,
            providerStoredPublicId: providerStored.publicId,
            durationSeconds: stored.duration ?? expectedDurationSeconds,
            reviewRequired: true,
            qualityStatus: 'REJECTED',
            qualityReview,
            retainedForAudit: true,
            compositorVersion: isCampaignFilm ? PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION : null,
            compositorUsage,
          },
        },
      })
      await db.socialPost.update({
        where: { id: params.postId },
        data: {
          generationStatus: refund === 'pending' ? 'REFUND_PENDING' : 'FAILED',
          errorMessage: message,
        },
      })
      return NextResponse.json({
        status: 'FAILED',
        generationId: generation.id,
        error: message,
        refunded: refund === 'refunded',
        refundPending: refund === 'pending',
      })
    }

    const existingMedia = await db.media.findFirst({
      where: { workspaceId: context.campaign.workspaceId, cloudinaryId: stored.publicId },
    })
    const media = existingMedia ?? await db.media.create({
      data: {
        workspaceId: context.campaign.workspaceId,
        campaignId: params.id,
        fileName: `${context.campaign.name || 'campaign'}-video-${generation.id}.${stored.format}`,
        type: 'VIDEO',
        mimeType: `video/${stored.format}`,
        url: stored.url,
        cloudinaryId: stored.publicId,
        size: stored.bytes,
        width: stored.width,
        height: stored.height,
        duration: stored.duration,
        category: isCampaignFilm ? 'professional-campaign-film-master' : 'cinematic-product-ad-master',
        tags: isCampaignFilm
          ? ['nexus-video-studio', 'professional-campaign-film', 'multi-shot', 'branded-typography', 'review-required']
          : ['nexus-video-studio', 'cinematic-product-ad', 'multi-reference', 'review-required'],
      },
    })

    // Provider acceptance is not a billable result. Settle only after the
    // video is durably stored and has passed NEXUS quality review. If the
    // reservation was already reconciled or settlement fails, retain the
    // output for audit but never attach or expose it as a completed delivery.
    const settledCredit = generationParams(generation.params).credit
    const videoProviderCost = Number(storedParams.providerCostEstimate?.amount ?? (
      isCampaignFilm
        ? PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_COST_USD_ESTIMATE
        : CINEMATIC_PRODUCT_AD_PROVIDER_COST_USD_ESTIMATE
    ))
    const qualityReviewCost = Number(qualityReview.providerUsage?.estimatedProviderCostUsd)
    const compositorCost = Number(compositorUsage?.estimatedCostUsd)
    const voiceoverCost = Number(compositorUsage?.voiceover?.estimatedCostUsd)
    const providerCostUsd = Math.max(0, Number.isFinite(videoProviderCost) ? videoProviderCost : 0)
      + Math.max(0, Number.isFinite(qualityReviewCost) ? qualityReviewCost : 0)
      + Math.max(0, Number.isFinite(compositorCost) ? compositorCost : 0)
      + Math.max(0, Number.isFinite(voiceoverCost) ? voiceoverCost : 0)
    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'VIDEO_GENERATION',
      deduction: settledCredit,
      settlementEntityId: media.id,
      settlementEntityType: 'media_video',
      providerEconomics: {
        providerCostUsd,
        providerPricingVersion: VIDEO_PROVIDER_ECONOMICS_VERSION,
        providerUsage: {
          videoProvider: {
            provider: 'runway',
            productionRoute,
            estimate: storedParams.providerCostEstimate ?? {
              currency: 'USD',
              amount: videoProviderCost,
              providerCredits: isCampaignFilm
                ? PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_CREDITS_ESTIMATE
                : CINEMATIC_PRODUCT_AD_PROVIDER_CREDITS_ESTIMATE,
            },
            automaticRetries: 0,
          },
          compositor: compositorUsage,
          qualityReview: qualityReview.providerUsage ?? null,
        },
      },
    })
    if (!finalization.ok) {
      const refundPending = finalization.refundStatus === 'failed'
      const message = refundPending
        ? 'NEXUS produced a reviewable video but could not reconcile its credit reservation. The output is quarantined while credit restoration is retried.'
        : 'NEXUS produced a reviewable video but could not finalize its credit reservation. The reservation was restored and the output was not attached.'
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          progress: 100,
          output: stored.url,
          error: message,
          metadata: {
            model: isCampaignFilm ? 'multi-shot-video-2026-06' : 'product-ad-2026-06',
            productionRoute,
            providerTaskId: task.id,
            mediaId: media.id,
            durationSeconds: stored.duration ?? expectedDurationSeconds,
            reviewRequired: true,
            qualityStatus: 'PASSED',
            qualityReview,
            creditFinalizationStatus: 'FAILED',
            retainedForAudit: true,
            attached: false,
            compositorVersion: isCampaignFilm ? PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION : null,
            compositorUsage,
          },
        },
      })
      await db.socialPost.update({
        where: { id: params.postId },
        data: {
          generationStatus: refundPending ? 'REFUND_PENDING' : 'FAILED',
          errorMessage: message,
        },
      })
      return NextResponse.json({
        error: message,
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
        refundPending,
        creditsCharged: false,
      }, { status: 503 })
    }

    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        output: stored.url,
        metadata: {
          model: isCampaignFilm ? 'multi-shot-video-2026-06' : 'product-ad-2026-06',
          productionRoute,
          providerTaskId: task.id,
          mediaId: media.id,
          durationSeconds: stored.duration ?? expectedDurationSeconds,
          reviewRequired: true,
          qualityStatus: 'PASSED',
          qualityReview,
          creditFinalizationStatus: finalization.status.toUpperCase(),
          compositorVersion: isCampaignFilm ? PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION : null,
          compositorUsage,
        },
      },
    })

    const currentPost = await db.socialPost.findUnique({ where: { id: params.postId } })
    const started = generationParams(generation.params)
    const revisionStillCurrent = currentPost
      && currentPost.updatedAt.toISOString() === started.postUpdatedAt
      && !isImmutableExecutionPost(currentPost.status)

    if (!revisionStillCurrent) {
      await db.generation.update({
        where: { id: generation.id },
        data: { metadata: {
          model: isCampaignFilm ? 'multi-shot-video-2026-06' : 'product-ad-2026-06', productionRoute, providerTaskId: task.id, mediaId: media.id,
          durationSeconds: stored.duration ?? expectedDurationSeconds, reviewRequired: true, attached: false,
          qualityStatus: 'PASSED', qualityReview,
          creditFinalizationStatus: finalization.status.toUpperCase(),
          compositorVersion: isCampaignFilm ? PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION : null,
          compositorUsage,
        } },
      })
      await db.socialPost.update({
        where: { id: params.postId },
        data: {
          generationStatus: 'AWAITING_UPLOAD',
          errorMessage: 'The generated video is in Media Library; the post changed before attachment.',
        },
      })
      return NextResponse.json({
        status: 'SUCCEEDED',
        generationId: generation.id,
        output: stored.url,
        mediaId: media.id,
        attached: false,
        reviewRequired: true,
        creditsUsed: settledCredit?.creditsUsed ?? 0,
        creditsCharged: Boolean(settledCredit),
        creditCharge: settledCredit
          ? buildCreditChargeReceipt('VIDEO_GENERATION', settledCredit)
          : null,
        message: 'The video is saved in Media Library, but the post changed while it was rendering, so NEXUS did not overwrite the newer revision.',
      })
    }

    const mediaReset = mediaReviewResetData(currentPost)
    const nextStatus = typeof mediaReset.status === 'string' ? mediaReset.status : currentPost.status
    const reopen = nextStatus !== currentPost.status
    await db.$transaction(async (tx: any) => {
      await tx.socialPost.update({
        where: { id: params.postId },
        data: {
          imageUrl: stored.url,
          sourceMediaId: media.id,
          sourceType: 'AI_GENERATED',
          uploadedMediaId: null,
          mediaSource: 'GENERATE',
          generationStatus: 'DONE',
          errorMessage: null,
          ...mediaReset,
        },
      })
      if (reopen) {
        await tx.postStatusHistory.create({
          data: {
            socialPostId: currentPost.id,
            workspaceId: currentPost.workspaceId,
            fromStatus: currentPost.status,
            toStatus: nextStatus,
            actor: 'SYSTEM',
            note: MEDIA_REVISION_HISTORY_NOTE,
          },
        })
      }
    })
    await db.generation.update({
      where: { id: generation.id },
      data: { metadata: {
        model: isCampaignFilm ? 'multi-shot-video-2026-06' : 'product-ad-2026-06', productionRoute, providerTaskId: task.id, mediaId: media.id,
        durationSeconds: stored.duration ?? expectedDurationSeconds, reviewRequired: true, attached: true,
        qualityStatus: 'PASSED', qualityReview,
        creditFinalizationStatus: finalization.status.toUpperCase(),
        compositorVersion: isCampaignFilm ? PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION : null,
        compositorUsage,
      } },
    })

    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: generation.id,
      output: stored.url,
      mediaId: media.id,
      attached: true,
      reviewRequired: true,
      creditsUsed: settledCredit?.creditsUsed ?? 0,
      creditsCharged: Boolean(settledCredit),
      creditCharge: settledCredit
        ? buildCreditChargeReceipt('VIDEO_GENERATION', settledCredit)
        : null,
      published: false,
      scheduled: false,
    })
  } catch (error) {
    const internalMessage = sanitizeSentryText(error instanceof Error ? error.message : 'Video storage or quality review failed').slice(0, 500)
    console.error('[generate-video] durable storage or quality review failed', internalMessage)
    const message = 'NEXUS Video Studio could not verify and store a usable video. Credits will be restored.'
    const refund = await refundGeneration(userId, generation, message, null, compositorUsage)
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', error: message, metadata: { qualityStatus: 'ERROR', reviewRequired: true } },
    })
    await db.socialPost.update({
      where: { id: params.postId },
      data: { generationStatus: refund === 'pending' ? 'REFUND_PENDING' : 'FAILED', errorMessage: message },
    })
    return NextResponse.json({
      error: message,
      code: 'VIDEO_STORAGE_FAILED',
      refunded: refund === 'refunded',
      refundPending: refund === 'pending',
    }, { status: 502 })
  }
}
