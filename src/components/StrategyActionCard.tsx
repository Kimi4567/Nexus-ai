'use client'

/**
 * Strategy PR-2B2B1 — Consolidated one-primary-CTA Action Card for the Strategy tab.
 *
 * Renders EXACTLY ONE primary CTA (state-driven) + up to 3 quiet secondary links
 * + a calm, state-aware trust line. Pure presentation: it calls existing handlers
 * passed as props and links to existing routes. No API, no generation, no new
 * behavior. Honest labels only — never "launch"/"publish"/"spend".
 *
 * The state→action mapping lives in the exported pure `resolveStrategyAction()` so
 * it can be unit-tested without rendering.
 */

import Link from 'next/link'

export interface StrategyActionState {
  locale: 'en' | 'ar'
  engineRunning: boolean
  /** Brand Brain content base ready (getBrandBrainReadiness().ready). */
  brandBaseReady: boolean
  /** sentinelStatus === 'passed' */
  sentinelPassed: boolean
  /** campaign ACTIVE or approvalState === 'done' */
  isApproved: boolean
  hasContentPlan: boolean
  hasPosts: boolean
  /** async working flags (reuse existing state) */
  reviewing: boolean
  approving: boolean
  /** stable readiness keys still missing (PR-2B1); [] for old strategies */
  missingDataKeys: string[]
  /** paid capability not yet ready AND we have a confidence report (new strategies only) */
  paidGated: boolean
  /** hrefs for the existing Content Hub destination */
  contentHubHref: string
  contentHubBuildHref: string
}

type PrimaryKind = 'working' | 'review' | 'approve' | 'link'
export interface PrimaryAction {
  kind: PrimaryKind
  label: string
  /** for kind 'link' */
  href?: string
  working?: boolean
}
export interface SecondaryAction { label: string; href: string; key: string }

const L = (locale: string, en: string, ar: string) => (locale === 'ar' ? ar : en)
const BRAND = '/brand'

/** Pure: resolve the single primary + (≤3) secondaries + trust lines from state. */
export function resolveStrategyAction(s: StrategyActionState): {
  primary: PrimaryAction
  secondaries: SecondaryAction[]
  trustLines: string[]
} {
  const lo = s.locale
  // ── single primary (first match wins) ──
  let primary: PrimaryAction
  if (s.engineRunning) {
    primary = { kind: 'working', label: L(lo, 'Working…', 'جارٍ العمل…'), working: true }
  } else if (!s.brandBaseReady) {
    primary = { kind: 'link', href: BRAND, label: L(lo, 'Complete Brand Brain', 'أكمل Brand Brain') }
  } else if (!s.sentinelPassed && !s.isApproved) {
    primary = { kind: 'review', label: L(lo, 'Review strategy quality', 'راجع جودة الاستراتيجية'), working: s.reviewing }
  } else if (s.sentinelPassed && !s.isApproved) {
    // Honest label — confirms the document and opens planning; never implies launch/publish/spend.
    primary = { kind: 'approve', label: L(lo, 'Confirm strategy and open content plan', 'أكد الاستراتيجية وافتح خطة المحتوى'), working: s.approving }
  } else if (s.isApproved && !s.hasContentPlan) {
    primary = { kind: 'link', href: s.contentHubBuildHref, label: L(lo, 'Generate organic content plan', 'أنشئ خطة المحتوى العضوي') }
  } else if (s.isApproved && s.hasContentPlan && !s.hasPosts) {
    primary = { kind: 'link', href: s.contentHubBuildHref, label: L(lo, 'Review content in Content Hub', 'راجع المحتوى في مركز المحتوى') }
  } else {
    primary = { kind: 'link', href: s.contentHubHref, label: L(lo, 'Review & schedule content', 'راجع وجدوِل المحتوى') }
  }

  // ── secondaries (quiet, ≤3, filtered, never duplicate the primary) ──
  const out: SecondaryAction[] = []
  const has = (k: string) => s.missingDataKeys.includes(k)
  const primaryIsBrand = primary.kind === 'link' && primary.href === BRAND
  if (has('marketingBudget')) out.push({ key: 'budget', href: BRAND, label: L(lo, 'Add monthly budget', 'أضِف الميزانية الشهرية') })
  if (has('conversionDestination')) out.push({ key: 'conv', href: BRAND, label: L(lo, 'Add conversion destination', 'أضِف وجهة التحويل') })
  if (s.missingDataKeys.length > 0 && !primaryIsBrand) out.push({ key: 'brand', href: BRAND, label: L(lo, 'Complete Brand Brain', 'أكمل Brand Brain') })
  if (s.isApproved && !(primary.kind === 'link' && (primary.href === s.contentHubBuildHref))) {
    out.push({ key: 'gen', href: s.contentHubBuildHref, label: L(lo, 'Generate organic content plan', 'أنشئ خطة المحتوى العضوي') })
  }
  const secondaries = out.slice(0, 3)

  // ── trust lines (calm, state-aware) ──
  const trustLines: string[] = [
    L(lo, 'You review and approve before anything goes live — nothing publishes automatically.',
        'أنت تراجع وتعتمد قبل أي تنفيذ — لا شيء يُنشر تلقائياً.'),
  ]
  if (s.paidGated) {
    trustLines.push(L(lo,
      'Paid campaign planning can be prepared for review, but ads will not be launched and no budget will be spent without explicit approval.',
      'يمكن تجهيز تخطيط الحملات المدفوعة للمراجعة، لكن لن تُطلق أي إعلانات ولن تُصرف أي ميزانية دون موافقة صريحة.'))
  }
  if (s.missingDataKeys.length > 0) {
    trustLines.push(L(lo, 'Some data is missing, so confidence is limited.', 'بعض البيانات ناقصة، لذلك الثقة محدودة.'))
  }
  return { primary, secondaries, trustLines }
}

