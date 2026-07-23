'use client'

import AppShell from '@/components/AppShell'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { LeadsNav } from '@/components/leads/LeadsNav'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  isLeadStage,
  leadStageTransitionOptions,
  type LeadStage,
} from '@/lib/leadLifecycle'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Database,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  UserRoundSearch,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface CampaignOption { id: string; name: string }
interface OperatorOption { id: string; name?: string | null; email: string }

interface LeadRecord {
  id: string
  fullName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  source: string
  stage: LeadStage
  score: number
  consentStatus: string
  campaign?: CampaignOption | null
  assignedTo?: OperatorOption | null
  responseDueAt?: string | null
  firstContactedAt?: string | null
  nextFollowUpAt?: string | null
  lastActivityAt?: string | null
  updatedAt: string
  _count?: { activities: number; tasks: number }
}

interface Readiness {
  enabled: boolean
  ready: boolean
  state: 'disabled' | 'ready' | 'migration_required' | 'database_unavailable'
  migrationRequired: boolean
  outreachAutomation: false
}

interface LeadSummary {
  total: number
  byStage: Record<LeadStage, number>
  overdueResponseCount: number
}

const EMPTY_FORM = {
  fullName: '', email: '', phone: '', company: '', source: 'MANUAL',
  campaignId: '', consentStatus: 'UNKNOWN', consentSource: '', note: '',
}

