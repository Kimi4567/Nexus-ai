/**
 * AGENT 1 — Marketing Strategist (Sprint M — Operational Strategy Upgrade)
 *
 * Responsibilities:
 * - Diagnose the real marketing situation (stage, gaps, risks)
 * - Define a clear business and marketing objective
 * - Build specific, operational audience segments
 * - Map the full funnel with execution-ready stages
 * - Generate structured content angles (not generic advice)
 * - Produce a VEX-ready ad setup plan
 * - Output a 4-week execution calendar
 * - Define asset requirements and a readiness checklist
 *
 * Output is both human-readable AND machine-usable by:
 * Content Pack, Calendar, Creative Brief, VEX, Sentinel, Approval Checklist.
 */

import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { checkAndLog } from '@/lib/outputGuardrails'
import { getPlanContext } from './planContext'
import { normalizeStrategyOutput } from '@/lib/strategyNormalize'
// PR-S1c-3 — deterministic Strategy Order + Deliverables Contract types (display/scope only).
import type { StrategyOrder, StrategyDeliverables } from '@/lib/strategy/strategyOrder'

// ── Preserved interfaces (backwards compat) ──────────────────────────────────

export interface BusinessBrief {
  companyName: string
  businessType: string
  targetAudience: string
  monthlyBudget: number
  currentPlatforms?: string[]
  primaryGoal?: string
  existingProblems?: string
  // Extended Brand Brain fields
  competitors?: string
  region?: string
  uniqueValue?: string
  avoidWords?: string
  pricePoint?: string
  writingStyle?: string
  painPoints?: string
  desires?: string
  primaryOffer?: string
  winningHooks?: string
  // Language preference: 'ar' | 'en' | 'bilingual'
  language?: string
  // Campaign memory: past learnings injected from campaign-memory.ts
  pastLearnings?: string
  // Subscription tier — controls strategy depth, calendar length, content volume
  planTier?: string
  // Media library context: describes existing assets the user has uploaded
  mediaContext?: string
  // PR-I — generation-time strategy intent (chosen in RunFullStrategyModal, not persisted).
  strategyType?: 'organic' | 'paid' | 'full'   // default 'organic'
  strategyDuration?: '30' | '90' | '180' | 'custom'  // default '90' (first 30 days actionable)

  // ── PR-S1c-3 — deterministic generation contract (the order the user reviewed & paid for).
  //    All optional + additive (back-compat). Computed server-side in /api/strategy/run-full
  //    from getStrategyDeliverables(order, planContext); the AI never decides these. When
  //    `generationInstructions` is present, the strategist treats it as a BINDING scope.
  strategyOrder?: StrategyOrder
  strategyDeliverables?: StrategyDeliverables
  /** Single source-of-truth scope string from the deliverables contract. */
  generationInstructions?: string
  /** Fixed organic post count for the detailed window (intensity → request → plan cap). */
  organicPostCount?: number
  /** Days that get a detailed day-by-day calendar (always ≤ 30). */
  detailedCalendarDays?: number
  /** Planning-horizon roadmap length in months (1 / 2 / 3 / 6). */
  roadmapMonths?: number
  /** True when the requested intensity exceeded the plan quota and was capped. */
  planCapApplied?: boolean
}

export interface FunnelStrategy {
  awareness: string
  consideration: string
  conversion: string
  retention: string
}

export interface ChannelStrategy {
  platform: string
  role: string
  contentType: string
  postingApproach: string
  cta: string
  rationale: string
}

export interface WeeklyPlan {
  week: number
  objective: string
  channels: string[]
  contentThemes: string[]
  keyMessage: string
  deliverables: string[]
  cta: string
}

export interface OfferCTAStrategy {
  primaryCTA: string
  secondaryCTA: string
  leadMagnet?: string
  betaOffer?: string
  contactFlow?: string
}

export interface ChannelAllocation {
  platform: string
  budgetPercent: number
  rationale: string
  contentFrequency: string
}

export interface KPI {
  metric: string
  target: string
  timeframe: string
  /** PR-2B1: true when this KPI is a hypothesis (no historical data to back it). */
  isHypothesis?: boolean
}

export interface BudgetItem {
  category: string
  amount: number
  percent: number
}

export interface LaunchPhase {
  week: number
  focus: string
  actions: string[]
}

// ── New Sprint M interfaces ───────────────────────────────────────────────────

