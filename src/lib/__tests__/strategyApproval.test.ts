import { describe, expect, it } from 'vitest'
import {
  buildStrategyApprovalContract,
  canMutateCampaignExecution,
  hasApprovedStrategyExecutionStatus,
} from '@/lib/strategyApproval'

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    name: 'Launch',
    status: 'DRAFT',
    goal: 'LEADS',
    audience: 'UAE founders',
    platforms: ['INSTAGRAM'],
    aiOutput: {
      strategy: { positioning: 'Automation with control', contentPillars: ['Proof', 'Education'] },
      qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
      sentinelReview: { status: 'passed' },
    },
    updatedAt: '2026-07-12T10:00:00.000Z',
    ...overrides,
  }
}

describe('strategy approval contract', () => {
  it('keeps the approved execution status contract explicit', () => {
    expect(['ACTIVE', 'SCHEDULED', 'PAUSED', 'COMPLETED'].map(hasApprovedStrategyExecutionStatus)).toEqual([true, true, true, true])
    expect(['DRAFT', 'ARCHIVED'].map(hasApprovedStrategyExecutionStatus)).toEqual([false, false])
    const reviewedOutput = campaign().aiOutput
    expect(['ACTIVE', 'SCHEDULED', 'PAUSED', 'COMPLETED'].map(status => canMutateCampaignExecution(status, reviewedOutput))).toEqual([true, false, false, false])
    expect(canMutateCampaignExecution('ACTIVE', { strategy: { positioning: 'Legacy' } })).toBe(false)
  })

  it('blocks an empty strategy', () => {
    const result = buildStrategyApprovalContract({ campaign: campaign({ aiOutput: null }) })
    expect(result.state).toBe('draft')
    expect(result.canApprove).toBe(false)
    expect(result.approvalBlockers.map((item) => item.code)).toEqual(['STRATEGY_MISSING'])
  })

  it('requires Sentinel before approval', () => {
    const result = buildStrategyApprovalContract({
      campaign: campaign({
        aiOutput: {
          strategy: { positioning: 'Clear' },
          qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
        },
      }),
    })
    expect(result.state).toBe('blocked')
    expect(result.approvalBlockers[0]?.code).toBe('SENTINEL_REVIEW_REQUIRED')
  })

  it('requires the deterministic marketing quality gate before Sentinel or approval', () => {
    const result = buildStrategyApprovalContract({
      campaign: campaign({
        aiOutput: {
          strategy: { positioning: 'Clear' },
          sentinelReview: { status: 'passed' },
        },
      }),
    })

    expect(result.state).toBe('blocked')
    expect(result.approvalBlockers[0]?.code).toBe('MARKETING_QUALITY_GATE_REQUIRED')
  })

  it('becomes ready for review only with strategy and passed Sentinel', () => {
    const result = buildStrategyApprovalContract({ campaign: campaign() })
    expect(result.state).toBe('ready_for_review')
    expect(result.canApprove).toBe(true)
    expect(result.operatingBrief).toMatchObject({
      objective: 'LEADS',
      audience: 'UAE founders',
      positioning: 'Automation with control',
      paidExecution: 'planning_only',
      publishingPolicy: 'approval_required',
    })
  })

  it('treats legacy ACTIVE campaigns as approved', () => {
    const result = buildStrategyApprovalContract({ campaign: campaign({ status: 'ACTIVE' }) })
    expect(result.state).toBe('approved')
    expect(result.canApprove).toBe(false)
    expect(result.canRevoke).toBe(true)
  })

  it('never lets a legacy ACTIVE status override the current quality gate', () => {
    const result = buildStrategyApprovalContract({
      campaign: campaign({
        status: 'ACTIVE',
        aiOutput: {
          strategy: { positioning: 'Legacy direction' },
          sentinelReview: { status: 'passed' },
        },
      }),
      latestDecision: {
        eventType: 'STRATEGY_APPROVED',
        createdAt: '2026-07-12T11:00:00.000Z',
        source: 'CAMPAIGN_REVIEW',
      },
    })

    expect(result.state).toBe('blocked')
    expect(result.canApprove).toBe(false)
    expect(result.canRevoke).toBe(false)
    expect(result.approvalBlockers[0]?.code).toBe('MARKETING_QUALITY_GATE_REQUIRED')
  })

  it('preserves approval truth for legacy scheduled campaigns', () => {
    const result = buildStrategyApprovalContract({ campaign: campaign({ status: 'SCHEDULED' }) })
    expect(result.state).toBe('approved')
    expect(result.canApprove).toBe(false)
    expect(result.canRevoke).toBe(false)
  })

  it('blocks revocation after publishing or active paid execution', () => {
    const result = buildStrategyApprovalContract({
      campaign: campaign({ status: 'ACTIVE' }),
      publishedPostCount: 1,
      activeAdCampaignCount: 1,
    })
    expect(result.canRevoke).toBe(false)
    expect(result.revokeBlockers.map((item) => item.code)).toEqual([
      'PUBLISHED_CONTENT_EXISTS',
      'ACTIVE_PAID_CAMPAIGN_EXISTS',
    ])
  })

  it('latest revocation event overrides stale status', () => {
    const result = buildStrategyApprovalContract({
      campaign: campaign({ status: 'DRAFT' }),
      latestDecision: {
        eventType: 'STRATEGY_APPROVAL_REVOKED',
        createdAt: '2026-07-12T11:00:00.000Z',
        source: 'CAMPAIGN_REVIEW',
      },
    })
    expect(result.state).toBe('revoked')
  })
})
