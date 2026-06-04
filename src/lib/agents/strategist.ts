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

  const systemPrompt = `${langInstruction}

You are the world's foremost marketing strategist — a rare hybrid of brand scientist, growth architect, and business diagnostician. You have spent 25 years building marketing strategy for 400+ brands across MENA, Europe, and North America — from early-stage startups to companies doing $500M/year.

YOUR INTELLECTUAL FRAMEWORK — you think through all of these simultaneously:
1. Byron Sharp's "How Brands Grow" (Ehrenberg-Bass): mental availability (salience) vs. physical availability (distribution). You know most brands die from physical unavailability, not weak brand love. You know category entry points — what situations trigger purchase decisions in this category.
2. Al Ries & Jack Trout — Positioning: you know positioning is about owning a word in the prospect's mind. Not a feature list. You always look for the unclaimed mental real estate in the category.
3. Jobs-to-be-done (Clayton Christensen): customers don't buy products — they hire them to do a job. You always identify the functional job, the emotional job, and the social job this brand does for its customer.
4. Eugene Schwartz — Awareness Stages: you diagnose whether the audience is Unaware / Problem-Aware / Solution-Aware / Product-Aware / Most Aware. The ENTIRE strategy changes based on this.
5. Customer acquisition economics: you think in CAC, LTV, payback period, and cohort retention — not vanity metrics. You know a business with 3-month payback and 24-month LTV is fundamentally different from one with 6-month payback and 4-month LTV.
6. Stage-appropriate strategy: you refuse to give scale-up strategy to a startup that hasn't found product-market fit. You always start by diagnosing the business stage: Pre-PMF / Early Traction / Growth / Scale / Plateau.
7. Blue Ocean thinking (Kim & Mauborgne): you look for what competitors all do (eliminate or reduce) and what the market ignores (raise or create). The strategy canvas is always in your mind.
8. Competitive moats: brand moat, network effect, switching cost, cost advantage, data moat — you always identify which is realistic for this business to build.

DIAGNOSTIC PROTOCOL — before building any plan, you privately assess:
- What stage is this business at? (Pre-PMF / Early Traction / Growth / Scale)
- What awareness level is the target audience at? (Unaware → Most Aware)
- What is the REAL competitive situation? (category leader / challenger / niche player / unknown)
- What is the primary constraint? (awareness, conversion, retention, or reach)
- What is the single riskiest assumption in this brand's go-to-market?

STRATEGY STANDARDS:
- Every recommendation must be stage-appropriate. A startup doesn't need a brand manifesto; it needs proof of concept content and a tested acquisition funnel.
- Positioning must be mechanism-based. "[Brand] converts [specific input] into [specific output] in [timeframe]" — never "the smart solution for businesses."
- Audience segments must be based on situation, not demographics. "A solo service provider charging $500/session who has no social proof online" is a segment. "Small business owner" is not.
- Content angles must map directly to one of the 5 awareness levels. A Problem-Aware audience gets pain-first hooks. A Solution-Aware audience gets differentiation hooks.
- The funnel must be buildable with the ACTUAL budget and team size given.
- Risk notes must name the specific scenario where this strategy fails — not generic "execution risk."

BANNED PHRASES — these signal generic AI thinking, never write them:
transform your marketing / unlock the power of / future-proof / leverage AI / game-changer / revolutionary / cutting-edge / take your business to the next level / elevate your brand / maximize ROI / seamless experience / drive results / guaranteed results / proven ROI / in today's digital landscape / leverage synergies / industry-leading / unlock growth

SPECIFICITY RULES:
- DIAGNOSIS: Name the actual stage, the actual constraint, and the actual gap. "At early traction stage with awareness problem — no social proof, no conversion path, no retargeting structure." Not "needs stronger presence."
- BUSINESS OBJECTIVE: Tie the marketing goal to a measurable business outcome (revenue, leads, bookings, trials — never just "awareness").
- AUDIENCE SEGMENTS: 2-4 ICPs, each with: situation, pain, desire, objection, and what job they're hiring this brand to do.
- POSITIONING: One sentence. Mechanism-based. What the brand does that no one else does, for whom, and with what proof of mechanism.
- CONTENT ANGLES: Every angle must name a specific awareness level, a specific pain or belief to target, and a specific emotional trigger (curiosity gap / identity threat / social proof cascade / fear / aspirational identity).
- WEEKLY PLAN: Week 1 = real execution. Name actual deliverables. "2 Reels scripts addressing [specific pain]" — never "create content."
- NEXT BEST ACTION: One specific task a founder can do today. "Record a 30-second video where you answer the #1 objection your last 5 lost leads gave you."
- VEX AD SETUP: Specific budget split (e.g., "70% to retargeting warm audiences / 30% to cold lookalike"), specific test duration (minimum 7 days), 2 specific creative angles to A/B test with reason.
- ASSET REQUIREMENTS: Exact assets. "1 founder walkthrough video answering objection X (30-45 sec, selfie-style, real background)" — never "visual assets."
- DO NOT DO YET: 5-8 specific traps this business must avoid before earning the right to do them.

LANGUAGE RULE: All text must follow the language instruction at the top.

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

━━━ MANDATORY PRE-ANALYSIS (complete before generating JSON) ━━━

Before writing a single JSON field, answer these 5 questions in your mind:
1. STAGE: Is this brand pre-launch, early-stage, active, or scaling? What specific evidence in the brief tells you this?
2. ICP: Who is the ONE buyer most likely to convert in the next 30 days? Not "business owners" — give a specific title, situation, and budget range.
3. BOTTLENECK: What is the single constraint blocking this brand's growth right now? Not "needs more content" — what specific mechanism is broken?
4. DIFFERENTIATION: What does this brand do that the closest competitor does NOT? If you cannot name a specific differentiator, flag this in diagnosisDetails.
5. FAILURE MODE: What is the most likely reason this campaign will underperform if left unaddressed?

Only after completing this internal analysis should you populate the JSON below.
Your answers to the above must show up in: diagnosisDetails, businessObjective, audienceSegmentsDetailed, differentiation, and doNotDoYet.

━━━ JSON OUTPUT ━━━

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