/** Practical business diagnosis — machine-readable breakdown */
export interface DiagnosisDetails {
  stage: 'pre-launch' | 'early-stage' | 'active' | 'scaling' | 'recovery'
  bottleneck: string
  trustGap: string
  offerClarity: 'clear' | 'unclear' | 'partial'
  contentGap: string
  assetReadiness: string
  conversionReadiness: string
  readyForPaidAds: boolean
  readyForPaidAdsReason: string
  mainRisk: string
}

/** Clear, structured business objective */
export interface BusinessObjective {
  primary: string
  marketing: string
  conversionAction: string
  expectedUserAction: string
  whyNow: string
  successIn30Days: string
}

/** Operational audience segment — goes far beyond "business owners" */
export interface AudienceSegmentDetailed {
  segment: string
  situation: string
  pain: string
  desiredOutcome: string
  objection: string
  message: string
  platform: string
  format: string
  cta: string
}

/** Full-funnel stage with product area mapping */
export interface FunnelStageDetailed {
  stage: 'awareness' | 'consideration' | 'conversion' | 'followUp'
  userMindset: string
  message: string
  contentType: string
  platform: string
  cta: string
  successMetric: string
  nextStep: string
  productArea: string
}

/** Content angle as structured execution unit */
export interface ContentAngleDetailed {
  title: string
  pain: string
  format: string
  hook: string
  platform: string
  cta: string
  asset: string
  funnelStage: string
}

/** Enriched weekly execution item */
export interface WeeklyExecutionItem {
  week: number
  objective: string
  keyMessage: string
  deliverables: string[]
  platforms: string[]
  assetsNeeded: string[]
  cta: string
  successMetric: string
  executionNote: string
  reviewPoints: string[]
}

/** What assets are needed before and during execution */
export interface AssetRequirements {
  mustHave: string[]
  niceToHave: string[]
  forAds: string[]
  forOrganic: string[]
  forProof: string[]
  canStartWithout: boolean
  canStartWithoutNote: string
  nextToCreate: string[]
}

/** VEX-ready ad setup plan */
export interface AdSetupPlan {
  objective: string
  testBudget: string
  duration: string
  platformPriority: string[]
  targeting: string
  exclusions: string
  creativeFormats: string[]
  adCopyAngles: string[]
  abTestPlan: string
  landingPath: string
  trackingRequired: string
  approvalChecklist: string[]
  notReadyIf: string[]
}

/** Single readiness checklist item */
export interface ReadinessItem {
  label: string
  done: boolean
}

/** Structured success metric with category */
export interface SuccessMetricDetailed {
  category: 'lead' | 'engagement' | 'conversion' | 'operational'
  metric: string
  target: string
  timeframe: string
  /** PR-2B1: true when this metric is a hypothesis (no historical data to back it). */
  isHypothesis?: boolean
}

// ── PR-2B1 — honesty scaffold (all optional, server-authoritative where noted) ──

export type StrategyConfidenceLevel = 'high' | 'medium' | 'low'
export type CapabilityConfidenceLevel = 'high' | 'low' | 'none'

/**
 * Server-authoritative confidence readout. The model MAY propose this, but the
 * orchestrator overwrites it from getStrategyCapabilities() before persisting, so
 * the AI can never inflate confidence.
 */
export interface ConfidenceReport {
  overall: StrategyConfidenceLevel
  byCapability: Record<string, CapabilityConfidenceLevel>
}

/** Optional market/category context — isAssumption is ALWAYS forced true. */
export interface MarketContext {
  summary: string
  isAssumption: true
}

/**
 * Compact readiness signal passed INTO the strategist so it knows what it may and
 * may not assert. Built server-side from getStrategyCapabilities() + Brand Brain.
 */
export interface StrategyReadinessContext {
  capabilities: { id: string; ready: boolean; confidence: CapabilityConfidenceLevel; missingKeys: string[] }[]
  missingKeys: string[]
  hasBudget: boolean
  budgetText?: string | null
  hasConversionDestination: boolean
  hasCompetitors: boolean
  hasHistoricalData: boolean
  hasPixel: boolean
}

// ── Main strategy output interface ───────────────────────────────────────────

export interface StrategyOutput {
  // Core fields (preserved for backwards compat)
  campaignName: string
  goal: string
  positioning: string
  keyMessage?: string
  targetAudienceRefined: string
  channelMix: ChannelAllocation[]
  kpis: KPI[]
  budgetBreakdown: BudgetItem[]
  contentPillars: string[]
  launchPlan: LaunchPhase[]
  estimatedResults: string
  confidence: number

