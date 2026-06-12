/**
 * Trust Sprint #2 — strategy-engine reliability.
 *
 * The real production failure was: generateMarketingStrategy / generateAdConcepts
 * called OpenAI with max_tokens=400, so Arabic JSON was truncated mid-structure
 * (finish_reason=length) → unparseable → "OpenAI returned invalid JSON" → the
 * engine threw and refunded. These tests pin the response-handling contract:
 *   - valid JSON succeeds
 *   - malformed JSON fails clearly
 *   - empty response fails clearly
 *   - truncated (finish_reason=length) fails with a CLEAR truncation error
 *   - provider/API error fails clearly (→ engine catch refunds)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateMarketingStrategy, generateAdConcepts } from '../openai'

const campaign = {
  name: 'حملة الابتسامة',
  goal: 'SALES',
  tone: 'MODERN',
  audience: 'العائلات في أبوظبي',
  language: 'ar',
  platforms: ['INSTAGRAM', 'FACEBOOK'],
}

/** Build a fake fetch Response. */
function mockFetch(opts: { ok?: boolean; status?: number; content?: string; finishReason?: string; emptyChoices?: boolean; text?: string }) {
  const { ok = true, status = 200, content = '{}', finishReason = 'stop', emptyChoices = false, text = '' } = opts
  const body = emptyChoices
    ? { choices: [] }
    : { choices: [{ message: { content }, finish_reason: finishReason }] }
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
    text: async () => text,
  })) as unknown as typeof fetch
}

describe('openai strategy/concepts response handling', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('1. valid AI strategy response succeeds (returns parsed object)', async () => {
    const strategy = { overview: 'ملخص', audience: 'جمهور', valueProps: [], angles: [], platformRecommendations: {}, ctaStrategies: [] }
    vi.stubGlobal('fetch', mockFetch({ content: JSON.stringify(strategy) }))
    const result = await generateMarketingStrategy(campaign, null)
    expect(result.overview).toBe('ملخص')
  })

  it('valid ad concepts response returns the concepts array', async () => {
    vi.stubGlobal('fetch', mockFetch({ content: JSON.stringify({ concepts: [{ name: 'مفهوم' }] }) }))
    const result = await generateAdConcepts(campaign, null)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].name).toBe('مفهوم')
  })

  it('2. malformed AI response fails clearly (invalid JSON)', async () => {
    vi.stubGlobal('fetch', mockFetch({ content: 'this is not json at all {{{', finishReason: 'stop' }))
    await expect(generateMarketingStrategy(campaign, null)).rejects.toThrow(/invalid JSON/i)
  })

  it('3. empty AI response fails clearly', async () => {
    vi.stubGlobal('fetch', mockFetch({ emptyChoices: true }))
    await expect(generateMarketingStrategy(campaign, null)).rejects.toThrow(/empty response/i)
  })

  it('4a. truncated response (finish_reason=length) fails with a clear truncation error', async () => {
    // Partial JSON cut off mid-structure — exactly the production failure.
    vi.stubGlobal('fetch', mockFetch({ content: '{"concepts":[{"name":"ابتسامتك', finishReason: 'length' }))
    await expect(generateAdConcepts(campaign, null)).rejects.toThrow(/truncated|max_tokens/i)
  })

  it('4b. provider/API error fails clearly (engine catch turns this into a refund)', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 500, text: 'upstream error' }))
    await expect(generateMarketingStrategy(campaign, null)).rejects.toThrow(/OpenAI API error: 500/i)
  })

  it('robustness: markdown-fenced JSON is still parsed', async () => {
    vi.stubGlobal('fetch', mockFetch({ content: '```json\n{"overview":"مغلف"}\n```' }))
    const result = await generateMarketingStrategy(campaign, null)
    expect(result.overview).toBe('مغلف')
  })
})
