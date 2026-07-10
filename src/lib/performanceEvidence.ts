function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function numberFromPerformanceMetric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const PERFORMANCE_METRIC_KEYS = [
  'impressions',
  'reach',
  'views',
  'likes',
  'comments',
  'shares',
  'clicks',
  'engagementRate',
  'conversions',
  'spend',
  'revenue',
] as const

/**
 * Zero is a valid measured result. Empty objects and workflow-only metadata are
 * not performance evidence and must never unlock performance-learning claims.
 */
export function hasRealPerformanceAnalytics(value: unknown): boolean {
  if (!isRecord(value)) return false
  return PERFORMANCE_METRIC_KEYS.some(key => numberFromPerformanceMetric(value[key]) !== null)
}

