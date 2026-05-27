/**
 * AGENT 1 — Marketing Strategist
 *
 * Responsibilities:
 * - Analyze brand profile + business brief
 * - Define campaign goal, channel mix, KPI targets
 * - Recommend monthly budget allocation
 * - Output a complete campaign strategy plan
 */

export interface BusinessBrief {
  companyName: string
  businessType: string
  targetAudience: string
  monthlyBudget: number
  currentPlatforms?: string[]
  primaryGoal?: string
  existingProblems?: string
}

export interface StrategyOutput {
  campaignName: string
  goal: string
  positioning: string
  targetAudienceRefined: string
  channelMix: ChannelAllocation[]
  kpis: KPI[]
  budgetBreakdown: BudgetItem[]
  contentPillars: string[]
  launchPlan: LaunchPhase[]
  estimatedResults: string
  confidence: number
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
  brandContext?: string
): Promise<StrategyOutput> {
  const systemPrompt = `You are a senior marketing strategist at a top-tier performance marketing agency.
Analyze the business brief and produce an actionable, data-backed marketing strategy.
Think channel mix, budget allocation, KPIs, content pillars.
Return ONLY valid JSON matching the StrategyOutput schema. No markdown, no explanation outside the JSON.`

  const userPrompt = `
Business Brief:
- Company: ${brief.companyName}
- Type: ${brief.businessType}
- Target Audience: ${brief.targetAudience}
- Monthly Budget: $${brief.monthlyBudget} USD
- Goal: ${brief.primaryGoal || 'maximize leads and sales'}
- Current Platforms: ${brief.currentPlatforms?.join(', ') || 'none'}
- Problems: ${brief.existingProblems || 'not specified'}

${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON with these fields:
{
  "campaignName": string,
  "goal": "SALES|LEADS|AWARENESS|ENGAGEMENT|TRAFFIC|BRAND_BUILDING",
  "positioning": string (1-sentence brand position),
  "targetAudienceRefined": string,
  "channelMix": [{ "platform": string, "budgetPercent": number, "rationale": string, "contentFrequency": string }],
  "kpis": [{ "metric": string, "target": string, "timeframe": string }],
  "budgetBreakdown": [{ "category": string, "amount": number, "percent": number }],
  "contentPillars": string[],
  "launchPlan": [{ "week": number, "focus": string, "actions": string[] }],
  "estimatedResults": string,
  "confidence": number
}`

  return callOpenAI(systemPrompt, userPrompt) as Promise<StrategyOutput>
}