  // Enriched Sprint D fields
  valueProps?: string[]
  visualDirection?: string
  executionChecklist?: string[]
  topHooks?: string[]
  ctaVariations?: string[]
  diagnosis?: string
  differentiation?: string
  funnelStrategy?: FunnelStrategy
  channelStrategy?: ChannelStrategy[]
  audienceSegments?: string[]
  contentAngles?: string[]
  weeklyPlan?: WeeklyPlan[]
  offerCTAStrategy?: OfferCTAStrategy
  successMetrics?: string[]
  riskNotes?: string[]
  nextBestAction?: string

  // Sprint M — new structured operational fields
  businessStage?: string
  mainBottleneck?: string
  mainRisk?: string
  readyForPaidAds?: boolean
  readyForPaidAdsReason?: string
  diagnosisDetails?: DiagnosisDetails
  businessObjective?: BusinessObjective
  audienceSegmentsDetailed?: AudienceSegmentDetailed[]
  funnelStages?: FunnelStageDetailed[]
  contentAnglesDetailed?: ContentAngleDetailed[]
  weeklyExecutionPlan?: WeeklyExecutionItem[]
  assetRequirements?: AssetRequirements
  adSetupPlan?: AdSetupPlan
  readinessChecklist?: ReadinessItem[]
  doNotDoYet?: string[]
  successMetricsDetailed?: SuccessMetricDetailed[]
  executionAssumptions?: string[]

  // PR-2B1 — honesty scaffold (all optional; *server-authoritative fields are
  // overwritten by the orchestrator from getStrategyCapabilities()).
  assumptions?: string[]
  missingData?: string[]                 // SERVER-AUTHORITATIVE — stable readiness keys
  confidenceReport?: ConfidenceReport    // SERVER-AUTHORITATIVE
  competitorAnalysisComplete?: boolean   // SERVER-AUTHORITATIVE
  marketContext?: MarketContext          // isAssumption forced true if present
}

// ── OpenAI call helper ────────────────────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',  // Core strategy output — gpt-4o for maximum quality
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.30,  // PR-2B1: lowered 0.45→0.30 for grounding (less embellishment / number-invention)
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

// ── Prompt builder (pure) ─────────────────────────────────────────────────────

/**
 * PR-S1c-3 — pure prompt builder, extracted so the BINDING generation-scope
 * contract is unit-testable without calling OpenAI. When `brief.generationInstructions`
 * is present (set server-side in /api/strategy/run-full from getStrategyDeliverables),
 * it is injected as a binding scope block that overrides any softer guidance. When
 * absent, the prompts are byte-for-byte the previous behavior (back-compat).
 */
