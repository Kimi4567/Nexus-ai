export type StrategyEvidenceStatus = 'source_linked' | 'brand_brain_entry'

export interface StrategyEvidenceItem {
  statement: string
  status: StrategyEvidenceStatus
  sourceName: string | null
  sourceLocator: string | null
}

const SOURCE_SUFFIX = /\s*\[Source:\s*([^\]]+)\]\s*$/iu
const SOURCE_PART_SEPARATOR = /\s+—\s+/u

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Builds a provenance snapshot from Brand Brain proof entries. This is a
 * deterministic server-owned ledger: the strategist model never writes or
 * upgrades evidence status.
 */
export function buildStrategyEvidenceLedger(
  verifiedProof: readonly string[] | null | undefined,
): StrategyEvidenceItem[] {
  if (!Array.isArray(verifiedProof)) return []

  const items: StrategyEvidenceItem[] = []
  const seen = new Set<string>()

  for (const rawProof of verifiedProof) {
    const proof = clean(rawProof)
    if (!proof) continue

    const sourceMatch = proof.match(SOURCE_SUFFIX)
    const statement = sourceMatch
      ? proof.slice(0, sourceMatch.index).trim()
      : proof
    if (!statement) continue

    const sourceParts = sourceMatch
      ? sourceMatch[1].split(SOURCE_PART_SEPARATOR).map(part => part.trim()).filter(Boolean)
      : []
    const item: StrategyEvidenceItem = {
      statement,
      status: sourceMatch ? 'source_linked' : 'brand_brain_entry',
      sourceName: sourceParts[0] || null,
      sourceLocator: sourceParts.length > 1 ? sourceParts.slice(1).join(' — ') : null,
    }
    const key = `${item.statement.toLocaleLowerCase()}|${item.sourceName || ''}|${item.sourceLocator || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }

  return items
}

/** Safely reads saved strategy ledgers, including older or malformed records. */
export function normalizeStrategyEvidenceLedger(value: unknown): StrategyEvidenceItem[] {
  if (!Array.isArray(value)) return []

  const items: StrategyEvidenceItem[] = []
  const seen = new Set<string>()
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const record = candidate as Record<string, unknown>
    const statement = clean(record.statement)
    if (!statement) continue
    const status: StrategyEvidenceStatus = record.status === 'source_linked'
      ? 'source_linked'
      : 'brand_brain_entry'
    const item: StrategyEvidenceItem = {
      statement,
      status,
      sourceName: clean(record.sourceName) || null,
      sourceLocator: clean(record.sourceLocator) || null,
    }
    if (status === 'brand_brain_entry') {
      item.sourceName = null
      item.sourceLocator = null
    }
    const key = `${item.statement.toLocaleLowerCase()}|${item.sourceName || ''}|${item.sourceLocator || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  return items
}
