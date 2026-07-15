import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('live Brand Brain truth gates across user-facing workspaces', () => {
  it('holds approval-center suggestions and routes the user to the source', () => {
    const approvals = source('src/app/approvals/page.tsx')
    expect(approvals).toContain('reviewBrandTruthConsistency')
    expect(approvals).toContain('القرارات المشتقة محجوبة حتى تصحيح Brand Brain')
    expect(approvals).toContain("suggestion.type !== 'CAMPAIGN_PAUSE'")
    expect(approvals).toContain('href="/brand"')
  })

  it('holds global Content Hub records instead of presenting stale drafts as reviewable', () => {
    const contentHub = source('src/app/content-hub/page.tsx')
    expect(contentHub).toContain('reviewBrandTruthConsistency')
    expect(contentHub).toContain('const contentTruthBlocked = brandTruthState !== \'passed\'')
    expect(contentHub).toContain('مسودة قديمة — مرجع فقط حتى تصحيح Brand Brain')
    expect(contentHub).toContain('لن يُخصم كريديت حتى تصحيح مصدر الحقيقة')
  })

  it('invalidates persisted campaign approval labels when live brand truth is blocked', () => {
    const campaigns = source('src/app/campaigns/page.tsx')
    expect(campaigns).toContain('reviewBrandTruthConsistency')
    expect(campaigns).toContain('محجوبة — مرجع فقط')
    expect(campaigns).toContain('older approval record is blocked until Brand Brain is fixed')
  })

  it('collapses an invalid strategy document by default', () => {
    const strategy = source('src/app/strategy/page.tsx')
    expect(strategy).toContain('showReferenceStrategy')
    expect(strategy).toContain('تفاصيل الاستراتيجية القديمة مطوية')
    expect(strategy).toContain('(!brandTruthBlocked || showReferenceStrategy)')
  })

  it('hides derived creative previews while preserving raw brand assets', () => {
    const studio = source('src/app/studio/page.tsx')
    expect(studio).toContain('reviewBrandTruthConsistency')
    expect(studio).toContain('الاتجاه الإبداعي المشتق محجوب')
    expect(studio).toContain('{!brandTruthBlocked && (<>')
    expect(studio).toContain('Raw brand assets remain visible')
  })

  it('keeps the calendar as a record while blocking stale scheduling actions', () => {
    const calendar = source('src/app/calendar/page.tsx')
    expect(calendar).toContain('reviewBrandTruthConsistency')
    expect(calendar).toContain('الجدولة محجوبة حتى تصحيح مصدر الحقيقة')
    expect(calendar).toContain('مراجع خطة محجوبة')
    expect(calendar).toContain('!calendarTruthBlocked && !loadingQueue')
  })

  it('removes downstream campaign actions while a live Brand Brain conflict exists', () => {
    const campaign = source('src/app/campaigns/[id]/page.tsx')
    expect(campaign).toContain('سجلات محتوى قديمة محجوبة')
    expect(campaign).toContain('المخرجات السابقة محفوظة كمرجع فقط')
    expect(campaign).toContain("uiText('مخرجات مرجعية محجوبة', 'Blocked reference outputs')")
    expect(campaign).toContain("href={brandTruthBlocked ? '/brand' : '/campaigns/new'}")
    expect(campaign).toContain("!brandTruthBlocked && !engineRunning && operatingState.stage === 'strategy_review_needed'")
    expect(campaign).toContain('إعادة البناء المدفوعة مقفلة حتى تصحيح Brand Brain')
  })
})
