import { readPerformanceLearningEvidence } from '@/lib/learningEvidence'

export type BrainSignalTraceability =
  | 'analytics_evidence'
  | 'campaign_record'
  | 'external_sources'
  | 'source_not_attached'
  | 'internal_signal'

export interface BrainSignalSourceRef {
  url: string
  title?: string
  publisher?: string
  publishedAt?: string
}

const SOURCE_MARKER = '[NEXUS_SOURCE_REFS:'
const EXTERNAL_TRIGGERS = new Set(['competitor_monitor', 'industry_trend'])

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : undefined
}

function normalizeSourceRefs(value: unknown): BrainSignalSourceRef[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((raw): BrainSignalSourceRef[] => {
    if (!raw || typeof raw !== 'object') return []
    const source = raw as Record<string, unknown>
    const url = safeHttpUrl(source.url)
    if (!url || seen.has(url)) return []
    seen.add(url)
    return [{
      url,
      title: optionalText(source.title, 220),
      publisher: optionalText(source.publisher, 120),
      publishedAt: optionalText(source.publishedAt, 80),
    }]
  }).slice(0, 8)
}

export function collectExternalSignalSources(
  trigger: string | null | undefined,
  payload: Record<string, unknown>,
): BrainSignalSourceRef[] {
  if (!trigger || !EXTERNAL_TRIGGERS.has(trigger)) return []

  const findings = Array.isArray(payload.findings) ? payload.findings : []
  const seen = new Set<string>()
  const refs: BrainSignalSourceRef[] = []

  for (const raw of findings) {
    if (!raw || typeof raw !== 'object') continue
    const finding = raw as Record<string, unknown>
    const url = safeHttpUrl(finding.url)
    if (!url || seen.has(url)) continue
    seen.add(url)
    refs.push({
      url,
      title: optionalText(finding.title, 220),
      publisher: optionalText(finding.source, 120),
      publishedAt: optionalText(finding.publishedAt, 80),
    })
    if (refs.length === 8) break
  }

  return refs
}

export function attachBrainSignalSources(reason: string, refs: BrainSignalSourceRef[]): string {
  if (refs.length === 0) return reason.trim()
  const encoded = encodeURIComponent(JSON.stringify(refs))
  return `${reason.trim()}\n\n${SOURCE_MARKER}${encoded}]`
}

function parseStoredSources(reason: string): { reason: string; refs: BrainSignalSourceRef[] } {
  const markerIndex = reason.lastIndexOf(SOURCE_MARKER)
  if (markerIndex < 0) return { reason: reason.trim(), refs: [] }

  const markerEnd = reason.indexOf(']', markerIndex)
  if (markerEnd < 0) return { reason: reason.trim(), refs: [] }

  const encoded = reason.slice(markerIndex + SOURCE_MARKER.length, markerEnd)
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded))
    const refs = normalizeSourceRefs(parsed)
    return {
      reason: `${reason.slice(0, markerIndex)}${reason.slice(markerEnd + 1)}`.trim(),
      refs,
    }
  } catch {
    return { reason: reason.slice(0, markerIndex).trim(), refs: [] }
  }
}

export function inspectBrainSignalProvenance({
  trigger,
  reason,
  campaignId,
  sourceRefs,
  evidence,
}: {
  trigger?: string | null
  reason?: string | null
  campaignId?: string | null
  sourceRefs?: unknown
  evidence?: unknown
}) {
  const stored = parseStoredSources(reason || '')
  const refs = stored.refs.length > 0 ? stored.refs : normalizeSourceRefs(sourceRefs)

  if (trigger === 'post_performance') {
    const contract = readPerformanceLearningEvidence(evidence)
    return {
      traceability: 'analytics_evidence' as const,
      sourceRefs: refs,
      displayReason: stored.reason,
      canAccept: Boolean(contract),
      evidence: contract,
    }
  }

  if (trigger && EXTERNAL_TRIGGERS.has(trigger)) {
    const traceable = refs.length > 0
    return {
      traceability: traceable ? 'external_sources' as const : 'source_not_attached' as const,
      sourceRefs: refs,
      displayReason: traceable ? stored.reason : '',
      canAccept: traceable,
    }
  }

  return {
    traceability: campaignId ? 'campaign_record' as const : 'internal_signal' as const,
    sourceRefs: refs,
    displayReason: stored.reason,
    canAccept: true,
  }
}

export function isExternalSignalTrigger(trigger: string | null | undefined): boolean {
  return Boolean(trigger && EXTERNAL_TRIGGERS.has(trigger))
}
