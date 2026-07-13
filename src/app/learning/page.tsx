'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
  trigger: string | null
  traceability: 'analytics_evidence' | 'campaign_record' | 'external_sources' | 'source_not_attached' | 'internal_signal'
  sourceRefs: Array<{
    url: string
    title?: string
    publisher?: string
    publishedAt?: string
  }>
  canAccept: boolean
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
    untraceableExternalSignals: number
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
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'التعلّم' : 'Learning'}
            pageSubtitle={ar ? 'ذاكرة موثقة من إشارات المراجعة ونتائج الأداء الحقيقية.' : 'A traceable memory of reviewed signals and real performance results.'}
            primaryHref="/approvals"
            primaryLabel={ar ? 'مراجعة الإشارات' : 'Review signals'}
            secondaryHref="/analytics"
            secondaryLabel={ar ? 'فتح التحليلات' : 'Open analytics'}
          />

          <section className="nx-os-action-strip mb-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-violet-50 text-violet-600">
                <BookOpen className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black">{stage.label}</p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-[#687590]">{stage.helper}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${stage.tone}`}>
                  {loading ? '—' : `${overview?.counts.pendingReview ?? 0} ${ar ? 'بانتظار المراجعة' : 'pending review'}`}
                </span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">
                  {loading ? '—' : `${overview?.counts.performanceEvidenceRows ?? 0} ${ar ? 'أدلة أداء' : 'performance rows'}`}
                </span>
              </div>
          </section>

          {error ? (
            <section className="nx-os-card border-rose-100 p-8 text-center">
              <p className="text-[15px] font-black text-[#071236]">{ar ? 'تعذر قراءة ذاكرة التعلم الآن.' : 'Learning memory could not be read.'}</p>
              <button type="button" onClick={load} className="mt-4 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#071236] px-5 text-[12px] font-black text-white">
                <RefreshCw className="h-4 w-4" />
                {ar ? 'إعادة المحاولة' : 'Try again'}
              </button>
            </section>
          ) : (
            <>
              <section>
                <div className="space-y-5">
                  <div className="nx-os-card p-5">
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

                    {(overview?.counts.untraceableExternalSignals ?? 0) > 0 ? (
                      <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-amber-200 bg-amber-50 p-4">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                          <p className="text-[12px] font-black text-amber-900">
                            {ar ? 'إشارات خارجية محجوبة لغياب المصدر' : 'External signals withheld because their sources are missing'}
                          </p>
                          <p className="mt-1 text-[10px] font-bold leading-5 text-amber-700">
                            {ar
                              ? 'لن نعرض الادعاء كحقيقة ولن نسمح بتطبيقه على Brand Brain حتى يُرفق رابط المصدر.'
                              : 'The claim is not shown as fact and cannot be applied to Brand Brain until a source URL is attached.'}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5 divide-y divide-[#edf1f7]">
                      {loading ? [1, 2, 3, 4].map(item => <div key={item} className="my-3 h-16 animate-pulse rounded-[15px] bg-[#f0f3f8]" />) : overview?.recentSignals.length ? overview.recentSignals.map(signal => (
                        <div key={signal.id} className="grid gap-3 py-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${signal.traceability === 'source_not_attached' ? 'bg-amber-50 text-amber-600' : signal.source === 'analytics' ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
                            {signal.traceability === 'source_not_attached' ? <AlertTriangle className="h-5 w-5" /> : signal.source === 'analytics' ? <BarChart3 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13px] font-black text-[#111b3f]">{fieldLabel(signal, ar)}</p>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-black ${signal.traceability === 'source_not_attached' ? 'bg-amber-50 text-amber-700' : signal.source === 'analytics' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>
                                {signal.traceability === 'source_not_attached'
                                  ? (ar ? 'المصدر غير مرفق' : 'Source not attached')
                                  : signal.source === 'analytics'
                                    ? (ar ? 'مدعوم بتحليلات' : 'Analytics-backed')
                                    : signal.traceability === 'external_sources'
                                      ? (ar ? 'مصادر خارجية مرفقة' : 'External sources attached')
                                      : (ar ? 'إشارة مراجعة' : 'Review signal')}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                                {signal.status === 'pending' ? (ar ? 'مقترح' : 'Suggested') : signal.status === 'accepted' ? (ar ? 'مطبق' : 'Applied') : (ar ? 'مرفوض' : 'Dismissed')}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-[#77839d]">
                              {signal.traceability === 'source_not_attached'
                                ? (ar ? 'تم حجب الادعاء الخارجي لأنه غير قابل للتتبع. يمكن رفض الإشارة، ولا يمكن تطبيقها.' : 'The external claim is withheld because it is not traceable. It may be dismissed but cannot be applied.')
                                : signal.reason || (ar ? 'لا يوجد تفسير محفوظ لهذه الإشارة.' : 'No rationale was saved for this signal.')}
                            </p>
                            {signal.sourceRefs.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {signal.sourceRefs.slice(0, 3).map((source, index) => (
                                  <a
                                    key={`${source.url}-${index}`}
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-[#dbe2f0] bg-white px-2 py-1 text-[9px] font-black text-[#5366f6]"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {source.publisher || source.title || (ar ? `المصدر ${index + 1}` : `Source ${index + 1}`)}
                                  </a>
                                ))}
                              </div>
                            ) : null}
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
                    <div className="nx-os-card p-5">
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

                    <div className="nx-os-card p-5">
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
              </section>
            </>
          )}
        </div>
      </main>
    </AppShell>
  )
}
