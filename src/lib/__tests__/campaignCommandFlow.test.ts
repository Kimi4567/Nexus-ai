import { describe, expect, it } from 'vitest'
import { deriveCampaignCommandFlow } from '../campaignCommandFlow'
import type { CampaignOperatingState } from '../campaignOperatingState'

function makeOperatingState(
  overrides: Partial<Omit<CampaignOperatingState, 'counts' | 'truthFlags' | 'primaryAction'>> & {
    counts?: Partial<CampaignOperatingState['counts']>
    truthFlags?: Partial<CampaignOperatingState['truthFlags']>
    primaryAction?: Partial<CampaignOperatingState['primaryAction']>
  } = {},
): CampaignOperatingState {
  const base: CampaignOperatingState = {
    stage: 'content_review_needed',
    stageLabel: 'Draft content needs review',
    stageLabelAr: 'مسودات المحتوى تحتاج مراجعة',
    stageHelper: 'Draft content exists. Review it in Content Hub before scheduling or publishing.',
    stageHelperAr: 'توجد مسودات محتوى. راجعها في Content Hub قبل الجدولة أو النشر.',
    primaryAction: {
      label: 'Review content plan',
      labelAr: 'راجع خطة المحتوى',
      href: '/content-hub',
    },
    blockers: ['content_review'],
    counts: {
      totalPosts: 8,
      draftPosts: 8,
      approvedPosts: 0,
      scheduledPosts: 0,
      autoScheduledPosts: 0,
      manualScheduledPosts: 0,
      processingPosts: 0,
      publishedPosts: 0,
      apiPublishedPosts: 0,
      manualPublishedPosts: 0,
      analyticsReadyPosts: 0,
      failedPosts: 0,
      pendingGenerationPosts: 8,
    },
    truthFlags: {
      hasStrategy: true,
      hasContentPlan: true,
      hasDraftContent: true,
      hasApprovedContent: false,
      hasScheduledContent: false,
      hasAutoScheduledContent: false,
      hasProcessingContent: false,
      hasPublishedContent: false,
      hasApiPublishedContent: false,
      hasManualPublishedContent: false,
      hasAnalyticsData: false,
      hasPendingLearning: false,
      workflowEnabled: false,
      autoPublishEnabled: false,
    },
  }

  return {
    ...base,
    ...overrides,
    counts: {
      ...base.counts,
      ...overrides.counts,
    },
    truthFlags: {
      ...base.truthFlags,
      ...overrides.truthFlags,
    },
    primaryAction: {
      ...base.primaryAction,
      ...overrides.primaryAction,
    },
  }
}

