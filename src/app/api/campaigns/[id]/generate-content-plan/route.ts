/**
 * Content Plan Generation API
 * POST /api/campaigns/[id]/generate-content-plan
 *
 * Generates the full monthly content plan for a campaign:
 * - Reads strategy from campaign.aiOutput
 * - Checks user's plan quota (PLAN_QUOTAS)
 * - Uses GPT-4o-mini to generate post captions + image prompts for each slot
 * - Detects user's uploaded media and optionally assigns to posts
 * - Creates SocialPost records with status=DRAFT, generationStatus=PENDING
 * - Video slots get isVideoPost=true, no image generation — user uploads their own
 *
 * DELETE /api/campaigns/[id]/generate-content-plan
 * Clears all PENDING/DRAFT content plan posts (not yet published)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  checkAndDeductCredits,
  refundCredits,
  refundCreditsForTransaction,
  getCreditActionPolicy,
  type CreditAction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { PLAN_QUOTAS } from '@/lib/stripe'
import { resolvePostCaption } from '@/lib/contentPlanCaption'
import {
  generateContentPlanWithRetry,
  contentPlanFailureResponse,
  resolveContentPlanSlotScope,
} from '@/lib/contentPlanGeneration'
import { sendContentPlanReadyEmail } from '@/lib/email/resend'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { buildProofPolicyPrompt, guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import {
  buildContentDraftTruthPolicyPrompt,
  guardContentDraftText,
  guardContentDraftTruth,
} from '@/lib/ai/contentDraftTruthGuard'
import {
  renderContentPlanDraftCaption,
  renderContentPlanDraftImagePrompt,
  validateContentPlanDraftForSave,
} from '@/lib/contentPlanStructuredRenderer'
import { validateContentPlanSemanticAlignment } from '@/lib/contentPlanSemanticGuard'
import { resolveContentPlanBrandName } from '@/lib/contentPlanBrandContext'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import { readLockedPlannedPostAllowance } from '@/lib/postCommercial'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'

// Heavy gpt-4o generation (up to 18 posts) + optional media vision can run well
// past the platform default. Match the sibling routes (engine, /generate) so the
// function isn't killed mid-generation — the real cause of intermittent 502s.
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

// ── Platform distribution helpers ─────────────────────────────────────────────

/**
 * Map a destination to its provider integration. The exact destination is
 * persisted separately as publishTarget and must never be inferred from META.
 */
function toIntegrationType(raw: string): string {
  const map: Record<string, string> = {
    INSTAGRAM: 'META',
    FACEBOOK:  'META',
    TWITTER:   'X',
    X:         'X',
    SNAPCHAT:  'META',
    PINTEREST: 'PINTEREST',
    REELS:     'META',
    STORIES:   'META',
    THREADS:   'THREADS',
    LINKEDIN:  'LINKEDIN',
    TIKTOK:    'TIKTOK',
    YOUTUBE:   'YOUTUBE',
    YOUTUBE_SHORTS: 'YOUTUBE',
    META:      'META',
    GOOGLE:    'GOOGLE',
  }
  return map[raw.toUpperCase()] ?? 'META'
}

function normalizedPublishTarget(raw: string): string {
  const target = raw.toUpperCase()
  return target === 'TWITTER' ? 'X' : target
}

// Neutral review-time proposals. Nexus does not label a universal hour as
// "best" without eligible workspace-specific platform evidence.
function proposedReviewHour(slotIndex: number): number {
  return [10, 14, 18][slotIndex % 3]
}

/** Distribute N posts across an array of platforms as evenly as possible */
function distributePosts(
  totalPosts: number,
  totalVideoSlots: number,
  platforms: string[],
): Array<{ platform: string; publishTarget: string; isVideoPost: boolean; index: number }> {
  if (!platforms.length) platforms = ['META']

  const slots: Array<{ platform: string; publishTarget: string; isVideoPost: boolean; index: number }> = []
  let idx = 0

  // Interleave posts across destinations while retaining the exact channel.
  for (let i = 0; i < totalPosts; i++) {
    const publishTarget = normalizedPublishTarget(String(platforms[i % platforms.length] || 'META'))
    slots.push({ platform: toIntegrationType(publishTarget), publishTarget, isVideoPost: false, index: idx++ })
  }

  // Distribute video slots with the same destination contract.
  for (let i = 0; i < totalVideoSlots; i++) {
    const publishTarget = normalizedPublishTarget(String(platforms[i % platforms.length] || 'META'))
    slots.push({ platform: toIntegrationType(publishTarget), publishTarget, isVideoPost: true, index: idx++ })
  }

  return slots
}

// ── Main POST handler ──────────────────────────────────────────────────────────

