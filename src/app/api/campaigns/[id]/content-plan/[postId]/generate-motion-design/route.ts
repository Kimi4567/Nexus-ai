import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  buildCreditChargeReceipt,
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  refundCreditDeduction,
} from '@/lib/credits'
import {
  CONTENT_HUB_MOTION_DESIGN_COST,
  validateMotionDesignConfirmation,
} from '@/lib/contentHubActionSafety'
import { isMediaStorageConfigured, getMediaStorageUnavailablePayload } from '@/lib/ai/provider'
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
  assessMotionDesignVideoAsset,
  buildMotionDesignCopy,
  cloudinarySourceReviewFrames,
  MOTION_DESIGN_DURATION_SECONDS,
  MOTION_DESIGN_SAFE_SOURCE_SECONDS,
} from '@/lib/motionDesignAd'
import {
  destroyMotionDesignAd,
  renderAndPersistMotionDesignAd,
} from '@/lib/motionDesignAd.server'
import {
  buildProfessionalVideoTimeline,
  PROFESSIONAL_VIDEO_TIMELINE_VERSION,
  validateProfessionalVideoTimeline,
} from '@/lib/professionalVideoTimeline'
import {
  resolvePlatformVideoFormat,
  validatePlatformVideoFormat,
} from '@/lib/platformVideoFormat'
import { CURRENT_CREDIT_PRICING_VERSION } from '@/lib/credits/pricing'

export const maxDuration = 180

type Params = { params: Promise<{ id: string; postId: string }> }
const db = prisma as any

type MotionGenerationParams = {
  postId?: string
  postUpdatedAt?: string
  sourceMediaId?: string
  operationKey?: string | null
  productionRoute?: string
}

