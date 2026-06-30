/**
 * Brain Timeline — Operator Foundation PR-1B ("Brand Brain Signals")
 *
 * PURE, READ-ONLY derivation. No network, no I/O, no side effects.
 * Turns the data already returned by the existing GET routes into an honest,
 * conservative "Brand Brain Signals" timeline:
 *   - GET /api/brain/proposals?status=pending   → pending learnings (Suggested)
 *   - GET /api/brain/score-history (.updates)    → accepted/dismissed learnings (Applied/Dismissed)
 *
 * Non-negotiable honesty rules (enforced here, asserted in tests):
 *   - Every item is backed by a REAL BrainLearning row. Nothing is fabricated.
 *   - status 'pending'  → 'suggested' ONLY
 *   - status 'accepted' → 'applied'   ONLY
 *   - status 'dismissed'→ 'dismissed' ONLY
 *   - source 'post_performance' ONLY when trigger === 'post_performance'
 *   - Raw `field`, `proposed` JSON, and trigger enums are NEVER exposed; we return
 *     i18n KEYS + a human field label so the UI renders EN/AR plain-business copy.
 *   - Zero rows → zero items (the UI then shows an honest empty state).
 */

export type TimelineStatus = 'suggested' | 'applied' | 'dismissed'

export type TimelineSource =
  | 'strategy'
  | 'approved_content'
  | 'post_performance'
  | 'user_selected_variant'
  | 'sentinel_insight'
  | 'competitor_monitor'
  | 'industry_trend'
  | 'unknown'

