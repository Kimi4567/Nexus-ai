import { describe, expect, it } from 'vitest'
import { resolveStrategyScope } from '../strategyScope'

describe('resolveStrategyScope', () => {
  it('uses explicit aiOutput strategyType first', () => {
    expect(resolveStrategyScope({ strategyType: 'paid', strategyOrder: { strategyType: 'full' } })).toMatchObject({
      type: 'paid',
      includesOrganic: false,
      paidOnly: true,
      source: 'aiOutput.strategyType',
    })
  })

  it('falls back to persisted strategyOrder strategyType', () => {
    expect(resolveStrategyScope({ strategyOrder: { strategyType: 'full' } })).toMatchObject({
      type: 'full',
      includesOrganic: true,
      paidOnly: false,
      source: 'aiOutput.strategyOrder.strategyType',
    })
  })

  it('keeps legacy campaigns organic by default', () => {
    expect(resolveStrategyScope({ strategy: { contentPillars: ['Proof'] } })).toMatchObject({
      type: 'organic',
      includesOrganic: true,
      paidOnly: false,
      source: 'fallback',
    })
  })
})