function generationParams(value: unknown): MotionGenerationParams {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as MotionGenerationParams
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

async function recentMotionGenerations(campaignId: string, postId: string) {
  const rows = await db.generation.findMany({
    where: { campaignId, type: 'VIDEO', provider: 'cloudinary' },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return rows.filter((row: any) => {
    const params = generationParams(row.params)
    return params.postId === postId && params.productionRoute === 'SOURCE_LOCKED_MOTION_DESIGN'
  })
}

async function restoreCredits(input: {
  userId: string
  deduction: any
  reason: string
}) {
  return refundCreditDeduction({
    userId: input.userId,
    action: 'MOTION_DESIGN_VIDEO',
    deduction: input.deduction,
    reason: input.reason,
  })
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const confirmation = validateMotionDesignConfirmation({
    confirmed: body.explicitMotionDesignConfirmed,
    acknowledgedCreditCost: body.acknowledgedCreditCost,
    acknowledgedDurationSeconds: body.acknowledgedDurationSeconds,
    acknowledgedNoPublishOrSchedule: body.acknowledgedNoPublishOrSchedule,
    acknowledgedReviewRequired: body.acknowledgedReviewRequired,
    acknowledgedAssetRights: body.acknowledgedAssetRights,
    sourceMediaId: body.sourceMediaId,
  })
  if (!confirmation.ok) {
    return NextResponse.json({
      error: confirmation.error,
      code: 'MOTION_DESIGN_CONFIRMATION_REQUIRED',
      creditsCharged: false,
    }, { status: 400 })
  }

  const context = await findContext(userId, params.id, params.postId)
  if (!context) return NextResponse.json({ error: 'Campaign video post not found' }, { status: 404 })
  const { campaign, post, brand } = context
  if (!post.isVideoPost) {
    return NextResponse.json({ error: 'Motion design is available only for video posts.', code: 'VIDEO_POST_REQUIRED' }, { status: 409 })
  }
  if (isImmutableExecutionPost(post.status)) {
    return NextResponse.json({
      error: 'Published or provider-processing posts are immutable. Create a new draft for a media revision.',
      code: 'PUBLISHED_POST_IMMUTABLE',
    }, { status: 409 })
  }
  if (!canMutateCampaignExecution(String(campaign.status ?? ''), campaign.aiOutput, brand)) {
    return NextResponse.json({
      error: 'Approve the current strategy truth review before producing motion design.',
      code: 'STRATEGY_TRUTH_REVIEW_REQUIRED',
      redirectTo: `/campaigns/${campaign.id}?tab=strategy`,
    }, { status: 409 })
  }

  const brandReview = reviewBrandTruthConsistency(brand)
  if (brandReview.status === 'blocked') {
    return NextResponse.json({
      error: 'Brand Brain contains contradictory source data. Correct it before producing motion design.',
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
      error: 'Fix this video post truth review before paying for motion design.',
      code: 'CONTENT_TRUTH_REVIEW_REQUIRED',
      issues: contentReview.issues,
    }, { status: 409 })
  }

  if (!isMediaStorageConfigured()) {
    return NextResponse.json(getMediaStorageUnavailablePayload(body.language), { status: 503 })
  }

  const sourceMediaId = String(body.sourceMediaId).trim()
  const source = await db.media.findFirst({
    where: {
      id: sourceMediaId,
      workspaceId: campaign.workspaceId,
      type: 'VIDEO',
      OR: [{ campaignId: null }, { campaignId: params.id }],
    },
    select: {
      id: true,
      url: true,
      cloudinaryId: true,
      fileName: true,
      type: true,
      width: true,
      height: true,
      duration: true,
      category: true,
      tags: true,
      intelligenceStatus: true,
      intelligence: true,
    },
  })
  if (!source) {
    return NextResponse.json({
      error: 'The selected source video was not found in this workspace or campaign.',
      code: 'SOURCE_MEDIA_NOT_FOUND',
      creditsCharged: false,
    }, { status: 404 })
  }

  const preflight = assessMotionDesignVideoAsset(source, post.caption)
  if (!preflight.eligible) {
    return NextResponse.json({
      error: 'The selected source did not pass source-locked Motion Design preflight. No credits were spent.',
      code: 'MOTION_DESIGN_PREFLIGHT_FAILED',
      creditsCharged: false,
      preflight,
    }, { status: 422 })
  }

  const operationKey = getCreditOperationKey(
    req,
    'MOTION_DESIGN_VIDEO',
    'social_post_motion_design',
    post.id,
  )
  const existingRows = await recentMotionGenerations(params.id, params.postId)
  const idempotent = operationKey
    ? existingRows.find((row: any) => generationParams(row.params).operationKey === operationKey)
    : null
  if (idempotent?.status === 'COMPLETED') {
    const metadata = idempotent.metadata && typeof idempotent.metadata === 'object'
      ? idempotent.metadata as Record<string, unknown>
      : {}
    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: idempotent.id,
      output: idempotent.output,
      mediaId: metadata.mediaId ?? null,
      attached: metadata.attached === true,
      durationSeconds: MOTION_DESIGN_DURATION_SECONDS,
      productionRoute: 'SOURCE_LOCKED_MOTION_DESIGN',
      creditsUsed: CONTENT_HUB_MOTION_DESIGN_COST,
      reviewRequired: true,
      published: false,
      scheduled: false,
      idempotent: true,
    })
  }
  const active = existingRows.find((row: any) => ['PENDING', 'QUEUED', 'PROCESSING'].includes(row.status))
  if (active) {
    return NextResponse.json({
      error: 'A source-locked Motion Design render is already in progress for this post.',
      code: 'MOTION_DESIGN_IN_PROGRESS',
      generationId: active.id,
    }, { status: 409 })
  }

  const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'MOTION_DESIGN_VIDEO')
  if (rateLimitResponse) return rateLimitResponse

  const copy = buildMotionDesignCopy({
    brandName: brand?.brandName,
    campaignName: campaign.name,
    caption: post.caption,
  })
  const targetFormat = {
    ...resolvePlatformVideoFormat(post.publishTarget || post.platform),
    durationSeconds: MOTION_DESIGN_DURATION_SECONDS,
  }
  const sourceAspect = Number(source.width || 0) / Math.max(1, Number(source.height || 0))
  const targetAspect = targetFormat.width / targetFormat.height
  const sourceMatchesTarget = Number(source.width || 0) > 0
    && Number(source.height || 0) > 0
    && Math.abs(sourceAspect - targetAspect) <= 0.02
  const intelligence = readMediaIntelligence(source.intelligence)
  const sourceCanCropSafely = /(?:close[- ]?up|macro|texture|abstract)/i
    .test(intelligence?.visibleSummary || '')
  const timeline = buildProfessionalVideoTimeline({
    copy,
    caption: post.caption,
    colorPalette: Array.isArray(brand?.colorPalette) ? brand.colorPalette : [],
    sourceMatchesTarget,
    sourceLayout: sourceMatchesTarget || sourceCanCropSafely
      ? 'FULL_BLEED'
      : 'BLURRED_CANVAS',
  })
  const timelineValidation = validateProfessionalVideoTimeline(timeline, post.caption)
  if (!timelineValidation.ok) {
    return NextResponse.json({
      error: 'NEXUS could not build a truth-grounded professional ad timeline. No credits were spent.',
      code: 'PROFESSIONAL_VIDEO_TIMELINE_REJECTED',
      creditsCharged: false,
      issues: timelineValidation.issues,
    }, { status: 422 })
  }
  const generation = await db.generation.create({
    data: {
      campaignId: params.id,
      type: 'VIDEO',
      prompt: `${copy.brandLabel} — ${copy.hook}`,
      params: {
        postId: params.postId,
        postUpdatedAt: post.updatedAt.toISOString(),
        sourceMediaId: source.id,
        productionRoute: 'SOURCE_LOCKED_MOTION_DESIGN',
        targetFormat,
        durationSeconds: MOTION_DESIGN_DURATION_SECONDS,
        safeSourceSeconds: MOTION_DESIGN_SAFE_SOURCE_SECONDS,
        overlayCopy: copy,
        professionalTimeline: timeline,
        automaticProviderRetries: 0,
        generativeVideoProviderCalls: 0,
        operationKey,
        pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
      },
      status: 'PENDING',
      provider: 'cloudinary',
    },
  })

  const credit = await checkAndDeductCredits(userId, 'MOTION_DESIGN_VIDEO', undefined, {
    entityId: post.id,
    entityType: 'social_post_motion_design',
    operationKey,
    description: `Six-second source-locked Motion Design bumper — post #${post.contentPlanIndex ?? post.id}; no generative-video provider`,
  })
  if (!credit.ok) {
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', error: 'Credits were unavailable before motion-design production.' },
    })
    return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
  }

  let stored: Awaited<ReturnType<typeof renderAndPersistMotionDesignAd>> | null = null
  try {
    await db.generation.update({ where: { id: generation.id }, data: { status: 'PROCESSING', progress: 10 } })
    stored = await renderAndPersistMotionDesignAd({
      sourceUrl: source.url,
      target: targetFormat,
      generationId: generation.id,
      overlayCopy: copy,
      timeline,
      sourceWidth: source.width,
      sourceHeight: source.height,
    })
    const formatValidation = validatePlatformVideoFormat({
      width: stored.width,
      height: stored.height,
      durationSeconds: stored.duration,
      contentType: `video/${stored.format}`,
    }, targetFormat)
    const qualityReview = await reviewGeneratedMediaQuality({
      mediaType: 'VIDEO',
      outputFrames: cloudinaryVideoReviewFrames(stored.url, stored.duration ?? MOTION_DESIGN_DURATION_SECONDS),
      referenceImageUrls: cloudinarySourceReviewFrames(source.url),
      campaignMessage: post.caption,
      creativeDirection: 'Professional source-locked paid-social edit built from a deterministic three-scene timeline: full-bleed or blurred-canvas source treatment, a scroll-stopping exact approved offer or service metric, a separate supporting proof layer, two intentional scene transitions, moving source imagery through the CTA, procedural original sound design, and a separately composited branded end frame. Reject black letterbox presentation, frozen filler, awkward Arabic word spacing, UI-like buttons, illegible copy, synthetic product pixels, unrelated subjects, or any new claim.',
      referenceEvidence: intelligence,
      targetFormat,
      formatValidation,
      requireProductAdStructure: true,
      qualityStandard: 'PAID_SOCIAL',
      approvedOverlayTexts: [
        timeline.copy.brand.toUpperCase(),
        timeline.copy.eyebrow,
        timeline.copy.headline,
        ...(timeline.copy.supporting ? [timeline.copy.supporting] : []),
        timeline.copy.cta,
      ],
    })
    if (!qualityReview.passed) {
      const message = 'NEXUS quality review rejected this Motion Design render. Reserved credits will be restored.'
      const refund = await restoreCredits({ userId, deduction: credit, reason: message })
      const persistedMessage = `${message} ${qualityReview.summary}`
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          progress: 100,
          output: stored.url,
          error: message,
          metadata: {
            productionRoute: 'SOURCE_LOCKED_MOTION_DESIGN',
            sourceMediaId: source.id,
            durationSeconds: stored.duration,
            reviewRequired: true,
            qualityStatus: 'REJECTED',
            qualityReview,
            retainedForAudit: true,
            generativeVideoProviderCalls: 0,
          },
        },
      })
      await db.socialPost.update({
        where: { id: post.id },
        data: {
          generationStatus: refund.ok ? 'FAILED' : 'REFUND_PENDING',
          errorMessage: persistedMessage,
        },
      })
      return NextResponse.json({
        error: message,
        code: 'MOTION_DESIGN_QUALITY_REJECTED',
        qualityReview,
        refunded: refund.ok && refund.status === 'refunded',
        refundPending: !refund.ok,
      }, { status: 422 })
    }

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'MOTION_DESIGN_VIDEO',
      deduction: credit,
      providerEconomics: qualityReview.providerUsage
        ? {
            providerCostUsd: qualityReview.providerUsage.estimatedProviderCostUsd,
            providerPricingVersion: qualityReview.providerUsage.pricingVersion,
            providerUsage: {
              productionRoute: 'SOURCE_LOCKED_MOTION_DESIGN',
              generativeVideoProviderCalls: 0,
              qualityReview: qualityReview.providerUsage,
            },
          }
        : undefined,
    })
    if (!finalization.ok) {
      await destroyMotionDesignAd(stored.publicId).catch(() => undefined)
      await db.generation.update({
        where: { id: generation.id },
        data: { status: 'CANCELLED', error: 'Credit finalization failed; the motion-design output was not attached.' },
      })
      return NextResponse.json({
        error: 'Motion Design stopped because the credit operation could not be finalized.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }

    const currentPost = await db.socialPost.findUnique({ where: { id: params.postId } })
    const revisionStillCurrent = currentPost
      && currentPost.updatedAt.toISOString() === post.updatedAt.toISOString()
      && !isImmutableExecutionPost(currentPost.status)
    const mediaReset = revisionStillCurrent ? mediaReviewResetData(currentPost) : {}
    const nextStatus = typeof mediaReset.status === 'string' ? mediaReset.status : currentPost?.status
    const reopen = Boolean(revisionStillCurrent && nextStatus !== currentPost.status)

    const result = await db.$transaction(async (tx: any) => {
      const media = await tx.media.create({
        data: {
          workspaceId: campaign.workspaceId,
          campaignId: params.id,
          fileName: `${campaign.name || 'campaign'}-motion-design-${generation.id}.${stored!.format}`,
          type: 'VIDEO',
          mimeType: `video/${stored!.format}`,
          url: stored!.url,
          cloudinaryId: stored!.publicId,
          size: stored!.bytes,
          width: stored!.width,
          height: stored!.height,
          duration: stored!.duration,
          category: 'source-locked-motion-design-ad',
          tags: ['nexus-video-studio', 'motion-design', 'source-locked', 'review-required'],
        },
      })

      if (revisionStillCurrent) {
        await tx.socialPost.update({
          where: { id: params.postId },
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
      }

      await tx.generation.update({
        where: { id: generation.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          output: stored!.url,
          params: { ...generationParams(generation.params), credit },
          metadata: {
            model: `source-locked-motion-design-ffmpeg-${PROFESSIONAL_VIDEO_TIMELINE_VERSION}`,
            productionRoute: 'SOURCE_LOCKED_MOTION_DESIGN',
            sourceMediaId: source.id,
            mediaId: media.id,
            durationSeconds: stored!.duration,
            professionalTimeline: timeline,
            reviewRequired: true,
            qualityStatus: 'PASSED',
            qualityReview,
            attached: Boolean(revisionStillCurrent),
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
      sourceMediaId: source.id,
      attached: result.attached,
      durationSeconds: MOTION_DESIGN_DURATION_SECONDS,
      productionRoute: 'SOURCE_LOCKED_MOTION_DESIGN',
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: buildCreditChargeReceipt('MOTION_DESIGN_VIDEO', credit),
      qualityReview,
      professionalTimeline: timeline,
      reviewRequired: true,
      generativeVideoProviderCalls: 0,
      published: false,
      scheduled: false,
    }, { status: 201 })
  } catch (error) {
    const internalMessage = sanitizeSentryText(error instanceof Error ? error.message : 'Motion design failed').slice(0, 500)
    console.error('[generate-motion-design] production failed', internalMessage)
    if (stored?.publicId) {
      await destroyMotionDesignAd(stored.publicId).catch(() => undefined)
    }
    const message = 'NEXUS could not verify and store a usable Motion Design video. Reserved credits will be restored.'
    const refund = await restoreCredits({ userId, deduction: credit, reason: message })
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: 'FAILED',
        progress: 100,
        output: null,
        error: message,
        params: { ...generationParams(generation.params), credit },
        metadata: {
          productionRoute: 'SOURCE_LOCKED_MOTION_DESIGN',
          qualityStatus: 'ERROR',
          reviewRequired: true,
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
      code: 'MOTION_DESIGN_FAILED',
      refunded: refund.ok && refund.status === 'refunded',
      refundPending: !refund.ok,
    }, { status: 502 })
  }
}
