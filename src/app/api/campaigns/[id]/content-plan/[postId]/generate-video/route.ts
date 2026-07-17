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
  CONTENT_HUB_VIDEO_COST,
  validateVideoGenerationConfirmation,
} from '@/lib/contentHubActionSafety'
import {
  getMediaStorageUnavailablePayload,
  getVideoProviderUnavailablePayload,
  isMediaStorageConfigured,
  isVideoProviderConfigured,
} from '@/lib/ai/provider'
import {
  buildProfessionalVideoPrompt,
  platformToRunwayRatio,
} from '@/lib/ai/mediaProviderRouter'
import {
  cancelRunwayTask,
  createRunwayVideoTask,
  retrieveRunwayTask,
  uploadRunwayVideoToCloudinary,
  type RunwayTask,
} from '@/lib/ai/runway'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'
import {
  CONTENT_REVISION_HISTORY_NOTE,
  contentReviewResetData,
  isImmutableExecutionPost,
  reopensContentReview,
} from '@/lib/contentPostRevision'
import { sanitizeSentryText } from '@/lib/observability/sentryPrivacy'

export const maxDuration = 60

type Params = { params: Promise<{ id: string; postId: string }> }
const db = prisma as any

type StoredGenerationParams = {
  postId?: string
  postUpdatedAt?: string
  referenceMediaId?: string | null
  ratio?: string
  durationSeconds?: number
  credit?: CreditDeductionOk
}

function generationParams(value: unknown): StoredGenerationParams {
  return value && typeof value === 'object' ? value as StoredGenerationParams : {}
}

