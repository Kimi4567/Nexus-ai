/**
 * POST /api/campaigns/[id]/paid-pack/generate
 *
 * Uses GPT-4o to generate the full paid campaign pack:
 * - Platform-specific audience targeting (Meta, Google, TikTok, LinkedIn)
 * - A/B copy variants (3 per platform)
 * - Budget insights & estimated reach
 * - UTM parameter set
 * - Platform-by-platform launch guide (step by step)
 *
 * The data model maps 1:1 to Meta Marketing API fields so when
 * API approval arrives, we just add the API call on top.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { checkAndDeductCredits, refundCredits, refundCreditsForTransaction } from '@/lib/credits'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

async function callGPT(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? '{}'
}

// CPM benchmarks (MENA + Global avg) for reach estimation
const CPM_BENCHMARKS: Record<string, { min: number; max: number }> = {
  meta:     { min: 4,  max: 12  },  // USD per 1000 impressions
  tiktok:   { min: 6,  max: 15  },
  google:   { min: 1,  max: 5   },  // CPC based
  linkedin: { min: 25, max: 60  },
}

function estimateReach(
  budget: number,
  days: number,
  platforms: string[]
): Record<string, { impressionsMin: number; impressionsMax: number; cpmMin: number; cpmMax: number }> {
  const totalBudget = budget * days
  const result: Record<string, { impressionsMin: number; impressionsMax: number; cpmMin: number; cpmMax: number }> = {}
  for (const p of platforms) {
    const bench = CPM_BENCHMARKS[p] ?? { min: 5, max: 15 }
    result[p] = {
      impressionsMin: Math.round((totalBudget / bench.max) * 1000),
      impressionsMax: Math.round((totalBudget / bench.min) * 1000),
      cpmMin: bench.min,
      cpmMax: bench.max,
    }
  }
  return result
}

function buildSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaignId = params.id
    if (!campaignId) return NextResponse.json({ error: 'Campaign id required' }, { status: 400 })

    // Fetch campaign + brand profile
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspace: { ownerId: user.id } },
      include: { workspace: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.findUnique({
        where: { workspaceId: campaign.workspaceId },
      })
    } catch { /* table may not exist */ }

    // Fetch existing pack for context (objective, platforms, budget)
    const existingPack = await db.paidCampaignPack.findUnique({
      where: { campaignId },
    })

    const objective = existingPack?.objective ?? 'TRAFFIC'
    const platforms: string[] = existingPack?.platforms ?? ['meta']
    const dailyBudget = existingPack?.dailyBudget ?? 20
    const durationDays = existingPack?.durationDays ?? 7
    const currency = existingPack?.currency ?? 'USD'

    // Build brand context string
    const brandContext = buildBrandExecutionContext(brandProfile)

    const campaignStrategy = campaign.aiOutput
      ? JSON.stringify(campaign.aiOutput).slice(0, 2000)
      : 'No strategy generated yet.'

    const platformList = platforms.join(', ')
    const totalBudget = dailyBudget * durationDays

    const systemPrompt = `You are a world-class performance marketing expert with 15+ years running paid campaigns on Meta, Google, TikTok, and LinkedIn. You've managed $50M+ in ad spend across MENA and global markets.

Your job: Generate a professional, ready-to-launch paid campaign pack for the following campaign. Every field must be specific, actionable, and based on the brand profile.

NEVER use generic placeholders. NEVER say "your brand" or "your audience." Use the actual brand data provided.

Output valid JSON only. No prose, no markdown.`

    const userPrompt = `Campaign: "${campaign.name}"
Goal: ${campaign.goal}
Objective: ${objective}
Platforms: ${platformList}
Daily Budget: ${currency} ${dailyBudget}
Duration: ${durationDays} days
Total Budget: ${currency} ${totalBudget}

BRAND PROFILE:
${brandContext}

CAMPAIGN STRATEGY SUMMARY:
${campaignStrategy}

Generate a complete paid campaign pack as JSON with this exact structure:
{
  "audienceBrief": {
    "meta": {
      "ageMin": number,
      "ageMax": number,
      "genders": ["all"|"male"|"female"],
      "locations": ["City, Country"],
      "interests": ["up to 10 specific Meta interest categories"],
      "behaviors": ["up to 5 Meta behavior targeting options"],
      "exclusions": ["audiences to exclude"],
      "customAudienceSuggestions": ["Lookalike from website visitors", "Email list upload"],
      "placementRecommendation": "Facebook Feed + Instagram Reels + Stories",
      "bidStrategy": "LOWEST_COST_WITHOUT_CAP or COST_CAP",
      "estimatedAudienceSize": "500K - 1.5M"
    },
    "google": {
      "campaignType": "Search|Display|Performance Max",
      "keywords": ["10 high-intent keywords"],
      "negativeKeywords": ["5 negative keywords"],
      "audienceSegments": ["Google Audience segment names"],
      "matchTypes": "Broad Match + Phrase Match",
      "locations": ["target locations"],
      "bidStrategy": "Maximize Conversions or Target CPA"
    },
    "tiktok": {
      "ageMin": number,
      "ageMax": number,
      "genders": ["all"|"male"|"female"],
      "locations": ["Country"],
      "interests": ["TikTok interest categories"],
      "behaviors": ["TikTok behavioral targeting"],
      "videoFormat": "TopView|In-Feed|Spark Ads",
      "creatorSuggestion": "micro-influencer niche suggestion"
    },
    "linkedin": {
      "jobTitles": ["specific job titles"],
      "industries": ["LinkedIn industry names"],
      "companySizes": ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000"],
      "seniority": ["Senior", "Manager", "Director", "VP", "C-Level"],
      "skills": ["relevant skills"],
      "adFormat": "Sponsored Content|Message Ads|Lead Gen Forms"
    }
  },
  "copyVariants": [
    {
      "id": "v1",
      "label": "Hook A — Pain Point",
      "platform": "meta",
      "primaryText": "compelling opening line\n\nbody copy 2-3 sentences\n\nCTA sentence",
      "headline": "5-7 word headline",
      "description": "2-line description for link preview",
      "cta": "LEARN_MORE|SHOP_NOW|SIGN_UP|GET_QUOTE|BOOK_NOW|CONTACT_US",
      "hook": "the first sentence / opening hook only",
      "angle": "pain_point|social_proof|curiosity|urgency|benefit"
    },
    {
      "id": "v2",
      "label": "Hook B — Social Proof",
      "platform": "meta",
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "cta": "LEARN_MORE",
      "hook": "...",
      "angle": "social_proof"
    },
    {
      "id": "v3",
      "label": "Hook C — Benefit Led",
      "platform": "meta",
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "cta": "SHOP_NOW",
      "hook": "...",
      "angle": "benefit"
    },
    {
      "id": "v4",
      "label": "TikTok Script A",
      "platform": "tiktok",
      "primaryText": "Video script: Hook (0-3s): ...\n\nMiddle (3-12s): ...\n\nCTA (12-15s): ...",
      "headline": "short caption",
      "description": "hashtag set",
      "cta": "Learn More",
      "hook": "opening 3 seconds",
      "angle": "curiosity"
    },
    {
      "id": "v5",
      "label": "Google Search Ad A",
      "platform": "google",
      "primaryText": "Ad description line 1\nAd description line 2",
      "headline": "Headline 1 | Headline 2 | Headline 3",
      "description": "display URL path suggestion",
      "cta": "Visit site",
      "hook": "headline 1",
      "angle": "benefit"
    }
  ],
  "budgetInsights": {
    "recommendation": "2-3 sentences on budget split strategy",
    "splitSuggestion": {
      "meta": percentage as number,
      "google": percentage as number,
      "tiktok": percentage as number,
      "linkedin": percentage as number
    },
    "phasingSuggestion": "Day 1-3: testing phase at 50% budget. Day 4-7: scale winners.",
    "competitorBenchmark": "what competitor spend looks like in this space",
    "expectedResults": "realistic outcome expectations for this budget"
  },
  "platformGuides": {
    "meta": [
      "Step 1: Go to business.facebook.com → Ads Manager → Create",
      "Step 2: Select objective: [SPECIFIC OBJECTIVE] → Continue",
      "Step 3: Campaign name: [CAMPAIGN NAME] — Daily budget: [AMOUNT]",
      "Step 4: Audience: Ages [MIN]-[MAX], Location: [LOCATION], Interests: [LIST]",
      "Step 5: Placements: Advantage+ Placements (recommended) OR Manual: Facebook Feed, Instagram Reels, Stories",
      "Step 6: Upload creative from your Media Library. Use 1:1 for Feed, 9:16 for Reels/Stories",
      "Step 7: Primary text: [PASTE COPY VARIANT]. Headline: [PASTE HEADLINE]",
      "Step 8: Review and Publish. Allow 24h for approval."
    ],
    "google": [
      "Step 1: Go to ads.google.com → New Campaign → [CAMPAIGN TYPE]",
      "Step 2: Goal: [SPECIFIC GOAL matching objective]",
      "Step 3: Budget: [DAILY AMOUNT] / day. Bidding: [BID STRATEGY]",
      "Step 4: Location: [LOCATIONS]. Language: Arabic + English",
      "Step 5: Keywords: Add the provided keyword list. Set match types.",
      "Step 6: Ad copy: Use the Google Search Ad variant provided.",
      "Step 7: Add Sitelink extensions and Callout extensions.",
      "Step 8: Add your UTM tracking URL as final URL."
    ],
    "tiktok": [
      "Step 1: Go to ads.tiktok.com → Create Campaign → [OBJECTIVE]",
      "Step 2: Campaign budget: [TOTAL AMOUNT]. Split testing: On",
      "Step 3: Ad Group: Location [LOCATION], Age [MIN]-[MAX], Interests [LIST]",
      "Step 4: Placements: TikTok only (recommended for focus)",
      "Step 5: Upload vertical video (9:16, min 5s, max 60s). Use branded version from Media Library.",
      "Step 6: Caption: Use TikTok Script variant. Add 3-5 hashtags.",
      "Step 7: CTA button: [CTA]. Destination URL with UTM parameters.",
      "Step 8: Submit for review. TikTok approval takes 1-2 hours."
    ],
    "linkedin": [
      "Step 1: Go to linkedin.com/campaignmanager → Create Campaign",
      "Step 2: Objective: [SPECIFIC OBJECTIVE]",
      "Step 3: Audience: Job Titles [LIST], Industries [LIST], Seniority [LIST]",
      "Step 4: Ad Format: [FORMAT]. Budget: [DAILY AMOUNT].",
      "Step 5: Create ad with the LinkedIn copy variant. Image: 1200x627px.",
      "Step 6: Add Lead Gen Form if objective is LEAD_GENERATION.",
      "Step 7: Set bid type: Maximum Delivery (automated).",
      "Step 8: Review forecast. Publish when audience size shows 50K+."
    ]
  }
}`

    // Check credits — single atomic deduction (6 credits for the full pack).
    // Deduct only after cheap auth, ownership, campaign, brand, and pack context
    // checks pass. The next step is the expensive provider generation call.
    const creditResult = await checkAndDeductCredits(user.id, 'PAID_PACK_GENERATE')
    if (!creditResult.ok) {
      return NextResponse.json({ error: 'Insufficient credits', upgradeRequired: true }, { status: 402 })
    }

    const refundPaidPack = async () => {
      if (creditResult.creditsUsed <= 0) return
      if (creditResult.transactionId) {
        await refundCreditsForTransaction({
          userId: user.id,
          transactionId: creditResult.transactionId,
          reason: 'Paid campaign pack generation failed',
        })
      } else {
        await refundCredits(user.id, 'PAID_PACK_GENERATE')
      }
    }

    try {
      const raw = await callGPT(systemPrompt, userPrompt)
      let generated: {
        audienceBrief?: Record<string, unknown>
        copyVariants?: unknown[]
        budgetInsights?: Record<string, unknown>
        platformGuides?: Record<string, unknown>
      }

      try {
        generated = JSON.parse(raw)
      } catch {
        await refundPaidPack()
        return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
      }

      // Calculate estimated reach
      const estimatedReach = estimateReach(dailyBudget, durationDays, platforms)

      // Generate UTM params
      const slug = buildSlug(campaign.name)
      const utmParams = {
        source: '{platform}',  // replaced per-platform in UI
        medium: 'paid_social',
        campaign: slug,
        content: '{variant_id}',
        term: '{audience_segment}',
        examples: platforms.reduce((acc: Record<string, string>, p: string) => {
          acc[p] = `utm_source=${p}&utm_medium=paid_social&utm_campaign=${slug}&utm_content=v1&utm_term=${p}_audience`
          return acc
        }, {}),
      }

      // Save to DB
      const pack = await db.paidCampaignPack.upsert({
        where: { campaignId },
        update: {
          audienceBrief: generated.audienceBrief ?? {},
          copyVariants: generated.copyVariants ?? [],
          estimatedReach,
          utmParams,
          platformGuides: generated.platformGuides ?? {},
          budgetInsights: generated.budgetInsights ?? {},
          status: 'GENERATED',
          generatedAt: new Date(),
        },
        create: {
          campaignId,
          workspaceId: campaign.workspaceId,
          objective,
          platforms,
          dailyBudget,
          durationDays,
          currency,
          audienceBrief: generated.audienceBrief ?? {},
          copyVariants: generated.copyVariants ?? [],
          estimatedReach,
          utmParams,
          platformGuides: generated.platformGuides ?? {},
          budgetInsights: generated.budgetInsights ?? {},
          status: 'GENERATED',
          generatedAt: new Date(),
        },
      })

      return NextResponse.json({ pack, success: true })
    } catch (err) {
      console.error('[paid-pack/generate]', err)
      await refundPaidPack()
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }
  } catch (err) {
    console.error('[paid-pack/generate]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
