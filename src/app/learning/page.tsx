'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'

interface LearningSignal {
  id: string
  status: string
  source: 'analytics' | 'review_signal'
  field: string
  displayName: string
  reason: string
  campaignId: string | null
  at: string | null
}

interface WorkflowSignal {
  id: string
  eventType: string
  actor: string
  campaignId: string | null
  socialPostId: string | null
  at: string | null
}

interface PerformanceSummary {
  hasEvidence: boolean
  organicEvidenceCount: number
  paidEvidenceCount: number
  totalEvidenceRows: number
  totals: {
    impressions: number
    reach: number
    engagements: number
    clicks: number
    conversions: number
    spend: number
    organicEngagementRate: number | null
    paidCtr: number | null
    paidRoas: number | null
  }
  channels: Array<{
    platform: string
    evidenceRows: number
    impressions: number
    engagements: number
    clicks: number
    conversions: number
    spend: number
  }>
  lastUpdatedAt: string | null
}

interface LearningOverview {
  stage: 'empty' | 'signals_building' | 'analytics_backed'
  counts: {
    pendingReview: number
    reviewedSignals: number
    dismissedSignals: number
    analyticsBackedLessons: number
    workflowSignals: number
    performanceEvidenceRows: number
  }
  recentSignals: LearningSignal[]
  recentWorkflowSignals: WorkflowSignal[]
  performance: PerformanceSummary
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${number.format(value / 1_000_000)}M`
  if (Math.abs(value) >= 1_000) return `${number.format(value / 1_000)}K`
  return number.format(value)
}

function formatDate(value: string | null, ar: boolean): string {
  if (!value) return ar ? 'الوقت غير متاح' : 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ar ? 'الوقت غير متاح' : 'Time unavailable'
  return new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function fieldLabel(signal: LearningSignal, ar: boolean): string {
  const labels: Record<string, [string, string]> = {
    winningHooks: ['إشارات الخطافات', 'Hook signals'],
    winningAngles: ['إشارات زوايا المحتوى', 'Content angle signals'],
    toneKeywords: ['نبرة العلامة', 'Brand tone'],
    audiencePainPoints: ['مشكلات الجمهور', 'Audience pain points'],
    audienceDesires: ['رغبات الجمهور', 'Audience desires'],
    uniqueAdvantages: ['المزايا الفريدة', 'Unique advantages'],
    strategicNotes: ['ملاحظات استراتيجية', 'Strategic notes'],
  }
  return labels[signal.field]?.[ar ? 0 : 1] || signal.displayName || (ar ? 'إشارة Brand Brain' : 'Brand Brain signal')
}

function workflowLabel(eventType: string, ar: boolean): string {
  const labels: Record<string, [string, string]> = {
    POST_APPROVED: ['تم اعتماد منشور', 'Post approved'],
    POST_SCHEDULED: ['تمت جدولة منشور', 'Post scheduled'],
    POST_MANUALLY_PUBLISHED: ['سجل المستخدم نشرًا يدويًا', 'User recorded a manual publish'],
    POST_UNSCHEDULED: ['تم إلغاء جدولة منشور', 'Post unscheduled'],
    POST_REVERTED_TO_DRAFT: ['أعيد منشور إلى المسودة', 'Post returned to draft'],
    POST_FAILED: ['فشلت محاولة نشر', 'Publish attempt failed'],
    POST_AUTO_PUBLISHED: ['نُشر منشور عبر تكامل موثّق', 'Post published through a verified integration'],
  }
  return labels[eventType]?.[ar ? 0 : 1] || (ar ? 'إشارة سير عمل محفوظة' : 'Saved workflow signal')
}

function SummaryCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  helper: string
  icon: typeof BookOpen
  tone: 'violet' | 'green' | 'blue' | 'amber' | 'slate'
}) {
  const tones = {
    violet: 'bg-violet-50 text-violet-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="rounded-[20px] border border-[#e3e8f3] bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.045)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-[#75819d]">{title}</p>
          <p className="mt-2 text-[27px] font-black text-[#071236]">{value}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-[11px] font-bold leading-5 text-[#8792aa]">{helper}</p>
    </div>
  )
}

export default function LearningPage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const [overview, setOverview] = useState<LearningOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/learning/overview', {
        headers: { Authorization: authHeader() },
      })
      if (!response.ok) throw new Error('Learning overview unavailable')
      setOverview(await response.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [authHeader, isAuthenticated])

  useEffect(() => {
    load()
  }, [load])

  const stage = useMemo(() => {
    if (overview?.stage === 'analytics_backed') {
      return {
        label: ar ? 'دروس مدعومة بالتحليلات' : 'Analytics-backed lessons',
        helper: ar ? 'توجد نتائج منصة حقيقية يمكن مراجعتها.' : 'Real platform results are available for review.',
        tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      }
    }
    if (overview?.stage === 'signals_building') {
      return {
        label: ar ? 'ذاكرة الإشارات قيد البناء' : 'Signal memory is building',
        helper: ar ? 'إشارات المراجعة وسير العمل محفوظة؛ تعلم الأداء ينتظر التحليلات.' : 'Review and workflow signals are saved; performance learning awaits analytics.',
        tone: 'bg-violet-50 text-violet-700 border-violet-100',
      }
    }
    return {
      label: ar ? 'لا توجد دروس مثبتة بعد' : 'No verified lessons yet',
      helper: ar ? 'ابدأ بسياق العلامة ثم نفّذ واجمع تحليلات حقيقية.' : 'Start with brand context, then execute and collect real analytics.',
      tone: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  }, [ar, overview?.stage])

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
          <Loader2 className="h-9 w-9 animate-spin text-[#5366f6]" />
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main dir={dir} className="min-h-screen bg-[#f6f8fc] text-[#071236]">
        <div className="mx-auto max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'التعلّم' : 'Learning'}
            pageSubtitle={ar ? 'ذاكرة موثقة من إشارات المراجعة ونتائج الأداء الحقيقية.' : 'A traceable memory of reviewed signals and real performance results.'}
            primaryHref="/approvals"
            primaryLabel={ar ? 'مراجعة الإشارات' : 'Review signals'}
            secondaryHref="/analytics"
            secondaryLabel={ar ? 'فتح التحليلات' : 'Open analytics'}
          />

          <section className="mb-5 overflow-hidden rounded-[26px] border border-[#dfe5f2] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.055)]">
            <div className="grid gap-5 bg-[radial-gradient(circle_at_88%_30%,rgba(124,99,255,0.16),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8f7ff_100%)] p-5 md:grid-cols-[1fr_auto] md:items-center lg:p-7">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-violet-100 bg-white text-violet-600 shadow-[0_18px_45px_rgba(91,76,255,0.14)]">
                  <BookOpen className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-[11px] font-black text-[#6d66dc]">{ar ? 'ذاكرة قابلة للتدقيق' : 'Auditable memory'}</p>
                  <h1 className="mt-1 text-[28px] font-black text-[#071236] sm:text-[34px]">
                    {ar ? 'نتعلّم فقط مما يمكن إثباته' : 'Learn only from what can be proven'}
                  </h1>
                  <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-7 text-[#687590]">
                    {ar
                      ? 'الموافقة والجدولة والاختيار إشارات سلوك للمراجعة. أنماط الأداء لا تصبح دروسًا إلا بعد وصول analyticsData أو مقاييس منصة موثوقة.'
                      : 'Approval, scheduling, and selection are reviewable behavior signals. Performance patterns become lessons only after analyticsData or trusted platform metrics arrive.'}
                  </p>
                </div>
              </div>
              <div className={`rounded-[18px] border px-4 py-3 ${stage.tone}`}>
                <p className="text-[12px] font-black">{stage.label}</p>
                <p className="mt-1 max-w-[310px] text-[11px] font-bold leading-5 opacity-80">{stage.helper}</p>
              </div>
            </div>
          </section>

          {error ? (
            <section className="rounded-[24px] border border-rose-100 bg-white p-8 text-center shadow-sm">
              <p className="text-[15px] font-black text-[#071236]">{ar ? 'تعذر قراءة ذاكرة التعلم الآن.' : 'Learning memory could not be read.'}</p>
              <button type="button" onClick={load} className="mt-4 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#071236] px-5 text-[12px] font-black text-white">
                <RefreshCw className="h-4 w-4" />
                {ar ? 'إعادة المحاولة' : 'Try again'}
              </button>
            </section>
          ) : (
            <>
              <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryCard title={ar ? 'بانتظار المراجعة' : 'Pending review'} value={loading ? '—' : String(overview?.counts.pendingReview ?? 0)} helper={ar ? 'لا يغيّر Brand Brain قبل قبولك' : 'Does not change Brand Brain before acceptance'} icon={Clock3} tone="amber" />
                <SummaryCard title={ar ? 'إشارات مراجَعة مطبقة' : 'Applied review signals'} value={loading ? '—' : String(overview?.counts.reviewedSignals ?? 0)} helper={ar ? 'تفضيلات وسياق، وليست نتائج أداء' : 'Preferences and context, not performance results'} icon={FileCheck2} tone="violet" />
                <SummaryCard title={ar ? 'إشارات سير العمل' : 'Workflow signals'} value={loading ? '—' : String(overview?.counts.workflowSignals ?? 0)} helper={ar ? 'اعتماد وجدولة ونشر موثق' : 'Approval, scheduling, and recorded publishing'} icon={GitBranch} tone="blue" />
                <SummaryCard title={ar ? 'صفوف أداء موثقة' : 'Verified performance rows'} value={loading ? '—' : String(overview?.counts.performanceEvidenceRows ?? 0)} helper={ar ? 'analyticsData أو مصدر منصة موثوق' : 'analyticsData or a trusted platform source'} icon={Database} tone="green" />
                <SummaryCard title={ar ? 'دروس أداء مطبقة' : 'Applied performance lessons'} value={loading ? '—' : String(overview?.counts.analyticsBackedLessons ?? 0)} helper={ar ? 'لا تُفتح إلا بدليل أداء حقيقي' : 'Unlocked only by real performance evidence'} icon={BrainCircuit} tone="slate" />
              </section>

              <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-[#e3e8f3] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-[18px] font-black">{ar ? 'آخر إشارات الذاكرة' : 'Recent memory signals'}</h2>
                        <p className="mt-1 text-[12px] font-bold text-[#7b87a3]">{ar ? 'المصدر والحالة وسبب الاقتراح ظاهرون دائمًا.' : 'Source, status, and rationale stay visible.'}</p>
                      </div>
                      <Link href="/approvals" className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-[#dbe2f0] px-4 text-[12px] font-black text-[#5366f6]">
                        {ar ? 'فتح مركز الموافقات' : 'Open approvals'}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>

                    <div className="mt-5 divide-y divide-[#edf1f7]">
                      {loading ? [1, 2, 3, 4].map(item => <div key={item} className="my-3 h-16 animate-pulse rounded-[15px] bg-[#f0f3f8]" />) : overview?.recentSignals.length ? overview.recentSignals.map(signal => (
                        <div key={signal.id} className="grid gap-3 py-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${signal.source === 'analytics' ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
                            {signal.source === 'analytics' ? <BarChart3 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13px] font-black text-[#111b3f]">{fieldLabel(signal, ar)}</p>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-black ${signal.source === 'analytics' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>
                                {signal.source === 'analytics' ? (ar ? 'مدعوم بتحليلات' : 'Analytics-backed') : (ar ? 'إشارة مراجعة' : 'Review signal')}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                                {signal.status === 'pending' ? (ar ? 'مقترح' : 'Suggested') : signal.status === 'accepted' ? (ar ? 'مطبق' : 'Applied') : (ar ? 'مرفوض' : 'Dismissed')}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-[#77839d]">{signal.reason || (ar ? 'لا يوجد تفسير محفوظ لهذه الإشارة.' : 'No rationale was saved for this signal.')}</p>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-[#96a0b4] md:block md:text-end">
                            <span>{formatDate(signal.at, ar)}</span>
                            {signal.campaignId ? <Link href={`/campaigns/${signal.campaignId}`} className="mt-1 block text-[#5366f6]">{ar ? 'الحملة' : 'Campaign'}</Link> : null}
                          </div>
                        </div>
                      )) : (
                        <div className="py-10 text-center">
                          <BrainCircuit className="mx-auto h-10 w-10 text-[#b1bbcf]" />
                          <p className="mt-3 text-[13px] font-black text-[#111b3f]">{ar ? 'لا توجد إشارات ذاكرة بعد' : 'No memory signals yet'}</p>
                          <p className="mx-auto mt-2 max-w-lg text-[11px] font-bold leading-5 text-[#8792aa]">{ar ? 'أكمل Brand Brain وراجع مخرجات حملتك. لا يُنشئ NEXUS دروسًا وهمية لملء الصفحة.' : 'Complete Brand Brain and review campaign outputs. NEXUS does not invent lessons to fill this page.'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-[24px] border border-[#e3e8f3] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[16px] font-black">{ar ? 'أحداث التشغيل المحفوظة' : 'Saved workflow events'}</h2>
                        <Activity className="h-5 w-5 text-[#5366f6]" />
                      </div>
                      <div className="mt-4 space-y-1">
                        {loading ? [1, 2, 3].map(item => <div key={item} className="h-14 animate-pulse rounded-[14px] bg-[#f0f3f8]" />) : overview?.recentWorkflowSignals.length ? overview.recentWorkflowSignals.slice(0, 5).map(event => (
                          <div key={event.id} className="flex items-center gap-3 border-b border-[#eef2f8] py-3 last:border-b-0">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#6f72ff] bg-white" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-black text-[#233052]">{workflowLabel(event.eventType, ar)}</p>
                              <p className="mt-1 text-[10px] font-bold text-[#8b95a9]">{formatDate(event.at, ar)} · {event.actor}</p>
                            </div>
                          </div>
                        )) : <p className="rounded-[16px] border border-dashed border-[#d9e0ed] p-5 text-center text-[11px] font-bold leading-5 text-[#8792aa]">{ar ? 'لم تُسجل أحداث تنفيذ بعد.' : 'No execution events have been recorded yet.'}</p>}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#e3e8f3] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[16px] font-black">{ar ? 'دليل الأداء' : 'Performance evidence'}</h2>
                        <ShieldCheck className="h-5 w-5 text-[#5366f6]" />
                      </div>
                      {loading ? <div className="mt-4 h-40 animate-pulse rounded-[18px] bg-[#f0f3f8]" /> : overview?.performance.hasEvidence ? (
                        <div className="mt-4">
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              [ar ? 'الظهور' : 'Impressions', formatNumber(overview.performance.totals.impressions)],
                              [ar ? 'التفاعل' : 'Engagements', formatNumber(overview.performance.totals.engagements)],
                              [ar ? 'النقرات' : 'Clicks', formatNumber(overview.performance.totals.clicks)],
                              [ar ? 'التحويلات' : 'Conversions', formatNumber(overview.performance.totals.conversions)],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-[15px] border border-[#e9edf5] bg-[#fbfcff] p-3">
                                <p className="text-[10px] font-bold text-[#8792aa]">{label}</p>
                                <p className="mt-1 text-[20px] font-black text-[#111b3f]">{value}</p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-4 text-[10px] font-bold leading-5 text-[#8792aa]">{ar ? `آخر دليل: ${formatDate(overview.performance.lastUpdatedAt, true)}` : `Latest evidence: ${formatDate(overview.performance.lastUpdatedAt, false)}`}</p>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[18px] border border-dashed border-[#cfd8ea] bg-[#fbfcff] p-5 text-center">
                          <Database className="mx-auto h-8 w-8 text-[#a8b3c9]" />
                          <p className="mt-3 text-[12px] font-black text-[#233052]">{ar ? 'بانتظار تحليلات حقيقية' : 'Waiting for real analytics'}</p>
                          <p className="mt-2 text-[10px] font-bold leading-5 text-[#8792aa]">{ar ? 'النشر اليدوي أو الاعتماد وحدهما لا يثبتان الأداء.' : 'Manual publishing or approval alone does not prove performance.'}</p>
                        </div>
                      )}
                      <Link href="/analytics" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[13px] border border-[#dbe2f0] py-2.5 text-[11px] font-black text-[#5366f6]">
                        {ar ? 'عرض مصدر القياس' : 'View measurement source'}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>

                <aside className="space-y-5">
                  <div className="rounded-[24px] border border-[#e3e8f3] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[16px] font-black">{ar ? 'قواعد الثقة' : 'Trust rules'}</h2>
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="mt-4 divide-y divide-[#edf1f7]">
                      {[
                        ar ? 'الموافقة تحفظ تفضيلًا، لا فائزًا.' : 'Approval saves a preference, not a winner.',
                        ar ? 'الجدولة إشارة تشغيل، لا نتيجة.' : 'Scheduling is an execution signal, not a result.',
                        ar ? 'النشر اليدوي سجل مستخدم، لا إثبات منصة.' : 'Manual publish is a user record, not platform proof.',
                        ar ? 'التعلم من الأداء يحتاج تحليلات موثقة.' : 'Performance learning requires verified analytics.',
                      ].map(rule => (
                        <div key={rule} className="flex items-start gap-3 py-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <p className="text-[11px] font-bold leading-5 text-[#687590]">{rule}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#e3e8f3] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[16px] font-black">{ar ? 'الخطوة التالية الموثوقة' : 'Next trusted step'}</h2>
                      <Target className="h-5 w-5 text-[#5366f6]" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {(overview?.counts.pendingReview ?? 0) > 0 ? (
                        <Link href="/approvals" className="block rounded-[17px] border border-violet-100 bg-violet-50 p-4">
                          <p className="text-[12px] font-black text-violet-800">{ar ? 'راجع الإشارات المعلّقة' : 'Review pending signals'}</p>
                          <p className="mt-1 text-[10px] font-bold leading-5 text-violet-600">{ar ? 'لن يحدّث شيء Brand Brain دون قرارك.' : 'Nothing updates Brand Brain without your decision.'}</p>
                        </Link>
                      ) : null}
                      {!overview?.performance.hasEvidence ? (
                        <Link href="/connections" className="block rounded-[17px] border border-sky-100 bg-sky-50 p-4">
                          <p className="text-[12px] font-black text-sky-800">{ar ? 'اربط مصدر قياس' : 'Connect a measurement source'}</p>
                          <p className="mt-1 text-[10px] font-bold leading-5 text-sky-600">{ar ? 'بدون بيانات منصة لا توجد قرارات تحسين موثوقة.' : 'Without platform data there are no trustworthy optimization decisions.'}</p>
                        </Link>
                      ) : (
                        <Link href="/analytics" className="block rounded-[17px] border border-emerald-100 bg-emerald-50 p-4">
                          <p className="text-[12px] font-black text-emerald-800">{ar ? 'راجع النتائج قبل التطبيق' : 'Review results before applying'}</p>
                          <p className="mt-1 text-[10px] font-bold leading-5 text-emerald-600">{ar ? 'افصل الإشارة عن المصادفة ثم اعتمد التحسين.' : 'Separate signal from coincidence before approving an optimization.'}</p>
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#e3e8f3] bg-[#071236] p-5 text-white shadow-[0_22px_55px_rgba(7,18,54,0.22)]">
                    <Sparkles className="h-6 w-6 text-[#a7b3ff]" />
                    <h2 className="mt-4 text-[17px] font-black">Brand Brain</h2>
                    <p className="mt-2 text-[11px] font-bold leading-6 text-slate-300">{ar ? 'ذاكرة العلامة تحتفظ بالسياق والإشارات التي راجعتها؛ نتائج الأداء لا تدخلها إلا من مسار موثّق.' : 'Brand memory stores context and reviewed signals; performance results enter only through a verified path.'}</p>
                    <Link href="/brand" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[13px] bg-white text-[11px] font-black text-[#071236]">
                      {ar ? 'فتح Brand Brain' : 'Open Brand Brain'}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </aside>
              </section>
            </>
          )}
        </div>
      </main>
    </AppShell>
  )
}
