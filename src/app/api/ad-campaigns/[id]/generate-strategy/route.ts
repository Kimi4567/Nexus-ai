/**
 * POST /api/ad-campaigns/[id]/generate-strategy
 *
 * AI-powered paid execution-plan engine.
 * Translates an approved Paid/Full strategy + Brand Brain into platform inputs:
 *   - Full campaign positioning
 *   - Target audience analysis
 *   - Budget allocation plan
 *   - Creative brief
 *   - Platform-specific audience targeting specs
 *   - Forecast-readiness status (real forecasts require platform data)
 *
 * The approved source strategy remains the marketing brain and source of truth.
 * The output feeds directly into generate-audience (targeting params)
 * and generate-copy (creative concepts).
 *
 * Credit cost: 4 (PAID_EXECUTION_PLAN)
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
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { extractGoogleSearchTargeting } from '@/lib/adPlatforms/googleAdsApi'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import {
  getPaidStrategySourceForUser,
  PaidStrategySourceError,
} from '@/lib/paidStrategySourceServer'
import { getStrategyBriefReadiness } from '@/lib/strategyBriefReadiness'
import {
  googleSearchBiddingMode,
  paidOptimizationGoal,
} from '@/lib/paidExecutionObjective'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'

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
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('OpenAI returned no paid strategy')
  return content
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function enforceForecastBoundary(
  generated: Record<string, unknown>,
  budget: { dailyBudget: number | null; lifetimeBudget: number | null; totalBudget: number; currency: string; durationDays: number },
): Record<string, unknown> {
  const audience = generated.audience && typeof generated.audience === 'object'
    ? { ...(generated.audience as Record<string, unknown>) }
    : {}
  const primary = audience.primary_segment && typeof audience.primary_segment === 'object'
    ? { ...(audience.primary_segment as Record<string, unknown>) }
    : {}
  primary.estimatedSize = null
  primary.estimateStatus = 'unavailable_until_platform_forecast'
  audience.primary_segment = primary

  const targeting = generated.targeting && typeof generated.targeting === 'object'
    ? { ...(generated.targeting as Record<string, unknown>) }
    : {}
  targeting.platformValidationRequired = true

  const generatedBudgetPlan = generated.budget_plan && typeof generated.budget_plan === 'object'
    ? generated.budget_plan as Record<string, unknown>
    : {}

  return {
    ...generated,
    audience,
    targeting,
    budget_plan: {
      ...generatedBudgetPlan,
      daily_budget: budget.dailyBudget,
      lifetime_budget: budget.lifetimeBudget,
      total_budget: budget.totalBudget,
      currency: budget.currency,
      duration_days: budget.durationDays,
      estimated_cpm: null,
      estimated_impressions: null,
      estimated_reach: null,
      expected_results: null,
      benchmark_comparison: null,
      forecast_status: 'unavailable_until_platform_forecast',
      forecast_reason: 'No account-level platform forecast or verified historical performance was available.',
    },
  }
}

async function refundDeductedCredits(userId: string, credit: CreditDeductionOk, reason: string) {
  await refundCreditDeduction({ userId, action: 'PAID_EXECUTION_PLAN', deduction: credit, reason })
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
    if (campaign.objective !== paidSource.truth.executionObjective) {
      return NextResponse.json({
        error: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        code: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        expectedObjective: paidSource.truth.executionObjective,
      }, { status: 422 })
    }

    // Fetch Brand Brain
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
    const dailyBudget = positiveNumber(campaign.dailyBudget)
    const lifetimeBudget = positiveNumber(campaign.lifetimeBudget)
    const currency = campaign.currency || 'USD'
    if (!campaign.startDate || !campaign.endDate) {
      return NextResponse.json({
        error: 'A real planning start and end date are required before strategy generation.',
        code: 'PAID_SCHEDULE_REQUIRED',
      }, { status: 422 })
    }
    const durationDays = Math.max(
      1,
      Math.ceil((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / 86400000),
    )
    if (!dailyBudget && !lifetimeBudget) {
      return NextResponse.json({
        error: 'Enter a planning budget before strategy generation. It remains unapproved until final launch confirmation.',
        code: 'PAID_BUDGET_REQUIRED',
      }, { status: 422 })
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(requestedLang || detectedLang), { status: 503 })
    }

    const totalBudget = lifetimeBudget ?? (dailyBudget as number) * durationDays

    // Build brand context
    const brandCtx = buildBrandExecutionContext(brandProfile)

    const memoriesCtx = memories.length > 0
      ? `\nPAST STRATEGY MEMORY CANDIDATES — NOT VERIFIED PERFORMANCE:\n${memories.map((m: any) => JSON.stringify(m.learnings)).join('\n')}`
      : ''

    const systemPrompt = `You are a senior paid media execution planner.

Your job: Translate the APPROVED SOURCE STRATEGY into a precise, platform-specific execution plan for review.
Do not create a second strategy. Do not change the approved audience, positioning, offer, funnel, or message hierarchy.
If the platform cannot execute part of the approved strategy, expose a blocker or review hypothesis instead of silently changing the strategy.
Every output must be SPECIFIC to this brand — never generic. Use exact brand terminology.
Do not invent performance history, competitor spend, audience size, CPM, reach, impressions, conversions, ROI, ROAS, CPA, or guaranteed outcomes.
Treat interest, behavior, keyword, placement, and bid options as review hypotheses that must be validated in the user's live platform account. Never claim an option exists in Ads Manager unless live platform data proves it.
Do not invent testimonials, customer counts, ratings, certifications, awards, case studies, or other social proof. Use only proof explicitly present in the supplied brand context.
No budget in this plan is approved spend. No campaign is launched by generating this plan.

${langInstruction}

Output ONLY valid JSON. No prose, no markdown, no explanation outside JSON.`

    const userPrompt = `APPROVED SOURCE STRATEGY: "${paidSource.campaign.name}"
${paidSource.executionContext}

PLATFORM EXECUTION DRAFT: "${campaign.name}"
Platform: ${platformLabel}
Objective: ${objective}
Daily Budget: ${dailyBudget ? `${currency} ${dailyBudget}` : 'Not applicable — lifetime budget supplied'}
Lifetime Budget: ${lifetimeBudget ? `${currency} ${lifetimeBudget}` : 'Not supplied'}
Campaign Duration: ${durationDays} days
Total Budget: ${currency} ${totalBudget}
Confirmed Market: ${brandProfile.audienceLocation || 'Not provided'}

${brandCtx}
${memoriesCtx}

Generate a complete paid execution plan as JSON with EXACTLY this structure:
{
  "positioning": {
    "core_message": "One brand-specific statement grounded only in the approved strategy and confirmed Brand Brain facts",
    "value_proposition": "The confirmed offer value, without invented urgency or unverified superiority",
    "differentiation": "Only a supplied advantage or competitor distinction; otherwise state that differentiation needs user review",
    "emotional_hook": "A review hypothesis grounded in a confirmed audience pain point or desire"
  },
  "audience": {
    "primary_segment": {
      "description": "The approved primary audience description, without expanding it",
      "ageRange": "confirmed range or null",
      "gender": "confirmed value or null",
      "psychographics": ["confirmed traits or clearly labeled review hypotheses"],
      "buyingTriggers": ["confirmed triggers or clearly labeled review hypotheses"],
      "estimatedSize": null,
      "estimateStatus": "unavailable_until_platform_forecast"
    },
    "secondary_segment": "approved secondary segment object or null",
    "exclusions": ["review hypotheses only; empty when unsupported"]
  },
  "targeting": {
    "locations": ["specific cities or countries"],
    "languages": ["language codes"],
    ${platformLabel === 'META' ? `
    "meta_interest_hypotheses": ["up to 10 review hypotheses — validate availability in the connected account"],
    "meta_behavior_hypotheses": ["up to 5 review hypotheses — validate availability in the connected account"],
    "meta_custom_audience_prerequisites": ["Only first-party audiences the workspace actually has or can lawfully create"],
    "meta_placements": ["Facebook Feed", "Instagram Reels", "Stories"],
    "meta_bid_strategy": "LOWEST_COST_WITHOUT_CAP",
    "meta_optimization_goal": "${paidOptimizationGoal(objective)}"
    ` : ''}
    ${platformLabel === 'GOOGLE' ? `
    "google_campaign_type": "SEARCH",
    "google_keywords": [
      { "text": "specific high-intent keyword", "matchType": "PHRASE" },
      { "text": "specific commercial keyword", "matchType": "EXACT" },
      { "text": "specific discovery keyword", "matchType": "BROAD" }
    ],
    "google_negative_keywords": [
      { "text": "irrelevant query", "matchType": "PHRASE" }
    ],
    "google_locations": [
      { "name": "exact city, region, or country name", "countryCode": "ISO-3166-1 alpha-2", "targetType": "City|State|Country" }
    ],
    "google_location_presence": "PRESENCE|PRESENCE_OR_INTEREST",
    "google_audience_hypotheses": ["review hypotheses — validate availability in the connected account"],
    "google_bid_strategy": "${googleSearchBiddingMode(objective)}",
    "google_network_scope": "GOOGLE_SEARCH_ONLY"
    ` : ''}
    ${platformLabel === 'TIKTOK' ? `
    "tiktok_interest_hypotheses": ["review hypotheses — validate availability in the connected account"],
    "tiktok_behavior_hypotheses": ["review hypotheses — validate availability in the connected account"],
    "tiktok_placement": "TikTok Feed|TopView|Brand Takeover",
    "tiktok_creative_format": "In-Feed|TopView|Spark Ads",
    "tiktok_hashtag_targets": ["hashtags relevant to this audience"]
    ` : ''}
    ${platformLabel === 'LINKEDIN' ? `
    "linkedin_job_titles": ["specific job titles — LinkedIn format"],
    "linkedin_industry_hypotheses": ["review hypotheses — validate availability in the connected account"],
    "linkedin_company_sizes": ["1-10", "11-50", "51-200", "201-500", "501-1000"],
    "linkedin_seniority": ["Senior", "Manager", "Director", "VP", "C-Level"],
    "linkedin_skills": ["relevant skills"],
    "linkedin_ad_format": "Sponsored Content|Message Ads|Lead Gen Forms|Document Ads"
    ` : ''}
  },
  "budget_plan": {
    "daily_budget": ${dailyBudget ?? 'null'},
    "lifetime_budget": ${lifetimeBudget ?? 'null'},
    "total_budget": ${totalBudget},
    "currency": "${currency}",
    "duration_days": ${durationDays},
    "phasing": {
      "learning_phase": "Review-first testing stage inside the saved ${durationDays}-day window; do not imply performance before verified metrics exist.",
      "scaling_phase": "Scale only after real account metrics meet user-approved decision rules.",
      "recommendation": "Specific phasing recommendation for this campaign objective and budget"
    },
    "estimated_cpm": null,
    "estimated_impressions": null,
    "estimated_reach": null,
    "expected_results": null,
    "benchmark_comparison": null,
    "forecast_status": "unavailable_until_platform_forecast",
    "forecast_reason": "No account-level platform forecast or verified historical performance was available."
  },
  "creative_brief": {
    "visual_direction": "Specific creative direction — what to show, colors, style, emotion",
    "messaging_hierarchy": [
      "Hook (1st 3 seconds / headline)",
      "Value proof (middle section)",
      "CTA (closing)"
    ],
    "recommended_formats": ["formats supported by the current execution path; label anything else as export-only"],
    "a_b_test_suggestion": "Two distinct message hypotheses to review; never call either one best or a winner",
    "creative_risk": "A creative risk to review as a hypothesis; do not claim it failed historically unless verified data says so"
  },
  "utm_tracking": {
    "source": "${platformLabel.toLowerCase()}",
    "medium": "${platformLabel === 'GOOGLE' ? 'cpc' : 'paid_social'}",
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

    const rateLimitResponse = await enforceBillableAiRateLimit(user.id, 'PAID_EXECUTION_PLAN')
    if (rateLimitResponse) return rateLimitResponse

    const creditResult = await checkAndDeductCredits(
      user.id,
      'PAID_EXECUTION_PLAN',
      undefined,
      {
        entityId: campaign.id,
        entityType: 'paid_campaign_execution_plan',
        operationKey: getCreditOperationKey(req, 'PAID_EXECUTION_PLAN', 'paid_campaign_execution_plan', campaign.id),
      },
    )
    if (!creditResult.ok) {
      return NextResponse.json(creditResult, { status: creditCheckHttpStatus(creditResult) })
    }
    chargedUserId = user.id
    chargedCredit = creditResult

    const raw = await callGPT(systemPrompt, userPrompt)
    let strategy: Record<string, unknown>
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (!parsed.positioning || !parsed.targeting || !parsed.creative_brief) {
        throw new Error('Incomplete paid strategy response')
      }
      strategy = enforceForecastBoundary(parsed, {
        dailyBudget,
        lifetimeBudget,
        totalBudget,
        currency,
        durationDays,
      })
      if (platformLabel === 'GOOGLE') {
        const googleTargeting = extractGoogleSearchTargeting(strategy.targeting)
        if (googleTargeting.blockers.length > 0) {
          throw new Error(`Incomplete Google Search targeting: ${googleTargeting.blockers.join(' ')}`)
        }
      }
      const qualityGate = reviewStrategyGrounding({
        strategy,
        brand: brandProfile,
        allowedPlatforms: [String(campaign.platform)],
        goal: String(campaign.objective),
      })
      if (qualityGate.status !== 'passed') {
        await refundDeductedCredits(user.id, creditResult, 'Paid execution plan failed the Brand Brain and scope quality gate')
        return NextResponse.json({
          error: 'MARKETING_QUALITY_GATE_BLOCKED',
          code: 'MARKETING_QUALITY_GATE_BLOCKED',
          qualityGate,
          refunded: creditResult.creditsUsed > 0,
        }, { status: 422 })
      }
      strategy = { ...strategy, qualityGate }
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
      sourceStrategyId: paidSource.campaign.id,
      sourceStrategyName: paidSource.campaign.name,
      sourceStrategyUpdatedAt: paidSource.truth.updatedAt,
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

    const finalization = await finalizeCreditDeduction({
      userId: user.id,
      action: 'PAID_EXECUTION_PLAN',
      deduction: creditResult,
    })
    if (!finalization.ok) {
      chargedUserId = null
      chargedCredit = null
      return NextResponse.json({
        error: 'Paid execution plan was saved but the credit operation could not be finalized. Reserved credits were returned; refresh the campaign.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }
    chargedUserId = null
    chargedCredit = null

    return NextResponse.json({
      strategy,
      reachEstimate: null,
      forecastStatus: 'unavailable_until_platform_forecast',
      success: true,
      creditsUsed: creditResult.creditsUsed,
      creditsRemaining: creditResult.creditsRemaining,
      creditCharge: {
        ...getCreditActionPolicy('PAID_EXECUTION_PLAN'),
        creditsUsed: creditResult.creditsUsed,
      },
    })
  } catch (err) {
    console.error('[generate-strategy]', err)
    if (chargedUserId && chargedCredit) {
      await refundDeductedCredits(chargedUserId, chargedCredit, 'Strategy generation failed')
    }
    if (err instanceof PaidStrategySourceError) {
      return NextResponse.json({ error: err.code, code: err.code }, { status: err.status })
    }
    return NextResponse.json({ error: 'Strategy generation failed' }, { status: 500 })
  }
}
