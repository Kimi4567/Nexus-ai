import { describe, expect, it } from 'vitest'
import { scheduledBatchOffset } from '@/lib/scheduledBatch'

describe('scheduled batch rotation', () => {
  it('does not skip when every eligible record fits in one run', () => {
    expect(scheduledBatchOffset(40, 50, new Date('2026-07-15T09:00:00Z'), 'daily')).toBe(0)
  })

  it('moves the daily batch instead of reading the first rows forever', () => {
    const dayOne = scheduledBatchOffset(1_000, 50, new Date('2026-07-15T09:00:00Z'), 'daily')
    const dayTwo = scheduledBatchOffset(1_000, 50, new Date('2026-07-16T09:00:00Z'), 'daily')
    expect(dayTwo).toBe((dayOne + 50) % 1_000)
  })

  it('keeps retries within the same scheduled period on the same batch', () => {
    const morning = scheduledBatchOffset(300, 50, new Date('2026-07-15T08:00:00Z'), 'daily')
    const evening = scheduledBatchOffset(300, 50, new Date('2026-07-15T20:00:00Z'), 'daily')
    expect(evening).toBe(morning)
  })
})
