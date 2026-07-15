import { describe, expect, it } from 'vitest'
import { buildOperationsOverview, type OperationsOverviewInput } from '@/lib/operationsOverview'
import type { WorkspaceExecutionTruth } from '@/lib/executionTruth'

const now = new Date('2026-07-15T12:40:00.000Z')

function truth(overrides: Partial<WorkspaceExecutionTruth> = {}): WorkspaceExecutionTruth {
  return {
    version: 1,
    generatedAt: now.toISOString(),
    summary: { campaigns: 1, needsAttention: 0, awaitingApproval: 0, scheduledPosts: 0, publishedPosts: 0 },
    queue: [],
    campaigns: [],
    ...overrides,
  }
}

function input(overrides: Partial<OperationsOverviewInput> = {}): OperationsOverviewInput {
  return {
    now,
    truth: truth(),
    latestMonitor: {
      status: 'COMPLETED',
      createdAt: new Date('2026-07-15T12:15:00.000Z'),
      completedAt: new Date('2026-07-15T12:15:03.000Z'),
      outputData: { actionsDetected: 0, suggestionsCreated: 0 },
      error: null,
    },
    integrations: [],
    adAccounts: [],
    pendingApprovals: 0,
    overdueApprovals: 0,
    creditTransactions: [],
    paidCampaigns: [],
    publishedAwaitingEvidence: 0,
    latestAnalyticsAt: null,
    retriesLast24h: 0,
    latestRetryAt: null,
    ...overrides,
  }
}

describe('operations overview', () => {
  it('reports an honest monitor heartbeat and the exact next hourly run', () => {
    const overview = buildOperationsOverview(input())

    expect(overview.monitor).toMatchObject({
      health: 'healthy',
      lastRunAt: '2026-07-15T12:15:03.000Z',
      nextRunAt: '2026-07-15T13:15:00.000Z',
      actionsDetected: 0,
      suggestionsCreated: 0,
    })
    expect(overview.summary.incidents).toBe(0)
    expect(overview.summary.attentionItems).toBe(0)
  })

  it('turns a stale heartbeat, expired connection, missing analytics, and overspend into traceable issues', () => {
    const overview = buildOperationsOverview(input({
      latestMonitor: {
        status: 'COMPLETED',
        createdAt: new Date('2026-07-15T08:15:00.000Z'),
        completedAt: new Date('2026-07-15T08:15:02.000Z'),
        outputData: {},
        error: null,
      },
      integrations: [{
        id: 'meta-1', type: 'META', status: 'EXPIRED', updatedAt: now,
        config: { expiresAt: '2026-07-14T00:00:00.000Z' },
      }],
      paidCampaigns: [{
        id: 'paid-1', name: 'Launch search', currency: 'USD', status: 'ACTIVE', platformCampaignId: 'provider-1',
        budgetType: 'LIFETIME', dailyBudget: null, lifetimeBudget: 100, totalSpend: 115,
        startDate: new Date('2026-07-10T00:00:00.000Z'), endDate: null,
        lastSyncAt: new Date('2026-07-13T00:00:00.000Z'), lastSyncError: null,
      }],
      publishedAwaitingEvidence: 2,
      creditTransactions: [{ amount: -5, pricingVersion: null, entityId: null, entityType: null }],
    }))

    expect(overview.monitor.health).toBe('attention')
    expect(overview.connections).toMatchObject({ total: 1, connected: 0, attention: 1 })
    expect(overview.paid).toMatchObject({ staleSyncs: 1, budgetIncidents: 1, reportedSpend: 115 })
    expect(overview.analytics.publishedAwaitingEvidence).toBe(2)
    expect(overview.credits).toMatchObject({ spent30d: 5, unversionedCharges30d: 1, chargesWithoutArtifact30d: 1 })
    expect(overview.issues.map(issue => issue.id)).toEqual(expect.arrayContaining([
      'monitor:execution-heartbeat',
      'connection:social:meta-1',
      'paid:sync:paid-1',
      'paid:budget:paid-1',
      'analytics:missing-evidence',
      'credits:traceability',
    ]))
  })

  it('does not invent a monitor incident for an empty workspace before the first run', () => {
    const overview = buildOperationsOverview(input({
      truth: truth({ summary: { campaigns: 0, needsAttention: 0, awaitingApproval: 0, scheduledPosts: 0, publishedPosts: 0 } }),
      latestMonitor: null,
    }))

    expect(overview.monitor.health).toBe('not_started')
    expect(overview.issues).toEqual([])
  })
})