const STAGE_TONES: Record<LeadStage, string> = {
  NEW: 'bg-sky-50 text-sky-700 border-sky-100',
  CONTACTED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  QUALIFIED: 'bg-violet-50 text-violet-700 border-violet-100',
  NURTURING: 'bg-amber-50 text-amber-700 border-amber-100',
  OPPORTUNITY: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  WON: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  LOST: 'bg-rose-50 text-rose-700 border-rose-100',
  DISQUALIFIED: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function LeadsPage() {
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const copy = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar])
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [summary, setSummary] = useState<LeadSummary>({
    total: 0,
    byStage: Object.fromEntries(LEAD_STAGES.map(stage => [stage, 0])) as Record<LeadStage, number>,
    overdueResponseCount: 0,
  })
  const [filterStage, setFilterStage] = useState('ALL')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [lostDecision, setLostDecision] = useState<{ lead: LeadRecord; reason: string } | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const stageLabel = useCallback((stage: string) => {
    const labels: Record<string, [string, string]> = {
      NEW: ['جديد', 'New'], CONTACTED: ['تم التواصل', 'Contacted'],
      QUALIFIED: ['مؤهل', 'Qualified'], NURTURING: ['رعاية', 'Nurturing'],
      OPPORTUNITY: ['فرصة', 'Opportunity'], WON: ['مكتسب', 'Won'],
      LOST: ['مفقود', 'Lost'], DISQUALIFIED: ['غير مؤهل', 'Disqualified'],
    }
    return labels[stage]?.[ar ? 0 : 1] ?? stage
  }, [ar])

  const loadWorkspace = useCallback(async () => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    setLoading(true)
    try {
      const readyRes = await fetch('/api/leads/readiness', {
        headers: { Authorization: token }, cache: 'no-store',
      })
      const readyData = await readyRes.json() as Readiness
      setReadiness(readyData)
      if (!readyData.ready) return

      const params = new URLSearchParams()
      if (filterStage !== 'ALL') params.set('stage', filterStage)
      if (query.trim()) params.set('q', query.trim())
      const [leadsRes, campaignsRes] = await Promise.all([
        fetch(`/api/leads?${params.toString()}`, { headers: { Authorization: token }, cache: 'no-store' }),
        fetch('/api/campaigns', { headers: { Authorization: token }, cache: 'no-store' }),
      ])
      const [leadData, campaignData] = await Promise.all([
        leadsRes.json().catch(() => ({})), campaignsRes.json().catch(() => ({})),
      ])
      if (!leadsRes.ok) throw new Error(leadData.error || copy('تعذر تحميل العملاء المحتملين.', 'Could not load leads.'))
      setLeads(Array.isArray(leadData.leads) ? leadData.leads : [])
      if (leadData.summary) setSummary(leadData.summary)
      const campaignRows = Array.isArray(campaignData.campaigns) ? campaignData.campaigns : Array.isArray(campaignData) ? campaignData : []
      setCampaigns(campaignRows.map((campaign: CampaignOption) => ({ id: campaign.id, name: campaign.name })))
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر تحميل CRM.', 'Could not load CRM.') })
    } finally {
      setLoading(false)
    }
  }, [authHeader, copy, filterStage, isAuthenticated, query])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    const timer = window.setTimeout(() => { if (!authLoading && isAuthenticated) loadWorkspace() }, 250)
    return () => window.clearTimeout(timer)
  }, [authLoading, isAuthenticated, loadWorkspace])

  useEffect(() => {
    if (notice?.tone !== 'success') return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!lostDecision) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyLeadId) setLostDecision(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [busyLeadId, lostDecision])

  const funnelValue = useMemo(() => (
    summary.byStage.QUALIFIED + summary.byStage.OPPORTUNITY + summary.byStage.WON
  ), [summary])

  async function createLead(event: React.FormEvent) {
    event.preventDefault()
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          campaignId: form.campaignId || null,
          consentSource: form.consentSource || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر إنشاء العميل المحتمل.', 'Could not create lead.'))
      setForm(EMPTY_FORM)
      setShowCreate(false)
      setNotice({ tone: 'success', text: copy('تم إنشاء العميل المحتمل وربطه بسجل نشاط واضح.', 'Lead created with a traceable activity record.') })
      await loadWorkspace()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر إنشاء العميل المحتمل.', 'Could not create lead.') })
    } finally {
      setSaving(false)
    }
  }

  async function updateStage(lead: LeadRecord, stage: LeadStage, lostReason?: string) {
    const token = authHeader()
    if (!token || stage === lead.stage) return
    if (stage === 'LOST' && !lostReason) {
      setLostDecision({ lead, reason: '' })
      return
    }
    setBusyLeadId(lead.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, lostReason, expectedUpdatedAt: lead.updatedAt }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر تحديث المرحلة.', 'Could not update stage.'))
      setLostDecision(null)
      setNotice({ tone: 'success', text: copy('تم تحديث المرحلة وتسجيل القرار.', 'Stage updated and decision recorded.') })
      await loadWorkspace()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر تحديث المرحلة.', 'Could not update stage.') })
    } finally {
      setBusyLeadId(null)
    }
  }

  if (authLoading || (loading && !readiness)) {
    return <WorkspaceRouteLoading labelAr="جارٍ تجهيز مساحة العملاء المحتملين" labelEn="Preparing leads workspace" />
  }

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page min-h-screen bg-[#F6F8FC] px-4 py-5 sm:px-6 lg:px-8">
        <LuxuryWorkspaceHeader
          pageTitle={copy('العملاء المحتملون وCRM', 'Leads & CRM')}
          pageSubtitle={copy(
            'اربط كل فرصة بمصدرها وحملتها وقرار المتابعة، بدون ادعاء تحويل أو إرسال تلقائي.',
            'Connect every opportunity to its source, campaign, and follow-up decision without claiming conversions or sending automatically.',
          )}
          primaryHref={readiness?.ready ? null : '/connections'}
          primaryLabel={copy('مراجعة الجاهزية', 'Review readiness')}
          secondaryHref="/campaigns"
          secondaryLabel={copy('الحملات', 'Campaigns')}
        />
        <LeadsNav />

        {notice ? (
          <div aria-live="polite" className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>
            {notice.text}
          </div>
        ) : null}

        {!readiness?.ready ? (
          <section className="nx-os-card mx-auto max-w-4xl p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#5E63FF]">
              {readiness?.migrationRequired ? <Database className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <h2 className="mt-5 text-xl font-black text-[#0B1028]">
              {readiness?.migrationRequired
                ? copy('تجهيز قاعدة العملاء مطلوب قبل التفعيل', 'Customer database setup is required before activation')
                : copy('مساحة العملاء غير مفعلة بعد', 'The customer workspace is not active yet')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-600">
              {readiness?.migrationRequired
                ? copy('لن نخزن بيانات عملاء قبل تجهيز سجلات العملاء والنشاطات والمهام والنماذج، والتحقق من عزل كل مساحة عمل في بيئة اختبار قابلة للاسترجاع.', 'No customer data will be stored until customer, activity, task, and form records plus workspace isolation are verified in a recoverable test environment.')
                : copy('ستظل المساحة مغلقة حتى يكتمل تجهيز قاعدة العملاء واختبارات العزل. النظام لا يرسل بريدًا أو رسائل أو حملات تلقائيًا.', 'The workspace remains closed until customer-data setup and isolation tests pass. The system sends no email, messages, or campaigns automatically.')}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                copy('عزل كامل لكل Workspace', 'Workspace isolation'),
                copy('منع التكرار بالبريد والهاتف', 'Email/phone deduplication'),
                copy('Consent موثق وليس مفترضًا', 'Documented, never inferred consent'),
              ].map(item => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-700">{item}</div>)}
            </div>
            <p className="mt-5 text-[11px] font-bold text-slate-500">{copy('استقبال العملاء: غير مفعّل · الإرسال التلقائي: متوقف', 'Lead intake: inactive · automated outreach: off')}</p>
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                [copy('إجمالي العملاء', 'Total leads'), summary.total],
                [copy('جديد', 'New'), summary.byStage.NEW],
                [copy('داخل المسار', 'Qualified pipeline'), funnelValue],
                [copy('فرص', 'Opportunities'), summary.byStage.OPPORTUNITY],
                [copy('مكتسب', 'Won'), summary.byStage.WON],
                [copy('SLA متأخر', 'Overdue SLA'), summary.overdueResponseCount],
              ].map(([label, value], index) => (
                <article key={String(label)} className="nx-os-card p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</p>
                  <p className={`mt-2 text-2xl font-black ${index === 4 ? 'text-emerald-600' : index === 5 && Number(value) > 0 ? 'text-rose-600' : 'text-[#0B1028]'}`}>{value}</p>
                </article>
              ))}
            </section>

            <section className="nx-os-card mt-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-black text-[#0B1028]">{copy('خط متابعة واحد واضح', 'One clear follow-up pipeline')}</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">{copy('كل تغيير مرحلة يُحفظ كحدث. لا توجد رسائل أو مكالمات آلية.', 'Every stage change is recorded. No messages or calls are automated.')}</p>
                </div>
                <button type="button" onClick={() => setShowCreate(value => !value)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-4 text-xs font-black text-white">
                  {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {showCreate ? copy('إغلاق', 'Close') : copy('عميل محتمل جديد', 'New lead')}
                </button>
              </div>

              {showCreate ? (
                <form onSubmit={createLead} className="mt-5 grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <input value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} placeholder={copy('الاسم', 'Full name')} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                  <input value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder={copy('البريد الإلكتروني', 'Email')} type="email" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                  <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder={copy('الهاتف', 'Phone')} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                  <input value={form.company} onChange={event => setForm({ ...form, company: event.target.value })} placeholder={copy('الشركة', 'Company')} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                  <select value={form.source} onChange={event => setForm({ ...form, source: event.target.value })} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                    {LEAD_SOURCES.map(source => <option key={source} value={source}>{source.replace('_', ' ')}</option>)}
                  </select>
                  <select value={form.campaignId} onChange={event => setForm({ ...form, campaignId: event.target.value })} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                    <option value="">{copy('بدون حملة محددة', 'No campaign assigned')}</option>
                    {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                  </select>
                  <select value={form.consentStatus} onChange={event => setForm({ ...form, consentStatus: event.target.value })} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                    <option value="UNKNOWN">{copy('Consent غير معروف', 'Consent unknown')}</option>
                    <option value="GRANTED">{copy('Consent موثق', 'Consent granted')}</option>
                    <option value="DENIED">{copy('رفض التواصل', 'Consent denied')}</option>
                  </select>
                  <input value={form.consentSource} onChange={event => setForm({ ...form, consentSource: event.target.value })} placeholder={copy('مصدر الموافقة إن وُجد', 'Consent evidence/source')} disabled={form.consentStatus !== 'GRANTED'} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400" />
                  <textarea value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} placeholder={copy('ملاحظة أولية اختيارية', 'Optional intake note')} className="min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none md:col-span-2 xl:col-span-3" />
                  <button disabled={saving || (!form.email.trim() && !form.phone.trim())} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#5E63FF] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {copy('إنشاء وتسجيل المصدر', 'Create with source record')}
                  </button>
                </form>
              ) : null}
            </section>

            <section className="nx-os-card mt-4 overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={query} onChange={event => setQuery(event.target.value)} placeholder={copy('ابحث بالاسم أو البريد أو الهاتف أو الشركة', 'Search name, email, phone, or company')} className="h-11 w-full rounded-xl border border-slate-200 bg-white ps-10 pe-3 text-sm outline-none focus:border-indigo-400" />
                </div>
                <select value={filterStage} onChange={event => setFilterStage(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700">
                  <option value="ALL">{copy('كل المراحل', 'All stages')}</option>
                  {LEAD_STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}
                </select>
              </div>

              {loading ? <div className="grid min-h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#5E63FF]" /></div> : leads.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                  <UserRoundSearch className="h-10 w-10 text-slate-300" />
                  <h3 className="mt-3 text-base font-black text-[#0B1028]">{copy('لا توجد فرص مطابقة', 'No matching opportunities')}</h3>
                  <p className="mt-1 max-w-md text-sm text-slate-500">{copy('أنشئ أول Lead حقيقي واربطه بمصدره. لن نعرض أرقامًا تجريبية على أنها نتائج.', 'Create the first real lead and attach its source. Demo numbers are never shown as results.')}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leads.map(lead => {
                    const options = isLeadStage(lead.stage) ? leadStageTransitionOptions(lead.stage) : [lead.stage]
                    const responseOverdue = Boolean(lead.responseDueAt && !lead.firstContactedAt && !['WON', 'LOST', 'DISQUALIFIED'].includes(lead.stage) && new Date(lead.responseDueAt) < new Date())
                    return (
                      <article key={lead.id} className="grid gap-4 p-4 transition hover:bg-slate-50/70 xl:grid-cols-[1.15fr_0.9fr_0.85fr_0.9fr_auto_auto] xl:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#0B1028]">{lead.fullName || lead.email || lead.phone || copy('بدون اسم', 'Unnamed lead')}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{[lead.email, lead.phone, lead.company].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-slate-700">{lead.campaign?.name || copy('بدون حملة', 'No campaign')}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-400">{lead.source.replace('_', ' ')} · {lead.assignedTo?.name || lead.assignedTo?.email || copy('غير معيّن', 'Unassigned')}</p>
                        </div>
                        <div>
                          <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-black ${lead.consentStatus === 'GRANTED' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : lead.consentStatus === 'UNKNOWN' ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>
                            {copy('Consent: ', 'Consent: ')}{lead.consentStatus}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          <p>{lead._count?.activities ?? 0} {copy('أحداث', 'events')} · {lead._count?.tasks ?? 0} {copy('مهام', 'tasks')}</p>
                          {responseOverdue ? <p className="mt-1 inline-flex items-center gap-1 text-rose-600"><CalendarClock className="h-3.5 w-3.5" />{copy('تجاوز SLA', 'SLA overdue')}</p> : lead.nextFollowUpAt ? <p className="mt-1 text-slate-400">{new Date(lead.nextFollowUpAt).toLocaleDateString(locale)}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-lg border px-2 py-1 text-[11px] font-black ${STAGE_TONES[lead.stage]}`}>{stageLabel(lead.stage)}</span>
                          <select
                            aria-label={copy('تغيير مرحلة العميل', 'Change lead stage')}
                            value={lead.stage}
                            disabled={busyLeadId === lead.id}
                            onChange={event => updateStage(lead, event.target.value as LeadStage)}
                            className="h-9 max-w-36 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700 disabled:opacity-50"
                          >
                            {options.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}
                          </select>
                        </div>
                        <Link href={`/leads/${encodeURIComponent(lead.id)}`} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 hover:border-indigo-200 hover:text-indigo-700">
                          {copy('تشغيل', 'Operate')}<ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="nx-os-card p-4"><ShieldCheck className="h-5 w-5 text-[#5E63FF]" /><p className="mt-3 text-sm font-black text-[#0B1028]">{copy('حدود التواصل', 'Outreach boundary')}</p><p className="mt-1 text-xs leading-6 text-slate-500">{copy('Consent المسجل دليل يدوي فقط. هذه النسخة لا ترسل أي تواصل.', 'Recorded consent is manual evidence only. This release sends no outreach.')}</p></div>
              <div className="nx-os-card p-4"><Database className="h-5 w-5 text-[#5E63FF]" /><p className="mt-3 text-sm font-black text-[#0B1028]">{copy('مصدر الحقيقة', 'Source of truth')}</p><p className="mt-1 text-xs leading-6 text-slate-500">{copy('كل Lead معزول داخل Workspace ومربوط اختياريًا بحملة حقيقية.', 'Every lead is workspace-isolated and optionally tied to a real campaign.')}</p></div>
              <Link href="/analytics" className="nx-os-card group p-4"><ArrowUpRight className="h-5 w-5 text-[#5E63FF] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /><p className="mt-3 text-sm font-black text-[#0B1028]">{copy('القياس التالي', 'Next measurement layer')}</p><p className="mt-1 text-xs leading-6 text-slate-500">{copy('الربط بين Lead وconversion يعتمد على المصدر المسجل وWON المؤكد يدويًا؛ أرقام المنصات تظل طبقة منفصلة.', 'Lead-to-conversion attribution uses the recorded source and manually confirmed WON outcome; platform metrics remain a separate layer.')}</p></Link>
            </section>
          </>
        )}

        {lostDecision ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="lost-decision-title" className="w-full max-w-lg rounded-3xl border border-white/30 bg-white p-5 shadow-2xl">
              <h2 id="lost-decision-title" className="text-lg font-black text-[#0B1028]">{copy('سجّل سبب فقد الفرصة', 'Record why the opportunity was lost')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{copy('السبب يصبح دليلًا تشغيليًا للتحسين، وليس حكمًا آليًا على العميل.', 'The reason becomes operational evidence for improvement, not an automated judgment about the lead.')}</p>
              <textarea autoFocus value={lostDecision.reason} onChange={event => setLostDecision({ ...lostDecision, reason: event.target.value })} className="mt-4 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" placeholder={copy('مثال: الميزانية غير مناسبة الآن', 'Example: budget is not available now')} />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setLostDecision(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600">{copy('إلغاء', 'Cancel')}</button>
                <button type="button" disabled={!lostDecision.reason.trim() || busyLeadId === lostDecision.lead.id} onClick={() => updateStage(lostDecision.lead, 'LOST', lostDecision.reason)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-black text-white disabled:opacity-50">
                  {busyLeadId === lostDecision.lead.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {copy('تأكيد وتسجيل السبب', 'Confirm and record reason')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  )
}
