import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
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
      budgetSource: 'planning_assumption',
      budgetConfirmed: false,
    })
  })

  it('marks explicit positive budget as user-confirmed input', () => {
    expect(getBudgetTruth({ amount: 125, fallbackAmount: 20 })).toEqual({
      amount: 125,
      budgetSource: 'user_confirmed',
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
    })).toBe(true)
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: false,
      explicitBudgetConfirmed: true,
    })).toBe(false)
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: true,
      explicitBudgetConfirmed: false,
    })).toBe(false)
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: undefined,
      explicitBudgetConfirmed: undefined,
    })).toBe(false)
  })

  it('does not treat a positive daily budget as platform draft approval', () => {
    expect(getBudgetTruth({ amount: 250, fallbackAmount: 50 }).budgetConfirmed).toBe(true)
    expect(canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: true,
      explicitBudgetConfirmed: undefined,
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
  })

  it('keeps Meta platform creation paused and non-active in source', () => {
    const pushRoute = readFileSync(join(process.cwd(), 'src/app/api/ad-campaigns/[id]/push-to-platform/route.ts'), 'utf8')

    expect(pushRoute).toContain('canCreatePlatformDraft')
    expect(pushRoute).toContain('explicitPlatformDraftConfirmed')
    expect(pushRoute).toContain('explicitBudgetConfirmed')
    expect(pushRoute).toContain('Creating platform draft objects requires explicit confirmation')
    expect(pushRoute).toContain("status: 'PAUSED'")
    expect(pushRoute).toContain('mapPausedPlatformPushStatus')
    expect(pushRoute).not.toContain("status: 'ACTIVE'")
    expect(pushRoute).not.toContain('live push')
    expect(pushRoute).toContain('Platform draft objects were created in Meta in PAUSED state')
  })
})
