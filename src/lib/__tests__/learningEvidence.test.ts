import { describe, expect, it } from 'vitest'
import {
  planPerformanceLearningRollback,
  readPerformanceLearningEvidence,
} from '@/lib/learningEvidence'
import { validPerformanceLearningEvidence } from '@/lib/__tests__/fixtures/performanceLearningEvidence'

describe('performance learning evidence', () => {
  it('accepts a complete platform-local, non-causal evidence contract', () => {
    expect(readPerformanceLearningEvidence(validPerformanceLearningEvidence())).not.toBeNull()
  })

  it.each([
    ['missing source', { source: undefined }],
    ['causal claim', { causalClaim: true }],
    ['unsupported platform', { platform: 'ALL' }],
  ])('rejects %s', (_label, change) => {
    expect(readPerformanceLearningEvidence({ ...validPerformanceLearningEvidence(), ...change })).toBeNull()
  })

  it('rejects insufficient samples, inconsistent winners, weak thresholds, and missing rollback state', () => {
    const valid = validPerformanceLearningEvidence()
    expect(readPerformanceLearningEvidence({
      ...valid,
      sample: { ...valid.sample, eligiblePosts: 4 },
    })).toBeNull()
    expect(readPerformanceLearningEvidence({
      ...valid,
      sample: { ...valid.sample, aboveThresholdPosts: 4 },
    })).toBeNull()
    expect(readPerformanceLearningEvidence({
      ...valid,
      comparison: { ...valid.comparison, candidateThresholdEngagementRate: 1.6 },
    })).toBeNull()
    expect(readPerformanceLearningEvidence({
      ...valid,
      rollback: { ...valid.rollback, previousValue: undefined },
    })).toBeNull()
  })

  it('rolls back only values this accepted decision actually added', () => {
    const plan = planPerformanceLearningRollback({
      proposalId: 'proposal-1',
      field: 'winningHooks',
      evidence: validPerformanceLearningEvidence(),
      currentValue: ['An existing hook', 'A new evidence-backed hook', 'A later user hook'],
      acceptanceMetadata: {
        proposalId: 'proposal-1',
        previousValue: ['An existing hook'],
        appliedValue: ['An existing hook', 'A new evidence-backed hook'],
      },
    })

    expect(plan).toEqual({
      field: 'winningHooks',
      addedValues: ['A new evidence-backed hook'],
      removedValues: ['A new evidence-backed hook'],
      nextValue: ['An existing hook', 'A later user hook'],
    })
  })

  it('fails closed when the acceptance ledger belongs to another proposal', () => {
    expect(planPerformanceLearningRollback({
      proposalId: 'proposal-1',
      field: 'winningHooks',
      evidence: validPerformanceLearningEvidence(),
      currentValue: ['A new evidence-backed hook'],
      acceptanceMetadata: {
        proposalId: 'proposal-2',
        previousValue: [],
        appliedValue: ['A new evidence-backed hook'],
      },
    })).toBeNull()
  })
})
