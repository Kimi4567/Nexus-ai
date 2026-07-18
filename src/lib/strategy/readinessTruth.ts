function recordValue(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key]
  }
  return undefined
}

const COMPLETE_STATUSES = new Set(['ready', 'complete', 'completed', 'done', 'approved', 'available'])

export function isReadinessItemComplete(item: unknown): boolean {
  const explicit = recordValue(item, ['done', 'complete', 'ready'])
  if (explicit === true) return true
  if (explicit === false) return false

  const status = String(recordValue(item, ['status']) || '').trim().toLowerCase()
  return COMPLETE_STATUSES.has(status)
}

export function countPendingReadinessItems(items: unknown[]): number {
  return items.filter(item => !isReadinessItemComplete(item)).length
}
