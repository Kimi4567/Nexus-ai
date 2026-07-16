import { describe, expect, it } from 'vitest'
import { filterCurrentAgentSuggestions } from '@/lib/currentAgentSuggestions'
import type { WorkspaceExecutionTruth } from '@/lib/executionTruth'

const truth: WorkspaceExecutionTruth = {
  version: 1,
  generatedAt: '2026-07-15T12:00:00.000Z',
  summary: { campaigns: 1, needsAttention: 0, awaitingApproval: 0, scheduledPosts: 3, publishedPosts: 0 },
  queue: [{
    id: 'campaign-1:MONITOR_SCHEDULE',
    campaignId: 'campaign-1',
    campaignName: 'Growth',
    kind: 'MONITOR_SCHEDULE',
    stage: 'IN_FLIGHT',
    priority: 'medium',
    safety: 'monitor_only',
    requiresApproval: false,
    href: '/campaigns/campaign-1/content-hub',
    title: { ar: 'راقب المحتوى المجدول', en: 'Monitor scheduled content' },
    reason: { ar: 'ثلاثة منشورات مجدولة.', en: 'Three posts are scheduled.' },
    evidence: {
      campaignStatus: 'ACTIVE',
      strategyApprovalState: 'approved',
      strategyEvidenceCount: 4,
      strategyBlockers: [],
      posts: { draft: 0, approved: 0, scheduled: 3, published: 0, failed: 0, publishedWithoutAnalytics: 0 },
    },
    updatedAt: '2026-07-15T12:00:00.000Z',
  }],
  campaigns: [{
    campaignId: 'campaign-1', campaignName: 'Growth', campaignStatus: 'ACTIVE', stage: 'IN_FLIGHT',
    strategyApprovalState: 'approved',
    posts: { draft: 0, approved: 0, scheduled: 3, published: 0, failed: 0, publishedWithoutAnalytics: 0 },
    nextAction: null,
    updatedAt: '2026-07-15T12:00:00.000Z',
  }],
}

describe('filterCurrentAgentSuggestions', () => {
  it('drops superseded execution-monitor and one-time strategy approvals', () => {
    const rows = filterCurrentAgentSuggestions([
      { id: 'old-monitor', campaignId: 'campaign-1', type: 'CONTENT_SWAP', payload: { source: 'execution-monitor', signature: 'execution:v1:campaign-1:REVIEW_CONTENT:CONTENT_REVIEW' } },
      { id: 'old-strategy', campaignId: 'campaign-1', type: 'STRATEGY', payload: { source: 'strategy-generator' } },
      { id: 'research', campaignId: 'campaign-1', type: 'STRATEGY', payload: { source: 'competitor-research-monitor' } },
    ], truth)

    expect(rows.map(row => row.id)).toEqual(['research'])
  })

  it('resolves a legacy strategy campaign id from payload and keeps only live approval truth', () => {
    const rows = filterCurrentAgentSuggestions([
      { id: 'legacy-strategy', type: 'STRATEGY', payload: { campaignId: 'campaign-1' } },
    ], truth)

    expect(rows).toEqual([])
  })
})
