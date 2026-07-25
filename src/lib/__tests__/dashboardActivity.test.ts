import { describe, expect, it } from 'vitest'
import {
  getDashboardActivityPresentation,
  getDashboardRelativeTimeAr,
} from '@/lib/dashboardActivity'

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

  it.each([
    [60_000, 'منذ دقيقة'],
    [2 * 60_000, 'منذ دقيقتين'],
    [5 * 60_000, 'منذ 5 دقائق'],
    [60 * 60_000, 'منذ ساعة'],
    [2 * 60 * 60_000, 'منذ ساعتين'],
    [24 * 60 * 60_000, 'منذ يوم'],
    [2 * 24 * 60 * 60_000, 'منذ يومين'],
    [5 * 24 * 60 * 60_000, 'منذ 5 أيام'],
  ])('formats Arabic relative time without digit-one grammar (%s ms)', (elapsed, expected) => {
    const now = new Date('2026-07-25T12:00:00.000Z')
    const date = new Date(now.getTime() - elapsed)
    expect(getDashboardRelativeTimeAr(date, now.getTime())).toBe(expected)
  })
})
