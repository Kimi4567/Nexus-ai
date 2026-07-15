export type PaidStrategyRevisionState = 'current' | 'stale' | 'missing'

export interface PaidStrategyRevisionTruth {
  state: PaidStrategyRevisionState
  latestSnapshotId: string | null
  latestVersion: number | null
}

export function resolvePaidStrategyRevisionTruth(input: {
  pinnedSnapshotId?: string | null
  latestSnapshot?: { id: string; version: number } | null
}): PaidStrategyRevisionTruth {
  const pinnedSnapshotId = input.pinnedSnapshotId?.trim() || null
  const latestSnapshot = input.latestSnapshot ?? null

  return {
    state: !pinnedSnapshotId
      ? 'missing'
      : latestSnapshot?.id === pinnedSnapshotId
        ? 'current'
        : 'stale',
    latestSnapshotId: latestSnapshot?.id ?? null,
    latestVersion: latestSnapshot?.version ?? null,
  }
}
