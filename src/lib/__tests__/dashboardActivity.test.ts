import { describe, expect, it } from 'vitest'
import { getDashboardActivityPresentation } from '@/lib/dashboardActivity'

describe('dashboard activity presentation', () => {
  it('localizes campaign engine activity without leaking its English description into Arabic UI', () => {
    expect(getDashboardActivityPresentation(
      'engine_run',
      'NEXUS Engine prepared campaign package (43% ready)',
    )).toEqual({
      actionAr: 'أعدّ محرك NEXUS حزمة الحملة',
      actionEn: 'NEXUS Engine prepared the campaign package',
      agent: 'NEX',
    })
  })

  it('uses a truthful generic Arabic label for unknown legacy activity types', () => {
    expect(getDashboardActivityPresentation('legacy_action', 'Legacy English detail')).toEqual({
      actionAr: 'تم تسجيل إجراء جديد على الحملة',
      actionEn: 'Legacy English detail',
      agent: 'NEX',
    })
  })
})
