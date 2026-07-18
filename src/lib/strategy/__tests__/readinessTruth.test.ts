import { describe, expect, it } from 'vitest'
import { countPendingReadinessItems, isReadinessItemComplete } from '@/lib/strategy/readinessTruth'

describe('strategy readiness truth', () => {
  it('accepts only explicit affirmative completion states', () => {
    expect(isReadinessItemComplete({ status: 'ready' })).toBe(true)
    expect(isReadinessItemComplete({ done: true })).toBe(true)
    expect(isReadinessItemComplete({ status: 'not ready' })).toBe(false)
    expect(isReadinessItemComplete({ status: 'needs review' })).toBe(false)
  })

  it('counts only unresolved checklist items', () => {
    expect(countPendingReadinessItems([
      { status: 'ready' },
      { status: 'pending' },
      { complete: false },
      { done: true },
    ])).toBe(2)
  })
})
