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
 * Returns the completed visual synchronously (Vercel 60s timeout).
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
import { platformToOverlay } from '@/lib/cloudinaryOverlay'
import { composeBrandedPost, bufferToDataUri } from '@/lib/brandComposite'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// GPT Image 2 high-quality edits can legitimately take close to two minutes.
// Fluid Compute supports this bounded wait; the provider call still has its
// own timeout and every failure follows the existing automatic credit refund.
export const maxDuration = 180

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
  let referenceMedia: { id: string; url: string; type: string } | null = null

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
      select: { id: true, url: true, type: true },
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
  const { prompt, language, concept } = await buildImagePrompt(ctx)

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
        enhancedPrompt: prompt,
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

  // ── Run generation — route by marketing task, not environment key order ─
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
          prompt,
          aspectRatio: platformToFluxAspectRatio(platform),
        })
        return fluxResult.imageUrl
      }
      if (referenceMedia) {
        return generateWithOpenAIImageEdit(prompt, referenceMedia.url, platformToOpenAISize(platform))
      }
      return generateWithDallE(prompt, platformToOpenAISize(platform))
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

    // ── Optional legacy Sharp brand composite ─────────────────────────────
    // New asset roles are background/draft assets for review. They intentionally
    // skip the hardcoded text/logo compositor so generated output does not look
    // like final editable ad creative before the template/layer system exists.
    let permanentUrl = cloudinaryUrl
    const overlayPlatform = platformToOverlay(platform)
    const shouldApplyLegacyComposite = ![
      'post_background',
      'campaign_concept_background',
      'hero_visual',
      'draft_visual_asset',
    ].includes(assetRole)

    if (shouldApplyLegacyComposite) {
      try {
        const compositeBuffer = await composeBrandedPost(cloudinaryUrl, {
          brandName:   brand?.brandName || ctx.brandName || 'Brand',
          logoUrl:     brand?.logoUrl   || null,
          accentColor: brand?.colorPalette
            ? (Array.isArray(brand.colorPalette) ? brand.colorPalette[0] : brand.colorPalette)
            : null,
          platform:    overlayPlatform,
          // Use reviewed Arabic/English post copy as the deterministic layer;
          // the prompt concept headline is only a final fallback.
          adHeadline: postCaption || concept?.headline || undefined,
        })

        const finalPublicId = `visual_${visual.id}`
        permanentUrl = await uploadToCloudinary(
          bufferToDataUri(compositeBuffer),
          finalPublicId
        )
        console.log(`[visuals/generate] Sharp composite applied on ${overlayPlatform}`)
      } catch (compositeErr) {
        await captureOperationalError(compositeErr, {
          operation: 'ai.image-brand-composite',
          route: '/api/visuals/generate',
          component: 'ai',
          method: 'POST',
          requestId: req.headers?.get?.('x-vercel-id') ?? null,
          statusCode: 500,
          retryable: false,
          severity: 'warning',
        })
        permanentUrl = cloudinaryUrl
      }
    }

    // Update DB to COMPLETED
    const updated = await db.generatedVisual.update({
      where: { id: visual.id },
      data:  { status: 'COMPLETED', imageUrl: permanentUrl },
    })

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'IMAGE_GENERATION',
      deduction: credit,
    })
    if (!finalization.ok) {
      return NextResponse.json({
        error: 'Image was saved but the credit operation could not be finalized. Reserved credits were returned; refresh the visual library.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
        visual: updated,
      }, { status: 503 })
    }

    return NextResponse.json({
      visual: updated,
      assetRole,
      outputClassification: assetRole === 'final_composited_ad'
        ? 'final_composited_ad_for_review'
        : IMAGE_OUTPUT_CLASSIFICATION,
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: buildCreditChargeReceipt('IMAGE_GENERATION', credit),
    })
  } catch (err: unknown) {
    await captureOperationalError(err, {
      operation: 'ai.image-generate',
      route: '/api/visuals/generate',
      component: 'ai',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })

    const publicFailureMessage = 'NEXUS Image Studio could not create a usable image. Reserved credits will be restored.'

    // Update DB to FAILED (non-blocking)
    await db.generatedVisual.update({
      where: { id: visual.id },
      data:  { status: 'FAILED', errorMessage: publicFailureMessage },
    }).catch(() => {})

    // Refund — the user must not be charged for a failed image (skip unlimited plans)
    const refund = await refundDeductedCredits(userId, credit, publicFailureMessage)

    return NextResponse.json({
      error: publicFailureMessage,
      message: refund.refundPending
        ? 'Image generation failed. Credit restoration is pending automatic reconciliation.'
        : undefined,
      refunded: refund.refunded,
      refundPending: refund.refundPending,
    }, { status: 500 })
  }
}
