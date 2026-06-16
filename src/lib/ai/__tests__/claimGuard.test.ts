/**
 * PR-1K — unsupported-claim guard. Deterministic detector for invented metrics,
 * guarantees, social proof, awards, and unconfirmed platform status. Conservative:
 * soft capability language must stay allowed; hard unsourced claims must be flagged.
 */
import { describe, it, expect } from 'vitest'
import { detectUnsupportedClaims, buildClaimWarnings } from '@/lib/ai/claimGuard'

const cats = (text: string) =>
  detectUnsupportedClaims(text).findings.map(f => f.category)

describe('detectUnsupportedClaims (PR-1K)', () => {
  it('flags an unsupported percentage claim ("30% productivity gain")', () => {
    const r = detectUnsupportedClaims('30% productivity gain')
    expect(r.hasUnsupportedClaims).toBe(true)
    expect(cats('30% productivity gain')).toContain('percentage')
  })

  it('flags "Increase sales by 25%" (percentage + performance)', () => {
    const c = cats('Increase sales by 25% this quarter')
    expect(c).toContain('percentage')
    expect(c).toContain('performance')
  })

  it('flags an unsupported multiplier ("10x faster")', () => {
    expect(cats('Our tool is 10x faster')).toContain('multiplier')
    expect(cats('Get 3 times faster results')).toContain('multiplier')
  })

  it('flags unsourced social proof ("Trusted by thousands of customers")', () => {
    expect(detectUnsupportedClaims('Trusted by thousands of customers').hasUnsupportedClaims).toBe(true)
    expect(cats('Trusted by thousands of customers')).toContain('socialProof')
  })

  it('flags a guarantee ("Guaranteed results")', () => {
    expect(cats('Guaranteed results in 30 days')).toContain('guarantee')
    expect(cats('Proven results for every client')).toContain('guarantee')
  })

  it('flags award / ranking superlatives ("#1", "award-winning")', () => {
    expect(cats('The #1 platform for founders')).toContain('award')
    expect(cats('Our award-winning service')).toContain('award')
  })

  it('flags unconfirmed platform status ("ads are running", "campaign is live")', () => {
    expect(cats('Your ads are running now')).toContain('platformStatus')
    expect(cats('Your campaign is live')).toContain('platformStatus')
  })

  it('flags hard performance verbs ("boost sales", "cut costs")', () => {
    expect(cats('We boost sales for SMEs')).toContain('performance')
    expect(cats('Cut costs across your team')).toContain('performance')
  })

  // ── Safe soft claims must NOT be flagged ──────────────────────────────────────
  it('allows "Designed to help teams save time"', () => {
    const r = detectUnsupportedClaims('Designed to help teams save time')
    expect(r.hasUnsupportedClaims).toBe(false)
    expect(r.findings).toEqual([])
  })

  it('allows "Can help improve your workflow"', () => {
    expect(detectUnsupportedClaims('Can help improve your workflow').hasUnsupportedClaims).toBe(false)
  })

  it('allows soft capability phrases (may improve / built for / aims to reduce)', () => {
    for (const safe of [
      'A tool built for busy founders',
      'It may improve how your team plans content',
      'Aims to reduce manual work',
      'Intended to support small marketing teams',
    ]) {
      expect(detectUnsupportedClaims(safe).hasUnsupportedClaims).toBe(false)
    }
  })

  it('mixed copy: flags only the risky sentence, not the safe one', () => {
    const r = detectUnsupportedClaims([
      'Designed to help teams save time.',
      'Guaranteed to increase revenue by 40%.',
    ])
    expect(r.hasUnsupportedClaims).toBe(true)
    // the safe sentence contributes nothing; risky one yields multiple findings
    const matches = r.findings.map(f => f.match.toLowerCase())
    expect(matches.some(m => m.includes('40%'))).toBe(true)
    expect(r.findings.every(f => f.excerpt.toLowerCase().includes('save time') === false)).toBe(true)
  })

  it('accepts arrays and ignores null/empty entries without crashing', () => {
    const r = detectUnsupportedClaims(['Trusted by thousands of users', null, '', undefined as never])
    expect(r.hasUnsupportedClaims).toBe(true)
    expect(detectUnsupportedClaims(null).hasUnsupportedClaims).toBe(false)
    expect(detectUnsupportedClaims([]).findings).toEqual([])
  })

  it('buildClaimWarnings explains WHY each claim was flagged (needs evidence)', () => {
    const r = detectUnsupportedClaims('30% productivity gain, guaranteed results')
    const warnings = buildClaimWarnings(r)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.every(w => /needs evidence/i.test(w))).toBe(true)
    expect(warnings.some(w => w.includes('30%'))).toBe(true)
  })
})
