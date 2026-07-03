import { describe, expect, it } from 'vitest'
import { selectStrategyWorkbenchCampaign } from '@/lib/strategy/strategyWorkbenchCampaign'

describe('selectStrategyWorkbenchCampaign', () => {
  it('prefers a campaign that matches the current Brand Brain over a recently viewed stale campaign', () => {
    const selected = selectStrategyWorkbenchCampaign([
      {
        id: 'old-ledgerflow',
        name: 'استراتيجية نمو عضوي لـ LedgerFlow AI',
        aiOutput: {
          strategy: {
            campaignName: 'استراتيجية نمو عضوي لـ LedgerFlow AI',
            companyName: 'LedgerFlow AI',
          },
        },
      },
      {
        id: 'new-clinicflow',
        name: 'استراتيجية نمو عضوي لـ ClinicFlow AI',
        aiOutput: {
          strategy: {
            campaignName: 'استراتيجية نمو عضوي لـ ClinicFlow AI',
            companyName: 'ClinicFlow AI',
          },
        },
      },
    ], 'ClinicFlow AI')

    expect(selected?.id).toBe('new-clinicflow')
  })

  it('falls back to the first campaign when no current brand name is available', () => {
    const selected = selectStrategyWorkbenchCampaign([
      { id: 'first', name: 'Strategy draft' },
      { id: 'second', name: 'Another strategy draft' },
    ], '')

    expect(selected?.id).toBe('first')
  })

  it('falls back to the first campaign when every visible campaign is stale', () => {
    const selected = selectStrategyWorkbenchCampaign([
      { id: 'old', name: 'استراتيجية نمو عضوي لـ LedgerFlow AI' },
      { id: 'older', name: 'استراتيجية نمو عضوي لـ BrightNest Home Care' },
    ], 'ClinicFlow AI')

    expect(selected?.id).toBe('old')
  })
})
