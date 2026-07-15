import { beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRawUnsafe: query } }))

describe('database rate limiter', () => {
  beforeEach(() => query.mockReset())

  it('uses one atomic PostgreSQL upsert for a distributed counter', async () => {
    query.mockResolvedValue([{ count: 3, windowStart: new Date(Date.now() - 1_000) }])
    const { dbRateLimit } = await import('@/lib/dbRateLimit')
    const result = await dbRateLimit('ai:user-1', { limit: 5, windowMs: 60_000 })

    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(2)
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT ("key") DO UPDATE')
    expect(query.mock.calls[0][0]).toContain('"RateLimitRecord"."count" + 1')
    expect(query.mock.calls[0][2]).toBe('ai:user-1')
  })

  it('rejects only after the persisted atomic count exceeds the limit', async () => {
    query.mockResolvedValue([{ count: 6, windowStart: new Date() }])
    const { dbRateLimit } = await import('@/lib/dbRateLimit')
    const result = await dbRateLimit('ai:user-1', { limit: 5, windowMs: 60_000 })

    expect(result).toMatchObject({ ok: false, remaining: 0 })
  })
})
