import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    adCampaign: { findFirst: vi.fn(), update: vi.fn() },
    campaign: { update: vi.fn() },
    campaignSnapshot: { findFirst: vi.fn(), create: vi.fn() },
    campaignActivity: { create: vi.fn() },
  }
  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  approvePaidBudgetDecision,
  approvePaidLaunchDecision,
} from '@/lib/paidApprovalService'
import {
  buildPaidBudgetApprovalPayload,
} from '@/lib/paidApprovals'
import { hashCampaignSnapshotPayload } from '@/lib/campaignSnapshots'

const strategyPayload = { scope: 'STRATEGY_APPROVAL', campaign: { id: 'source-1' } }
const strategySnapshot = {
  id: 'strategy-1',
  workspaceId: 'workspace-1',
  campaignId: 'source-1',
  version: 1,
  scope: 'STRATEGY_APPROVAL',
  payload: strategyPayload,
  payloadHash: hashCampaignSnapshotPayload(strategyPayload),
}

const baseCampaign = {
  id: 'paid-1',
  workspaceId: 'workspace-1',
  organicCampaignId: 'source-1',
  strategySnapshotId: 'strategy-1',
  strategySnapshot,
  budgetApprovalSnapshot: null,
  launchApprovalSnapshot: null,
  adAccountId: 'account-1',
  platform: 'META',
  objective: 'LEAD_GENERATION',
  name: 'Lead execution',
  budgetType: 'DAILY',
  dailyBudget: 100,
  lifetimeBudget: null,
  currency: 'AED',
  startDate: new Date('2026-07-20T00:00:00.000Z'),
  endDate: new Date('2026-08-03T00:00:00.000Z'),
  trackingUrls: { meta: 'https://example.com/offer?utm_source=meta' },
  status: 'DRAFT',
  platformCampaignId: null,
  platformStatus: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  txMock.campaignSnapshot.findFirst.mockResolvedValue(strategySnapshot)
  txMock.campaign.update.mockResolvedValue({ snapshotVersion: 2 })
  txMock.campaignSnapshot.create.mockResolvedValue({
    id: 'approval-2',
    version: 2,
    scope: 'PAID_BUDGET_APPROVAL',
    payloadHash: 'approval-hash',
  })
  txMock.adCampaign.update.mockResolvedValue({})
  txMock.campaignActivity.create.mockResolvedValue({})
})

describe('paid approval service', () => {
  it('records budget approval without authorizing spend', async () => {
    txMock.adCampaign.findFirst.mockResolvedValue(baseCampaign)

    const result = await approvePaidBudgetDecision({ adCampaignId: 'paid-1', userId: 'user-1' })

    expect(result.unchanged).toBe(false)
    expect(txMock.campaignSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        campaignId: 'source-1',
        scope: 'PAID_BUDGET_APPROVAL',
        payload: expect.objectContaining({
          approval: expect.objectContaining({ spendAuthorized: false, platformDraftOnly: true }),
        }),
      }),
    }))
    expect(txMock.adCampaign.update).toHaveBeenCalledWith({
      where: { id: 'paid-1' },
      data: {
        budgetApprovalSnapshotId: 'approval-2',
        launchApprovalSnapshotId: null,
      },
    })
  })

  it('rejects a zero or missing budget before writing approval evidence', async () => {
    txMock.adCampaign.findFirst.mockResolvedValue({ ...baseCampaign, dailyBudget: 0 })

    await expect(approvePaidBudgetDecision({ adCampaignId: 'paid-1', userId: 'user-1' }))
      .rejects.toMatchObject({ code: 'PAID_BUDGET_APPROVAL_INVALID', status: 422 })
    expect(txMock.campaignSnapshot.create).not.toHaveBeenCalled()
  })

  it('records a separate launch approval only after the budget and platform objects exist', async () => {
    const pausedCampaign = {
      ...baseCampaign,
      status: 'PAUSED',
      platformStatus: 'PAUSED',
      platformCampaignId: 'meta-campaign-1',
      adSets: [{
        id: 'set-1',
        platformAdSetId: 'meta-set-1',
        ads: [{ id: 'ad-1', platformAdId: 'meta-ad-1', primaryText: 'Reviewed' }],
      }],
    }
    const budgetPayload = buildPaidBudgetApprovalPayload({
      campaign: pausedCampaign,
      strategySnapshot,
    })
    const budgetApprovalSnapshot = {
      id: 'budget-2',
      version: 2,
      scope: 'PAID_BUDGET_APPROVAL',
      payload: budgetPayload,
      payloadHash: hashCampaignSnapshotPayload(budgetPayload),
    }
    txMock.adCampaign.findFirst.mockResolvedValue({ ...pausedCampaign, budgetApprovalSnapshot })
    txMock.campaign.update.mockResolvedValue({ snapshotVersion: 3 })
    txMock.campaignSnapshot.create.mockResolvedValue({
      id: 'launch-3',
      version: 3,
      scope: 'PAID_LAUNCH_APPROVAL',
      payloadHash: 'launch-hash',
    })

    const result = await approvePaidLaunchDecision({ adCampaignId: 'paid-1', userId: 'user-1' })

    expect(result.snapshot).toMatchObject({ id: 'launch-3', scope: 'PAID_LAUNCH_APPROVAL' })
    expect(txMock.campaignSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'PAID_LAUNCH_APPROVAL',
        payload: expect.objectContaining({
          approval: expect.objectContaining({ deliveryAndSpendAuthorized: true }),
        }),
      }),
    }))
    expect(txMock.adCampaign.update).toHaveBeenCalledWith({
      where: { id: 'paid-1' },
      data: { launchApprovalSnapshotId: 'launch-3' },
    })
  })
})
