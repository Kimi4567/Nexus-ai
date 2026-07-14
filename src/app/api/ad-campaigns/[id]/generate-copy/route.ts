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
  refundCredits,
  refundCreditsForTransaction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { buildTrackedPaidDestinationUrl } from '@/lib/paidExecutionReadiness'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'

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
  if (credit.creditsUsed <= 0) return
  if (credit.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: credit.transactionId, reason })
    return
  }
  await refundCredits(userId, 'AD_COPY', reason)
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

    // Fetch or create the first AdSet
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
          optimizationGoal: 'LINK_CLICKS',
          billingEvent: 'IMPRESSIONS',
        },
      })
    }

    // Brand Brain
    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.findUnique({
        where: { workspaceId: campaign.workspaceId },
      })
    } catch { /* ok */ }

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

    const brandCtx = brandProfile ? `
Brand: ${brandProfile.brandName}
Industry: ${brandProfile.industry}
Primary Offer: ${brandProfile.primaryOffer}
Price Point: ${brandProfile.pricePoint}
Target Audience: ${brandProfile.targetAudience}
Brand Tone: ${(brandProfile.toneKeywords || []).join(', ')}
Unique Advantages: ${(brandProfile.uniqueAdvantages || []).join(', ')}
Reviewed Hook Signals (style references; do not call them winners): ${(brandProfile.winningHooks || []).slice(0, 5).join(' | ')}
FAILED Angles (NEVER use): ${(brandProfile.failedAngles || []).slice(0, 3).join(', ')}
AI Strategy Context: ${JSON.stringify(campaign.aiStrategy || {}).slice(0, 1000)}` : 'No brand profile.'

    // AI Strategy context
    const strategyCtx = campaign.aiStrategy
      ? `\nCampaign Positioning: ${JSON.stringify((campaign.aiStrategy as Record<string, unknown>).positioning || {})}`
      : ''

    const systemPrompt = `You are an elite direct-response copywriter preparing paid ad drafts for review.
Your copy should be specific, clear, and platform-native. Do not claim winners, proven performance, or guaranteed conversion unless real analytics are provided.

${langInstruction}

Output ONLY valid JSON. The copy must be SPECIFIC to this brand — never generic.
Use reviewed hook signals as style references. Never use the failed angles.`

    const userPrompt = `Campaign: "${campaign.name}"
Platform: ${platform}
Objective: ${objective}
Available CTAs: ${ctaOptions.join(', ')}
Daily Budget: ${campaign.currency} ${campaign.dailyBudget || 50}
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
      "angle": "social_proof",
      "label": "Social Proof — [specific credibility angle]",
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
      "angle": "benefit_led",
      "label": "Benefit Led — [the transformation you deliver]",
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
      "angle": "curiosity",
      "label": "Curiosity / Pattern Interrupt",
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
      "angle": "urgency_scarcity",
      "label": "Urgency / Limited Offer",
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
  "ab_test_recommendation": {
    "pair_1": ["v1", "v3"],
    "pair_2": ["v2", "v4"],
    "reasoning": "Why these are the best pairs to A/B test"
  },
  "creative_specs": {
    "platform": "${platform}",
    "recommended_image_sizes": ["1080x1080 for Feed", "1080x1920 for Stories/Reels"],
    "video_specs": "If video: 9:16 for Reels/Stories, 4:5 for Feed",
    "max_text_overlay": "20% for Meta (Advantage+ ignores this but be safe)"
  }
}`

    const creditResult = await checkAndDeductCredits(user.id, 'AD_COPY')
    if (!creditResult.ok) {
      return NextResponse.json({ error: 'Insufficient credits', upgradeRequired: true }, { status: 402 })
    }
    chargedUserId = user.id
    chargedCredit = creditResult

    const raw = await callGPT(systemPrompt, userPrompt)
    let generated: { variants?: unknown[]; ab_test_recommendation?: unknown; creative_specs?: unknown }
    try {
      generated = JSON.parse(raw)
      if (!Array.isArray(generated.variants) || generated.variants.length === 0) {
        throw new Error('Incomplete ad copy response')
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

    // Save each variant as an Ad record
    const savedAds = []
    const variantGroupId = `vg_${params.id}_${Date.now()}`
    const variants = generated.variants as Array<Record<string, unknown>>

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
          callToAction: String(v.callToAction || 'LEARN_MORE'),
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

    return NextResponse.json({
      ads: savedAds,
      adSetId: adSet.id,
      abTestRecommendation: generated.ab_test_recommendation,
      creativeSpecs: generated.creative_specs,
      variantGroupId,
      success: true,
    })
  } catch (err) {
    console.error('[generate-copy]', err)
    if (chargedUserId && chargedCredit) {
      await refundDeductedCredits(chargedUserId, chargedCredit, 'Copy generation failed')
    }
    return NextResponse.json({ error: 'Copy generation failed' }, { status: 500 })
  }
}
