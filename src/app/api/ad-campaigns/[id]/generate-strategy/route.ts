/**
 * POST /api/ad-campaigns/[id]/generate-strategy
 *
 * AI-powered paid campaign strategy engine.
 * Combines Brand Brain + campaign brief + platform intelligence to produce:
 *   - Full campaign positioning
 *   - Target audience analysis
 *   - Budget allocation plan
 *   - Creative brief
 *   - Platform-specific audience targeting specs
 *   - Expected results forecast
 *
 * This is the "brain" of the paid campaign system.
 * The output feeds directly into generate-audience (targeting params)
 * and generate-copy (creative concepts).
 *
 * Credit cost: 4 (AD_COPY × 2)
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
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'

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
      temperature: 0.65,
      max_tokens: 4000,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? '{}'
}

// MENA-accurate CPM benchmarks (USD per 1000 impressions)
// Based on real GCC + MENA performance marketing data
const MENA_CPM = {
  META:     { min: 1.5,  max: 5.0,  note: 'Saudi Arabia / UAE / Egypt range' },
  GOOGLE:   { min: 0.8,  max: 3.5,  note: 'CPC-based; display lower than search' },
  TIKTOK:   { min: 2.0,  max: 7.0,  note: 'Higher for premium placements' },
  LINKEDIN: { min: 20.0, max: 55.0, note: 'B2B premium; lower in non-Gulf markets' },
}

// Global CPM benchmarks (for non-MENA clients)
const GLOBAL_CPM = {
  META:     { min: 4.0,  max: 12.0 },
  GOOGLE:   { min: 1.0,  max: 5.0  },
  TIKTOK:   { min: 6.0,  max: 15.0 },
  LINKEDIN: { min: 25.0, max: 60.0 },
}

function estimateReach(
  budget: number,
  days: number,
  platform: string,
  isMENA: boolean
): { impressionsMin: number; impressionsMax: number; cpmMin: number; cpmMax: number; reachMin: number; reachMax: number } {
  const table = isMENA ? MENA_CPM : GLOBAL_CPM
  const bench = table[platform as keyof typeof table] || { min: 4, max: 12 }
  const totalBudget = budget * days
  const impressionsMax = Math.round((totalBudget / bench.min) * 1000)
  const impressionsMin = Math.round((totalBudget / bench.max) * 1000)
  // Rough reach: assume 1.5–2.5x frequency
  return {
    impressionsMin,
    impressionsMax,
    cpmMin: bench.min,
    cpmMax: bench.max,
    reachMin: Math.round(impressionsMin / 2.5),
    reachMax: Math.round(impressionsMax / 1.5),
  }
}

async function refundDeductedCredits(userId: string, credit: CreditDeductionOk, reason: string) {
  if (credit.creditsUsed <= 0) return
  if (credit.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: credit.transactionId, reason })
    return
  }
  await refundCredits(userId, 'AD_COPY', reason)
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let chargedUserId: string | null = null
  let chargedCredit: CreditDeductionOk | null = null

  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Accept optional language override from client
    const body = await req.json().catch(() => ({}))
    const requestedLang = (body.language as string) || null

    // Fetch campaign
    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      include: {
        workspace: true,
        adAccount: true,
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Fetch Brand Brain
    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.findUnique({
        where: { workspaceId: campaign.workspaceId },
      })
    } catch { /* ok */ }

    // Fetch recent campaign memories for context
    let memories: unknown[] = []
    try {
      memories = await db.campaignMemory.findMany({
        where: { workspaceId: campaign.workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { learnings: true, goal: true, createdAt: true },
      })
    } catch { /* ok */ }

    // Detect if MENA market
    const locationHint = (brandProfile?.audienceLocation || '').toLowerCase()
    const isMENA = ['saudi', 'uae', 'egypt', 'mena', 'gulf', 'كويت', 'إمارات', 'السعودية', 'مصر', 'خليج'].some(
      kw => locationHint.includes(kw)
    )

    // Language preference — client override takes priority, then brand detection
    const detectedLang = brandProfile?.audienceLocation &&
      ['saudi', 'uae', 'egypt', 'mena', 'gulf', 'كويت', 'إمارات', 'السعودية', 'مصر', 'خليج'].some(
        kw => (brandProfile.audienceLocation || '').toLowerCase().includes(kw)
      ) ? 'ar' : 'en'
    const langInstruction = getLanguageInstruction(requestedLang || detectedLang)

    const platformLabel = campaign.platform
    const objective = campaign.objective
    const dailyBudget = campaign.dailyBudget || 50
    const currency = campaign.currency || 'USD'
    const durationDays = campaign.endDate && campaign.startDate
      ? Math.max(1, Math.round((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / 86400000))
      : 14
    const totalBudget = dailyBudget * durationDays
    const reachEstimate = estimateReach(dailyBudget, durationDays, platformLabel, isMENA)

    // Build brand context
    const brandCtx = buildBrandExecutionContext(brandProfile)

    const memoriesCtx = memories.length > 0
      ? `\nPAST STRATEGY MEMORY CANDIDATES — NOT VERIFIED PERFORMANCE:\n${memories.map((m: any) => JSON.stringify(m.learnings)).join('\n')}`
      : ''

    const systemPrompt = `You are a world-class performance marketing strategist with 20+ years of experience.
You've managed $100M+ in ad spend across Meta, Google, TikTok, and LinkedIn — with deep expertise in MENA, Gulf, and global markets.

Your job: Generate the most precise, brand-specific paid campaign strategy for the following campaign.
Every output must be SPECIFIC to this brand — never generic. Use exact brand terminology.

${langInstruction}

Output ONLY valid JSON. No prose, no markdown, no explanation outside JSON.`

    const userPrompt = `Campaign: "${campaign.name}"
Platform: ${platformLabel}
Objective: ${objective}
Daily Budget: ${currency} ${dailyBudget}
Campaign Duration: ${durationDays} days
Total Budget: ${currency} ${totalBudget}
Estimated Reach: ${reachEstimate.reachMin.toLocaleString()} – ${reachEstimate.reachMax.toLocaleString()} unique people
Market: ${isMENA ? 'MENA / Gulf' : 'Global'}

${brandCtx}
${memoriesCtx}

Generate a complete paid campaign strategy as JSON with EXACTLY this structure:
{
  "positioning": {
    "core_message": "The single most compelling statement about the brand — 1 sentence, brand-specific",
    "value_proposition": "What makes this offer uniquely worth paying attention to RIGHT NOW",
    "differentiation": "What separates this from competitors — be specific",
    "emotional_hook": "The emotional trigger that drives action for THIS audience"
  },
  "audience": {
    "primary_segment": {
      "description": "Detailed description of the #1 audience segment",
      "ageRange": "e.g. 25-44",
      "gender": "male|female|all",
      "psychographics": ["trait 1", "trait 2", "trait 3"],
      "buyingTriggers": ["trigger 1", "trigger 2"],
      "estimatedSize": "e.g. 800K – 2M on ${platformLabel} in target region"
    },
    "secondary_segment": {
      "description": "Second best audience segment",
      "ageRange": "string",
      "gender": "male|female|all"
    },
    "exclusions": ["audiences to EXCLUDE for better efficiency"]
  },
  "targeting": {
    "locations": ["specific cities or countries"],
    "languages": ["language codes"],
    ${platformLabel === 'META' ? `
    "meta_interests": ["up to 10 specific Meta interest categories — use exact names from Ads Manager"],
    "meta_behaviors": ["up to 5 Meta behavioral targeting options"],
    "meta_custom_audiences": ["Lookalike 1% from website visitors", "Email list upload", "Video views 75%"],
    "meta_placements": ["Facebook Feed", "Instagram Reels", "Stories"],
    "meta_bid_strategy": "LOWEST_COST_WITHOUT_CAP",
    "meta_optimization_goal": "LINK_CLICKS|CONVERSIONS|LEAD_GENERATION|REACH"
    ` : ''}
    ${platformLabel === 'GOOGLE' ? `
    "google_campaign_type": "Search|Display|Performance Max",
    "google_keywords": ["10 high-intent keywords"],
    "google_negative_keywords": ["5 negative keywords to exclude"],
    "google_audience_segments": ["Google audience names"],
    "google_bid_strategy": "Maximize Conversions|Target CPA|Target ROAS",
    "google_match_types": "Broad Match + Phrase Match"
    ` : ''}
    ${platformLabel === 'TIKTOK' ? `
    "tiktok_interests": ["TikTok interest category names"],
    "tiktok_behaviors": ["TikTok behavioral segments"],
    "tiktok_placement": "TikTok Feed|TopView|Brand Takeover",
    "tiktok_creative_format": "In-Feed|TopView|Spark Ads",
    "tiktok_hashtag_targets": ["hashtags relevant to this audience"]
    ` : ''}
    ${platformLabel === 'LINKEDIN' ? `
    "linkedin_job_titles": ["specific job titles — LinkedIn format"],
    "linkedin_industries": ["LinkedIn industry names"],
    "linkedin_company_sizes": ["1-10", "11-50", "51-200", "201-500", "501-1000"],
    "linkedin_seniority": ["Senior", "Manager", "Director", "VP", "C-Level"],
    "linkedin_skills": ["relevant skills"],
    "linkedin_ad_format": "Sponsored Content|Message Ads|Lead Gen Forms|Document Ads"
    ` : ''}
  },
  "budget_plan": {
    "daily_budget": ${dailyBudget},
    "total_budget": ${totalBudget},
    "currency": "${currency}",
    "duration_days": ${durationDays},
    "phasing": {
      "learning_phase": "Day 1-${Math.max(3, Math.round(durationDays * 0.25))}: Testing phase at 50-70% budget. Let algorithm learn.",
      "scaling_phase": "Day ${Math.max(4, Math.round(durationDays * 0.25) + 1)}-${durationDays}: Scale winners. Cut losers.",
      "recommendation": "Specific phasing recommendation for this campaign objective and budget"
    },
    "estimated_cpm": { "min": ${reachEstimate.cpmMin}, "max": ${reachEstimate.cpmMax} },
    "estimated_impressions": { "min": ${reachEstimate.impressionsMin}, "max": ${reachEstimate.impressionsMax} },
    "estimated_reach": { "min": ${reachEstimate.reachMin}, "max": ${reachEstimate.reachMax} },
    "expected_results": "Specific, realistic results forecast for this budget + objective",
    "benchmark_comparison": "How this budget compares to typical competitors in this space"
  },
  "creative_brief": {
    "visual_direction": "Specific creative direction — what to show, colors, style, emotion",
    "messaging_hierarchy": [
      "Hook (1st 3 seconds / headline)",
      "Value proof (middle section)",
      "CTA (closing)"
    ],
    "recommended_formats": ["best ad formats for this platform + objective"],
    "a_b_test_suggestion": "Which 2 angles to A/B test and why",
    "creative_dont": "What creative approach FAILED before or would NOT work for this brand"
  },
  "utm_tracking": {
    "source": "${platformLabel.toLowerCase()}",
    "medium": "paid_social",
    "campaign": "${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)}",
    "recommended_suffix": "e.g. utm_content=v1_hook_a&utm_term=cold_audience"
  },
  "launch_checklist": [
    "Checklist item 1 — platform-specific pre-launch requirement",
    "Checklist item 2",
    "Checklist item 3",
    "Checklist item 4",
    "Checklist item 5"
  ]
}`

    const creditResult = await checkAndDeductCredits(user.id, 'AD_COPY')
    if (!creditResult.ok) {
      return NextResponse.json({ error: 'Insufficient credits', upgradeRequired: true }, { status: 402 })
    }
    chargedUserId = user.id
    chargedCredit = creditResult

    const raw = await callGPT(systemPrompt, userPrompt)
    let strategy: Record<string, unknown>
    try {
      strategy = JSON.parse(raw)
    } catch {
      await refundDeductedCredits(user.id, creditResult, 'AI returned invalid JSON')
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    // Save brand brain snapshot + AI strategy to campaign
    const brandBrainSnapshot = brandProfile ? {
      brandName: brandProfile.brandName,
      industry: brandProfile.industry,
      targetAudience: brandProfile.targetAudience,
      toneKeywords: brandProfile.toneKeywords,
      winningHooks: brandProfile.winningHooks,
      snapshotAt: new Date().toISOString(),
    } : null

    await db.adCampaign.update({
      where: { id: params.id },
      data: {
        aiStrategy: strategy,
        aiAudienceBrief: strategy.targeting,
        aiBudgetPlan: strategy.budget_plan,
        brandBrainSnapshot,
      },
    })

    return NextResponse.json({
      strategy,
      reachEstimate,
      success: true,
    })
  } catch (err) {
    console.error('[generate-strategy]', err)
    if (chargedUserId && chargedCredit) {
      await refundDeductedCredits(chargedUserId, chargedCredit, 'Strategy generation failed')
    }
    return NextResponse.json({ error: 'Strategy generation failed' }, { status: 500 })
  }
}
