/**
 * POST /api/campaigns/[id]/generate-content-plan/generate
 *
 * Bulk image generation for Content Hub posts.
 * Accepts a list of postIds and generates images for PENDING image posts.
 *
 * Processing model:
 * - Exactly 1 post per call so provider latency cannot strand a paid batch
 * - Each post: generate image → upload to Cloudinary → update DB
 * - Frontend polls and re-triggers for remaining posts
 * - Deducts the centralized IMAGE_GENERATION cost per image
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  checkAndDeductCredits,
  checkDailyImageCap,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  getCreditActionPolicy,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { generateWithFlux, platformToFluxAspectRatio, platformToOpenAISize } from '@/lib/ai/falGen'
import {
  buildImagePrompt,
  generateWithDallE,
  uploadToCloudinary,
  type VisualContext,
} from '@/lib/ai/imageGen'
import { normalizeContentHubImagePromptForPlatform } from '@/lib/contentHubImageFormat'
import {
  getBulkImageGenerationCost,
  validateBulkImageGenerationConfirmation,
} from '@/lib/contentHubActionSafety'
import {
  getImageProviderUnavailablePayload,
  getMediaStorageUnavailablePayload,
  isImageProviderConfigured,
  isAiProviderConfigured,
  isMediaStorageConfigured,
} from '@/lib/ai/provider'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { buildContentPlanTruthContext, reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { chooseProfessionalImageProvider } from '@/lib/ai/mediaProviderRouter'
import { reviewGeneratedMediaQuality } from '@/lib/ai/generatedMediaQuality'
import {
  buildPlatformReadyImageUrl,
  resolvePlatformImageFormat,
} from '@/lib/platformImageFormat'
import { verifyPlatformReadyImage } from '@/lib/platformImageDelivery.server'

export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }
type ImageCreditReservation = {
  postId: string
  deduction: CreditDeductionOk
  refunded: boolean
  settled: boolean
}

const MAX_IMAGES_PER_REQUEST = 1

// ── Image generation (mirrors cron/generate-images logic) ─────────────────────

async function generateImage(prompt: string, platform: string): Promise<string> {
  // The prompt is already produced by the shared Visual Intelligence builder,
  // including its text-free draft-background contract. Keep only the final
  // platform normalization here so bulk and single generation stay identical.
  const safePrompt = normalizeContentHubImagePromptForPlatform(prompt, platform)

  const decision = chooseProfessionalImageProvider({
    purpose: 'final_ad_creative',
    hasReferenceImage: false,
    openAiConfigured: isAiProviderConfigured(),
    falConfigured: Boolean(process.env.FAL_KEY?.trim()),
  })
  const run = async (provider: typeof decision.provider) => {
    if (provider === 'fal-flux') {
      const result = await generateWithFlux({
        prompt: safePrompt,
        aspectRatio: platformToFluxAspectRatio(platform),
      })
      return result.imageUrl
    }
    return generateWithDallE(safePrompt, platformToOpenAISize(platform))
  }

  try {
    return await run(decision.provider)
  } catch (error) {
    if (!decision.fallback) throw error
    return run(decision.fallback)
  }
}

async function buildContentHubPostPrompt(campaign: any, post: any): Promise<string> {
  const brand = campaign.workspace?.brandProfile ?? {}
  const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object'
    ? campaign.aiOutput as Record<string, any>
    : {}
  const strategy = aiOutput.strategy && typeof aiOutput.strategy === 'object'
    ? aiOutput.strategy as Record<string, any>
    : aiOutput
  const postContext = [
    post.caption,
    post.imagePrompt ? `Creative direction: ${post.imagePrompt}` : null,
  ].filter(Boolean).join('\n')

  const context: VisualContext = {
    visualType: 'SOCIAL_PREVIEW',
    visualStyle: 'Premium',
    campaignName: campaign.name ?? undefined,
    campaignGoal: campaign.goal ?? undefined,
    campaignTone: campaign.tone ?? undefined,
    audience: campaign.audience ?? undefined,
    brandName: brand.brandName ?? undefined,
    brandToneWords: Array.isArray(brand.toneKeywords) ? brand.toneKeywords : [],
    primaryOffer: brand.primaryOffer ?? undefined,
    industry: brand.industry ?? undefined,
    colorPalette: Array.isArray(brand.colorPalette)
      ? brand.colorPalette.join(', ')
      : brand.colorPalette ?? undefined,
    visualStylePref: brand.visualStyle ?? undefined,
    uniqueAdvantages: Array.isArray(brand.uniqueAdvantages)
      ? brand.uniqueAdvantages.slice(0, 4).join(', ')
      : undefined,
    positioning: strategy.positioning ?? undefined,
    visualDirection: strategy.visualDirection ?? undefined,
    differentiation: strategy.differentiation ?? undefined,
    keyMessage: strategy.keyMessage ?? undefined,
    postCaption: postContext,
    creativeDirection: post.imagePrompt ?? undefined,
    platform: post.platform,
    creativeRequirement: {
      objective: campaign.goal ?? undefined,
      platform: post.platform,
      sourcePreference: 'generated',
      textOverlayNeeded: true,
      logoNeeded: true,
    },
    assetRole: 'final_composited_ad',
  }

  const result = await buildImagePrompt(context)
  return normalizeContentHubImagePromptForPlatform(result.prompt, post.platform)
}

async function refundImageReservation(
  userId: string,
  reservation: ImageCreditReservation | undefined,
  reason: string,
): Promise<boolean> {
  if (!reservation || reservation.refunded || reservation.settled) return true
  const result = await refundCreditDeduction({
    userId,
    action: 'IMAGE_GENERATION',
    deduction: reservation.deduction,
    reason,
  })
  if (result && !result.ok) return false
  reservation.refunded = true
  return true
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creditReservations: ImageCreditReservation[] = []
  const claimedPosts = new Map<string, string>()

  try {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      include: { workspace: { include: { brandProfile: true } } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const requestedIds: string[] = body.postIds ?? []

    // Load posts that need generation
    const pendingPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        isVideoPost: false,
        mediaSource: 'GENERATE',
        generationStatus: 'PENDING',
        imagePrompt: { not: null },
        ...(requestedIds.length ? { id: { in: requestedIds } } : {}),
      },
      take: MAX_IMAGES_PER_REQUEST,
    })
    // Keep the invariant in application code as well as Prisma. This also
    // protects tests/adapters that do not implement Prisma's `take` option.
    const postsToGenerate = pendingPosts.slice(0, MAX_IMAGES_PER_REQUEST)

    if (postsToGenerate.length === 0) {
      return NextResponse.json({ success: true, generated: 0, message: 'No pending posts to generate' })
    }

    const confirmation = validateBulkImageGenerationConfirmation({
      confirmed: body.explicitBulkImageGenerationConfirmed,
      acknowledgedImageCount: body.acknowledgedImageCount,
      acknowledgedCreditCost: body.acknowledgedCreditCost,
      expectedImageCount: postsToGenerate.length,
    })
    if (!confirmation.ok) {
      return NextResponse.json({
        error: confirmation.error,
        code: 'CONFIRMATION_REQUIRED',
        expectedImageCount: postsToGenerate.length,
        expectedCreditCost: getBulkImageGenerationCost(postsToGenerate.length),
      }, { status: 400 })
    }

    const brandProfile = campaign.workspace?.brandProfile ?? null
    const brandTruthReview = reviewBrandTruthConsistency(brandProfile)
    if (brandTruthReview.status === 'blocked') {
      return NextResponse.json({
        error: 'Brand Brain contains contradictory source data. Correct it before generating paid media.',
        code: 'BRAND_TRUTH_REVIEW_REQUIRED',
        blockers: brandTruthReview.blockers.map(item => item.code),
        redirectTo: '/brand',
      }, { status: 409 })
    }

    if (!canMutateCampaignExecution(String(campaign.status ?? ''), campaign.aiOutput, brandProfile)) {
      return NextResponse.json({
        error: 'Approve the current strategy truth review before generating paid media.',
        code: 'STRATEGY_TRUTH_REVIEW_REQUIRED',
        redirectTo: `/campaigns/${campaign.id}?tab=strategy`,
      }, { status: 409 })
    }

    const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object'
      ? campaign.aiOutput as Record<string, unknown>
      : {}
    const strategy = aiOutput.strategy && typeof aiOutput.strategy === 'object'
      ? aiOutput.strategy
      : aiOutput
    const contentReview = reviewContentPlanForApproval(
      postsToGenerate.map((post: {
        caption?: string | null
        imagePrompt?: string | null
        videoPrompt?: string | null
        contentPlanIndex?: number | null
      }) => ({
        caption: post.caption,
        imagePrompt: post.imagePrompt,
        videoPrompt: post.videoPrompt,
        contentPlanIndex: post.contentPlanIndex,
      })),
      strategy,
      buildContentPlanTruthContext(brandProfile),
    )
    if (!contentReview.ok) {
      return NextResponse.json({
        error: 'Fix the post copy truth review before generating paid media.',
        code: 'CONTENT_TRUTH_REVIEW_REQUIRED',
        issues: contentReview.issues,
      }, { status: 409 })
    }

    if (!isImageProviderConfigured()) {
      return NextResponse.json(getImageProviderUnavailablePayload(body.language), { status: 503 })
    }
    if (!isMediaStorageConfigured()) {
      return NextResponse.json(getMediaStorageUnavailablePayload(body.language), { status: 503 })
    }

    // The single-image route and the bulk route share the same daily abuse cap.
    // Check the whole confirmed batch before any credit reservation or provider
    // call so a partial batch can never exceed the user's remaining daily quota.
    const planUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    })
    const imageCap = await checkDailyImageCap(campaign.workspaceId, planUser?.subscriptionStatus)
    if (!imageCap.allowed || (imageCap.remaining !== -1 && postsToGenerate.length > imageCap.remaining)) {
      return NextResponse.json({
        error: 'DAILY_IMAGE_LIMIT',
        message: `This batch needs ${postsToGenerate.length} image slot${postsToGenerate.length === 1 ? '' : 's'}, but only ${Math.max(0, imageCap.remaining)} remain today. No credits were spent.`,
        requested: postsToGenerate.length,
        used: imageCap.used,
        cap: imageCap.cap,
        remaining: imageCap.remaining,
        upgradeUrl: '/billing',
      }, { status: 429 })
    }

    // Claim each image slot before charging. Two concurrent requests can read
    // the same PENDING row, but only one may move it to GENERATING and continue
    // to the wallet/provider path.
    for (const post of postsToGenerate) {
      const originalStatus = String(post.generationStatus || 'PENDING')
      const claim = await (prisma.socialPost as any).updateMany({
        where: {
          id: post.id,
          campaignId: params.id,
          workspaceId: campaign.workspaceId,
          isVideoPost: false,
          mediaSource: 'GENERATE',
          imageUrl: null,
          generationStatus: originalStatus,
        },
        data: { generationStatus: 'GENERATING' },
      })
      if (claim.count !== 1) {
        await Promise.all(Array.from(claimedPosts.entries()).map(([postId, generationStatus]) =>
          (prisma.socialPost as any).update({
            where: { id: postId },
            data: { generationStatus },
          }),
        ))
        claimedPosts.clear()
        return NextResponse.json({
          error: 'This image is already being generated or its media state changed. No credits were spent.',
          code: 'IMAGE_ALREADY_CLAIMED',
          generated: 0,
          failed: 0,
        }, { status: 409 })
      }
      claimedPosts.set(post.id, originalStatus)
    }

    const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'IMAGE_GENERATION')
    if (rateLimitResponse) {
      await Promise.all(Array.from(claimedPosts.entries()).map(([postId, generationStatus]) =>
        (prisma.socialPost as any).update({
          where: { id: postId },
          data: { generationStatus },
        }),
      ))
      claimedPosts.clear()
      return rateLimitResponse
    }

    // Reserve one IMAGE_GENERATION charge per post. Keep each transaction tied
    // to its post so a partial batch failure refunds only the failed image.
    const reservationsByPostId = new Map<string, ImageCreditReservation>()
    for (let i = 0; i < postsToGenerate.length; i++) {
      const post = postsToGenerate[i]
      const creditCheck = await checkAndDeductCredits(
        userId,
        'IMAGE_GENERATION',
        undefined,
        {
          entityId: post.id,
          entityType: 'social_post_image',
          operationKey: getCreditOperationKey(req, 'IMAGE_GENERATION', 'social_post_image', post.id),
        },
      )
      if (!creditCheck.ok) {
        await Promise.all(
          creditReservations.map((reservation) =>
            refundImageReservation(userId, reservation, 'Batch image credit reservation failed'),
          ),
        )
        await Promise.all(Array.from(claimedPosts.entries()).map(([postId, generationStatus]) =>
          (prisma.socialPost as any).update({
            where: { id: postId },
            data: { generationStatus },
          }),
        ))
        claimedPosts.clear()
        return NextResponse.json({
          ...creditCheck,
          code: creditCheck.error ?? 'INSUFFICIENT_CREDITS',
          generated: 0,
        }, { status: creditCheckHttpStatus(creditCheck) })
      }

      const reservation: ImageCreditReservation = {
        postId: post.id,
        deduction: creditCheck,
        refunded: false,
        settled: false,
      }
      creditReservations.push(reservation)
      reservationsByPostId.set(post.id, reservation)
    }

    // Generate images sequentially (avoid parallel API rate-limiting)
    const results: Array<{ id: string; success: boolean; imageUrl?: string; error?: string; refunded?: boolean }> = []

    for (const post of postsToGenerate) {
      const reservation = reservationsByPostId.get(post.id)
      let visualId: string | null = null
      try {
        const preparedPrompt = await buildContentHubPostPrompt(campaign, post)
        const visual = await (prisma.generatedVisual as any).create({
          data: {
            workspaceId: campaign.workspaceId,
            campaignId: campaign.id,
            visualType: 'SOCIAL_PREVIEW',
            visualStyle: 'Content Hub',
            prompt: post.imagePrompt!,
            enhancedPrompt: preparedPrompt,
            campaignName: campaign.name,
            brandName: campaign.workspace?.brandProfile?.brandName ?? null,
            status: 'GENERATING',
            parentId: `social-post:${post.id}`,
          },
        })
        visualId = visual.id

        const targetFormat = resolvePlatformImageFormat(post.publishTarget || post.platform)
        const rawUrl = await generateImage(preparedPrompt, targetFormat.platform)
        // Content Hub media must be durable. Never put a provider-temporary URL
        // or a base64 payload in SocialPost.imageUrl.
        const durableRawUrl = await uploadToCloudinary(rawUrl, `content_hub_raw_${post.id}`)
        const finalUrl = buildPlatformReadyImageUrl(durableRawUrl, targetFormat)
        const formatValidation = await verifyPlatformReadyImage(finalUrl, targetFormat)
        const qualityReview = await reviewGeneratedMediaQuality({
          mediaType: 'IMAGE',
          outputFrames: [finalUrl],
          campaignMessage: post.caption,
          creativeDirection: post.imagePrompt,
          targetFormat,
          formatValidation,
        })
        if (!qualityReview.passed) {
          await (prisma.generatedVisual as any).update({
            where: { id: visualId },
            data: {
              status: 'FAILED',
              imageUrl: finalUrl,
              errorMessage: 'NEXUS quality review rejected this platform-ready image.',
              qualityStatus: 'REJECTED',
              qualityReview,
            },
          })
          throw new Error('NEXUS quality review rejected this platform-ready image')
        }

        await prisma.$transaction(async (tx) => {
          await (tx.socialPost as any).update({
            where: { id: post.id },
            data: { imageUrl: finalUrl, generationStatus: 'DONE', mediaSource: 'GENERATE' },
          })
          await (tx.generatedVisual as any).update({
            where: { id: visualId! },
            data: {
              imageUrl: finalUrl,
              status: 'COMPLETED',
              qualityStatus: 'PASSED',
              qualityReview,
            },
          })
        })
        if (reservation) {
          const finalization = await finalizeCreditDeduction({
            userId,
            action: 'IMAGE_GENERATION',
            deduction: reservation.deduction,
          })
          if (finalization.ok) {
            reservation.settled = true
          } else {
            reservation.refunded = finalization.refundStatus === 'refunded'
            throw new Error('Image was saved but its credit operation could not be finalized')
          }
        }
        claimedPosts.delete(post.id)

        results.push({ id: post.id, success: true, imageUrl: finalUrl })
      } catch (err: any) {
        console.error(`[Content Hub] Image generation failed for ${post.id}:`, err)
        const publicMessage = 'NEXUS Image Studio could not create a usable image.'
        // Refund this post's image credit — a failed image must not be charged
        const refunded = await refundImageReservation(userId, reservation, publicMessage)
        if (visualId) {
          await (prisma.generatedVisual as any).update({
            where: { id: visualId },
            data: { status: 'FAILED', errorMessage: publicMessage },
          }).catch(() => {})
        }
        await (prisma.socialPost as any).update({
          where: { id: post.id },
          data: { generationStatus: refunded ? 'FAILED' : 'REFUND_PENDING' },
        })
        claimedPosts.delete(post.id)
        results.push({ id: post.id, success: false, error: publicMessage, refunded })
      }
    }

    const generated = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const refundPending = results.filter(r => !r.success && r.refunded === false).length
    const remaining = await (prisma.socialPost as any).count({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        generationStatus: 'PENDING',
        isVideoPost: false,
        mediaSource: 'GENERATE',
      },
    })

    return NextResponse.json({
      success: refundPending === 0,
      generated,
      failed,
      refundPending,
      remaining,
      results,
      creditCharges: creditReservations
        .filter((reservation) => reservation.settled && !reservation.refunded)
        .map((reservation) => ({
          ...getCreditActionPolicy('IMAGE_GENERATION'),
          creditsUsed: reservation.deduction.creditsUsed,
          creditsRemaining: reservation.deduction.creditsRemaining,
          isUnlimited: reservation.deduction.isUnlimited,
          transactionId: reservation.deduction.transactionId || null,
          operationStatus: 'SETTLED',
          entityId: reservation.postId,
          entityType: 'social_post_image',
        })),
    })
  } catch (err: any) {
    console.error('[generate-content-plan/generate POST]', err)
    const refundResults = await Promise.all(
      creditReservations.map((reservation) =>
        refundImageReservation(userId, reservation, err.message ?? 'Batch image generation failed'),
      ),
    )
    await Promise.all(Array.from(claimedPosts.entries()).map(([postId, originalStatus]) =>
      (prisma.socialPost as any).update({
        where: { id: postId },
        data: {
          generationStatus: (() => {
            const reservationIndex = creditReservations.findIndex(reservation => reservation.postId === postId)
            if (reservationIndex < 0) return originalStatus
            return refundResults[reservationIndex] ? 'FAILED' : 'REFUND_PENDING'
          })(),
        },
      }).catch(() => {}),
    ))
    return NextResponse.json({
      error: 'Generation failed',
      generated: 0,
      failed: creditReservations.length,
      refundPending: refundResults.filter((refunded) => !refunded).length,
    }, { status: 500 })
  }
}
