import { CINEMATIC_PRODUCT_AD_PROVIDER_COST_USD_ESTIMATE } from '@/lib/videoAdPreflight'

export type VideoEconomicsRecord = {
  status?: string | null
  externalId?: string | null
  params?: unknown
  metadata?: unknown
}

export type VideoEconomicsGuardResult = {
  paused: boolean
  attempts: number
  failedAttempts: number
  failureRate: number
  estimatedProviderSpendUsd: number
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/**
 * Stops new provider spend when a workspace's recent cinematic product-ad
 * results exceed the bounded loss budget. An operator must inspect the source
 * assets/provider health before production resumes; the route never retries.
 */
export function evaluateVideoEconomicsGuard(
  records: VideoEconomicsRecord[],
): VideoEconomicsGuardResult {
  const terminal = records.filter(record => {
    const params = object(record.params)
    return params.productionRoute === 'CINEMATIC_PRODUCT_AD'
      && Boolean(record.externalId)
      && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(String(record.status || '').toUpperCase())
  })
  const failedAttempts = terminal.filter(record => {
    const qualityStatus = String(object(record.metadata).qualityStatus || '').toUpperCase()
    return ['FAILED', 'CANCELLED'].includes(String(record.status || '').toUpperCase())
      || ['REJECTED', 'ERROR'].includes(qualityStatus)
  }).length
  const attempts = terminal.length
  const failureRate = attempts > 0 ? failedAttempts / attempts : 0

  return {
    paused: attempts >= 5 && failureRate >= 0.25,
    attempts,
    failedAttempts,
    failureRate,
    estimatedProviderSpendUsd: Number((attempts * CINEMATIC_PRODUCT_AD_PROVIDER_COST_USD_ESTIMATE).toFixed(2)),
  }
}
