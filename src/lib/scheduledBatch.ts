export type ScheduledBatchCadence = 'daily' | 'weekly'

const DAY_MS = 24 * 60 * 60 * 1_000

/**
 * Picks a deterministic rotating batch so capped cron jobs do not process the
 * same first rows forever as the product grows.
 */
export function scheduledBatchOffset(
  totalRecords: number,
  batchSize: number,
  now: Date,
  cadence: ScheduledBatchCadence,
): number {
  if (!Number.isFinite(totalRecords) || !Number.isFinite(batchSize)) return 0
  const total = Math.max(0, Math.floor(totalRecords))
  const size = Math.max(1, Math.floor(batchSize))
  if (total <= size) return 0

  const periodMs = cadence === 'weekly' ? DAY_MS * 7 : DAY_MS
  const runNumber = Math.floor(now.getTime() / periodMs)
  return (runNumber * size) % total
}
