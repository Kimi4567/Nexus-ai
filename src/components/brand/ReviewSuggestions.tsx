'use client'

/**
 * PR-M3.3A — Review Suggestions UI shell (display-only).
 *
 * Presentational surface that PROVES the safe assisted-setup review UX before any
 * real Scanner/Analyzer extraction or apply logic is connected (PR-M3.3B/C/D).
 *
 * Hard guarantees for this shell:
 *  - No API calls, no OpenAI, no Scanner/Analyzer routes.
 *  - No credit deduction.
 *  - No mutation of Brand Brain form data, no save.
 *  - "Apply selected" is a disabled no-op; nothing is applied to Brand Brain.
 *
 * It only manages its own local Apply/Skip selection state to demonstrate the
 * intended defaults (keep existing values; skip low-confidence / inferred).
 */

import { useState } from 'react'
import { Check, ArrowRight, ShieldCheck, Globe, FileText, AlertTriangle } from 'lucide-react'

export type SuggestionBasis = 'extracted' | 'inferred' | 'observed' | 'missing'
export type SuggestionConfidence = 'high' | 'medium' | 'low'
export type SuggestionSource = 'website' | 'content'

export interface AssistSuggestion {
  /** BrandProfile field key (identity for selection) */
  field: string
  /** Localized field label for display */
  label: string
  /** Current value already in Brand Brain ('' if empty) */
  currentValue: string
  /** Proposed value from the (future) scan/analyze */
  suggestedValue: string
  /** Short evidence snippet / source quote (optional; placeholder in the shell) */
  evidence?: string
  basis: SuggestionBasis
  confidence: SuggestionConfidence
  source: SuggestionSource
}

/**
 * Default selection rule (display only): only pre-select a suggestion when the
 * current field is EMPTY and the suggestion is neither low-confidence nor
 * inferred. Non-empty fields default to "keep existing" (unselected); low /
 * inferred default to "needs review" (skipped).
 */
export function defaultSelected(s: AssistSuggestion): boolean {
  return s.currentValue.trim().length === 0 && s.confidence !== 'low' && s.basis !== 'inferred'
}

