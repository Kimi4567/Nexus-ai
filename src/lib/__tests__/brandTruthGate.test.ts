import { describe, expect, it } from 'vitest'
import {
  hasBrandTruthVerificationFailure,
  isBrandTruthExecutionLocked,
} from '@/lib/brandTruthGate'

describe('Brand Brain truth gate', () => {
  it('locks execution while verification is still checking without calling it a failure', () => {
    expect(isBrandTruthExecutionLocked('checking')).toBe(true)
    expect(hasBrandTruthVerificationFailure('checking')).toBe(false)
  })

  it('renders failures only for blocked or unavailable truth', () => {
    expect(hasBrandTruthVerificationFailure('blocked')).toBe(true)
    expect(hasBrandTruthVerificationFailure('unavailable')).toBe(true)
    expect(hasBrandTruthVerificationFailure('passed')).toBe(false)
  })
})
