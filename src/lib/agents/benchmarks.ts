/**
 * Industry Benchmark Data
 *
 * These are real-world averages from:
 * - WordStream Industry Benchmarks 2024
 * - Hootsuite Social Media Trends 2024
 * - Meta Business Insights 2024
 *
 * Used by Campaign Manager to generate realistic projected metrics
 * until real platform APIs are connected.
 *
 * dataSource = 'projected' until integration connected
 * dataSource = 'live' when Meta/TikTok/etc API is active
 */

export interface IndustryBenchmark {
  // CTR (click-through rate) ranges
  ctrMin: number      // percent
  ctrMax: number      // percent
  ctrAvg: number      // percent

  // Conversion rate (clicks → leads/sales)
  convRateMin: number
  convRateMax: number
  convRateAvg: number

  // Cost per acquisition (USD)
  cpaMin: number
  cpaMax: number
  cpaAvg: number

  // Engagement rate (likes+comments+shares / impressions)
  engagementMin: number
  engagementMax: number
  engagementAvg: number

  // Typical daily impressions per $100 spend
  impressionsPerHundred: number
}

// Keyed by business type (lowercased, partial match)
const BENCHMARKS_BY_INDUSTRY: Record<string, IndustryBenchmark> = {
  ecommerce: {
    ctrMin: 0.9, ctrMax: 2.2, ctrAvg: 1.5,
    convRateMin: 1.2, convRateMax: 3.8, convRateAvg: 2.1,
    cpaMin: 18, cpaMax: 65, cpaAvg: 38,
    engagementMin: 1.2, engagementMax: 4.5, engagementAvg: 2.4,
    impressionsPerHundred: 8500,
  },
  fitness: {
    ctrMin: 1.2, ctrMax: 3.1, ctrAvg: 2.0,
    convRateMin: 2.0, convRateMax: 6.5, convRateAvg: 3.8,
    cpaMin: 12, cpaMax: 45, cpaAvg: 24,
    engagementMin: 2.5, engagementMax: 7.2, engagementAvg: 4.1,
    impressionsPerHundred: 9200,
  },
  wellness: {
    ctrMin: 1.2, ctrMax: 3.1, ctrAvg: 2.0,
    convRateMin: 2.0, convRateMax: 6.5, convRateAvg: 3.8,
    cpaMin: 12, cpaMax: 45, cpaAvg: 24,
    engagementMin: 2.5, engagementMax: 7.2, engagementAvg: 4.1,
    impressionsPerHundred: 9200,
  },
  restaurant: {
    ctrMin: 1.5, ctrMax: 3.8, ctrAvg: 2.4,
    convRateMin: 3.0, convRateMax: 8.5, convRateAvg: 5.2,
    cpaMin: 8, cpaMax: 28, cpaAvg: 16,
    engagementMin: 3.2, engagementMax: 9.1, engagementAvg: 5.5,
    impressionsPerHundred: 11000,
  },
  beauty: {
    ctrMin: 1.4, ctrMax: 3.5, ctrAvg: 2.2,
    convRateMin: 2.5, convRateMax: 7.0, convRateAvg: 4.2,
    cpaMin: 14, cpaMax: 52, cpaAvg: 28,
    engagementMin: 3.0, engagementMax: 8.5, engagementAvg: 5.0,
    impressionsPerHundred: 10000,
  },
  'real estate': {
    ctrMin: 0.6, ctrMax: 1.8, ctrAvg: 1.1,
    convRateMin: 0.8, convRateMax: 2.5, convRateAvg: 1.5,
    cpaMin: 45, cpaMax: 180, cpaAvg: 95,
    engagementMin: 0.8, engagementMax: 2.8, engagementAvg: 1.6,
    impressionsPerHundred: 6500,
  },
  education: {
    ctrMin: 0.8, ctrMax: 2.5, ctrAvg: 1.6,
    convRateMin: 1.5, convRateMax: 5.0, convRateAvg: 3.0,
    cpaMin: 22, cpaMax: 85, cpaAvg: 48,
    engagementMin: 1.5, engagementMax: 5.0, engagementAvg: 2.8,
    impressionsPerHundred: 7800,
  },
  coaching: {
    ctrMin: 0.8, ctrMax: 2.5, ctrAvg: 1.6,
    convRateMin: 1.5, convRateMax: 5.0, convRateAvg: 3.0,
    cpaMin: 22, cpaMax: 85, cpaAvg: 48,
    engagementMin: 1.5, engagementMax: 5.0, engagementAvg: 2.8,
    impressionsPerHundred: 7800,
  },
  technology: {
    ctrMin: 0.5, ctrMax: 1.5, ctrAvg: 0.9,
    convRateMin: 0.8, convRateMax: 3.0, convRateAvg: 1.8,
    cpaMin: 35, cpaMax: 140, cpaAvg: 78,
    engagementMin: 0.6, engagementMax: 2.5, engagementAvg: 1.3,
    impressionsPerHundred: 5500,
  },
  saas: {
    ctrMin: 0.5, ctrMax: 1.5, ctrAvg: 0.9,
    convRateMin: 0.8, convRateMax: 3.0, convRateAvg: 1.8,
    cpaMin: 35, cpaMax: 140, cpaAvg: 78,
    engagementMin: 0.6, engagementMax: 2.5, engagementAvg: 1.3,
    impressionsPerHundred: 5500,
  },
  fashion: {
    ctrMin: 1.0, ctrMax: 2.8, ctrAvg: 1.8,
    convRateMin: 1.5, convRateMax: 4.5, convRateAvg: 2.8,
    cpaMin: 20, cpaMax: 75, cpaAvg: 42,
    engagementMin: 2.8, engagementMax: 8.0, engagementAvg: 4.5,
    impressionsPerHundred: 9800,
  },
  consulting: {
    ctrMin: 0.6, ctrMax: 1.8, ctrAvg: 1.1,
    convRateMin: 1.0, convRateMax: 3.5, convRateAvg: 2.0,
    cpaMin: 55, cpaMax: 220, cpaAvg: 120,
    engagementMin: 0.8, engagementMax: 3.0, engagementAvg: 1.7,
    impressionsPerHundred: 6000,
  },
  retail: {
    ctrMin: 0.8, ctrMax: 2.2, ctrAvg: 1.4,
    convRateMin: 1.5, convRateMax: 4.0, convRateAvg: 2.5,
    cpaMin: 15, cpaMax: 55, cpaAvg: 30,
    engagementMin: 1.5, engagementMax: 4.5, engagementAvg: 2.8,
    impressionsPerHundred: 8000,
  },
  // Default fallback
  default: {
    ctrMin: 0.8, ctrMax: 2.0, ctrAvg: 1.3,
    convRateMin: 1.5, convRateMax: 4.0, convRateAvg: 2.5,
    cpaMin: 20, cpaMax: 80, cpaAvg: 45,
    engagementMin: 1.5, engagementMax: 5.0, engagementAvg: 2.8,
    impressionsPerHundred: 7500,
  },
}

