'use client'

import AppShell from '@/components/AppShell'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { LeadsNav } from '@/components/leads/LeadsNav'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { Copy, ExternalLink, FormInput, Loader2, Pause, Play, Plus, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface CampaignOption { id: string; name: string }
interface CaptureForm {
  id: string
  publicId: string
  publicPath: string
  name: string
  title: string
  description?: string | null
  consentStatement?: string | null
  allowedOrigin?: string | null
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  submissionCount: number
  lastSubmissionAt?: string | null
  updatedAt: string
  campaign?: CampaignOption | null
}

const EMPTY_FORM = {
  name: '', title: '', description: '', campaignId: '', allowedOrigin: '',
  consentStatement: '',
}

export default function LeadCaptureFormsPage() {
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const [ready, setReady] = useState<boolean | null>(null)
  const [forms, setForms] = useState<CaptureForm[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    try {
      const readinessResponse = await fetch('/api/leads/readiness', { headers: { Authorization: token }, cache: 'no-store' })
      const readiness = await readinessResponse.json().catch(() => ({}))
      setReady(Boolean(readiness.ready))
      if (!readiness.ready) return
      const [formsResponse, campaignsResponse] = await Promise.all([
        fetch('/api/leads/forms', { headers: { Authorization: token }, cache: 'no-store' }),
        fetch('/api/campaigns', { headers: { Authorization: token }, cache: 'no-store' }),
      ])
      const [formsData, campaignsData] = await Promise.all([formsResponse.json(), campaignsResponse.json()])
      if (!formsResponse.ok) throw new Error(formsData.error || 'Could not load capture forms.')
      setForms(Array.isArray(formsData.forms) ? formsData.forms : [])
      const rows = Array.isArray(campaignsData.campaigns) ? campaignsData.campaigns : Array.isArray(campaignsData) ? campaignsData : []
      setCampaigns(rows.map((item: CampaignOption) => ({ id: item.id, name: item.name })))
    } catch (loadError) {
      setNotice({ tone: 'error', text: loadError instanceof Error ? loadError.message : 'Could not load capture forms.' })
    }
  }, [authHeader])

  useEffect(() => {
    if (!authLoading && isAuthenticated) load()
  }, [authLoading, isAuthenticated, load])

  async function createForm(event: React.FormEvent) {
    event.preventDefault()
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/leads/forms', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, campaignId: form.campaignId || null, allowedOrigin: form.allowedOrigin || null }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not create capture form.')
      if (data.form) {
        setForms(current => [data.form as CaptureForm, ...current.filter(item => item.id !== data.form.id)])
      }
      setForm(EMPTY_FORM)
      setShowCreate(false)
      setNotice({ tone: 'success', text: ar ? 'تم إنشاء النموذج. الاستقبال لا يرسل أي تواصل تلقائي.' : 'Form created. Intake triggers no automated outreach.' })
      await load()
    } catch (createError) {
      setNotice({ tone: 'error', text: createError instanceof Error ? createError.message : 'Could not create capture form.' })
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(item: CaptureForm, status: CaptureForm['status']) {
    const token = authHeader()
    if (!token) return
    setBusyId(item.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/leads/forms/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedUpdatedAt: item.updatedAt }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update form status.')
      setNotice({ tone: 'success', text: status === 'ACTIVE' ? (ar ? 'تم تفعيل الاستقبال.' : 'Capture activated.') : (ar ? 'تم إيقاف الاستقبال.' : 'Capture paused.') })
      await load()
    } catch (updateError) {
      setNotice({ tone: 'error', text: updateError instanceof Error ? updateError.message : 'Could not update form status.' })
    } finally {
      setBusyId(null)
    }
  }

  async function copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
      setNotice({ tone: 'success', text: ar ? 'تم نسخ رابط النموذج.' : 'Form link copied.' })
    } catch {
      setNotice({ tone: 'error', text: ar ? 'تعذر نسخ الرابط تلقائيًا.' : 'Could not copy the link automatically.' })
    }
  }

  if (authLoading || ready === null) {
    return <WorkspaceRouteLoading labelAr="جارٍ تجهيز نماذج الاستقبال" labelEn="Preparing capture forms" />
  }

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page min-h-screen bg-[#F6F8FC] px-4 py-5 sm:px-6 lg:px-8">
        <LuxuryWorkspaceHeader
          pageTitle={ar ? 'نماذج استقبال العملاء' : 'Lead capture forms'}
          pageSubtitle={ar ? 'أنشئ نقطة استقبال مرتبطة بحملة، مع موافقة صريحة وحدود تشغيل ظاهرة.' : 'Create campaign-linked intake with explicit consent and visible operating boundaries.'}
          primaryHref={ready ? null : '/leads'}
          secondaryHref="/leads"
          secondaryLabel={ar ? 'المسار' : 'Pipeline'}
        />
        <LeadsNav />
        {notice ? <div aria-live="polite" className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>{notice.text}</div> : null}

        {!ready ? (
          <section className="nx-os-card mx-auto max-w-3xl p-7 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#5E63FF]" /><h2 className="mt-4 text-xl font-black text-[#0B1028]">{ar ? 'CRM غير مفعّل في هذه البيئة' : 'CRM is not enabled in this environment'}</h2><p className="mt-2 text-sm leading-7 text-slate-500">{ar ? 'النماذج العامة تبقى مغلقة حتى اكتمال ترحيل قاعدة البيانات واختبارات العزل.' : 'Public forms stay closed until migration and isolation verification pass.'}</p></section>
        ) : (
          <>
            <section className="nx-os-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="text-base font-black text-[#0B1028]">{ar ? 'نقاط استقبال حقيقية' : 'Real intake points'}</h2><p className="mt-1 text-xs leading-6 text-slate-500">{ar ? 'كل رابط يضيف البيانات داخل مساحة العمل فقط، ولا يكشف سجلات العملاء.' : 'Every link is write-only for its workspace and never exposes a lead.'}</p></div>
                <button type="button" onClick={() => setShowCreate(current => !current)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-4 text-xs font-black text-white"><Plus className="h-4 w-4" />{showCreate ? (ar ? 'إغلاق' : 'Close') : (ar ? 'نموذج جديد' : 'New form')}</button>
              </div>
              {showCreate ? (
                <form onSubmit={createForm} className="mt-5 grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 md:grid-cols-2">
                  <input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder={ar ? 'اسم داخلي للنموذج' : 'Internal form name'} maxLength={120} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                  <input required value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder={ar ? 'العنوان الذي يراه العميل' : 'Public form title'} maxLength={160} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                  <textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder={ar ? 'وصف مختصر' : 'Short description'} maxLength={1200} className="min-h-24 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-400" />
                  <textarea value={form.consentStatement} onChange={event => setForm(current => ({ ...current, consentStatement: event.target.value }))} placeholder={ar ? 'نص الموافقة الاختياري؛ بدونه تظل حالة الموافقة غير معروفة' : 'Optional consent statement; without it consent stays UNKNOWN'} maxLength={1200} className="min-h-24 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-400" />
                  <select value={form.campaignId} onChange={event => setForm(current => ({ ...current, campaignId: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="">{ar ? 'بدون حملة' : 'No campaign'}</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
                  <input value={form.allowedOrigin} onChange={event => setForm(current => ({ ...current, allowedOrigin: event.target.value }))} placeholder={ar ? 'https://example.com — نطاق استضافة اختياري' : 'https://example.com (optional origin)'} inputMode="url" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                  <button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#5E63FF] px-4 text-xs font-black text-white disabled:opacity-50 md:col-span-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FormInput className="h-4 w-4" />}{ar ? 'إنشاء النموذج' : 'Create form'}</button>
                </form>
              ) : null}
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              {forms.length === 0 ? <div className="nx-os-card p-8 text-center lg:col-span-2"><FormInput className="mx-auto h-9 w-9 text-slate-300" /><h3 className="mt-3 text-base font-black text-[#0B1028]">{ar ? 'لا توجد نماذج بعد' : 'No capture forms yet'}</h3></div> : forms.map(item => (
                <article key={item.id} className="nx-os-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><p className="truncate text-base font-black text-[#0B1028]">{item.name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.campaign?.name || (ar ? 'بدون حملة' : 'No campaign')}</p></div>
                    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : item.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-black text-slate-800">{item.title}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-black text-[#0B1028]">{item.submissionCount}</p><p className="text-[11px] font-bold text-slate-500">{ar ? 'إرسال مسجل' : 'Recorded submissions'}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="truncate text-xs font-black text-[#0B1028]">{item.allowedOrigin || (ar ? 'مستضاف فقط' : 'Hosted link')}</p><p className="mt-1 text-[11px] font-bold text-slate-500">{ar ? 'نطاق الاستضافة' : 'Origin'}</p></div></div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => copyPath(item.publicPath)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[11px] font-black text-slate-600"><Copy className="h-3.5 w-3.5" />{ar ? 'نسخ الرابط' : 'Copy link'}</button>
                    <Link href={item.publicPath} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[11px] font-black text-slate-600"><ExternalLink className="h-3.5 w-3.5" />{ar ? 'معاينة' : 'Preview'}</Link>
                    {item.status === 'ACTIVE' ? <button type="button" disabled={busyId === item.id} onClick={() => updateStatus(item, 'PAUSED')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-50 px-3 text-[11px] font-black text-amber-700 disabled:opacity-50"><Pause className="h-3.5 w-3.5" />{ar ? 'إيقاف' : 'Pause'}</button> : item.status === 'PAUSED' ? <button type="button" disabled={busyId === item.id} onClick={() => updateStatus(item, 'ACTIVE')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 disabled:opacity-50"><Play className="h-3.5 w-3.5" />{ar ? 'تفعيل' : 'Activate'}</button> : null}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </main>
    </AppShell>
  )
}
