import { describe, expect, it } from 'vitest'
import { summarizeLearningEvidence } from '@/lib/learningOverview'
import { validPerformanceLearningEvidence } from '@/lib/__tests__/fixtures/performanceLearningEvidence'

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
      learningSignals: [{
        id: 'performance',
        trigger: 'post_performance',
        status: 'accepted',
        evidence: validPerformanceLearningEvidence(),
      }],
      workflowSignals: [],
      performanceEvidenceRows: 3,
      eligiblePerformancePostIds: ['post-1', 'post-2', 'post-3'],
    })

    expect(summary.stage).toBe('analytics_backed')
    expect(summary.counts.analyticsBackedLessons).toBe(1)
    expect(summary.recentSignals[0].source).toBe('analytics')
  })

  it('does not label a legacy accepted row as analytics-backed when its evidence contract is invalid', () => {
    const summary = summarizeLearningEvidence({
      learningSignals: [{ id: 'legacy-performance', trigger: 'post_performance', status: 'accepted' }],
      workflowSignals: [],
      performanceEvidenceRows: 3,
      eligiblePerformancePostIds: ['post-1'],
    })

    expect(summary.stage).toBe('empty')
    expect(summary.counts.analyticsBackedLessons).toBe(0)
    expect(summary.recentSignals[0].canAccept).toBe(false)
  })

  it('counts rolled-back lessons without presenting them as active analytics learning', () => {
    const summary = summarizeLearningEvidence({
      learningSignals: [{
        id: 'rolled-back',
        trigger: 'post_performance',
        status: 'rolled_back',
        evidence: validPerformanceLearningEvidence(),
      }],
      workflowSignals: [],
      performanceEvidenceRows: 3,
      eligiblePerformancePostIds: ['post-1'],
    })

    expect(summary.counts.rolledBackLessons).toBe(1)
    expect(summary.counts.analyticsBackedLessons).toBe(0)
    expect(summary.stage).toBe('empty')
  })

  it('withholds untraceable external claims and counts them explicitly', () => {
    const summary = summarizeLearningEvidence({
      learningSignals: [{
        id: 'external',
        trigger: 'competitor_monitor',
        status: 'pending',
        reason: 'A competitor is allegedly growing quickly.',
      }],
      workflowSignals: [],
      performanceEvidenceRows: 0,
    })

    expect(summary.counts.untraceableExternalSignals).toBe(1)
    expect(summary.recentSignals[0].traceability).toBe('source_not_attached')
    expect(summary.recentSignals[0].canAccept).toBe(false)
    expect(summary.recentSignals[0].reason).toBe('')
  })

  it('does not combine unrelated performance rows with a learning proposal', () => {
    const summary = summarizeLearningEvidence({
      learningSignals: [{
        id: 'performance',
        trigger: 'post_performance',
        status: 'accepted',
        evidence: validPerformanceLearningEvidence(),
      }],
      workflowSignals: [],
      performanceEvidenceRows: 1,
      eligiblePerformancePostIds: ['another-post'],
    })

    expect(summary.counts.acceptedSignals).toBe(1)
    expect(summary.counts.analyticsBackedLessons).toBe(0)
    expect(summary.recentSignals[0].source).toBe('review_signal')
    expect(summary.stage).toBe('empty')
  })

  it('returns the complete decision set while keeping the recent preview bounded', () => {
    const learningSignals = Array.from({ length: 12 }, (_, index) => ({
      id: `signal-${index}`,
      trigger: 'approved_content',
      status: 'pending',
      field: 'winningHooks',
      current: ['Existing hook'],
      proposed: [`Candidate hook ${index}`],
      updatedAt: new Date(`2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
    }))
    const summary = summarizeLearningEvidence({ learningSignals, workflowSignals: [], performanceEvidenceRows: 0 })

    expect(summary.counts.totalSignals).toBe(12)
    expect(summary.signals).toHaveLength(12)
    expect(summary.recentSignals).toHaveLength(8)
    expect(summary.signals[0]).toMatchObject({
      id: 'signal-11',
      current: ['Existing hook'],
      proposed: ['Candidate hook 11'],
    })
  })
})
