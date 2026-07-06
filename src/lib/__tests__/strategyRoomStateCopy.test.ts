import { describe, expect, it } from 'vitest'
import { deriveStrategyRoomStateCopy } from '@/lib/strategyRoomStateCopy'

describe('deriveStrategyRoomStateCopy', () => {
  it('uses neutral loading copy until Content Hub post state is known', () => {
    const copy = deriveStrategyRoomStateCopy({
      locale: 'en',
      isPaidOnlyStrategy: false,
      hasContentPlan: false,
      operatingSnapshotsLoaded: false,
    })

    expect(copy.checklist.title).toBe('Checking Content Hub state')
    expect(copy.guidance.brief).toContain('checking whether Content Hub post records already exist')
    expect(copy.nextDecision).toContain('finish loading')
    expect(copy.organicPlanValue).toBe('Checking Content Hub state')
    expect(copy.contentPlanStatusValue).toBe('Checking Content Hub state')
    expect(copy.contentHubCta).toBe('Open Content Hub')
    expect(copy.contentHooks.title).toBe('Checking Content Hub state')
    expect(copy.contentHooks.helper).not.toContain('Final post previews do not exist')
    expect(copy.checklist.title).not.toBe('Before Content Hub checklist')
    expect(copy.guidance.brief).not.toContain('before building the first content plan')
  })

  it('uses Arabic neutral loading copy until Content Hub post state is known', () => {
    const copy = deriveStrategyRoomStateCopy({
      locale: 'ar',
      isPaidOnlyStrategy: false,
      hasContentPlan: false,
      operatingSnapshotsLoaded: false,
    })

    expect(copy.checklist.title).toBe('جارٍ التحقق من حالة Content Hub')
    expect(copy.guidance.brief).toContain('يتحقق NEXUS الآن')
    expect(copy.nextDecision).toContain('اكتمال التحقق من Content Hub')
    expect(copy.contentPlanStatusValue).toBe('جارٍ التحقق من Content Hub')
    expect(copy.contentHooks.helper).not.toContain('لا توجد معاينات منشورات نهائية')
    expect(copy.checklist.title).not.toBe('قائمة ما قبل Content Hub')
  })

  it('shows content-aware review copy after Content Hub posts are loaded', () => {
    const copy = deriveStrategyRoomStateCopy({
      locale: 'en',
      isPaidOnlyStrategy: false,
      hasContentPlan: true,
      operatingSnapshotsLoaded: true,
    })

    expect(copy.checklist.title).toBe('Strategy review checklist')
    expect(copy.checklist.helper).toContain('content already in Content Hub')
    expect(copy.guidance.brief).toContain('Content Hub for the current post and execution state')
    expect(copy.organicPlanValue).toBe('Available for review in Content Hub')
    expect(copy.contentPlanTone).toBe('positive')
    expect(copy.contentHooks.cta).toBe('Review final post previews')
  })

  it('shows pre-Content Hub copy only after post state is loaded and no content plan exists', () => {
    const copy = deriveStrategyRoomStateCopy({
      locale: 'en',
      isPaidOnlyStrategy: false,
      hasContentPlan: false,
      operatingSnapshotsLoaded: true,
    })

    expect(copy.checklist.title).toBe('Before Content Hub checklist')
    expect(copy.guidance.brief).toContain('before building the first content plan')
    expect(copy.contentPlanStatusValue).toBe('Prepare it after strategy review')
    expect(copy.contentHooks.helper).toContain('Final post previews do not exist')
  })

  it('keeps paid-only strategy copy independent from Content Hub loading state', () => {
    const copy = deriveStrategyRoomStateCopy({
      locale: 'en',
      isPaidOnlyStrategy: true,
      hasContentPlan: false,
      operatingSnapshotsLoaded: false,
    })

    expect(copy.checklist.title).toBe('Paid planning review checklist')
    expect(copy.nextDecision).toContain('paid planning brief')
    expect(copy.organicPlanValue).toBe('Not included in this run')
    expect(copy.contentPlanStatusValue).toBe('Not created in a Paid-only run')
    expect(copy.contentHooks.title).toContain('paid planning brief')
  })
})
