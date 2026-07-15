export interface ResearchSuggestionItem {
  title: string
  url: string
  source: string
  publishedAt: string
}

export interface ResearchSuggestionView {
  titleAr: string | null
  reasoningAr: string | null
  research: {
    kind: 'competitor' | 'industry'
    items: ResearchSuggestionItem[]
    autoLearningApplied: false
  } | null
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

export function isResearchMonitorPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const source = (payload as Record<string, unknown>).source
  return typeof source === 'string' && source.endsWith('research-monitor')
}

/**
 * Returns the safe, display-only research view stored by the scheduled monitors.
 * Reviewing this data never applies it to Brand Brain automatically.
 */
export function getResearchSuggestionView(payload: unknown): ResearchSuggestionView {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { titleAr: null, reasoningAr: null, research: null }
  }
  const record = payload as Record<string, unknown>
  const titleAr = text(record.titleAr, 240) || null
  const reasoningAr = text(record.reasoningAr, 1_200) || null
  if (!isResearchMonitorPayload(record)) return { titleAr, reasoningAr, research: null }

  const kind = record.researchKind === 'competitor' ? 'competitor' : 'industry'
  const rawItems = Array.isArray(record.items) ? record.items : []
  const seen = new Set<string>()
  const items: ResearchSuggestionItem[] = []
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue
    const item = rawItem as Record<string, unknown>
    const url = safeUrl(item.url)
    const title = text(item.title, 220)
    if (!url || !title || seen.has(url)) continue
    seen.add(url)
    items.push({
      title,
      url,
      source: text(item.source, 120),
      publishedAt: text(item.publishedAt, 80),
    })
    if (items.length === 12) break
  }

  return {
    titleAr,
    reasoningAr,
    research: {
      kind,
      items,
      autoLearningApplied: false,
    },
  }
}