function safeFailure(task: RunwayTask): string {
  console.error('[generate-video] NEXUS video provider task failed', {
    status: task.status,
    failureCode: sanitizeSentryText(task.failureCode || '').slice(0, 120),
    providerFailure: sanitizeSentryText(task.failure || '').slice(0, 300),
  })
  return 'NEXUS Video Studio could not create a usable video. Reserved credits will be restored.'
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

async function refundGeneration(
  userId: string,
  generation: any,
  reason: string,
): Promise<'refunded' | 'pending' | 'noop'> {
  const deduction = generationParams(generation.params).credit
  const result = await refundCreditDeduction({
    userId,
    action: 'VIDEO_GENERATION',
    deduction,
    reason,
  })
  if (!result.ok) return 'pending'
  return result.status === 'refunded' ? 'refunded' : 'noop'
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const confirmation = validateVideoGenerationConfirmation({
    confirmed: body.explicitVideoGenerationConfirmed,
    acknowledgedCreditCost: body.acknowledgedCreditCost,
    acknowledgedDurationSeconds: body.acknowledgedDurationSeconds,
    acknowledgedNoPublishOrSchedule: body.acknowledgedNoPublishOrSchedule,
    acknowledgedReviewRequired: body.acknowledgedReviewRequired,
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
  }], strategy, [
    brand?.brandName,
    brand?.industry,
    brand?.description,
    brand?.primaryOffer,
    Array.isArray(brand?.uniqueAdvantages) ? brand.uniqueAdvantages : [],
    brand?.complianceNotes,
    Array.isArray(brand?.verifiedProof) ? brand.verifiedProof : [],
  ])
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

  let referenceMedia: { id: string; url: string } | null = null
  if (typeof body.referenceMediaId === 'string' && body.referenceMediaId.trim()) {
    referenceMedia = await db.media.findFirst({
      where: {
        id: body.referenceMediaId.trim(),
        workspaceId: campaign.workspaceId,
        type: { in: ['IMAGE', 'LOGO'] },
        OR: [{ campaignId: null }, { campaignId: params.id }],
      },
      select: { id: true, url: true },
    })
    if (!referenceMedia) {
      return NextResponse.json({
        error: 'The selected first-frame image was not found in this workspace or campaign.',
        code: 'REFERENCE_MEDIA_NOT_FOUND',
        creditsCharged: false,
      }, { status: 404 })
    }
  }

  const prompt = buildProfessionalVideoPrompt({
    brandName: brand?.brandName || campaign.name,
    caption: post.caption,
    videoDirection: post.videoPrompt,
    industry: brand?.industry,
    toneWords: brand?.toneKeywords,
    hasReferenceImage: Boolean(referenceMedia),
  })
  const ratio = platformToRunwayRatio(post.publishTarget || post.platform, Boolean(referenceMedia))
  const generation = await db.generation.create({
    data: {
      campaignId: params.id,
      type: 'VIDEO',
      prompt,
      params: {
        postId: params.postId,
        postUpdatedAt: post.updatedAt.toISOString(),
        referenceMediaId: referenceMedia?.id ?? null,
        ratio,
        durationSeconds: 5,
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
    description: `Professional 5-second campaign video — post #${post.contentPlanIndex ?? post.id}`,
  })
  if (!credit.ok) {
    await db.generation.update({ where: { id: generation.id }, data: { status: 'FAILED', error: 'Credits were unavailable before provider execution.' } })
    return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
  }

  try {
    const task = await createRunwayVideoTask({
      promptText: prompt,
      promptImage: referenceMedia?.url,
      ratio,
      duration: 5,
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

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'VIDEO_GENERATION',
      deduction: credit,
    })
    if (!finalization.ok) {
      await cancelRunwayTask(task.id)
      await db.generation.update({
        where: { id: generation.id },
        data: { status: 'CANCELLED', error: 'Credit finalization failed; provider task cancellation was requested.' },
      })
      await db.socialPost.update({ where: { id: post.id }, data: { generationStatus: 'FAILED' } })
      return NextResponse.json({
        error: 'Video generation was stopped because the credit operation could not be finalized.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }

    return NextResponse.json({
      generationId: generation.id,
      status: task.status,
      durationSeconds: 5,
      ratio,
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: buildCreditChargeReceipt('VIDEO_GENERATION', credit),
      reviewRequired: true,
      published: false,
      scheduled: false,
    }, { status: 202 })
  } catch (error) {
    const internalMessage = sanitizeSentryText(error instanceof Error ? error.message : 'Video generation failed').slice(0, 500)
    console.error('[generate-video] NEXUS Video Studio start failed', internalMessage)
    const message = 'NEXUS Video Studio could not start production. Reserved credits will be restored.'
    const refund = await refundCreditDeduction({
      userId,
      action: 'VIDEO_GENERATION',
      deduction: credit,
      reason: message,
    })
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
      refunded: refund.ok && refund.status === 'refunded',
      refundPending: !refund.ok,
    }, { status: 502 })
  }
}

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const context = await findCampaignContext(userId, params.id, params.postId)
  if (!context) return NextResponse.json({ error: 'Campaign video post not found' }, { status: 404 })

  const generation = await findLatestPostGeneration(params.id, params.postId)
  if (!generation) return NextResponse.json({ status: 'NOT_STARTED', generation: null })
  if (generation.status === 'COMPLETED') {
    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: generation.id,
      output: generation.output,
      mediaId: (generation.metadata as any)?.mediaId ?? null,
      attached: (generation.metadata as any)?.attached === true,
      reviewRequired: true,
    })
  }
  if (['FAILED', 'CANCELLED'].includes(generation.status) || !generation.externalId) {
    return NextResponse.json({ status: generation.status, generationId: generation.id, error: generation.error })
  }

  let task: RunwayTask
  try {
    task = await retrieveRunwayTask(generation.externalId)
  } catch (error) {
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
    const message = safeFailure(task)
    const refund = await refundGeneration(userId, generation, message)
    await db.generation.update({ where: { id: generation.id }, data: { status: task.status === 'FAILED' ? 'FAILED' : 'CANCELLED', error: message } })
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
    })
  }

  const providerUrl = task.output?.[0]
  if (task.status !== 'SUCCEEDED' || !providerUrl) {
    return NextResponse.json({ status: 'PROCESSING', generationId: generation.id }, { status: 202 })
  }

  try {
    const stored = await uploadRunwayVideoToCloudinary(providerUrl, generation.id)
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
        category: 'ai-generated-ad-master',
        tags: ['nexus-video-studio', 'ad-master', 'review-required'],
      },
    })

    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        output: stored.url,
        metadata: {
          model: 'gen4.5',
          providerTaskId: task.id,
          mediaId: media.id,
          durationSeconds: stored.duration ?? 5,
          reviewRequired: true,
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
          model: 'gen4.5', providerTaskId: task.id, mediaId: media.id,
          durationSeconds: stored.duration ?? 5, reviewRequired: true, attached: false,
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
        message: 'The video is saved in Media Library, but the post changed while it was rendering, so NEXUS did not overwrite the newer revision.',
      })
    }

    const reopen = reopensContentReview(currentPost.status)
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
          ...contentReviewResetData(currentPost.status),
        },
      })
      if (reopen) {
        await tx.postStatusHistory.create({
          data: {
            socialPostId: currentPost.id,
            workspaceId: currentPost.workspaceId,
            fromStatus: currentPost.status,
            toStatus: 'DRAFT',
            actor: 'SYSTEM',
            note: CONTENT_REVISION_HISTORY_NOTE,
          },
        })
      }
    })
    await db.generation.update({
      where: { id: generation.id },
      data: { metadata: {
        model: 'gen4.5', providerTaskId: task.id, mediaId: media.id,
        durationSeconds: stored.duration ?? 5, reviewRequired: true, attached: true,
      } },
    })

    return NextResponse.json({
      status: 'SUCCEEDED',
      generationId: generation.id,
      output: stored.url,
      mediaId: media.id,
      attached: true,
      reviewRequired: true,
      published: false,
      scheduled: false,
    })
  } catch (error) {
    const message = sanitizeSentryText(error instanceof Error ? error.message : 'Video storage failed').slice(0, 500)
    const refund = await refundGeneration(userId, generation, message)
    await db.generation.update({ where: { id: generation.id }, data: { status: 'FAILED', error: message } })
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
