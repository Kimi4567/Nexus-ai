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
    staleAgentRuns: 0,
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
    strategyRuns: [],
    pilotProof: {
      status: 'not_started',
      providerPublishedPosts: 0,
      eligibleAnalyticsPosts: 0,
      appliedLearningProposals: 0,
      completedCampaigns: 0,
      completedCampaignIds: [],
    },
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
    expect(overview.execution).toMatchObject({
      campaigns: 1,
      needsAttention: 0,
      awaitingApproval: 0,
      scheduledPosts: 0,
      publishedPosts: 0,
      queue: [],
      autopilot: { enabledCampaigns: 0, campaigns: [] },
    })
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
      creditTransactions: [{
        action: 'AD_COPY', amount: -5, status: 'SETTLED', createdAt: new Date('2026-07-15T11:00:00.000Z'),
        pricingVersion: null, entityId: null, entityType: null,
      }],
    }))

    expect(overview.monitor.health).toBe('attention')
    expect(overview.connections).toMatchObject({
      total: 1,
      connected: 0,
      attention: 1,
      social: { total: 1, connected: 0 },
      ads: { total: 0, connected: 0 },
    })
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

  it('marks an expired agent execution lease as a critical operational incident', () => {
    const overview = buildOperationsOverview(input({ staleAgentRuns: 2 }))

    expect(overview.monitor.health).toBe('critical')
    expect(overview.agents).toEqual({ staleRuns: 2, timeoutMinutes: 15 })
    expect(overview.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'agents:stale-runs', source: 'agents', priority: 'critical' }),
    ]))
    expect(overview.readiness.checks.find(check => check.id === 'monitoring')).toMatchObject({
      status: 'blocked',
      evidence: { en: expect.stringContaining('2 agent run') },
    })
  })

  it('surfaces documented pre-delivery strategy failures as zero-charge operational history', () => {
    const overview = buildOperationsOverview(input({
      strategyRuns: [{
        id: 'run-paid-1',
        status: 'FAILED',
        inputData: { strategyType: 'paid', language: 'ar', organicPostCount: 0 },
        outputData: {
          failure: {
            stage: 'paid_package',
            issueCodes: ['paid_package_count'],
            affectedPaths: ['paidPlanning.adCopies'],
          },
        },
        error: 'internal provider detail that must not be exposed',
        durationMs: 62_000,
        createdAt: new Date('2026-07-15T10:00:00.000Z'),
        completedAt: new Date('2026-07-15T10:01:02.000Z'),
      }],
    }))

    expect(overview.strategyRuns).toMatchObject({ failed: 1, completed: 0 })
    expect(overview.strategyRuns.recent[0]).toMatchObject({
      id: 'run-paid-1',
      strategyType: 'paid',
      creditOutcome: 'zero_charge_pre_delivery',
      reason: { en: expect.stringContaining('paid planning package') },
    })
    expect(JSON.stringify(overview.strategyRuns.recent[0])).not.toContain('internal provider detail')
  })

  it('returns the same canonical execution queue used to derive execution incidents', () => {
    const queueItem = {
      id: 'campaign-1:RESOLVE_FAILURE',
      campaignId: 'campaign-1',
      campaignName: 'Launch',
      kind: 'RESOLVE_FAILURE' as const,
      stage: 'NEEDS_ATTENTION' as const,
      priority: 'critical' as const,
      safety: 'manual_action' as const,
      requiresApproval: false,
      href: '/campaigns/campaign-1/content-hub',
      title: { en: 'Resolve failed content', ar: 'عالج المحتوى المتعثر' },
      reason: { en: 'One post failed.', ar: 'تعثر منشور واحد.' },
      evidence: {
        campaignStatus: 'ACTIVE',
        strategyApprovalState: 'approved' as const,
        strategyEvidenceCount: 3,
        strategyBlockers: [],
        posts: { draft: 0, approved: 0, scheduled: 0, published: 0, failed: 1, publishedWithoutAnalytics: 0 },
      },
      updatedAt: now.toISOString(),
    }
    const overview = buildOperationsOverview(input({
      truth: truth({
        summary: { campaigns: 1, needsAttention: 1, awaitingApproval: 0, scheduledPosts: 0, publishedPosts: 0 },
        queue: [queueItem],
        campaigns: [{
          campaignId: 'campaign-1', campaignName: 'Launch', campaignStatus: 'ACTIVE', stage: 'NEEDS_ATTENTION',
          strategyApprovalState: 'approved', posts: queueItem.evidence.posts, nextAction: queueItem, updatedAt: now.toISOString(),
          autopilotEnabled: true, autopilotActivatedAt: '2026-07-15T10:00:00.000Z',
        }],
      }),
    }))

    expect(overview.execution.queue).toEqual([queueItem])
    expect(overview.execution.stages).toEqual({ NEEDS_ATTENTION: 1 })
    expect(overview.execution.autopilot).toEqual({
      enabledCampaigns: 1,
      campaigns: [{ id: 'campaign-1', name: 'Launch', activatedAt: '2026-07-15T10:00:00.000Z', scheduledPosts: 0 }],
    })
    expect(overview.issues[0]).toMatchObject({ id: 'execution:campaign-1:RESOLVE_FAILURE', priority: 'critical' })
  })

  it('counts only settled debits as spend and only explicit refund rows as refunds', () => {
    const overview = buildOperationsOverview(input({
      creditTransactions: [
        { action: 'AD_COPY', amount: -3, status: 'SETTLED', createdAt: new Date('2026-07-15T10:00:00.000Z'), pricingVersion: 'v1', entityId: 'ad-1', entityType: 'ad' },
        { action: 'IMAGE_GENERATION', amount: -4, status: 'RESERVED', createdAt: new Date('2026-07-15T12:30:00.000Z'), pricingVersion: 'v1', entityId: 'image-1', entityType: 'image' },
        { action: 'PURCHASE', amount: 50, status: 'SETTLED', createdAt: new Date('2026-07-15T09:00:00.000Z'), pricingVersion: 'v1', entityId: 'order-1', entityType: 'credit_purchase' },
        { action: 'REFUND', amount: 2, status: 'SETTLED', createdAt: new Date('2026-07-15T11:30:00.000Z'), pricingVersion: 'v1', entityId: 'txn-1', entityType: 'credit_transaction' },
      ],
    }))

    expect(overview.credits).toMatchObject({
      spent30d: 3,
      refunded30d: 2,
      settledDebits30d: 1,
      reservationsInFlight: 1,
      staleReservations: 0,
    })
  })

  it('uses the latest settled debit as the current traceability canary without rewriting legacy rows', () => {
    const overview = buildOperationsOverview(input({
      creditTransactions: [
        { action: 'RUN_FULL_STRATEGY', amount: -12, status: 'SETTLED', createdAt: new Date('2026-07-15T12:00:00.000Z'), pricingVersion: '2026-07-18-v1', entityId: 'campaign-new', entityType: 'campaign' },
        { action: 'AD_COPY', amount: -3, status: 'SETTLED', createdAt: new Date('2026-07-14T12:00:00.000Z'), pricingVersion: null, entityId: null, entityType: null },
      ],
    }))

    expect(overview.issues.map(issue => issue.id)).toContain('credits:traceability')
    expect(overview.readiness.checks.find(check => check.id === 'credit_traceability')).toMatchObject({
      status: 'ready',
      evidence: { en: expect.stringContaining('latest settled debit') },
    })
  })

  it('blocks traceability when the latest settled debit is incomplete', () => {
    const overview = buildOperationsOverview(input({
      creditTransactions: [
        { action: 'AD_COPY', amount: -3, status: 'SETTLED', createdAt: new Date('2026-07-15T12:00:00.000Z'), pricingVersion: null, entityId: null, entityType: null },
        { action: 'RUN_FULL_STRATEGY', amount: -12, status: 'SETTLED', createdAt: new Date('2026-07-15T11:00:00.000Z'), pricingVersion: '2026-07-18-v1', entityId: 'campaign-old', entityType: 'campaign' },
      ],
    }))

    expect(overview.readiness.checks.find(check => check.id === 'credit_traceability')?.status).toBe('blocked')
  })

  it('raises a critical incident when a credit reservation is stuck', () => {
    const overview = buildOperationsOverview(input({
      creditTransactions: [{
        action: 'VIDEO_GENERATION', amount: -18, status: 'RESERVED', createdAt: new Date('2026-07-15T11:30:00.000Z'),
        pricingVersion: 'v1', entityId: 'video-1', entityType: 'video',
      }],
    }))

    expect(overview.credits).toMatchObject({ spent30d: 0, reservationsInFlight: 1, staleReservations: 1 })
    expect(overview.issues[0]).toMatchObject({ id: 'credits:stale-reservations', priority: 'critical' })
    expect(overview.readiness.checks.find(check => check.id === 'failure_recovery')?.status).toBe('blocked')
  })

  it('proves immutable approvals in sandbox without requiring a live platform schedule', () => {
    const overview = buildOperationsOverview(input({
      truth: truth({
        campaigns: [{
          campaignId: 'campaign-1',
          campaignName: 'Sandbox launch',
          campaignStatus: 'ACTIVE',
          stage: 'SCHEDULING',
          strategyApprovalState: 'approved',
          posts: {
            draft: 0,
            approved: 2,
            approvedMissingApproval: 0,
            approvedMissingMedia: 0,
            scheduled: 0,
            published: 0,
            failed: 0,
            publishedWithoutAnalytics: 0,
          },
          nextAction: null,
          updatedAt: now.toISOString(),
        }],
      }),
    }))

    expect(overview.readiness.checks.find(check => check.id === 'approval_evidence')).toMatchObject({
      status: 'ready',
      evidence: { en: expect.stringContaining('2 approved') },
    })
    expect(overview.readiness.pilot.status).toBe('not_started')
  })
})
