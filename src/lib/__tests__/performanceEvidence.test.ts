import { describe, expect, it } from 'vitest'
import { hasRealPerformanceAnalytics, numberFromPerformanceMetric } from '@/lib/performanceEvidence'

describe('performance evidence contract', () => {
  it('rejects empty and workflow-only payloads', () => {
    expect(hasRealPerformanceAnalytics(null)).toBe(false)
    expect(hasRealPerformanceAnalytics(undefined)).toBe(false)
    expect(hasRealPerformanceAnalytics({})).toBe(false)
    expect(hasRealPerformanceAnalytics({ fetchedAt: '2026-07-10', source: 'manual_publish' })).toBe(false)
  })

  it('accepts measured zero values as real evidence', () => {
    expect(hasRealPerformanceAnalytics({ impressions: 0 })).toBe(true)
    expect(hasRealPerformanceAnalytics({ engagementRate: 0 })).toBe(true)
  })

  it('accepts finite numeric strings from platform payloads', () => {
    expect(numberFromPerformanceMetric('0')).toBe(0)
    expect(hasRealPerformanceAnalytics({ clicks: '12' })).toBe(true)
  })

  it('rejects invalid or unrelated metric values', () => {
    expect(hasRealPerformanceAnalytics({ likes: 'unknown' })).toBe(false)
    expect(hasRealPerformanceAnalytics({ impressions: Number.NaN })).toBe(false)
    expect(hasRealPerformanceAnalytics({ status: 'PUBLISHED' })).toBe(false)
  })
})