interface Props extends StrategyActionState {
  nextBestAction?: string
  onReview: () => void
  onApprove: () => void
}

export default function StrategyActionCard(props: Props) {
  const { primary, secondaries, trustLines } = resolveStrategyAction(props)
  const lo = props.locale

  const primaryClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 w-full sm:w-auto'
  // Calm accent fill — no heavy gradient (matches PR-2B2A).
  const primaryStyle = { background: 'rgba(139,92,246,0.9)' }

  return (
    <div className="rounded-2xl p-5 space-y-3.5"
      style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.22)' }}>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(139,92,246,0.95)' }}>
          {L(lo, 'Your next step', 'خطوتك التالية')}
        </span>
        {props.nextBestAction && (
          <p className="text-white text-[15px] font-semibold leading-snug">{props.nextBestAction}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        {/* exactly one primary */}
        {primary.kind === 'working' && (
          <span className={primaryClasses} style={{ ...primaryStyle, opacity: 0.6 }} aria-disabled>
            {primary.label}
          </span>
        )}
        {primary.kind === 'review' && (
          <button type="button" onClick={props.onReview} disabled={primary.working} className={primaryClasses} style={primaryStyle}>
            {primary.working ? L(lo, 'Reviewing…', 'جارٍ المراجعة…') : primary.label}
          </button>
        )}
        {primary.kind === 'approve' && (
          <button type="button" onClick={props.onApprove} disabled={primary.working} className={primaryClasses} style={primaryStyle}>
            {primary.working ? L(lo, 'Approving…', 'جارٍ الاعتماد…') : primary.label}
          </button>
        )}
        {primary.kind === 'link' && primary.href && (
          <Link href={primary.href} className={primaryClasses} style={primaryStyle}>{primary.label}</Link>
        )}

        {/* quiet secondaries */}
        {secondaries.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {secondaries.map(sec => (
              <Link key={sec.key} href={sec.href}
                className="text-[12px] text-gray-400 hover:text-gray-200 underline-offset-2 hover:underline transition">
                {sec.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* calm trust line(s) */}
      <div className="space-y-1 pt-0.5">
        {trustLines.map((t, i) => (
          <p key={i} className="text-[11px] text-gray-500 leading-relaxed">{t}</p>
        ))}
      </div>
    </div>
  )
}
