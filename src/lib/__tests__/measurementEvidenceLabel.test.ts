import { describe, expect, it } from 'vitest'
import { measurementEvidenceLabel } from '@/lib/measurementEvidenceLabel'

describe('measurementEvidenceLabel', () => {
  it('turns internal evidence identifiers into Arabic trust labels', () => {
    expect(measurementEvidenceLabel('CLIENT_REPORTED', 'ar')).toBe('إشارة من المتصفح')
    expect(measurementEvidenceLabel('SERVER_CONFIRMED', 'ar')).toBe('مؤكد من الخادم')
    expect(measurementEvidenceLabel('SERVER_DEDUPLICATED', 'ar')).toBe('منقّح من التكرار')
    expect(measurementEvidenceLabel('MANUAL_CONFIRMED', 'ar')).toBe('مؤكد داخل CRM')
  })

  it('uses readable English and preserves non-state metric helpers', () => {
    expect(measurementEvidenceLabel('CLIENT_REPORTED', 'en')).toBe('Browser-reported')
    expect(measurementEvidenceLabel('SERVER_CONFIRMED', 'en')).toBe('Server-confirmed')
    expect(measurementEvidenceLabel('42%', 'en')).toBe('42%')
    expect(measurementEvidenceLabel('محجوب: التتبع غير مكتمل', 'ar')).toBe('محجوب: التتبع غير مكتمل')
  })
})
