import { describe, expect, it } from 'vitest'
import { buildStrategySnapshot, STRATEGY_SNAPSHOT_SCHEMA_VERSION } from '@/lib/strategy/strategySnapshot'

describe('buildStrategySnapshot', () => {
  it('normalizes the campaign strategy into one read model with real handoff links', () => {
    const snapshot = buildStrategySnapshot({
      campaignId: 'campaign-1',
      scope: 'full',
      goal: 'Qualified leads',
      strategy: {
        audienceSegmentsDetailed: [{ name: 'Operations leaders' }],
        positioning: { statement: 'Faster campaign operations' },
        funnelStages: [{ stage: 'Awareness' }],
        channelStrategy: [{ platform: 'LINKEDIN' }],
        contentPillars: ['Proof'],
        kpis: [{ name: 'Qualified leads', baseline: 'Required' }],
      },
      evidenceRefs: [{ statement: 'Verified offer' }],
      assumptions: ['Audience size needs confirmation'],
      missingInputs: ['Conversion destination'],
      riskFlags: ['No historical baseline'],
      approvalState: 'review',
    })

    expect(snapshot.version).toBe(STRATEGY_SNAPSHOT_SCHEMA_VERSION)
    expect(snapshot.scope).toBe('full')
    expect(snapshot.audiences).toHaveLength(1)
    expect(snapshot.funnel).toEqual([{ stage: 'Awareness' }])
    expect(snapshot.channels).toEqual([{ platform: 'LINKEDIN' }])
    expect(snapshot.evidenceRefs).toHaveLength(1)
    expect(snapshot.executionLinks.content).toBe('/campaigns/campaign-1/content-hub')
    expect(snapshot.executionLinks.paid).toBe('/paid-campaigns/campaign-1')
    expect(snapshot.executionLinks.performance).toBe('/campaigns/campaign-1?tab=performance')
    expect(snapshot.executionLinks.analytics).toBe('/analytics')
  })

  it('does not invent strategy inputs when the strategy is empty', () => {
    const snapshot = buildStrategySnapshot({ campaignId: 'campaign-2', strategy: null })

    expect(snapshot.goal).toBeNull()
    expect(snapshot.audiences).toEqual([])
    expect(snapshot.funnel).toEqual([])
    expect(snapshot.channels).toEqual([])
    expect(snapshot.missingInputs).toEqual([])
    expect(snapshot.approvalState).toBe('review')
  })
})
