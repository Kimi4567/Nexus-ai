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
      model: 'gpt-4o-mini',  // Reliable rate limits — PhD-level prompt provides quality
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.45,  // Lower = more analytical, consistent, grounded
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

// ── Main agent function ───────────────────────────────────────────────────────

export async function runStrategistAgent(
  brief: BusinessBrief,
  brandContext?: string,
  language?: string
): Promise<StrategyOutput> {
  const langInstruction = getLanguageInstruction(language ?? brief.language)
  const planContext = getPlanContext(brief.planTier)

  const systemPrompt = `${langInstruction}
${planContext}

You are an expert marketing strategist. Build a complete, specific, actionable marketing strategy for the brand below.

RULES:
- Be specific to THIS brand — no generic advice
- Positioning: "[Brand] is the [category] for [audience] who need [outcome] without [frustration]"
- Hooks must be scroll-stopping, not clichéd
- Weekly plan = real deliverables ("3 Reels scripts about X", not "create content")
- Never use: transform / unlock / game-changer / cutting-edge / leverage / maximize ROI
- All text must follow the language instruction above

Return ONLY valid JSON. No markdown outside the JSON.`

  const extendedBrief = [
    `Company: ${brief.companyName}`,
    `Industry: ${brief.businessType}`,
    `Target Audience: ${brief.targetAudience}`,
    `Monthly Budget: $${brief.monthlyBudget} USD`,
    `Primary Goal: ${brief.primaryGoal || 'generate qualified leads'}`,
    brief.planTier ? `User Plan Tier: ${brief.planTier} — scale the strategy scope to match this plan's quota (see Plan Context above)` : '',
    brief.region ? `Region/Market: ${brief.region}` : '',
    brief.primaryOffer ? `Core Offer: ${brief.primaryOffer}` : '',
    brief.pricePoint ? `Price Positioning: ${brief.pricePoint}` : '',
    brief.uniqueValue ? `Unique Advantages: ${brief.uniqueValue}` : '',
    brief.painPoints ? `Audience Pain Points: ${brief.painPoints}` : '',
    brief.desires ? `Audience Desires: ${brief.desires}` : '',
    brief.competitors ? `Key Competitors: ${brief.competitors}` : '',
    brief.winningHooks ? `Previously Successful Hooks: ${brief.winningHooks}` : '',
    brief.writingStyle ? `Brand Writing Style: ${brief.writingStyle}` : '',
    brief.avoidWords ? `Never use these words/phrases: ${brief.avoidWords}` : '',
    brief.currentPlatforms?.length ? `Active Platforms: ${brief.currentPlatforms.join(', ')}` : '',
    brief.existingProblems ? `Current Challenges: ${brief.existingProblems}` : '',
    brandContext ? `\nFull Brand Context:\n${brandContext}` : '',
    brief.pastLearnings ? `\n${brief.pastLearnings}` : '',
    brief.mediaContext ? `\nMEDIA LIBRARY CONTEXT:\n${brief.mediaContext}` : '',
  ].filter(Boolean).join('\n')

  const userPrompt = `
${extendedBrief}

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
  "estimatedResults": "string — realistic, stage-appropriate",
  "readyForPaidAds": boolean,
  "readyForPaidAdsReason": "string"
}`

  const output = await callOpenAI(systemPrompt, userPrompt, 6500) as StrategyOutput

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