describe('deriveCampaignCommandFlow', () => {
  it('makes a live Brand Brain conflict the first blocking decision even when completeness is 100', () => {
    const flow = deriveCampaignCommandFlow({
      campaignId: 'brand-conflict',
      operatingState: makeOperatingState(),
      brandScore: 100,
      brandTruthBlocked: true,
    })

    expect(flow.nextAction).toMatchObject({ href: '/brand', labelEn: 'Fix Brand Brain' })
    expect(flow.steps.find(step => step.id === 'brand')).toMatchObject({
      status: 'blocked',
      metricEn: 'Source truth conflict',
      metricAr: 'تعارض في مصدر الحقيقة',
    })
    expect(flow.steps.filter(step => step.id !== 'performance').every(step => step.status === 'blocked')).toBe(true)
    expect(flow.steps.find(step => step.id === 'strategy')?.metricEn).toBe('Blocked by Brand Brain')
    expect(flow.steps.find(step => step.id === 'content')?.metricEn).toBe('8 blocked reference records')
    expect(flow.steps.find(step => step.id === 'performance')).toMatchObject({
      status: 'pending',
      metricEn: 'No verified analytics',
    })
    expect(flow.boundaryEn).toContain('reference-only')
  })

  it('routes post-linked campaigns from content into creative before approval/publish work', () => {
    const flow = deriveCampaignCommandFlow({
      campaignId: 'campaign-1',
      operatingState: makeOperatingState(),
      creativeSummary: {
        total: 8,
        mediaNeeded: 8,
        readinessPending: 0,
        attachedToPost: 0,
      },
      publishSummary: {
        totalPosts: 8,
        scheduledNotPublished: 0,
        manualPublished: 0,
        manualPublishedWithoutUrl: 0,
        apiPublished: 0,
        autoScheduled: 0,
        hasConnectedPublishingAccount: false,
        hasAutopilotEnabled: false,
        hasAnalyticsData: false,
        safeCopy: {} as never,
      },
      brandScore: 82,
      includesPaidPlanning: false,
      hasCreativeBrief: false,
    })

    expect(flow.scopeLabelEn).toBe('Organic route')
    expect(flow.nextAction.titleEn).toBe('Resolve creative and media readiness')
    expect(flow.nextAction.href).toBe('/campaigns/campaign-1?tab=creative')
    expect(flow.steps.map(step => step.id)).toEqual([
      'brand',
      'strategy',
      'content',
      'creative',
      'approval',
      'publishing',
      'performance',
    ])
    expect(flow.steps.find(step => step.id === 'creative')?.status).toBe('current')
    expect(flow.steps.find(step => step.id === 'approval')?.status).toBe('review')
    expect(flow.steps.find(step => step.id === 'publishing')?.helperEn).toContain('explicit gates')
    expect(flow.steps.find(step => step.id === 'brand')?.metricEn).toBe('Core profile 82/100')
    expect(flow.steps.find(step => step.id === 'brand')?.helperEn).toContain('separate gates')
  })

  it('keeps paid-only campaigns framed as paid planning and readiness, not launch', () => {
    const flow = deriveCampaignCommandFlow({
      campaignId: 'paid-campaign',
      operatingState: makeOperatingState({
        stage: 'content_plan_missing',
        counts: {
          totalPosts: 0,
          draftPosts: 0,
          pendingGenerationPosts: 0,
        },
        truthFlags: {
          hasContentPlan: false,
          hasDraftContent: false,
        },
      }),
      creativeSummary: null,
      brandScore: 72,
      isPaidOnlyStrategy: true,
      includesPaidPlanning: true,
    })

    const allCopy = [
      flow.scopeLabelEn,
      flow.headlineEn,
      flow.helperEn,
      flow.boundaryEn,
      flow.nextAction.titleEn,
      flow.nextAction.helperEn,
      ...flow.steps.flatMap(step => [step.titleEn, step.helperEn, step.metricEn]),
    ].join(' ')

    expect(flow.scopeLabelEn).toBe('Paid planning route')
    expect(allCopy).not.toMatch(/\bready to launch\b|\blaunch now\b|\bspend approved\b/i)
    expect(flow.boundaryEn).toContain('paid launch')
    expect(flow.boundaryEn).toContain('explicit gate')
  })

  it('turns the next action into an in-place instruction when the user is already on Creative', () => {
    const flow = deriveCampaignCommandFlow({
      campaignId: 'campaign-creative',
      operatingState: makeOperatingState(),
      creativeSummary: {
        total: 8,
        mediaNeeded: 7,
        readinessPending: 0,
        attachedToPost: 0,
      },
      brandScore: 86,
      hasCreativeBrief: false,
      currentStepId: 'creative',
    })

    expect(flow.nextAction.titleEn).toBe('Continue here: resolve creative readiness')
    expect(flow.nextAction.labelEn).toBe('Review creative actions below')
    expect(flow.nextAction.href).toBe('#campaign-creative-work')
    expect(flow.nextAction.titleEn).not.toBe('Resolve creative and media readiness')
    expect(flow.nextAction.labelEn).not.toBe('Open Creative')
  })

  it('does not claim Content Hub is empty while post records are still loading', () => {
    const flow = deriveCampaignCommandFlow({
      campaignId: 'campaign-loading',
      operatingState: makeOperatingState({
        stage: 'strategy_review_needed',
        counts: {
          totalPosts: 0,
          draftPosts: 0,
          pendingGenerationPosts: 0,
        },
        truthFlags: {
          hasContentPlan: false,
          hasDraftContent: false,
        },
      }),
      brandScore: 88,
      operatingSnapshotsLoaded: false,
      currentStepId: 'strategy',
    })

    const allCopy = [
      flow.boundaryEn,
      flow.nextAction.titleEn,
      flow.nextAction.helperEn,
      ...flow.steps.flatMap(step => [step.metricEn, step.helperEn]),
    ].join(' ')

    expect(flow.nextAction.titleEn).toBe('Checking Content Hub state')
    expect(flow.nextAction.href).toBe('#campaign-operating-flow')
    expect(flow.steps.find(step => step.id === 'content')?.metricEn).toBe('Checking post records')
    expect(allCopy).not.toContain('No post plan yet')
    expect(allCopy).not.toContain('Build content plan')
  })

  it('does not convert manual publish records into analytics-backed learning', () => {
    const flow = deriveCampaignCommandFlow({
      campaignId: 'mixed-campaign',
      operatingState: makeOperatingState({
        stage: 'published_waiting_for_analytics',
        counts: {
          draftPosts: 0,
          totalPosts: 8,
          scheduledPosts: 7,
          publishedPosts: 1,
          manualPublishedPosts: 1,
          analyticsReadyPosts: 0,
          pendingGenerationPosts: 0,
        },
        truthFlags: {
          hasDraftContent: false,
          hasScheduledContent: true,
          hasPublishedContent: true,
          hasManualPublishedContent: true,
          hasAnalyticsData: false,
        },
      }),
      creativeSummary: {
        total: 8,
        mediaNeeded: 0,
        readinessPending: 0,
        attachedToPost: 1,
      },
      brandScore: 91,
      hasCreativeBrief: true,
    })

    expect(flow.nextAction.titleEn).toBe('Wait for real analytics before learning')
    expect(flow.nextAction.helperEn).toContain('Performance learning starts only after real analytics')
    expect(flow.steps.find(step => step.id === 'performance')?.status).toBe('current')
    expect(flow.steps.find(step => step.id === 'performance')?.metricEn).toBe('Analytics pending')
  })

  it('does not claim approval is complete when copy is approved but post media is pending', () => {
    const flow = deriveCampaignCommandFlow({
      campaignId: 'copy-approved-media-pending',
      operatingState: makeOperatingState({
        stage: 'content_approved_not_scheduled',
        counts: {
          totalPosts: 3,
          draftPosts: 0,
          approvedPosts: 3,
          pendingGenerationPosts: 3,
        },
        truthFlags: {
          hasDraftContent: false,
          hasApprovedContent: true,
        },
      }),
      creativeSummary: {
        total: 3,
        mediaNeeded: 3,
        readinessPending: 0,
        attachedToPost: 0,
      },
      brandScore: 93,
      hasCreativeBrief: true,
      currentStepId: 'publishing',
    })

    const approval = flow.steps.find(step => step.id === 'approval')

    expect(flow.nextAction.titleEn).toBe('Resolve creative and media readiness')
    expect(approval?.status).toBe('review')
    expect(approval?.helperEn).toBe(
      'Copy approval is saved. Media still needs review before scheduling or publishing.',
    )
    expect(approval?.metricEn).toBe('3 copy approved · 3 media pending')
    expect(approval?.metricAr).toBe('3 نص معتمد · 3 وسائط معلقة')
  })

  it('keeps video requirements in the creative and approval gates until media is attached', () => {
    const flow = deriveCampaignCommandFlow({
      campaignId: 'video-media-pending',
      operatingState: makeOperatingState({
        stage: 'content_approved_not_scheduled',
        counts: {
          totalPosts: 1,
          draftPosts: 0,
          approvedPosts: 1,
          pendingGenerationPosts: 1,
        },
        truthFlags: {
          hasDraftContent: false,
          hasApprovedContent: true,
        },
      }),
      creativeSummary: {
        total: 1,
        mediaNeeded: 0,
        readinessPending: 0,
        attachedToPost: 0,
      },
      brandScore: 90,
      hasCreativeBrief: true,
    })

    expect(flow.nextAction.titleEn).toBe('Resolve creative and media readiness')
    expect(flow.steps.find(step => step.id === 'creative')?.status).toBe('current')
    expect(flow.steps.find(step => step.id === 'approval')?.status).toBe('review')
    expect(flow.steps.find(step => step.id === 'approval')?.metricEn).toBe(
      '1 copy approved · 1 media pending',
    )
  })
})
