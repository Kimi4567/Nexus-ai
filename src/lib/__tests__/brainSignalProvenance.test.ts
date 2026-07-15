import { describe, expect, it } from 'vitest'
import {
  attachBrainSignalSources,
  collectExternalSignalSources,
  inspectBrainSignalProvenance,
} from '@/lib/brainSignalProvenance'
import { validPerformanceLearningEvidence } from '@/lib/__tests__/fixtures/performanceLearningEvidence'

describe('brainSignalProvenance', () => {
  it('collects only unique http sources from external findings', () => {
    const refs = collectExternalSignalSources('competitor_monitor', {
      findings: [
        { title: 'Launch', source: 'Example News', url: 'https://example.com/launch' },
        { title: 'Duplicate', source: 'Example News', url: 'https://example.com/launch' },
        { title: 'Unsafe', url: 'javascript:alert(1)' },
      ],
    })

    expect(refs).toEqual([{
      title: 'Launch',
      publisher: 'Example News',
      url: 'https://example.com/launch',
      publishedAt: undefined,
    }])
  })

  it('round-trips stored sources without exposing the storage marker', () => {
    const stored = attachBrainSignalSources('A sourced market signal.', [{
      url: 'https://example.com/report',
      publisher: 'Example Research',
    }])
    const result = inspectBrainSignalProvenance({
      trigger: 'industry_trend',
      reason: stored,
    })

    expect(result.traceability).toBe('external_sources')
    expect(result.canAccept).toBe(true)
    expect(result.displayReason).toBe('A sourced market signal.')
    expect(result.displayReason).not.toContain('NEXUS_SOURCE_REFS')
    expect(result.sourceRefs[0].url).toBe('https://example.com/report')
  })

  it('blocks an external claim when no traceable source is attached', () => {
    const result = inspectBrainSignalProvenance({
      trigger: 'competitor_monitor',
      reason: 'Competitor X is outperforming the market.',
    })

    expect(result.traceability).toBe('source_not_attached')
    expect(result.canAccept).toBe(false)
    expect(result.displayReason).toBe('')
  })

  it('keeps internal campaign review signals acceptable without an external URL', () => {
    const result = inspectBrainSignalProvenance({
      trigger: 'strategy',
      reason: 'The saved strategy uses a calm tone.',
      campaignId: 'campaign-1',
    })

    expect(result.traceability).toBe('campaign_record')
    expect(result.canAccept).toBe(true)
    expect(result.displayReason).toContain('saved strategy')
  })

  it('blocks a performance claim when its structured evidence is missing', () => {
    const result = inspectBrainSignalProvenance({
      trigger: 'post_performance',
      reason: 'Several posts performed better.',
    })

    expect(result.traceability).toBe('analytics_evidence')
    expect(result.canAccept).toBe(false)
    expect(result.evidence).toBeNull()
  })

  it('accepts a performance candidate only with a valid evidence contract', () => {
    const evidence = validPerformanceLearningEvidence()
    const result = inspectBrainSignalProvenance({
      trigger: 'post_performance',
      reason: 'Platform-local candidates for another test.',
      evidence,
    })

    expect(result.traceability).toBe('analytics_evidence')
    expect(result.canAccept).toBe(true)
    expect(result.evidence).toEqual(evidence)
  })
})
