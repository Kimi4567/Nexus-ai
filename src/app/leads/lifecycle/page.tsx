'use client'

import AppShell from '@/components/AppShell'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { LeadsNav } from '@/components/leads/LeadsNav'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { Ban, CheckCircle2, Clipboard, FileCheck2, Loader2, MailCheck, Plus, ShieldCheck, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface LeadOption {
  id: string
  fullName?: string | null
  email?: string | null
  phone?: string | null
  consentStatus: string
}

interface DeliveryView {
  eligibleAfterProviderApproval: boolean
  blockers: string[]
}

interface LifecycleMessage {
  id: string
  channel: 'EMAIL' | 'SMS'
  purpose: string
  subject?: string | null
  body: string
  status: 'DRAFT' | 'APPROVED' | 'CANCELLED'
  providerState: 'NOT_CONNECTED'
  updatedAt: string
  approvedAt?: string | null
  delivery?: DeliveryView | null
  lead: LeadOption
}

interface Suppression {
  id: string
  channel: 'EMAIL' | 'SMS'
  reason: string
  source: string
  createdAt: string
  lead?: LeadOption | null
}

interface MessageFormState {
  leadId: string
  channel: 'EMAIL' | 'SMS'
  purpose: string
  subject: string
  body: string
}

interface SuppressionFormState {
  leadId: string
  channel: 'EMAIL' | 'SMS'
  reason: string
}

const EMPTY_MESSAGE: MessageFormState = { leadId: '', channel: 'EMAIL', purpose: 'FOLLOW_UP', subject: '', body: '' }
const EMPTY_SUPPRESSION: SuppressionFormState = { leadId: '', channel: 'EMAIL', reason: '' }

const CONSENT_LABELS: Record<string, [string, string]> = {
  GRANTED: ['موافقة موثقة', 'Consent granted'],
  DENIED: ['الموافقة مرفوضة', 'Consent denied'],
  REVOKED: ['الموافقة مسحوبة', 'Consent revoked'],
  UNKNOWN: ['الموافقة غير معروفة', 'Consent unknown'],
}

const PURPOSE_LABELS: Record<string, [string, string]> = {
  FOLLOW_UP: ['متابعة', 'Follow-up'],
  NURTURE: ['رعاية العميل', 'Nurture'],
  WIN_BACK: ['استعادة العميل', 'Win-back'],
  DOUBLE_OPT_IN: ['تأكيد اشتراك مزدوج — نص فقط', 'Double opt-in — copy only'],
}

const DELIVERY_BLOCKER_LABELS: Record<string, [string, string]> = {
  PROVIDER_NOT_CONNECTED: ['مزود الإرسال غير متصل', 'Provider not connected'],
  SENDER_NOT_VERIFIED: ['هوية المرسل غير موثقة', 'Sender not verified'],
  CONSENT_NOT_GRANTED: ['لا توجد موافقة صالحة', 'Consent not granted'],
  CONTACT_SUPPRESSED: ['التواصل محظور لهذه الجهة', 'Contact suppressed'],
  RECIPIENT_MISSING: ['بيانات المستلم غير مكتملة', 'Recipient missing'],
}

function localizedLabel(labels: Record<string, [string, string]>, value: string, ar: boolean): string {
  return labels[value]?.[ar ? 0 : 1] || (ar ? 'حالة تشغيل مسجلة' : value.replace(/_/g, ' ').toLowerCase())
}

function channelLabel(channel: 'EMAIL' | 'SMS', ar: boolean): string {
  if (!ar) return channel
  return channel === 'EMAIL' ? 'بريد إلكتروني' : 'رسالة نصية'
}

function messageStatusLabel(status: LifecycleMessage['status'], ar: boolean): string {
  const labels: Record<LifecycleMessage['status'], [string, string]> = {
    DRAFT: ['مسودة', 'Draft'],
    APPROVED: ['النص معتمد', 'Approved copy'],
    CANCELLED: ['ملغاة', 'Cancelled'],
  }
  return labels[status][ar ? 0 : 1]
}

export default function LeadLifecyclePage() {
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState<boolean | null>(null)
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [messages, setMessages] = useState<LifecycleMessage[]>([])
  const [suppressions, setSuppressions] = useState<Suppression[]>([])
  const [messageForm, setMessageForm] = useState<MessageFormState>(EMPTY_MESSAGE)
  const [suppressionForm, setSuppressionForm] = useState<SuppressionFormState>(EMPTY_SUPPRESSION)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [previewPath, setPreviewPath] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setLoading(true)
    try {
      const readinessResponse = await fetch('/api/lifecycle/readiness', { headers: { Authorization: token }, cache: 'no-store' })
      const readiness = await readinessResponse.json().catch(() => ({}))
      if (!readinessResponse.ok) throw new Error(readiness.error || 'Could not verify lifecycle readiness.')
      setReady(Boolean(readiness.ready))
      if (!readiness.ready) return

      const [leadsResponse, messagesResponse, suppressionsResponse] = await Promise.all([
        fetch('/api/leads?limit=100', { headers: { Authorization: token }, cache: 'no-store' }),
        fetch('/api/lifecycle/messages', { headers: { Authorization: token }, cache: 'no-store' }),
        fetch('/api/lifecycle/suppressions', { headers: { Authorization: token }, cache: 'no-store' }),
      ])
      const [leadsData, messagesData, suppressionsData] = await Promise.all([
        leadsResponse.json().catch(() => ({})), messagesResponse.json().catch(() => ({})), suppressionsResponse.json().catch(() => ({})),
      ])
      if (!leadsResponse.ok) throw new Error(leadsData.error || 'Could not load leads.')
      if (!messagesResponse.ok) throw new Error(messagesData.error || 'Could not load lifecycle drafts.')
      if (!suppressionsResponse.ok) throw new Error(suppressionsData.error || 'Could not load suppressions.')
      setLeads(Array.isArray(leadsData.leads) ? leadsData.leads : [])
      setMessages(Array.isArray(messagesData.messages) ? messagesData.messages : [])
      setSuppressions(Array.isArray(suppressionsData.suppressions) ? suppressionsData.suppressions : [])
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load lifecycle controls.' })
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (!authLoading && isAuthenticated) void load()
  }, [authLoading, isAuthenticated, load])

  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/lifecycle/messages', {
        method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(messageForm),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not create lifecycle draft.')
      setMessageForm(EMPTY_MESSAGE)
      setNotice({ tone: 'success', text: ar ? 'تم حفظ المسودة فقط. لم يتم إرسال أي رسالة.' : 'Draft saved only. No message was sent.' })
      await load()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not create lifecycle draft.' })
    } finally {
      setSaving(false)
    }
  }

  async function approveCopy(message: LifecycleMessage) {
    const token = authHeader()
    if (!token) return
    setBusyId(message.id)
    setNotice(null)
    setPreviewPath(null)
    try {
      const response = await fetch(`/api/lifecycle/messages/${encodeURIComponent(message.id)}/approve`, {
        method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: message.updatedAt }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not approve lifecycle copy.')
      setPreviewPath(typeof data.previewUnsubscribePath === 'string' ? data.previewUnsubscribePath : null)
      setNotice({ tone: 'success', text: ar ? 'تم اعتماد النص فقط. التسليم ما زال مقفلًا ولا يوجد إرسال.' : 'Copy approved only. Delivery remains BLOCKED and nothing was sent.' })
      await load()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not approve lifecycle copy.' })
    } finally {
      setBusyId(null)
    }
  }

  async function suppressContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/lifecycle/suppressions', {
        method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(suppressionForm),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not suppress contact.')
      setSuppressionForm(EMPTY_SUPPRESSION)
      setNotice({ tone: 'success', text: ar ? 'تم تسجيل المنع الدائم لهذه القناة.' : 'Durable channel suppression recorded.' })
      await load()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not suppress contact.' })
    } finally {
      setSaving(false)
    }
  }

  async function copyPreviewPath() {
    if (!previewPath) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${previewPath}`)
      setNotice({ tone: 'success', text: ar ? 'تم نسخ رابط اختبار إلغاء الاشتراك.' : 'Unsubscribe test link copied.' })
    } catch {
      setNotice({ tone: 'error', text: ar ? 'تعذر نسخ الرابط.' : 'Could not copy the link.' })
    }
  }

  if (authLoading || (loading && ready === null)) {
    return <WorkspaceRouteLoading labelAr="جارٍ تجهيز مسار التواصل" labelEn="Preparing lifecycle workspace" />
  }

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page min-h-screen bg-[#F6F8FC] px-4 py-5 sm:px-6 lg:px-8">
        <LuxuryWorkspaceHeader
          pageTitle={ar ? 'رسائل دورة المتابعة' : 'Lifecycle Email & SMS'}
          pageSubtitle={ar ? 'صياغة واعتماد وضوابط موافقة قبل توصيل أي مزود خارجي.' : 'Drafting, approval, and consent controls before any external provider is connected.'}
          primaryHref={null}
          secondaryHref="/leads"
          secondaryLabel={ar ? 'المسار' : 'Pipeline'}
        />
        <LeadsNav />
        <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0" /><div><p className="font-black">{ar ? 'وضع ما قبل التصاريح — الإرسال مقفل' : 'Pre-permission mode — sending locked'}</p><p>{ar ? 'المسودة تعني نصًا محفوظًا فقط، والاعتماد يعني اعتماد النص وحده. لا توجد حالة إرسال أو قائمة تسليم أو معرّف مزود. تأكيد الاشتراك هنا مسودة نص فقط، ولا يثبت هوية جهة الاتصال قبل ربط مزود ونجاح تحقق موثّق.' : 'Draft means draft, and Approved means copy approval only. There is no sent state, delivery queue, or provider reference. Double opt-in is copy-only here and does not verify contact identity until an audited provider and verification callback are connected.'}</p></div></div>
        </section>
        {notice ? <div aria-live="polite" className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>{notice.text}</div> : null}
        {previewPath ? <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-xs text-indigo-900 sm:flex-row sm:items-center sm:justify-between"><p><strong>{ar ? 'رابط اختبار فقط:' : 'Test link only:'}</strong> {ar ? 'يختبر مسار إلغاء الاشتراك، ولا يعني أن الرسالة أُرسلت.' : 'Validates the unsubscribe path; it does not mean a message was sent.'}</p><button type="button" onClick={() => void copyPreviewPath()} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-3 font-black"><Clipboard className="h-3.5 w-3.5" />{ar ? 'نسخ' : 'Copy'}</button></div> : null}

        {!ready ? (
          <section className="nx-os-card mx-auto max-w-3xl p-8 text-center"><MailCheck className="mx-auto h-10 w-10 text-[#5E63FF]" /><h2 className="mt-4 text-xl font-black text-[#0B1028]">{ar ? 'دورة المتابعة غير مفعّلة' : 'Lifecycle controls are not enabled'}</h2><p className="mt-2 text-sm leading-7 text-slate-500">{ar ? 'رسائل دورة المتابعة غير متاحة لهذه المساحة بعد. يجب إكمال ربط المزود وتوثيق المرسل وتدقيق الموافقة قبل السماح بأي إرسال.' : 'Lifecycle messaging is not available for this workspace yet. Provider connection, sender verification, and audited consent must be completed before any delivery can be enabled.'}</p></section>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <form onSubmit={createDraft} className="nx-os-card p-5">
                <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-[#5E63FF]" /><h2 className="text-base font-black text-[#0B1028]">{ar ? 'مسودة دورة المتابعة' : 'Lifecycle draft'}</h2></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <select aria-label={ar ? 'عميل المسودة' : 'Draft lead'} required value={messageForm.leadId} onChange={event => setMessageForm(current => ({ ...current, leadId: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 sm:col-span-2"><option value="">{ar ? 'اختر العميل' : 'Choose lead'}</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.fullName || lead.email || lead.phone || lead.id} · {localizedLabel(CONSENT_LABELS, lead.consentStatus, ar)}</option>)}</select>
                  <select aria-label={ar ? 'قناة المسودة' : 'Draft channel'} value={messageForm.channel} onChange={event => setMessageForm(current => ({ ...current, channel: event.target.value as 'EMAIL' | 'SMS', subject: event.target.value === 'SMS' ? '' : current.subject }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="EMAIL">{channelLabel('EMAIL', ar)}</option><option value="SMS">{channelLabel('SMS', ar)}</option></select>
                  <select aria-label={ar ? 'غرض المسودة' : 'Draft purpose'} value={messageForm.purpose} onChange={event => setMessageForm(current => ({ ...current, purpose: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="FOLLOW_UP">{localizedLabel(PURPOSE_LABELS, 'FOLLOW_UP', ar)}</option><option value="NURTURE">{localizedLabel(PURPOSE_LABELS, 'NURTURE', ar)}</option><option value="WIN_BACK">{localizedLabel(PURPOSE_LABELS, 'WIN_BACK', ar)}</option><option value="DOUBLE_OPT_IN">{localizedLabel(PURPOSE_LABELS, 'DOUBLE_OPT_IN', ar)}</option></select>
                  {messageForm.channel === 'EMAIL' ? <input aria-label={ar ? 'عنوان الإيميل' : 'Email subject'} required value={messageForm.subject} onChange={event => setMessageForm(current => ({ ...current, subject: event.target.value }))} placeholder={ar ? 'عنوان الإيميل' : 'Email subject'} maxLength={200} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 sm:col-span-2" /> : null}
                  <textarea aria-label={ar ? 'نص الرسالة' : 'Message copy'} required value={messageForm.body} onChange={event => setMessageForm(current => ({ ...current, body: event.target.value }))} placeholder={ar ? 'النص؛ لا يتم إرساله من هذه الشاشة' : 'Copy; this screen cannot send it'} maxLength={messageForm.channel === 'SMS' ? 1600 : 10000} className="min-h-36 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-400 sm:col-span-2" />
                  <button disabled={saving || leads.length === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-4 text-xs font-black text-white disabled:opacity-50 sm:col-span-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}{ar ? 'حفظ المسودة — بدون إرسال' : 'Save draft — no send'}</button>
                </div>
              </form>

              <form onSubmit={suppressContact} className="nx-os-card p-5">
                <div className="flex items-center gap-2"><Ban className="h-5 w-5 text-rose-600" /><h2 className="text-base font-black text-[#0B1028]">{ar ? 'منع التواصل' : 'Suppress contact'}</h2></div>
                <p className="mt-2 text-xs leading-6 text-slate-500">{ar ? 'يُخزّن بصمة مشفّرة فقط لجهة الاتصال. يظل المنع قائمًا حتى لو حُذف سجل العميل.' : 'Stores only a keyed HMAC of the destination. Suppression survives lead deletion.'}</p>
                <div className="mt-4 grid gap-3">
                  <select aria-label={ar ? 'عميل المنع' : 'Suppression lead'} required value={suppressionForm.leadId} onChange={event => setSuppressionForm(current => ({ ...current, leadId: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="">{ar ? 'اختر العميل' : 'Choose lead'}</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.fullName || lead.email || lead.phone || lead.id}</option>)}</select>
                  <select aria-label={ar ? 'قناة المنع' : 'Suppression channel'} value={suppressionForm.channel} onChange={event => setSuppressionForm(current => ({ ...current, channel: event.target.value as 'EMAIL' | 'SMS' }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="EMAIL">{channelLabel('EMAIL', ar)}</option><option value="SMS">{channelLabel('SMS', ar)}</option></select>
                  <textarea aria-label={ar ? 'سبب المنع' : 'Suppression reason'} required value={suppressionForm.reason} onChange={event => setSuppressionForm(current => ({ ...current, reason: event.target.value }))} placeholder={ar ? 'سبب المنع المطلوب للتدقيق' : 'Required audit reason'} maxLength={500} className="min-h-24 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-rose-300" />
                  <button disabled={saving || leads.length === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-black text-white disabled:opacity-50"><Ban className="h-4 w-4" />{ar ? 'تسجيل المنع' : 'Record suppression'}</button>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-black text-slate-600">{ar ? `عمليات منع نشطة: ${suppressions.length}` : `Active suppressions: ${suppressions.length}`}</p><div className="mt-2 max-h-40 space-y-2 overflow-auto">{suppressions.map(item => <div key={item.id} className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-800"><strong>{channelLabel(item.channel, ar)}</strong> · {item.lead?.fullName || item.lead?.email || item.lead?.phone || (ar ? 'سجل محذوف' : 'Deleted lead')} · {item.reason}</div>)}</div></div>
              </form>
            </div>

            <section className="mt-4 nx-os-card p-5">
              <h2 className="text-base font-black text-[#0B1028]">{ar ? 'المسودات والاعتمادات' : 'Drafts and approvals'}</h2>
              <div className="mt-4 space-y-3">{messages.length === 0 ? <p className="rounded-xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">{ar ? 'لا توجد مسودات بعد.' : 'No lifecycle drafts yet.'}</p> : messages.map(message => (
                <article key={message.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${message.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{messageStatusLabel(message.status, ar)}</span><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{ar ? 'التسليم مقفل' : 'Delivery blocked'}</span><span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">{channelLabel(message.channel, ar)}</span></div><p className="mt-3 text-sm font-black text-[#0B1028]">{message.lead.fullName || message.lead.email || message.lead.phone || (ar ? 'عميل بدون اسم' : 'Unnamed lead')} · {localizedLabel(PURPOSE_LABELS, message.purpose, ar)}</p>{message.subject ? <p className="mt-2 text-xs font-bold text-slate-600">{message.subject}</p> : null}<p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-6 text-slate-500">{message.body}</p><div className="mt-3 flex flex-wrap gap-2">{(message.delivery?.blockers || ['PROVIDER_NOT_CONNECTED']).map(blocker => <span key={blocker} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{localizedLabel(DELIVERY_BLOCKER_LABELS, blocker, ar)}</span>)}</div></div>
                    {message.status === 'DRAFT' ? <button type="button" disabled={busyId === message.id} onClick={() => void approveCopy(message)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50">{busyId === message.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{ar ? 'اعتماد النص فقط' : 'Approve copy only'}</button> : <div className="flex shrink-0 items-center gap-2 text-xs font-black text-emerald-700">{message.channel === 'EMAIL' ? <MailCheck className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}{ar ? 'معتمد، غير مُرسل' : 'Approved, not sent'}</div>}
                  </div>
                </article>
              ))}</div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  )
}
