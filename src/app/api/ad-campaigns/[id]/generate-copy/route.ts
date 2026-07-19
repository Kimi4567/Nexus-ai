/**
 * POST /api/ad-campaigns/[id]/generate-copy
 *
 * Generates platform-native ad copy variants for a paid campaign.
 * Creates Ad records under the first (or specified) AdSet.
 *
 * Generates 5 variants by default:
 *   - 2 Meta variants (Feed + Reels)
 *   - 1 Google Search ad
 *   - 1 TikTok script
 *   - 1 LinkedIn sponsored content
 *   (filtered to the campaign's actual platform)
 *
 * Each variant is saved as an Ad record linked to an AdSet.
 * Uses Brand Brain reviewed hook signals + failed-angle notes to inform copy.
 *
 * Credit cost: 2 (AD_COPY)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import {
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  getCreditActionPolicy,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { buildTrackedPaidDestinationUrl } from '@/lib/paidExecutionReadiness'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import {
  getPaidStrategySourceForUser,
  PaidStrategySourceError,
} from '@/lib/paidStrategySourceServer'
import { paidStrategyAllowsPlatform } from '@/lib/paidStrategyPlatforms'
import { getStrategyBriefReadiness } from '@/lib/strategyBriefReadiness'
import { paidOptimizationGoal } from '@/lib/paidExecutionObjective'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import { reviewContentPostForPublishing } from '@/lib/contentPlanApprovalGuard'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

async function callGPT(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: 4000,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('OpenAI returned no ad copy')
  return content
}

const CTA_OPTIONS = {
  META: ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'GET_QUOTE', 'BOOK_NOW', 'CONTACT_US', 'SUBSCRIBE', 'DOWNLOAD'],
  GOOGLE: ['Visit site', 'Learn more', 'Get quote', 'Contact us', 'Book now', 'Sign up'],
  TIKTOK: ['Learn More', 'Shop Now', 'Sign Up', 'Contact Us', 'Download', 'Book Now'],
  LINKEDIN: ['Learn More', 'Register', 'Sign Up', 'Subscribe', 'Request Demo', 'Download'],
}

function reviewedGoogleTextAssets(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().replace(/\s+/g, ' '))
    .filter(item => {
      const key = item.toLocaleLowerCase()
      if (!item || item.length > maxLength || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

async function refundDeductedCredits(userId: string, credit: CreditDeductionOk, reason: string) {
  await refundCreditDeduction({ userId, action: 'AD_COPY', deduction: credit, reason })
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  let chargedUserId: string | null = null
  let chargedCredit: CreditDeductionOk | null = null

  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Accept optional language override from client
    const body = await req.json().catch(() => ({}))
    const requestedLang = (body.language as string) || null

    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      include: { workspace: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (campaign.status !== 'DRAFT' || campaign.platformCampaignId) {
      return NextResponse.json({
        error: 'PAID_DRAFT_NOT_EDITABLE',
        code: 'PAID_DRAFT_NOT_EDITABLE',
      }, { status: 409 })
    }

    const paidSource = await getPaidStrategySourceForUser({
      campaignId: typeof campaign.organicCampaignId === 'string' ? campaign.organicCampaignId : '',
      userId: user.id,
      strategySnapshotId: typeof campaign.strategySnapshotId === 'string' ? campaign.strategySnapshotId : null,
      requirePinnedSnapshot: true,
    })
    if (!paidStrategyAllowsPlatform(paidSource.truth, campaign.platform)) {
      return NextResponse.json({
        error: 'PAID_PLATFORM_STRATEGY_MISMATCH',
        code: 'PAID_PLATFORM_STRATEGY_MISMATCH',
        approvedPlatforms: paidSource.truth.approvedPlatforms,
      }, { status: 422 })
    }
    if (campaign.objective !== paidSource.truth.executionObjective) {
      return NextResponse.json({
        error: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        code: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        expectedObjective: paidSource.truth.executionObjective,
      }, { status: 422 })
    }

    const storedTracking = campaign.trackingUrls && typeof campaign.trackingUrls === 'object'
      ? campaign.trackingUrls as Record<string, unknown>
      : {}
    const destinationUrl = buildTrackedPaidDestinationUrl({
      destinationUrl: body.destinationUrl || storedTracking.baseDestinationUrl,
      platform: campaign.platform,
      campaignSlug: String(body.utmCampaign || campaign.utmCampaign || campaign.name),
    })
    if (!destinationUrl) {
      return NextResponse.json({
        error: 'A public HTTPS conversion destination is required before generating paid ad drafts. No credits were used.',
        code: 'INVALID_PAID_DESTINATION',
      }, { status: 400 })
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(requestedLang), { status: 503 })
    }

    const destination = new URL(destinationUrl)
    await db.adCampaign.update({
      where: { id: campaign.id },
      data: {
        utmSource: destination.searchParams.get('utm_source'),
        utmMedium: destination.searchParams.get('utm_medium'),
        utmCampaign: destination.searchParams.get('utm_campaign'),
        trackingUrls: {
          ...storedTracking,
          baseDestinationUrl: body.destinationUrl || storedTracking.baseDestinationUrl,
          [String(campaign.platform).toLowerCase()]: destinationUrl,
        },
      },
    })

    // Brand Brain
    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.findUnique({
        where: { workspaceId: campaign.workspaceId },
      })
    } catch { /* ok */ }
    const brandBrief = getStrategyBriefReadiness({ mode: 'paid', brandProfile })
    if (!brandBrief.canGeneratePaidPlan) {
      return NextResponse.json({
        error: 'PAID_BRAND_BRIEF_INCOMPLETE',
        code: 'PAID_BRAND_BRIEF_INCOMPLETE',
        missingFields: brandBrief.missingRequiredFields,
      }, { status: 422 })
    }

    // The execution unit is created only after the provider output also passes
    // deterministic copy and Brand Brain gates. Failed generation must not leave
    // an empty Ad Set that looks like meaningful progress.
    const optimizationGoal = paidOptimizationGoal(paidSource.truth.executionObjective)

    // Language — client override takes priority, then location-based detection
    const detectedLang = brandProfile?.audienceLocation &&
      ['saudi', 'uae', 'egypt', 'mena', 'gulf', 'كويت', 'إمارات', 'السعودية', 'مصر', 'خليج'].some(
        kw => (brandProfile.audienceLocation || '').toLowerCase().includes(kw)
      ) ? 'ar' : 'en'
    const lang = requestedLang || detectedLang
    const langInstruction = getLanguageInstruction(lang)

    const platform = campaign.platform
    const objective = campaign.objective
    const ctaOptions = CTA_OPTIONS[platform as keyof typeof CTA_OPTIONS] || CTA_OPTIONS.META

    const brandCtx = buildBrandExecutionContext(brandProfile)

    // AI Strategy context
    const strategyCtx = campaign.aiStrategy
      ? `\nCampaign Positioning: ${JSON.stringify((campaign.aiStrategy as Record<string, unknown>).positioning || {})}`
      : ''

    const systemPrompt = `You are a senior, brand-safe paid copywriter preparing ad drafts for review.
The approved source strategy is authoritative. Execute its audience, positioning, offer, funnel, and message hierarchy without inventing or replacing them.
Your copy should be specific, clear, and platform-native. Do not claim winners, proven performance, or guaranteed conversion unless real analytics are provided.
Never invent testimonials, customer counts, ratings, awards, certifications, discounts, deadlines, scarcity, pricing, or product capabilities.
If a requested fact is absent, write around the confirmed offer or process; never fill the gap with a plausible claim.

${langInstruction}

Output ONLY valid JSON. The copy must be SPECIFIC to this brand — never generic.
Use reviewed hook signals as style references. Never use the failed angles.`

    const userPrompt = `APPROVED SOURCE STRATEGY: "${paidSource.campaign.name}"
${paidSource.executionContext}

PLATFORM EXECUTION DRAFT: "${campaign.name}"
Platform: ${platform}
Objective: ${objective}
Available CTAs: ${ctaOptions.join(', ')}
Budget Assumption: ${campaign.dailyBudget
  ? `${campaign.currency} ${campaign.dailyBudget} per day`
  : `${campaign.currency} ${campaign.lifetimeBudget} total`}
Conversion Destination: ${destinationUrl}

${brandCtx}
${strategyCtx}

Generate 5 review-ready ad copy variants in JSON:
{
  "variants": [
    {
      "id": "v1",
      "angle": "pain_point",
      "label": "Pain Point Hook — [specific pain you're solving]",
      "primaryText": "Full ad copy (2-4 sentences for social, script for TikTok, headline/desc for Google)\\n\\nWith paragraph breaks where needed",
      "headline": "5-7 word headline that grabs attention",
      "description": "Supporting 1-2 line description for link preview",
      "callToAction": "one of the available CTAs",
      "hook": "The first 1-2 sentences / opening hook only",
      "characterCount": {
        "primaryText": number,
        "headline": number
      },
      "platformNotes": "Any platform-specific tips for using this variant"
      ${platform === 'GOOGLE' ? `,
      "googleHeadlines": ["3 to 15 unique headlines, each no more than 30 characters"],
      "googleDescriptions": ["2 to 4 unique descriptions, each no more than 90 characters"],
      "googlePath1": "optional path, 15 characters max",
      "googlePath2": "optional path, 15 characters max"` : ''}
    },
    {
      "id": "v2",
      "angle": "evidence_or_process",
      "label": "Evidence or Process — use verified proof only; if none exists, explain the confirmed process transparently",
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "callToAction": "...",
      "hook": "...",
      "characterCount": { "primaryText": 0, "headline": 0 },
      "platformNotes": "..."
      ${platform === 'GOOGLE' ? `,
      "googleHeadlines": ["3 to 15 unique Google RSA headlines"],
      "googleDescriptions": ["2 to 4 unique Google RSA descriptions"],
      "googlePath1": "optional",
      "googlePath2": "optional"` : ''}
    },
    {
      "id": "v3",
      "angle": "offer_value",
      "label": "Offer Value — describe the confirmed offer benefit without promising a result",
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "callToAction": "...",
      "hook": "...",
      "characterCount": { "primaryText": 0, "headline": 0 },
      "platformNotes": "..."
      ${platform === 'GOOGLE' ? `,
      "googleHeadlines": ["3 to 15 unique Google RSA headlines"],
      "googleDescriptions": ["2 to 4 unique Google RSA descriptions"],
      "googlePath1": "optional",
      "googlePath2": "optional"` : ''}
    },
    {
      "id": "v4",
      "angle": "objection_handling",
      "label": "Objection Handling — answer a confirmed customer objection; otherwise ask a useful informational question",
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "callToAction": "...",
      "hook": "...",
      "characterCount": { "primaryText": 0, "headline": 0 },
      "platformNotes": "..."
      ${platform === 'GOOGLE' ? `,
      "googleHeadlines": ["3 to 15 unique Google RSA headlines"],
      "googleDescriptions": ["2 to 4 unique Google RSA descriptions"],
      "googlePath1": "optional",
      "googlePath2": "optional"` : ''}
    },
    {
      "id": "v5",
      "angle": "direct_next_step",
      "label": "Direct Next Step — clear CTA with no urgency, scarcity, discount, or deadline unless explicitly supplied",
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "callToAction": "...",
      "hook": "...",
      "characterCount": { "primaryText": 0, "headline": 0 },
      "platformNotes": "..."
      ${platform === 'GOOGLE' ? `,
      "googleHeadlines": ["3 to 15 unique Google RSA headlines"],
      "googleDescriptions": ["2 to 4 unique Google RSA descriptions"],
      "googlePath1": "optional",
      "googlePath2": "optional"` : ''}
    }
  ],
  "review_pairing": {
    "pair_1": ["v1", "v3"],
    "pair_2": ["v2", "v4"],
    "reasoning": "Why these pairs isolate distinct message hypotheses for user review; never call a variant best or a winner"
  }
}`

    const rateLimitResponse = await enforceBillableAiRateLimit(user.id, 'AD_COPY')
    if (rateLimitResponse) return rateLimitResponse

    const creditResult = await checkAndDeductCredits(
      user.id,
      'AD_COPY',
      undefined,
      {
        entityId: campaign.id,
        entityType: 'paid_campaign_copy',
        operationKey: getCreditOperationKey(req, 'AD_COPY', 'paid_campaign_copy', campaign.id),
      },
    )
    if (!creditResult.ok) {
      return NextResponse.json(creditResult, { status: creditCheckHttpStatus(creditResult) })
    }
    chargedUserId = user.id
    chargedCredit = creditResult

    const raw = await callGPT(systemPrompt, userPrompt)
    let generated: { variants?: unknown[]; review_pairing?: unknown }
    try {
      generated = JSON.parse(raw)
      if (!Array.isArray(generated.variants) || generated.variants.length !== 5) {
        throw new Error('Incomplete ad copy response')
      }
      for (const rawVariant of generated.variants) {
        const variant = rawVariant && typeof rawVariant === 'object'
          ? rawVariant as Record<string, unknown>
          : {}
        const requiredText = ['label', 'primaryText', 'headline', 'description', 'hook']
        if (requiredText.some(key => typeof variant[key] !== 'string' || !String(variant[key]).trim())) {
          throw new Error('Incomplete ad copy response')
        }
      }
      if (platform === 'GOOGLE') {
        for (const rawVariant of generated.variants) {
          const variant = rawVariant && typeof rawVariant === 'object'
            ? rawVariant as Record<string, unknown>
            : {}
          if (
            reviewedGoogleTextAssets(variant.googleHeadlines, 30).length < 3
            || reviewedGoogleTextAssets(variant.googleDescriptions, 90).length < 2
          ) {
            throw new Error('Incomplete Google responsive search ad assets')
          }
        }
      }
    } catch {
      await refundDeductedCredits(user.id, creditResult, 'AI returned invalid JSON')
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    const variants = generated.variants as Array<Record<string, unknown>>
    const copyIssues = variants.flatMap((variant, index) => reviewContentPostForPublishing({
      caption: [variant.hook, variant.primaryText, variant.headline, variant.description]
        .filter(value => typeof value === 'string')
        .join(' '),
    }, index + 1))
    const copyQualityGate = reviewStrategyGrounding({
      strategy: {
        topHooks: variants.map(variant => [variant.hook, variant.primaryText, variant.headline, variant.description]
          .filter(value => typeof value === 'string')
          .join(' ')),
      },
      brand: brandProfile,
      allowedPlatforms: [String(platform)],
      goal: String(objective),
    })
    if (copyIssues.length > 0 || copyQualityGate.status !== 'passed') {
      await refundDeductedCredits(user.id, creditResult, 'Paid ad drafts failed the copy, Brand Brain, or scope quality gate')
      return NextResponse.json({
        error: 'PAID_COPY_QUALITY_GATE_BLOCKED',
        code: 'PAID_COPY_QUALITY_GATE_BLOCKED',
        issues: copyIssues,
        qualityGate: copyQualityGate,
        refunded: creditResult.creditsUsed > 0,
      }, { status: 422 })
    }

    let adSet = await db.adSet.findFirst({
      where: { adCampaignId: params.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!adSet) {
      adSet = await db.adSet.create({
        data: {
          adCampaignId: params.id,
          name: `${campaign.name} — Ad Set 1`,
          status: 'DRAFT',
          bidStrategy: 'LOWEST_COST',
          optimizationGoal,
          billingEvent: 'IMPRESSIONS',
        },
      })
    } else if (adSet.optimizationGoal !== optimizationGoal && !adSet.platformAdSetId) {
      adSet = await db.adSet.update({
        where: { id: adSet.id },
        data: { optimizationGoal },
      })
    }

    // Save each variant as an Ad record
    const savedAds = []
    const variantGroupId = `vg_${params.id}_${Date.now()}`

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      const googleHeadlines = reviewedGoogleTextAssets(v.googleHeadlines, 30).slice(0, 15)
      const googleDescriptions = reviewedGoogleTextAssets(v.googleDescriptions, 90).slice(0, 4)
      const googlePath1 = typeof v.googlePath1 === 'string' && v.googlePath1.trim().length <= 15
        ? v.googlePath1.trim()
        : undefined
      const googlePath2 = typeof v.googlePath2 === 'string' && v.googlePath2.trim().length <= 15
        ? v.googlePath2.trim()
        : undefined
      const ad = await db.ad.create({
        data: {
          adSetId: adSet.id,
          name: String(v.label || `Variant ${i + 1}`),
          status: 'DRAFT',
          format: platform === 'TIKTOK' ? 'IN_FEED' : platform === 'GOOGLE' ? 'SEARCH' : platform === 'LINKEDIN' ? 'SPONSORED_CONTENT' : 'SINGLE_IMAGE',
          primaryText: String(v.primaryText || ''),
          headline: String(v.headline || ''),
          description: String(v.description || ''),
          callToAction: ctaOptions.includes(String(v.callToAction))
            ? String(v.callToAction)
            : ctaOptions[0],
          destinationUrl,
          creativeSpecs: platform === 'GOOGLE'
            ? {
                googleAds: {
                  headlines: googleHeadlines,
                  descriptions: googleDescriptions,
                  ...(googlePath1 ? { path1: googlePath1 } : {}),
                  ...(googlePath2 ? { path2: googlePath2 } : {}),
                },
              }
            : undefined,
          aiGenerated: true,
          aiAngle: String(v.angle || ''),
          aiHook: String(v.hook || ''),
          variantGroup: variantGroupId,
          variantLabel: String(v.id || `v${i + 1}`),
        },
      })
      savedAds.push({ ...ad, ...v })
    }

    const finalization = await finalizeCreditDeduction({
      userId: user.id,
      action: 'AD_COPY',
      deduction: creditResult,
    })
    if (!finalization.ok) {
      chargedUserId = null
      chargedCredit = null
      return NextResponse.json({
        error: 'Ad drafts were saved but the credit operation could not be finalized. Reserved credits were returned; refresh the campaign.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }
    chargedUserId = null
    chargedCredit = null

    return NextResponse.json({
      ads: savedAds,
      adSetId: adSet.id,
      reviewPairing: generated.review_pairing,
      capability: platform === 'GOOGLE'
        ? 'Reviewed responsive Search ad text; server validates provider character and asset-count limits.'
        : platform === 'META'
          ? 'Copy draft only; a reviewed image and live Meta preflight are required before platform creation.'
          : 'Export-only copy package; automated platform draft creation is not available for this platform yet.',
      variantGroupId,
      success: true,
      creditsUsed: creditResult.creditsUsed,
      creditsRemaining: creditResult.creditsRemaining,
      creditCharge: {
        ...getCreditActionPolicy('AD_COPY'),
        creditsUsed: creditResult.creditsUsed,
      },
    })
  } catch (err) {
    console.error('[generate-copy]', err)
    if (chargedUserId && chargedCredit) {
      await refundDeductedCredits(chargedUserId, chargedCredit, 'Copy generation failed')
    }
    if (err instanceof PaidStrategySourceError) {
      return NextResponse.json({ error: err.code, code: err.code }, { status: err.status })
    }
    return NextResponse.json({ error: 'Copy generation failed' }, { status: 500 })
  }
}
