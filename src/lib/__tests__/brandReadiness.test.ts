/**
 * PR-1I — Brand Brain readiness MESSAGING (one source of truth).
 * The copy must never imply all agents fully know the brand, even when the real
 * maturity status is 'active'. Active means a core profile is available as
 * generation context; it is not analytics-backed learning or a blanket readiness
 * claim.
 */
import { describe, it, expect } from 'vitest'
import { getBrandReadinessCopy } from '@/lib/brandReadiness'

describe('getBrandReadinessCopy (PR-1I — one readiness truth)', () => {
  it('active → isComplete but still avoids all-agents-know or broad ready claims', () => {
    const en = getBrandReadinessCopy('active', 'en', 'Acme')
    expect(en.isComplete).toBe(true)
    expect(en.summary).toBe("Acme's core profile is available — NEXUS uses it as context for strategy and content generation")
    expect(en.summary).not.toMatch(/\bis ready\b/i)
    expect(en.summary).not.toContain('all agents know your brand')
    expect(en.label).toBe('Core profile available')

    const ar = getBrandReadinessCopy('active', 'ar', 'أكمي')
    expect(ar.isComplete).toBe(true)
    expect(ar.summary).toContain('ملف أكمي الأساسي متاح')
    expect(ar.summary).not.toContain('الوكلاء يعرفون علامتك التجارية')
    expect(ar.label).toBe('ملف أساسي متاح')
  })

  it('active without a brand name still avoids a dangling name', () => {
    const en = getBrandReadinessCopy('active', 'en')
    expect(en.summary).toBe('Brand Brain core profile is available — NEXUS uses it as context for strategy and content generation')
    expect(en.summary).not.toContain('undefined')
    expect(en.summary).not.toContain('all agents know your brand')
  })

  it('building → partial copy, NOT "ready", NOT "all agents know your brand"', () => {
    const en = getBrandReadinessCopy('building', 'en', 'Acme')
    expect(en.isComplete).toBe(false)
    expect(en.summary).toContain('core context')
    expect(en.summary).toContain('reviewed signals')
    expect(en.summary).not.toContain('complete your profile')
    expect(en.summary).not.toMatch(/\bis ready\b/)
    expect(en.summary).not.toContain('all agents know your brand')

    const ar = getBrandReadinessCopy('building', 'ar')
    expect(ar.isComplete).toBe(false)
    expect(ar.summary).toContain('سياق أساسي')
    expect(ar.summary).toContain('إشارات مراجَعة')
  })

  it('needs_data → needs-more-information copy, never "ready"', () => {
    const en = getBrandReadinessCopy('needs_data', 'en')
    expect(en.isComplete).toBe(false)
    expect(en.summary).toContain('still early')
    expect(en.summary).toContain('proof')
    expect(en.summary).toContain('reviewed signals')
    expect(en.summary).not.toContain('complete your brand profile')
    expect(en.summary).not.toContain('needs more core context')
    expect(en.summary).not.toContain('sharper AI output')
    expect(en.summary).not.toMatch(/\bready\b/)
    expect(en.label).toBe('Needs Data')
  })

  it('null/undefined status is treated as needs_data, never complete', () => {
    expect(getBrandReadinessCopy(null, 'en').isComplete).toBe(false)
    expect(getBrandReadinessCopy(undefined, 'en').status).toBe('needs_data')
  })

  it('only the active status is ever isComplete (no partial state claims ready)', () => {
    expect(getBrandReadinessCopy('needs_data', 'en').isComplete).toBe(false)
    expect(getBrandReadinessCopy('building', 'en').isComplete).toBe(false)
    expect(getBrandReadinessCopy('active', 'en').isComplete).toBe(true)
  })

  it('defaults to Arabic when no locale is given (matches app default)', () => {
    expect(getBrandReadinessCopy('building').summary).toContain('سياق أساسي')
  })
})
