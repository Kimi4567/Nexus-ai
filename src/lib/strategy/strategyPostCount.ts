import type { ContentIntensity, StrategyOrder } from './strategyOrder'

export const MIN_CUSTOM_ORGANIC_POST_COUNT = 1
export const MAX_CUSTOM_ORGANIC_POST_COUNT = 30

export function includesOrganicScope(order: Pick<StrategyOrder, 'strategyType'>): boolean {
  return order.strategyType === 'organic' || order.strategyType === 'full'
}

export function normalizeCustomOrganicPostCount(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) ? n : 0
}

export function isValidCustomOrganicPostCount(value: number | null | undefined): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_CUSTOM_ORGANIC_POST_COUNT &&
    value <= MAX_CUSTOM_ORGANIC_POST_COUNT
  )
}

export function intensityForOrganicPostCount(postCount: number): ContentIntensity {
  if (postCount <= 10) return 'light'
  if (postCount <= 16) return 'standard'
  if (postCount <= 25) return 'growth'
  return 'daily'
}

export function effectiveContentIntensityForOrder(order: StrategyOrder): ContentIntensity {
  if (includesOrganicScope(order) && isValidCustomOrganicPostCount(order.customOrganicPostCount)) {
    return intensityForOrganicPostCount(order.customOrganicPostCount)
  }

  return order.contentIntensity
}

export function customOrganicPostCountUnsupported(order: StrategyOrder): boolean {
  if (!includesOrganicScope(order)) return false
  if (order.customOrganicPostCount === null || order.customOrganicPostCount === undefined) return false
  return !isValidCustomOrganicPostCount(order.customOrganicPostCount)
}
