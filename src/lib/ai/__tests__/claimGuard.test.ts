/**
 * PR-1K — unsupported-claim guard. Deterministic detector for invented metrics,
 * guarantees, social proof, awards, and unconfirmed platform status. Conservative:
 * soft capability language must stay allowed; hard unsourced claims must be flagged.
 */
import { describe, it, expect } from 'vitest'
import { detectUnsupportedClaims, buildClaimFixes, buildClaimWarnings, getPostClaimRisk } from '@/lib/ai/claimGuard'

const cats = (text: string) =>
  detectUnsupportedClaims(text).findings.map(f => f.category)

describe('detectUnsupportedClaims (PR-1K)', () => {
  it('detects Arabic guarantee, health-outcome, and unsupported superiority claims', () => {
    const result = detectUnsupportedClaims([
      'خطط علاج واضحة تضمن لك راحة البال.',
      'الفحوصات المنتظمة تحميك من مشاكل الأسنان الكبيرة.',
      'Instagram هو المنصة الأكثر فعالية للوصول إلى الجمهور.',
    ])

    expect(result.hasUnsupportedClaims).toBe(true)
    expect(result.findings.map(f => f.category)).toEqual(expect.arrayContaining(['guarantee', 'award']))
  })

  it('does not confuse Arabic inclusion wording with a guarantee', () => {
    const result = detectUnsupportedClaims([
      'راجع ما يتضمنه العرض.',
      'يقارن بين البدائل ويحتاج فهم ما يتضمنه العرض وما لا يتضمنه.',
    ])

    expect(result.hasUnsupportedClaims).toBe(false)
    expect(result.findings).toEqual([])
    expect(cats('هذه الخطة تضمن لك نتائج أفضل')).toContain('guarantee')
    expect(cats('نضمن لك خدمات عالية الجودة')).toContain('guarantee')
    expect(cats('أضمن لك النجاح')).toContain('guarantee')
  })

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

  it('does not flag explicit safety instructions that reject guarantee language', () => {
    const result = detectUnsupportedClaims([
      'Do not promise guaranteed results.',
      'Make the next step clear without implying guaranteed outcomes.',
      'Avoid proven results unless evidence is on file.',
      'We cannot guarantee an outcome.',
      'لا تستخدم نتائج مضمونة بدون دليل.',
      'لا نضمن النتائج.',
      'لن نضمن لك نتيجة.',
    ])

    expect(result.hasUnsupportedClaims).toBe(false)
    expect(result.findings).toEqual([])
  })

  it('still flags guarantee copy when a nearby no does not negate the claim', () => {
    const result = detectUnsupportedClaims('No risk — guaranteed results for every customer.')

    expect(result.hasUnsupportedClaims).toBe(true)
    expect(result.findings.some((finding) => finding.category === 'guarantee')).toBe(true)
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

  it('returns contextual Arabic warnings and actionable fixes', () => {
    const result = detectUnsupportedClaims('هذه الخطة تضمن لك نتائج أفضل.')
    const warnings = buildClaimWarnings(result, 'ar')
    const fixes = buildClaimFixes(result, 'ar')

    expect(warnings[0]).toContain('ادعاء غير مدعوم')
    expect(warnings[0]).toContain('هذه الخطة تضمن لك نتائج أفضل')
    expect(fixes[0]).toContain('تهدف إلى')
  })
})

describe('getPostClaimRisk (PR-1K.1 — scheduled-post warning view-model)', () => {
  it('flags a scheduled post caption with "30% productivity gain"', () => {
    const r = getPostClaimRisk({ caption: "Boost your startup's productivity by 30%!" })
    expect(r.hasUnsupportedClaims).toBe(true)
    expect(r.categories).toContain('percentage')
  })

  it('flags a performance claim ("boost sales") in a caption', () => {
    const r = getPostClaimRisk({ caption: 'We boost sales for SMEs' })
    expect(r.hasUnsupportedClaims).toBe(true)
    expect(r.categories).toContain('performance')
  })

  it('flags "Increase sales by 25%"', () => {
    expect(getPostClaimRisk({ caption: 'Increase sales by 25% this month' }).hasUnsupportedClaims).toBe(true)
  })

  it('flags "Trusted by thousands"', () => {
    const r = getPostClaimRisk({ caption: 'Trusted by thousands of customers' })
    expect(r.hasUnsupportedClaims).toBe(true)
    expect(r.categories).toContain('socialProof')
  })

  it('does NOT flag a safe post ("Designed to help teams save time")', () => {
    const r = getPostClaimRisk({ caption: 'Designed to help teams save time' })
    expect(r.hasUnsupportedClaims).toBe(false)
    expect(r.categories).toEqual([])
  })

  it('scans hook/cta/title fields too, not just caption', () => {
    expect(getPostClaimRisk({ caption: 'A friendly intro', hook: 'Guaranteed results' }).hasUnsupportedClaims).toBe(true)
    expect(getPostClaimRisk({ cta: 'Join thousands of users' }).hasUnsupportedClaims).toBe(true)
  })

  it('empty / missing post text returns no warning', () => {
    expect(getPostClaimRisk({}).hasUnsupportedClaims).toBe(false)
    expect(getPostClaimRisk(null).hasUnsupportedClaims).toBe(false)
    expect(getPostClaimRisk({ caption: '', hook: null }).hasUnsupportedClaims).toBe(false)
  })

  it('returns only display-only metadata (no text/data mutation surface)', () => {
    const r = getPostClaimRisk({ caption: '30% off productivity gains guaranteed' })
    expect(Object.keys(r).sort()).toEqual(['categories', 'hasUnsupportedClaims'])
    expect(Array.isArray(r.categories)).toBe(true)
  })
})
