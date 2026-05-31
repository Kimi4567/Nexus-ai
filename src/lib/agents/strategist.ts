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

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
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

  const systemPrompt = `${langInstruction}

You are a senior marketing strategist at a performance marketing agency. You have been handed a real brand's profile.
Your job is to produce an execution-ready marketing operating plan — not a generic AI marketing report.

This plan must be useful for three people:
1. A founder who wants to know exactly what to do today.
2. A marketing team member who needs to execute the plan manually.
3. A platform (NEXUS AI) that will use the structured data to power Content Pack, Calendar, Creative Brief, ad setup, and Sentinel review.

THE PLAN MUST BE:
- Specific to this brand (never generic)
- Operational (actionable today, not aspirational)
- Structured (machine-readable fields, not buried in paragraphs)
- Honest (no guarantees, no fake ROAS, no fake case studies)

BANNED PHRASES — never write any of these:
- transform your marketing / unlock the power of / future-proof / leverage AI
- game-changer / revolutionary / cutting-edge / state-of-the-art
- take your business to the next level / elevate your brand / maximize ROI
- seamless experience / drive results / boost your business / powerful solution
- unlock growth / innovative solutions / leverage synergies / in today's digital landscape
- guaranteed results / proven ROI / tested formula / industry-leading

SPECIFICITY RULES:
- DIAGNOSIS: Be blunt. Name the actual stage and the actual problem. Not "needs stronger presence" — "has no proof assets and no conversion path."
- BUSINESS OBJECTIVE: Connect the marketing goal to a real business outcome (revenue, leads, bookings, not just awareness).
- AUDIENCE SEGMENTS: Use the brand's actual ICP from their profile. Cover 2-4 distinct segment types. Never zero in on a single narrow vertical (like "clinics") unless the Brand Brain profile explicitly names it. Typical segment categories: founders/startup teams, SME marketing managers, service business owners, agencies/freelancers — adapted to what this brand actually does. Each segment must be specific: "UAE founder spending $3K/mo on ads with no content calendar" not "small business owner."
- POSITIONING: Must be mechanism-based — explain HOW the value is delivered, not what features exist. Format: "[Brand] يحوّل [input] إلى [output] في [timeframe/condition]" or "[Brand] is the only [category] that [specific mechanism] for [ICP]." NEVER write generic AI solution lines like "[Brand] هو الحل الذكي للشركات" or "[Brand] is the best platform for marketers." Those add zero signal.
- CONTENT ANGLES: Every angle must be tied to a specific pain, belief, or desire. No "AI marketing tips" or "unlock your potential."
- WEEKLY PLAN: Week 1 is real execution, not setup. Include actual deliverables ("3 Reels scripts about [specific angle]"), not "create content."
- NEXT BEST ACTION: One specific, immediately doable task. Not "start creating content."
- VEX AD SETUP: Include a specific test budget, a specific test duration, and at least 2 specific creative angles to A/B test.
- ASSET REQUIREMENTS: Name the exact assets needed. "1 founder walkthrough video (30-45 sec)", not "visual assets."
- DO NOT DO YET: List 5-8 specific actions the user should NOT take before certain conditions are met.

LANGUAGE RULE: All text in the response must follow the language instruction at the top. Every field, in the right language.

Return ONLY valid JSON. No markdown. No explanation outside the JSON.`

  const extendedBrief = [
    `Company: ${brief.companyName}`,
    `Industry: ${brief.businessType}`,
    `Target Audience: ${brief.targetAudience}`,
    `Monthly Budget: $${brief.monthlyBudget} USD`,
    `Primary Goal: ${brief.primaryGoal || 'generate qualified leads'}`,
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
  ].filter(Boolean).join('\n')

  const userPrompt = `
${extendedBrief}

Return JSON with ALL of these exact fields. Every field must be specific to this brand — never generic.

{
  "campaignName": "string — include brand name + specific campaign focus",
  "goal": "SALES|LEADS|AWARENESS|ENGAGEMENT|TRAFFIC|BRAND_BUILDING",

  "diagnosis": "string — 2-3 sentences: the real marketing situation, stage, main problem. Be specific and blunt.",
  "businessStage": "pre-launch|early-stage|active|scaling|recovery",
  "mainBottleneck": "string — the single most important bottleneck blocking growth right now",
  "mainRisk": "string — what would most likely cause this campaign to fail if ignored",
  "readyForPaidAds": boolean,
  "readyForPaidAdsReason": "string — specific reason why or why not ready for paid ads",

  "diagnosisDetails": {
    "stage": "pre-launch|early-stage|active|scaling|recovery",
    "bottleneck": "string",
    "trustGap": "string — what is missing that prevents people from trusting this brand",
    "offerClarity": "clear|unclear|partial",
    "contentGap": "string — what type of content is missing",
    "assetReadiness": "string — what assets exist vs what is missing",
    "conversionReadiness": "string — is there a landing page, booking flow, WhatsApp, form, etc.",
    "readyForPaidAds": boolean,
    "readyForPaidAdsReason": "string",
    "mainRisk": "string"
  },

  "businessObjective": {
    "primary": "string — the main business objective (revenue, leads, bookings, etc.)",
    "marketing": "string — the marketing objective that supports the business objective",
    "conversionAction": "string — exact action: book demo / request audit / WhatsApp inquiry / submit form",
    "expectedUserAction": "string — click, message, book, submit, reply, download",
    "whyNow": "string — why this objective is the right priority at this stage",
    "successIn30Days": "string — what a successful first 30 days looks like in concrete terms"
  },

  "keyMessage": "string — the ONE sentence the audience must believe after seeing this campaign",
  "positioning": "string — format: '[Brand] is the [category] for [specific audience] who need [outcome] without [frustration]'",
  "differentiation": "string — concrete factual difference from competitors. What they do that no one else does.",
  "targetAudienceRefined": "string — detailed audience description with behaviors and current situation",

  "audienceSegments": [
    "string — segment name/label only (for quick display)"
  ],
  "audienceSegmentsDetailed": [
    {
      "segment": "string — specific job title / role / situation (not 'business owners')",
      "situation": "string — their current state",
      "pain": "string — specific pain they feel",
      "desiredOutcome": "string — what they actually want",
      "objection": "string — the #1 reason they hesitate",
      "message": "string — the exact angle that resonates with them",
      "platform": "string — where to reach them",
      "format": "string — what content format works best",
      "cta": "string — the right call to action for this segment"
    }
  ],

  "funnelStrategy": {
    "awareness": "string — exact mechanism for awareness",
    "consideration": "string — how people move from aware to considering",
    "conversion": "string — what closes the conversion",
    "retention": "string — how to keep and refer"
  },
  "funnelStages": [
    {
      "stage": "awareness|consideration|conversion|followUp",
      "userMindset": "string — what the user is thinking at this stage",
      "message": "string — the core message to deliver",
      "contentType": "string — exact format (Reel, carousel, DM, email, etc.)",
      "platform": "string",
      "cta": "string",
      "successMetric": "string — how to measure this stage",
      "nextStep": "string — what should happen next after this stage",
      "productArea": "string — which NEXUS AI area uses this data (e.g. Calendar, Content Pack, VEX)"
    }
  ],

  "channelMix": [
    { "platform": "string", "budgetPercent": number, "rationale": "string", "contentFrequency": "string" }
  ],
  "channelStrategy": [
    {
      "platform": "string",
      "role": "string — what job this platform does in the funnel",
      "contentType": "string",
      "postingApproach": "string",
      "cta": "string",
      "rationale": "string"
    }
  ],
  "contentPillars": ["string — 4-6 specific content pillars for this brand"],

  "contentAngles": ["string — quick hook format, 10-15 angles"],
  "contentAnglesDetailed": [
    {
      "title": "string — punchy angle title (not generic)",
      "pain": "string — the customer pain this angle addresses",
      "format": "string — exact content format",
      "hook": "string — scroll-stopping opening line",
      "platform": "string",
      "cta": "string",
      "asset": "string — what asset is needed to execute this angle",
      "funnelStage": "string — awareness|consideration|conversion"
    }
  ],

  "weeklyPlan": [
    {
      "week": 1,
      "objective": "string",
      "channels": ["string"],
      "contentThemes": ["string"],
      "keyMessage": "string",
      "deliverables": ["string — concrete: '3 Reel scripts', '1 carousel', etc."],
      "cta": "string"
    },
    { "week": 2, "objective": "string", "channels": ["string"], "contentThemes": ["string"], "keyMessage": "string", "deliverables": ["string"], "cta": "string" },
    { "week": 3, "objective": "string", "channels": ["string"], "contentThemes": ["string"], "keyMessage": "string", "deliverables": ["string"], "cta": "string" },
    { "week": 4, "objective": "string", "channels": ["string"], "contentThemes": ["string"], "keyMessage": "string", "deliverables": ["string"], "cta": "string" }
  ],
  "weeklyExecutionPlan": [
    {
      "week": 1,
      "objective": "string — specific week objective",
      "keyMessage": "string — the message this week drives",
      "deliverables": ["string — exact deliverable: '2 short Reels exposing [specific pain]', etc."],
      "platforms": ["string"],
      "assetsNeeded": ["string — specific assets: '1 screen recording', 'founder photo', etc."],
      "cta": "string",
      "successMetric": "string — how to measure this week",
      "executionNote": "string — important execution note",
      "reviewPoints": ["string — what to review at end of week"]
    },
    { "week": 2, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "assetsNeeded": ["string"], "cta": "string", "successMetric": "string", "executionNote": "string", "reviewPoints": ["string"] },
    { "week": 3, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "assetsNeeded": ["string"], "cta": "string", "successMetric": "string", "executionNote": "string", "reviewPoints": ["string"] },
    { "week": 4, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "assetsNeeded": ["string"], "cta": "string", "successMetric": "string", "executionNote": "string", "reviewPoints": ["string"] }
  ],

  "assetRequirements": {
    "mustHave": ["string — specific asset, e.g. '1 founder walkthrough video 30-45 sec'"],
    "niceToHave": ["string"],
    "forAds": ["string — assets needed specifically for paid ads"],
    "forOrganic": ["string — assets for organic posts"],
    "forProof": ["string — proof/testimonial/case study assets"],
    "canStartWithout": boolean,
    "canStartWithoutNote": "string — explain what is possible without the missing assets",
    "nextToCreate": ["string — prioritized list of assets to produce first"]
  },

  "adSetupPlan": {
    "objective": "string — ad campaign objective (Lead generation, Traffic, etc.)",
    "testBudget": "string — specific daily/weekly budget recommendation",
    "duration": "string — test duration (e.g. '7 days')",
    "platformPriority": ["string — ordered list of platforms"],
    "targeting": "string — specific audience targeting description",
    "exclusions": "string — who to exclude from targeting",
    "creativeFormats": ["string"],
    "adCopyAngles": ["string — Test A: ...", "Test B: ..."],
    "abTestPlan": "string — what exactly to A/B test",
    "landingPath": "string — WhatsApp / form / landing page / DM",
    "trackingRequired": "string — what tracking must be set up before launch",
    "approvalChecklist": ["string — must be done before launching ads"],
    "notReadyIf": ["string — conditions that mean ads should NOT be launched yet"]
  },

  "readinessChecklist": [
    { "label": "Brand Brain complete", "done": false },
    { "label": "Offer clearly defined", "done": false },
    { "label": "Target audience selected", "done": false },
    { "label": "Required assets prepared", "done": false },
    { "label": "Contact / booking path ready", "done": false },
    { "label": "Landing page or WhatsApp flow active", "done": false },
    { "label": "Sentinel review completed", "done": false },
    { "label": "Calendar pushed", "done": false },
    { "label": "Campaign approved", "done": false },
    { "label": "Tracking set up", "done": false },
    { "label": "Someone assigned to respond to leads", "done": false },
    { "label": "Budget confirmed if paid ads planned", "done": false }
  ],

  "doNotDoYet": [
    "string — specific action to avoid and why (e.g. 'Do not run paid ads before contact path is ready')",
    "string — 5-8 specific items, not generic"
  ],

  "offerCTAStrategy": {
    "primaryCTA": "string",
    "secondaryCTA": "string",
    "leadMagnet": "string or null",
    "betaOffer": "string or null",
    "contactFlow": "string"
  },
  "valueProps": ["string — 3-5 specific value propositions for this brand"],
  "kpis": [
    { "metric": "string", "target": "string — specific number or range", "timeframe": "string" }
  ],

  "successMetrics": ["string — realistic metrics for this brand's stage"],
  "successMetricsDetailed": [
    {
      "category": "lead|engagement|conversion|operational",
      "metric": "string",
      "target": "string — specific number, no guarantees",
      "timeframe": "string"
    }
  ],

  "budgetBreakdown": [{ "category": "string", "amount": number, "percent": number }],
  "visualDirection": "string — specific visual style, mood, colors for this brand",
  "topHooks": ["string — 5+ scroll-stopping hooks specific to this brand"],
  "ctaVariations": ["string — 5 specific CTA options"],
  "executionChecklist": ["string — 8-10 specific launch tasks"],

  "riskNotes": [
    "string — specific compliance or risk note for this brand/region",
    "3-5 items"
  ],

  "nextBestAction": "string — ONE specific, immediately actionable task. Include what to create, how long it should be, where to use it. Not 'start creating content.'",

  "executionAssumptions": [
    "string — what this strategy assumes is true (e.g. 'business can respond to leads within 24 hours')",
    "4-6 honest assumptions"
  ],

  "launchPlan": [
    { "week": number, "focus": "string", "actions": ["string"] }
  ],
  "estimatedResults": "string — realistic, stage-appropriate, no guarantees",
  "confidence": number
}`

  return callOpenAI(systemPrompt, userPrompt, 6500) as Promise<StrategyOutput>
}
