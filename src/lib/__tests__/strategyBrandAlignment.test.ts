import { describe, expect, it } from 'vitest'
import { getStrategyBrandAlignment } from '@/lib/strategy/strategyBrandAlignment'

describe('getStrategyBrandAlignment', () => {
  it('treats an existing strategy as current when campaign evidence names the current brand', () => {
    const alignment = getStrategyBrandAlignment({
      currentBrandName: 'LedgerFlow AI',
      campaignName: '90-day organic strategy for LedgerFlow AI',
    })

    expect(alignment.isStale).toBe(false)
  })

  it('flags an existing strategy as stale when evidence names a previous brand', () => {
    const alignment = getStrategyBrandAlignment({
      currentBrandName: 'LedgerFlow AI',
      campaignName: 'استراتيجية نمو عضوي لـ BrightNest Home Care',
    })

    expect(alignment.isStale).toBe(true)
    expect(alignment.evidenceText).toContain('BrightNest Home Care')
  })

  it('flags strong brand evidence from a previous Brand Brain as stale', () => {
    const alignment = getStrategyBrandAlignment({
      currentBrandName: 'LedgerFlow AI',
      aiOutput: {
        strategy: {
          companyName: 'BrightNest Home Care',
        },
      },
    })

    expect(alignment.isStale).toBe(true)
  })

  it('uses nested strategy evidence when the campaign title is generic', () => {
    const alignment = getStrategyBrandAlignment({
      currentBrandName: 'LedgerFlow AI',
      campaignName: 'Strategy draft',
      aiOutput: {
        strategy: {
          companyName: 'LedgerFlow AI',
        },
      },
    })

    expect(alignment.isStale).toBe(false)
  })

  it('does not flag a generic campaign title without brand evidence as stale', () => {
    const alignment = getStrategyBrandAlignment({
      currentBrandName: 'LedgerFlow AI',
      campaignName: 'Strategy draft',
    })

    expect(alignment.isStale).toBe(false)
  })

  it('does not mark stale when current Brand Brain has no brand name yet', () => {
    const alignment = getStrategyBrandAlignment({
      currentBrandName: '',
      campaignName: 'استراتيجية نمو عضوي لـ BrightNest Home Care',
    })

    expect(alignment.isStale).toBe(false)
  })
})
