import { describe, expect, it } from 'vitest'
import { postLimitReachedMessage } from '@/lib/postLimitMessage'

describe('post limit message', () => {
  it('states capacity, reset date, and the zero-credit outcome in English', () => {
    expect(postLimitReachedMessage({
      locale: 'en',
      limit: 16,
      current: 12,
      requested: 10,
      resetsAt: '2026-08-01T00:00:00.000Z',
    })).toBe('Your monthly plan limit is 16 drafts: 12 are used and this plan needs 10. The allowance resets on Aug 1, 2026. No credits were charged, and you can wait for the reset without upgrading.')
  })

  it('does not force an upgrade in Arabic', () => {
    const message = postLimitReachedMessage({
      locale: 'ar',
      limit: 16,
      current: 12,
      requested: 10,
      resetsAt: '2026-08-01T00:00:00.000Z',
    })
    expect(message).toContain('لم يُخصم أي كريديت')
    expect(message).toContain('من دون ترقية')
  })
})
