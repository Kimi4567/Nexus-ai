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
  CONTENT_HUB_PROPERTY_PHOTO_FILM_COST,
  validatePropertyPhotoFilmConfirmation,
} from '@/lib/contentHubActionSafety'
import { isMediaStorageConfigured, getMediaStorageUnavailablePayload } from '@/lib/ai/provider'
import { isShotstackProductionConfigured, ShotstackRenderPendingError } from '@/lib/ai/shotstack'
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
import {
  cloudinaryVideoReviewFrames,
  reviewGeneratedMediaQuality,
} from '@/lib/ai/generatedMediaQuality'
import { readMediaIntelligence } from '@/lib/creativeIntelligence'
import {
  assessPropertyPhotoFilmAssets,
  buildPropertyPhotoFilmCopy,
  PROPERTY_PHOTO_FILM_DURATION_SECONDS,
  PROPERTY_PHOTO_FILM_VERSION,
  reviewPropertyPhotoFilmCopy,
  type PropertyPhotoFilmCopy,
} from '@/lib/propertyPhotoFilm'
import {
  renderAndPersistPropertyPhotoFilm,
  type PropertyPhotoFilmPendingCompositor,
} from '@/lib/propertyPhotoFilm.server'
import {
  destroyStoredCampaignFilm,
  type StoredProfessionalCampaignFilm,
} from '@/lib/professionalCampaignFilm.server'
import {
  resolvePlatformVideoFormat,
  validatePlatformVideoFormat,
  type PlatformVideoFormat,
} from '@/lib/platformVideoFormat'
import { CURRENT_CREDIT_PRICING_VERSION } from '@/lib/credits/pricing'
import { sourceLinkedProofStatements } from '@/lib/strategy/strategyEvidenceLedger'

export const maxDuration = 180

type Params = { params: Promise<{ id: string; postId: string }> }
const db = prisma as any

type PropertyFilmGenerationParams = {
  postId?: string
  postUpdatedAt?: string
  referenceMediaIds?: string[]
  operationKey?: string | null
  productionRoute?: string
  copy?: PropertyPhotoFilmCopy
  targetFormat?: PlatformVideoFormat
  credit?: CreditDeductionOk
  pricingVersion?: string
}

type PropertyFilmGenerationMetadata = {
  compositorPending?: PropertyPhotoFilmPendingCompositor | null
  [key: string]: unknown
}

function generationParams(value: unknown): PropertyFilmGenerationParams {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PropertyFilmGenerationParams
    : {}
}

function generationMetadata(value: unknown): PropertyFilmGenerationMetadata {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PropertyFilmGenerationMetadata
    : {}
}

