/**
 * POST /api/visuals/generate
 *
 * Strategy-driven image generation.
 * Fetches Brand Brain + Strategy from DB to build a rich VisualContext,
 * then routes to the correct brand-category prompt builder.
 *
 * Provider selection is automatic and task-aware (server-side):
 *   - Final/product creative → GPT Image 2 high-fidelity generation/editing
 *   - Concept draft → configured FAL model, with GPT Image 2 fallback
 *
 * Clients do not choose the provider — it's an infrastructure decision.
 * Returns an accepted durable job immediately. Provider execution, permanent
 * upload, and credit settlement/refund continue after the HTTP response.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import {
  buildCreditChargeReceipt,
  CREDIT_COSTS,
  checkAndDeductCredits,
  checkDailyImageCap,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { validateSingleImageGenerationConfirmation } from '@/lib/contentHubActionSafety'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import {
  buildImagePrompt,
  buildReferencePreservingEditPrompt,
  generateWithDallE,
  generateWithOpenAIImageEdit,
  IMAGE_OUTPUT_CLASSIFICATION,
  uploadToCloudinary,
  VisualContext,
  VisualStyle,
  VisualType,
} from '@/lib/ai/imageGen'
import type { VisualAssetRole } from '@/lib/ai/imageGen'
import { generateWithFlux, platformToFluxAspectRatio, platformToOpenAISize } from '@/lib/ai/falGen'
import {
  getImageProviderUnavailablePayload,
  getMediaStorageUnavailablePayload,
  isImageProviderConfigured,
  isAiProviderConfigured,
  isMediaStorageConfigured,
} from '@/lib/ai/provider'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { captureOperationalError } from '@/lib/observability/operationalError'
import { chooseProfessionalImageProvider, type ImageGenerationPurpose } from '@/lib/ai/mediaProviderRouter'
import { scheduleAfterResponse } from '@/lib/afterResponse'
import { readMediaIntelligence } from '@/lib/creativeIntelligence'
import { reviewGeneratedMediaQuality } from '@/lib/ai/generatedMediaQuality'
import {
  CONTENT_REVISION_HISTORY_NOTE,
  contentReviewResetData,
  isImmutableExecutionPost,
  reopensContentReview,
} from '@/lib/contentPostRevision'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// A high-quality reference edit can take several minutes. `after()` keeps the
// accepted job alive inside this bounded Fluid Compute lifetime; a stranded
// GENERATING row is repaired by the existing image-credit reconciliation cron.
export const maxDuration = 300

async function refundDeductedCredits(
  userId: string,
  credit: CreditDeductionOk,
  reason: string,
): Promise<{ refunded: boolean; refundPending: boolean }> {
  const result = await refundCreditDeduction({
    userId,
    action: 'IMAGE_GENERATION',
    deduction: credit,
    reason,
  })
  return result && !result.ok
    ? { refunded: false, refundPending: true }
    : { refunded: true, refundPending: false }
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    campaignId,
    visualType    = 'HERO'    as VisualType,
    visualStyle   = 'Premium' as VisualStyle,
    // Platform hint for sizing: META | TIKTOK | LINKEDIN | INSTAGRAM
    platform      = 'META'    as string,
    // Client can pass overrides — DB is the authoritative source for brand context
    campaignName,
    campaignGoal,
    campaignTone,
    audience,
    brandName,
    brandToneWords,
    primaryOffer,
    industry,
    // Post-level caption — when set, image is generated FOR this specific post
    postCaption,
    // Regeneration
    parentId,
    // Creative planning hints from Content Hub / Creative tab
    creativeRequirement,
    creativeTemplate,
    assetRole = 'draft_visual_asset' as VisualAssetRole,
    referenceMediaId,
    // Explicit credit/action confirmation
    explicitImageGenerationConfirmed,
    acknowledgedCreditCost,
    acknowledgedNoPublishOrSchedule,
    acknowledgedPostMediaForReview,
  } = body

  // ── Get workspace ──────────────────────────────────────────────────────────
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  // ── Explicit confirmation guard (before credits, visual rows, or providers) ─
  const confirmation = validateSingleImageGenerationConfirmation({
    confirmed: explicitImageGenerationConfirmed,
    acknowledgedCreditCost,
    acknowledgedNoPublishOrSchedule,
    acknowledgedPostMediaForReview,
  })
  if (!confirmation.ok) {
    return NextResponse.json(
      {
        error: 'IMAGE_GENERATION_CONFIRMATION_REQUIRED',
        message: confirmation.error,
        required: {
          explicitImageGenerationConfirmed: true,
          acknowledgedCreditCost: CREDIT_COSTS.IMAGE_GENERATION,
          acknowledgedNoPublishOrSchedule: true,
        },
      },
      { status: 400 },
    )
  }

  // A reload or transient polling failure must never create a second paid job
  // for the same post/regeneration target. Return the owned active audit row so
  // the client resumes polling without another provider call or reservation.
  const normalizedParentId = typeof parentId === 'string' ? parentId.trim() : ''
  if (normalizedParentId) {
    const activeVisual = await db.generatedVisual.findFirst({
      where: {
        workspaceId: workspace.id,
        campaignId: campaignId || null,
        parentId: normalizedParentId,
        status: 'GENERATING',
        isArchived: false,
      },
      orderBy: { createdAt: 'desc' },
    })
    if (activeVisual) {
      return NextResponse.json({
        accepted: true,
        reused: true,
        visual: activeVisual,
        pollUrl: `/api/visuals/${activeVisual.id}`,
        assetRole,
        outputClassification: IMAGE_OUTPUT_CLASSIFICATION,
        creditsReserved: 0,
      }, { status: 202 })
    }
  }

  // ── Daily image cap (per-plan abuse guard, checked BEFORE deduction) ────────
  // Even with credits available, limit images/day so Free users can't run up
  // real $ cost. Failed (refunded) generations are excluded from the count.
  const planUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true },
  })
  const imageCap = await checkDailyImageCap(workspace.id, planUser?.subscriptionStatus)
  if (!imageCap.allowed) {
    return NextResponse.json(
      {
        error: 'DAILY_IMAGE_LIMIT',
        message: `You've reached today's image limit (${imageCap.cap}). It resets tomorrow — upgrade for a higher daily limit.`,
        used: imageCap.used,
        cap: imageCap.cap,
        upgradeUrl: '/billing',
      },
      { status: 429 },
    )
  }

  // ── Fetch campaign + Brand Brain + Strategy ────────────────────────────────
  // If no campaignId, we still fetch the brand profile for workspace-level generation
  let campaign: any = null
  let brand: any = null
  let referenceMedia: {
    id: string
    url: string
    type: string
    intelligenceStatus: string
    intelligence: unknown
  } | null = null
  let generationPost: any = null

  try {
    if (campaignId) {
      campaign = await (prisma as any).campaign.findFirst({
        where: { id: campaignId, workspace: { ownerId: userId } },
        include: {
          workspace: { include: { brandProfile: true } },
        },
      })
      brand = campaign?.workspace?.brandProfile
    } else {
      // No campaign — fetch brand profile directly from workspace
      const ws = await (prisma as any).workspace.findFirst({
        where: { ownerId: userId },
        include: { brandProfile: true },
      })
      brand = ws?.brandProfile
    }
  } catch {
    // Non-fatal — proceed without brand context
  }

  if (typeof referenceMediaId === 'string' && referenceMediaId.trim()) {
    referenceMedia = await db.media.findFirst({
      where: {
        id: referenceMediaId.trim(),
        workspaceId: workspace.id,
        type: { in: ['IMAGE', 'LOGO'] },
        OR: [{ campaignId: null }, { campaignId: campaignId || null }],
      },
      select: { id: true, url: true, type: true, intelligenceStatus: true, intelligence: true },
    })
    if (!referenceMedia) {
      return NextResponse.json({
        error: 'The selected product/reference image was not found in this workspace or campaign.',
        code: 'REFERENCE_MEDIA_NOT_FOUND',
        creditsCharged: false,
      }, { status: 404 })
    }
  }

  // ── Extract Strategy fields from aiOutput ─────────────────────────────────
  const aiOutput = (campaign?.aiOutput as any) || {}
  const strategy = aiOutput.strategy || {}

  const brandTruthReview = reviewBrandTruthConsistency(brand)
  if (brandTruthReview.status === 'blocked') {
    return NextResponse.json({
      error: 'Brand Brain contains contradictory source data. Correct it before generating paid media.',
      code: 'BRAND_TRUTH_REVIEW_REQUIRED',
      blockers: brandTruthReview.blockers.map(item => item.code),
      redirectTo: '/brand',
    }, { status: 409 })
  }

  const socialPostId = typeof parentId === 'string' && parentId.startsWith('social-post:')
    ? parentId.slice('social-post:'.length).trim()
    : ''
  if (socialPostId) {
    if (!campaign || !canMutateCampaignExecution(String(campaign.status ?? ''), campaign.aiOutput, brand)) {
      return NextResponse.json({
        error: 'Approve the current strategy truth review before generating paid post media.',
        code: 'STRATEGY_TRUTH_REVIEW_REQUIRED',
        redirectTo: campaign?.id ? `/campaigns/${campaign.id}?tab=strategy` : '/strategy',
      }, { status: 409 })
    }

    const post = await db.socialPost.findFirst({
      where: {
        id: socialPostId,
        workspaceId: workspace.id,
        campaignId: campaign.id,
      },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found', code: 'POST_NOT_FOUND' }, { status: 404 })
    }
    if (isImmutableExecutionPost(post.status)) {
      return NextResponse.json({
        error: 'Published or provider-processing posts are immutable. Create a new draft for new media.',
        code: 'PUBLISHED_POST_IMMUTABLE',
      }, { status: 409 })
    }
    generationPost = post

    const contentReview = reviewContentPlanForApproval(
      [{
        caption: post.caption,
        imagePrompt: post.imagePrompt,
        videoPrompt: post.videoPrompt,
        contentPlanIndex: post.contentPlanIndex,
      }],
      strategy,
      [
        brand?.brandName,
        brand?.industry,
        brand?.description,
        brand?.primaryOffer,
        Array.isArray(brand?.uniqueAdvantages) ? brand.uniqueAdvantages : [],
        brand?.complianceNotes,
        Array.isArray(brand?.verifiedProof) ? brand.verifiedProof : [],
      ],
    )
    if (!contentReview.ok) {
      return NextResponse.json({
        error: 'Fix the post copy truth review before generating paid media.',
        code: 'CONTENT_TRUTH_REVIEW_REQUIRED',
        issues: contentReview.issues,
      }, { status: 409 })
    }
  }

  // ── Build rich VisualContext (DB wins over client params for brand fields) ─
  const ctx: VisualContext = {
    visualType,
    visualStyle,
    // Campaign
    campaignName: campaignName || campaign?.name || undefined,
    campaignGoal: campaignGoal || campaign?.goal || undefined,
    campaignTone: campaignTone || campaign?.tone || undefined,
    audience:     audience    || campaign?.audience || undefined,
    // Brand Brain — prefer DB values
    brandName:      brand?.brandName    || brandName    || undefined,
    primaryOffer:   brand?.primaryOffer || primaryOffer || undefined,
    industry:       brand?.industry     || industry     || undefined,
    brandToneWords: brand?.toneKeywords?.length
      ? brand.toneKeywords
      : (brandToneWords || []),
    colorPalette: Array.isArray(brand?.colorPalette)
      ? brand.colorPalette.join(', ')
      : (brand?.colorPalette || undefined),
    visualStylePref: brand?.visualStyle || undefined,
    uniqueAdvantages: Array.isArray(brand?.uniqueAdvantages)
      ? brand.uniqueAdvantages.slice(0, 3).join(', ')
      : undefined,
    // Strategy fields (Sprint M)
    positioning:     strategy.positioning     || undefined,
    visualDirection: strategy.visualDirection || undefined,
    differentiation: strategy.differentiation || undefined,
    keyMessage:      strategy.keyMessage      || undefined,
    // Post caption — drives the image subject when generating per-post
    postCaption:     postCaption              || undefined,
    // Platform — passed through for dimension-aware composition in the prompt
    platform:        platform                 || 'META',
    creativeRequirement: typeof creativeRequirement === 'object' && creativeRequirement !== null
      ? creativeRequirement
      : undefined,
    creativeTemplate: typeof creativeTemplate === 'object' && creativeTemplate !== null
      ? creativeTemplate
      : undefined,
    assetRole,
  }

  // ── Build the caption-driven, brand-adaptive ad prompt (async) ───────────
  // Prompt output is background-only; text/logo/CTA/proof layers are handled by
  // future editable/template composition, not trusted inside AI raster output.
  const { prompt, language } = await buildImagePrompt(ctx)
  const referenceEvidence = referenceMedia?.intelligenceStatus === 'READY'
    ? readMediaIntelligence(referenceMedia.intelligence)
    : null
  const providerPrompt = referenceMedia
    ? buildReferencePreservingEditPrompt({
        campaignMessage: ctx.postCaption || ctx.keyMessage || ctx.campaignGoal,
        creativeDirection: ctx.creativeRequirement?.visualConcept || ctx.visualDirection,
        platform: ctx.platform,
        brandName: ctx.brandName,
        referenceEvidence,
      })
    : prompt

  if (!isImageProviderConfigured()) {
    return NextResponse.json(getImageProviderUnavailablePayload(language), { status: 503 })
  }
  if (referenceMedia && !isAiProviderConfigured()) {
    return NextResponse.json({
      error: 'NEXUS high-fidelity product rendering is temporarily unavailable. No credits were charged.',
      code: 'REFERENCE_IMAGE_PROVIDER_UNAVAILABLE',
      creditsCharged: false,
      retryable: false,
    }, { status: 503 })
  }
  if (!isMediaStorageConfigured()) {
    return NextResponse.json(getMediaStorageUnavailablePayload(language), { status: 503 })
  }

  // ── Create the durable audit row before charging ──────────────────────────
  // The debit is linked to this row, so a crashed request or temporarily failed
  // refund can be reconciled exactly without guessing which generation spent it.
  let visual: any
  try {
    visual = await db.generatedVisual.create({
      data: {
        workspaceId:  workspace.id,
        campaignId:   campaignId || null,
        visualType,
        visualStyle,
        prompt:       `${visualStyle} ${visualType.toLowerCase().replace('_', ' ')} for ${ctx.campaignName || 'campaign'}`,
        enhancedPrompt: providerPrompt,
        campaignName:  ctx.campaignName || null,
        campaignGoal:  ctx.campaignGoal || null,
        campaignTone:  ctx.campaignTone || null,
        audience:      ctx.audience     || null,
        brandName:     ctx.brandName    || null,
        brandToneWords: ctx.brandToneWords || [],
        status:  'GENERATING',
        version: 1,
        parentId: parentId || null,
      },
    })
  } catch (dbErr) {
    await captureOperationalError(dbErr, {
      operation: 'ai.image-create-record',
      route: '/api/visuals/generate',
      component: 'database',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return NextResponse.json({
      error: 'Image generation could not start because its media record was not created.',
      code: 'MEDIA_RECORD_CREATE_FAILED',
      creditsCharged: false,
      refunded: false,
      refundPending: false,
    }, { status: 500 })
  }

  const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'IMAGE_GENERATION')
  if (rateLimitResponse) {
    await db.generatedVisual.update({
      where: { id: visual.id },
      data: { status: 'FAILED', errorMessage: 'AI generation rate limit reached before provider execution.' },
    }).catch(() => undefined)
    return rateLimitResponse
  }

  // ── Deduct credits before the expensive provider call ─────────────────────
  const credit = await checkAndDeductCredits(
    userId,
    'IMAGE_GENERATION',
    undefined,
    {
      entityId: visual.id,
      entityType: 'generated_visual_image',
      operationKey: getCreditOperationKey(req, 'IMAGE_GENERATION', 'generated_visual_image', visual.id),
    },
  )
  if (!credit.ok) {
    await db.generatedVisual.update({
      where: { id: visual.id },
      data: { status: 'FAILED', errorMessage: 'Image generation did not start because credits were unavailable.' },
    }).catch(() => {})
    return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
  }

  const requestId = req.headers?.get?.('x-vercel-id') ?? null

  // ── Run generation after the accepted response ───────────────────────────
  // The GeneratedVisual row is the durable polling and audit record. The
  // browser never needs to keep an expensive provider request open.
  scheduleAfterResponse(async () => {
    let durableAuditUrl: string | null = null
    try {
    let rawImageUrl: string
    const purpose: ImageGenerationPurpose = referenceMedia
      ? 'product_to_ad'
      : assetRole === 'final_composited_ad'
        ? 'final_ad_creative'
        : 'concept_draft'
    const providerDecision = chooseProfessionalImageProvider({
      purpose,
      hasReferenceImage: Boolean(referenceMedia),
      openAiConfigured: isAiProviderConfigured(),
      falConfigured: Boolean(process.env.FAL_KEY?.trim()),
    })

    const runProvider = async (provider: typeof providerDecision.provider) => {
      if (provider === 'fal-flux') {
        const fluxResult = await generateWithFlux({
          prompt: providerPrompt,
          aspectRatio: platformToFluxAspectRatio(platform),
        })
        return fluxResult.imageUrl
      }
      if (referenceMedia) {
        return generateWithOpenAIImageEdit(providerPrompt, referenceMedia.url, platformToOpenAISize(platform))
      }
      return generateWithDallE(providerPrompt, platformToOpenAISize(platform))
    }

    try {
      rawImageUrl = await runProvider(providerDecision.provider)
    } catch (primaryError) {
      if (!providerDecision.fallback) throw primaryError
      rawImageUrl = await runProvider(providerDecision.fallback)
    }

    // ── Persist raw AI image to Cloudinary (needed for Sharp to fetch it) ──
    const rawPublicId   = `visual_raw_${visual.id}`
    const cloudinaryUrl = await uploadToCloudinary(rawImageUrl, rawPublicId)
    durableAuditUrl = cloudinaryUrl

    // Raster typography is never treated as final copy. A strict visual pass
    // compares reference and output, rejects semantic mismatches and malformed
    // text, and owns the pass/fail decision before attachment or settlement.
    const qualityReview = await reviewGeneratedMediaQuality({
      mediaType: 'IMAGE',
      outputFrames: [cloudinaryUrl],
      referenceImageUrl: referenceMedia?.url,
      campaignMessage: ctx.postCaption || ctx.keyMessage || ctx.campaignGoal,
      creativeDirection: ctx.creativeRequirement?.visualConcept || ctx.visualDirection,
      referenceEvidence,
    })
    if (!qualityReview.passed) {
      const qualityMessage = 'NEXUS quality review rejected this image because it did not preserve the approved creative truth. Credits will be restored.'
      const refund = await refundDeductedCredits(userId, credit, qualityMessage)
      await db.generatedVisual.update({
        where: { id: visual.id },
        data: {
          status: 'FAILED',
          imageUrl: cloudinaryUrl,
          errorMessage: qualityMessage,
          provider: providerDecision.provider,
          referenceMediaId: referenceMedia?.id ?? null,
          creditTransactionId: credit.transactionId ?? null,
          qualityStatus: 'REJECTED',
          qualityReview,
        },
      })
      if (generationPost) {
        await db.socialPost.update({
          where: { id: generationPost.id },
          data: {
            generationStatus: refund.refundPending ? 'REFUND_PENDING' : 'FAILED',
            errorMessage: qualityMessage,
          },
        })
      }
      return
    }

    const permanentUrl = cloudinaryUrl

    // Complete the durable asset and, when this job belongs to a post, attach
    // it server-side under the user's explicit generation/attachment consent.
    // The result therefore survives a closed tab and never depends on the
    // polling client issuing a second mutation.
    if (generationPost) {
      await prisma.$transaction(async (tx) => {
        await (tx.generatedVisual as any).update({
          where: { id: visual.id },
          data: {
            status: 'COMPLETED',
            imageUrl: permanentUrl,
            errorMessage: null,
            provider: providerDecision.provider,
            referenceMediaId: referenceMedia?.id ?? null,
            creditTransactionId: credit.transactionId ?? null,
            qualityStatus: 'PASSED',
            qualityReview,
          },
        })

        const currentPost = await (tx.socialPost as any).findFirst({
          where: {
            id: generationPost.id,
            workspaceId: workspace.id,
            campaignId: campaign.id,
          },
        })
        if (!currentPost || isImmutableExecutionPost(currentPost.status)) return

        const reopensReview = reopensContentReview(currentPost.status)
        await (tx.socialPost as any).update({
          where: { id: currentPost.id },
          data: {
            imageUrl: permanentUrl,
            uploadedMediaId: null,
            mediaSource: 'GENERATE',
            generationStatus: 'DONE',
            sourceType: 'AI_GENERATED',
            sourceMediaId: null,
            creativeMatch: null,
            creativeMatchedAt: null,
            ...contentReviewResetData(currentPost.status),
          },
        })
        if (reopensReview) {
          await tx.postStatusHistory.create({
            data: {
              socialPostId: currentPost.id,
              workspaceId: currentPost.workspaceId,
              fromStatus: currentPost.status,
              toStatus: 'DRAFT',
              actor: 'USER',
              note: CONTENT_REVISION_HISTORY_NOTE,
            },
          })
        }
      })
    } else {
      await db.generatedVisual.update({
        where: { id: visual.id },
        data: {
          status: 'COMPLETED',
          imageUrl: permanentUrl,
          errorMessage: null,
          provider: providerDecision.provider,
          referenceMediaId: referenceMedia?.id ?? null,
          creditTransactionId: credit.transactionId ?? null,
          qualityStatus: 'PASSED',
          qualityReview,
        },
      })
    }

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'IMAGE_GENERATION',
      deduction: credit,
    })
    if (!finalization.ok) {
      await captureOperationalError(new Error('Generated image saved but credit finalization failed'), {
        operation: 'ai.image-credit-finalize',
        route: '/api/visuals/generate',
        component: 'billing',
        method: 'POST',
        requestId,
        statusCode: 503,
        retryable: true,
        severity: 'warning',
      })
    }
    } catch (err: unknown) {
      await captureOperationalError(err, {
        operation: 'ai.image-generate',
        route: '/api/visuals/generate',
        component: 'ai',
        method: 'POST',
        requestId,
        statusCode: 500,
        retryable: true,
      })

      const publicFailureMessage = 'NEXUS Image Studio could not create a usable image. Reserved credits will be restored.'

      await db.generatedVisual.update({
        where: { id: visual.id },
        data:  {
          status: 'FAILED',
          errorMessage: publicFailureMessage,
          ...(durableAuditUrl ? { imageUrl: durableAuditUrl } : {}),
          creditTransactionId: credit.transactionId ?? null,
          qualityStatus: 'ERROR',
        },
      }).catch(() => {})

      // If the immediate refund fails, the existing cron sees this FAILED
      // visual and restores the exact reservation idempotently.
      await refundDeductedCredits(userId, credit, publicFailureMessage)
    }
  })

  return NextResponse.json({
    accepted: true,
    visual,
    pollUrl: `/api/visuals/${visual.id}`,
    assetRole,
    outputClassification: IMAGE_OUTPUT_CLASSIFICATION,
    creditsReserved: credit.creditsUsed,
    creditsRemaining: credit.creditsRemaining,
    creditCharge: buildCreditChargeReceipt('IMAGE_GENERATION', credit),
  }, { status: 202 })
}
