'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabaseClient'

interface ExecutionAction {
  code: string
  labelAr: string
  labelEn: string
  href: string
}

interface ExecutionOverview {
  campaign: {
    id: string
    name: string
    description: string | null
    goal: string
    status: string
    platforms: string[]
    scope: 'organic' | 'paid' | 'full'
    approvalState: string
    strategySnapshot: { id: string; version: number; scope: string; createdAt: string } | null
  }
  organic: {
    inScope: boolean
    total: number
    counts: Record<string, number>
    mediaReady: number
    mediaPending: number
    nextAction: ExecutionAction
  }
  paid: {
    inScope: boolean
    eligible: boolean
    objective: string
    package: {
      audienceHypotheses: number
      adAngles: number
      adCopyVariations: number
      creativeBriefs: number
      complete: boolean
    }
    approvedPlatforms: string[]
    planningOnlyPlatforms: string[]
    platformDecisionSource: string
    matchingAccounts: Array<{
      id: string
      platform: string
      platformAccountName: string | null
      status: string
      hasApiAccess: boolean
      pixelId: string | null
    }>
    allAccounts: Array<{ id: string; platform: string; status: string }>
    readyForPaidAds: boolean
    readyForPaidAdsReason: string | null
    missingData: string[]
    launchBlockers: string[]
    trackingReady: boolean
    campaignCount: number
    adCount: number
    creativesReady: number
    campaigns: Array<{
      id: string
      name: string
      platform: string
      objective: string
      status: string
      strategyPinned: boolean
      executionPlanReady: boolean
      budgetApproved: boolean
      launchApproved: boolean
      platformCampaignId: string | null
      platformStatus: string | null
      adCount: number
      updatedAt: string
    }>
    nextAction: ExecutionAction
  }
}

const PLATFORM_LABEL: Record<string, string> = {
  META: 'Meta Ads',
  GOOGLE: 'Google Ads',
  TIKTOK: 'TikTok Ads',
  LINKEDIN: 'LinkedIn Ads',
}

