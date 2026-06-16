import { describe, it, expect } from 'vitest'
import { guardBrandText, guardBrandList, guardExtracted } from '../brandTruthGuard'

describe('brandTruthGuard — metrics (case A)', () => {
  it('scrubs invented percentage / efficiency claims', () => {
    const out = guardBrandText('Achieve a 30% increase in productivity')
    expect(out).not.toMatch(/30\s*%/)
    expect(out.toLowerCase()).not.toContain('30%')
  })

  it('scrubs invented ROAS/ROI and currency figures', () => {
    expect(guardBrandText('Expect a 3.2 ROAS on every campaign')).not.toMatch(/3\.2/)
    expect(guardBrandText('Customers spend $5,000 on average')).not.toContain('$5,000')
  })

  it('downgrades "efficiency gain" / "productivity gain" wording without numbers', () => {
    const out = guardBrandText('Customers see efficiency gains every week')
    expect(out.toLowerCase()).toContain('improved efficiency')
    expect(out.toLowerCase()).not.toContain('efficiency gain')
  })
})

describe('brandTruthGuard — social proof (case B)', () => {
  it('downgrades testimonials / case studies / customer success stories', () => {
    const angles = guardBrandList([
      'Testimonials from founders highlighting growth',
      'Case studies showing significant growth',
      'Customer success stories that prove results',
    ])
    const joined = angles.join(' | ').toLowerCase()
    expect(joined).not.toContain('case studies showing')
    expect(joined).not.toMatch(/\btestimonials from\b/)
    expect(joined).toContain('to validate')
    // "proven results" / "significant growth" must not survive as fact
    expect(joined).not.toContain('significant growth')
    expect(joined).not.toContain('prove results')
  })

  it('downgrades "customers achieved / clients experienced" assertions', () => {
    const out = guardBrandText('Our customers achieved significant growth post-launch')
    expect(out.toLowerCase()).toContain('customers may experience')
    expect(out.toLowerCase()).not.toContain('significant growth')
  })
})

describe('brandTruthGuard — automation / readiness (case E)', () => {
  it('downgrades automatic publishing and live ads claims', () => {
    expect(guardBrandText('Nexus publishes automatically to all channels').toLowerCase())
      .toContain('approval-gated publishing')
    expect(guardBrandText('Your ads are running 24/7').toLowerCase())
      .toContain('not live until approved')
    expect(guardBrandText('A fully automated marketing agency replacement').toLowerCase())
      .not.toContain('fully automated')
  })
})

describe('brandTruthGuard — user-provided preservation (case D)', () => {
  it('keeps a figure the user actually supplied', () => {
    const allowed = ['We guarantee a 30% discount on the first order']
    const out = guardBrandText('Promote the 30% discount the brand offers', allowed)
    expect(out).toContain('30%')
  })

  it('still scrubs a different invented number even when another is allowed', () => {
    const allowed = ['Our price is $500/month']
    const out = guardBrandText('Save $5,000 and get $500/month value', allowed)
    expect(out).toContain('$500')
    expect(out).not.toContain('$5,000')
  })
})

describe('brandTruthGuard — extracted object (case C) + safety of normal text', () => {
  it('guards string and string[] fields, passes through non-strings', () => {
    const res = guardExtracted({
      description: 'Proven results with 50% more leads',
      winningHooks: ['Boost sales by 40%', 'Stop wasting time on manual work'],
      pagesScanned: 3,
      competitors: [],
    })
    expect(String(res.description)).not.toContain('50%')
    expect(String(res.description).toLowerCase()).not.toContain('proven results')
    expect((res.winningHooks as string[])[0]).not.toContain('40%')
    expect((res.winningHooks as string[])[1]).toBe('Stop wasting time on manual work') // safe text untouched
    expect(res.pagesScanned).toBe(3)
    expect(res.competitors).toEqual([])
  })

  it('leaves clean, claim-free copy unchanged', () => {
    const clean = 'Marketing that runs like you finally hired a team.'
    expect(guardBrandText(clean)).toBe(clean)
  })

  it('handles empty / non-string input safely', () => {
    expect(guardBrandText('')).toBe('')
    expect(guardBrandList(null)).toEqual([])
    expect(guardExtracted(null)).toEqual({})
  })
})
