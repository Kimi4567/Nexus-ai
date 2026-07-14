export const PAID_METRIC_KEYS = [
  'impressions',
  'reach',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'spend',
  'conversions',
  'roas',
] as const

export type PaidMetricKey = typeof PAID_METRIC_KEYS[number]
export type PaidMetrics = Partial<Record<PaidMetricKey, number>>

export function normalizeManualPaidMetrics(input: unknown): {
  metrics: PaidMetrics
  invalidKeys: PaidMetricKey[]
} {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const metrics: PaidMetrics = {}
  const invalidKeys: PaidMetricKey[] = []

  for (const key of PAID_METRIC_KEYS) {
    const raw = body[key]
    if (raw === undefined || raw === null || raw === '') continue
    const value = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(value) || value < 0) {
      invalidKeys.push(key)
      continue
    }
    metrics[key] = value
  }

  return { metrics, invalidKeys }
}

export function paidMetricsCompleteness(metrics: unknown): 'complete' | 'partial' | 'insufficient' {
  if (!metrics || typeof metrics !== 'object') return 'insufficient'
  const count = PAID_METRIC_KEYS.filter((key) => (
    typeof (metrics as Record<string, unknown>)[key] === 'number'
  )).length
  if (count >= 5) return 'complete'
  if (count >= 2) return 'partial'
  return 'insufficient'
}
