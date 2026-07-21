import { describe, expect, it } from 'vitest'
import {
  applySentinelReviewToCampaignEngine,
  applyStrategyApprovalToCampaignEngine,
  clearSuccessfulCampaignEngineError,
} from '@/lib/campaignEnginePersistence'

describe('campaign engine persistence', () => {
  it('removes a stale error after a successful engine run', () => {
    expect(clearSuccessfulCampaignEngineError({
      status: 'ready_for_approval',
      score: 71,
      error: 'MARKETING_QUALITY_GATE_BLOCKED:old_failure',
    })).toEqual({ status: 'ready_for_approval', score: 71 })
  })

  it('records strategy approval without claiming the campaign is ready to launch', () => {
    const result = applyStrategyApprovalToCampaignEngine({
      status: 'ready_for_approval',
      sentinelStatus: 'passed',
      steps: [
        { key: 'strategy', status: 'done' },
        { key: 'sentinel', status: 'done' },
        { key: 'approval', status: 'pending' },
      ],
    }, true, '2026-07-21T15:15:00.000Z')

    expect(result).toMatchObject({
      status: 'strategy_approved',
      currentStep: 'content',
      score: 100,
    })
    expect(result.status).not.toBe('ready_for_launch')
    expect(result.steps?.[2]).toMatchObject({ key: 'approval', status: 'done' })
  })

  it('persists a passed Sentinel result without carrying an older engine failure', () => {
    const reviewedAt = '2026-07-21T15:13:58.084Z'
    const result = applySentinelReviewToCampaignEngine({
      status: 'failed',
      error: 'reviewed_platform_missing_from_strategy',
      steps: [
        { key: 'strategy', status: 'done', completedAt: 'earlier' },
        { key: 'sentinel', status: 'blocked' },
        { key: 'approval', status: 'blocked', completedAt: 'stale' },
      ],
    }, 'passed', reviewedAt)

    expect(result).not.toHaveProperty('error')
    expect(result).toMatchObject({
      status: 'ready_for_approval',
      currentStep: 'approval',
      sentinelStatus: 'passed',
      score: 67,
      lastCompletedAt: reviewedAt,
    })
    expect(result.steps).toEqual([
      { key: 'strategy', status: 'done', completedAt: 'earlier' },
      { key: 'sentinel', status: 'done', completedAt: reviewedAt },
      { key: 'approval', status: 'pending' },
    ])
  })
})
