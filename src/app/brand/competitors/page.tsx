'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

interface CompetitorSource {
  id: string
  type: string
  url: string
  enabled: boolean
  cadenceHours: number
  nextScanAt?: string | null
  lastCheckedAt?: string | null
  lastSuccessAt?: string | null
  lastStatusCode?: number | null
  robotsAllowed?: boolean | null
  lastError?: string | null
  _count?: { snapshots: number; signals: number }
}

interface Competitor {
  id: string
  name: string
  domain: string
  websiteUrl: string
  status: 'ACTIVE' | 'PAUSED'
  baselineStatus: 'NOT_STARTED' | 'RUNNING' | 'READY' | 'FAILED'
  baselineAt?: string | null
  lastScanAt?: string | null
  nextScanAt?: string | null
  lastError?: string | null
  contextReviewRequired: boolean
  contextInvalidatedAt?: string | null
  contextReviewedAt?: string | null
  sources: CompetitorSource[]
  _count?: { signals: number }
}

interface CompetitorSignal {
  id: string
  type: string
  title: string
  summary: string
  beforeText?: string | null
  afterText?: string | null
  confidence: number
  importance: number
  status: 'NEW' | 'REVIEWED' | 'DISMISSED' | 'PROPOSED'
  proposalId?: string | null
  reviewedBy?: string | null
  createdAt: string
  competitor: { name: string; domain: string }
  source: { url: string; type: string }
}

interface CompetitorResponse {
  competitors?: Competitor[]
  signals?: CompetitorSignal[]
  policy?: { maxActiveCompetitors?: number }
  error?: string
}

