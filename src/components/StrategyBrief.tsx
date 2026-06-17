'use client'

/**
 * PR-K — StrategyBrief
 *
 * A calm, premium "operator brief" that opens the campaign Strategy tab. It
 * replaces the three competing dark summary cards (Strategic Verdict + the
 * "Strategy Intelligence" TL;DR card) with ONE Apple-level brief a non-technical
 * SME owner can read in seconds:
 *
 *   • The direction        — one confident, honest sentence
 *   • Why this fits         — built from their real Brand Brain inputs (no claims)
 *   • 90-day direction      — up to 3 strategic decisions
 *   • First 30 days         — the first weeks as a clear, actionable timeline
 *   • Content pillars        — the recurring themes
 *   • Your next step         — points to the single action below
 *   • How we'll measure      — honest, directional-until-baseline (no numbers)
 *   • Paid                   — planning-only / not launch-ready when prereqs missing
 *   • Brand Brain status     — the PR-J separated indicators (preserved)
 *
 * 100% presentational. Reuses the existing honest verdict derivation
 * (deriveStrategicVerdict / deriveTopDecisions) and the PR-J indicators — no
 * generation, no new numbers, no mutation of stored strategy data.
 */

import { deriveStrategicVerdict, deriveTopDecisions, type VerdictInput } from './StrategicVerdictCard'
import BrandIndicatorsPanel from './BrandIndicatorsPanel'
import type { BrandIndicators } from '@/lib/brandIndicators'

export interface StrategyBriefWeek {
  week: number | string
  objective: string
}

interface Props {
  locale: 'en' | 'ar'
  verdict: VerdictInput
  brandName?: string | null
  industry?: string | null
  primaryOffer?: string | null
  targetAudience?: string | null
  first30: StrategyBriefWeek[]
  contentPillars: string[]
  nextBestAction?: string | null
  /** true when any KPI is a hypothesis → show the honest "directional" measurement line. */
  kpisAreHypotheses: boolean
  /** true when paid prerequisites are missing (planning-only). */
  paidPlanningOnly: boolean
  indicators: BrandIndicators
}

const L = (lo: string, en: string, ar: string) => (lo === 'ar' ? ar : en)

function joinDot(parts: (string | null | undefined)[]): string {
  return parts.map(p => (p || '').trim()).filter(Boolean).join('  ·  ')
}

