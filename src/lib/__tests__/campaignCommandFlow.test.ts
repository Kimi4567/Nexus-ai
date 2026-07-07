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
    expect(flow.steps.find(step => step.id === 'publishing')?.helperEn).toContain('explicit gates')
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
})