function dateLabel(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export default function CompetitorCenterPage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const copy = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [signals, setSignals] = useState<CompetitorSignal[]>([])
  const [maxCompetitors, setMaxCompetitors] = useState(5)
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/competitors', {
        headers: { Authorization: token },
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({})) as CompetitorResponse
      if (!response.ok) throw new Error(data.error || copy('تعذر تحميل المنافسين.', 'Could not load competitors.'))
      setCompetitors(Array.isArray(data.competitors) ? data.competitors : [])
      setSignals(Array.isArray(data.signals) ? data.signals : [])
      setMaxCompetitors(data.policy?.maxActiveCompetitors ?? 5)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy('تعذر تحميل المنافسين.', 'Could not load competitors.'))
    } finally {
      setLoading(false)
    }
  }, [authHeader, copy])

  useEffect(() => {
    if (isAuthenticated) void load()
  }, [isAuthenticated, load])

  async function submitCompetitor(event: FormEvent) {
    event.preventDefault()
    const token = authHeader()
    if (!token || busy) return
    setBusy('create')
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/competitors', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, websiteUrl }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error || copy('تعذر إضافة المنافس.', 'Could not add competitor.'))
      setName('')
      setWebsiteUrl('')
      setNotice(ar
        ? (data.message === 'Baseline captured. No alert is created until a later source change is observed.'
            ? 'تم حفظ خط الأساس. لن يظهر تنبيه قبل رصد تغيير لاحق.'
            : data.message || 'تم حفظ المنافس.')
        : data.message || 'Competitor saved.')
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy('تعذر إضافة المنافس.', 'Could not add competitor.'))
    } finally {
      setBusy(null)
    }
  }

  async function scanCompetitor(competitorId: string) {
    const token = authHeader()
    if (!token || busy) return
    setBusy(`scan:${competitorId}`)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/competitors/${competitorId}/scan`, {
        method: 'POST',
        headers: { Authorization: token },
      })
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error || data.message || copy('فشل الفحص.', 'Scan failed.'))
      setNotice(data.message || copy('اكتمل الفحص.', 'Scan completed.'))
      await load()
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : copy('فشل الفحص.', 'Scan failed.'))
    } finally {
      setBusy(null)
    }
  }

  async function toggleCompetitor(competitor: Competitor) {
    const token = authHeader()
    if (!token || busy) return
    setBusy(`status:${competitor.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/competitors/${competitor.id}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: competitor.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
          confirmCurrentBrandContext: competitor.status === 'PAUSED' && competitor.contextReviewRequired,
        }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error || copy('تعذر تحديث الحالة.', 'Could not update status.'))
      if (competitor.contextReviewRequired) {
        setNotice(copy(
          'تم تأكيد المنافس للبراند الحالي. سيُنشئ الفحص التالي Baseline جديدًا مستقلًا، مع الاحتفاظ بالتاريخ القديم كمرجع فقط.',
          'Competitor confirmed for the current brand. The next scan creates a separate baseline; old history remains reference-only.',
        ))
      }
      await load()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : copy('تعذر تحديث الحالة.', 'Could not update status.'))
    } finally {
      setBusy(null)
    }
  }

  async function actOnSignal(signalId: string, action: 'review' | 'dismiss' | 'propose') {
    const token = authHeader()
    if (!token || busy) return
    setBusy(`${action}:${signalId}`)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/competitor-signals/${signalId}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error || copy('تعذر حفظ القرار.', 'Could not save the decision.'))
      setNotice(action === 'propose'
        ? copy('تم إنشاء مقترح منفصل. لم يتغير Brand Brain بعد.', 'A separate proposal was created. Brand Brain has not changed.')
        : copy('تم حفظ قرار المراجعة.', 'Review decision saved.'))
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy('تعذر حفظ القرار.', 'Could not save the decision.'))
    } finally {
      setBusy(null)
    }
  }

  const newSignals = useMemo(() => signals.filter(signal => signal.status === 'NEW'), [signals])
  const currentCompetitors = competitors.filter(competitor => !competitor.contextReviewRequired)
  const activeCount = currentCompetitors.filter(competitor => competitor.status === 'ACTIVE').length
  const readyCount = currentCompetitors.filter(competitor => competitor.baselineStatus === 'READY').length
  const reviewCount = competitors.filter(competitor => competitor.contextReviewRequired).length

  if (authLoading || (loading && competitors.length === 0)) {
    return (
      <AppShell>
        <main className="nx-os-page" dir={dir}>
          <div className="nx-os-container">
            <LuxuryWorkspaceHeader journeyStage="brand" pageTitle={copy('مركز المنافسين', 'Competitor Center')} primaryHref={null} secondaryHref="/brand" secondaryLabel="Brand Brain" />
            <div className="nx-os-card flex items-center justify-center gap-3 p-10 text-sm font-bold text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
              {copy('جارٍ تحميل الأدلة...', 'Loading evidence...')}
            </div>
          </div>
        </main>
      </AppShell>
    )
  }
  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main className="nx-os-page" dir={dir}>
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            journeyStage="brand"
            pageTitle={copy('مركز مراقبة المنافسين', 'Competitor Monitoring Center')}
            pageSubtitle={copy(
              'راقب تغييرات المواقع العامة التي تؤكد أنها رسمية بأدلة قبل/بعد، ثم قرر إن كانت تستحق مقترحًا منفصلًا لـBrand Brain.',
              'Monitor changes on public websites you identify as official, with before/after evidence, then decide whether they deserve a separate Brand Brain proposal.',
            )}
            primaryHref={newSignals.length > 0 ? '#signals' : null}
            primaryLabel={copy('راجع الإشارات الجديدة', 'Review new signals')}
            secondaryHref="/brand"
            secondaryLabel="Brand Brain"
          />

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: copy('مراقبة فعالة للبراند الحالي', 'Active for current brand'), value: `${activeCount}/${maxCompetitors}`, icon: Eye },
              { label: copy('خطوط أساس حالية جاهزة', 'Current baselines ready'), value: readyCount, icon: ShieldCheck },
              { label: copy('تحتاج تأكيد البراند', 'Need brand confirmation'), value: reviewCount, icon: AlertTriangle },
              { label: copy('إشارات جديدة للمراجعة', 'New signals to review'), value: newSignals.length, icon: ScanSearch },
            ].map(item => (
              <div key={item.label} className="nx-os-card flex items-center justify-between p-5">
                <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black text-[#071236]">{item.value}</p></div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600"><item.icon className="h-5 w-5" /></span>
              </div>
            ))}
          </section>

          {reviewCount > 0 ? (
            <section role="status" className="rounded-[20px] border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="text-[12px] font-black text-amber-950">
                    {copy('تغيّرت هوية Brand Brain — المراقبة القديمة متوقفة بأمان', 'Brand Brain identity changed — old monitoring is safely paused')}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold leading-5 text-amber-800">
                    {copy(
                      'راجع كل منافس ثم أكّده فقط إذا كان يخص البراند الحالي. لن تُستخدم Snapshots أو إشارات البراند السابق في Baseline الجديد.',
                      'Review each competitor and confirm it only if it belongs to the current brand. Previous-brand snapshots and signals will not enter the new baseline.',
                    )}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[20px] border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-[12px] font-black text-amber-950">{copy('حدود الإثبات', 'Evidence boundary')}</p>
                <p className="mt-1 text-[10px] font-semibold leading-5 text-amber-800">
                  {copy(
                    'يراقب NEXUS صفحات الويب العامة التي تؤكد أنها رسمية، مرة كل 24 ساعة افتراضياً، بدون خصم كريديت لأن الفحص لا يستخدم AI. لا يثبت ملكية الموقع بنفسه، ولا يراقب أداء الإعلانات أو حسابات السوشيال المغلقة، ولا يستنتج مبيعات أو نتائج، ولا يغيّر Brand Brain دون قرارين منفصلين: إنشاء مقترح ثم قبوله.',
                    'NEXUS monitors public web pages you identify as official, once every 24 hours by default, with zero credit charge because scanning uses no AI. It does not independently prove site ownership, monitor ad performance or closed social accounts, infer sales or results, or change Brand Brain without two separate decisions: create a proposal, then accept it.',
                  )}
                </p>
              </div>
            </div>
          </section>

          {error ? (
            <div role="alert" className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-bold text-rose-800">{error}</div>
          ) : null}
          {notice ? (
            <div role="status" className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-bold text-emerald-800">{notice}</div>
          ) : null}

          <section className="nx-os-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-black text-[#071236]">{copy('أضف موقعًا عامًا تؤكد أنه رسمي', 'Add a public website you confirm is official')}</h2>
                <p className="mt-1 text-[10px] font-semibold leading-5 text-slate-500">{copy('الفحص الأول يصنع Baseline فقط ولا ينشئ تنبيهًا.', 'The first successful scan creates a baseline only and does not create an alert.')}</p>
              </div>
              <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[10px] font-black text-slate-600 disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{copy('تحديث', 'Refresh')}
              </button>
            </div>
            <form onSubmit={submitCompetitor} className="mt-5 grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
              <label className="grid gap-1.5 text-[10px] font-black text-slate-600">
                {copy('اسم المنافس', 'Competitor name')}
                <input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={120} className="h-11 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-violet-400" placeholder={copy('الاسم الحقيقي', 'Real business name')} />
              </label>
              <label className="grid gap-1.5 text-[10px] font-black text-slate-600">
                {copy('الموقع العام الذي تؤكد أنه رسمي', 'Public website you confirm is official')}
                <input value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} required inputMode="url" className="h-11 rounded-xl border border-slate-200 px-3 text-left text-[12px] font-semibold outline-none focus:border-violet-400" placeholder="https://example.com" dir="ltr" />
              </label>
              <button type="submit" disabled={busy === 'create' || activeCount >= maxCompetitors} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#071236] px-5 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {copy('أكّد وأنشئ Baseline', 'Confirm & capture baseline')}
              </button>
            </form>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {competitors.length === 0 ? (
              <div className="nx-os-card col-span-full p-10 text-center">
                <EyeOff className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-black text-[#071236]">{copy('لا توجد مراقبة مفعلة', 'No monitoring is active')}</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">{copy('أضف الموقع العام الذي تؤكد أنه رسمي لبدء خط أساس قابل للمراجعة.', 'Add the public website you confirm is official to create a reviewable baseline.')}</p>
              </div>
            ) : competitors.map(competitor => {
              const source = competitor.sources[0]
              const scanBusy = busy === `scan:${competitor.id}`
              const statusBusy = busy === `status:${competitor.id}`
              return (
                <article key={competitor.id} className="nx-os-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[15px] font-black text-[#071236]">{competitor.name}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-[8px] font-black ${competitor.contextReviewRequired ? 'border-amber-300 bg-amber-50 text-amber-800' : competitor.baselineStatus === 'READY' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : competitor.baselineStatus === 'FAILED' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                          {competitor.contextReviewRequired
                            ? copy('قديم — يحتاج تأكيد البراند', 'Stale — confirm brand')
                            : competitor.baselineStatus === 'READY'
                              ? copy('Baseline جاهز', 'Baseline ready')
                              : competitor.baselineStatus === 'FAILED'
                                ? copy('Baseline فشل', 'Baseline failed')
                                : copy('Baseline قيد التجهيز', 'Baseline pending')}
                        </span>
                      </div>
                      <a href={competitor.websiteUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:underline" dir="ltr">{competitor.domain}<ExternalLink className="h-3 w-3" /></a>
                    </div>
                    {!competitor.contextReviewRequired ? (
                      <button type="button" onClick={() => void toggleCompetitor(competitor)} disabled={statusBusy} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-50" title={competitor.status === 'ACTIVE' ? copy('إيقاف', 'Pause') : copy('استئناف', 'Resume')} aria-label={competitor.status === 'ACTIVE' ? copy('إيقاف مراقبة المنافس', 'Pause competitor monitoring') : copy('استئناف مراقبة المنافس', 'Resume competitor monitoring')}>
                        {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : competitor.status === 'ACTIVE' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-[9px]">
                    <div><dt className="font-black text-slate-500">{copy('آخر فحص', 'Last check')}</dt><dd className="mt-1 font-bold text-slate-800">{dateLabel(competitor.lastScanAt, locale)}</dd></div>
                    <div><dt className="font-black text-slate-500">{copy('الفحص التالي', 'Next due')}</dt><dd className="mt-1 font-bold text-slate-800">{competitor.contextReviewRequired ? copy('محجوب حتى التأكيد', 'Blocked pending confirmation') : competitor.status === 'PAUSED' ? copy('متوقف', 'Paused') : dateLabel(source?.nextScanAt || competitor.nextScanAt, locale)}</dd></div>
                    <div><dt className="font-black text-slate-500">{copy('Snapshots', 'Snapshots')}</dt><dd className="mt-1 font-bold text-slate-800">{source?._count?.snapshots ?? 0}</dd></div>
                    <div><dt className="font-black text-slate-500">{copy('إشارات التغيير', 'Change signals')}</dt><dd className="mt-1 font-bold text-slate-800">{competitor._count?.signals ?? 0}</dd></div>
                  </dl>
                  {source?.lastError || competitor.lastError ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[9px] font-semibold leading-4 text-rose-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{source?.lastError || competitor.lastError}
                    </div>
                  ) : null}
                  {competitor.contextReviewRequired ? (
                    <button type="button" onClick={() => void toggleCompetitor(competitor)} disabled={statusBusy} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-[10px] font-black text-amber-800 disabled:opacity-50">
                      {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {copy('أؤكد أن هذا منافس للبراند الحالي', 'Confirm as a competitor for the current brand')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => void scanCompetitor(competitor.id)} disabled={scanBusy || competitor.status !== 'ACTIVE'} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 text-[10px] font-black text-violet-700 disabled:opacity-50">
                      {scanBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                      {competitor.baselineStatus === 'READY' ? copy('افحص الآن', 'Scan now') : copy('أعد محاولة Baseline', 'Retry baseline')}
                    </button>
                  )}
                </article>
              )
            })}
          </section>

          <section id="signals" className="nx-os-card scroll-mt-24 p-5">
            <div>
              <h2 className="text-[17px] font-black text-[#071236]">{copy('صندوق إشارات المنافسين', 'Competitor signal inbox')}</h2>
              <p className="mt-1 text-[10px] font-semibold leading-5 text-slate-500">{copy('كل إشارة تربط المصدر وما تغيّر. “اقتراح لـBrand Brain” لا يطبّق التغيير؛ القبول يتم لاحقًا من الموافقات.', 'Every signal links its source and what changed. “Propose to Brand Brain” does not apply it; acceptance happens later in Approvals.')}</p>
            </div>
            <div className="mt-5 space-y-3">
              {signals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500" />
                  <p className="mt-2 text-[11px] font-black text-slate-700">{copy('لا توجد تغييرات موثقة بعد', 'No verified changes yet')}</p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-500">{copy('هذا طبيعي بعد إنشاء Baseline؛ النظام لا يختلق تنبيهات.', 'This is expected after a baseline; the system does not invent alerts.')}</p>
                </div>
              ) : signals.map(signal => {
                const expanded = expandedSignal === signal.id
                const actionBusy = Boolean(busy?.endsWith(`:${signal.id}`))
                const previousBrandSignal = signal.status === 'DISMISSED'
                  && signal.reviewedBy?.startsWith('SYSTEM:BRAND_CONTEXT')
                return (
                  <article key={signal.id} className={`rounded-2xl border p-4 ${signal.status === 'NEW' ? 'border-violet-200 bg-violet-50/30' : previousBrandSignal ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black text-violet-700 shadow-sm">{signal.type.replace(/_/g, ' ')}</span>
                          <span className="text-[8px] font-black text-slate-500">{signal.confidence}% {copy('ثقة في رصد التغيير', 'change-detection confidence')}</span>
                          {previousBrandSignal ? (
                            <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[8px] font-black text-amber-800">
                              {copy('مؤرشف من Brand Brain سابق', 'Archived from a previous Brand Brain')}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 text-[12px] font-black text-[#071236]">{signal.title}</h3>
                        <p className="mt-1 text-[10px] font-semibold leading-5 text-slate-600">{signal.summary}</p>
                        <a href={signal.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-violet-600 hover:underline">{copy('فتح المصدر العام', 'Open public source')}<ExternalLink className="h-3 w-3" /></a>
                      </div>
                      <div className="flex items-center gap-2 text-[8px] font-bold text-slate-500"><Clock3 className="h-3.5 w-3.5" />{dateLabel(signal.createdAt, locale)}</div>
                    </div>
                    <button type="button" onClick={() => setExpandedSignal(expanded ? null : signal.id)} className="mt-3 text-[9px] font-black text-slate-600 underline underline-offset-4">
                      {expanded ? copy('إخفاء دليل قبل/بعد', 'Hide before/after evidence') : copy('عرض دليل قبل/بعد', 'Show before/after evidence')}
                    </button>
                    {expanded ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[8px] font-black uppercase text-slate-500">{copy('قبل', 'Before')}</p><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[9px] font-semibold leading-4 text-slate-700">{signal.beforeText || '—'}</pre></div>
                        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3"><p className="text-[8px] font-black uppercase text-violet-600">{copy('بعد', 'After')}</p><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[9px] font-semibold leading-4 text-slate-700">{signal.afterText || '—'}</pre></div>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {signal.status === 'NEW' ? (
                        <>
                          <button type="button" disabled={actionBusy} onClick={() => void actOnSignal(signal.id, 'review')} className="rounded-xl border border-slate-200 px-3 py-2 text-[9px] font-black text-slate-700 disabled:opacity-50">{copy('تمت المراجعة فقط', 'Mark reviewed only')}</button>
                          <button type="button" disabled={actionBusy} onClick={() => void actOnSignal(signal.id, 'dismiss')} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[9px] font-black text-rose-700 disabled:opacity-50">{copy('رفض الإشارة', 'Dismiss signal')}</button>
                        </>
                      ) : null}
                      {signal.status !== 'DISMISSED' && signal.status !== 'PROPOSED' ? (
                        <button type="button" disabled={actionBusy} onClick={() => void actOnSignal(signal.id, 'propose')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#071236] px-3 py-2 text-[9px] font-black text-white disabled:opacity-50">
                          {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          {copy('أنشئ مقترحًا لـBrand Brain', 'Propose to Brand Brain')}
                        </button>
                      ) : null}
                      {signal.status === 'PROPOSED' ? (
                        <Link href="/approvals" className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-[9px] font-black text-white">{copy('راجع المقترح في الموافقات', 'Review proposal in Approvals')}<ArrowUpRight className="h-3.5 w-3.5" /></Link>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
