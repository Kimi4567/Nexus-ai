/**
 * POST /api/visuals/generate
 *
 * Strategy-driven image generation.
 * Fetches Brand Brain + Strategy from DB to build a rich VisualContext,
 * then routes to the correct brand-category prompt builder.
 *
 * Provider selection is automatic (server-side):
 *   - FAL_KEY present → Flux 1.1 Pro Ultra via fal.ai (best photorealism, ~$0.06/image)
 *   - FAL_KEY absent  → gpt-image-1 high quality (reliable fallback)
 *
 * Clients do not choose the provider — it's an infrastructure decision.
 * Returns the completed visual synchronously (Vercel 60s timeout).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import {
  CREDIT_COSTS,
  checkAndDeductCredits,
  checkDailyImageCap,
  refundCredits,
  refundCreditsForTransaction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { validateSingleImageGenerationConfirmation } from '@/lib/contentHubActionSafety'
import {
  buildImagePrompt,
  generateWithDallE,
  uploadToCloudinary,
  VisualContext,
  VisualStyle,
  VisualType,
} from '@/lib/ai/imageGen'
import { generateWithFlux, platformToFluxSize, platformToOpenAISize } from '@/lib/ai/falGen'
import { platformToOverlay } from '@/lib/cloudinaryOverlay'
import { composeBrandedPost, bufferToDataUri } from '@/lib/brandComposite'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export const maxDuration = 60 // Vercel function timeout

async function refundDeductedCredits(userId: string, credit: CreditDeductionOk, reason: string) {
  if (credit.creditsUsed <= 0) return
  if (credit.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: credit.transactionId, reason })
    return
  }
  await refundCredits(userId, 'IMAGE_GENERATION', reason)
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

  // ── Extract Strategy fields from aiOutput ─────────────────────────────────
  const aiOutput = (campaign?.aiOutput as any) || {}
  const strategy = aiOutput.strategy || {}

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
  }

  // ── Build the caption-driven, brand-adaptive ad prompt (async) ───────────
  // For Arabic posts: prompt is background-only; concept.headline is composited
  // as a separate Satori layer in composeBrandedPost() below.
  const { prompt, language, concept } = await buildImagePrompt(ctx)

  // ── Deduct credits before expensive DALL-E call ───────────────────────────
  const credit = await checkAndDeductCredits(userId, 'IMAGE_GENERATION')
  if (!credit.ok) return NextResponse.json(credit, { status: 402 })

  // ── Create the DB record in GENERATING state ──────────────────────────────
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
    console.error('[visuals/generate] DB create error (table may not exist yet):', dbErr)
    // Proceed without DB persistence — useful during schema migrations
    try {
      const dalleUrl = await generateWithDallE(prompt)
      return NextResponse.json({
        visual: {
          id: `temp-${Date.now()}`,
          imageUrl: dalleUrl,
          status: 'COMPLETED',
          visualType,
          visualStyle,
          prompt,
        },
      })
    } catch (genErr: any) {
      // Refund — failed generation must not charge the user (skip unlimited plans)
      await refundDeductedCredits(userId, credit, genErr.message || 'Generation failed')
      return NextResponse.json({ error: genErr.message || 'Generation failed', refunded: credit.creditsUsed > 0 }, { status: 500 })
    }
  }

  // ── Run generation — server auto-detects provider ────────────────────────
  // If FAL_KEY is configured → Flux 1.1 Pro Ultra (best photorealism)
  // Otherwise → gpt-image-1 high quality (default)
  // Client never controls this — provider is an infrastructure decision, not a UI choice.
  try {
    let rawImageUrl: string
    const useFlux = !!process.env.FAL_KEY

    if (useFlux) {
      // Flux 1.1 Pro Ultra — best photorealism, returns hosted CDN URL
      const fluxSize = platformToFluxSize(platform)
      console.log(`[visuals/generate] Using Flux Pro Ultra — size: ${fluxSize}`)
      const fluxResult = await generateWithFlux({ prompt, imageSize: fluxSize })
      rawImageUrl = fluxResult.imageUrl
    } else {
      // gpt-image-1 high quality — returns base64 data URI
      console.log(`[visuals/generate] Using gpt-image-1 high quality — platform: ${platform}`)
      rawImageUrl = await generateWithDallE(prompt, platformToOpenAISize(platform))
    }

    // ── Persist raw AI image to Cloudinary (needed for Sharp to fetch it) ──
    const rawPublicId   = `visual_raw_${visual.id}`
    const cloudinaryUrl = await uploadToCloudinary(rawImageUrl, rawPublicId)

    // ── Apply Sharp brand composite ───────────────────────────────────────
    // Both Arabic and English prompts now generate background-only scenes.
    // brandComposite handles all text: brand name bar, ad headline overlay.
    //   Arabic headline → Satori + Noto Naskh Arabic (pixel-perfect RTL)
    //   English headline → SVG text layer (Sharp handles Latin well)
    // Falls back gracefully if Sharp fails.
    let permanentUrl = cloudinaryUrl
    const overlayPlatform = platformToOverlay(platform)

    try {
      const compositeBuffer = await composeBrandedPost(cloudinaryUrl, {
        brandName:   brand?.brandName || ctx.brandName || 'Brand',
        logoUrl:     brand?.logoUrl   || null,
        accentColor: brand?.colorPalette
          ? (Array.isArray(brand.colorPalette) ? brand.colorPalette[0] : brand.colorPalette)
          : null,
        platform:    overlayPlatform,
        // Pass the concept headline for ALL languages — compositor routes Arabic through
        // Satori and English/Latin through SVG, both producing clean text overlays on
        // the text-free AI background.
        adHeadline: concept?.headline || undefined,
      })

      const finalPublicId = `visual_${visual.id}`
      permanentUrl = await uploadToCloudinary(
        bufferToDataUri(compositeBuffer),
        finalPublicId
      )
      console.log(`[visuals/generate] Sharp composite applied for "${ctx.brandName}" on ${overlayPlatform}`)
    } catch (compositeErr) {
      console.warn('[visuals/generate] Sharp composite failed — returning raw image:', compositeErr)
      permanentUrl = cloudinaryUrl
    }

    // Update DB to COMPLETED
    const updated = await db.generatedVisual.update({
      where: { id: visual.id },
      data:  { status: 'COMPLETED', imageUrl: permanentUrl },
    })

    return NextResponse.json({ visual: updated })
  } catch (err: any) {
    console.error('[visuals/generate] Generation error:', err)

    // Update DB to FAILED (non-blocking)
    await db.generatedVisual.update({
      where: { id: visual.id },
      data:  { status: 'FAILED', errorMessage: err.message || 'Generation failed' },
    }).catch(() => {})

    // Refund — the user must not be charged for a failed image (skip unlimited plans)
    await refundDeductedCredits(userId, credit, err.message || 'Image generation failed')

    return NextResponse.json({ error: err.message || 'Image generation failed', refunded: credit.creditsUsed > 0 }, { status: 500 })
  }
}
