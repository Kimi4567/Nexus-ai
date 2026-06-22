import { describe, expect, it } from 'vitest'
import {
  calendarTruthCopy,
  getCalendarMonthTruth,
  getCalendarTruthText,
  isRealCalendarPost,
} from '@/lib/calendarTruth'

describe('calendar truth contract', () => {
  it('does not treat draft campaign or strategy ideas as real scheduled posts', () => {
    const summary = getCalendarMonthTruth([
      { status: 'DRAFT', scheduledAt: '2026-06-10T09:00:00Z', platform: 'META' },
      { status: 'APPROVED', scheduledAt: '2026-06-11T09:00:00Z', platform: 'META' },
      { status: undefined, scheduledAt: '2026-06-12T09:00:00Z', platform: 'Instagram' },
    ], 5, 2026)

    expect(summary.postsThisMonth).toBe(0)
    expect(summary.scheduled).toBe(0)
    expect(summary.published).toBe(0)
    expect(summary.platforms).toBe(0)
  })

  it('counts only SCHEDULED rows as scheduled', () => {
    const summary = getCalendarMonthTruth([
      { status: 'SCHEDULED', scheduledAt: '2026-06-10T09:00:00Z', platform: 'META' },
      { status: 'APPROVED', scheduledAt: '2026-06-11T09:00:00Z', platform: 'META' },
      { status: 'FAILED', scheduledAt: '2026-06-12T09:00:00Z', platform: 'META' },
    ], 5, 2026)

    expect(summary.postsThisMonth).toBe(1)
    expect(summary.scheduled).toBe(1)
    expect(summary.published).toBe(0)
    expect(summary.platforms).toBe(1)
  })

  it('counts only PUBLISHED rows as published', () => {
    const summary = getCalendarMonthTruth([
      { status: 'SCHEDULED', scheduledAt: '2026-06-10T09:00:00Z', platform: 'META' },
      { status: 'PUBLISHED', scheduledAt: '2026-06-11T09:00:00Z', platform: 'Instagram' },
      { status: 'DRAFT', scheduledAt: '2026-06-12T09:00:00Z', platform: 'LinkedIn' },
    ], 5, 2026)

    expect(summary.postsThisMonth).toBe(2)
    expect(summary.scheduled).toBe(1)
    expect(summary.published).toBe(1)
    expect(summary.platforms).toBe(2)
  })

  it('ignores real rows outside the viewed month', () => {
    const summary = getCalendarMonthTruth([
      { status: 'SCHEDULED', scheduledAt: '2026-07-10T09:00:00Z', platform: 'META' },
      { status: 'PUBLISHED', scheduledAt: '2026-06-11T09:00:00Z', platform: 'Instagram' },
    ], 5, 2026)

    expect(summary.postsThisMonth).toBe(1)
    expect(summary.scheduled).toBe(0)
    expect(summary.published).toBe(1)
  })

  it('requires proof fields before a post can be rendered as a real calendar post', () => {
    expect(isRealCalendarPost({ status: 'SCHEDULED' })).toBe(false)
    expect(isRealCalendarPost({ status: 'PUBLISHED' })).toBe(false)
    expect(isRealCalendarPost({ status: 'SCHEDULED', scheduledAt: '2026-06-10T09:00:00Z' })).toBe(true)
    expect(isRealCalendarPost({ status: 'PUBLISHED', scheduledAt: '2026-06-10T09:00:00Z' })).toBe(true)
  })

  it('has professional Arabic copy for the planned vs scheduled distinction', () => {
    expect(getCalendarTruthText('plannedTab', 'ar')).toBe('مخطط ضمن الاستراتيجية')
    expect(getCalendarTruthText('plannedHelper', 'ar')).toBe('هذه أفكار تخطيطية وليست منشورات مجدولة.')
    expect(getCalendarTruthText('scheduledTab', 'ar')).toBe('المنشورات المجدولة')
    expect(getCalendarTruthText('scheduledEmpty', 'ar')).toBe('لا توجد منشورات مجدولة بعد.')
  })

  it('does not describe strategy-planned ideas as scheduled posts', () => {
    expect(calendarTruthCopy.plannedHelper.en).toContain('not scheduled posts')
    expect(calendarTruthCopy.noGeneratedPlan.en).toContain('no generated content plan yet')
    expect(calendarTruthCopy.noGeneratedPlan.en).not.toMatch(/published|live/i)
  })
})
