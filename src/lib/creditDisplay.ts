/**
 * NEXUS — Honest credit/quota display helper (Phase 1: Product Truth).
 *
 * Pure, dependency-free formatter so every surface (dashboard card, billing,
 * sidebar) renders AI credits the same honest way and NEVER shows a confusing
 * "numerator > denominator" value like "246 / 150".
 *
 * Rules:
 *   - available ≤ monthly grant → "87 / 150 credits available this month"
 *   - available > monthly grant → "246 credits available" (+ a helper line that
 *     explains the extra is rollover / bonus / refund — never "246 / 150")
 *   - no monthly grant (≤ 0)    → "10 credits available" (no denominator)
 *   - unlimited (-1)            → "Unlimited" / "غير محدود"
 *   - progress percent is ALWAYS clamped to 0..100 so bars can't overflow.
 *
 * This is display-only: it reads numbers and returns strings. It never mutates
 * balances, deduction, refunds, plans, or Stripe.
 */

export interface CreditDisplayInput {
  availableCredits: number | null | undefined
  monthlyCredits: number | null | undefined
  /** compact = short chip form (numbers only, no descriptive suffix) */
  compact?: boolean
  /** 'ar' for Arabic, anything else → English */
  locale?: string
}

export interface CreditDisplay {
  /** main line to render */
  primary: string
  /** explanatory line shown only when available exceeds the monthly grant */
  secondary: string | null
  /** progress-bar fill, always 0..100 (never overflows) */
  percent: number
  isUnlimited: boolean
  overGrant: boolean
}

/** Coerce anything (null/NaN/float/negative) to a safe non-negative integer. */
function safeInt(n: number | null | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.max(0, Math.trunc(n))
}

/**
 * Canonical plan display name — ONE source of truth for the human-facing plan
 * label across every surface (Billing, Settings, Sidebar, Dashboard, Analytics).
 *
 * Input is the plan identifier returned by /api/billing/status (lowercase id:
 * 'free' | 'starter' | 'pro' | 'business'; legacy aliases 'growth'/'agency'/
 * 'active' accepted). The internal Stripe id 'pro' is the GROWTH plan and must
 * NEVER be shown to users as "Pro". Unknown ids fall back to a capitalized form
 * rather than a misleading hardcoded "Free".
 *
 * Pure + display-only: never reads or mutates credits, balances, or Stripe.
 */
const PLAN_NAMES: Record<string, { en: string; ar: string }> = {
  free:     { en: 'Free',    ar: 'مجاني' },
  starter:  { en: 'Starter', ar: 'ستارتر' },
  pro:      { en: 'Growth',  ar: 'جروث' },   // internal Stripe id 'pro' = Growth
  growth:   { en: 'Growth',  ar: 'جروث' },
  business: { en: 'Agency',  ar: 'وكالة' },
  agency:   { en: 'Agency',  ar: 'وكالة' },
  active:   { en: 'Growth',  ar: 'جروث' },   // legacy status fallback → Growth tier
}

export function getPlanDisplayName(plan: string | null | undefined, locale?: string): string {
  const ar = (locale || '').toLowerCase().startsWith('ar')
  const id = (plan ?? 'free').toString().trim().toLowerCase()
  const match = PLAN_NAMES[id]
  if (match) return ar ? match.ar : match.en
  // Unknown id → capitalize, never silently coerce to "Free".
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : (ar ? 'مجاني' : 'Free')
}

export function formatCreditDisplay(input: CreditDisplayInput): CreditDisplay {
  const { availableCredits, monthlyCredits, compact = false } = input
  const ar = (input.locale || '').toLowerCase().startsWith('ar')

  // ── Unlimited (sentinel -1 on either field) ──────────────────────────────
  if (availableCredits === -1 || monthlyCredits === -1) {
    return {
      primary: compact ? '∞' : ar ? 'غير محدود' : 'Unlimited',
      secondary: null,
      percent: 100,
      isUnlimited: true,
      overGrant: false,
    }
  }

  const avail = safeInt(availableCredits)
  const monthly = safeInt(monthlyCredits)

  // ── No monthly grant (e.g. Free one-time credits) → no denominator ───────
  if (monthly <= 0) {
    return {
      primary: compact ? `${avail}` : ar ? `${avail} كريدت متاح` : `${avail} credits available`,
      secondary: null,
      percent: avail > 0 ? 100 : 0,
      isUnlimited: false,
      overGrant: false,
    }
  }

  // ── Over the monthly grant → never show "avail / monthly" ────────────────
  if (avail > monthly) {
    return {
      primary: compact ? `${avail}` : ar ? `${avail} كريدت متاح` : `${avail} credits available`,
      secondary: ar
        ? `خطتك تمنحك ${monthly} كريدت شهريًا. الرصيد الإضافي قد يكون من رصيد سابق أو تعويضات أو كريدت إضافي.`
        : `Your plan grants ${monthly} credits/month. Extra credits may include rollover, bonuses, or refunds.`,
      percent: 100,
      isUnlimited: false,
      overGrant: true,
    }
  }

  // ── Normal quota ─────────────────────────────────────────────────────────
  return {
    primary: compact
      ? `${avail} / ${monthly}`
      : ar
        ? `${avail} من ${monthly} كريدت متاح هذا الشهر`
        : `${avail} / ${monthly} credits available this month`,
    secondary: null,
    percent: Math.max(0, Math.min(100, Math.round((avail / monthly) * 100))),
    isUnlimited: false,
    overGrant: false,
  }
}