async function findContext(userId: string, campaignId: string, postId: string) {
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

async function recentPropertyFilmGenerations(campaignId: string, postId: string) {
  const rows = await db.generation.findMany({
    where: { campaignId, type: 'VIDEO', provider: 'shotstack' },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return rows.filter((row: any) => {
    const params = generationParams(row.params)
    return params.postId === postId
      && params.productionRoute === 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM'
  })
}

async function restoreCredits(input: {
  userId: string
  deduction: CreditDeductionOk
  reason: string
}) {
  return refundCreditDeduction({
    userId: input.userId,
    action: 'MOTION_DESIGN_VIDEO',
    deduction: input.deduction,
    reason: input.reason,
  })
}

async function processPropertyFilm(input: {
  userId: string
  campaign: any
  post: any
  generation: any
  sources: any[]
}) {
  const { userId, campaign, post, generation, sources } = input
  const params = generationParams(generation.params)
  const credit = params.credit
  const copy = params.copy
  const targetFormat = params.targetFormat
  if (!credit || !copy || !targetFormat) {
    throw new Error('PROPERTY_FILM_EXECUTION_CONTRACT_MISSING')
  }

  let stored: StoredProfessionalCampaignFilm | null = null
  let pending = generationMetadata(generation.metadata).compositorPending ?? null
  try {
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'PROCESSING', progress: 40, error: null },
    })
    stored = await renderAndPersistPropertyPhotoFilm({
      sourceImageUrls: sources.map(source => source.url),
      target: targetFormat,
      generationId: generation.id,
      copy,
      resumeCompositor: pending,
      onCompositorQueued: async queued => {
        pending = queued
        await db.generation.update({
          where: { id: generation.id },
          data: {
            status: 'PROCESSING',
            progress: 85,
            metadata: {
              ...generationMetadata(generation.metadata),
              productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
              compositorPending: queued,
              qualityStatus: 'PROCESSING',
              reviewRequired: true,
            },
          },
        })
      },
    })

    const formatValidation = validatePlatformVideoFormat({
      width: stored.width,
      height: stored.height,
      durationSeconds: stored.duration,
      contentType: `video/${stored.format}`,
    }, targetFormat)
    const analyses = sources
      .map(source => readMediaIntelligence(source.intelligence))
      .filter(Boolean)
    const qualityReview = await reviewGeneratedMediaQuality({
      mediaType: 'VIDEO',
      outputFrames: cloudinaryVideoReviewFrames(
        stored.url,
        stored.duration ?? PROPERTY_PHOTO_FILM_DURATION_SECONDS,
      ),
      referenceImageUrls: sources.map(source => source.url),
      campaignMessage: post.caption,
      creativeDirection: 'Premium source-locked real-estate photo film. Every property pixel must come from the selected reference photographs. The edit should feel like a professional listing campaign: coherent photo order, subtle alternating camera motion, clean crossfades, restrained editorial typography, readable CTA, and a moving property image held behind the final frame. Reject invented rooms or features, distorted architecture, mismatched property sets, generic slideshow pacing, opaque full-screen title cards, illegible copy, fake address or price, environmental text changes, or any claim not present in the approved copy.',
      referenceEvidence: analyses,
      targetFormat,
      formatValidation,
      requireProductAdStructure: false,
      requiresRealProductHero: false,
      qualityStandard: 'PREMIUM',
      approvedOverlayTexts: [
        copy.brand,
        copy.eyebrow,
        copy.hook,
        copy.detail,
        copy.cta,
        ...(copy.disclosure ? [copy.disclosure] : []),
      ],
    })
    if (!qualityReview.passed) {
      const message = 'NEXUS quality review rejected the property photo film. Reserved credits will be restored.'
      await destroyStoredCampaignFilm(stored.publicId).catch(() => undefined)
      const refund = await restoreCredits({ userId, deduction: credit, reason: message })
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          progress: 100,
          output: null,
          error: message,
          metadata: {
            productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
            sourceMediaIds: sources.map(source => source.id),
            qualityStatus: 'REJECTED',
            qualityReview,
            reviewRequired: true,
            compositorUsage: stored.compositorUsage,
            compositorPending: null,
            generativeVideoProviderCalls: 0,
          },
        },
      })
      await db.socialPost.update({
        where: { id: post.id },
        data: {
          generationStatus: refund.ok ? 'FAILED' : 'REFUND_PENDING',
          errorMessage: `${message} ${qualityReview.summary}`,
        },
      })
      return NextResponse.json({
        error: message,
        code: 'PROPERTY_PHOTO_FILM_QUALITY_REJECTED',
        qualityReview,
        refunded: refund.ok && refund.status === 'refunded',
        refundPending: !refund.ok,
      }, { status: 422 })
    }

    const qaCost = Math.max(0, Number(qualityReview.providerUsage?.estimatedProviderCostUsd) || 0)
    const compositorCost = Math.max(0, Number(stored.compositorUsage.estimatedCostUsd) || 0)
    const voiceoverCost = Math.max(0, Number(stored.compositorUsage.voiceover?.estimatedCostUsd) || 0)
    const providerCostUsd = Number((qaCost + compositorCost + voiceoverCost).toFixed(6))
    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'MOTION_DESIGN_VIDEO',
      deduction: credit,
      providerEconomics: {
        providerCostUsd,
        providerPricingVersion: CURRENT_CREDIT_PRICING_VERSION,
        providerUsage: {
          productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
          generativeVideoProviderCalls: 0,
          compositor: stored.compositorUsage,
          qualityReview: qualityReview.providerUsage ?? null,
        },
      },
    })
    if (!finalization.ok) {
      await destroyStoredCampaignFilm(stored.publicId).catch(() => undefined)
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'CANCELLED',
          progress: 100,
          error: 'Credit finalization failed; the property film was not attached.',
        },
      })
      await db.socialPost.update({
        where: { id: post.id },
        data: {
          generationStatus: finalization.refundStatus === 'refunded' ? 'FAILED' : 'REFUND_PENDING',
          errorMessage: 'Property film production stopped because credit finalization could not be verified.',
        },
      })
      return NextResponse.json({
        error: 'Property film production stopped because the credit operation could not be finalized.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
        refundPending: finalization.refundStatus !== 'refunded',
      }, { status: 503 })
    }

    const currentPost = await db.socialPost.findUnique({ where: { id: post.id } })
    const revisionStillCurrent = currentPost
      && currentPost.updatedAt.toISOString() === params.postUpdatedAt
      && !isImmutableExecutionPost(currentPost.status)
    const mediaReset = revisionStillCurrent ? mediaReviewResetData(currentPost) : {}
    const nextStatus = typeof mediaReset.status === 'string' ? mediaReset.status : currentPost?.status
    const reopen = Boolean(revisionStillCurrent && nextStatus !== currentPost.status)

    const result = await db.$transaction(async (tx: any) => {
      const media = await tx.media.create({
        data: {
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          fileName: `${campaign.name || 'campaign'}-property-photo-film-${generation.id}.${stored!.format}`,
          type: 'VIDEO',
          mimeType: `video/${stored!.format}`,
          url: stored!.url,
          cloudinaryId: stored!.publicId,
          size: stored!.bytes,
          width: stored!.width,
          height: stored!.height,
          duration: stored!.duration,
          category: 'source-locked-property-photo-film',
          tags: [
            'nexus-video-studio',
            'property-photo-film',
            'source-locked',
            'review-required',
          ],
        },
      })

      if (revisionStillCurrent) {
        await tx.socialPost.update({
          where: { id: post.id },
          data: {
            imageUrl: stored!.url,
            sourceMediaId: media.id,
            sourceType: 'USER_ASSET',
            uploadedMediaId: media.id,
            mediaSource: 'UPLOAD',
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
      } else {
        await tx.socialPost.update({
          where: { id: post.id },
          data: {
            generationStatus: 'AWAITING_UPLOAD',
            errorMessage: 'The property film is saved in Media Library; the post changed before attachment.',
          },
        })
      }

      await tx.generation.update({
        where: { id: generation.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          output: stored!.url,
          error: null,
          metadata: {
            model: `shotstack-property-photo-film-${PROPERTY_PHOTO_FILM_VERSION}`,
            productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
            sourceMediaIds: sources.map(source => source.id),
            mediaId: media.id,
            durationSeconds: stored!.duration,
            reviewRequired: true,
            qualityStatus: 'PASSED',
            qualityReview,
            attached: Boolean(revisionStillCurrent),
            compositorUsage: stored!.compositorUsage,
            compositorPending: null,
            generativeVideoProviderCalls: 0,
          },
        },
      })
      return { media, attached: Boolean(revisionStillCurrent) }
    })

    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: generation.id,
      output: stored.url,
      mediaId: result.media.id,
      sourceMediaIds: sources.map(source => source.id),
      attached: result.attached,
      durationSeconds: PROPERTY_PHOTO_FILM_DURATION_SECONDS,
      productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: buildCreditChargeReceipt('MOTION_DESIGN_VIDEO', credit),
      qualityReview,
      reviewRequired: true,
      generativeVideoProviderCalls: 0,
      published: false,
      scheduled: false,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ShotstackRenderPendingError) {
      const retainedPending = pending ?? { renderId: error.renderId, voiceover: null }
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'PROCESSING',
          progress: 85,
          error: null,
          metadata: {
            ...generationMetadata(generation.metadata),
            productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
            compositorPending: retainedPending,
            qualityStatus: 'PROCESSING',
            reviewRequired: true,
          },
        },
      })
      await db.socialPost.update({
        where: { id: post.id },
        data: { generationStatus: 'GENERATING', errorMessage: null },
      })
      return NextResponse.json({
        status: 'PROCESSING',
        generationId: generation.id,
        progress: 85,
        retryable: true,
        resumeAvailable: true,
        creditsCharged: false,
        message: 'Shotstack is still rendering. NEXUS saved the render ID and will resume the same property film without a new render, voiceover, or credit reservation.',
      }, { status: 202 })
    }

    const internalMessage = sanitizeSentryText(error instanceof Error ? error.message : 'Property photo film failed').slice(0, 500)
    console.error('[generate-property-photo-film] production failed', internalMessage)
    if (stored?.publicId) {
      await destroyStoredCampaignFilm(stored.publicId).catch(() => undefined)
    }
    const message = 'NEXUS could not verify and store a usable property photo film. Reserved credits will be restored.'
    const refund = await restoreCredits({ userId, deduction: credit, reason: message })
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: 'FAILED',
        progress: 100,
        output: null,
        error: message,
        metadata: {
          productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
          sourceMediaIds: sources.map(source => source.id),
          qualityStatus: 'ERROR',
          reviewRequired: true,
          compositorPending: null,
          generativeVideoProviderCalls: 0,
        },
      },
    })
    await db.socialPost.update({
      where: { id: post.id },
      data: {
        generationStatus: refund.ok ? 'FAILED' : 'REFUND_PENDING',
        errorMessage: message,
      },
    })
    return NextResponse.json({
      error: message,
      code: 'PROPERTY_PHOTO_FILM_FAILED',
      refunded: refund.ok && refund.status === 'refunded',
      refundPending: !refund.ok,
    }, { status: 502 })
  }
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const confirmation = validatePropertyPhotoFilmConfirmation({
    confirmed: body.explicitPropertyPhotoFilmConfirmed,
    acknowledgedCreditCost: body.acknowledgedCreditCost,
    acknowledgedDurationSeconds: body.acknowledgedDurationSeconds,
    acknowledgedNoPublishOrSchedule: body.acknowledgedNoPublishOrSchedule,
    acknowledgedReviewRequired: body.acknowledgedReviewRequired,
    acknowledgedAssetRights: body.acknowledgedAssetRights,
    acknowledgedSameProperty: body.acknowledgedSameProperty,
    referenceMediaIds: body.referenceMediaIds,
  })
  if (!confirmation.ok) {
    return NextResponse.json({
      error: confirmation.error,
      code: 'PROPERTY_PHOTO_FILM_CONFIRMATION_REQUIRED',
      creditsCharged: false,
    }, { status: 400 })
  }

  const context = await findContext(userId, params.id, params.postId)
  if (!context) return NextResponse.json({ error: 'Campaign video post not found' }, { status: 404 })
  const { campaign, post, brand } = context
  if (!post.isVideoPost) {
    return NextResponse.json({ error: 'Property photo film is available only for video posts.', code: 'VIDEO_POST_REQUIRED' }, { status: 409 })
  }
  if (isImmutableExecutionPost(post.status)) {
    return NextResponse.json({
      error: 'Published or provider-processing posts are immutable. Create a new draft for a media revision.',
      code: 'PUBLISHED_POST_IMMUTABLE',
    }, { status: 409 })
  }
  if (!canMutateCampaignExecution(String(campaign.status ?? ''), campaign.aiOutput, brand)) {
    return NextResponse.json({
      error: 'Approve the current strategy truth review before producing a property film.',
      code: 'STRATEGY_TRUTH_REVIEW_REQUIRED',
      redirectTo: `/campaigns/${campaign.id}?tab=strategy`,
    }, { status: 409 })
  }

  const brandReview = reviewBrandTruthConsistency(brand)
  if (brandReview.status === 'blocked') {
    return NextResponse.json({
      error: 'Brand Brain contains contradictory source data. Correct it before producing a property film.',
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
      error: 'Fix this video post truth review before paying for a property film.',
      code: 'CONTENT_TRUTH_REVIEW_REQUIRED',
      issues: contentReview.issues,
    }, { status: 409 })
  }

  const verifiedFacts = sourceLinkedProofStatements(brand?.verifiedProof ?? [])
  const copyGrounding = reviewPropertyPhotoFilmCopy({
    caption: post.caption,
    verifiedFacts,
  })
  if (!copyGrounding.ok) {
    return NextResponse.json({
      error: 'The property copy contains listing facts without source-linked proof. Remove them or attach verified evidence before production.',
      code: 'PROPERTY_LISTING_FACTS_UNVERIFIED',
      unsupportedClaims: copyGrounding.unsupportedClaims,
      creditsCharged: false,
    }, { status: 422 })
  }

  if (!isMediaStorageConfigured()) {
    return NextResponse.json(getMediaStorageUnavailablePayload(body.language), { status: 503 })
  }
  if (!isShotstackProductionConfigured()) {
    return NextResponse.json({
      error: 'The production property-film compositor is not configured. No credits were spent.',
      code: 'SHOTSTACK_PROPERTY_FILM_UNAVAILABLE',
      creditsCharged: false,
    }, { status: 503 })
  }

  const referenceMediaIds = Array.from(new Set(
    (body.referenceMediaIds as unknown[])
      .map(value => String(value).trim())
      .filter(Boolean),
  ))
  const sources = await db.media.findMany({
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
  const sourceById = new Map(sources.map((source: any) => [source.id, source]))
  const orderedSources: any[] = referenceMediaIds
    .map(id => sourceById.get(id))
    .filter(Boolean)
  const preflight = assessPropertyPhotoFilmAssets(orderedSources)
  if (!preflight.eligible || orderedSources.length !== referenceMediaIds.length) {
    return NextResponse.json({
      error: 'The selected photographs did not pass source-locked property-film preflight. No credits were spent.',
      code: 'PROPERTY_PHOTO_FILM_PREFLIGHT_FAILED',
      creditsCharged: false,
      preflight,
    }, { status: 422 })
  }

  const operationKey = getCreditOperationKey(
    req,
    'MOTION_DESIGN_VIDEO',
    'social_post_property_photo_film',
    post.id,
  )
  const existingRows = await recentPropertyFilmGenerations(params.id, params.postId)
  const idempotent = operationKey
    ? existingRows.find((row: any) => generationParams(row.params).operationKey === operationKey)
    : null
  if (idempotent?.status === 'COMPLETED') {
    const metadata = generationMetadata(idempotent.metadata)
    const settledCredit = generationParams(idempotent.params).credit
    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: idempotent.id,
      output: idempotent.output,
      mediaId: metadata.mediaId ?? null,
      attached: metadata.attached === true,
      durationSeconds: PROPERTY_PHOTO_FILM_DURATION_SECONDS,
      productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
      creditsUsed: settledCredit?.creditsUsed ?? 0,
      reviewRequired: true,
      published: false,
      scheduled: false,
      idempotent: true,
    })
  }
  if (idempotent && ['PENDING', 'QUEUED', 'PROCESSING'].includes(idempotent.status)) {
    return processPropertyFilm({
      userId,
      campaign,
      post,
      generation: idempotent,
      sources: orderedSources,
    })
  }
  const active = existingRows.find((row: any) => ['PENDING', 'QUEUED', 'PROCESSING'].includes(row.status))
  if (active) {
    return NextResponse.json({
      error: 'A source-locked property photo film is already in progress for this post.',
      code: 'PROPERTY_PHOTO_FILM_IN_PROGRESS',
      generationId: active.id,
    }, { status: 409 })
  }

  const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'MOTION_DESIGN_VIDEO')
  if (rateLimitResponse) return rateLimitResponse

  const copy = buildPropertyPhotoFilmCopy({
    brandName: brand?.brandName,
    campaignName: campaign.name,
    caption: post.caption,
    verifiedFacts,
  })
  const targetFormat = {
    ...resolvePlatformVideoFormat(post.publishTarget || post.platform),
    durationSeconds: PROPERTY_PHOTO_FILM_DURATION_SECONDS,
  }
  const generation = await db.generation.create({
    data: {
      campaignId: params.id,
      type: 'VIDEO',
      prompt: `${copy.brand} — ${copy.hook}`,
      params: {
        postId: params.postId,
        postUpdatedAt: post.updatedAt.toISOString(),
        referenceMediaIds,
        productionRoute: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
        targetFormat,
        durationSeconds: PROPERTY_PHOTO_FILM_DURATION_SECONDS,
        copy,
        automaticProviderRetries: 0,
        generativeVideoProviderCalls: 0,
        operationKey,
        pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
      },
      status: 'PENDING',
      provider: 'shotstack',
    },
  })

  const credit = await checkAndDeductCredits(userId, 'MOTION_DESIGN_VIDEO', undefined, {
    entityId: post.id,
    entityType: 'social_post_property_photo_film',
    operationKey,
    description: `${PROPERTY_PHOTO_FILM_DURATION_SECONDS}-second source-locked property photo film — post #${post.contentPlanIndex ?? post.id}; no generative-video provider`,
  })
  if (!credit.ok) {
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', error: 'Credits were unavailable before property-film production.' },
    })
    return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
  }

  const generationWithCredit = await db.generation.update({
    where: { id: generation.id },
    data: {
      status: 'PROCESSING',
      progress: 10,
      params: { ...generationParams(generation.params), credit },
    },
  })
  await db.socialPost.update({
    where: { id: post.id },
    data: { generationStatus: 'GENERATING', errorMessage: null },
  })
  return processPropertyFilm({
    userId,
    campaign,
    post,
    generation: generationWithCredit,
    sources: orderedSources,
  })
}

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const context = await findContext(userId, params.id, params.postId)
  if (!context) return NextResponse.json({ error: 'Campaign video post not found' }, { status: 404 })

  const generation = (await recentPropertyFilmGenerations(params.id, params.postId))[0]
  if (!generation) return NextResponse.json({ status: 'NOT_STARTED', generation: null })
  if (generation.status === 'COMPLETED') {
    const metadata = generationMetadata(generation.metadata)
    const credit = generationParams(generation.params).credit
    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: generation.id,
      output: generation.output,
      mediaId: metadata.mediaId ?? null,
      attached: metadata.attached === true,
      creditsUsed: credit?.creditsUsed ?? 0,
      creditsCharged: Boolean(credit),
      creditCharge: credit
        ? buildCreditChargeReceipt('MOTION_DESIGN_VIDEO', credit)
        : null,
    })
  }
  if (['FAILED', 'CANCELLED'].includes(generation.status)) {
    return NextResponse.json({
      status: generation.status,
      generationId: generation.id,
      error: generation.error,
    })
  }

  const claim = await db.generation.updateMany({
    where: {
      id: generation.id,
      status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] },
      OR: [
        { progress: { lt: 99 } },
        { updatedAt: { lt: new Date(Date.now() - 120_000) } },
      ],
    },
    data: { progress: 99 },
  })
  if (claim.count !== 1) {
    return NextResponse.json({
      status: 'PROCESSING',
      generationId: generation.id,
      progress: 99,
      message: 'NEXUS is verifying and storing the property film.',
    }, { status: 202 })
  }

  const storedParams = generationParams(generation.params)
  const referenceMediaIds = storedParams.referenceMediaIds ?? []
  const sources = await db.media.findMany({
    where: {
      id: { in: referenceMediaIds },
      workspaceId: context.campaign.workspaceId,
      type: 'IMAGE',
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
  const sourceById = new Map(sources.map((source: any) => [source.id, source]))
  const orderedSources: any[] = referenceMediaIds
    .map(id => sourceById.get(id))
    .filter(Boolean)
  if (orderedSources.length !== referenceMediaIds.length) {
    const credit = storedParams.credit
    const message = 'One or more source property photographs are no longer available. Reserved credits will be restored.'
    const refund = credit
      ? await restoreCredits({ userId, deduction: credit, reason: message })
      : null
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', progress: 100, error: message },
    })
    await db.socialPost.update({
      where: { id: context.post.id },
      data: {
        generationStatus: refund?.ok ? 'FAILED' : 'REFUND_PENDING',
        errorMessage: message,
      },
    })
    return NextResponse.json({
      error: message,
      code: 'PROPERTY_SOURCE_MEDIA_MISSING',
      refunded: refund?.ok && refund.status === 'refunded',
      refundPending: !refund?.ok,
    }, { status: 410 })
  }

  return processPropertyFilm({
    userId,
    campaign: context.campaign,
    post: context.post,
    generation,
    sources: orderedSources,
  })
}
