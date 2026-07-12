/**
 * Meta data-deletion callback — App Review contract.
 *
 * Guarantees the behavior Meta verifies during App Review:
 *   - missing signed_request → 400
 *   - a valid HMAC-signed signed_request → { url, confirmation_code }
 *   - GET echoes a challenge only with a matching verification token
 *
 * No DB/network: prisma is mocked; META_APP_SECRET is a test value.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

const TEST_SECRET = 'test_meta_secret'
const TEST_VERIFY_TOKEN = 'test_meta_webhook_verify_token_32_chars'
process.env.META_APP_SECRET = TEST_SECRET
process.env.META_WEBHOOK_VERIFY_TOKEN = TEST_VERIFY_TOKEN

const { mockFindFirst, mockCreate, mockUpdate, mockIntegrationFindMany, mockIntegrationDeleteMany, mockAdDeleteMany } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockIntegrationFindMany: vi.fn(),
  mockIntegrationDeleteMany: vi.fn(),
  mockAdDeleteMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dataDeletionRequest: { findFirst: mockFindFirst },
    integration: { findMany: mockIntegrationFindMany },
    $transaction: vi.fn(async (callback) => callback({
      integration: { deleteMany: mockIntegrationDeleteMany },
      adAccount: { deleteMany: mockAdDeleteMany },
      dataDeletionRequest: { create: mockCreate, update: mockUpdate },
    })),
  },
}))

import { POST, GET } from '../meta-data-deletion/route'

// base64url encode (Meta's encoding: + → -, / → _, no padding)
const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function makeSignedRequest(payload: object, secret = TEST_SECRET): string {
  const encodedPayload = b64url(Buffer.from(JSON.stringify(payload)))
  const sig = createHmac('sha256', secret).update(encodedPayload).digest()
  return `${b64url(sig)}.${encodedPayload}`
}

const jsonReq = (body: Record<string, unknown>) =>
  ({
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mockFindFirst.mockResolvedValue(null)
  mockCreate.mockResolvedValue({})
  mockUpdate.mockResolvedValue({})
  mockIntegrationFindMany.mockResolvedValue([])
  mockIntegrationDeleteMany.mockResolvedValue({ count: 0 })
  mockAdDeleteMany.mockResolvedValue({ count: 0 })
})

describe('Meta data-deletion callback', () => {
  it('returns 400 when signed_request is missing', async () => {
    const res = await POST(jsonReq({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Missing signed_request/i)
  })

  it('returns confirmation url + code for a valid signed_request', async () => {
    const signed = makeSignedRequest({
      user_id: 'fb_test_123',
      algorithm: 'HMAC-SHA256',
      issued_at: Math.floor(Date.now() / 1000),
    })
    const res = await POST(jsonReq({ signed_request: signed }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.confirmation_code).toBe('string')
    expect(json.confirmation_code.length).toBeGreaterThan(8)
    expect(json.url).toContain(json.confirmation_code)
    expect(json.url).toContain('/data-deletion')
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('rejects a signed_request with a bad signature', async () => {
    const signed = makeSignedRequest(
      { user_id: 'fb_test_123', algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000) },
      'wrong_secret',
    )
    const res = await POST(jsonReq({ signed_request: signed }))
    expect(res.status).toBe(400)
  })

  it('GET echoes hub.challenge only for a valid verification token', async () => {
    const url = new URL('https://nexus-grow.com/api/social/callback/meta-data-deletion')
    url.searchParams.set('hub.mode', 'subscribe')
    url.searchParams.set('hub.verify_token', TEST_VERIFY_TOKEN)
    url.searchParams.set('hub.challenge', 'abc123')
    const res = await GET({ url: url.toString() } as any)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('abc123')
  })

  it('rejects an invalid webhook verification token', async () => {
    const url = new URL('https://nexus-grow.com/api/social/callback/meta-data-deletion')
    url.searchParams.set('hub.mode', 'subscribe')
    url.searchParams.set('hub.verify_token', 'wrong-token')
    url.searchParams.set('hub.challenge', 'abc123')
    const res = await GET({ url: url.toString() } as any)
    expect(res.status).toBe(403)
  })

  it('GET without a challenge returns an ok status payload', async () => {
    const res = await GET({ url: 'https://nexus-grow.com/api/social/callback/meta-data-deletion' } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
  })
})
