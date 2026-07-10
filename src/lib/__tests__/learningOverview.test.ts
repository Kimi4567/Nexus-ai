import { describe, expect, it } from 'vitest'
import { summarizeLearningEvidence } from '@/lib/learningOverview'

describe('summarizeLearningEvidence', () => {
  it('keeps workflow and reviewed preference signals separate from performance learning', () => {
    const summary = summarizeLearningEvidence({
      learningSignals: [
        { id: 'approved', trigger: 'approved_content', status: 'accepted' },
        { id: 'variant', trigger: 'user_selected_variant', status: 'accepted' },
      ],
      workflowSignals: [{ id: 'scheduled', eventType: 'POST_SCHEDULED' }],
      performanceEvidenceRows: 0,
    })

    expect(summary.stage).toBe('signals_building')
    expect(summary.counts.reviewedSignals).toBe(2)
    expect(summary.counts.workflowSignals).toBe(1)
    expect(summary.counts.analyticsBackedLessons).toBe(0)
  })

  it('does not call a post-performance row analytics-backed without current evidence', () => {
    const summary = summarizeLearningEvidence({
      learningSignals: [{ id: 'performance', trigger: 'post_performance', status: 'accepted' }],
      workflowSignals: [],
      performanceEvidenceRows: 0,
    })

    expect(summary.stage).toBe('empty')
    expect(summary.counts.analyticsBackedLessons).toBe(0)
    expect(summary.recentSignals[0].source).toBe('review_signal')
  })

  it('unlocks analytics-backed lessons only when real performance evidence exists', () => {
    const summary = summarizeLearningEvidence({
      learningSignals: [{ id: 'performance', trigger: 'post_performance', status: 'accepted' }],
      workflowSignals: [],
      performanceEvidenceRows: 3,
    })

    expect(summary.stage).toBe('analytics_backed')
    expect(summary.counts.analyticsBackedLessons).toBe(1)
    expect(summary.recentSignals[0].source).toBe('analytics')
  })
})