/** Minimal shape of a BrainLearning row from either existing GET route (read-only). */
export interface RawLearning {
  id?: string | null
  field?: string | null
  displayName?: string | null
  icon?: string | null
  trigger?: string | null
  reason?: string | null
  status?: string | null
  campaignId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface TimelineItem {
  id: string
  status: TimelineStatus
  source: TimelineSource
  /** i18n key for the status chip, e.g. 'brain.timeline.status.suggested' */
  statusKey: string
  /** i18n key for the source chip, or null when source is unknown (no chip) */
  sourceKey: string | null
  /** raw Brand Brain field key (used only to look up a localized label; never rendered raw) */
  field: string
  /** stored human field label (English) — fallback when no localized label exists */
  displayName: string
  /** the stored, user-facing reason text — rendered verbatim as the body */
  reason: string
  /** stored emoji icon for the field, if any */
  icon: string | null
  /** linked campaign id, or null — gates the "View related campaign" CTA */
  campaignId: string | null
  /** ISO timestamp used for ordering + display (createdAt for pending, updatedAt for history) */
  at: string | null
  /** true only for suggested items → enables Accept / Dismiss */
  canAccept: boolean
  /** true only when a real campaignId exists → enables "View related campaign" */
  canViewCampaign: boolean
}

const B = 'brain.timeline'

const KNOWN_SOURCES: ReadonlySet<string> = new Set([
  'strategy',
  'approved_content',
  'post_performance',
  'ab_winner',
  'sentinel_insight',
  'competitor_monitor',
  'industry_trend',
])

/**
 * Localized labels for the known learnable Brand Brain fields.
 * Mirrors LEARNABLE_FIELDS in api/brain/learn (single source of truth for copy),
 * so the timeline title reads as plain business language in both locales.
 * Unknown fields fall back to the row's stored `displayName`.
 */
export const FIELD_LABELS: Record<string, { en: string; ar: string }> = {
  winningHooks:       { en: 'Hook Signals',          ar: 'إشارات الخطافات' },
  winningAngles:      { en: 'Content Angle Signals', ar: 'إشارات زوايا المحتوى' },
  toneKeywords:       { en: 'Brand Tone',           ar: 'أسلوب العلامة' },
  audiencePainPoints: { en: 'Audience Pain Points', ar: 'مشاكل الجمهور' },
  audienceDesires:    { en: 'Audience Desires',     ar: 'رغبات الجمهور' },
  uniqueAdvantages:   { en: 'Unique Advantages',    ar: 'المزايا الفريدة' },
  strategicNotes:     { en: 'Strategic Notes',      ar: 'ملاحظات استراتيجية' },
}

/** Resolve a plain-business field label for the given locale (fallback: stored displayName). */
export function fieldLabel(item: Pick<TimelineItem, 'field' | 'displayName'>, locale: string): string {
  const entry = FIELD_LABELS[item.field]
  if (entry) return locale === 'ar' ? entry.ar : entry.en
  return item.displayName || ''
}

function mapStatus(raw?: string | null): TimelineStatus | null {
  switch (raw) {
    case 'pending':
      return 'suggested'
    case 'accepted':
      return 'applied'
    case 'dismissed':
      return 'dismissed'
    default:
      return null // unknown status → not shown (never fabricate)
  }
}

function mapSource(trigger?: string | null): TimelineSource {
  if (trigger === 'ab_winner') return 'user_selected_variant'
  if (trigger && KNOWN_SOURCES.has(trigger)) return trigger as TimelineSource
  return 'unknown'
}

const STATUS_KEY: Record<TimelineStatus, string> = {
  suggested: `${B}.status.suggested`,
  applied: `${B}.status.applied`,
  dismissed: `${B}.status.dismissed`,
}

function toItem(raw: RawLearning): TimelineItem | null {
  const status = mapStatus(raw.status)
  if (!status) return null
  if (!raw.id) return null

  const source = mapSource(raw.trigger)
  const campaignId = typeof raw.campaignId === 'string' && raw.campaignId.length > 0 ? raw.campaignId : null
  // history items carry updatedAt; pending items carry createdAt
  const at = (status === 'suggested' ? raw.createdAt : raw.updatedAt) || raw.updatedAt || raw.createdAt || null

  return {
    id: raw.id,
    status,
    source,
    statusKey: STATUS_KEY[status],
    sourceKey: source === 'unknown' ? null : `${B}.source.${source}`,
    field: raw.field || '',
    displayName: raw.displayName || '',
    reason: raw.reason || '',
    icon: raw.icon ?? null,
    campaignId,
    at,
    canAccept: status === 'suggested',
    canViewCampaign: campaignId !== null,
  }
}

function ts(at: string | null): number {
  if (!at) return 0
  const n = Date.parse(at)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Build the honest timeline from the two existing read-only sources.
 * @param pending  rows from GET /api/brain/proposals?status=pending
 * @param history  rows from GET /api/brain/score-history (.updates — accepted/dismissed)
 * Order: Suggested first (newest first), then Applied/Dismissed history (newest first).
 * De-duplicates by id (a row can only be in one bucket, but we guard anyway).
 */
export function deriveBrainTimeline(
  pending: RawLearning[] | null | undefined,
  history: RawLearning[] | null | undefined,
): TimelineItem[] {
  const seen = new Set<string>()
  const suggested: TimelineItem[] = []
  const past: TimelineItem[] = []

  for (const raw of Array.isArray(pending) ? pending : []) {
    const item = toItem(raw)
    if (item && item.status === 'suggested' && !seen.has(item.id)) {
      seen.add(item.id)
      suggested.push(item)
    }
  }
  for (const raw of Array.isArray(history) ? history : []) {
    const item = toItem(raw)
    if (item && (item.status === 'applied' || item.status === 'dismissed') && !seen.has(item.id)) {
      seen.add(item.id)
      past.push(item)
    }
  }

  suggested.sort((a, b) => ts(b.at) - ts(a.at))
  past.sort((a, b) => ts(b.at) - ts(a.at))
  return [...suggested, ...past]
}

export interface LearningSummary {
  appliedCount: number
  pendingCount: number
  /** 'empty' = nothing yet · 'hasLearned' = ≥1 applied · 'pendingOnly' = only suggestions exist */
  mode: 'empty' | 'hasLearned' | 'pendingOnly'
}

/** Compact summary for the single dashboard line (counts only — never fabricated). */
export function summarizeLearning(items: TimelineItem[] | null | undefined): LearningSummary {
  const list = Array.isArray(items) ? items : []
  const appliedCount = list.filter((i) => i.status === 'applied').length
  const pendingCount = list.filter((i) => i.status === 'suggested').length
  const mode: LearningSummary['mode'] =
    appliedCount > 0 ? 'hasLearned' : pendingCount > 0 ? 'pendingOnly' : 'empty'
  return { appliedCount, pendingCount, mode }
}