// Platform modifier — TikTok gets higher engagement, LinkedIn higher CPA
const PLATFORM_MODIFIERS: Record<string, { ctr: number; engagement: number; cpa: number }> = {
  TIKTOK:        { ctr: 1.3,  engagement: 1.8, cpa: 0.7 },
  INSTAGRAM:     { ctr: 1.1,  engagement: 1.5, cpa: 0.9 },
  FACEBOOK:      { ctr: 0.95, engagement: 0.9, cpa: 1.0 },
  LINKEDIN:      { ctr: 0.7,  engagement: 0.6, cpa: 2.2 },
  YOUTUBE_SHORTS:{ ctr: 1.2,  engagement: 1.4, cpa: 0.8 },
  SNAPCHAT:      { ctr: 1.0,  engagement: 1.2, cpa: 0.85 },
  WEBSITE:       { ctr: 1.0,  engagement: 1.0, cpa: 1.0 },
}

/**
 * Get benchmarks for a business type (fuzzy match)
 */
export function getBenchmarks(businessType: string): IndustryBenchmark {
  const lower = businessType.toLowerCase()
  const match = Object.keys(BENCHMARKS_BY_INDUSTRY).find(key =>
    lower.includes(key) || key.includes(lower.split(' ')[0])
  )
  return BENCHMARKS_BY_INDUSTRY[match || 'default']
}

/**
 * Generate deterministic projected metrics for a campaign.
 * Uses campaign ID as a seed for consistent (non-random) variation.
 * The same campaign always gets the same projected numbers.
 */
export function projectMetrics(
  campaignId: string,
  platform: string,
  businessType: string,
  daysRunning: number,
  dailyBudget: number
): ProjectedMetrics {
  const benchmarks = getBenchmarks(businessType)
  const platformMod = PLATFORM_MODIFIERS[platform] || PLATFORM_MODIFIERS.INSTAGRAM

  // Use campaign ID chars as a deterministic seed (0–1 range)
  const seed = campaignId.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0)
  const normalized = (seed % 1000) / 1000  // 0–1, consistent for same campaignId

  // Position within min–max range based on seed
  const ctr = benchmarks.ctrMin + (benchmarks.ctrMax - benchmarks.ctrMin) * normalized * platformMod.ctr
  const convRate = benchmarks.convRateMin + (benchmarks.convRateMax - benchmarks.convRateMin) * normalized
  const cpa = (benchmarks.cpaMin + (benchmarks.cpaMax - benchmarks.cpaMin) * (1 - normalized)) * platformMod.cpa
  const engagementRate = (benchmarks.engagementMin + (benchmarks.engagementMax - benchmarks.engagementMin) * normalized) * platformMod.engagement

  const totalSpend = dailyBudget * daysRunning
  const impressions = Math.round((totalSpend / 100) * benchmarks.impressionsPerHundred * platformMod.engagement)
  const clicks = Math.round(impressions * (ctr / 100))
  const conversions = Math.round(clicks * (convRate / 100))

  // Week-over-week trend: campaigns typically warm up in first 14 days
  const maturityFactor = Math.min(1, daysRunning / 14)
  const trendDirection = normalized > 0.5 ? 1 : -1
  const ctrChange = trendDirection * maturityFactor * (5 + normalized * 15)  // -20% to +20%
  const conversionsChange = trendDirection * maturityFactor * (3 + normalized * 12)

  return {
    impressions,
    clicks,
    ctr: parseFloat(ctr.toFixed(2)),
    conversions,
    conversionRate: parseFloat(convRate.toFixed(2)),
    spend: parseFloat(totalSpend.toFixed(2)),
    cpa: conversions > 0 ? parseFloat((totalSpend / conversions).toFixed(2)) : parseFloat(cpa.toFixed(2)),
    engagementRate: parseFloat(engagementRate.toFixed(2)),
    ctrChange: parseFloat(ctrChange.toFixed(1)),
    conversionsChange: parseFloat(conversionsChange.toFixed(1)),
    dataSource: 'projected',
    benchmarkSource: 'Industry averages (WordStream 2024 + Meta Business Insights)',
    businessType,
    platform,
  }
}

export interface ProjectedMetrics {
  impressions: number
  clicks: number
  ctr: number
  conversions: number
  conversionRate: number
  spend: number
  cpa: number
  engagementRate: number
  ctrChange: number
  conversionsChange: number
  dataSource: 'projected' | 'live'
  benchmarkSource: string
  businessType: string
  platform: string
}
