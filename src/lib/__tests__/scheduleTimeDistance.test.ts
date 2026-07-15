import { describe, expect, it } from 'vitest'
import { formatScheduledTimeDistance } from '@/lib/scheduleTimeDistance'

const now = Date.parse('2026-07-15T12:00:00.000Z')

describe('formatScheduledTimeDistance', () => {
  it('keeps multi-day schedules precise instead of collapsing them to one day', () => {
    expect(formatScheduledTimeDistance('2026-07-25T14:00:00.000Z', 'ar', now)).toBe('بعد ١٠ أيام وساعتان')
    expect(formatScheduledTimeDistance('2026-07-25T14:00:00.000Z', 'en', now)).toBe('in 10d 2h')
  })

  it('formats hours and minutes in natural Arabic order', () => {
    expect(formatScheduledTimeDistance('2026-07-16T10:11:00.000Z', 'ar', now)).toBe('بعد ٢٢ ساعة و١١ دقيقة')
  })

  it('does not disguise an overdue post as now', () => {
    expect(formatScheduledTimeDistance('2026-07-15T09:30:00.000Z', 'ar', now)).toBe('متأخر منذ ساعتان و٣٠ دقيقة')
    expect(formatScheduledTimeDistance('2026-07-15T09:30:00.000Z', 'en', now)).toBe('2h 30m overdue')
  })
})
