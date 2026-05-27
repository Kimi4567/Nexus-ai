/**
 * AGENT 3 — Campaign Manager
 *
 * Responsibilities:
 * - Monitor campaign performance metrics
 * - Detect underperforming content or targeting
 * - Generate actionable suggestions for the user to approve
 */

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<any> {
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
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

export interface CampaignMetrics {
  campaignId: string
  campaignName: string
  platform: string
  goal: string
  impressions?: number
  clicks?: number
  ctr?: number
  conversions?: number
  conversionRate?: number
  spend?: number
  cpa?: number
  roas?: number
  likes?: number
  shares?: number
  comments?: number
  saves?: number
  engagementRate?: number
  ctrChange?: number
  conversionsChange?: number
  spendChange?: number
  daysRunning: number
  periodDays: number
}

export interface CampaignSuggestion {
  type: 'BUDGET_CHANGE' | 'AUDIENCE_SHIFT' | 'PLATFORM_PAUSE' | 'PLATFORM_ADD' | 'CONTENT_SWAP' | 'CAMPAIGN_PAUSE'
  priority: 1 | 2 | 3
  title: string
  reasoning: string
  impact: string
  payload: Record<string, unknown>
}

export interface CampaignManagerOutput {
  campaignId: string
  healthScore: number
  healthLabel: 'excellent' | 'good' | 'needs_attention' | 'critical'
  alerts: string[]
  suggestions: CampaignSuggestion[]
  summary: string
}

export async function runCampaignManagerAgent(
  metrics: CampaignMetrics
): Promise<CampaignManagerOutput> {
  const systemPrompt = `You are a senior performance marketing campaign manager.
Analyze campaign metrics and make specific, actionable recommendations.
Think in terms of ROI, efficiency, and quick wins. Be direct.
Return ONLY valid JSON. No markdown outside the JSON.`

  const userPrompt = `
Campaign: "${metrics.campaignName}" on ${metrics.platform}
Goal: ${metrics.goal}
Running: ${metrics.daysRunning} days (period: ${metrics.periodDays} days)

Metrics:
${metrics.impressions !== undefined ? `- Impressions: ${metrics.impressions.toLocaleString()}` : ''}
${metrics.ctr !== undefined ? `- CTR: ${metrics.ctr.toFixed(2)}% (change: ${metrics.ctrChange !== undefined ? (metrics.ctrChange > 0 ? '+' : '') + metrics.ctrChange.toFixed(1) + '%' : 'N/A'})` : ''}
${metrics.conversions !== undefined ? `- Conversions: ${metrics.conversions} (change: ${metrics.conversionsChange !== undefined ? (metrics.conversionsChange > 0 ? '+' : '') + metrics.conversionsChange.toFixed(1) + '%' : 'N/A'})` : ''}
${metrics.spend !== undefined ? `- Spend: $${metrics.spend.toFixed(2)}` : ''}
${metrics.cpa !== undefined ? `- CPA: $${metrics.cpa.toFixed(2)}` : ''}
${metrics.engagementRate !== undefined ? `- Engagement Rate: ${metrics.engagementRate.toFixed(2)}%` : ''}

Return JSON:
{
  "healthScore": number (0-100),
  "healthLabel": "excellent"|"good"|"needs_attention"|"critical",
  "alerts": string[],
  "suggestions": [{ "type": string, "priority": 1|2|3, "title": string, "reasoning": string, "impact": string, "payload": {} }],
  "summary": string
}`

  const result = await callOpenAI(systemPrompt, userPrompt)
  return { ...result, campaignId: metrics.campaignId } as CampaignManagerOutput
}

export async function analyzeWorkspaceCampaigns(
  campaigns: CampaignMetrics[]
): Promise<CampaignManagerOutput[]> {
  const results: CampaignManagerOutput[] = []
  for (let i = 0; i < campaigns.length; i += 3) {
    const batch = campaigns.slice(i, i + 3)
    const batchResults = await Promise.allSettled(
      batch.map(c => runCampaignManagerAgent(c))
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
  }
  return results
}

export function buildMetricsFromCampaign(campaign: Record<string, unknown>): CampaignMetrics {
  const daysRunning = Math.floor(
    (Date.now() - new Date(campaign.createdAt as string).getTime()) / 86_400_000
  )

  const mockBase = {
    impressions: daysRunning * 450 + Math.floor(Math.random() * 2000),
    clicks: daysRunning * 18 + Math.floor(Math.random() * 50),
    conversions: Math.max(0, daysRunning * 2 + Math.floor(Math.random() * 10)),
    spend: daysRunning * 12.5,
  }

  const ctr = mockBase.impressions > 0
    ? (mockBase.clicks / mockBase.impressions) * 100
    : 0

  const platforms = campaign.platforms as string[] | undefined
  return {
    campaignId: campaign.id as string,
    campaignName: campaign.name as string,
    platform: platforms?.[0] || 'INSTAGRAM',
    goal: (campaign.goal as string) || 'LEADS',
    impressions: mockBase.impressions,
    clicks: mockBase.clicks,
    ctr,
    conversions: mockBase.conversions,
    conversionRate: mockBase.clicks > 0
      ? (mockBase.conversions / mockBase.clicks) * 100
      : 0,
    spend: mockBase.spend,
    cpa: mockBase.conversions > 0 ? mockBase.spend / mockBase.conversions : 0,
    ctrChange: (Math.random() - 0.5) * 40,
    conversionsChange: (Math.random() - 0.5) * 30,
    daysRunning,
    periodDays: Math.min(daysRunning, 7),
  }
}
