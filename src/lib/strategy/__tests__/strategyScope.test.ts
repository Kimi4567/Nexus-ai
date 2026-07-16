import { describe, expect, it } from 'vitest'
import { resolveStrategyScope } from '../strategyScope'

describe('resolveStrategyScope', () => {
  it('uses the confirmed strategy order before a stale duplicated label', () => {
    expect(resolveStrategyScope({ strategyType: 'paid', strategyOrder: { strategyType: 'full' } })).toMatchObject({
      type: 'full',
      includesOrganic: true,
      includesPaid: true,
      paidOnly: false,
      source: 'aiOutput.strategyOrder.strategyType',
    })
  })

  it('reads a persisted strategyOrder strategyType', () => {
    expect(resolveStrategyScope({ strategyOrder: { strategyType: 'full' } })).toMatchObject({
      type: 'full',
      includesOrganic: true,
      includesPaid: true,
      paidOnly: false,
      source: 'aiOutput.strategyOrder.strategyType',
    })
  })

  it('keeps legacy campaigns organic by default', () => {
    expect(resolveStrategyScope({ strategy: { contentPillars: ['Proof'] } })).toMatchObject({
      type: 'organic',
      includesOrganic: true,
      includesPaid: false,
      paidOnly: false,
      source: 'fallback',
    })
  })

  it('keeps explicit organic runs separate from paid planning readiness', () => {
    expect(resolveStrategyScope({ strategyType: 'organic' })).toMatchObject({
      type: 'organic',
      includesOrganic: true,
      includesPaid: false,
      paidOnly: false,
    })
  })
})
