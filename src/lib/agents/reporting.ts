/**
 * AGENT 4 — Reporting Agent
 *
 * Daily: summarize today
 * Weekly: performance summary + trends
 * Monthly: full ROI report
 */

import { CampaignMetrics } from './campaign-manager'

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
      temperature: 0.5,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

export interface ReportingInput {
  businessName: string
  period: 'daily' | 'weekly' | 'monthly'
  periodLabel: string
  campaigns: CampaignMetrics[]
  previousPeriodCampaigns?: CampaignMetrics[]
  budget?: number
}

export interface ReportMetric {
  label: string
  value: string
  change?: string
  trend: 'up' | 'down' | 'flat'
}

export interface ReportHighlight {
  type: 'win' | 'alert' | 'insight'
  text: string
}

export interface ReportOutput {
  title: string
  summary: string
  metrics: ReportMetric[]
  highlights: ReportHighlight[]
  recommendations: string[]
  nextPeriodFocus: string
  roi?: string
}

export async function runReportingAgent(
  input: ReportingInput
): Promise<ReportOutput> {
  const systemPrompt = `You are a marketing analytics expert writing ${input.period} reports for business owners.
Write clearly — no jargon. Business owners read this, not marketers.
Be specific with numbers. Lead with the most important insight.
Return ONLY valid JSON. No markdown outside the JSON.`

  const metricsText = input.campaigns.map(c => `
Campaign: ${c.campaignName} (${c.platform})
- CTR: ${c.ctr !== undefined ? c.ctr.toFixed(2) : 'N/A'}% ${c.ctrChange !== undefined ? `(${c.ctrChange > 0 ? '+' : ''}${c.ctrChange.toFixed(1)}%)` : ''}
- Conversions: ${c.conversions ?? 0} ${c.conversionsChange !== undefined ? `(${c.conversionsChange > 0 ? '+' : ''}${c.conversionsChange.toFixed(1)}%)` : ''}
- Spend: $${c.spend !== undefined ? c.spend.toFixed(2) : '0'}
- CPA: $${c.cpa !== undefined ? c.cpa.toFixed(2) : 'N/A'}
  `).join('\n')

  const userPrompt = `
Business: ${input.businessName}
Period: ${input.periodLabel} (${input.period} report)
${input.budget ? `Monthly Budget: $${input.budget}` : ''}

Campaign Performance:
${metricsText}

Return JSON:
{
  "title": string,
  "summary": string,
  "metrics": [{ "label": string, "value": string, "change": string, "trend": "up"|"down"|"flat" }],
  "highlights": [{ "type": "win"|"alert"|"insight", "text": string }],
  "recommendations": string[],
  "nextPeriodFocus": string,
  "roi": string
}`

  return callOpenAI(systemPrompt, userPrompt) as Promise<ReportOutput>
}

export function getPeriodLabel(type: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date()
  if (type === 'daily') {
    return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }
  if (type === 'weekly') {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(weekStart)}–${fmt(weekEnd)}`
  }
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
