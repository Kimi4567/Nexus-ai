import { hasRealPerformanceAnalytics, numberFromPerformanceMetric } from '@/lib/performanceEvidence'
import { isAnalyticsBackedPaidMetricsSource } from '@/lib/paidBoundary'

export interface OrganicPerformanceRecord {
  platform?: string | null
  analyticsData?: unknown
  analyticsUpdatedAt?: Date | string | null
}

export interface PaidPerformanceRecord {
  platform?: string | null
  dataSource?: unknown
  date?: Date | string | null
  syncedAt?: Date | string | null
  impressions?: unknown
  reach?: unknown
  postEngagements?: unknown
  clicks?: unknown
  conversions?: unknown
  spend?: unknown
  ctr?: unknown
  roas?: unknown
}

export interface PerformanceChannelSummary {
  platform: string
  evidenceRows: number
  impressions: number
  reach: number
  engagements: number
  clicks: number
  conversions: number
  spend: number
}

export interface PerformanceTrendPoint {
  date: string
  impressions: number
  engagements: number
  clicks: number
  conversions: number
  spend: number
}

function metric(value: unknown): number {
  return numberFromPerformanceMetric(value) ?? 0
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function dateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function latestIso(values: Array<Date | string | null | undefined>): string | null {
  const timestamps = values
    .map(value => value ? new Date(value).getTime() : Number.NaN)
    .filter(Number.isFinite)

  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null
}

export function summarizePerformanceEvidence(
  organicRows: OrganicPerformanceRecord[] | null | undefined,
  paidRows: PaidPerformanceRecord[] | null | undefined,
) {
  const organicEvidence = (organicRows ?? []).filter(row => hasRealPerformanceAnalytics(row.analyticsData))
  const paidEvidence = (paidRows ?? []).filter(row => isAnalyticsBackedPaidMetricsSource(row.dataSource))

  const channels = new Map<string, PerformanceChannelSummary>()
  const trend = new Map<string, PerformanceTrendPoint>()

  let impressions = 0
  let reach = 0
  let engagements = 0
  let clicks = 0
  let conversions = 0
  let spend = 0
  let organicImpressions = 0
  let organicEngagements = 0
  let paidImpressions = 0
  let paidClicks = 0
  let weightedRoas = 0
  let weightedRoasSpend = 0
  let roasTotal = 0
  let roasCount = 0

  const addChannel = (
    platformValue: string | null | undefined,
    values: Omit<PerformanceChannelSummary, 'platform' | 'evidenceRows'>,
  ) => {
    const platform = String(platformValue || 'UNKNOWN').toUpperCase()
    const current = channels.get(platform) ?? {
      platform,
      evidenceRows: 0,
      impressions: 0,
      reach: 0,
      engagements: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
    }
    current.evidenceRows += 1
    current.impressions += values.impressions
    current.reach += values.reach
    current.engagements += values.engagements
    current.clicks += values.clicks
    current.conversions += values.conversions
    current.spend += values.spend
    channels.set(platform, current)
  }

  const addTrend = (
    rawDate: Date | string | null | undefined,
    values: Omit<PerformanceTrendPoint, 'date'>,
  ) => {
    const date = dateKey(rawDate)
    if (!date) return
    const current = trend.get(date) ?? { date, impressions: 0, engagements: 0, clicks: 0, conversions: 0, spend: 0 }
    current.impressions += values.impressions
    current.engagements += values.engagements
    current.clicks += values.clicks
    current.conversions += values.conversions
    current.spend += values.spend
    trend.set(date, current)
  }

  for (const row of organicEvidence) {
    const data = record(row.analyticsData)
    const rowImpressions = numberFromPerformanceMetric(data.impressions) ?? metric(data.views)
    const rowReach = metric(data.reach)
    const rowEngagements = metric(data.likes) + metric(data.comments) + metric(data.shares) + metric(data.saves)
    const rowClicks = metric(data.clicks)
    const rowConversions = metric(data.conversions)
    const rowSpend = metric(data.spend)

    impressions += rowImpressions
    reach += rowReach
    engagements += rowEngagements
    clicks += rowClicks
    conversions += rowConversions
    spend += rowSpend
    organicImpressions += rowImpressions
    organicEngagements += rowEngagements

    const values = {
      impressions: rowImpressions,
      reach: rowReach,
      engagements: rowEngagements,
      clicks: rowClicks,
      conversions: rowConversions,
      spend: rowSpend,
    }
    addChannel(row.platform, values)
    addTrend(row.analyticsUpdatedAt, values)
  }

  for (const row of paidEvidence) {
    const rowImpressions = metric(row.impressions)
    const rowReach = metric(row.reach)
    const rowEngagements = metric(row.postEngagements)
    const rowClicks = metric(row.clicks)
    const rowConversions = metric(row.conversions)
    const rowSpend = metric(row.spend)
    const rowRoas = numberFromPerformanceMetric(row.roas)

    impressions += rowImpressions
    reach += rowReach
    engagements += rowEngagements
    clicks += rowClicks
    conversions += rowConversions
    spend += rowSpend
    paidImpressions += rowImpressions
    paidClicks += rowClicks

    if (rowRoas !== null) {
      roasTotal += rowRoas
      roasCount += 1
      if (rowSpend > 0) {
        weightedRoas += rowRoas * rowSpend
        weightedRoasSpend += rowSpend
      }
    }

    const values = {
      impressions: rowImpressions,
      reach: rowReach,
      engagements: rowEngagements,
      clicks: rowClicks,
      conversions: rowConversions,
      spend: rowSpend,
    }
    addChannel(row.platform, values)
    addTrend(row.date ?? row.syncedAt, values)
  }

  return {
    hasEvidence: organicEvidence.length > 0 || paidEvidence.length > 0,
    organicEvidenceCount: organicEvidence.length,
    paidEvidenceCount: paidEvidence.length,
    totalEvidenceRows: organicEvidence.length + paidEvidence.length,
    totals: {
      impressions,
      reach,
      engagements,
      clicks,
      conversions,
      spend,
      organicEngagementRate: organicImpressions > 0 ? (organicEngagements / organicImpressions) * 100 : null,
      paidCtr: paidImpressions > 0 ? (paidClicks / paidImpressions) * 100 : null,
      paidRoas: weightedRoasSpend > 0
        ? weightedRoas / weightedRoasSpend
        : roasCount > 0 ? roasTotal / roasCount : null,
    },
    channels: Array.from(channels.values()).sort((a, b) => b.impressions - a.impressions),
    trend: Array.from(trend.values()).sort((a, b) => a.date.localeCompare(b.date)),
    lastUpdatedAt: latestIso([
      ...organicEvidence.map(row => row.analyticsUpdatedAt),
      ...paidEvidence.map(row => row.syncedAt ?? row.date),
    ]),
  }
}
