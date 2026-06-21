import { describe, expect, it } from 'vitest'
import { buildOnboardingStrategicNotes } from '@/lib/onboardingContinuity'

const statuses = [
  { value: 'not_started', ar: 'لم أبدأ بعد', en: 'Not started yet' },
  { value: 'regular', ar: 'أنشر بانتظام', en: 'Posting regularly' },
]

describe('buildOnboardingStrategicNotes', () => {
  it('stores first intent and marketing status as English Brand Brain memory', () => {
    expect(buildOnboardingStrategicNotes({
      firstIntent: 'build_strategy',
      marketingStatus: 'not_started',
      marketingStatusOptions: statuses,
      locale: 'en',
    })).toBe([
      'First requested help from NEXUS: Build a marketing strategy',
      'Current marketing status: Not started yet',
    ].join('\n'))
  })

  it('stores first intent and marketing status as Arabic Brand Brain memory', () => {
    expect(buildOnboardingStrategicNotes({
      firstIntent: 'prepare_paid_plan',
      marketingStatus: 'regular',
      marketingStatusOptions: statuses,
      locale: 'ar',
    })).toBe([
      'أول مساعدة مطلوبة من NEXUS: تجهيز خطة إعلانات مدفوعة',
      'الوضع التسويقي الحالي: أنشر بانتظام',
    ].join('\n'))
  })

  it('returns null when there is no known continuity signal', () => {
    expect(buildOnboardingStrategicNotes({
      firstIntent: '',
      marketingStatus: '',
      marketingStatusOptions: statuses,
      locale: 'en',
    })).toBeNull()
  })
})