export function buildStrategistPrompts(
  brief: BusinessBrief,
  brandContext?: string,
  language?: string,
  readiness?: StrategyReadinessContext,
): { systemPrompt: string; userPrompt: string } {
  const langInstruction = getLanguageInstruction(language ?? brief.language)
  const planContext = getPlanContext(brief.planTier)
  const allowedPlatformLine = brief.currentPlatforms?.length
    ? `Allowed content platforms from Brand Brain: ${brief.currentPlatforms.join(', ')}. Use ONLY these platforms in channelMix, contentAnglesDetailed.platform, audienceSegmentsDetailed.platform, funnelStages.platform, and weeklyExecutionPlan.platforms. Do not add Pinterest, LinkedIn, blog, website, or any other platform unless it appears in this allowed list. If another platform is strategically interesting, mention it only as a future consideration, not an execution channel.`
    : ''

  // ── PR-S1c-3 — binding scope from the deterministic deliverables contract. The
  //    counts/scope come from getStrategyDeliverables — never from the model. This
  //    block is authoritative; the softer Strategy Type/Duration lines below defer to it.
  const d = brief.strategyDeliverables
  const bindingScope = brief.generationInstructions
    ? [
        '',
        '',
        'BINDING GENERATION SCOPE (highest priority — overrides any conflicting guidance below):',
        'The following scope is binding. Do not exceed it. If something is outside scope, label it as "not included".',
        brief.generationInstructions,
        (brief.roadmapMonths ?? 1) > 1
          ? `This is a ${brief.roadmapMonths}-month roadmap. Generate a first-${brief.detailedCalendarDays ?? 30}-day execution outline through weeklyExecutionPlan and contentAnglesDetailed. Represent months 2+ ONLY as themes / backlog / future monthly cycles inside narrative fields (e.g. contentPillars, executionAssumptions, roadmap language) — never as per-day posts for the full horizon.`
          : '',
        'Do NOT imply that all days across the planning horizon are scheduled or published.',
        'This strategy run does NOT create a saved Content Hub content calendar, final SocialPost drafts, final captions, or scheduled calendar entries. Treat weeklyExecutionPlan and contentAnglesDetailed as strategy outline / planning direction only.',
        'Platform variants are ADAPTATIONS of the same content per channel — not separate additional posts.',
        allowedPlatformLine,
        'Never claim ads will launch, budget will be spent, campaigns will be activated, or that posts are scheduled/published — nothing is published or activated without explicit user approval.',
        d?.excludedDeliverables?.length
          ? `Explicitly NOT included (label as "not included" if referenced): ${d.excludedDeliverables.join('; ')}.`
          : '',
      ].filter(Boolean).join('\n')
    : ''

  const systemPrompt = `${langInstruction}
${planContext}${bindingScope}

You are an expert marketing strategist. Build a complete, specific, actionable marketing strategy for the brand below.

RULES:
- Be specific to THIS brand — no generic advice
- Positioning: "[Brand] is the [category] for [audience] who need [outcome] without [frustration]"
- Hooks must be scroll-stopping, not clichéd
- Weekly plan = real deliverables ("3 Reels scripts about X", not "create content")
- Never use: transform / unlock / game-changer / cutting-edge / leverage / maximize ROI
- All text must follow the language instruction above

ANTI-HALLUCINATION RULES (strict — these override any urge to sound complete):
1. Never invent competitor names or facts. Use ONLY competitors explicitly provided. If none are provided, set "competitorAnalysisComplete": false and do not name any competitor.
2. Never invent performance numbers — no CPL, CPA, ROAS, CTR, conversion rates, click counts, or impressions. Numbers may ONLY echo values the user provided (e.g. their budget band or price point).
3. Never promise results. Use conditional, effort-framed language ("aims to", "target to validate") — never "you will get X".
4. Never state market or category claims as fact. If you include "marketContext", it is an ASSUMPTION (the field isAssumption is always true) and must be hedged.
5. No budget provided → do NOT produce a budget allocation as fact. Leave budgetBreakdown empty.
6. No conversion destination provided → add an explicit funnel/paid risk to "riskNotes" (the conversion step is unverified).
7. No competitors provided → competitor analysis is incomplete; say so plainly.
8. No historical performance data → every KPI and success metric is a hypothesis ("isHypothesis": true).
9. No pixel/analytics connected → retargeting is future setup only; do not describe active retargeting.
10. Where a required input is missing, write the literal phrase "Not enough data" in that field and add the missing item to "missingData".
11. Paid output stays read-only and advisory — never describe how to execute/launch ads.
12. Proof policy: never invent testimonials, customer stories, awards, reviews, satisfaction claims, case studies, guarantees, or performance proof. Use only proof explicitly provided in Brand Context.
13. If proof is missing, recommend collecting proof or asking customers for feedback. Do not phrase proof gaps as if they already exist.
14. Do not create a customer-proof content pillar, customer-story hook, or testimonial CTA unless verified proof was provided.
15. Do not describe this campaign as activated, running, published, scheduled, or live. If the business is already operating, say "business already operating"; the campaign itself remains in planning/review until the user takes later actions.
16. Do not invent ad budget, campaign budget, spend allocation, CAC, ROAS, or paid media budget. If budget is missing, write "Budget not provided" and list budget as missing data.
17. Respect the selected Strategy Type exactly. Organic-only must not include paid launch plans. Paid planning must not imply spend, launch, active ads, platform permissions, or connected-account readiness unless those facts were explicitly provided.
18. If paid inputs are missing, label the paid scope as missing inputs or planning gaps. Do not invent budget, tracking/pixel status, platform readiness, paid launch approval, past results, ROI, benchmarks, competitors, or proof.
19. Paid outputs are planning-only unless budget approval, tracking readiness, platform readiness, and explicit launch approval are all present in the provided context. If they are not present, state that launch and spend are not included.
20. Platform scope is binding. Use only the active/allowed platforms provided in the brief for execution fields. Never add Pinterest, blog, website, LinkedIn, or any other channel unless it was explicitly provided as active/allowed.
21. Strategy output is a review artifact. Do not claim Content Hub posts, saved calendars, SocialPost rows, final captions, scheduling, or publishing were generated by this strategy run.

Return ONLY valid JSON. No markdown outside the JSON.`

  const budgetLine = readiness?.budgetText?.trim()
    ? `User-provided budget context: ${readiness.budgetText.trim()}`
    : 'Monthly Budget: Not provided'

  const extendedBrief = [
    `Company: ${brief.companyName}`,
    `Industry: ${brief.businessType}`,
    `Target Audience: ${brief.targetAudience}`,
    budgetLine,
    `Primary Goal: ${brief.primaryGoal || 'generate qualified leads'}`,
    `Strategy Type: ${brief.strategyType || 'organic'} — ${
      brief.strategyType === 'paid'
        ? 'focus on the paid campaign plan; keep organic light'
        : brief.strategyType === 'full'
          ? 'cover both organic content and paid campaign planning'
          : 'focus on the ORGANIC content plan; do NOT over-build paid details'
    }`,
    `Strategy Duration: ${brief.strategyDuration && brief.strategyDuration !== 'custom' ? brief.strategyDuration + ' days' : (brief.strategyDuration === 'custom' ? 'custom horizon' : '90 days')} — plan to this horizon and make the FIRST 30 days concretely actionable as a strategy outline, not saved Content Hub posts`,
    allowedPlatformLine,
    brief.planTier ? `User Plan Tier: ${brief.planTier} — scale the strategy scope to match this plan's quota (see Plan Context above)` : '',
    brief.region ? `Region/Market: ${brief.region}` : '',
    brief.primaryOffer ? `Core Offer: ${brief.primaryOffer}` : '',
    brief.pricePoint ? `Price Positioning: ${brief.pricePoint}` : '',
    brief.uniqueValue ? `Unique Advantages: ${brief.uniqueValue}` : '',
    brief.painPoints ? `Audience Pain Points: ${brief.painPoints}` : '',
    brief.desires ? `Audience Desires: ${brief.desires}` : '',
    brief.competitors ? `Key Competitors: ${brief.competitors}` : '',
    brief.winningHooks ? `Reviewed Hook Signals: ${brief.winningHooks}` : '',
    brief.writingStyle ? `Brand Writing Style: ${brief.writingStyle}` : '',
    brief.avoidWords ? `Never use these words/phrases: ${brief.avoidWords}` : '',
    brief.currentPlatforms?.length ? `Active Platforms: ${brief.currentPlatforms.join(', ')}` : '',
    brief.existingProblems ? `Current Challenges: ${brief.existingProblems}` : '',
    brandContext ? `\nFull Brand Context:\n${brandContext}` : '',
    brief.pastLearnings ? `\n${brief.pastLearnings}` : '',
    brief.mediaContext ? `\nMEDIA LIBRARY CONTEXT:\n${brief.mediaContext}` : '',
  ].filter(Boolean).join('\n')

  // PR-2B1 — readiness context so the model knows what it may/may not assert.
  const readinessBlock = readiness
    ? [
        '\nDATA READINESS (you must respect this — do not assert beyond it):',
        `- Budget provided: ${readiness.hasBudget ? 'yes' : 'no'}`,
        readiness.budgetText?.trim()
          ? `- User-provided budget context: ${readiness.budgetText.trim()}`
          : '- User-provided budget context: Not provided',
        `- Conversion destination provided: ${readiness.hasConversionDestination ? 'yes' : 'no'}`,
        `- Competitors provided: ${readiness.hasCompetitors ? 'yes' : 'no'}`,
        `- Historical performance data: ${readiness.hasHistoricalData ? 'yes' : 'no'}`,
        `- Pixel/analytics connected: ${readiness.hasPixel ? 'yes' : 'no'}`,
        readiness.missingKeys.length ? `- Missing inputs (echo these into "missingData" and write "Not enough data" where they block a section): ${readiness.missingKeys.join(', ')}` : '- No critical inputs missing.',
        'Capability readiness: ' + readiness.capabilities.map(c => `${c.id}=${c.confidence}`).join(', '),
      ].join('\n')
    : ''

  const userPrompt = `
${extendedBrief}
${readinessBlock}

Return JSON with these exact fields — all specific to this brand:

{
  "campaignName": "string",
  "goal": "SALES|LEADS|AWARENESS|ENGAGEMENT|TRAFFIC|BRAND_BUILDING",
  "positioning": "string — '[Brand] is the [category] for [audience] who need [outcome] without [frustration]'",
  "keyMessage": "string — ONE sentence the audience must believe",
  "differentiation": "string — what this brand does that no one else does",
  "targetAudienceRefined": "string — specific audience with situation and behaviors",
  "businessStage": "pre-launch|early-stage|active|scaling",
  "diagnosis": "string — real marketing situation, stage, main problem (2-3 sentences, specific)",

  "audienceSegments": ["string — 2-3 segment labels"],
  "audienceSegmentsDetailed": [
    {
      "segment": "string — specific role/situation",
      "pain": "string",
      "desiredOutcome": "string",
      "objection": "string",
      "message": "string",
      "platform": "string",
      "cta": "string"
    }
  ],

  "contentPillars": ["string — 4-5 specific pillars"],
  "contentAngles": ["string — 8-10 specific angles"],
  "contentAnglesDetailed": [
    {
      "title": "string",
      "hook": "string — scroll-stopping opening line",
      "pain": "string",
      "format": "string",
      "platform": "string",
      "cta": "string",
      "funnelStage": "awareness|consideration|conversion"
    }
  ],

  "channelMix": [
    { "platform": "string", "budgetPercent": number, "rationale": "string", "contentFrequency": "string" }
  ],

  "topHooks": ["string — 5+ hooks specific to this brand"],
  "ctaVariations": ["string — 5 specific CTAs"],

  "weeklyExecutionPlan": [
    {
      "week": 1,
      "objective": "string",
      "keyMessage": "string",
      "deliverables": ["string — concrete: '2 Reels about X'"],
      "platforms": ["string"],
      "cta": "string",
      "successMetric": "string"
    },
    { "week": 2, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "cta": "string", "successMetric": "string" },
    { "week": 3, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "cta": "string", "successMetric": "string" },
    { "week": 4, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "cta": "string", "successMetric": "string" }
  ],

  "valueProps": ["string — 3-5 value propositions"],
  "doNotDoYet": ["string — 3-5 specific traps to avoid"],
  "nextBestAction": "string — ONE specific task to do today",
  "estimatedResults": "string — realistic, stage-appropriate, NO invented numbers",
  "readyForPaidAds": boolean,
  "readyForPaidAdsReason": "string",

  "businessObjective": {
    "primary": "string — the business goal in plain terms",
    "marketing": "string", "conversionAction": "string",
    "expectedUserAction": "string", "whyNow": "string", "successIn30Days": "string"
  },
  "diagnosisDetails": {
    "stage": "pre-launch|early-stage|active|scaling|recovery",
    "bottleneck": "string", "trustGap": "string", "offerClarity": "clear|unclear|partial",
    "contentGap": "string", "assetReadiness": "string", "conversionReadiness": "string",
    "readyForPaidAds": boolean, "readyForPaidAdsReason": "string", "mainRisk": "string"
  },
  "funnelStages": [
    { "stage": "awareness|consideration|conversion|followUp", "userMindset": "string", "message": "string", "contentType": "string", "platform": "string", "cta": "string", "successMetric": "string", "nextStep": "string", "productArea": "string" }
  ],
  "kpis": [
    { "metric": "string", "target": "string — NO invented performance numbers; a goal to validate", "timeframe": "string", "isHypothesis": true }
  ],
  "successMetricsDetailed": [
    { "category": "lead|engagement|conversion|operational", "metric": "string", "target": "string — NO invented numbers", "timeframe": "string", "isHypothesis": true }
  ],
  "readinessChecklist": [ { "label": "string — a concrete pre-launch readiness item", "done": false } ],
  "riskNotes": ["string — real risks; flag funnel/paid risk if conversion destination or budget is missing"],
  "executionAssumptions": ["string — assumptions this plan rests on"],
  "assumptions": ["string — explicit assumptions you made due to missing data"],
  "missingData": ["string — inputs that were missing; write the readiness keys you were given"],
  "competitorAnalysisComplete": false,
  "confidenceReport": { "overall": "high|medium|low", "byCapability": { "contentStrategy": "high|low|none" } }
}`

  return { systemPrompt, userPrompt }
}

// ── Main agent function ───────────────────────────────────────────────────────

export async function runStrategistAgent(
  brief: BusinessBrief,
  brandContext?: string,
  language?: string,
  readiness?: StrategyReadinessContext
): Promise<StrategyOutput> {
  const { systemPrompt, userPrompt } = buildStrategistPrompts(brief, brandContext, language, readiness)

  const output = normalizeStrategyOutput(await callOpenAI(systemPrompt, userPrompt, 7500)) as StrategyOutput

  // ── Quality guardrail: log if output is too generic ───────────────────────
  const rawText = JSON.stringify(output)
  checkAndLog('strategist', rawText, {
    brandName: brief.companyName,
    industry: brief.businessType,
    targetAudience: brief.targetAudience,
    primaryOffer: brief.primaryOffer,
  })

  return output
}
