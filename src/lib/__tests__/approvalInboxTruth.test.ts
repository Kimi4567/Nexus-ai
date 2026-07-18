import { describe, expect, it } from 'vitest'
import { actionableApprovalSuggestions, dedupeLiveApprovalQueue } from '@/lib/approvalInboxTruth'

describe('dedupeLiveApprovalQueue', () => {
  it('keeps execution-monitor navigation out of the approval decision list', () => {
    const suggestions = [
      { id: 'monitor', type: 'CONTENT_SWAP', payload: { source: 'execution-monitor', href: '/content-hub' } },
      { id: 'budget', type: 'BUDGET_CHANGE', payload: { source: 'agent-analysis' } },
    ]

    expect(actionableApprovalSuggestions(suggestions).map(item => item.id)).toEqual(['budget'])
  })

  it('keeps one approval per campaign when a persisted decision exists', () => {
    const queue = [
      { campaignId: 'campaign-1', requiresApproval: true, id: 'live-1' },
      { campaignId: 'campaign-2', requiresApproval: true, id: 'live-2' },
      { campaignId: 'campaign-3', requiresApproval: false, id: 'not-reviewable' },
    ]
    const suggestions = [{ campaignId: 'campaign-1', type: 'PAUSE' }]

    expect(dedupeLiveApprovalQueue(suggestions, queue).map(item => item.id)).toEqual(['live-2'])
  })

  it('reads the campaign id from persisted payloads', () => {
    const queue = [{ campaignId: 'campaign-1', requiresApproval: true, id: 'live-1' }]
    const suggestions = [{ payload: { campaignId: 'campaign-1' }, type: 'PAUSE' }]

    expect(dedupeLiveApprovalQueue(suggestions, queue)).toEqual([])
  })
})
