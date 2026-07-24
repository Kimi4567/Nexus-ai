import { describe, expect, it } from 'vitest'
import {
  belongsToCompetitorDomain,
  classifyCompetitorChange,
  extractPageEvidence,
  isRobotsPathAllowed,
  normalizeCompetitorUrl,
} from '@/lib/competitorMonitoring'

describe('competitor monitoring truth and safety', () => {
  it('extracts only visible source evidence and detects price text', () => {
    const evidence = extractPageEvidence(`
      <html><head><title>Plans</title><meta name="description" content="Public pricing"></head>
      <body><h1>Choose a plan</h1><p>AED 99 / month</p><a href="/buy">Buy now</a>
      <script>const fake = "AED 1";</script></body></html>
    `)
    expect(evidence.title).toBe('Plans')
    expect(evidence.description).toBe('Public pricing')
    expect(evidence.headings).toContain('Choose a plan')
    expect(evidence.prices).toContain('AED 99 / month')
    expect(evidence.prices).not.toContain('AED 1')
    expect(evidence.callsToAction).toContain('Buy now')
  })

  it('reports a price change without inventing performance impact', () => {
    const before = extractPageEvidence('<title>Plans</title><h1>Plans</h1><p>AED 99</p>')
    const after = extractPageEvidence('<title>Plans</title><h1>Plans</h1><p>AED 129</p>')
    const change = classifyCompetitorChange('Acme', before, after)
    expect(change.type).toBe('PRICE_CHANGE')
    expect(change.summary).toContain('Review')
    expect(change.summary.toLowerCase()).not.toMatch(/conversion|revenue|roas/)
  })

  it('blocks private and credential-bearing URLs', () => {
    expect(() => normalizeCompetitorUrl('http://127.0.0.1/admin')).toThrow(/public/)
    expect(() => normalizeCompetitorUrl('http://user:pass@example.com')).toThrow(/credentials/)
    expect(normalizeCompetitorUrl('example.com/pricing').domain).toBe('example.com')
  })

  it('keeps monitoring on the verified domain', () => {
    expect(belongsToCompetitorDomain('https://www.example.com/pricing', 'example.com')).toBe(true)
    expect(belongsToCompetitorDomain('https://example.net/pricing', 'example.com')).toBe(false)
  })

  it('respects the longest matching robots rule', () => {
    const robots = 'User-agent: *\nDisallow: /private\nAllow: /private/public\n'
    expect(isRobotsPathAllowed(robots, '/pricing')).toBe(true)
    expect(isRobotsPathAllowed(robots, '/private/report')).toBe(false)
    expect(isRobotsPathAllowed(robots, '/private/public/news')).toBe(true)
  })
})