export default function ReviewSuggestions({
  suggestions,
  sourcesUsed,
  locale,
  onBack,
}: {
  suggestions: AssistSuggestion[]
  sourcesUsed: SuggestionSource[]
  locale?: string
  onBack: () => void
}) {
  const ar = locale === 'ar'
  // Local-only selection — never applied to Brand Brain in this shell.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestions.filter(defaultSelected).map(s => s.field)),
  )
  const toggle = (field: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })

  const basisLabel = (b: SuggestionBasis) =>
    ar
      ? { extracted: 'مُستخرَج', inferred: 'مُستنتَج', observed: 'مُلاحَظ', missing: 'غير متوفّر' }[b]
      : { extracted: 'Extracted', inferred: 'Inferred', observed: 'Observed', missing: 'Missing' }[b]
  const confLabel = (c: SuggestionConfidence) =>
    ar ? { high: 'ثقة عالية', medium: 'ثقة متوسطة', low: 'ثقة منخفضة' }[c]
       : { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }[c]
  const confColor = (c: SuggestionConfidence) =>
    c === 'high' ? '#16a34a' : c === 'medium' ? '#d97706' : '#94a3b8'
  const sourceLabel = (s: SuggestionSource) =>
    s === 'website' ? (ar ? 'الموقع' : 'Website') : (ar ? 'المحتوى' : 'Content')

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="rounded-2xl p-6" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-950">{ar ? 'راجِع مسودة ذاكرة علامتك' : 'Review your Brand Brain draft'}</h2>
            <p className="text-sm text-slate-500 mt-1">{ar ? 'لم يُطبَّق أي شيء بعد.' : 'Nothing has been applied yet.'}</p>
          </div>
          <button onClick={onBack} className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 flex-shrink-0">
            <ArrowRight size={13} className="rtl:rotate-180" /> {ar ? 'العودة للإعداد المُساعد' : 'Back to Assisted setup'}
          </button>
        </div>

        {/* ── Summary strip ── */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {sourcesUsed.map(s => (
            <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background:'#F8FAFC', color:'#475569', border:'1px solid rgba(15,23,42,0.08)' }}>
              {s === 'website' ? <Globe size={12} /> : <FileText size={12} />} {sourceLabel(s)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background:'rgba(245,158,11,0.08)', color:'#b45309', border:'1px solid rgba(245,158,11,0.2)' }}>
            {ar ? 'الحالة: بحاجة لمراجعة' : 'Status: review required'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background:'#F8FAFC', color:'#475569', border:'1px solid rgba(15,23,42,0.08)' }}>
            {ar ? `محدّد: ${selected.size}/${suggestions.length}` : `Selected: ${selected.size}/${suggestions.length}`}
          </span>
        </div>
      </div>

      {/* ── Suggestion cards ── */}
      <div className="space-y-3">
        {suggestions.map(s => {
          const isSel = selected.has(s.field)
          const hasCurrent = s.currentValue.trim().length > 0
          return (
            <div key={s.field} className="rounded-2xl p-4 sm:p-5" style={{ background:'#FFFFFF', border:`1px solid ${isSel ? 'rgba(245,158,11,0.35)' : 'rgba(15,23,42,0.08)'}`, boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="text-sm font-bold text-slate-950">{s.label}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background:'#F1F5F9', color:'#475569', border:'1px solid rgba(15,23,42,0.08)' }}>{basisLabel(s.basis)}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background:`${confColor(s.confidence)}14`, color:confColor(s.confidence), border:`1px solid ${confColor(s.confidence)}33` }}>{confLabel(s.confidence)}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1" style={{ background:'#F8FAFC', color:'#64748b', border:'1px solid rgba(15,23,42,0.08)' }}>
                      {s.source === 'website' ? <Globe size={10} /> : <FileText size={10} />} {sourceLabel(s.source)}
                    </span>
                  </div>

                  {/* Current vs suggested */}
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="rounded-xl px-3 py-2" style={{ background:'#FBFBFD', border:'1px solid rgba(15,23,42,0.06)' }}>
                      <p className="text-[10px] font-semibold tracking-wide text-slate-400 mb-0.5">{ar ? 'القيمة الحالية' : 'CURRENT VALUE'}</p>
                      <p className="text-[12px] text-slate-700 break-words">{hasCurrent ? s.currentValue : <span className="text-slate-400">{ar ? '— فارغ —' : '— empty —'}</span>}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.18)' }}>
                      <p className="text-[10px] font-semibold tracking-wide mb-0.5" style={{ color:'#b45309' }}>{ar ? 'القيمة المقترحة' : 'SUGGESTED VALUE'}</p>
                      <p className="text-[12px] text-slate-800 break-words">{s.suggestedValue}</p>
                    </div>
                  </div>

                  {/* Evidence */}
                  <div className="mt-2 flex items-start gap-1.5">
                    <span className="text-[10px] font-semibold tracking-wide text-slate-400 mt-0.5">{ar ? 'الدليل' : 'EVIDENCE'}</span>
                    <p className="text-[11px] text-slate-500 italic break-words">
                      {s.evidence || (ar ? 'سيظهر مقتطف الدليل والمصدر هنا عند ربط المسح/التحليل لاحقاً.' : 'Evidence snippet & source will appear here once scan/analyze is connected.')}
                    </p>
                  </div>

                  {hasCurrent && (
                    <p className="text-[11px] mt-2" style={{ color:'#64748b' }}>
                      {ar ? 'لديك قيمة بالفعل — الإبقاء عليها هو الوضع الافتراضي.' : 'You already have a value — keeping it is the default.'}
                    </p>
                  )}
                </div>

                {/* Apply / Skip toggle (local only) */}
                <button onClick={() => toggle(s.field)}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={ isSel
                    ? { background:'rgba(16,185,129,0.10)', color:'#16a34a', border:'1px solid rgba(16,185,129,0.3)' }
                    : { background:'#F8FAFC', color:'#64748b', border:'1px solid rgba(15,23,42,0.10)' } }>
                  {isSel ? <><Check size={13} /> {ar ? 'سيُطبَّق' : 'Apply'}</> : (ar ? 'تخطٍّ' : 'Skip')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Apply (disabled no-op in M3.3A) + safety footer ── */}
      <div className="rounded-2xl p-5" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
        <button disabled
          className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold cursor-not-allowed"
          style={{ background:'#E2E8F0', color:'#94A3B8' }}>
          {ar ? `تطبيق المحدّد (${selected.size})` : `Apply selected (${selected.size})`}
        </button>
        <p className="text-[12px] text-slate-500 mt-3 flex items-start gap-2">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
          {ar ? 'تطبيق الحقول المحدّدة سيُفعَّل في خطوة لاحقة. لا شيء يُطبَّق على ذاكرة علامتك الآن.' : 'Applying selected fields will be enabled in a later step. Nothing is applied to your Brand Brain now.'}
        </p>
        <p className="text-[12px] text-slate-500 mt-1.5 flex items-start gap-2">
          <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" style={{ color:'#16a34a' }} />
          {ar ? 'لا استبدال بدون موافقتك — حقولك الحالية محمية.' : 'No overwrite without your approval — your existing fields are protected.'}
        </p>
      </div>
    </div>
  )
}
