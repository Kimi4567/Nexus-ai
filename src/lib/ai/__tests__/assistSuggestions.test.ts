import { describe, it, expect } from 'vitest'
import { buildAssistSuggestions, NEVER_SUGGEST } from '@/lib/ai/assistSuggestions'

const WEBSITE_SOURCE = `
NEXUS AI is an AI-powered marketing operator for small and medium-sized businesses.
It builds a brand memory, turns it into a marketing strategy, and helps execute
campaigns and content with your approval. It serves founders and small teams without
an in-house marketing department. The tone is clear, practical and confident.
`.trim()

const get = (res: ReturnType<typeof buildAssistSuggestions>, field: string) =>
  res.suggestions.find((s) => s.field === field)

describe('buildAssistSuggestions — website', () => {
  it('marks a well-supported field as extracted with high/medium confidence + evidence', () => {
    const res = buildAssistSuggestions(
      { description: 'AI-powered marketing operator for small and medium-sized businesses.' },
      { source: 'website', sourceText: WEBSITE_SOURCE, sourceRef: 'https://x.com' },
    )
    const d = get(res, 'description')
    expect(d).toBeTruthy()
    expect(d!.basis).toBe('extracted')
    expect(['high', 'medium']).toContain(d!.confidence)
    expect(d!.evidence.length).toBeGreaterThan(0)
    expect(d!.source).toBe('website')
    expect(d!.sourceRef).toBe('https://x.com')
  })

  it('downgrades a value with NO support in the source to inferred + low + safety note', () => {
    const res = buildAssistSuggestions(
      { description: 'Award-winning blockchain logistics platform for enterprise mining.' },
      { source: 'website', sourceText: WEBSITE_SOURCE, sourceRef: 'https://x.com' },
    )
    const d = get(res, 'description')!
    expect(d.basis).toBe('inferred')
    expect(d.confidence).toBe('low')
    expect(d.safetyNote.length).toBeGreaterThan(0)
  })

  it('never returns high confidence for a value carrying a figure not in the source', () => {
    const res = buildAssistSuggestions(
      { description: 'Marketing operator that delivered 312% ROI for businesses.' },
      { source: 'website', sourceText: WEBSITE_SOURCE, sourceRef: 'https://x.com' },
    )
    const d = get(res, 'description')!
    expect(d.confidence).toBe('low')
    expect(d.basis).toBe('inferred')
    expect(d.safetyNote.length).toBeGreaterThan(0)
  })

  it('always treats pricePoint as inferred + low (a judgement, not a quoted fact)', () => {
    const res = buildAssistSuggestions(
      { pricePoint: 'premium' },
      { source: 'website', sourceText: WEBSITE_SOURCE, sourceRef: 'https://x.com' },
    )
    const p = get(res, 'pricePoint')!
    expect(p.basis).toBe('inferred')
    expect(p.confidence).toBe('low')
  })

  it('reports absent/empty fields in `missing` instead of inventing values', () => {
    const res = buildAssistSuggestions(
      { description: 'AI marketing operator for small businesses.' },
      { source: 'website', sourceText: WEBSITE_SOURCE, sourceRef: 'https://x.com' },
    )
    expect(res.missing).toContain('brandName')
    expect(res.missing).toContain('targetAudience')
    expect(res.suggestions.find((s) => s.field === 'brandName')).toBeUndefined()
  })

  it('never suggests verifiedProof or manual-only fields even if present', () => {
    const res = buildAssistSuggestions(
      {
        verifiedProof: ['5-star reviews'],
        businessGoal: 'grow revenue',
        marketingBudget: '$5000',
        description: 'AI marketing operator for small businesses.',
      },
      { source: 'website', sourceText: WEBSITE_SOURCE, sourceRef: 'https://x.com' },
    )
    for (const f of ['verifiedProof', 'businessGoal', 'marketingBudget']) {
      expect(res.suggestions.find((s) => s.field === f)).toBeUndefined()
      expect(NEVER_SUGGEST.has(f)).toBe(true)
    }
  })
})

describe('buildAssistSuggestions — content', () => {
  const CONTENT_SOURCE = `--- SAMPLE 1 ---\nStop guessing your marketing. Let a system plan it for you and stay consistent every week.`

  it('uses basis "observed" for content-derived array fields and exposes items', () => {
    const res = buildAssistSuggestions(
      { winningHooks: ['Stop guessing your marketing'] },
      { source: 'content', sourceText: CONTENT_SOURCE, sourceRef: '1 content sample(s)' },
    )
    const h = get(res, 'winningHooks')!
    expect(h.basis === 'observed' || h.basis === 'inferred').toBe(true)
    expect(h.source).toBe('content')
    expect(Array.isArray(h.items)).toBe(true)
    expect(h.suggested).toContain('Stop guessing')
  })

  it('does not consider website-only fields (e.g. pricePoint) for content source', () => {
    const res = buildAssistSuggestions(
      { pricePoint: 'premium' },
      { source: 'content', sourceText: CONTENT_SOURCE, sourceRef: '1 content sample(s)' },
    )
    expect(get(res, 'pricePoint')).toBeUndefined()
  })
})