function paidLaunchBlockerLabels(values: Array<string | null | undefined>, ar: boolean): string[] {
  const normalized = values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const hasTracking = normalized.some(value => /pixel|tracking|conversion\s+events?/i.test(value))
  const unmatched = normalized.filter(value => !/pixel|tracking|conversion\s+events?/i.test(value))
  const labels = [
    ...(hasTracking
      ? [ar ? 'إعداد Pixel وأحداث التحويل ووجهة القياس' : 'Set up the pixel, conversion events, and measurement destination']
      : []),
    ...unmatched,
  ]
  return [...new Set(labels)]
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'indigo' | 'emerald' | 'orange' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-950',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-950',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    orange: 'border-orange-100 bg-orange-50 text-orange-950',
  }
  return (
    <div className={`rounded-2xl border px-3 py-3 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-current/50">{label}</p>
      <p className="mt-1 text-lg font-black tracking-tight">{value}</p>
    </div>
  )
}

function Step({ done, label, helper }: { done: boolean; label: string; helper: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
      {done
        ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
        : <CircleDot className="mt-0.5 h-4 w-4 flex-none text-amber-500" />}
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-950">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{helper}</p>
      </div>
    </div>
  )
}

export default function CampaignExecutionPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const campaignId = params.id
  const [overview, setOverview] = useState<ExecutionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const copy = (arText: string, enText: string) => ar ? arText : enText

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error(copy('انتهت جلسة الدخول.', 'Your session has expired.'))
      const response = await fetch(`/api/campaigns/${campaignId}/execution-overview`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || copy('تعذر تحميل التنفيذ.', 'Could not load execution.'))
      setOverview(body)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy('تعذر تحميل التنفيذ.', 'Could not load execution.'))
    } finally {
      setLoading(false)
    }
  }, [ar, campaignId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login')
  }, [authLoading, router, user])

  useEffect(() => {
    if (user) loadOverview()
  }, [loadOverview, user])

  if (loading || authLoading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-[#f4f7fb] px-5 py-8">
          <div className="mx-auto max-w-7xl animate-pulse space-y-5">
            <div className="h-28 rounded-[28px] bg-white" />
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-[520px] rounded-[28px] bg-white" />
              <div className="h-[520px] rounded-[28px] bg-white" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!overview || error) {
    return (
      <AppShell>
        <div className="flex min-h-[65vh] items-center justify-center bg-[#f4f7fb] px-6">
          <div className="max-w-lg rounded-[28px] border border-rose-100 bg-white p-7 text-center shadow-sm">
            <p className="font-bold text-rose-700">{error || copy('تعذر تحميل مركز التنفيذ.', 'Could not load the execution center.')}</p>
            <button type="button" onClick={loadOverview} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#071236] px-4 py-2 text-sm font-bold text-white">
              <RefreshCw className="h-4 w-4" /> {copy('إعادة المحاولة', 'Try again')}
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  const { campaign, organic, paid } = overview
  const organicReviewed = (organic.counts.APPROVED ?? 0) + (organic.counts.SCHEDULED ?? 0) + (organic.counts.PUBLISHED ?? 0)
  const latestPaid = paid.campaigns[0] ?? null
  const paidPackageTotal = paid.package.audienceHypotheses + paid.package.adAngles + paid.package.adCopyVariations + paid.package.creativeBriefs
  const paidBlockers = paidLaunchBlockerLabels([
    paid.readyForPaidAdsReason,
    ...paid.missingData,
    ...paid.launchBlockers,
  ], ar)
  const directionArrow = ar ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />

  return (
    <AppShell>
      <main className="min-h-screen bg-[#f4f7fb] px-4 py-5 text-[#071236] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1420px] space-y-5">
          <section className="overflow-hidden rounded-[30px] border border-white bg-[#071236] text-white shadow-[0_28px_90px_rgba(7,18,54,0.18)]">
            <div className="h-1 bg-gradient-to-r from-[#6478ff] via-[#9b8cff] to-[#45d3ac]" />
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8">
              <div>
                <button type="button" onClick={() => router.push(`/campaigns/${campaign.id}?tab=strategy`)} className="inline-flex items-center gap-2 text-xs font-bold text-white/60 transition hover:text-white">
                  {ar ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                  {copy('العودة إلى الاستراتيجية', 'Back to strategy')}
                </button>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]">
                    {copy('مركز قيادة الحملة', 'Campaign command center')}
                  </span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
                    {campaign.approvalState === 'approved' ? copy('استراتيجية معتمدة', 'Approved strategy') : copy('تحتاج مراجعة', 'Needs review')}
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{campaign.name}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
                  {copy(
                    'الاستراتيجية الواحدة تنقسم هنا إلى خط إنتاج عضوي وخط اكتساب مدفوع. لكل خط حقيقة وحالة وقرار تالٍ مستقلان.',
                    'One approved strategy branches here into organic production and paid acquisition. Each lane has its own truth, state, and next decision.',
                  )}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{copy('النطاق', 'Scope')}</p>
                  <p className="mt-1 text-sm font-black uppercase">{campaign.scope}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{copy('الهدف', 'Goal')}</p>
                  <p className="mt-1 text-sm font-black">{campaign.goal.replace(/_/g, ' ')}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{copy('الإصدار', 'Revision')}</p>
                  <p className="mt-1 text-sm font-black">v{campaign.strategySnapshot?.version ?? '—'}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <article className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_20px_65px_rgba(15,23,42,0.06)]">
              <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><Sparkles className="h-5 w-5" /></span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-700">01 · Organic</p>
                      <h2 className="mt-1 text-xl font-black">{copy('نظام المحتوى العضوي', 'Organic content system')}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{copy('Content Hub هو مصدر حقيقة المنشورات والوسائط وحالة النشر فقط.', 'Content Hub is the source of truth for posts, media, and publishing lifecycle only.')}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black ${organic.inScope ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {organic.inScope ? copy('داخل النطاق', 'In scope') : copy('خارج النطاق', 'Out of scope')}
                  </span>
                </div>
              </div>
              <div className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label={copy('المنشورات', 'Posts')} value={organic.total} tone="emerald" />
                  <Metric label={copy('مراجعة', 'Reviewed')} value={organicReviewed} />
                  <Metric label={copy('وسائط جاهزة', 'Media ready')} value={organic.mediaReady} />
                  <Metric label={copy('منشور', 'Published')} value={organic.counts.PUBLISHED ?? 0} />
                </div>
                <div className="space-y-2">
                  <Step done={organic.total > 0} label={copy('مسودات مرتبطة بالاستراتيجية', 'Strategy-linked drafts')} helper={copy(`${organic.total} سجل فعلي داخل Content Hub.`, `${organic.total} live Content Hub records.`)} />
                  <Step done={organicReviewed > 0} label={copy('موافقة المحتوى والوسائط', 'Content and media approval')} helper={copy('التعديل بعد الاعتماد يعيد فتح المراجعة.', 'Editing after approval reopens review.')} />
                  <Step done={(organic.counts.PUBLISHED ?? 0) > 0} label={copy('جدولة ونشر موثق', 'Verified scheduling and publishing')} helper={copy('المجدول ليس منشورًا حتى يعود معرف المنصة.', 'Scheduled is not published until provider evidence returns.')} />
                </div>
                <Link href={organic.nextAction.href} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700">
                  {ar ? organic.nextAction.labelAr : organic.nextAction.labelEn} {directionArrow}
                </Link>
              </div>
            </article>

            <article className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-[0_20px_65px_rgba(15,23,42,0.06)]">
              <div className="border-b border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-orange-50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><Megaphone className="h-5 w-5" /></span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-700">02 · Paid</p>
                      <h2 className="mt-1 text-xl font-black">{copy('نظام الاكتساب المدفوع', 'Paid acquisition system')}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{copy('الإعلانات كيانات مستقلة عن المنشورات، لكنها ترجع إلى نفس الاستراتيجية وBrand Brain.', 'Ads are separate from posts, but inherit the same approved strategy and Brand Brain.')}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black ${paid.inScope ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                    {paid.inScope ? copy('داخل النطاق', 'In scope') : copy('خارج النطاق', 'Out of scope')}
                  </span>
                </div>
              </div>
              <div className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label={copy('مخرجات Paid', 'Paid outputs')} value={paidPackageTotal} tone="indigo" />
                  <Metric label={copy('الحملات', 'Campaigns')} value={paid.campaignCount} />
                  <Metric label={copy('الإعلانات', 'Ads')} value={paid.adCount} />
                  <Metric label={copy('إبداع جاهز', 'Creative ready')} value={paid.creativesReady} tone={paid.creativesReady > 0 ? 'emerald' : 'orange'} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[
                    [copy('جماهير', 'Audiences'), paid.package.audienceHypotheses],
                    [copy('زوايا', 'Angles'), paid.package.adAngles],
                    [copy('نسخ', 'Copy'), paid.package.adCopyVariations],
                    [copy('بريفات', 'Briefs'), paid.package.creativeBriefs],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                      <p className="text-lg font-black text-slate-950">{value}</p>
                      <p className="text-[10px] font-bold text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{copy('منصات التنفيذ المعتمدة', 'Approved execution platforms')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {paid.approvedPlatforms.length > 0
                      ? paid.approvedPlatforms.map(platform => (
                          <span key={platform} className="rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-bold text-indigo-700">{PLATFORM_LABEL[platform] || platform}</span>
                        ))
                      : <span className="text-xs font-semibold text-amber-700">{copy('لم تعتمد الاستراتيجية منصة مدفوعة قابلة للتنفيذ.', 'No executable paid platform was approved by strategy.')}</span>}
                  </div>
                  {paid.planningOnlyPlatforms.length > 0 && (
                    <p className="mt-2 text-xs leading-5 text-amber-700">
                      {copy('تخطيط/تصدير فقط حاليًا:', 'Planning/export only today:')} {paid.planningOnlyPlatforms.join(', ')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Step done={paid.package.complete} label={copy('حزمة Paid مرتبطة بالإصدار المعتمد', 'Paid package pinned to approved revision')} helper={copy('3 جماهير + 4 زوايا + 9 نسخ + 4 بريفات.', '3 audiences + 4 angles + 9 copy variations + 4 briefs.')} />
                  <Step done={paid.matchingAccounts.length > 0} label={copy('حساب إعلاني يطابق قرار المنصة', 'Strategy-matched ad account')} helper={paid.matchingAccounts.length > 0 ? paid.matchingAccounts.map(account => account.platformAccountName || PLATFORM_LABEL[account.platform] || account.platform).join(', ') : copy('الحساب المتصل لمنصة أخرى لا يغير الاستراتيجية تلقائيًا.', 'An account on another platform never rewrites strategy automatically.')} />
                  <Step done={paid.trackingReady} label={copy('وجهة التحويل والتتبع', 'Conversion destination and tracking')} helper={paid.trackingReady ? copy('أصبحت وجهة القياس محفوظة في مسودة التنفيذ.', 'The measurement destination is saved in the execution draft.') : (paidBlockers[0] || copy('تُحفظ UTM والوجهة في مسودة الإعلان قبل أي إنشاء منصة.', 'UTM and destination are saved in the ad draft before platform creation.'))} />
                  <Step done={Boolean(latestPaid?.executionPlanReady)} label={copy('الإعلانات والإبداع والموافقات', 'Ads, creative, and approvals')} helper={latestPaid ? copy(`${latestPaid.adCount} إعلانات · ${latestPaid.status}`, `${latestPaid.adCount} ads · ${latestPaid.status}`) : copy('لم تُنشأ مسودة AdCampaign بعد.', 'No AdCampaign draft exists yet.')} />
                </div>

                {paidBlockers.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                    <p className="text-xs font-black">{copy('ما يمنع الإطلاق الآن', 'What blocks launch now')}</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5">
                      {paidBlockers.map(item => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                <Link href={paid.nextAction.href} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700">
                  {ar ? paid.nextAction.labelAr : paid.nextAction.labelEn} {directionArrow}
                </Link>
              </div>
            </article>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-700"><ShieldCheck className="h-5 w-5" /><p className="text-xs font-black uppercase tracking-[0.14em]">{copy('حقيقة التنفيذ', 'Execution truth')}</p></div>
                <h2 className="mt-2 text-lg font-black text-slate-950">{copy('لا تختفي الإعلانات داخل Content Hub', 'Paid ads do not disappear inside Content Hub')}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{copy('المحتوى العضوي والإعلانات يمكنهما مشاركة الفكرة أو الأصل، لكن لكل منهما نسخة ومقاس وموافقة وميزانية وحالة منصة مستقلة.', 'Organic content and ads may share an idea or asset, but each has independent copy, format, approval, budget, and platform state.')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/campaigns/${campaign.id}?tab=strategy`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"><BadgeCheck className="h-4 w-4" />{copy('الاستراتيجية', 'Strategy')}</Link>
                <Link href={`/campaigns/${campaign.id}/content-hub`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"><Sparkles className="h-4 w-4" />Content Hub</Link>
                <Link href="/paid-campaigns" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"><Megaphone className="h-4 w-4" />{copy('الحملات المدفوعة', 'Paid campaigns')}</Link>
                <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"><BarChart3 className="h-4 w-4" />{copy('النتائج', 'Results')}</Link>
                {latestPaid && <Link href={`/paid-campaigns/${latestPaid.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#071236] px-4 py-2 text-xs font-bold text-white"><ExternalLink className="h-4 w-4" />{copy('فتح أحدث مسودة Paid', 'Open latest paid draft')}</Link>}
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
