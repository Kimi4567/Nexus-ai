import { describe, expect, it } from 'vitest'
import {
  isCampaignApprovalPackageJobInput,
  toPublicAutomationJob,
} from '@/lib/automationJobs/types'

const credit = {
  creditsRemaining: 76,
  creditsUsed: 12,
  isUnlimited: false,
  transactionId: 'credit-1',
  operationStatus: 'RESERVED' as const,
}

describe('campaign approval package job contract', () => {
  it('accepts only the bounded content and media-direction input', () => {
    expect(isCampaignApprovalPackageJobInput({
      schemaVersion: 1,
      userId: 'user-1',
      campaignId: 'campaign-1',
      language: 'ar',
      mediaSource: 'MIXED',
      selectedMediaIds: null,
      credit,
    })).toBe(true)

    expect(isCampaignApprovalPackageJobInput({
      schemaVersion: 1,
      userId: 'user-1',
      campaignId: 'campaign-1',
      language: 'ar',
      mediaSource: 'PUBLISH_NOW',
      selectedMediaIds: [],
      credit,
    })).toBe(false)
  })

  it('exposes waiting approval as quiescent human work, not a completed execution', () => {
    const now = new Date('2026-07-29T08:00:00.000Z')
    const publicJob = toPublicAutomationJob({
      id: 'job-1',
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      requestedByUserId: 'user-1',
      kind: 'CAMPAIGN_APPROVAL_PACKAGE',
      status: 'WAITING_FOR_APPROVAL',
      idempotencyKey: 'operation-1',
      priority: 0,
      input: {},
      output: {
        publishAuthorized: false,
        spendAuthorized: false,
      },
      currentStep: 'waiting_for_approval',
      progress: 100,
      attemptCount: 1,
      maxAttempts: 3,
      nextAttemptAt: now,
      leaseToken: null,
      leaseExpiresAt: null,
      errorCode: null,
      lastError: null,
      startedAt: now,
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    })

    expect(publicJob).toMatchObject({
      status: 'WAITING_FOR_APPROVAL',
      terminal: false,
      awaitingApproval: true,
      canResume: false,
      progress: 100,
    })
  })
})