export default function StrategyBrief(props: Props) {
  const lo = props.locale
  const { text: direction } = deriveStrategicVerdict(props.verdict)
  const decisions = deriveTopDecisions(props.verdict)
  const weeks = (props.first30 || []).filter(w => (w?.objective || '').trim()).slice(0, 4)
  const pillars = (props.contentPillars || []).map(p => (p || '').trim()).filter(Boolean).slice(0, 3)
  const fit = joinDot([props.industry, props.primaryOffer, props.targetAudience])

  const eyebrow = 'text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nx-text-3)]'

  return (
    <section
      className="nx-card"
      style={{ padding: '28px', borderRadius: 22 }}
      aria-label={L(lo, 'Strategy brief', 'ملخص الاستراتيجية')}
    >
      {/* ── The direction ── */}
      <p className={eyebrow}>{L(lo, 'Your strategy', 'استراتيجيتك')}</p>
      <h2 className="mt-2 text-[var(--nx-text-1)] font-semibold leading-snug"
        style={{ fontSize: '22px', maxWidth: '46ch' }}>
        {direction}
      </h2>
      {fit && (
        <p className="mt-2.5 text-sm text-[var(--nx-text-3)] leading-relaxed" style={{ maxWidth: '60ch' }}>
          {L(lo, 'Built from your Brand Brain', 'مبنية على ذاكرة علامتك')} — {fit}
        </p>
      )}

      {/* ── 90-day direction + First 30 days ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7 mt-7">
        {decisions.length > 0 && (
          <div>
            <p className={eyebrow}>{L(lo, '90-day direction', 'اتجاه 90 يوماً')}</p>
            <ol className="mt-3 space-y-2.5">
              {decisions.map((d, i) => (
                <li key={d.key} className="flex items-start gap-3 text-[14px] text-[var(--nx-text-2)] leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: 'var(--nx-surface-2, #f1f5f9)', color: 'var(--nx-text-3, #64748b)' }}>{i + 1}</span>
                  <span>{d.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {weeks.length > 0 && (
          <div>
            <p className={eyebrow}>{L(lo, 'First 30 days', 'أول 30 يوماً')}</p>
            <ol className="mt-3 space-y-0">
              {weeks.map((w, i) => (
                <li key={`${w.week}-${i}`} className="flex items-start gap-3 pb-3 last:pb-0">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: 'rgba(94,92,230,0.10)', color: '#5E5CE6' }}>
                      {L(lo, 'W', 'أ')}{w.week}
                    </span>
                    {i < weeks.length - 1 && <span className="w-px flex-1 mt-1" style={{ minHeight: 14, background: 'var(--nx-border, #e2e8f0)' }} />}
                  </div>
                  <span className="text-[14px] text-[var(--nx-text-2)] leading-snug pt-0.5">{w.objective}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* ── Content pillars ── */}
      {pillars.length > 0 && (
        <div className="mt-7">
          <p className={eyebrow}>{L(lo, 'Content pillars', 'محاور المحتوى')}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {pillars.map((p, i) => (
              <span key={i} className="text-[13px] font-medium px-3 py-1.5 rounded-full"
                style={{ background: 'var(--nx-surface-2, #f1f5f9)', color: 'var(--nx-text-2, #334155)', border: '1px solid var(--nx-border, #e2e8f0)' }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Your next step (points to the action card below) ── */}
      {props.nextBestAction && (props.nextBestAction || '').trim() && (
        <div className="mt-7 rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(94,92,230,0.06)', border: '1px solid rgba(94,92,230,0.18)' }}>
          <span className="text-[15px] leading-none mt-0.5">→</span>
          <div>
            <p className={eyebrow} style={{ color: '#5E5CE6' }}>{L(lo, 'Your next step', 'خطوتك التالية')}</p>
            <p className="mt-1 text-[14px] text-[var(--nx-text-1)] leading-relaxed">{props.nextBestAction}</p>
          </div>
        </div>
      )}

      {/* ── Honest measurement + paid ── */}
      <div className="mt-6 pt-5 space-y-1.5" style={{ borderTop: '1px solid var(--nx-border, #e2e8f0)' }}>
        {props.kpisAreHypotheses && (
          <p className="text-[12px] text-[var(--nx-text-3)] leading-relaxed">
            <span className="font-semibold text-[var(--nx-text-2)]">{L(lo, 'How we’ll measure', 'كيف نقيس')}: </span>
            {L(lo,
              'targets stay directional until you have real baseline data — no guessed numbers.',
              'تبقى الأهداف اتجاهية حتى تتوفر بيانات أساس حقيقية — بدون أرقام مُفترضة.')}
          </p>
        )}
        {props.paidPlanningOnly && (
          <p className="text-[12px] leading-relaxed" style={{ color: '#b45309' }}>
            <span className="font-semibold">{L(lo, 'Paid', 'المدفوع')}: </span>
            {L(lo, 'Planning only — not launch-ready. No ads run and no budget is spent without your approval.',
              'تخطيط فقط — غير جاهز للإطلاق. لا تُشغَّل إعلانات ولا تُصرف ميزانية دون موافقتك.')}
          </p>
        )}
      </div>

      {/* ── Brand Brain status (PR-J indicators, preserved) ── */}
      <div className="mt-6">
        <BrandIndicatorsPanel indicators={props.indicators} locale={lo} theme="light" completeHref="/brand" />
      </div>
    </section>
  )
}
