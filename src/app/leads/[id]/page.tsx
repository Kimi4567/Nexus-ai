'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { LeadsNav } from '@/components/leads/LeadsNav'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { isLeadStage, leadStageTransitionOptions } from '@/lib/leadLifecycle'
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, Loader2, Plus, UserRound } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface Operator { id: string; name?: string | null; email: string; role: string }
interface LeadTask {
  id: string
  title: string
  note?: string | null
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  dueAt: string
  completedAt?: string | null
  updatedAt: string
  assignedTo?: Operator | null
}
interface LeadActivity { id: string; type: string; note?: string | null; occurredAt: string; metadata?: Record<string, unknown> }
interface LeadRecord {
  id: string
  fullName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  jobTitle?: string | null
  source: string
  stage: string
  score: number
  consentStatus: string
  consentSource?: string | null
  responseDueAt?: string | null
  firstContactedAt?: string | null
  nextFollowUpAt?: string | null
  updatedAt: string
  assignedToId?: string | null
  assignedTo?: Operator | null
  tasks: LeadTask[]
  activities: LeadActivity[]
  campaign?: { id: string; name: string } | null
  attribution?: Record<string, string> | null
  convertedAt?: string | null
  conversionValue?: string | number | null
  conversionCurrency?: string | null
  conversionValueSource?: string | null
}

function toLocalInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const [lead, setLead] = useState<LeadRecord | null>(null)
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [assignment, setAssignment] = useState({ assignedToId: '', responseDueAt: '' })
  const [outcome, setOutcome] = useState({ stage: '', lostReason: '', conversionValue: '', conversionCurrency: 'AED', note: '' })
  const [task, setTask] = useState({ title: '', dueAt: toLocalInput(new Date(Date.now() + 24 * 60 * 60_000)), priority: 'MEDIUM', note: '' })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setLoading(true)
    try {
      const [leadResponse, operatorResponse] = await Promise.all([
        fetch(`/api/leads/${encodeURIComponent(params.id)}`, { headers: { Authorization: token }, cache: 'no-store' }),
        fetch('/api/leads/operators', { headers: { Authorization: token }, cache: 'no-store' }),
      ])
      const [leadData, operatorData] = await Promise.all([leadResponse.json().catch(() => ({})), operatorResponse.json().catch(() => ({}))])
      if (!leadResponse.ok) throw new Error(leadData.error || 'Could not load lead.')
      setLead(leadData.lead)
      setOperators(Array.isArray(operatorData.operators) ? operatorData.operators : [])
      setAssignment({
        assignedToId: leadData.lead.assignedToId || '',
        responseDueAt: leadData.lead.responseDueAt ? toLocalInput(new Date(leadData.lead.responseDueAt)) : '',
      })
      setOutcome({
        stage: leadData.lead.stage,
        lostReason: leadData.lead.lostReason || '',
        conversionValue: leadData.lead.conversionValue === null || leadData.lead.conversionValue === undefined ? '' : String(leadData.lead.conversionValue),
        conversionCurrency: leadData.lead.conversionCurrency || 'AED',
        note: '',
      })
    } catch (loadError) {
      setNotice({ tone: 'error', text: loadError instanceof Error ? loadError.message : 'Could not load lead.' })
    } finally {
      setLoading(false)
    }
  }, [authHeader, params.id])

  useEffect(() => {
    if (!authLoading && isAuthenticated) load()
  }, [authLoading, isAuthenticated, load])

  const openTasks = useMemo(() => lead?.tasks.filter(item => item.status === 'OPEN') ?? [], [lead])
  const resolvedTasks = useMemo(() => lead?.tasks.filter(item => item.status !== 'OPEN') ?? [], [lead])
  const responseOverdue = Boolean(lead?.responseDueAt && !lead.firstContactedAt && !['WON', 'LOST', 'DISQUALIFIED'].includes(lead.stage) && new Date(lead.responseDueAt) < new Date())
  const assignmentDirty = Boolean(lead && (
    assignment.assignedToId !== (lead.assignedToId || '')
    || assignment.responseDueAt !== (lead.responseDueAt ? toLocalInput(new Date(lead.responseDueAt)) : '')
  ))
  const outcomeDirty = Boolean(lead && (
    outcome.stage !== lead.stage
    || outcome.conversionValue !== (lead.conversionValue === null || lead.conversionValue === undefined ? '' : String(lead.conversionValue))
    || (outcome.conversionValue && outcome.conversionCurrency !== (lead.conversionCurrency || 'AED'))
    || outcome.note.trim()
  ))
  const outcomeStageOptions = useMemo(() => lead && isLeadStage(lead.stage)
    ? leadStageTransitionOptions(lead.stage)
    : [], [lead])

  async function saveOutcome(event: React.FormEvent) {
    event.preventDefault()
    if (!lead) return
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const payload: Record<string, unknown> = {
        stage: outcome.stage,
        lostReason: outcome.stage === 'LOST' ? outcome.lostReason : null,
        note: outcome.note || null,
        expectedUpdatedAt: lead.updatedAt,
      }
      if (outcome.stage === 'WON') {
        payload.conversionValue = outcome.conversionValue.trim() || null
        payload.conversionCurrency = outcome.conversionValue.trim() ? outcome.conversionCurrency.trim().toUpperCase() : null
      }
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not record the outcome.')
      setNotice({ tone: 'success', text: ar ? 'تم تسجيل النتيجة كمعلومة مؤكدة يدويًا وربطها بالقياس.' : 'Outcome recorded as manually confirmed measurement evidence.' })
      await load()
    } catch (saveError) {
      setNotice({ tone: 'error', text: saveError instanceof Error ? saveError.message : 'Could not record the outcome.' })
    } finally {
      setSaving(false)
    }
  }

  async function saveAssignment(event: React.FormEvent) {
    event.preventDefault()
    if (!lead) return
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedToId: assignment.assignedToId || null,
          responseDueAt: assignment.responseDueAt ? new Date(assignment.responseDueAt).toISOString() : null,
          expectedUpdatedAt: lead.updatedAt,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update lead ownership.')
      setNotice({ tone: 'success', text: ar ? 'تم حفظ المسؤول وموعد الاستجابة في سجل النشاط.' : 'Owner and response deadline were recorded in the activity history.' })
      await load()
    } catch (saveError) {
      setNotice({ tone: 'error', text: saveError instanceof Error ? saveError.message : 'Could not update lead ownership.' })
    } finally {
      setSaving(false)
    }
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault()
    if (!lead) return
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/tasks`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, dueAt: new Date(task.dueAt).toISOString(), assignedToId: assignment.assignedToId || null }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not create follow-up task.')
      setTask({ title: '', dueAt: toLocalInput(new Date(Date.now() + 24 * 60 * 60_000)), priority: 'MEDIUM', note: '' })
      setNotice({ tone: 'success', text: ar ? 'تمت جدولة المتابعة بدون إرسال أي رسالة.' : 'Follow-up scheduled without sending any message.' })
      await load()
    } catch (taskError) {
      setNotice({ tone: 'error', text: taskError instanceof Error ? taskError.message : 'Could not create follow-up task.' })
    } finally {
      setSaving(false)
    }
  }

  async function resolveTask(item: LeadTask, status: 'COMPLETED' | 'CANCELLED') {
    if (!lead) return
    const token = authHeader()
    if (!token) return
    setBusyTaskId(item.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/tasks/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedUpdatedAt: item.updatedAt }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update follow-up task.')
      setNotice({ tone: 'success', text: status === 'COMPLETED' ? (ar ? 'تم تسجيل إنجاز المتابعة.' : 'Follow-up completion recorded.') : (ar ? 'تم إلغاء المهمة مع الاحتفاظ بالسجل.' : 'Task cancelled with its history preserved.') })
      await load()
    } catch (taskError) {
      setNotice({ tone: 'error', text: taskError instanceof Error ? taskError.message : 'Could not update follow-up task.' })
    } finally {
      setBusyTaskId(null)
    }
  }

  if (authLoading || loading) return <AppShell><div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#5E63FF]" /></div></AppShell>

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page min-h-screen bg-[#F6F8FC] px-4 py-5 sm:px-6 lg:px-8">
        <LuxuryWorkspaceHeader pageTitle={lead?.fullName || lead?.email || lead?.phone || (ar ? 'تفاصيل العميل' : 'Lead details')} pageSubtitle={ar ? 'ملكية واضحة، موعد استجابة، ومهام متابعة قابلة للتدقيق.' : 'Clear ownership, response SLA, and auditable follow-up tasks.'} primaryHref="/leads" primaryLabel={ar ? 'العودة للمسار' : 'Back to pipeline'} secondaryHref={null} />
        <LeadsNav />
        {notice ? <div aria-live="polite" className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>{notice.text}</div> : null}
        {!lead ? <section className="nx-os-card p-8 text-center text-sm font-bold text-slate-600">{ar ? 'لم يتم العثور على العميل.' : 'Lead not found.'}</section> : (
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <section className="nx-os-card p-5">
                <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><UserRound className="h-5 w-5" /></div><div><h2 className="text-base font-black text-[#0B1028]">{lead.fullName || (ar ? 'بدون اسم' : 'Unnamed lead')}</h2><p className="mt-1 text-xs text-slate-500">{[lead.email, lead.phone].filter(Boolean).join(' · ')}</p></div></div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-400">Stage</dt><dd className="mt-1 font-black text-slate-700">{lead.stage}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-400">Consent</dt><dd className="mt-1 font-black text-slate-700">{lead.consentStatus}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-400">Source</dt><dd className="mt-1 font-black text-slate-700">{lead.source}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-400">Campaign</dt><dd className="mt-1 truncate font-black text-slate-700">{lead.campaign?.name || '—'}</dd></div></dl>
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{ar ? 'إسناد أول تواصل' : 'First-touch attribution'}</p><p className="mt-2 text-xs font-black text-slate-700">{lead.attribution?.source || (ar ? 'مباشر / غير معروف' : 'Direct / unknown')}{lead.attribution?.medium ? ` / ${lead.attribution.medium}` : ''}</p><p className="mt-1 text-[10px] font-bold text-slate-500">UTM Campaign: {lead.attribution?.campaign || '—'}</p></div>
              </section>

              <form onSubmit={saveAssignment} className="nx-os-card p-5">
                <h2 className="text-sm font-black text-[#0B1028]">{ar ? 'المسؤول وSLA' : 'Owner & response SLA'}</h2>
                {responseOverdue ? <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700"><AlertTriangle className="h-4 w-4" />{ar ? 'تجاوز موعد أول استجابة' : 'First-response SLA overdue'}</div> : null}
                <label className="mt-4 block text-xs font-black text-slate-600">{ar ? 'المسؤول' : 'Owner'}<select value={assignment.assignedToId} onChange={event => setAssignment(current => ({ ...current, assignedToId: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="">{ar ? 'غير معيّن' : 'Unassigned'}</option>{operators.map(operator => <option key={operator.id} value={operator.id}>{operator.name || operator.email} · {operator.role}</option>)}</select></label>
                <label className="mt-4 block text-xs font-black text-slate-600">{ar ? 'موعد أول استجابة' : 'First response due'}<input type="datetime-local" value={assignment.responseDueAt} onChange={event => setAssignment(current => ({ ...current, responseDueAt: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" /></label>
                <button disabled={saving || !assignmentDirty} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{ar ? 'حفظ المسؤول والموعد' : 'Save owner and deadline'}</button>
              </form>

              <form onSubmit={saveOutcome} className="nx-os-card p-5">
                <div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-600" /><h2 className="text-sm font-black text-[#0B1028]">{ar ? 'المرحلة والنتيجة' : 'Stage & outcome'}</h2></div>
                <p className="mt-2 text-[11px] font-bold leading-5 text-slate-500">{ar ? 'WON يثبت التحويل بتأكيدك. قيمة الصفقة اختيارية ولا يقدّرها NEXUS.' : 'WON confirms the conversion by your decision. Outcome value is optional and never estimated by NEXUS.'}</p>
                <label className="mt-4 block text-xs font-black text-slate-600">{ar ? 'المرحلة' : 'Stage'}<select value={outcome.stage} onChange={event => setOutcome(current => ({ ...current, stage: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">{outcomeStageOptions.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select></label>
                {outcome.stage === 'LOST' ? <label className="mt-4 block text-xs font-black text-slate-600">{ar ? 'سبب الفقد' : 'Lost reason'}<textarea required value={outcome.lostReason} onChange={event => setOutcome(current => ({ ...current, lostReason: event.target.value }))} maxLength={500} className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" /></label> : null}
                {outcome.stage === 'WON' ? <div className="mt-4 grid grid-cols-[1fr_100px] gap-2"><label className="text-xs font-black text-slate-600">{ar ? 'قيمة الصفقة — اختياري' : 'Outcome value — optional'}<input type="number" min="0" max="9999999999.99" step="0.01" value={outcome.conversionValue} onChange={event => setOutcome(current => ({ ...current, conversionValue: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" /></label><label className="text-xs font-black text-slate-600">{ar ? 'العملة' : 'Currency'}<input disabled={!outcome.conversionValue} pattern="[A-Za-z]{3}" maxLength={3} value={outcome.conversionCurrency} onChange={event => setOutcome(current => ({ ...current, conversionCurrency: event.target.value.toUpperCase() }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black uppercase disabled:bg-slate-50" /></label></div> : null}
                <label className="mt-4 block text-xs font-black text-slate-600">{ar ? 'ملاحظة القرار — اختياري' : 'Decision note — optional'}<textarea value={outcome.note} onChange={event => setOutcome(current => ({ ...current, note: event.target.value }))} maxLength={1000} className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" /></label>
                <button disabled={saving || !outcomeDirty} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{ar ? 'تسجيل النتيجة' : 'Record outcome'}</button>
                {lead.convertedAt ? <p className="mt-3 text-[10px] font-bold text-emerald-700">{ar ? 'تحويل مؤكد يدويًا' : 'Manually confirmed conversion'} · {new Date(lead.convertedAt).toLocaleString(locale)}{lead.conversionValue !== null && lead.conversionValue !== undefined ? ` · ${lead.conversionValue} ${lead.conversionCurrency}` : ''}</p> : null}
              </form>
            </div>

            <div className="space-y-4">
              <section className="nx-os-card p-5">
                <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-[#5E63FF]" /><h2 className="text-base font-black text-[#0B1028]">{ar ? 'المتابعات' : 'Follow-up tasks'}</h2></div>
                <form onSubmit={createTask} className="mt-4 grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:grid-cols-2">
                  <input required value={task.title} onChange={event => setTask(current => ({ ...current, title: event.target.value }))} placeholder={ar ? 'مثال: مكالمة اكتشاف' : 'Example: discovery call'} maxLength={180} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 sm:col-span-2" />
                  <input required type="datetime-local" value={task.dueAt} onChange={event => setTask(current => ({ ...current, dueAt: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" />
                  <select value={task.priority} onChange={event => setTask(current => ({ ...current, priority: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option></select>
                  <textarea value={task.note} onChange={event => setTask(current => ({ ...current, note: event.target.value }))} placeholder={ar ? 'ملاحظة اختيارية' : 'Optional note'} maxLength={2000} className="min-h-20 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none sm:col-span-2" />
                  <button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#5E63FF] px-4 text-xs font-black text-white disabled:opacity-50 sm:col-span-2"><Plus className="h-4 w-4" />{ar ? 'جدولة المتابعة' : 'Schedule follow-up'}</button>
                </form>
                <div className="mt-4 space-y-2">{openTasks.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-500">{ar ? 'لا توجد مهام مفتوحة.' : 'No open tasks.'}</p> : openTasks.map(item => { const overdue = new Date(item.dueAt) < new Date(); return <article key={item.id} className={`rounded-2xl border p-4 ${overdue ? 'border-rose-100 bg-rose-50/50' : 'border-slate-100 bg-white'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-[#0B1028]">{item.title}</p><p className={`mt-1 text-xs font-bold ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>{new Date(item.dueAt).toLocaleString(locale)} · {item.priority} · {item.assignedTo?.name || item.assignedTo?.email || (ar ? 'غير معيّن' : 'Unassigned')}</p></div><div className="flex gap-2"><button type="button" disabled={busyTaskId === item.id} onClick={() => resolveTask(item, 'COMPLETED')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />{ar ? 'تمت' : 'Complete'}</button><button type="button" disabled={busyTaskId === item.id} onClick={() => resolveTask(item, 'CANCELLED')} className="h-9 rounded-lg bg-slate-100 px-3 text-[11px] font-black text-slate-600 disabled:opacity-50">{ar ? 'إلغاء' : 'Cancel'}</button></div></div></article> })}</div>
                {resolvedTasks.length ? <details className="mt-4"><summary className="cursor-pointer text-xs font-black text-slate-500">{ar ? `المهام المحسومة (${resolvedTasks.length})` : `Resolved tasks (${resolvedTasks.length})`}</summary><div className="mt-2 space-y-2">{resolvedTasks.map(item => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><strong>{item.title}</strong> · {item.status}</div>)}</div></details> : null}
              </section>

              <section className="nx-os-card p-5"><h2 className="text-sm font-black text-[#0B1028]">{ar ? 'سجل القرارات' : 'Decision history'}</h2><div className="mt-4 max-h-96 space-y-3 overflow-auto">{lead.activities.map(activity => <article key={activity.id} className="border-s border-slate-200 ps-4"><p className="text-xs font-black text-slate-700">{activity.type}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(activity.occurredAt).toLocaleString(locale)}</p>{activity.note ? <p className="mt-1 text-xs leading-5 text-slate-600">{activity.note}</p> : null}</article>)}</div></section>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  )
}
