import { describe, expect, it } from 'vitest'
import { planExecutionMonitorSuggestions } from '@/lib/executionMonitor'
import type { ExecutionQueueItem, WorkspaceExecutionTruth } from '@/lib/executionTruth'

const posts = { draft: 2, approved: 0, scheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0 }

function action(overrides: Partial<ExecutionQueueItem> = {}): ExecutionQueueItem {
  return {
    id: 'c1:REVIEW_CONTENT',
    campaignId: 'c1',
    campaignName: 'Launch',
    kind: 'REVIEW_CONTENT',
    stage: 'CONTENT_REVIEW',
    priority: 'high',
    safety: 'review_required',
    requiresApproval: true,
    href: '/campaigns/c1/content-hub',
    title: { en: 'Review draft content', ar: 'راجع مسودات المحتوى' },
    reason: { en: '2 drafts need approval.', ar: 'مسودتان تحتاجان اعتماداً.' },
    evidence: { campaignStatus: 'ACTIVE', strategyApprovalState: 'approved', posts },
    updatedAt: '2026-07-12T12:00:00.000Z',
    ...overrides,
  }
}

function truth(queue: ExecutionQueueItem[]): WorkspaceExecutionTruth {
  return {
    version: 1,
    generatedAt: '2026-07-12T12:00:00.000Z',
    summary: { campaigns: 1, needsAttention: 0, awaitingApproval: 1, scheduledPosts: 0, publishedPosts: 0 },
    queue,
    campaigns: [],
  }
}

describe('execution monitor planner', () => {
  it('creates a deterministic, evidence-backed approval suggestion', () => {
    const [plan] = planExecutionMonitorSuggestions(truth([action()]))

    expect(plan).toMatchObject({
      agent: 'CONTENT_DIRECTOR',
      type: 'CONTENT_SWAP',
      priority: 2,
      campaignId: 'c1',
      payload: {
        source: 'execution-monitor',
        actionKind: 'REVIEW_CONTENT',
        performanceClaim: false,
        autoExecution: false,
      },
    })
    expect(plan.signature).toBe('execution:v1:c1:REVIEW_CONTENT:CONTENT_REVIEW')
  })

  it('never turns monitor-only or medium/low queue items into inbox noise', () => {
    const plans = planExecutionMonitorSuggestions(truth([
      action({ id: 'monitor', safety: 'monitor_only', priority: 'high' }),
      action({ id: 'medium', priority: 'medium' }),
      action({ id: 'low', priority: 'low' }),
    ]))
    expect(plans).toEqual([])
  })

  it('maps critical failures to the campaign manager without claiming results', () => {
    const [plan] = planExecutionMonitorSuggestions(truth([action({
      kind: 'RESOLVE_FAILURE',
      stage: 'NEEDS_ATTENTION',
      priority: 'critical',
      safety: 'manual_action',
    })]))
    expect(plan).toMatchObject({ agent: 'CAMPAIGN_MANAGER', priority: 1 })
    expect(plan.impact).toContain('no performance outcome is assumed')
  })
})
