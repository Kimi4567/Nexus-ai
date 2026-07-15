import { describe, expect, it } from 'vitest'
import { resolvePaidStrategyRevisionTruth } from '@/lib/paidStrategyRevision'

describe('paid strategy revision truth', () => {
  it('distinguishes a current pin from a stale or missing one', () => {
    const latestSnapshot = { id: 'snapshot-2', version: 2 }

    expect(resolvePaidStrategyRevisionTruth({
      pinnedSnapshotId: 'snapshot-2',
      latestSnapshot,
    })).toEqual({
      state: 'current',
      latestSnapshotId: 'snapshot-2',
      latestVersion: 2,
    })
    expect(resolvePaidStrategyRevisionTruth({
      pinnedSnapshotId: 'snapshot-1',
      latestSnapshot,
    })).toMatchObject({ state: 'stale', latestVersion: 2 })
    expect(resolvePaidStrategyRevisionTruth({
      pinnedSnapshotId: null,
      latestSnapshot,
    })).toMatchObject({ state: 'missing', latestVersion: 2 })
  })

  it('does not call a pin current when the source snapshot is unavailable', () => {
    expect(resolvePaidStrategyRevisionTruth({ pinnedSnapshotId: 'snapshot-1', latestSnapshot: null }))
      .toEqual({ state: 'stale', latestSnapshotId: null, latestVersion: null })
  })
})
