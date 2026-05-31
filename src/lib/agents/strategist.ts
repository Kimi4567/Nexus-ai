/**
 * AGENT 1 — Marketing Strategist
 *
 * Responsibilities:
 * - Analyze brand profile + business brief
 * - Define campaign goal, channel mix, KPI targets
 * - Recommend monthly budget allocation
 * - Output a complete campaign strategy plan
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
  // New enriched fields
  valueProps?: string[]
  visualDirection?: string
  executionChecklist?: string[]
  topHooks?: string[]
  ctaVariations?: string[]
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
Your job is to produce a highly specific, brand-personalized campaign strategy.

CRITICAL RULES:
- Write SPECIFICALLY about THIS brand using the exact details provided. Never produce generic AI-speak.
- Do NOT use phrases like "innovative solutions", "cutting-edge", "revolutionary", "state-of-the-art", "leverage synergies" unless those are the brand's own words.
- Every line must feel written about THIS specific company, not a template.
- If competitors are provided, reference them with real contrast strategies.
- If the brand has winning hooks, build on that style — don't ignore them.
- The campaign name must include the actual brand name.
- Return ONLY valid JSON. No markdown, no explanation outside the JSON.`

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

Return JSON with these exact fields:
{
  "campaignName": string (must include brand name, be specific),
  "goal": "SALES|LEADS|AWARENESS|ENGAGEMENT|TRAFFIC|BRAND_BUILDING",
  "keyMessage": string (the single most important message to communicate — 1 sentence, brand-specific),
  "positioning": string (1-sentence brand position vs competitors, specific),
  "targetAudienceRefined": string (detailed, specific audience description),
  "channelMix": [{ "platform": string, "budgetPercent": number, "rationale": string, "contentFrequency": string }],
  "kpis": [{ "metric": string, "target": string, "timeframe": string }],
  "budgetBreakdown": [{ "category": string, "amount": number, "percent": number }],
  "contentPillars": string[] (4-6 specific pillars for THIS brand),
  "valueProps": string[] (3-5 specific value propositions for THIS brand),
  "visualDirection": string (describe the visual style, mood, colors, aesthetics for this brand),
  "topHooks": string[] (5 scroll-stopping hooks specific to this brand and audience),
  "ctaVariations": string[] (5 CTA options specific to this campaign goal),
  "executionChecklist": string[] (8-10 specific launch tasks for this campaign),
  "launchPlan": [{ "week": number, "focus": string, "actions": string[] }],
  "estimatedResults": string,
  "confidence": number
}`

  return callOpenAI(systemPrompt, userPrompt, 3000) as Promise<StrategyOutput>
}
