/**
 * PR-C — safety guard for /api/strategy/generate. Verifies invented KPI numbers,
 * budgets, percentages, ROI, multipliers and outcome counts are neutralized
 * (unless user-provided), and that the EN prompt has no hard-coded Arabic schema
 * hints and carries the conservative paid + no-invented-numbers instructions.
 */
import { describe, it, expect } from 'vitest'
import {
  extractAllowedNumbers,
  scrubStrategyText,
  guardGeneratedStrategy,
  buildStrategyPrompt,
} from '@/lib/ai/strategyGenerateGuard'

describe('scrubStrategyText (PR-C)', () => {
  it('neutralizes invented percentages', () => {
    expect(scrubStrategyText('Increase leads by 30%')).not.toMatch(/30\s*%/)
  })
  it('neutralizes invented currency / budgets', () => {
    expect(scrubStrategyText('Spend $5,000 on ads')).not.toMatch(/\$\s*5/)
    expect(scrubStrategyText('Budget of SAR 3,000')).not.toMatch(/SAR\s*3/)
  })
  it('neutralizes ROAS/CPL-family numbers', () => {
    expect(scrubStrategyText('Target 4.0 ROAS and CPL $12')).not.toMatch(/4\.0\s*ROAS/i)
  })
  it('neutralizes multiplier ROI ("4x") and outcome counts ("100 leads")', () => {
    expect(scrubStrategyText('Achieve 4x ROI')).not.toMatch(/4\s*x/i)
    expect(scrubStrategyText('Generate 100 leads')).not.toMatch(/100\s*leads/i)
    expect(scrubStrategyText('Close 50 sales this month')).not.toMatch(/50\s*sales/i)
  })
  it('keeps user-provided numbers (allowlist)', () => {
    expect(scrubStrategyText('Work within your $1,000 budget', ['$1,000'])).toMatch(/\$1,000/)
  })
  it('leaves structural numbers untouched (week 1, 3 times per week, 30 days)', () => {
    const t = 'In week 1, post 3 times per week over 30 days'
    expect(scrubStrategyText(t)).toBe(t)
  })
  it('non-string input returns empty string safely', () => {
    expect(scrubStrategyText(null)).toBe('')
    expect(scrubStrategyText(42)).toBe('')
  })
})

describe('guardGeneratedStrategy (PR-C)', () => {
  const dirty = {
    summary: 'Grow leads by 40% and hit 5x ROI.',
    kpis: [
      { metric: 'Leads', target: 'Generate 100 leads', how: 'Increase conversion rate to 8%' },
      { metric: 'Awareness', target: 'Reach 50,000 people', how: 'Track reach' },
    ],
    pillars: [{ name: 'Education', description: 'Teach value, lift sales 25%', percentage: 30, examples: ['Tip with 12% boost'] }],
    quickWins: ['Post a reel', 'Drive 200 signups today'],
    budget: { organic: 'Use free tools', paid: 'Spend $5,000 on Meta ads now', tools: ['Canva'] },
  }

  it('neutralizes invented KPI targets (no numbers survive without allowlist)', () => {
    const g: any = guardGeneratedStrategy(dirty, [])
    expect(g.kpis[0].target).not.toMatch(/100\s*leads/i)
    expect(g.kpis[0].how).not.toMatch(/8\s*%/)
    expect(g.summary).not.toMatch(/40\s*%/)
    expect(g.summary).not.toMatch(/5\s*x/i)
  })
  it('neutralizes invented paid budget', () => {
    const g: any = guardGeneratedStrategy(dirty, [])
    expect(g.budget.paid).not.toMatch(/\$\s*5/)
  })
  it('scrubs invented numbers inside pillars & quickWins', () => {
    const g: any = guardGeneratedStrategy(dirty, [])
    expect(g.pillars[0].description).not.toMatch(/25\s*%/)
    expect(JSON.stringify(g.quickWins)).not.toMatch(/200\s*signups/i)
  })
  it('keeps the pillar weight `percentage` structural number intact', () => {
    const g: any = guardGeneratedStrategy(dirty, [])
    expect(g.pillars[0].percentage).toBe(30)
  })
  it('adds a conservative paidSafety block (no spend without approval, readiness needs verification)', () => {
    const g: any = guardGeneratedStrategy(dirty, [])
    expect(g.paidSafety.spend).toBe('requires_explicit_approval')
    expect(g.paidSafety.platformReadiness).toBe('needs_verification')
    expect(g.paidSafety.budget).toBe('requires_confirmation')
    expect(g.paidSafety.note).toMatch(/no spend without explicit approval/i)
  })
  it('uses the user-provided budget in paidSafety when given', () => {
    const g: any = guardGeneratedStrategy(dirty, extractAllowedNumbers('1500'))
    expect(g.paidSafety.budget).toBe('1500')
  })
  it('never throws on malformed input', () => {
    expect(() => guardGeneratedStrategy(null as never)).not.toThrow()
    expect(() => guardGeneratedStrategy({ kpis: 'nope' } as never)).not.toThrow()
  })
})

describe('buildStrategyPrompt (PR-C)', () => {
  const base = { days: 30, weeks: 4, goal: 'leads', langInstruction: 'Respond in English.' }

  it('has NO hard-coded Arabic schema field hints', () => {
    const p = buildStrategyPrompt(base)
    // The old prompt hard-coded Arabic title/summary hints; they must be gone.
    expect(p).not.toMatch(/عنوان استراتيجي/)
    expect(p).not.toMatch(/ملخص تنفيذي/)
    expect(p).not.toMatch(/بالعربية/)
  })
  it('no longer asks for a "Specific target" KPI number', () => {
    expect(buildStrategyPrompt(base)).not.toMatch(/Specific target/)
  })
  it('instructs qualitative KPIs and forbids invented numbers', () => {
    const p = buildStrategyPrompt(base)
    expect(p).toMatch(/do not invent/i)
    expect(p).toMatch(/qualitative/i)
  })
  it('paid wording is planning-only with no spend without approval', () => {
    const p = buildStrategyPrompt(base)
    expect(p).toMatch(/planning only/i)
    expect(p).toMatch(/no (?:ad )?spend without explicit approval/i)
    expect(p).toMatch(/needs verification/i)
  })
  it('language is driven by langInstruction (AR instruction is included verbatim)', () => {
    const p = buildStrategyPrompt({ ...base, langInstruction: 'الرجاء الرد بالعربية.' })
    expect(p).toContain('الرجاء الرد بالعربية.')
  })
})
