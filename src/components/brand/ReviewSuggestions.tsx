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
import { Check, ArrowRight, ShieldCheck, Globe, FileText, AlertTriangle, Repeat, RotateCcw } from 'lucide-react'
import { SCALAR_FIELDS, ARRAY_FIELDS, APPEND_FIELDS } from '@/lib/brand/applySuggestions'

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
  /** Raw array items (PR-M3.3D) — used so array applies merge real items, not a split string. */
  items?: string[]
  /** Short evidence snippet / source quote (optional; placeholder in the shell) */
  evidence?: string
  /** Optional per-field safety note from the server (e.g. "limited support — review"). */
  safetyNote?: string
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
  missing,
  safetyNotes,
  creditNote,
  partialNote,
  onApply,
  appliedToDraft,
}: {
  suggestions: AssistSuggestion[]
  sourcesUsed: SuggestionSource[]
  locale?: string
  onBack: () => void
  /** PR-M3.3C — localized labels of fields the source did not support (display only). */
  missing?: string[]
  /** PR-M3.3C — aggregate safety notes from the server (display only). */
  safetyNotes?: string[]
  /** PR-M3.3C — honest "charged N credits" message (display only). */
  creditNote?: string
  /** PR-M3.3C — partial-success message when one route failed (display only). */
  partialNote?: string
  /** PR-M3.3D — apply the selected suggestions to the LOCAL form draft only (no save). */
  onApply?: (selected: AssistSuggestion[], replaceFields: Set<string>) => void
  /** PR-M3.3D — true once the parent has applied the draft (shows the applied banner). */
  appliedToDraft?: boolean
}) {
  const ar = locale === 'ar'
  // Local-only selection — applied to the parent's LOCAL form draft only (never saved here).
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestions.filter(defaultSelected).map(s => s.field)),
  )
  // PR-M3.3D — non-empty scalar fields the user explicitly chose to Replace (default: keep).
  const [replace, setReplace] = useState<Set<string>>(new Set())
  // PR-M3.3D — two-step apply: show a confirmation summary before applying to the draft.
  const [confirming, setConfirming] = useState(false)
  const toggle = (field: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  const toggleReplace = (field: string) =>
    setReplace(prev => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })

  // ── PR-M3.3D apply categorization (display + payload) ──
  const isScalar = (f: string) => SCALAR_FIELDS.has(f)
  const isArray  = (f: string) => ARRAY_FIELDS.has(f)
  const isAppend = (f: string) => APPEND_FIELDS.has(f)
  const selectedList = suggestions.filter(s => selected.has(s.field))
  const fillList    = selectedList.filter(s => isScalar(s.field) && s.currentValue.trim().length === 0)
  const replaceList = selectedList.filter(s => isScalar(s.field) && s.currentValue.trim().length > 0 && replace.has(s.field))
  const keepList    = selectedList.filter(s => isScalar(s.field) && s.currentValue.trim().length > 0 && !replace.has(s.field))
  const mergeList   = selectedList.filter(s => isArray(s.field))
  const appendList  = selectedList.filter(s => isAppend(s.field))
  const skippedLowInferred = suggestions.filter(s => !selected.has(s.field) && (s.confidence === 'low' || s.basis === 'inferred')).length
  // "Effective" = will actually change the draft (kept-non-empty scalars are no-ops).
  const effectiveCount = fillList.length + replaceList.length + mergeList.length + appendList.length
  const canApply = !!onApply && !appliedToDraft && effectiveCount > 0

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
            <p className="text-sm text-slate-500 mt-1">
              {appliedToDraft
                ? (ar ? 'طُبّق على المسودة — لم يُحفظ بعد (اضغط «حفظ الكل»).' : 'Applied to draft — not saved yet (click Save All).')
                : (ar ? 'لم يُطبَّق أي شيء بعد.' : 'Nothing has been applied yet.')}
            </p>
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

        {/* ── Honest credit + partial-success notes (PR-M3.3C, display only) ── */}
        {creditNote && (
          <p className="text-[12px] text-slate-500 mt-3">{creditNote}</p>
        )}
        {partialNote && (
          <p className="text-[12px] mt-1.5 flex items-start gap-2" style={{ color:'#b45309' }}>
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
            {partialNote}
          </p>
        )}
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

                  {s.safetyNote && (
                    <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color:'#b45309' }}>
                      <AlertTriangle size={11} className="flex-shrink-0 mt-0.5 text-amber-500" />
                      {s.safetyNote}
                    </p>
                  )}

                  {/* PR-M3.3D — non-empty SCALAR + selected → explicit Keep/Replace (default Keep). */}
                  {hasCurrent && isSel && isScalar(s.field) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">{ar ? 'لديك قيمة بالفعل:' : 'You already have a value:'}</span>
                      <button onClick={() => { if (replace.has(s.field)) toggleReplace(s.field) }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold"
                        style={ !replace.has(s.field)
                          ? { background:'rgba(16,185,129,0.10)', color:'#16a34a', border:'1px solid rgba(16,185,129,0.3)' }
                          : { background:'#F8FAFC', color:'#64748b', border:'1px solid rgba(15,23,42,0.10)' } }>
                        {!replace.has(s.field) && <Check size={11} />} {ar ? 'الإبقاء على الحالية' : 'Keep existing'}
                      </button>
                      <button onClick={() => { if (!replace.has(s.field)) toggleReplace(s.field) }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold"
                        style={ replace.has(s.field)
                          ? { background:'rgba(245,158,11,0.12)', color:'#b45309', border:'1px solid rgba(245,158,11,0.35)' }
                          : { background:'#F8FAFC', color:'#64748b', border:'1px solid rgba(15,23,42,0.10)' } }>
                        <Repeat size={11} /> {ar ? 'استبدال بالمقترح' : 'Replace with suggestion'}
                      </button>
                    </div>
                  )}
                  {hasCurrent && isSel && isArray(s.field) && (
                    <p className="text-[11px] mt-2" style={{ color:'#64748b' }}>
                      {ar ? 'سيُدمج مع قيمك الحالية — لن يُحذف شيء.' : 'Will merge with your existing items — nothing is removed.'}
                    </p>
                  )}
                  {hasCurrent && isSel && isAppend(s.field) && (
                    <p className="text-[11px] mt-2" style={{ color:'#64748b' }}>
                      {ar ? 'سيُضاف إلى ملاحظاتك الحالية — لن يُستبدل شيء.' : 'Will be appended to your existing notes — nothing is replaced.'}
                    </p>
                  )}
                  {hasCurrent && !isSel && (
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

      {/* ── Not found yet (missing[]) + Review carefully (safetyNotes[]) — PR-M3.3C ── */}
      {((missing && missing.length > 0) || (safetyNotes && safetyNotes.length > 0)) && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
          {missing && missing.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-400 mb-1.5">
                {ar ? 'لم يُعثر عليها بعد — أضِفها يدوياً' : 'NOT FOUND YET — ADD MANUALLY'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((m, i) => (
                  <span key={`${m}-${i}`} className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background:'#F1F5F9', color:'#64748b', border:'1px solid rgba(15,23,42,0.08)' }}>{m}</span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {ar ? 'لم تُختلَق هذه الحقول — اتركها فارغة أو أكملها بنفسك.' : 'These were not invented — leave them empty or fill them in yourself.'}
              </p>
            </div>
          )}
          {safetyNotes && safetyNotes.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-wide mb-1.5" style={{ color:'#b45309' }}>
                {ar ? 'راجِع بعناية' : 'REVIEW CAREFULLY'}
              </p>
              <ul className="space-y-1">
                {safetyNotes.map((n, i) => (
                  <li key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                    <AlertTriangle size={11} className="flex-shrink-0 mt-0.5 text-amber-500" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── PR-M3.3D — Apply selected → confirmation summary → apply to LOCAL draft (no save) ── */}
      <div className="rounded-2xl p-5" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
        {appliedToDraft ? (
          /* Applied-to-draft banner — explicitly NOT saved. */
          <div>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color:'#16a34a' }}>
              <Check size={15} /> {ar ? 'طُبّق على المسودة — لم يُحفظ بعد' : 'Applied to draft — not saved yet'}
            </p>
            <p className="text-[13px] text-slate-600 mt-1.5">
              {ar ? 'راجِع تغييراتك ثم اضغط «حفظ الكل» لتخزينها. ما زال بإمكانك التعديل قبل الحفظ.' : 'Review your changes and click Save All to store them. You can still edit before saving.'}
            </p>
            <p className="text-[12px] text-slate-400 mt-2 flex items-start gap-2">
              <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" style={{ color:'#16a34a' }} />
              {ar ? 'لم يُحفظ شيء في قاعدة البيانات — «حفظ الكل» هو خطوة الحفظ الوحيدة.' : 'Nothing was saved to the database — Save All is the only step that persists.'}
            </p>
          </div>
        ) : confirming ? (
          /* Confirmation summary before applying. */
          <div>
            <p className="text-sm font-bold text-slate-950 mb-2">{ar ? 'قبل التطبيق على المسودة' : 'Before applying to your draft'}</p>
            <ul className="space-y-1 text-[12px] text-slate-600">
              {fillList.length > 0 && (
                <li className="flex items-start gap-1.5"><Check size={12} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                  {ar ? `ملء ${fillList.length} حقل فارغ` : `Fill ${fillList.length} empty field${fillList.length === 1 ? '' : 's'}`}: {fillList.map(s => s.label).join(', ')}</li>
              )}
              {mergeList.length > 0 && (
                <li className="flex items-start gap-1.5"><Check size={12} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                  {ar ? `دمج ${mergeList.length} قائمة` : `Merge ${mergeList.length} list${mergeList.length === 1 ? '' : 's'}`}: {mergeList.map(s => s.label).join(', ')}</li>
              )}
              {appendList.length > 0 && (
                <li className="flex items-start gap-1.5"><Check size={12} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                  {ar ? 'إضافة إلى الملاحظات الاستراتيجية' : 'Append to strategic notes'}</li>
              )}
              {replaceList.length > 0 && (
                <li className="flex items-start gap-1.5"><Repeat size={12} className="flex-shrink-0 mt-0.5" style={{ color:'#b45309' }} />
                  <span style={{ color:'#b45309' }}>{ar ? `استبدال ${replaceList.length} حقل غير فارغ` : `Replace ${replaceList.length} non-empty field${replaceList.length === 1 ? '' : 's'}`}: {replaceList.map(s => s.label).join(', ')}</span></li>
              )}
              {keepList.length > 0 && (
                <li className="flex items-start gap-1.5 text-slate-400">
                  {ar ? `الإبقاء على ${keepList.length} حقل غير فارغ (لن يتغيّر)` : `Keep ${keepList.length} non-empty field${keepList.length === 1 ? '' : 's'} (unchanged)`}</li>
              )}
              {skippedLowInferred > 0 && (
                <li className="flex items-start gap-1.5 text-slate-400">
                  {ar ? `تخطّي ${skippedLowInferred} اقتراح منخفض/مُستنتَج` : `Skipping ${skippedLowInferred} low/inferred suggestion${skippedLowInferred === 1 ? '' : 's'}`}</li>
              )}
            </ul>
            <p className="text-[12px] mt-3 flex items-start gap-2" style={{ color:'#b45309' }}>
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
              {ar ? 'يُطبَّق على المسودة المحلية فقط — لا يُحفظ في قاعدة البيانات.' : 'This applies to your local draft only — it does not save to the database.'}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => { onApply?.(selectedList, replace); setConfirming(false) }}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#0a0a0a' }}>
                <Check size={14} /> {ar ? 'تطبيق على المسودة' : 'Apply to draft'}
              </button>
              <button onClick={() => setConfirming(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600"
                style={{ background:'#F8FAFC', border:'1px solid rgba(15,23,42,0.10)' }}>
                <RotateCcw size={13} /> {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        ) : (
          /* Idle: enabled only when there are effective (changing) selections. */
          <div>
            <button onClick={() => setConfirming(true)} disabled={!canApply}
              className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:cursor-not-allowed"
              style={ canApply
                ? { background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#0a0a0a' }
                : { background:'#E2E8F0', color:'#94A3B8' } }>
              {ar ? `تطبيق المحدّد على المسودة (${effectiveCount})` : `Apply selected to draft (${effectiveCount})`}
            </button>
            <p className="text-[12px] text-slate-500 mt-3 flex items-start gap-2">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
              {ar ? 'يُطبَّق على المسودة المحلية فقط — لا شيء يُحفظ حتى تضغط «حفظ الكل».' : 'Applies to your local draft only — nothing is saved until you click Save All.'}
            </p>
            <p className="text-[12px] text-slate-500 mt-1.5 flex items-start gap-2">
              <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" style={{ color:'#16a34a' }} />
              {ar ? 'لا استبدال بدون موافقتك — حقولك الحالية محمية.' : 'No overwrite without your approval — your existing fields are protected.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
