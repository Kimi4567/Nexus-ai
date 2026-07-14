import { describe, expect, it } from 'vitest'
import { buildPaidStrategyExecutionContext, inspectPaidStrategySource } from '@/lib/paidStrategySource'

const baseCampaign = {
  id: 'campaign-1',
  workspaceId: 'workspace-1',
  name: 'Approved paid strategy',
  status: 'ACTIVE',
  goal: 'LEADS',
  audience: 'UAE professionals',
  platforms: ['INSTAGRAM'],
  updatedAt: new Date('2026-07-14T00:00:00.000Z'),
}

describe('paid strategy source truth', () => {
  it('accepts only an approved Paid or Full strategy', () => {
    expect(inspectPaidStrategySource({
      ...baseCampaign,
      aiOutput: {
        strategyType: 'paid',
        strategy: { positioning: 'Clear care' },
        sentinelReview: { status: 'passed' },
      },
    })).toMatchObject({
      eligible: true,
      reason: 'READY',
      scope: 'paid',
      approvalState: 'approved',
      executionObjective: 'LEAD_GENERATION',
    })
  })

  it('blocks paid execution when the strategy quality review is missing', () => {
    expect(inspectPaidStrategySource({
      ...baseCampaign,
      aiOutput: { strategyType: 'paid', strategy: { positioning: 'Clear care' } },
    })).toMatchObject({
      eligible: false,
      reason: 'QUALITY_REVIEW_REQUIRED',
      approvalState: 'approved',
    })
  })

  it('blocks an organic strategy from paid execution', () => {
    expect(inspectPaidStrategySource({
      ...baseCampaign,
      aiOutput: { strategyType: 'organic', strategy: { positioning: 'Clear care' } },
    })).toMatchObject({ eligible: false, reason: 'PAID_SCOPE_REQUIRED', scope: 'organic' })
  })

  it('blocks a paid strategy until approval', () => {
    expect(inspectPaidStrategySource({
      ...baseCampaign,
      status: 'DRAFT',
      aiOutput: {
        strategyType: 'paid',
        strategy: { positioning: 'Clear care' },
        sentinelReview: { status: 'passed' },
      },
    })).toMatchObject({ eligible: false, reason: 'APPROVAL_REQUIRED', approvalState: 'ready_for_review' })
  })

  it('keeps only strategy fields that belong in the execution handoff', () => {
    const context = buildPaidStrategyExecutionContext({
      strategy: {
        positioning: 'Premium calm care',
        targetAudience: 'Abu Dhabi families',
        internalDebugTrace: 'must not reach paid prompts',
      },
    })
    expect(context).toContain('Premium calm care')
    expect(context).toContain('Abu Dhabi families')
    expect(context).not.toContain('internalDebugTrace')
  })
})
