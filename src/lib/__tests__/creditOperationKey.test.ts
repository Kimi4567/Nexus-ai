import { describe, expect, it } from 'vitest'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'

function requestWithKey(key?: string): Request {
  return new Request('https://nexus.test/api/generate', {
    headers: key ? { 'Idempotency-Key': key } : undefined,
  })
}

describe('credit operation keys', () => {
  it('hashes the client key deterministically inside the billable scope', () => {
    const first = getCreditOperationKey(requestWithKey('request-12345678'), 'IMAGE_GENERATION', 'post', 'post_1')
    const second = getCreditOperationKey(requestWithKey('request-12345678'), 'IMAGE_GENERATION', 'post', 'post_1')

    expect(first).toBe(second)
    expect(first).not.toContain('request-12345678')
    expect(first).toMatch(/^IMAGE_GENERATION:post:post_1:[a-f0-9]{32}$/)
  })

  it('does not deduplicate the same raw key across different operations', () => {
    const strategy = getCreditOperationKey(requestWithKey('request-12345678'), 'RUN_FULL_STRATEGY', 'strategy', 'strategy_1')
    const image = getCreditOperationKey(requestWithKey('request-12345678'), 'IMAGE_GENERATION', 'post', 'post_1')

    expect(strategy).not.toBe(image)
  })

  it('creates a unique safe key when the header is absent or invalid', () => {
    const first = getCreditOperationKey(requestWithKey(), 'IMAGE_GENERATION', 'post', 'post_1')
    const second = getCreditOperationKey(requestWithKey('bad'), 'IMAGE_GENERATION', 'post', 'post_1')

    expect(first).not.toBe(second)
    expect(first.length).toBeLessThanOrEqual(200)
    expect(second.length).toBeLessThanOrEqual(200)
  })
})
