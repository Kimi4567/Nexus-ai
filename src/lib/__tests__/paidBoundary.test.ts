import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  canActivatePlatformCampaign,
  canCreatePlatformDraft,
  canRecordExternalPaidLaunch,
  canRecordPaidCompletion,
  getBudgetTruth,
  getSafePaidPackSetupStatus,
  isAnalyticsBackedPaidMetricsSource,
  isUnsafePaidPackStatus,
  mapPausedPlatformPushStatus,
  paidMetricsSignalCopy,
} from '@/lib/paidBoundary'

describe('paidBoundary', () => {
  it('keeps paid-pack setup planning-only', () => {
    expect(getSafePaidPackSetupStatus('DRAFT')).toBe('DRAFT')
    expect(getSafePaidPackSetupStatus('GENERATED')).toBe('GENERATED')
    expect(getSafePaidPackSetupStatus('LAUNCHED')).toBeUndefined()
    expect(getSafePaidPackSetupStatus('ACTIVE')).toBeUndefined()
    expect(isUnsafePaidPackStatus('READY_TO_LAUNCH')).toBe(true)
  })

  it('marks fallback budget as planning assumption, not confirmed spend', () => {
    expect(getBudgetTruth({ amount: null, fallbackAmount: 20 })).toEqual({
      amount: 20,
      budgetValuePresent: false,
      budgetSource: 'planning_assumption',
      budgetConfirmed: false,
    })
  })

  it('marks positive budget values as present but unconfirmed without explicit confirmation', () => {
    expect(getBudgetTruth({ amount: 125, fallbackAmount: 20 })).toEqual({
      amount: 125,
      budgetValuePresent: true,
      budgetSource: 'budget_value_present_unconfirmed',
      budgetConfirmed: false,
    })
  })

  it('marks positive budget values as confirmed only with explicit confirmation', () => {
    expect(getBudgetTruth({
      amount: 125,
      fallbackAmount: 20,
      explicitBudgetConfirmed: true,
    })).toEqual({
      amount: 125,
      budgetValuePresent: true,
      budgetSource: 'explicit_budget_confirmed',
      budgetConfirmed: true,
    })
  })

  it('requires explicit external-launch acknowledgement and no metrics payload', () => {
    expect(canRecordExternalPaidLaunch({
      requestedStatus: 'LAUNCHED',
      explicitExternalLaunchConfirmed: true,
      metricsProvided: false,
    })).toBe(true)
    expect(canRecordExternalPaidLaunch({
      requestedStatus: 'LAUNCHED',
      explicitExternalLaunchConfirmed: false,
      metricsProvided: false,
    })).toBe(false)
    expect(canRecordExternalPaidLaunch({
      requestedStatus: 'LAUNCHED',
      explicitExternalLaunchConfirmed: true,
      metricsProvided: true,
    })).toBe(false)
  })

  it('allows completion only after an explicit confirmation from launched state', () => {
    expect(canRecordPaidCompletion({
      requestedStatus: 'COMPLETED',
      explicitCompletionConfirmed: true,
      currentStatus: 'LAUNCHED',
    })).toBe(true)
    expect(canRecordPaidCompletion({
      requestedStatus: 'COMPLETED',
      explicitCompletionConfirmed: true,
      currentStatus: 'GENERATED',
    })).toBe(false)
  })

  it('treats manual metrics as review signals, not analytics-backed learning', () => {
    expect(isAnalyticsBackedPaidMetricsSource('manual')).toBe(false)
    expect(paidMetricsSignalCopy('manual')).toEqual({
      label: 'Manual paid metrics signal saved for review',
      canUpdateBrandBrain: false,
    })
  })

  it('allows analytics-backed metrics sources to update Brand Brain later', () => {
    expect(isAnalyticsBackedPaidMetricsSource('meta_api')).toBe(true)
    expect(paidMetricsSignalCopy('meta_api')).toEqual({
      label: 'Analytics-backed paid metrics ready for review',
      canUpdateBrandBrain: true,
    })
  })

  it('maps Meta paused platform objects to non-active local status', () => {
    expect(mapPausedPlatformPushStatus('DRAFT')).toBe('PAUSED')
    expect(mapPausedPlatformPushStatus('ACTIVE')).toBe('PAUSED')
  })

  it('requires explicit platform draft and budget confirmation before external draft creation', () => {
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: true,
      explicitBudgetConfirmed: true,
      explicitExecutionReadinessConfirmed: true,
      executionReady: true,
    })).toBe(true)
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: false,
      explicitBudgetConfirmed: true,
      explicitExecutionReadinessConfirmed: true,
      executionReady: true,
    })).toBe(false)
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: true,
      explicitBudgetConfirmed: false,
      explicitExecutionReadinessConfirmed: true,
      executionReady: true,
    })).toBe(false)
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: undefined,
      explicitBudgetConfirmed: undefined,
      explicitExecutionReadinessConfirmed: undefined,
      executionReady: undefined,
    })).toBe(false)
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: true,
      explicitBudgetConfirmed: true,
      explicitExecutionReadinessConfirmed: true,
      executionReady: false,
    })).toBe(false)
  })

  it('requires paused platform draft, API access, and three explicit approvals before paid activation', () => {
    const ready = {
      platform: 'META',
      localStatus: 'PAUSED',
      platformCampaignId: 'meta_campaign_1',
      platformStatus: 'PAUSED',
      adAccountHasApiAccess: true,
      explicitPlatformActivationConfirmed: true,
      explicitSpendActivationConfirmed: true,
      explicitBudgetConfirmed: true,
      explicitExecutionReadinessConfirmed: true,
      executionReady: true,
    }

    expect(canActivatePlatformCampaign(ready)).toBe(true)
    expect(canActivatePlatformCampaign({ ...ready, localStatus: 'DRAFT' })).toBe(false)
    expect(canActivatePlatformCampaign({ ...ready, platformStatus: 'ACTIVE' })).toBe(false)
    expect(canActivatePlatformCampaign({ ...ready, platformCampaignId: null })).toBe(false)
    expect(canActivatePlatformCampaign({ ...ready, adAccountHasApiAccess: false })).toBe(false)
    expect(canActivatePlatformCampaign({ ...ready, explicitPlatformActivationConfirmed: false })).toBe(false)
    expect(canActivatePlatformCampaign({ ...ready, explicitSpendActivationConfirmed: false })).toBe(false)
    expect(canActivatePlatformCampaign({ ...ready, explicitExecutionReadinessConfirmed: false })).toBe(false)
    expect(canActivatePlatformCampaign({ ...ready, executionReady: false })).toBe(false)
    expect(canActivatePlatformCampaign({ ...ready, explicitBudgetConfirmed: false })).toBe(false)
  })

  it('does not treat a positive daily budget as platform draft approval', () => {
    expect(getBudgetTruth({ amount: 250, fallbackAmount: 50 })).toEqual({
      amount: 250,
      budgetValuePresent: true,
      budgetSource: 'budget_value_present_unconfirmed',
      budgetConfirmed: false,
    })
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: true,
      explicitBudgetConfirmed: undefined,
      explicitExecutionReadinessConfirmed: true,
      executionReady: true,
    })).toBe(false)
  })

  it('guards paid-pack setup and metrics routes at source level', () => {
    const setupRoute = readFileSync(join(process.cwd(), 'src/app/api/campaigns/[id]/paid-pack/route.ts'), 'utf8')
    const metricsRoute = readFileSync(join(process.cwd(), 'src/app/api/campaigns/[id]/paid-pack/metrics/route.ts'), 'utf8')

    expect(setupRoute).toContain('getSafePaidPackSetupStatus')
    expect(setupRoute).toContain('isUnsafePaidPackStatus')
    expect(setupRoute).not.toContain('...(status && { status })')

    expect(metricsRoute).toContain('canRecordExternalPaidLaunch')
    expect(metricsRoute).toContain('explicitExternalLaunchConfirmed')
    expect(metricsRoute).toContain('Manual paid metrics cannot mark paid content launched')
    expect(metricsRoute).toContain("metricsSource: 'manual'")
    expect(metricsRoute).toContain('normalizeManualPaidMetrics')
    expect(metricsRoute).not.toContain("metricsSource = 'manual'")
  })

  it('keeps Meta platform creation paused and non-active in source', () => {
    const pushRoute = readFileSync(join(process.cwd(), 'src/app/api/ad-campaigns/[id]/push-to-platform/route.ts'), 'utf8')
    const paidCampaignPage = readFileSync(join(process.cwd(), 'src/app/paid-campaigns/[id]/page.tsx'), 'utf8')
    const generateRoute = readFileSync(join(process.cwd(), 'src/app/api/campaigns/[id]/paid-pack/generate/route.ts'), 'utf8')

    expect(pushRoute).toContain('canCreatePlatformDraft')
    expect(pushRoute).toContain('approvePaidBudgetDecision')
    expect(pushRoute).toContain('explicitPlatformDraftConfirmed')
    expect(pushRoute).toContain('explicitBudgetConfirmed')
    expect(pushRoute).toContain('explicitBudgetConfirmed: body.explicitBudgetConfirmed')
    expect(pushRoute).toContain('budgetValuePresent: campaignBudgetTruth.budgetValuePresent')
    expect(pushRoute).toContain('Creating platform draft objects requires explicit confirmation')
    expect(pushRoute).toContain("status: 'PAUSED'")
    expect(pushRoute).toContain('mapPausedPlatformPushStatus')
    expect(pushRoute).not.toContain("status: 'ACTIVE'")
    expect(pushRoute).not.toContain('live push')
    expect(pushRoute).toContain('Platform draft objects were created in Meta in PAUSED state')
    expect(pushRoute).toContain("data: { platformAdSetId: metaAdSetId, status: 'PAUSED' }")
    expect(pushRoute).toContain('platformAdId: metaAdId')
    expect(pushRoute).toContain('platformCreativeId: creativeId')
    expect(pushRoute).toContain("status: 'PAUSED'")
    expect(pushRoute).toContain('uploadAdImageFromUrl')
    expect(pushRoute).not.toContain("'https://example.com'")
    expect(pushRoute).not.toContain('platformAdSetId: metaAdSetId, platformStatus')
    expect(pushRoute).not.toContain('platformAdId: metaAdId, platformStatus')

    expect(paidCampaignPage).toContain('platformDraftAcknowledged')
    expect(paidCampaignPage).toContain('budgetReadinessAcknowledged')
    expect(paidCampaignPage).toContain('explicitPlatformDraftConfirmed: platformDraftAcknowledged === true')
    expect(paidCampaignPage).toContain('explicitBudgetConfirmed: budgetReadinessAcknowledged === true')
    expect(paidCampaignPage).toContain('!platformDraftAcknowledged || !budgetReadinessAcknowledged || pushLoading')
    expect(paidCampaignPage).toContain('I confirm the budget, tracking, creative, and platform readiness have been reviewed')

    expect(generateRoute).toContain('explicitBudgetConfirmed: false')
    expect(generateRoute).toContain('Budget Confirmed: ${budgetTruth.budgetConfirmed')
    expect(generateRoute).toContain('Budget Value Present: ${budgetTruth.budgetValuePresent')
    expect(generateRoute).toContain('treat this as a planning budget value only')
  })

  it('keeps paid activation on a separate final-approval route', () => {
    const activateRoute = readFileSync(join(process.cwd(), 'src/app/api/ad-campaigns/[id]/activate-platform/route.ts'), 'utf8')
    const updateRoute = readFileSync(join(process.cwd(), 'src/app/api/ad-campaigns/[id]/route.ts'), 'utf8')
    const adSetUpdateRoute = readFileSync(join(process.cwd(), 'src/app/api/ad-campaigns/[id]/ad-sets/[setId]/route.ts'), 'utf8')
    const paidCampaignPage = readFileSync(join(process.cwd(), 'src/app/paid-campaigns/[id]/page.tsx'), 'utf8')
    const metaApi = readFileSync(join(process.cwd(), 'src/lib/adPlatforms/metaAdsApi.ts'), 'utf8')

    expect(activateRoute).toContain('canActivatePlatformCampaign')
    expect(activateRoute).toContain('approvePaidLaunchDecision')
    expect(activateRoute).toContain('explicitPlatformActivationConfirmed')
    expect(activateRoute).toContain('explicitSpendActivationConfirmed')
    expect(activateRoute).toContain('explicitBudgetConfirmed')
    expect(activateRoute).toContain('Activation requires an existing paused platform draft')
    expect(activateRoute).toContain("await api.updateObjectStatus(adSetId, 'ACTIVE')")
    expect(activateRoute).toContain("await api.updateObjectStatus(adId, 'ACTIVE')")
    expect(activateRoute).toContain("await api.updateCampaignStatus(String(campaign.platformCampaignId), 'ACTIVE')")

    expect(updateRoute).toContain('activation_route_required')
    expect(updateRoute).toContain('Use the explicit platform activation route after final approval')
    expect(updateRoute).not.toContain('...(totalSpend !== undefined')
    expect(updateRoute).not.toContain('...(totalImpressions !== undefined')
    expect(updateRoute).not.toContain('...(avgCTR !== undefined')
    expect(updateRoute).not.toContain('...(avgROAS !== undefined')
    expect(adSetUpdateRoute).toContain('activation_route_required')
    expect(adSetUpdateRoute).toContain('Ad sets cannot be marked active through generic updates')
    expect(adSetUpdateRoute).not.toContain('platformStatus')

    expect(paidCampaignPage).toContain('Activate after final approval')
    expect(paidCampaignPage).toContain('explicitPlatformActivationConfirmed: platformActivationAcknowledged === true')
    expect(paidCampaignPage).toContain('explicitSpendActivationConfirmed: spendActivationAcknowledged === true')
    expect(paidCampaignPage).toContain('explicitBudgetConfirmed: activationBudgetAcknowledged === true')
    expect(paidCampaignPage).toContain('I understand this may start ad delivery and spend')

    expect(metaApi).toContain('updateObjectStatus')
  })
})
