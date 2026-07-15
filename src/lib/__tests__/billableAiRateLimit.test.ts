import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbRateLimit = vi.fn()
vi.mock('@/lib/dbRateLimit', () => ({ dbRateLimit }))

describe('billable AI rate limit', () => {
  beforeEach(() => {
    dbRateLimit.mockReset()
    dbRateLimit.mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000, message: '' })
  })

  it('enforces both a user-wide and action-specific distributed limit', async () => {
    const { enforceBillableAiRateLimit } = await import('@/lib/billableAiRateLimit')
    await expect(enforceBillableAiRateLimit('user-1', 'IMAGE_GENERATION')).resolves.toBeNull()
    expect(dbRateLimit).toHaveBeenNthCalledWith(1, 'billable-ai:user-1', { limit: 120, windowMs: 3_600_000 })
    expect(dbRateLimit).toHaveBeenNthCalledWith(2, 'billable-ai:user-1:IMAGE_GENERATION', { limit: 30, windowMs: 3_600_000 })
  })

  it('returns a machine-readable 429 before checking the action limit', async () => {
    dbRateLimit.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      resetAt: Date.now() + 5_000,
      message: 'Try again in 5s.',
    })
    const { enforceBillableAiRateLimit } = await import('@/lib/billableAiRateLimit')
    const response = await enforceBillableAiRateLimit('user-1', 'CONTENT_ANALYSIS')

    expect(response?.status).toBe(429)
    expect(response?.headers.get('Retry-After')).toMatch(/^\d+$/)
    await expect(response?.json()).resolves.toMatchObject({
      error: 'AI_RATE_LIMITED',
      creditsCharged: false,
    })
    expect(dbRateLimit).toHaveBeenCalledTimes(1)
  })
})
