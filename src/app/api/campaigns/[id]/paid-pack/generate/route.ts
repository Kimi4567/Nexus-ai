/**
 * POST /api/campaigns/[id]/paid-pack/generate
 *
 * Uses GPT-4o to generate the full paid planning pack:
 * - Platform-specific audience targeting (Meta, Google, TikTok, LinkedIn)
 * - A/B copy variants (3 per platform)
 * - Budget review and forecast-readiness status
 * - UTM parameter set
 * - Platform-by-platform setup review guide (step by step)
 *
 * The data model maps 1:1 to Meta Marketing API fields so when
 * API approval arrives, we just add the API call on top.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { checkAndDeductCredits, refundCredits, refundCreditsForTransaction } from '@/lib/credits'
import { getBudgetTruth } from '@/lib/paidBoundary'
import { resolveStrategyScope } from '@/lib/strategy/strategyScope'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'

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
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('OpenAI returned no paid planning pack')
  return content
}

function buildSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function enforcePaidPackTruth<T extends {
  audienceBrief?: Record<string, unknown>
  budgetInsights?: Record<string, unknown>
}>(generated: T): T {
  const audienceBrief = generated.audienceBrief && typeof generated.audienceBrief === 'object'
    ? { ...generated.audienceBrief }
    : {}
  const meta = audienceBrief.meta && typeof audienceBrief.meta === 'object'
    ? { ...(audienceBrief.meta as Record<string, unknown>) }
    : undefined
  if (meta) {
    meta.estimatedAudienceSize = null
    meta.audienceForecastStatus = 'unavailable_until_platform_forecast'
    meta.platformValidationRequired = true
    audienceBrief.meta = meta
  }

  const budgetInsights = generated.budgetInsights && typeof generated.budgetInsights === 'object'
    ? { ...generated.budgetInsights }
    : {}
  budgetInsights.competitorBenchmark = null
  budgetInsights.expectedResults = null
  budgetInsights.forecastStatus = 'unavailable_until_platform_forecast'
  budgetInsights.forecastReason = 'No account-level platform forecast or verified historical performance was available.'

  return { ...generated, audienceBrief, budgetInsights } as T
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
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

    const strategyScope = resolveStrategyScope(campaign.aiOutput)
    if (!strategyScope.includesPaid) {
      return NextResponse.json({
        error: 'PAID_PLANNING_OUT_OF_SCOPE',
        message: 'Paid planning requires a Paid or Full strategy. This campaign is organic-only.',
      }, { status: 409 })
    }

    const requestedLanguage = req.headers?.get?.('x-output-language') === 'ar' ? 'ar' : 'en'

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
    const platforms: string[] = existingPack?.platforms ?? []
    if (platforms.length === 0) {
      return NextResponse.json({
        error: 'Select at least one planning platform before generation.',
        code: 'PAID_PLATFORMS_REQUIRED',
      }, { status: 422 })
    }
    const savedDailyBudget = positiveNumber(existingPack?.dailyBudget)
    const savedTotalBudget = positiveNumber(existingPack?.totalBudget)
    if (!savedDailyBudget && !savedTotalBudget) {
      return NextResponse.json({
        error: 'Enter a planning budget before generation. It remains unapproved until final launch confirmation.',
        code: 'PAID_BUDGET_REQUIRED',
      }, { status: 422 })
    }
    const budgetTruth = getBudgetTruth({
      amount: savedDailyBudget ?? savedTotalBudget,
      fallbackAmount: 0,
      explicitBudgetConfirmed: false,
    })
    const durationDays = Number.isInteger(existingPack?.durationDays) && existingPack.durationDays > 0
      ? existingPack.durationDays
      : null
    if (!durationDays) {
      return NextResponse.json({
        error: 'Enter a valid planning duration before generation.',
        code: 'PAID_DURATION_REQUIRED',
      }, { status: 422 })
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(requestedLanguage), { status: 503 })
    }

    const currency = existingPack?.currency ?? 'USD'

    // Build brand context string
    const brandContext = brandProfile ? `
Brand: ${brandProfile.brandName ?? 'Unknown'}
Industry: ${brandProfile.industry ?? 'Unknown'}
Description: ${brandProfile.description ?? ''}
Primary Offer: ${brandProfile.primaryOffer ?? ''}
Price Point: ${brandProfile.pricePoint ?? ''}
Target Audience: ${brandProfile.targetAudience ?? ''}
Audience Age: ${brandProfile.audienceAge ?? ''}
Audience Location: ${brandProfile.audienceLocation ?? ''}
Audience Pain Points: ${(brandProfile.audiencePainPoints ?? []).join(', ')}
Audience Desires: ${(brandProfile.audienceDesires ?? []).join(', ')}
Brand Tone: ${(brandProfile.toneKeywords ?? []).join(', ')}
Unique Advantages: ${(brandProfile.uniqueAdvantages ?? []).join(', ')}
Top Platforms: ${(brandProfile.topPlatforms ?? []).join(', ')}
Reviewed Hook Signals: ${(brandProfile.winningHooks ?? []).join(' | ')}
Reviewed Avoidance Signals: ${(brandProfile.failedAngles ?? []).join(', ')}
Competitor Notes: ${brandProfile.competitorNotes ?? ''}
` : 'No brand profile available.'

    const campaignStrategy = campaign.aiOutput
      ? JSON.stringify(campaign.aiOutput).slice(0, 2000)
      : 'No strategy generated yet.'

    const platformList = platforms.join(', ')
    const totalBudget = savedTotalBudget ?? (savedDailyBudget as number) * durationDays

    const systemPrompt = `You are a senior paid planning strategist with deep experience planning campaigns on Meta, Google, TikTok, and LinkedIn.

Your job: Generate a professional paid planning pack for review. This is planning-only. Do not imply ads are ready to launch, active, running, approved, or spend-ready.

NEVER use generic placeholders. NEVER say "your brand" or "your audience." Use the actual brand data provided.

No ad spend is approved by this pack. No platform launch is approved by this pack. If budget is not explicitly confirmed by the user, label it as a planning assumption or an unconfirmed planning budget value according to the budget source; do not recommend spend as approved.

If a budget value is present but not explicitly confirmed, treat this as a planning budget value only. Do not present it as approved spend.

Do not invent ROI, ROAS, CPA, guaranteed outcomes, expected conversions, competitor spend, benchmark superiority, winning paid creative, best-performing paid assets, audience size, CPM, impressions, or reach. Account-level forecasts are unavailable in this request, so every forecast field must remain null.
Treat interests, behaviors, keywords, placements, formats, bidding, and other platform options as hypotheses for review. Their availability must be validated in the connected account; do not claim they are exact platform categories.
Do not invent testimonials, customer counts, ratings, certifications, awards, case studies, or other social proof. Use only verified proof present in the brand or campaign context.

Write every human-readable planning value in ${requestedLanguage === 'ar' ? 'Arabic' : 'English'}. Keep JSON keys, platform ids, enum values, CTA enum values, and UTM parameters exactly as specified.

Output valid JSON only. No prose, no markdown.`

    const userPrompt = `Campaign: "${campaign.name}"
Goal: ${campaign.goal}
Objective: ${objective}
Platforms: ${platformList}
Daily Budget: ${savedDailyBudget ? `${currency} ${savedDailyBudget}` : 'Not supplied'}
Duration: ${durationDays} days
Total Budget: ${currency} ${totalBudget}
Budget Source: ${budgetTruth.budgetSource}
Budget Confirmed: ${budgetTruth.budgetConfirmed ? 'true' : 'false'}
Budget Value Present: ${budgetTruth.budgetValuePresent ? 'true' : 'false'}

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
      "interests": ["up to 10 targeting hypotheses to validate in the connected account"],
      "behaviors": ["up to 5 behavior hypotheses to validate in the connected account"],
      "exclusions": ["audiences to exclude"],
      "customAudienceSuggestions": ["Lookalike from website visitors", "Email list upload"],
      "placementRecommendation": "Facebook Feed + Instagram Reels + Stories",
      "bidStrategy": "LOWEST_COST_WITHOUT_CAP or COST_CAP",
      "estimatedAudienceSize": null,
      "audienceForecastStatus": "unavailable_until_platform_forecast",
      "platformValidationRequired": true
    },
    "google": {
      "campaignType": "Search|Display|Performance Max",
      "keywords": ["10 high-intent keywords"],
      "negativeKeywords": ["5 negative keywords"],
      "audienceSegments": ["audience hypotheses to validate in the connected account"],
      "matchTypes": "Broad Match + Phrase Match",
      "locations": ["target locations"],
      "bidStrategy": "Maximize Conversions or Target CPA"
    },
    "tiktok": {
      "ageMin": number,
      "ageMax": number,
      "genders": ["all"|"male"|"female"],
      "locations": ["Country"],
      "interests": ["targeting hypotheses to validate in the connected account"],
      "behaviors": ["behavior hypotheses to validate in the connected account"],
      "videoFormat": "TopView|In-Feed|Spark Ads",
      "creatorSuggestion": "micro-influencer niche suggestion"
    },
    "linkedin": {
      "jobTitles": ["specific job titles"],
      "industries": ["industry hypotheses to validate in the connected account"],
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
      "label": "Hook B — Objection Handling",
      "platform": "meta",
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "cta": "LEARN_MORE",
      "hook": "...",
      "angle": "objection_handling"
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
    "budgetSource": "${budgetTruth.budgetSource}",
    "budgetConfirmed": ${budgetTruth.budgetConfirmed ? 'true' : 'false'},
    "recommendation": "2-3 sentences on planning-only budget allocation; say budget needs confirmation if not confirmed",
    "splitSuggestion": {
      "meta": percentage as number,
      "google": percentage as number,
      "tiktok": percentage as number,
      "linkedin": percentage as number
    },
    "phasingSuggestion": "A review sequence aligned with the saved duration; only scale after verified platform metrics exist.",
    "competitorBenchmark": null,
    "expectedResults": null,
    "forecastStatus": "unavailable_until_platform_forecast",
    "forecastReason": "No account-level platform forecast or verified historical performance was available."
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
      "Step 8: Review in Meta. Do not publish or activate until budget, tracking, creative, and platform readiness are confirmed."
    ],
    "google": [
      "Step 1: Go to ads.google.com → New Campaign → [CAMPAIGN TYPE]",
      "Step 2: Goal: [SPECIFIC GOAL matching objective]",
      "Step 3: Budget: [DAILY AMOUNT] / day. Bidding: [BID STRATEGY]",
      "Step 4: Location: [LOCATIONS]. Language: Arabic + English",
      "Step 5: Keywords: Add the provided keyword list. Set match types.",
      "Step 6: Ad copy: Use the Google Search Ad variant provided.",
      "Step 7: Add Sitelink extensions and Callout extensions.",
      "Step 8: Add your UTM tracking URL as final URL, then review before any launch."
    ],
    "tiktok": [
      "Step 1: Go to ads.tiktok.com → Create Campaign → [OBJECTIVE]",
      "Step 2: Campaign budget: [TOTAL AMOUNT]. Split testing: On",
      "Step 3: Ad Group: Location [LOCATION], Age [MIN]-[MAX], Interests [LIST]",
      "Step 4: Placements: TikTok only (recommended for focus)",
      "Step 5: Upload vertical video (9:16, min 5s, max 60s). Use branded version from Media Library.",
      "Step 6: Caption: Use TikTok Script variant. Add 3-5 hashtags.",
      "Step 7: CTA button: [CTA]. Destination URL with UTM parameters.",
      "Step 8: Review setup. Do not submit or activate until launch readiness is confirmed."
    ],
    "linkedin": [
      "Step 1: Go to linkedin.com/campaignmanager → Create Campaign",
      "Step 2: Objective: [SPECIFIC OBJECTIVE]",
      "Step 3: Audience: Job Titles [LIST], Industries [LIST], Seniority [LIST]",
      "Step 4: Ad Format: [FORMAT]. Budget: [DAILY AMOUNT].",
      "Step 5: Create ad with the LinkedIn copy variant. Image: 1200x627px.",
      "Step 6: Add Lead Gen Form if objective is LEAD_GENERATION.",
      "Step 7: Set bid type: Maximum Delivery (automated).",
      "Step 8: Review forecast and readiness before any platform-side launch."
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
        const parsed = JSON.parse(raw) as typeof generated
        if (!parsed.audienceBrief || !Array.isArray(parsed.copyVariants) || parsed.copyVariants.length === 0) {
          throw new Error('Incomplete paid planning pack')
        }
        generated = enforcePaidPackTruth(parsed)
      } catch {
        await refundPaidPack()
        return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
      }

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
          estimatedReach: null,
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
          dailyBudget: savedDailyBudget,
          totalBudget: savedTotalBudget,
          durationDays,
          currency,
          audienceBrief: generated.audienceBrief ?? {},
          copyVariants: generated.copyVariants ?? [],
          estimatedReach: null,
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
