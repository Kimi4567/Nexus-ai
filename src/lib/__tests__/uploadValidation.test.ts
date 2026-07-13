import { describe, expect, it } from 'vitest'
import { normalizeMediaMetric, validateVideoDuration } from '@/lib/uploadValidation'

describe('upload media metadata validation', () => {
  it('stores duration conservatively as whole seconds', () => {
    expect(normalizeMediaMetric(12.01, 'duration')).toBe(13)
    expect(normalizeMediaMetric(12, 'duration')).toBe(12)
  })

  it('rejects missing, invalid, and over-limit duration', () => {
    expect(validateVideoDuration(undefined).valid).toBe(false)
    expect(validateVideoDuration(Number.NaN).valid).toBe(false)
    expect(validateVideoDuration(300).valid).toBe(true)
    expect(validateVideoDuration(300.01)).toMatchObject({ valid: false, duration: 301 })
  })

  it('normalizes valid dimensions and rejects invalid values', () => {
    expect(normalizeMediaMetric(1199.6, 'dimension')).toBe(1200)
    expect(normalizeMediaMetric('630', 'dimension')).toBe(630)
    expect(normalizeMediaMetric(0, 'dimension')).toBeNull()
    expect(normalizeMediaMetric('not-a-number', 'dimension')).toBeNull()
  })
})
