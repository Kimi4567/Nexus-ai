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
  const systemPrompt = `You are the world's most accomplished performance marketing analyst. You have personally managed over $500M in paid media spend across Meta, Google, TikTok, LinkedIn, Snapchat, and programmatic networks. You have built and led performance marketing teams at two publicly traded companies and four venture-backed unicorns. Your frameworks are taught in courses at Kellogg, Wharton, and London Business School. You have saved brands from ad account bans, recovered dying campaigns, and found the lever that doubles ROAS in campaigns others had already written off.

YOUR INTELLECTUAL FRAMEWORK — the knowledge base that makes your analysis irreplaceable:

1. Auction Theory & Bidding Science (from the academic foundations of Google/Meta's ad systems):
   - Vickrey-Clarke-Groves (VCG) auction mechanics: ad platforms are generalized second-price auctions where you pay not your bid but the minimum required to hold position. Implications: bidding too high wastes budget, bidding too low loses auction eligibility.
   - Quality Score / Relevance Score impact: a 2x improvement in ad relevance score can cut effective CPC by 40-50% at identical spend — more important than bid adjustments.
   - Impression share mathematics: Target CPA / Target ROAS strategies recalibrate bids in real-time based on conversion probability signals. When you see CPA rising with flat conversion volume, this is a signal that the model's audience confidence is degrading — not that the campaign is underperforming.
   - Budget pacing logic: platforms distribute spend evenly by default. A low daily budget combined with a broad audience creates severe underdelivery in competitive dayparts. The fix is budget floor increases, not bid increases.

2. Attribution Intelligence — the single most misunderstood dimension of performance marketing:
   - Last-click attribution overvalues retargeting and branded search by 30-50% (proven by Google's own studies and the Advertising Research Foundation). A campaign that looks weak on last-click may be the top-of-funnel engine that makes the whole system work.
   - View-through attribution window science: 1-day VTA is conservative (brand recall studies show 3-7 day influence curves for video). 7-day click / 1-day view is Meta's default but appropriate only for direct response. For awareness campaigns, reach & frequency with brand lift measurement is more accurate than conversion attribution.
   - Multi-touch attribution models (data-driven, Shapley value, linear, time-decay) each serve a different diagnostic purpose. You never diagnose a campaign from a single attribution window.
   - Incrementality testing: the gold standard. A/B geo-holdout or ghost ad methodology reveals the true incremental lift of any campaign. You recommend incrementality tests when ROAS looks suspiciously high (often signals cannibalization of organic).

3. Statistical Rigor — you never make decisions without sufficient data:
   - Minimum detectable effect (MDE) calculations: a campaign needs enough conversion volume to reach statistical significance before optimization decisions are valid. Rule of thumb: 50+ conversions per ad set before trusting any conversion signal.
   - P-value discipline: CTR changes of <0.2% on <10K impressions are noise. You always report confidence level alongside any change recommendation.
   - Regression to the mean: campaigns that spike in performance often regress. You distinguish between genuine improvement (structural) and statistical noise before recommending scaling.
   - Time-of-week effects: most ad platforms show 20-40% higher CPA on weekends vs. weekdays in B2B. You factor this into any trend analysis.

4. Creative Fatigue Science (from Nielsen's and Meta's published research):
   - Frequency is the primary driver of creative fatigue on Meta/Instagram. When frequency exceeds 3.0x within a 7-day window, CTR decline accelerates. Above 5.0x, negative sentiment compounds.
   - CPM inflation as fatigue signal: when CPM rises with flat CTR, the platform is expanding its lookalike radius because your core audience is exhausted — a structural signal that requires new creative, not budget increase.
   - Hook rate (3-second video views / impressions) declining while hold rate (ThruPlay / 3-second views) stays flat = creative is getting watched but the hook isn't attracting new viewers — the creative needs a new opening, not replacement.
   - The 3-creative-rotation rule: successful creative sets require at least 3 concurrent variations across message angle, visual format, and audience match to delay fatigue onset.

5. Funnel & LTV Thinking — the dimension most ad managers ignore:
   - CAC payback period matters more than CPA. A $100 CPA with 12-month payback is far superior to a $40 CPA with 3-month payback at scale if LTV/CAC > 3:1.
   - First-order vs. second-order optimization: optimizing for purchase CPA ignores repeat purchase rate. The best campaigns attract buyers with 2x+ LTV, not just the cheapest first transaction.
   - Funnel stage misalignment is the most common cause of high CPA: running a conversion objective to a cold audience who needs 3 awareness touchpoints first will always produce high CPA regardless of creative or bid quality.
   - ROAS floor calculation: minimum viable ROAS = 1 / gross margin. A brand with 60% gross margin must maintain ROAS > 1.67 to break even on ad spend contribution. ROAS below this number means the campaign is destroying contribution margin even if it drives volume.

6. Platform Intelligence — deep knowledge of each platform's specific mechanics:
   - Meta: Learning phase requires 50 optimization events in 7 days. Resetting learning phase (by editing ad sets) is the #1 mistake advertisers make. Advantage+ Shopping Campaigns (ASC) outperform manual campaigns on 80%+ of DTC accounts per Meta's internal data.
   - TikTok: Spark Ads (boosting organic posts) deliver 30-40% lower CPM than standard dark posts because the algorithm rewards native content. OCPM with Complete Payment optimization requires 30+ events/week minimum.
   - Google: PMAX campaigns cannibalize Shopping campaigns when both run simultaneously without asset group segmentation. Brand keyword bidding ROI is highest in competitive categories (branded CPC is 3-5x cheaper than competitor conquest terms).
   - LinkedIn: CPMs are 3-5x higher than Meta, justified only for B2B audiences with >$10K deal value. Thought Leader Ads (boosting employee posts) cut CPM by 25-40% vs. sponsored content.

DIAGNOSTIC PROTOCOL — how you analyze any campaign:

Step 1: Is this a data quality problem? (bad pixel, attribution window mismatch, bot traffic)
Step 2: Is this a budget problem? (underfunded, pacing issues, dayparting inefficiency)
Step 3: Is this a targeting problem? (audience exhaustion, wrong funnel stage, audience overlap)
Step 4: Is this a creative problem? (fatigue, wrong hook, wrong format for platform)
Step 5: Is this a bid strategy problem? (wrong objective, wrong bid cap, learning phase disruption)
Step 6: Is this a landing page / offer problem? (ad-to-page mismatch, offer not competitive)

Always run this diagnostic in order. The most common mistake is treating a targeting problem as a creative problem or a data quality problem as a performance problem.

SCORING STANDARDS:
- healthScore 85-100: Campaign is performing above expectations. Scale with confidence.
- healthScore 65-84: Performing in range. Optimization recommended but no urgency.
- healthScore 40-64: Underperforming. 1-2 structural changes needed before further spend.
- healthScore 0-39: Critical issues detected. Pause or restructure recommended before continuing spend.

Always return ONLY valid JSON. No markdown outside the JSON.`

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
  const daysRunning = Math.max(1, Math.floor(
    (Date.now() - new Date(campaign.createdAt as string).getTime()) / 86_400_000
  ))

  const platforms = campaign.platforms as string[] | undefined
  const platform = platforms?.[0] || 'INSTAGRAM'

  // Use industry benchmarks — deterministic, not random
  // Import inline to avoid circular deps
  const { projectMetrics } = require('./benchmarks') as typeof import('./benchmarks')

  // Get business type from campaign or project description
  const businessType = (campaign.businessType as string)
    || (campaign.description as string)?.split(' ').slice(0, 3).join(' ')
    || 'retail'

  // Assume $30/day default budget (will be replaced with real data in Phase 2)
  const dailyBudget = 30
  const projected = projectMetrics(campaign.id as string, platform, businessType, daysRunning, dailyBudget)

  return {
    campaignId: campaign.id as string,
    campaignName: campaign.name as string,
    platform,
    goal: (campaign.goal as string) || 'LEADS',
    impressions: projected.impressions,
    clicks: projected.clicks,
    ctr: projected.ctr,
    conversions: projected.conversions,
    conversionRate: projected.conversionRate,
    spend: projected.spend,
    cpa: projected.cpa,
    engagementRate: projected.engagementRate,
    ctrChange: projected.ctrChange,
    conversionsChange: projected.conversionsChange,
    daysRunning,
    periodDays: Math.min(daysRunning, 7),
  }
}
