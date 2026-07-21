'use client'

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { AlertTriangle, FlaskConical, Loader2, Pause, Play, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface VariantEvidence {
  reportedViews: number
  reportedClicks: number
  confirmedSubmissions: number
  confirmedSubmissionRate: number | null
  minimumEvidenceMet: boolean
}

interface ExperimentRecord {
  id: string
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
  hypothesis: string
  variable: 'HEADLINE' | 'SUBHEADLINE' | 'CTA_LABEL'
  version: number
  minimumVisitorsPerVariant: number
  minimumConversionsPerVariant: number
  challengerAllocationPercent: number
  decision?: 'KEEP_CONTROL' | 'APPLY_CHALLENGER_DRAFT' | 'INCONCLUSIVE' | null
  decisionNote?: string | null
  evidence: {
    control: VariantEvidence
    challenger: VariantEvidence
    readyForHumanDecision: boolean
    statisticalWinnerClaimed: false
  }
}

interface ExperimentReadiness {
  ready: boolean
  requested: boolean
  databaseState: string
}

interface LandingExperimentPanelProps {
  pageId: string
  pageName: string
  onClose: () => void
  onPageChanged: () => Promise<void>
}

const EMPTY_DRAFT = {
  hypothesis: '',
  variable: 'HEADLINE',
  challengerValue: '',
  minimumVisitorsPerVariant: '100',
  minimumConversionsPerVariant: '10',
  challengerAllocationPercent: '50',
}

function rate(value: number | null, locale: string): string {
  return value === null ? '—' : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(value)
}

export function LandingExperimentPanel({ pageId, pageName, onClose, onPageChanged }: LandingExperimentPanelProps) {
  const { authHeader } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const copy = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar])
  const [readiness, setReadiness] = useState<ExperimentReadiness | null>(null)
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([])
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setLoading(true)
    try {
      const readinessResponse = await fetch('/api/landing-pages/experiments/readiness', {
        headers: { Authorization: token },
        cache: 'no-store',
      })
      const readinessData = await readinessResponse.json().catch(() => ({})) as ExperimentReadiness
      setReadiness(readinessData)
      if (!readinessData.ready) {
        setExperiments([])
        return
      }
      const response = await fetch(`/api/landing-pages/${encodeURIComponent(pageId)}/experiments`, {
        headers: { Authorization: token },
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر تحميل التجارب.', 'Could not load experiments.'))
      setExperiments(Array.isArray(data.experiments) ? data.experiments : [])
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر تحميل التجارب.', 'Could not load experiments.') })
    } finally {
      setLoading(false)
    }
  }, [authHeader, copy, pageId])

  useEffect(() => {
    void load()
  }, [load])

  async function createExperiment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = authHeader()
    if (!token) return
    setBusyId('create')
    setNotice(null)
    try {
      const response = await fetch(`/api/landing-pages/${encodeURIComponent(pageId)}/experiments`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          minimumVisitorsPerVariant: Number(draft.minimumVisitorsPerVariant),
          minimumConversionsPerVariant: Number(draft.minimumConversionsPerVariant),
          challengerAllocationPercent: Number(draft.challengerAllocationPercent),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر إنشاء التجربة.', 'Could not create experiment.'))
      setDraft(EMPTY_DRAFT)
      setShowCreate(false)
      setNotice({ tone: 'success', text: copy('تم إنشاء مسودة التجربة. لم يبدأ توزيع الزيارات.', 'Experiment draft created. Traffic allocation has not started.') })
      await load()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر إنشاء التجربة.', 'Could not create experiment.') })
    } finally {
      setBusyId(null)
    }
  }

  async function act(experiment: ExperimentRecord, action: 'START' | 'PAUSE' | 'COMPLETE' | 'CANCEL', decision?: string) {
    const token = authHeader()
    if (!token) return
    setBusyId(experiment.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/landing-pages/${encodeURIComponent(pageId)}/experiments/${encodeURIComponent(experiment.id)}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, decision, expectedVersion: experiment.version, decisionNote: decisionNotes[experiment.id] || null }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر تحديث التجربة.', 'Could not update experiment.'))
      const challengerDraft = action === 'COMPLETE' && decision === 'APPLY_CHALLENGER_DRAFT'
      setNotice({
        tone: 'success',
        text: challengerDraft
          ? copy('تم تجهيز المتغير كمسودة فقط. راجعه وانشره بقرار منفصل.', 'Challenger was prepared as a draft only. Review and publish it separately.')
          : copy('تم تحديث التجربة مع حفظ القرار.', 'Experiment updated and the decision was recorded.'),
      })
      await Promise.all([load(), onPageChanged()])
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر تحديث التجربة.', 'Could not update experiment.') })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="landing-experiment-title" className="mt-5 rounded-[1.75rem] border border-indigo-100 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(44,55,160,0.65)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600"><FlaskConical className="h-5 w-5" /><span className="text-[10px] font-black uppercase tracking-[0.16em]">CRO experiment registry</span></div>
          <h2 id="landing-experiment-title" className="mt-2 text-xl font-black text-[#0B1028]">{pageName}</h2>
          <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-slate-500">{copy('متغير واحد فقط، توزيع ثابت، وتحويل النموذج المؤكد من السيرفر هو إشارة النجاح. لا ندّعي فائزًا إحصائيًا.', 'One variable only, stable allocation, and server-confirmed form intake as the success signal. No statistical winner is claimed.')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={copy('إغلاق لوحة التجارب', 'Close experiment panel')} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
      </div>

      {notice ? <div aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-xs font-bold ${notice.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>{notice.text}</div> : null}

      {loading ? <div className="grid min-h-36 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /><span className="sr-only">Loading experiments</span></div> : readiness && !readiness.ready ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="text-sm font-black text-amber-900">{copy('التجارب مغلقة تشغيليًا', 'Experiments are operationally locked')}</p><p className="mt-1 text-xs font-bold leading-6 text-amber-700">{readiness.requested ? copy(`حالة قاعدة البيانات: ${readiness.databaseState}. طبّق migration على Preview أولًا.`, `Database state: ${readiness.databaseState}. Apply the migration to Preview first.`) : copy('فعّلها في Preview فقط بعد تطبيق migration واختبار رحلة التحويل.', 'Enable it only in Preview after the migration and conversion-flow test.')}</p></div></div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-[11px] font-black text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-500" />{copy('القرار يدوي بعد الحد الأدنى للأدلة', 'Human decision after minimum evidence')}</p>
            <button type="button" onClick={() => setShowCreate(value => !value)} className="min-h-10 rounded-xl bg-[#5E63FF] px-4 text-xs font-black text-white">{showCreate ? copy('إخفاء النموذج', 'Hide form') : copy('تجربة جديدة', 'New experiment')}</button>
          </div>

          {showCreate ? <form onSubmit={createExperiment} className="mt-4 grid gap-4 rounded-2xl bg-[#F7F8FC] p-4 lg:grid-cols-2">
            <label className="text-xs font-black text-slate-700 lg:col-span-2">{copy('الفرضية', 'Hypothesis')}<textarea required maxLength={600} value={draft.hypothesis} onChange={event => setDraft(current => ({ ...current, hypothesis: event.target.value }))} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium outline-none focus:border-indigo-400" /></label>
            <label className="text-xs font-black text-slate-700">{copy('المتغير الوحيد', 'Single variable')}<select value={draft.variable} onChange={event => setDraft(current => ({ ...current, variable: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="HEADLINE">Headline</option><option value="SUBHEADLINE">Subheadline</option><option value="CTA_LABEL">CTA label</option></select></label>
            <label className="text-xs font-black text-slate-700">{copy('قيمة المتغير', 'Challenger value')}<input required maxLength={draft.variable === 'CTA_LABEL' ? 80 : draft.variable === 'HEADLINE' ? 180 : 500} value={draft.challengerValue} onChange={event => setDraft(current => ({ ...current, challengerValue: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" /></label>
            <label className="text-xs font-black text-slate-700">{copy('زيارات مُبلّغ عنها لكل نسخة', 'Reported views per variant')}<input type="number" min={50} max={1000000} value={draft.minimumVisitorsPerVariant} onChange={event => setDraft(current => ({ ...current, minimumVisitorsPerVariant: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm" /></label>
            <label className="text-xs font-black text-slate-700">{copy('إرسالات مؤكدة لكل نسخة', 'Confirmed forms per variant')}<input type="number" min={1} max={100000} value={draft.minimumConversionsPerVariant} onChange={event => setDraft(current => ({ ...current, minimumConversionsPerVariant: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm" /></label>
            <label className="text-xs font-black text-slate-700">{copy('نسبة المتغير %', 'Challenger allocation %')}<input type="number" min={10} max={90} value={draft.challengerAllocationPercent} onChange={event => setDraft(current => ({ ...current, challengerAllocationPercent: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm" /></label>
            <div className="flex items-end"><button disabled={busyId === 'create'} className="min-h-11 w-full rounded-xl bg-[#101A4D] px-4 text-xs font-black text-white disabled:opacity-50">{busyId === 'create' ? copy('جارٍ الإنشاء…', 'Creating…') : copy('حفظ مسودة التجربة', 'Save experiment draft')}</button></div>
          </form> : null}

          <div className="mt-5 space-y-4">
            {experiments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400">{copy('لا توجد تجارب لهذه الصفحة.', 'No experiments for this page.')}</div> : experiments.map(experiment => (
              <article key={experiment.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{experiment.hypothesis}</p><p className="mt-1 font-mono text-[10px] font-bold text-slate-400">{experiment.variable} · {100 - experiment.challengerAllocationPercent}/{experiment.challengerAllocationPercent}</p></div><span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${experiment.status === 'RUNNING' ? 'bg-emerald-50 text-emerald-700' : experiment.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{experiment.status}</span></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(['control', 'challenger'] as const).map(key => {
                    const evidence = experiment.evidence[key]
                    return <div key={key} className="rounded-xl bg-[#F7F8FC] p-4"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{key}</p><span className={`text-[9px] font-black ${evidence.minimumEvidenceMet ? 'text-emerald-600' : 'text-slate-400'}`}>{evidence.minimumEvidenceMet ? copy('الحد مكتمل', 'Evidence met') : copy('تجميع أدلة', 'Collecting')}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><p className="font-mono text-base font-black text-indigo-700">{evidence.reportedViews}</p><p className="text-[8px] font-black text-slate-400">VIEWS*</p></div><div><p className="font-mono text-base font-black text-violet-700">{evidence.reportedClicks}</p><p className="text-[8px] font-black text-slate-400">CLICKS*</p></div><div><p className="font-mono text-base font-black text-emerald-700">{evidence.confirmedSubmissions}</p><p className="text-[8px] font-black text-slate-400">FORMS</p></div></div><p className="mt-3 text-center font-mono text-[10px] font-bold text-slate-500">{copy('معدل وصفي', 'Descriptive rate')}: {rate(evidence.confirmedSubmissionRate, locale)}</p></div>
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {experiment.status === 'RUNNING' || experiment.status === 'PAUSED' ? <label className="mb-1 w-full text-[10px] font-black text-slate-600">{copy('ملاحظة القرار البشري (مطلوبة لاختيار نسخة)', 'Human decision note (required to select a variant)')}<textarea maxLength={1000} value={decisionNotes[experiment.id] || ''} onChange={event => setDecisionNotes(current => ({ ...current, [experiment.id]: event.target.value }))} className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-indigo-400" /></label> : null}
                  {experiment.status === 'DRAFT' || experiment.status === 'PAUSED' ? <button type="button" disabled={busyId === experiment.id} onClick={() => void act(experiment, 'START')} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-[10px] font-black text-white disabled:opacity-50"><Play className="h-3.5 w-3.5" />{copy('بدء التوزيع', 'Start allocation')}</button> : null}
                  {experiment.status === 'RUNNING' ? <button type="button" disabled={busyId === experiment.id} onClick={() => void act(experiment, 'PAUSE')} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-amber-500 px-3 text-[10px] font-black text-white disabled:opacity-50"><Pause className="h-3.5 w-3.5" />{copy('إيقاف مؤقت', 'Pause')}</button> : null}
                  {experiment.status === 'RUNNING' || experiment.status === 'PAUSED' ? <>
                    <button type="button" disabled={busyId === experiment.id} onClick={() => void act(experiment, 'COMPLETE', 'INCONCLUSIVE')} className="min-h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-black text-slate-600 disabled:opacity-50">{copy('إنهاء بلا نتيجة', 'End inconclusive')}</button>
                    {experiment.evidence.readyForHumanDecision ? <><button type="button" disabled={busyId === experiment.id || (decisionNotes[experiment.id]?.trim().length ?? 0) < 10} onClick={() => void act(experiment, 'COMPLETE', 'KEEP_CONTROL')} className="min-h-9 rounded-lg border border-indigo-200 px-3 text-[10px] font-black text-indigo-700 disabled:opacity-50">{copy('الاحتفاظ بالأساس', 'Keep control')}</button><button type="button" disabled={busyId === experiment.id || (decisionNotes[experiment.id]?.trim().length ?? 0) < 10} onClick={() => void act(experiment, 'COMPLETE', 'APPLY_CHALLENGER_DRAFT')} className="min-h-9 rounded-lg bg-[#5E63FF] px-3 text-[10px] font-black text-white disabled:opacity-50">{copy('تجهيز المتغير كمسودة', 'Prepare challenger draft')}</button></> : null}
                  </> : null}
                  {['DRAFT', 'RUNNING', 'PAUSED'].includes(experiment.status) ? <button type="button" disabled={busyId === experiment.id} onClick={() => void act(experiment, 'CANCEL')} className="min-h-9 rounded-lg border border-rose-100 px-3 text-[10px] font-black text-rose-600 disabled:opacity-50">{copy('إلغاء', 'Cancel')}</button> : null}
                </div>
                <p className="mt-3 text-[9px] font-bold text-slate-400">* {copy('الزيارات والنقرات إشارات متصفح. الإرسال فقط مؤكد من السيرفر. المعدل وصفي وليس اختبار دلالة إحصائية.', 'Views and clicks are browser signals. Only form intake is server-confirmed. The rate is descriptive, not a significance test.')}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
