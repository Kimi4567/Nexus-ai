/**
 * Trust & Reliability Sprint #1 — post-engine decision logic.
 *
 * Proves a failed strategy is NEVER treated as success (no route to Content Hub)
 * and that the refund flag is surfaced. The campaign wizard branches solely on
 * decidePostEngine(), so these cases pin the control flow that previously had a
 * bare non-fatal catch swallow.
 */

import { describe, it, expect } from 'vitest'
import { decidePostEngine } from '../strategyOutcome'

describe('decidePostEngine', () => {
  it('proceeds only when the engine succeeds (2xx)', () => {
    expect(decidePostEngine(200, true, { campaign: {} })).toEqual({ kind: 'proceed' })
  })

  it('does NOT proceed when the strategy fails — returns a failure outcome', () => {
    const outcome = decidePostEngine(500, false, { error: 'NEXUS Engine failed', refunded: true, stage: 'strategy' })
    expect(outcome.kind).toBe('failed')
    expect(outcome.kind).not.toBe('proceed') // never route to Content Hub on failure
  })

  it('surfaces refunded:true from the failure body', () => {
    const outcome = decidePostEngine(500, false, { refunded: true })
    expect(outcome).toEqual({ kind: 'failed', refunded: true })
  })

  it('reports refunded:false when the body says credits were not refunded', () => {
    const outcome = decidePostEngine(500, false, { refunded: false })
    expect(outcome).toEqual({ kind: 'failed', refunded: false })
  })

  it('treats a missing/garbled body as failed with refunded:false (still no proceed)', () => {
    expect(decidePostEngine(500, false, null)).toEqual({ kind: 'failed', refunded: false })
    expect(decidePostEngine(503, false, undefined)).toEqual({ kind: 'failed', refunded: false })
  })

  it('routes 402 (out of credits) to upgrade — not to success', () => {
    const outcome = decidePostEngine(402, false, { error: 'Insufficient credits' })
    expect(outcome.kind).toBe('upgrade')
    expect(outcome.kind).not.toBe('proceed')
  })
})
