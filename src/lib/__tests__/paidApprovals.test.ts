import { describe, expect, it } from 'vitest'
import {
  buildPaidBudgetApprovalPayload,
  buildPaidLaunchApprovalPayload,
  paidApprovalMatchesCurrent,
} from '@/lib/paidApprovals'
import { hashCampaignSnapshotPayload } from '@/lib/campaignSnapshots'

const strategySnapshot = {
  id: 'strategy-3',
  version: 3,
  scope: 'STRATEGY_APPROVAL',
  payloadHash: 'strategy-hash',
}
const campaign = {
  id: 'paid-1',
  workspaceId: 'workspace-1',
  organicCampaignId: 'campaign-1',
  strategySnapshotId: 'strategy-3',
  adAccountId: 'account-1',
  platform: 'META',
  objective: 'LEAD_GENERATION',
  name: 'Lead launch',
  budgetType: 'DAILY',
  dailyBudget: 125,
  lifetimeBudget: null,
  currency: 'AED',
  startDate: new Date('2026-07-20T00:00:00.000Z'),
  endDate: new Date('2026-08-03T00:00:00.000Z'),
  trackingUrls: { meta: 'https://example.com/offer?utm_source=meta' },
  platformCampaignId: 'meta-campaign-1',
  platformStatus: 'PAUSED',
  status: 'PAUSED',
}

describe('paid approval decisions', () => {
  it('keeps budget approval separate from spend authorization', () => {
    const payload = buildPaidBudgetApprovalPayload({ campaign, strategySnapshot })
    expect(payload).toMatchObject({
      scope: 'PAID_BUDGET_APPROVAL',
      adCampaignId: 'paid-1',
      strategySnapshot: { id: 'strategy-3', version: 3 },
      execution: { budgetType: 'DAILY', dailyBudget: 125, currency: 'AED' },
      approval: { budgetReviewed: true, platformDraftOnly: true, spendAuthorized: false },
    })
  })

  it('locks the exact platform objects, copy, media, destination, and budget at launch approval', () => {
    const budgetPayload = buildPaidBudgetApprovalPayload({ campaign, strategySnapshot })
    const budgetApprovalSnapshot = {
      id: 'budget-4',
      version: 4,
      scope: 'PAID_BUDGET_APPROVAL',
      payloadHash: hashCampaignSnapshotPayload(budgetPayload),
    }
    const launch = buildPaidLaunchApprovalPayload({
      campaign,
      strategySnapshot,
      budgetApprovalSnapshot,
      adSets: [{
        id: 'set-1',
        platformAdSetId: 'meta-set-1',
        targeting: { country: 'AE' },
        ads: [{
          id: 'ad-1',
          platformAdId: 'meta-ad-1',
          platformCreativeId: 'creative-1',
          primaryText: 'Reviewed copy',
          headline: 'Reviewed headline',
          destinationUrl: 'https://example.com/offer?utm_source=meta',
          imageUrl: 'https://cdn.example.com/reviewed.jpg',
          specsValidated: true,
        }],
      }],
    })

    expect(launch).toMatchObject({
      scope: 'PAID_LAUNCH_APPROVAL',
      budgetApprovalSnapshot: { id: 'budget-4' },
      platformDraft: { platformCampaignId: 'meta-campaign-1', platformStatus: 'PAUSED' },
      adSets: [{
        platformAdSetId: 'meta-set-1',
        ads: [{ decision: { primaryText: 'Reviewed copy', imageUrl: 'https://cdn.example.com/reviewed.jpg' } }],
      }],
      approval: { creativeAndCopyReviewed: true, deliveryAndSpendAuthorized: true },
    })
  })

  it('invalidates approval when a reviewed budget value changes', () => {
    const payload = buildPaidBudgetApprovalPayload({ campaign, strategySnapshot })
    const snapshot = {
      scope: 'PAID_BUDGET_APPROVAL',
      payload,
      payloadHash: hashCampaignSnapshotPayload(payload),
    }
    expect(paidApprovalMatchesCurrent(snapshot, 'PAID_BUDGET_APPROVAL', payload)).toBe(true)
    expect(paidApprovalMatchesCurrent(
      snapshot,
      'PAID_BUDGET_APPROVAL',
      buildPaidBudgetApprovalPayload({ campaign: { ...campaign, dailyBudget: 150 }, strategySnapshot }),
    )).toBe(false)
  })
})
