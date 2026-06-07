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
 * Uses Brand Brain winning hooks + failed angles to inform copy.
 *
 * Credit cost: 2 (AD_COPY)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { checkAndDeductCredits } from '@/lib/credits'
import { getLanguageInstruction } from '@/lib/ai/langHelper'

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
  return data.choices?.[0]?.message?.content ?? '{}'
}

const CTA_OPTIONS = {
  META: ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'GET_QUOTE', 'BOOK_NOW', 'CONTACT_US', 'SUBSCRIBE', 'DOWNLOAD'],
  GOOGLE: ['Visit site', 'Learn more', 'Get quote', 'Contact us', 'Book now', 'Sign up'],
  TIKTOK: ['Learn More', 'Shop Now', 'Sign Up', 'Contact Us', 'Download', 'Book Now'],
  LINKEDIN: ['Learn More', 'Register', 'Sign Up', 'Subscribe', 'Request Demo', 'Download'],
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const creditResult = await checkAndDeductCredits(user.id, 'AD_COPY')
    if (!creditResult.ok) {
      return NextResponse.json({ error: 'Insufficient credits', upgradeRequired: true }, { status: 402 })
    }

    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      include: { workspace: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

    // Language
    const lang = brandProfile?.writingStyle?.includes('ar') ? 'ar' : 'en'
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
Winning Hooks (REUSE these angles): ${(brandProfile.winningHooks || []).slice(0, 5).join(' | ')}
FAILED Angles (NEVER use): ${(brandProfile.failedAngles || []).slice(0, 3).join(', ')}
AI Strategy Context: ${JSON.stringify(campaign.aiStrategy || {}).slice(0, 1000)}` : 'No brand profile.'

    // AI Strategy context
    const strategyCtx = campaign.aiStrategy
      ? `\nCampaign Positioning: ${JSON.stringify((campaign.aiStrategy as Record<string, unknown>).positioning || {})}`
      : ''

    const systemPrompt = `You are an elite direct-response copywriter who has written winning ads for $50M+ in ad spend.
Your copy converts. Every word earns its place. You understand platform-native formats deeply.

${langInstruction}

Output ONLY valid JSON. The copy must be SPECIFIC to this brand — never generic.
Use the winning hooks as inspiration. Never use the failed angles.`

    const userPrompt = `Campaign: "${campaign.name}"
Platform: ${platform}
Objective: ${objective}
Available CTAs: ${ctaOptions.join(', ')}
Daily Budget: ${campaign.currency} ${campaign.dailyBudget || 50}

${brandCtx}
${strategyCtx}

Generate 5 high-converting ad copy variants in JSON:
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

    const raw = await callGPT(systemPrompt, userPrompt)
    let generated: { variants?: unknown[]; ab_test_recommendation?: unknown; creative_specs?: unknown }
    try {
      generated = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    // Save each variant as an Ad record
    const savedAds = []
    const variantGroupId = `vg_${params.id}_${Date.now()}`
    const variants = (generated.variants || []) as Array<Record<string, unknown>>

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
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
    return NextResponse.json({ error: 'Copy generation failed' }, { status: 500 })
  }
}
