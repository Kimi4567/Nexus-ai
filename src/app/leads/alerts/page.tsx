'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { LeadsNav } from '@/components/leads/LeadsNav'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { AlertTriangle, BellRing, Clock3, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface SlaAlert {
  id: string
  type: 'FIRST_RESPONSE_OVERDUE' | 'FOLLOW_UP_OVERDUE'
  dueAt: string
  task?: { id: string; title: string; priority: string }
  lead: { id: string; fullName?: string | null; email?: string | null; phone?: string | null; stage: string }
  assignedTo?: { id: string; name?: string | null; email: string } | null
}
export default function LeadAlertsPage() {
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(true)
  const [alerts, setAlerts] = useState<SlaAlert[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setLoading(true)
    setNotice(null)
    try {
      const response = await fetch('/api/leads/alerts', { headers: { Authorization: token }, cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 503) setReady(false)
        throw new Error(data.error || 'Could not load SLA alerts.')
      }
      setReady(true)
      setAlerts(Array.isArray(data.alerts) ? data.alerts : [])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load SLA alerts.')
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (!authLoading && isAuthenticated) void load()
  }, [authLoading, isAuthenticated, load])

  const responseCount = alerts.filter(alert => alert.type === 'FIRST_RESPONSE_OVERDUE').length
  const followUpCount = alerts.length - responseCount

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page min-h-screen bg-[#F6F8FC] px-4 py-5 sm:px-6 lg:px-8">
        <LuxuryWorkspaceHeader
          pageTitle={ar ? 'تنبيهات الاستجابة والمتابعة' : 'Response & follow-up alerts'}
          pageSubtitle={ar ? 'قائمة تشغيل داخلية محسوبة من المواعيد الحقيقية، من غير رسائل أو مكالمات تلقائية.' : 'An internal action queue calculated from real deadlines, with no automated messages or calls.'}
          primaryHref={null}
          secondaryHref="/leads"
          secondaryLabel={ar ? 'المسار' : 'Pipeline'}
        />
        <LeadsNav />

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: ar ? 'إجمالي المتأخر' : 'Total overdue', value: alerts.length, tone: 'text-rose-700 bg-rose-50' },
            { label: ar ? 'أول استجابة' : 'First response', value: responseCount, tone: 'text-amber-700 bg-amber-50' },
            { label: ar ? 'متابعة' : 'Follow-up', value: followUpCount, tone: 'text-indigo-700 bg-indigo-50' },
          ].map(metric => <div key={metric.label} className="nx-os-card p-4"><p className="text-xs font-black text-slate-500">{metric.label}</p><p className={`mt-3 inline-flex rounded-xl px-3 py-1 text-2xl font-black ${metric.tone}`}>{metric.value}</p></div>)}
        </section>

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-6 text-indigo-900 sm:flex-row sm:items-center sm:justify-between">
          <p><strong>{ar ? 'حد التشغيل:' : 'Operating boundary:'}</strong> {ar ? 'التنبيه يوجّه الفريق فقط. outreachTriggered=false ولا يوجد إرسال خارجي.' : 'Alerts guide the team only. outreachTriggered=false and no external delivery occurs.'}</p>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3 font-black text-indigo-700 shadow-sm disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{ar ? 'تحديث' : 'Refresh'}</button>
        </div>

        {notice ? <div role="alert" className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{notice}</div> : null}
        {loading ? <div className="grid min-h-52 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#5E63FF]" /></div> : !ready ? (
          <section className="nx-os-card p-8 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#5E63FF]" /><h2 className="mt-4 text-lg font-black text-[#0B1028]">{ar ? 'CRM غير جاهز في هذه البيئة' : 'CRM is not ready in this environment'}</h2></section>
        ) : alerts.length === 0 ? (
          <section className="nx-os-card p-10 text-center"><BellRing className="mx-auto h-10 w-10 text-emerald-500" /><h2 className="mt-4 text-lg font-black text-[#0B1028]">{ar ? 'لا توجد مواعيد متأخرة الآن' : 'No overdue deadlines right now'}</h2><p className="mt-2 text-sm text-slate-500">{ar ? 'القائمة تعتمد على SLA ومهام المتابعة المسجلة، وليست نتيجة تقديرية.' : 'This queue is based on recorded SLA and follow-up deadlines, not estimated results.'}</p></section>
        ) : (
          <section className="space-y-3" aria-label={ar ? 'التنبيهات المتأخرة' : 'Overdue alerts'}>
            {alerts.map(alert => (
              <article key={alert.id} className="nx-os-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">{alert.type === 'FIRST_RESPONSE_OVERDUE' ? <AlertTriangle className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</div>
                  <div className="min-w-0"><p className="text-sm font-black text-[#0B1028]">{alert.type === 'FIRST_RESPONSE_OVERDUE' ? (ar ? 'تأخر أول رد' : 'First response overdue') : (alert.task?.title || (ar ? 'متابعة متأخرة' : 'Follow-up overdue'))}</p><p className="mt-1 truncate text-xs text-slate-500">{alert.lead.fullName || alert.lead.email || alert.lead.phone || (ar ? 'عميل بدون اسم' : 'Unnamed lead')} · {alert.lead.stage}</p><p className="mt-2 text-[11px] font-bold text-rose-600">{ar ? 'كان الموعد:' : 'Was due:'} {new Date(alert.dueAt).toLocaleString(locale)}</p></div>
                </div>
                <Link href={`/leads/${encodeURIComponent(alert.lead.id)}`} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#101A4D] px-4 text-xs font-black text-white">{ar ? 'افتح العميل واتخذ إجراء' : 'Open lead and act'}</Link>
              </article>
            ))}
          </section>
        )}
      </main>
    </AppShell>
  )
}
