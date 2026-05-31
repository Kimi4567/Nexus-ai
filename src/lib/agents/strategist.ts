/**
 * AGENT 1 — Marketing Strategist
 *
 * Responsibilities:
 * - Analyze brand profile + business brief
 * - Diagnose current marketing situation
 * - Define sharp positioning and differentiation
 * - Build full funnel strategy
 * - Output a deep, brand-specific, execution-ready campaign strategy
 */

import { getLanguageInstruction } from '@/lib/ai/langHelper'

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

export interface StrategyOutput {
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
  // Enriched fields from Sprint D
  valueProps?: string[]
  visualDirection?: string
  executionChecklist?: string[]
  topHooks?: string[]
  ctaVariations?: string[]
  // Sprint D2 — deep strategy fields
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

export async function runStrategistAgent(
  brief: BusinessBrief,
  brandContext?: string,
  language?: string
): Promise<StrategyOutput> {
  const langInstruction = getLanguageInstruction(language ?? brief.language)
  const systemPrompt = `${langInstruction}

You are a senior marketing strategist at a top-tier performance marketing agency.
You have been handed a Brand Brain profile and a business brief.
Your job: produce a deep, specific, execution-ready campaign strategy that feels like it was written by a real strategist who actually read this brand's materials.

═══════════════════════════════════════════════
BANNED PHRASES — never write any of these:
- "Transform your marketing"
- "Unlock the power of"
- "Future-proof your marketing"
- "Real results, real impact"
- "Game-changer" / "Game changing"
- "Revolutionary" / "Revolutionize"
- "Take your business to the next level"
- "Elevate your brand"
- "Cutting-edge" / "State-of-the-art"
- "Innovative solutions"
- "Leverage synergies"
- "In today's digital landscape"
- "Drive results"
- "Best-in-class"
- "Harness the power of"
- "Seamless experience"

If you catch yourself writing any of the above, stop and replace with a specific, factual statement about THIS brand.
═══════════════════════════════════════════════

MANDATORY SPECIFICITY RULES:
1. DIAGNOSIS: Start with what this brand's actual marketing situation looks like right now. Mention the stage (pre-launch, early, growth, etc), the trust problem, the positioning problem, any obvious gaps. Be blunt.
2. DIFFERENTIATION: Explain in concrete terms how this brand is different from its competitors. Not "better" — different. What do they do that no one else does?
3. AUDIENCE SEGMENTS: List the real, specific types of people who buy from this brand. Not "business owners" — "UAE clinic owners who spend on Instagram ads but see no attribution" or "e-commerce founders burned by agency retainers".
4. CONTENT ANGLES: Produce 10+ strong, specific angles. Each angle must be directly tied to a pain point, belief, or desire of the target audience. No generic educational content angles.
5. FUNNEL STRATEGY: For each funnel stage, name the exact mechanism — not "create awareness" but "use Reels to expose the pain of [specific problem] to [specific audience] on Instagram".
6. WEEKLY PLAN: Week 1 is not "set up". Week 1 is the first real marketing action with real content and real deliverables.
7. NEXT BEST ACTION: End with ONE clear, actionable, specific task the team should do immediately after reading this strategy.

LANGUAGE RULE: All text in the response must follow the language instruction at the top. Campaign names, section text, descriptions — everything.

Return ONLY valid JSON matching the schema exactly. No markdown. No explanation outside the JSON.`

  const extendedBrief = [
    `Company: ${brief.companyName}`,
    `Industry: ${brief.businessType}`,
    `Target Audience: ${brief.targetAudience}`,
    `Monthly Budget: $${brief.monthlyBudget} USD`,
    `Primary Goal: ${brief.primaryGoal || 'maximize leads and sales'}`,
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

Return JSON with ALL of these exact fields. Every field must be brand-specific — not generic:

{
  "campaignName": "string — must include the actual brand name, be campaign-specific",
  "goal": "SALES|LEADS|AWARENESS|ENGAGEMENT|TRAFFIC|BRAND_BUILDING",

  "diagnosis": "string — 2-4 sentences: brand's current marketing situation. Stage, trust gap, positioning gap, main problem to solve now. Be direct.",

  "keyMessage": "string — the single most important message to communicate. 1 sentence. Brand-specific. What they need the audience to believe.",

  "positioning": "string — sharp positioning statement. Format: '[Brand] is the [category] for [specific audience] who need [outcome] without [frustration/alternative]'",

  "differentiation": "string — concrete description of how this brand is different from competitors. Factual. What they do that competitors do not. No vague claims.",

  "targetAudienceRefined": "string — detailed audience description including demographics, behaviors, and current situation",

  "audienceSegments": [
    "string — specific segment with job title / situation / pain (not just 'business owners')",
    "string — another specific segment",
    "... minimum 4 segments"
  ],

  "funnelStrategy": {
    "awareness": "string — exact mechanism: what platform, what content type, what message triggers awareness for THIS brand",
    "consideration": "string — exact mechanism: how do people move from knowing to considering this brand",
    "conversion": "string — exact mechanism: what specific CTA, proof, or offer closes the conversion",
    "retention": "string — exact mechanism: how does this brand keep customers coming back or referring"
  },

  "channelMix": [
    { "platform": "string", "budgetPercent": number, "rationale": "string — specific to this brand", "contentFrequency": "string" }
  ],

  "channelStrategy": [
    {
      "platform": "string",
      "role": "string — what job this platform does in the funnel for THIS brand",
      "contentType": "string — exact format",
      "postingApproach": "string — cadence, style, approach specific to this brand",
      "cta": "string — specific CTA for this platform",
      "rationale": "string — why this platform matters for THIS brand's audience"
    }
  ],

  "contentPillars": ["string", "string", "string", "string — 4-6 specific pillars for THIS brand"],

  "contentAngles": [
    "string — specific, punchy angle tied to a real pain or belief of this audience",
    "string — another angle",
    "... minimum 10 angles, maximum 15"
  ],

  "weeklyPlan": [
    {
      "week": 1,
      "objective": "string — specific objective for this week",
      "channels": ["string"],
      "contentThemes": ["string — specific themes, not generic"],
      "keyMessage": "string — the one message this week drives",
      "deliverables": ["string — concrete deliverable: '3 Reels scripts', '1 landing page', etc."],
      "cta": "string — specific CTA for this week"
    },
    { "week": 2, "objective": "...", "channels": ["..."], "contentThemes": ["..."], "keyMessage": "...", "deliverables": ["..."], "cta": "..." },
    { "week": 3, "objective": "...", "channels": ["..."], "contentThemes": ["..."], "keyMessage": "...", "deliverables": ["..."], "cta": "..." },
    { "week": 4, "objective": "...", "channels": ["..."], "contentThemes": ["..."], "keyMessage": "...", "deliverables": ["..."], "cta": "..." }
  ],

  "offerCTAStrategy": {
    "primaryCTA": "string — main call-to-action for this campaign",
    "secondaryCTA": "string — lower-friction alternative CTA",
    "leadMagnet": "string — what free value can attract leads (or null if not applicable)",
    "betaOffer": "string — early-adopter / beta offer if relevant (or null)",
    "contactFlow": "string — how does the contact/inquiry flow work: WhatsApp, form, call, etc."
  },

  "valueProps": ["string — specific value prop for THIS brand", "... 3-5 items"],

  "kpis": [
    { "metric": "string — realistic for stage and goal", "target": "string — specific number or range", "timeframe": "string" }
  ],

  "successMetrics": [
    "string — realistic early-stage metric with context. Example: '50 beta signups in 30 days via Instagram DM campaign'",
    "... 5-7 realistic metrics for this brand's stage"
  ],

  "budgetBreakdown": [{ "category": "string", "amount": number, "percent": number }],

  "visualDirection": "string — describe the visual style, mood, colors, aesthetics for this brand. Specific.",

  "topHooks": ["string — scroll-stopping hook specific to this brand", "... 5 hooks minimum"],

  "ctaVariations": ["string — specific CTA option", "... 5 CTA options"],

  "executionChecklist": ["string — specific launch task for this campaign", "... 8-10 tasks"],

  "riskNotes": [
    "string — compliance or risk note relevant to this brand/region/campaign type",
    "string — example: 'Do not claim specific ROI or guaranteed results in ad copy'",
    "... 3-5 notes relevant to this brand"
  ],

  "nextBestAction": "string — ONE clear, specific, immediately actionable task. Example: 'Create the first 3 Reels scripts for the [specific campaign angle] angle and get them approved before publishing.'",

  "launchPlan": [
    { "week": number, "focus": "string", "actions": ["string"] }
  ],

  "estimatedResults": "string — realistic, stage-appropriate projection. Do not guarantee results.",
  "confidence": number
}`

  return callOpenAI(systemPrompt, userPrompt, 4500) as Promise<StrategyOutput>
}
