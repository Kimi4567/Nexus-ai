import { describe, expect, it } from 'vitest'
import { evaluateVideoEconomicsGuard } from '@/lib/videoEconomicsGuard'

function record(status: 'COMPLETED' | 'FAILED', qualityStatus: 'PASSED' | 'REJECTED') {
  return {
    status,
    externalId: `task-${Math.random()}`,
    params: { productionRoute: 'CINEMATIC_PRODUCT_AD' },
    metadata: { qualityStatus },
  }
}

describe('video economics guard', () => {
  it('does not pause a new or healthy production history', () => {
    expect(evaluateVideoEconomicsGuard([
      record('COMPLETED', 'PASSED'),
      record('COMPLETED', 'PASSED'),
      record('COMPLETED', 'PASSED'),
      record('COMPLETED', 'PASSED'),
      record('FAILED', 'REJECTED'),
    ])).toMatchObject({ paused: false, attempts: 5, failedAttempts: 1, failureRate: 0.2 })
  })

  it('pauses before new spend when recent failures exceed the loss budget', () => {
    expect(evaluateVideoEconomicsGuard([
      record('COMPLETED', 'PASSED'),
      record('FAILED', 'REJECTED'),
      record('COMPLETED', 'PASSED'),
      record('FAILED', 'REJECTED'),
      record('COMPLETED', 'PASSED'),
    ])).toMatchObject({ paused: true, attempts: 5, failedAttempts: 2, failureRate: 0.4 })
  })

  it('ignores legacy raw clips and tasks that never reached the provider', () => {
    expect(evaluateVideoEconomicsGuard([
      { status: 'FAILED', externalId: null, params: { productionRoute: 'CINEMATIC_PRODUCT_AD' } },
      { status: 'FAILED', externalId: 'legacy', params: {} },
    ])).toMatchObject({ paused: false, attempts: 0, failedAttempts: 0 })
  })
})