async function refundContentActionCharge(
  userId: string,
  charge: CreditDeductionOk | null,
  action: Extract<CreditAction, 'CONTENT_PLAN_GENERATION' | 'CONTENT_AB_VARIANTS'>,
  reason: string,
): Promise<void> {
  if (!charge || charge.creditsUsed <= 0) return
  if (charge.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: charge.transactionId, reason })
    return
  }
  await refundCredits(userId, action, reason)
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Hoisted so any failure below the deduction (incl. the outer catch) can refund.
  let contentPlanCharged = false
  let contentPlanCharge: CreditDeductionOk | null = null
  let abVariantsCharged = false
  let abVariantsCharge: CreditDeductionOk | null = null
  const refundAbVariants = async (reason: string) => {
    if (!abVariantsCharged) return false
    await refundContentActionCharge(userId, abVariantsCharge, 'CONTENT_AB_VARIANTS', reason)
    abVariantsCharged = false
    return true
  }
  const refundAllRequestedContent = async (reason: string) => {
    const abRefunded = await refundAbVariants(reason)
    let planRefunded = false
    if (contentPlanCharged) {
      await refundContentActionCharge(userId, contentPlanCharge, 'CONTENT_PLAN_GENERATION', reason)
      contentPlanCharged = false
      planRefunded = true
    }
    return abRefunded || planRefunded
  }
  try {
    // ── 1. Load campaign ───────────────────────────────────────────────────
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      include: {
        workspace: {
          include: {
            brandProfile: {
              select: {
                brandName: true,
                industry: true,
                description: true,
                primaryOffer: true,
                targetAudience: true,
                audienceAge: true,
                audienceLocation: true,
                audiencePainPoints: true,
                audienceDesires: true,
                uniqueAdvantages: true,
                toneKeywords: true,
                writingStyle: true,
                avoidKeywords: true,
                topPlatforms: true,
                businessGoal: true,
                competitors: true,
                competitorNotes: true,
                complianceNotes: true,
                verifiedProof: true,
                conversionDestination: true,
              },
            },
          },
        },
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (!canMutateCampaignExecution(String(campaign.status))) {
      return NextResponse.json({
        error: 'Approve the campaign strategy before generating content.',
        code: 'STRATEGY_APPROVAL_REQUIRED',
      }, { status: 409 })
    }

    const workspaceId = campaign.workspaceId
    const brandProfile = campaign.workspace?.brandProfile
    const explicitBrandFacts = [
      brandProfile?.brandName,
      brandProfile?.industry,
      brandProfile?.description,
      brandProfile?.primaryOffer,
      brandProfile?.targetAudience,
      brandProfile?.audienceAge,
      brandProfile?.audienceLocation,
      brandProfile?.audiencePainPoints ?? [],
      brandProfile?.audienceDesires ?? [],
      brandProfile?.uniqueAdvantages ?? [],
      brandProfile?.complianceNotes,
      brandProfile?.verifiedProof ?? [],
    ]
      .flatMap(value => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    // ── 2. Require real strategy evidence before spending credits ──────────
    const aiOutput = campaign.aiOutput as any
    const strategy = aiOutput?.strategy ?? aiOutput ?? {}
    const proofContext = {
      verifiedProof: brandProfile?.verifiedProof ?? [],
      allowedClaimText: explicitBrandFacts,
      hasConversionDestination: Boolean(brandProfile?.conversionDestination),
      brandFacts: explicitBrandFacts,
    }
    const strategyForContent = guardStrategyProof(strategy, proofContext)
    const strategyQualityGate = reviewStrategyGrounding({
      strategy: strategyForContent,
      brand: brandProfile,
      allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms.map(String) : [],
      goal: campaign.goal,
    })

    if (strategyQualityGate.status === 'blocked') {
      return NextResponse.json({
        error: 'The approved strategy no longer passes the current Brand Brain and channel-scope review. Regenerate or re-review the strategy before creating content.',
        code: 'MARKETING_QUALITY_GATE_BLOCKED',
        qualityGate: strategyQualityGate,
        creditsUsed: 0,
      }, { status: 422 })
    }

    const hasRealStrategyEvidence =
      !!aiOutput &&
      typeof aiOutput === 'object' &&
      (
        typeof strategy.keyMessage === 'string' && strategy.keyMessage.trim().length > 0 ||
        typeof strategy.coreMessage === 'string' && strategy.coreMessage.trim().length > 0 ||
        typeof strategy.primaryOffer === 'string' && strategy.primaryOffer.trim().length > 0 ||
        Array.isArray(strategy.contentPillars) && strategy.contentPillars.length > 0
      )

    if (!hasRealStrategyEvidence) {
      return NextResponse.json(
        {
          error: 'STRATEGY_REQUIRED',
          message: 'Run or review a strategy before generating a content plan.',
          action: 'RUN_STRATEGY_FIRST',
        },
        { status: 422 },
      )
    }

    // ── 3. Check plan quota ────────────────────────────────────────────────
    const initialAllowance = await prisma.$transaction((tx) =>
      readLockedPlannedPostAllowance(tx, userId, params.id),
    )
    const planName = initialAllowance.plan.toLowerCase()
    const quota = PLAN_QUOTAS[planName] ?? PLAN_QUOTAS['free']

    // Strategy-order runs are binding. Resolve this before credit deduction so
    // paid-planning-only or missing-scope campaigns fail without spending.
    const slotScope = resolveContentPlanSlotScope(aiOutput, quota)
    if (!slotScope.canGenerate) {
      return NextResponse.json(
        {
          error: 'CONTENT_PLAN_NOT_INCLUDED',
          code: slotScope.blockedReason === 'paid-planning-only'
            ? 'PAID_PLANNING_ONLY'
            : 'NO_ORGANIC_CONTENT_PLAN_SCOPE',
          message: slotScope.blockedReason === 'paid-planning-only'
            ? 'This campaign was generated as a paid planning brief only. It does not include an organic Content Hub plan.'
            : 'This strategy does not include a saved organic post-count scope for Content Hub generation.',
        },
        { status: 422 },
      )
    }
    if (slotScope.totalSlots > initialAllowance.remaining) {
      return NextResponse.json({
        error: 'POST_LIMIT_REACHED',
        limit: initialAllowance.limit,
        current: initialAllowance.used,
        requested: slotScope.totalSlots,
        resetsAt: initialAllowance.periodEnd.toISOString(),
        upgradeUrl: '/billing',
      }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const bodyLanguage: string = body.language ?? aiOutput?.language ?? ''
    const enableABTesting: boolean = body.enableABTesting ?? false

    if (enableABTesting && slotScope.imagePosts <= 0) {
      return NextResponse.json({
        error: 'A/B caption variants require at least one image-post slot. No credits were charged.',
        code: 'AB_VARIANTS_REQUIRE_IMAGE_POSTS',
        creditsUsed: 0,
      }, { status: 422 })
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(bodyLanguage), { status: 503 })
    }

    // ── 4. Deduct credits (flat 2 credits per content plan generation) ────
    const creditCheck = await checkAndDeductCredits(userId, 'CONTENT_PLAN_GENERATION')
    if (!creditCheck.ok) {
      return NextResponse.json(
        {
          ...creditCheck,
          code: creditCheck.error ?? 'INSUFFICIENT_CREDITS',
        },
        { status: 402 },
      )
    }
    contentPlanCharged = creditCheck.creditsUsed > 0 // skip refund for unlimited plans
    contentPlanCharge = creditCheck

    // A/B variants are an explicit second AI product, not hidden work inside the
    // base plan. Charge separately before either model call; if it cannot be
    // afforded, restore the base-plan debit and do no AI work.
    if (enableABTesting) {
      const abCreditCheck = await checkAndDeductCredits(userId, 'CONTENT_AB_VARIANTS')
      if (!abCreditCheck.ok) {
        await refundAllRequestedContent('Optional A/B variants could not be funded; base content generation did not start')
        return NextResponse.json({
          ...abCreditCheck,
          code: abCreditCheck.error ?? 'INSUFFICIENT_CREDITS',
          requestedActions: [
            getCreditActionPolicy('CONTENT_PLAN_GENERATION'),
            getCreditActionPolicy('CONTENT_AB_VARIANTS'),
          ],
        }, { status: 402 })
      }
      abVariantsCharged = abCreditCheck.creditsUsed > 0
      abVariantsCharge = abCreditCheck
    }

    const brandName    = resolveContentPlanBrandName(campaign)
    const campaignName = campaign.name ?? 'Campaign'

    // Draft scope comes from the reviewed strategy/campaign. Connections affect
    // scheduling and publishing readiness, never the content promise itself.
    const platforms: string[] = Array.isArray(campaign.platforms) && campaign.platforms.length > 0
      ? campaign.platforms.map(String)
      : (brandProfile?.topPlatforms?.map(String) ?? ['META'])

    const keyMessage    = strategyForContent.keyMessage ?? strategyForContent.coreMessage ?? ''
    const targetAudience = brandProfile?.targetAudience
      || strategyForContent.targetAudienceRefined
      || (strategyForContent.targetAudience ? JSON.stringify(strategyForContent.targetAudience) : '')
      || campaign.audience
      || ''
    const contentPillars: string[] = strategyForContent.contentPillars?.map((p: any) =>
      typeof p === 'string' ? p : p.pillar ?? p.name ?? JSON.stringify(p),
    ) ?? []
    const tone = [
      ...(brandProfile?.toneKeywords ?? []),
      brandProfile?.writingStyle ?? '',
    ].filter(Boolean).join(', ') || String(campaign.tone ?? 'professional')
    const offer = brandProfile?.primaryOffer ?? strategyForContent.primaryOffer ?? strategyForContent.cta ?? ''

    // ── 5. Check for uploaded media the user wants to use ─────────────────
    const mediaSource: 'GENERATE' | 'UPLOAD' | 'MIXED' = body.mediaSource ?? 'GENERATE'
    const hasExplicitMediaSelection = Array.isArray(body.selectedMediaIds) || Array.isArray(aiOutput?.selectedMediaIds)
    const persistedSelectedMediaIds = Array.isArray(aiOutput?.selectedMediaIds)
      ? aiOutput.selectedMediaIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : []
    const selectedMediaIds: string[] = Array.isArray(body.selectedMediaIds)
      ? body.selectedMediaIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : persistedSelectedMediaIds
    // OC3: Accept language + contentMix from organic content wizard
    const contentMix: { educational?: number; promotional?: number; engagement?: number } =
      body.contentMix ?? {}
    const educationalPct  = contentMix.educational  ?? 35
    const promotionalPct  = contentMix.promotional  ?? 30
    const engagementPct   = contentMix.engagement   ?? 35

    let userMedia: Array<{ id: string; url: string; type: string; fileName: string; aiDescription?: string }> = []
    const shouldLoadMedia = selectedMediaIds.length > 0 || (mediaSource !== 'GENERATE' && !hasExplicitMediaSelection)
    if (shouldLoadMedia) {
      userMedia = await prisma.media.findMany({
        where: {
          workspaceId,
          ...(selectedMediaIds.length ? { id: { in: selectedMediaIds } } : {}),
          type: { in: ['IMAGE' as any, 'LOGO' as any, 'VIDEO' as any] },
        },
        select: { id: true, url: true, type: true, fileName: true },
        take: 20,
      })

      // Media analysis is intentionally not hidden inside the content-plan fee.
      // Until a separately priced media-analysis action exists, the planner uses
      // only user-visible file metadata and never performs unmetered Vision calls.
    }

    // ── 6. Build slot distribution ─────────────────────────────────────────
    // For strategy-order runs, the reviewed StrategyOrder/deliverables contract
    // is binding. If the user reviewed 7 first-window organic post directions,
    // this route must create exactly 7 SocialPost drafts total. Plan quota counts
    // remain only the fallback for legacy campaigns without a saved order.
    const slots = distributePosts(slotScope.imagePosts, slotScope.videoSlots, platforms)

    // ── 7. Generate all post content via GPT-4o-mini ─────────────────────
    const pillarText = contentPillars.length
      ? contentPillars.slice(0, 5).join(', ')
      : 'brand awareness, engagement, conversion'
    const strategyAngles: any[] = Array.isArray(strategyForContent.contentAnglesDetailed)
      ? strategyForContent.contentAnglesDetailed
      : []
    const operatingStrategyContext = JSON.stringify({
      diagnosis: strategyForContent.diagnosis ?? null,
      differentiation: strategyForContent.differentiation ?? null,
      audienceSegments: Array.isArray(strategyForContent.audienceSegmentsDetailed)
        ? strategyForContent.audienceSegmentsDetailed.slice(0, 4)
        : [],
      contentAngles: strategyAngles.slice(0, 8),
      funnelStages: Array.isArray(strategyForContent.funnelStages)
        ? strategyForContent.funnelStages.slice(0, 5)
        : [],
      offerCTA: strategyForContent.offerCTAStrategy ?? null,
      weeklyExecutionPlan: Array.isArray(strategyForContent.weeklyExecutionPlan)
        ? strategyForContent.weeklyExecutionPlan.slice(0, 6)
        : [],
      risks: Array.isArray(strategyForContent.riskNotes)
        ? strategyForContent.riskNotes.slice(0, 8)
        : [],
    }, null, 2).slice(0, 12_000)

    // Build language instruction — use the smart helper (bilingual = per-platform smart assignment, never mixed)
    const languageInstruction = getLanguageInstruction(bodyLanguage || undefined)
    const proofPolicy = buildProofPolicyPrompt(proofContext)
    const draftTruthPolicy = buildContentDraftTruthPolicyPrompt()

    // Build media context for GPT if user selected real assets
    const mediaContext = userMedia.length > 0
      ? `\nAVAILABLE MEDIA ASSETS (user's real uploaded content — assign to posts):
${userMedia.map((m, idx) => {
  const label = m.type === 'VIDEO' ? '🎬 Video' : '🖼 Image'
  const desc = m.aiDescription ? `: ${m.aiDescription}` : ` (${m.fileName})`
  return `[MEDIA_${idx}] ${label}${desc}`
}).join('\n')}

When assigning media to a post, set "assignedMediaIndex" to the [MEDIA_X] index (0-based). If no media fits a post, set "assignedMediaIndex" to -1 and use "imagePrompt" instead.`
      : ''

    const systemPrompt = `You are an expert social media content strategist for ${brandName}.

Campaign: "${campaignName}"
Business category: "${brandProfile?.industry ?? 'Not provided'}"
Business description: "${brandProfile?.description ?? 'Not provided'}"
Key message: "${keyMessage}"
Target audience: ${targetAudience}
Content pillars: ${pillarText}
Tone: ${tone}
Offer/CTA: ${offer}
Audience pain points: ${(brandProfile?.audiencePainPoints ?? []).join(' | ') || 'Not provided'}
Audience desires: ${(brandProfile?.audienceDesires ?? []).join(' | ') || 'Not provided'}
Forbidden brand words/styles: ${(brandProfile?.avoidKeywords ?? []).join(' | ') || 'None provided'}
Agency-grade operating strategy context:
${operatingStrategyContext}
${mediaContext}
${languageInstruction}
${proofPolicy}
${draftTruthPolicy}

If the saved strategy contains unsupported proof terms, treat them as proof gaps, not content instructions. Create proof-collection prompts or factual educational content instead.
Avoid superlative/perfection language (perfect, finest, best), "Perfect for...", "perfect choice", "perfect fit", "perfect way to", ensure/guarantee/always-stocked phrasing, and unbounded delivery claims. Use practical, well-suited, helpful, or designed-for language instead. Delivery must be bounded with where available, supported zones, or timing depends on location; Arabic output must avoid أفضل/مثالي/مثالية/مضمون/دائمًا as absolute or broad fit claims unless directly supported.
Avoid broad Arabic perfection wording such as "قهوة مثالية", "تجربة مثالية", "نتائج مثالية", or "تحضير مثالي". Prefer grounded wording such as "قهوة متوازنة", "تجربة أكثر اتساقًا", "تحضير عملي", or "خطوات عملية". Do not claim perfect results unless exact user-provided proof exists.
Avoid contextual Arabic coffee perfection phrases such as "قهوة صباحية مثالية", "القهوة الصباحية المثالية", "كوب قهوة مثالي", and "فنجان قهوة مثالي" unless exact user-provided proof exists. Prefer grounded wording like "قهوة صباحية أكثر اتساقًا", "كوب قهوة متوازن", or "فنجان قهوة متوازن".
Avoid broad Arabic quality/superlative phrases like "أفضل نكهة", "أفضل تجربة", "بجودة لا تقاوم", and "نكهة فريدة" unless exact user-provided proof exists. Prefer grounded wording like "نكهة متوازنة", "جودة مختارة بعناية", "تجربة أكثر اتساقًا", or "خطوات عملية".
Avoid residual broad "best/premium" quality wording such as "أفضل الحبوب", "أفضل حبوب القهوة", "premium experience", "premium quality", "best beans", and "best flavor" unless exact user-provided proof exists. Prefer grounded wording like "حبوب مختارة بعناية", "مذاق متوازن", "more considered experience", "carefully selected beans", or "balanced flavor".
Avoid English hype such as "irresistible", "extraordinary", "unmatched", and broad "unique coffee experience" claims unless exact user-provided proof exists.
Do not claim coffee improves productivity, morale, focus, energy, team performance, workplace output, or business results unless the user provided verified proof. For office coffee, frame benefits as easier planning, more consistent coffee routines, and more enjoyable breaks.

CONTENT MIX: Distribute the posts as follows (approximate percentages):
- Educational/informational posts: ${educationalPct}% (teach, explain, share tips)
- Promotional/conversion posts: ${promotionalPct}% (sell, highlight offer, drive action)
- Engagement/community posts: ${engagementPct}% (ask questions, share stories, spark conversation)

Generate platform-native social media posts. Each post must:
- Feel native to its platform (length, style, hashtags)
- Rotate across the content pillars
- Have a clear hook in the first sentence
- Include a call to action
- Follow the language rule above strictly
- Advance one coherent campaign narrative instead of behaving like unrelated tips: establish the problem, explain the mechanism, handle objections/proof gaps, then invite the next conversion step.
- Use a meaningfully different hook structure, audience pain, message angle, and CTA from every other post. Rephrasing the same advice does not count as a new post.
- Ground the post in one detailed audience segment, content angle, or funnel stage from the operating strategy context when available.
- Match the CTA to the funnel handoff. If the strategy says the team must reply, qualify, book, or send an offer, make that next step clear without inventing a destination.
- Adapt presentation to the platform without changing the saved customer, offer, or business type. LinkedIn must stay customer-facing for a consumer/service brand (education, community trust, or professional expertise); never turn it into internal administration, team workflow, ownership, handoff, or SaaS operations unless Brand Brain explicitly says the offer is operations software. Instagram should lead with a visual/saveable idea; short-form video should lead with a scene and retention hook.
- Mention the brand only when it strengthens the message or CTA. Do not repeat the brand name mechanically in every post.
- Treat missing proof, competitor data, tracking, or conversion details as a content/review gap. Never convert a gap into a factual claim.
- Make educational posts self-contained: include the actual checklist, steps, or fact in the caption instead of teasing a tutorial or guide that is not present.
- Use only correctly formed, meaningful hashtags. If you use a brand hashtag, remove spaces and punctuation from the exact brand name and add no invented suffix.
- Reject generic hype and unsupported expertise wording such as "as fresh as it gets", "taste the difference", "expert tips", "elevate your", or "transform your experience".

Return a JSON array of exactly ${slots.length} post objects:
[
  {
    "index": 0,
    "platform": "META",
    "isVideoPost": false,
    "caption": "full post caption text with hashtags — written to complement the assigned media if any",
    "imagePrompt": "detailed DALL-E prompt describing the image (only if assignedMediaIndex is -1)",
    "assignedMediaIndex": -1,
    "scheduledDayOffset": 1
  }
]

Rules:
- caption: platform-appropriate length (Instagram ≤ 2200 chars, X ≤ 280 chars, LinkedIn ≤ 1300 chars, Facebook ≤ 500 chars)
- assignedMediaIndex: 0-based index into the AVAILABLE MEDIA ASSETS list above. Set to -1 if no media is available or none fits this post.
- imagePrompt: only needed when assignedMediaIndex is -1. Vivid, specific, brand-consistent visual description. No text overlays.
- If media assets are provided, assign each asset to EXACTLY ONE post (no reuse). Leave all other posts with assignedMediaIndex: -1 so they get AI-generated images.
- isVideoPost=true slots: write a videoCaption and videoScript field instead of imagePrompt
- scheduledDayOffset: spread posts across 30 days (1–30). With ${slots.length} posts that's roughly ${Math.ceil(slots.length / 4)} per week — aim for consistent spacing (every 2-3 days). Avoid bunching too many on the same day.
- This saved Content Hub run is bound to the reviewed strategy/order scope. Do not add extra posts beyond the provided slot list.`

    const userMsg = `Generate content plan for ${slots.length} posts. Each slot is bound to its expectedStrategyAngle; keep that post's hook, pain, message, and CTA grounded in that angle. Slots: ${JSON.stringify(
      slots.map((s, index) => ({
        index: s.index,
        platform: s.publishTarget,
        isVideoPost: s.isVideoPost,
        expectedStrategyAngle: strategyAngles.length > 0
          ? strategyAngles[index % strategyAngles.length]
          : null,
      })),
    )}`

    // Single content-plan request body (rebuilt fresh for every retry attempt).
    const chatRequestBody = JSON.stringify({
      model: 'gpt-4o',  // Content plan posts — user publishes these directly
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.45,
      response_format: { type: 'json_object' },
    })

    // Safe in-process retry: a transient provider error (429/5xx/network) or a
    // slow first response no longer drops the user into a no-plan 502 — we retry
    // before writing any posts, so no duplicates and no second charge.
    // Deterministic failures (truncated/malformed) short-circuit and refund.
    const { result: planResult, attempts: planAttempts } = await generateContentPlanWithRetry(
      () => fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: chatRequestBody,
      }),
    )

    if (!planResult.ok) {
      // No usable content after retries — refund (skip unlimited plans) and
      // surface a clear, user-safe failure instead of a silent empty plan.
      const refunded = await refundAllRequestedContent(`No content generated (${planResult.reason})`)
      console.error(
        `[generate-content-plan] failed after ${planAttempts} attempt(s): ${planResult.reason}`,
      )
      const fail = contentPlanFailureResponse(planResult.reason, refunded)
      return NextResponse.json(fail.body, { status: fail.status })
    }

    const generatedPosts: any[] = guardContentDraftTruth(planResult.posts, proofContext)

    // ── 9. Create SocialPost records ──────────────────────────────────────
    const now = new Date()

    // Helper: generate a simple UUID-like group ID for A/B pairs
    function makeVariantGroup(): string {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    }

    // Pre-compute A/B variant groups per image slot (non-video only)
    // Each image slot index → variantGroup string (shared between A and B)
    const variantGroups: Record<number, string> = {}
    if (enableABTesting) {
      slots.forEach((slot, i) => {
        if (!slot.isVideoPost) variantGroups[i] = makeVariantGroup()
      })
    }

    // Arabic for ar/bilingual/unset campaigns; English only when explicitly 'en'.
    const isArabic = (bodyLanguage || '').toLowerCase() !== 'en'

    const postsToCreate = slots.map((slot, i) => {
      const gen = generatedPosts[i] ?? generatedPosts.find((g: any) => g.index === slot.index) ?? {}
      // Video slots return videoCaption (not caption). Prefer real AI copy; only
      // fall back to language-aware brand copy — never an English placeholder.
      const caption = renderContentPlanDraftCaption(gen, {
        ...proofContext,
        isArabic,
        brand: brandName,
        campaignName,
        keyMessage,
        targetAudience,
        contentPillars,
        offer,
        platform: slot.publishTarget,
        postIndex: i,
      }) || guardContentDraftText(
        resolvePostCaption(gen, { isArabic, brand: brandName, hint: keyMessage || offer || campaignName }),
        proofContext,
      )
      const imagePrompt = renderContentPlanDraftImagePrompt(gen, {
        ...proofContext,
        isArabic,
        brand: brandName,
        campaignName,
        keyMessage,
        targetAudience,
        contentPillars,
        offer,
        platform: slot.publishTarget,
        postIndex: i,
      })
      const videoPrompt = guardContentDraftText(gen.videoScript ?? gen.videoCaption ?? '', proofContext)
      const dayOffset = Math.max(1, Math.min(30, gen.scheduledDayOffset ?? i + 1))

      const scheduledAt = new Date(now)
      scheduledAt.setDate(now.getDate() + dayOffset)
      scheduledAt.setHours(proposedReviewHour(i), 0, 0, 0)

      // Resolve media assignment:
      // 1. GPT may have assigned a specific media asset via assignedMediaIndex
      // 2. Fall back to round-robin assignment if mediaSource is UPLOAD/MIXED
      // 3. Fall back to image generation if no media
      let uploadedMediaId: string | null = null
      let assignedImageUrl: string | null = null
      let effectiveMediaSource = mediaSource
      let effectiveGenerationStatus = slot.isVideoPost ? 'AWAITING_UPLOAD' : 'PENDING'

      const gptAssignedIdx: number = gen.assignedMediaIndex ?? -1

      if (!slot.isVideoPost) {
        if (gptAssignedIdx >= 0 && gptAssignedIdx < userMedia.length) {
          // GPT assigned a specific media asset to this post
          const assignedMedia = userMedia[gptAssignedIdx]
          uploadedMediaId = assignedMedia.id
          assignedImageUrl = assignedMedia.url
          effectiveMediaSource = 'UPLOAD'
          effectiveGenerationStatus = 'DONE' // no generation needed — real image assigned
        } else if (mediaSource !== 'GENERATE' && userMedia.length > 0 && i < userMedia.length) {
          // Fallback: 1-to-1 assignment — each uploaded image goes to exactly one post
          // Posts beyond the uploaded count remain empty (PENDING) for AI image generation
          const media = userMedia[i]
          uploadedMediaId = media.id
          assignedImageUrl = media.url
          effectiveMediaSource = 'UPLOAD'
          effectiveGenerationStatus = 'DONE'
        }
      } else {
        effectiveMediaSource = 'UPLOAD' // videos always user-uploaded
      }

      return {
        workspaceId,
        campaignId: params.id,
        platform: slot.platform as any,
        publishTarget: slot.publishTarget,
        caption,
        imagePrompt: slot.isVideoPost ? null : imagePrompt,
        videoPrompt: slot.isVideoPost ? videoPrompt : null,
        imageUrl: assignedImageUrl,
        isVideoPost: slot.isVideoPost,
        generationStatus: effectiveGenerationStatus,
        mediaSource: effectiveMediaSource,
        uploadedMediaId,
        contentPlanIndex: slot.index + 1,
        status: 'DRAFT' as const,
        scheduledAt,
        autoGenerated: true,
        // A/B fields — set A label + group for image slots when testing enabled
        variantGroup:  (!slot.isVideoPost && enableABTesting) ? variantGroups[i] : null,
        variantLabel:  (!slot.isVideoPost && enableABTesting) ? 'A' : null,
        variantWinner: false,
      }
    })

    const saveGateIssues = postsToCreate.flatMap((post, index) =>
      validateContentPlanDraftForSave({
        caption: post.caption,
        imagePrompt: post.imagePrompt ?? '',
        videoPrompt: post.videoPrompt ?? '',
      }).issues.map(issue => ({ index: index + 1, ...issue })),
    )

    if (saveGateIssues.length > 0) {
      const refunded = await refundAllRequestedContent('Unsafe content plan draft blocked before save')
      console.warn('[generate-content-plan] blocked unsafe content before save', saveGateIssues.slice(0, 8))
      return NextResponse.json(
        {
          error: 'Content plan draft failed safety review before save. Please try again.',
          reason: 'unsafe_content_plan_draft',
          refunded,
          issues: saveGateIssues.slice(0, 8),
        },
        { status: 502 },
      )
    }

    const semanticGate = validateContentPlanSemanticAlignment(
      postsToCreate,
      strategyForContent,
      { brandFacts: explicitBrandFacts },
    )

    if (!semanticGate.ok) {
      const refunded = await refundAllRequestedContent('Content plan drifted from reviewed strategy')
      console.warn('[generate-content-plan] blocked strategy drift before save', {
        alignedPosts: semanticGate.alignedPosts,
        requiredAlignedPosts: semanticGate.requiredAlignedPosts,
        issues: semanticGate.issues.slice(0, 8),
      })
      return NextResponse.json(
        {
          error: 'The generated drafts did not stay aligned with the reviewed brand and strategy. No posts were saved, and any charged credits were restored.',
          code: 'CONTENT_PLAN_STRATEGY_DRIFT',
          refunded,
        },
        { status: 502 },
      )
    }

    // Recheck under an advisory lock at commit time. Concurrent generations
    // cannot consume more planned-post allowance than the owner's plan permits.
    await prisma.$transaction(async (tx) => {
      const commitAllowance = await readLockedPlannedPostAllowance(tx, userId, params.id)
      if (postsToCreate.length > commitAllowance.remaining) {
        throw new Error(`POST_LIMIT_REACHED:${commitAllowance.limit}:${commitAllowance.periodEnd.toISOString()}`)
      }
      await (tx.socialPost as any).deleteMany({
        where: { campaignId: params.id, workspaceId, status: 'DRAFT', publishedAt: null },
      })
      await (tx.socialPost as any).createMany({ data: postsToCreate })
    })

    // Uploaded media remains user-selected. Image understanding is a separate,
    // future priced action; this route performs no hidden post-save AI rewrites.

    // ── 9b. Generate and insert B variants (if A/B enabled) ────────────────
    let bVariantsCreated = 0
    let abVariantsRefunded = false
    if (enableABTesting) {
      try {
        const HOOK_STYLES = [
          'Use a provocative question as the opening hook.',
          'Lead with a surprising statistic or counterintuitive fact.',
          'Start with a bold, confident statement that challenges conventional thinking.',
          'Open with an emotional story-driven hook (1-2 sentences of narrative).',
          'Begin with a "before/after" or "problem → solution" framing.',
        ]

        const bSystemPrompt = `You are an expert social media content strategist for ${brandName}.

Campaign: "${campaignName}"
Key message: "${keyMessage}"
Target audience: ${targetAudience}
Content pillars: ${pillarText}
Tone: ${tone}
Offer/CTA: ${offer}

You are generating VARIANT B captions. Each variant must use a DIFFERENT hook style from the original.
For each post, the hook style is specified — follow it exactly.
Keep the same platform, same CTA intent, same language as the original post — only the hook/opening changes.

Return a JSON array of caption objects (same count as input):
[{ "index": 0, "caption": "..." }]`

        const imageSlotsWithAB = slots
          .map((slot, i) => ({ slot, i }))
          .filter(({ slot }) => !slot.isVideoPost)

        const bUserMsg = `Generate B-variant captions for ${imageSlotsWithAB.length} image posts.
Slots:
${imageSlotsWithAB.map(({ slot, i }) => JSON.stringify({
  index: i,
  platform: slot.publishTarget,
  hookStyle: HOOK_STYLES[i % HOOK_STYLES.length],
})).join('\n')}`

        const bRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',  // A/B variant captions — same quality standard as primary
            messages: [
              { role: 'system', content: bSystemPrompt },
              { role: 'user', content: bUserMsg },
            ],
            temperature: 0.9,
            response_format: { type: 'json_object' },
          }),
        })
        if (!bRes.ok) throw new Error(`OpenAI B-variant generation failed (${bRes.status})`)

        const bData = await bRes.json()
        let bPosts: any[] = []
        try {
          const raw = JSON.parse(bData.choices?.[0]?.message?.content ?? '{}')
          bPosts = guardContentDraftTruth(
            Array.isArray(raw) ? raw : (raw.posts ?? raw.captions ?? raw.variants ?? []),
            proofContext,
          )
        } catch { bPosts = [] }
        if (bPosts.length !== imageSlotsWithAB.length) {
          throw new Error('OpenAI returned an incomplete B-variant set')
        }

        const bVariantsToCreate = imageSlotsWithAB.map(({ slot, i }, bIdx) => {
          const gen = generatedPosts[i] ?? generatedPosts.find((g: any) => g.index === slot.index) ?? {}
          const bGen = bPosts[bIdx] ?? bPosts.find((b: any) => b.index === i) ?? {}
          const caption = guardContentDraftText(bGen.caption, proofContext)
          const imagePrompt = renderContentPlanDraftImagePrompt(gen, {
            ...proofContext,
            isArabic,
            brand: brandName,
            campaignName,
            keyMessage,
            targetAudience,
            contentPillars,
            offer,
            platform: slot.publishTarget,
            postIndex: i,
          }) // reuse the same safe image prompt for B

          const dayOffset = Math.max(1, Math.min(30, gen.scheduledDayOffset ?? i + 1))
          const scheduledAt = new Date(now)
          scheduledAt.setDate(now.getDate() + dayOffset)
          scheduledAt.setHours(proposedReviewHour(i), 0, 0, 0)

          let uploadedMediaId: string | null = null
          let effectiveMediaSource = mediaSource
          if (mediaSource !== 'GENERATE' && userMedia.length > 0) {
            uploadedMediaId = userMedia[i % userMedia.length].id
          }

          return {
            workspaceId,
            campaignId: params.id,
            platform: slot.platform as any,
            publishTarget: slot.publishTarget,
            caption,
            imagePrompt,
            videoPrompt: null,
            isVideoPost: false,
            generationStatus: 'PENDING',
            mediaSource: effectiveMediaSource,
            uploadedMediaId,
            contentPlanIndex: slot.index + 1, // same index as A — they share a slot
            status: 'DRAFT' as const,
            scheduledAt,
            autoGenerated: true,
            variantGroup: variantGroups[i],
            variantLabel: 'B',
            variantWinner: false,
          }
        })

        const bVariantIssues = bVariantsToCreate.flatMap((post, index) =>
          validateContentPlanDraftForSave({
            caption: post.caption,
            imagePrompt: post.imagePrompt ?? '',
          }).issues.map(issue => ({ index: index + 1, ...issue })),
        )

        const bVariantSemanticGate = validateContentPlanSemanticAlignment(
          bVariantsToCreate,
          strategyForContent,
          { brandFacts: explicitBrandFacts },
        )

        if (bVariantIssues.length > 0 || !bVariantSemanticGate.ok) {
          console.warn('[generate-content-plan] skipped unsafe B variants before save', bVariantIssues.slice(0, 8))
          abVariantsRefunded = await refundAbVariants('A/B variants failed the content quality gate')
        } else if (bVariantsToCreate.length > 0) {
          await (prisma.socialPost as any).createMany({ data: bVariantsToCreate })
          bVariantsCreated = bVariantsToCreate.length
        } else {
          abVariantsRefunded = await refundAbVariants('No usable A/B variants were generated')
        }
      } catch (abErr) {
        console.warn('[generate-content-plan] A/B variant generation failed:', abErr)
        // Base drafts remain valid, but the separately priced experiment did not
        // produce a usable result and is therefore refunded independently.
        abVariantsRefunded = await refundAbVariants('A/B variant generation failed')
      }
    }

    // ── 10. Send "Content Plan Ready" email (non-blocking) ────────────────
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }).then(user => {
      if (user?.email) {
        sendContentPlanReadyEmail(
          user.email,
          user.name ?? '',
          campaignName,
          postsToCreate.length,
          params.id,
        ).catch(() => { /* non-fatal */ })
      }
    }).catch(() => { /* non-fatal */ })

    // ── 11. Return summary ────────────────────────────────────────────────
    const imagePosts  = postsToCreate.filter(p => !p.isVideoPost).length
    const videoSlots  = postsToCreate.filter(p => p.isVideoPost).length
    const uploadSlots = postsToCreate.filter(p => p.mediaSource === 'UPLOAD' && !p.isVideoPost).length

    return NextResponse.json({
      success: true,
      summary: {
        total: postsToCreate.length,
        imagePosts,
        videoSlots,
        uploadSlots,
        platforms: [...new Set(postsToCreate.map(p => p.platform))],
        planName,
        quota,
        abTesting: enableABTesting
          ? { enabled: true, bVariants: bVariantsCreated, refunded: abVariantsRefunded }
          : { enabled: false },
      },
      qualityGate: strategyQualityGate,
      creditCharges: [
        {
          ...getCreditActionPolicy('CONTENT_PLAN_GENERATION'),
          creditsUsed: contentPlanCharge?.creditsUsed ?? 0,
          refunded: false,
        },
        ...(enableABTesting ? [{
          ...getCreditActionPolicy('CONTENT_AB_VARIANTS'),
          creditsUsed: abVariantsRefunded ? 0 : (abVariantsCharge?.creditsUsed ?? 0),
          refunded: abVariantsRefunded,
        }] : []),
      ],
    })
  } catch (err: any) {
    console.error('[generate-content-plan POST]', err)
    // Refund — a failed content-plan generation must not charge the user (skip unlimited plans)
    const refunded = await refundAllRequestedContent('Content plan generation failed')
    if (err instanceof Error && err.message.startsWith('POST_LIMIT_REACHED:')) {
      const [, limit, ...resetParts] = err.message.split(':')
      return NextResponse.json({
        error: 'POST_LIMIT_REACHED',
        limit: Number(limit),
        resetsAt: resetParts.join(':'),
        refunded,
        upgradeUrl: '/billing',
      }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to generate content plan', refunded }, { status: 500 })
  }
}

// ── DELETE: clear pending content plan ────────────────────────────────────────

export async function DELETE(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const deleted = await prisma.socialPost.deleteMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'DRAFT',
        publishedAt: null,
      },
    })

    return NextResponse.json({ success: true, deleted: deleted.count })
  } catch (err: any) {
    console.error('[generate-content-plan DELETE]', err)
    return NextResponse.json({ error: 'Failed to clear content plan' }, { status: 500 })
  }
}
