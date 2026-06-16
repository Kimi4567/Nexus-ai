/**
 * PR-1N — Dashboard "Marketing Operating Brief / Status checks" status truth.
 *
 * Pure, display-only helpers that turn already-trusted state into honest copy for
 * the Operating Brief widget. They invent NO new readiness score and read NO data
 * directly: callers pass in counts/status that already come from the real sources
 * (publishedPosts/scheduledPosts/draftPosts in marketing-intelligence.ts and the
 * Brand Brain maturity status from calculateBrandMaturity()).
 *
 * Why this exists: the Brief was showing two things that read as "done" when they
 * were not — "Brand memory 100%" (an 8-field tick count) next to a 72/Building
 * Brand Brain, and a green "Publishing ✓" tile while 0 posts were live. These
 * helpers map state → calm, accurate labels so the widget can never claim
 * published/complete work that does not exist.
 */

export type PublishingState = 'live' | 'scheduled' | 'pending' | 'none'

export type StatusSeverity = 'good' | 'watch' | 'risk'

/** Maturity status from calculateBrandMaturity(): active ≥ 80, building 50–79, else needs_data. */
export type BrandMemoryStatus = 'needs_data' | 'building' | 'active' | null | undefined

/**
 * Derive the publishing state from real post counts.
 *
 * Order matters — the most "live" truthful state wins:
 *   published > 0  → 'live'      (platform-confirmed published content exists)
 *   scheduled > 0  → 'scheduled' (queued, NOT live yet)
 *   pending > 0    → 'pending'   (drafts/approved content, not scheduled)
 *   otherwise      → 'none'      (nothing to publish)
 *
 * `pending` is content that exists but is not scheduled (e.g. drafts).
 */
export function derivePublishingState(counts: {
  published?: number | null
  scheduled?: number | null
  pending?: number | null
}): PublishingState {
  const published = Math.max(0, Math.trunc(counts.published ?? 0))
  const scheduled = Math.max(0, Math.trunc(counts.scheduled ?? 0))
  const pending = Math.max(0, Math.trunc(counts.pending ?? 0))
  if (published > 0) return 'live'
  if (scheduled > 0) return 'scheduled'
  if (pending > 0) return 'pending'
  return 'none'
}

export interface PublishingStatusCopy {
  state: PublishingState
  /** true ONLY when platform-confirmed published content exists. */
  isLive: boolean
  /** EN status line, e.g. "Publishing: scheduled, not live yet". */
  label: string
  /** AR status line. */
  labelAr: string
  severity: StatusSeverity
}

/**
 * Honest publishing status copy. Never says "live"/"published" unless state==='live'.
 */
export function getPublishingStatusCopy(state: PublishingState): PublishingStatusCopy {
  switch (state) {
    case 'live':
      return { state, isLive: true, label: 'Publishing: live', labelAr: 'النشر: مباشر', severity: 'good' }
    case 'scheduled':
      return { state, isLive: false, label: 'Publishing: scheduled, not live yet', labelAr: 'النشر: مجدول، ليس مباشراً بعد', severity: 'watch' }
    case 'pending':
      return { state, isLive: false, label: 'Publishing: approved, not scheduled', labelAr: 'النشر: جاهز، غير مجدول', severity: 'watch' }
    default:
      return { state, isLive: false, label: 'Publishing: not scheduled', labelAr: 'النشر: غير مجدول', severity: 'risk' }
  }
}

export interface BrandMemoryStatusCopy {
  status: Exclude<BrandMemoryStatus, null | undefined>
  /** Short value rendered next to the "Brand memory" label (EN). Never "100%". */
  value: string
  /** AR value. */
  valueAr: string
  severity: StatusSeverity
}

/**
 * Brand-memory status check copy, derived from the SAME maturity status the Brand
 * Brain card shows — so the Operating Brief can never say "100%/complete" while the
 * Brand Brain reads Building. Only 'active' is "good".
 */
export function getBrandMemoryStatusCopy(status: BrandMemoryStatus): BrandMemoryStatusCopy {
  switch (status) {
    case 'active':
      return { status: 'active', value: 'Active', valueAr: 'نشطة', severity: 'good' }
    case 'building':
      return { status: 'building', value: 'Building', valueAr: 'قيد البناء', severity: 'watch' }
    default:
      return { status: 'needs_data', value: 'Needs more info', valueAr: 'يحتاج بيانات', severity: 'risk' }
  }
}
