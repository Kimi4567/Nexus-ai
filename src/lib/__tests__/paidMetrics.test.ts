import { describe, expect, it } from 'vitest'
import { normalizeManualPaidMetrics, paidMetricsCompleteness } from '@/lib/paidMetrics'

describe('manual paid metrics truth boundary', () => {
  it('keeps explicit zeroes but omits blank fields', () => {
    expect(normalizeManualPaidMetrics({ impressions: '', clicks: 0, spend: '12.50' })).toEqual({
      metrics: { clicks: 0, spend: 12.5 },
      invalidKeys: [],
    })
  })

  it('rejects negative and non-finite values', () => {
    expect(normalizeManualPaidMetrics({ reach: -1, ctr: 'not-a-number' })).toEqual({
      metrics: {},
      invalidKeys: ['reach', 'ctr'],
    })
  })

  it('labels evidence completeness from supplied numeric fields only', () => {
    expect(paidMetricsCompleteness({ ctr: 1 })).toBe('insufficient')
    expect(paidMetricsCompleteness({ ctr: 1, spend: 20 })).toBe('partial')
    expect(paidMetricsCompleteness({ impressions: 100, reach: 80, clicks: 5, spend: 20, conversions: 1 })).toBe('complete')
  })
})
