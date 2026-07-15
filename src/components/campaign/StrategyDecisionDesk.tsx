'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react'

type Tone = 'positive' | 'warning' | 'danger' | 'muted' | 'checking'

type LocalizedText = {
  ar: string
  en: string
}

type DecisionCard = {
  label: LocalizedText
  value: LocalizedText | string
  helper: LocalizedText | string
  tone?: Tone
}

type StrategyStep = {
  id: string
  label: LocalizedText
  helper: LocalizedText
  href: string
  status: 'complete' | 'current' | 'review' | 'blocked' | 'pending'
  metric?: LocalizedText | string
}

type StrategyDecisionDeskProps = {
  campaign: {
    id: string
    name: string
    goal?: string
    tone?: string
    platforms?: string[]
    updatedAt?: string
  }
  strategy: Record<string, any>
  strategyScopeTruth: string
  strategyConfidenceTruth: string
  operatingState: {
    stage: string
    stageLabel?: string
    stageLabelAr?: string
    stageHelper?: string
    stageHelperAr?: string
    truthFlags: Record<string, boolean>
    counts: Record<string, number>
  }
  fulfillment: {
    label: string
    value: string
    helper: string
    tone: Tone
    expectedDirections: number | null
    actualDirections: number
  }
  executionBridge: {
    overallStatus: 'ready' | 'blocked' | 'checking' | 'not_in_scope'
    readyCount: number
    blockedCount: number
  }
  creativeSummary: {
    total: number
    mediaNeeded: number
    readinessPending: number
    attachedToPost: number
  }
  brandScore: number | null
  brandTruthBlocked: boolean
  missingData: string[]
  evidenceCount: number
  nextAction: {
    title: string
    helper: string
    label: string
    href: string
  }
  qualityState: 'not_reviewed' | 'passed' | 'needs_attention'
  locale: 'ar' | 'en'
  onReadDocument: () => void
}

const TONES: Record<Tone, string> = {
  positive: 'border-emerald-200 bg-emerald-50/80 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50/80 text-amber-950',
  danger: 'border-rose-200 bg-rose-50/80 text-rose-950',
  muted: 'border-slate-200 bg-slate-50/80 text-slate-800',
  checking: 'border-blue-200 bg-blue-50/80 text-blue-950',
}

const STEP_TONES: Record<StrategyStep['status'], string> = {
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  current: 'border-indigo-200 bg-indigo-50 text-indigo-950',
  review: 'border-amber-200 bg-amber-50 text-amber-950',
  blocked: 'border-rose-200 bg-rose-50 text-rose-950',
  pending: 'border-slate-200 bg-slate-50 text-slate-600',
}

function localized(ar: string, en: string): LocalizedText {
  return { ar, en }
}

function getText(value: LocalizedText | string, isArabic: boolean): string {
  return typeof value === 'string' ? value : (isArabic ? value.ar : value.en)
}

function compactValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && value.length > 0) {
    const items = value
      .slice(0, 3)
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (!item || typeof item !== 'object') return ''
        const record = item as Record<string, unknown>
        const candidate = record.name || record.label || record.title || record.message || record.value
        return typeof candidate === 'string' ? candidate.trim() : ''
      })
      .filter(Boolean)
    return items.length > 0 ? items.join(' · ') : fallback
  }
  return fallback
}

function statusIcon(status: StrategyStep['status']) {
  const className = 'h-4 w-4 shrink-0'
  if (status === 'complete') return <CheckCircle2 className={className} />
  if (status === 'current') return <CircleDot className={className} />
  if (status === 'review' || status === 'blocked') return <AlertTriangle className={className} />
  return <Clock3 className={className} />
}

function statusLabel(status: StrategyStep['status'], isArabic: boolean): string {
  const labels: Record<StrategyStep['status'], LocalizedText> = {
    complete: localized('مكتمل', 'Complete'),
    current: localized('التالي', 'Next'),
    review: localized('مراجعة', 'Review'),
    blocked: localized('متوقف', 'Blocked'),
    pending: localized('لاحقاً', 'Later'),
  }
  return isArabic ? labels[status].ar : labels[status].en
}

function Card({ item, isArabic }: { item: DecisionCard; isArabic: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${TONES[item.tone || 'muted']}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-60">{getText(item.label, isArabic)}</p>
      <p className="mt-1 text-sm font-semibold leading-6">{getText(item.value, isArabic)}</p>
      <p className="mt-1 text-xs leading-5 opacity-70">{getText(item.helper, isArabic)}</p>
    </div>
  )
}

function StepCard({ step, isArabic }: { step: StrategyStep; isArabic: boolean }) {
  return (
    <Link href={step.href} className={`group flex min-h-[156px] flex-col rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${STEP_TONES[step.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold opacity-50">{step.id}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-current/15 bg-white/70 px-2 py-1 text-[10px] font-semibold">
          {statusIcon(step.status)}
          {statusLabel(step.status, isArabic)}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-5">{getText(step.label, isArabic)}</p>
      {step.metric && <p className="mt-1 text-[11px] font-semibold opacity-60">{getText(step.metric, isArabic)}</p>}
      <p className="mt-2 flex-1 text-xs leading-5 opacity-75">{getText(step.helper, isArabic)}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold opacity-70 transition group-hover:opacity-100">
        {isArabic ? 'فتح المسار' : 'Open path'}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

export default function StrategyDecisionDesk({
  campaign,
  strategy,
  strategyScopeTruth,
  strategyConfidenceTruth,
  operatingState,
  fulfillment,
  executionBridge,
  creativeSummary,
  brandScore,
  brandTruthBlocked,
  missingData,
  evidenceCount,
  nextAction,
  qualityState,
  locale,
  onReadDocument,
}: StrategyDecisionDeskProps) {
  const isArabic = locale === 'ar'
  const text = (ar: string, en: string) => isArabic ? ar : en
  const truthFlags = operatingState.truthFlags || {}
  const postCount = operatingState.counts.totalPosts || creativeSummary.total || 0
  const connectedState = executionBridge.overallStatus
  const strategyStatus: StrategyStep['status'] = brandTruthBlocked
    ? 'blocked'
    : qualityState === 'needs_attention'
      ? 'review'
      : 'complete'
  const brandStatus: StrategyStep['status'] = brandTruthBlocked
    ? 'blocked'
    : typeof brandScore !== 'number'
      ? 'review'
      : brandScore >= 70
        ? 'complete'
        : 'review'
  const contentStatus: StrategyStep['status'] = !truthFlags.hasContentPlan
    ? 'pending'
    : truthFlags.hasDraftContent || truthFlags.hasChannelScopeMismatch
      ? 'review'
      : 'complete'
  const creativeStatus: StrategyStep['status'] = !truthFlags.hasContentPlan
    ? 'pending'
    : creativeSummary.mediaNeeded > 0 || creativeSummary.readinessPending > 0
      ? 'review'
      : 'complete'
  const executionStatus: StrategyStep['status'] = connectedState === 'blocked'
    ? 'review'
    : connectedState === 'checking'
      ? 'current'
      : truthFlags.hasPublishedContent
        ? 'complete'
        : 'pending'

  const steps: StrategyStep[] = [
    {
      id: '01',
      label: localized('سياق البراند', 'Brand context'),
      helper: localized('المعلومات والأدلة والقيود التي يجب أن تبقى مرجعًا لكل قرار.', 'Evidence, context, and constraints that ground every decision.'),
      href: '/brand',
      status: brandStatus,
      metric: typeof brandScore === 'number' ? localized(`ملف البراند ${brandScore}/100`, `Brand profile ${brandScore}/100`) : localized('يحتاج مراجعة', 'Needs review'),
    },
    {
      id: '02',
      label: localized('الاستراتيجية', 'Strategy'),
      helper: localized('قرار الحملة: الهدف، الجمهور، الرسائل، القنوات، والقياس.', 'The campaign decision: objective, audience, messaging, channels, and measurement.'),
      href: `/campaigns/${campaign.id}?tab=strategy`,
      status: strategyStatus,
      metric: localized(strategyScopeTruth, strategyScopeTruth),
    },
    {
      id: '03',
      label: localized('المحتوى', 'Content'),
      helper: localized('Content Hub هو مصدر الحقيقة للمنشورات والنسخ وحالة دورة الحياة.', 'Content Hub is the source of truth for posts, copy, and lifecycle.'),
      href: `/campaigns/${campaign.id}/content-hub`,
      status: contentStatus,
      metric: localized(`${postCount} منشورات`, `${postCount} posts`),
    },
    {
      id: '04',
      label: localized('الإبداع', 'Creative'),
      helper: localized('تحديد احتياجات الأصول وربط الوسائط النهائية بقرار صريح.', 'Define asset needs and attach final media through an explicit decision.'),
      href: `/campaigns/${campaign.id}/creative-brief`,
      status: creativeStatus,
      metric: localized(`${creativeSummary.attachedToPost} مرتبطة · ${creativeSummary.mediaNeeded} تحتاج وسائط`, `${creativeSummary.attachedToPost} attached · ${creativeSummary.mediaNeeded} need media`),
    },
    {
      id: '05',
      label: localized('التنفيذ والنتائج', 'Execution & results'),
      helper: localized('الاتصالات، الموافقات، النشر، ثم التحليلات الحقيقية والتعلم.', 'Connections, approvals, publishing, real analytics, and learning.'),
      href: `/campaigns/${campaign.id}?tab=publish`,
      status: executionStatus,
      metric: connectedState === 'ready'
        ? localized(`${executionBridge.readyCount} جاهزة للمراجعة`, `${executionBridge.readyCount} ready for review`)
        : localized(`${executionBridge.blockedCount} تحتاج إعدادًا`, `${executionBridge.blockedCount} need setup`),
    },
  ]

  const cards: DecisionCard[] = [
    {
      label: localized('نطاق الحملة', 'Campaign scope'),
      value: strategyScopeTruth,
      helper: localized('يعكس أمر التوليد المحفوظ لهذه الحملة فقط.', 'Reflects this campaign’s saved generation order only.'),
    },
    {
      label: localized('مطابقة الخطة', 'Plan fulfillment'),
      value: fulfillment.value,
      helper: fulfillment.helper,
      tone: fulfillment.tone,
    },
    {
      label: localized('الحالة التشغيلية', 'Operating state'),
      value: isArabic ? (operatingState.stageLabelAr || operatingState.stage) : (operatingState.stageLabel || operatingState.stage),
      helper: isArabic ? (operatingState.stageHelperAr || '') : (operatingState.stageHelper || ''),
      tone: truthFlags.hasPublishedContent ? 'positive' : truthFlags.hasContentPlan ? 'checking' : 'warning',
    },
    {
      label: localized('الثقة والمدخلات', 'Confidence & inputs'),
      value: strategyConfidenceTruth,
      helper: missingData.length > 0
        ? localized(`${missingData.length} مدخلات تحتاج تحديدًا قبل التنفيذ.`, `${missingData.length} inputs need definition before execution.`)
        : localized('الافتراضات تظل للمراجعة حتى تظهر أدلة أو تحليلات.', 'Assumptions remain review-only until proof or analytics exists.'),
      tone: missingData.length > 0 ? 'warning' : 'muted',
    },
  ]

  const strategyAnatomy: DecisionCard[] = [
    {
      label: localized('الهدف التجاري', 'Business objective'),
      value: compactValue(strategy.businessObjective?.objective || strategy.businessObjective?.goal || strategy.businessObjective, text('غير محدد', 'Not defined')),
      helper: localized('الهدف الذي يجب أن تقوده الحملة، وليس مجرد زيادة التفاعل.', 'The outcome the campaign should drive, not engagement alone.'),
    },
    {
      label: localized('الرسالة الأساسية', 'Core message'),
      value: compactValue(strategy.keyMessage, text('لم تُثبت بعد', 'Not established yet')),
      helper: localized('تُراجع مقابل Brand Brain والأدلة قبل إنتاج المحتوى.', 'Reviewed against Brand Brain and evidence before production.'),
    },
    {
      label: localized('التموضع', 'Positioning'),
      value: compactValue(strategy.positioning, text('لم يُحدد بعد', 'Not defined yet')),
      helper: localized('سبب ملاءمة الحل لهذا الجمهور مقارنة بالبدائل.', 'Why the solution fits this audience versus alternatives.'),
    },
    {
      label: localized('الجمهور الأولوي', 'Priority audience'),
      value: compactValue(strategy.targetAudienceRefined || strategy.targetAudience || strategy.audienceSegments, text('لم يُحدد بعد', 'Not defined yet')),
      helper: localized('يجب أن يرتبط كل محتوى بشريحة أو لحظة شراء واضحة.', 'Every content item should map to a segment or buying moment.'),
    },
    {
      label: localized('نظام المحتوى', 'Content system'),
      value: compactValue(strategy.contentPillars || strategy.contentAngles, text('لم يُبنَ بعد', 'Not built yet')),
      helper: localized('ركائز وزوايا وصيغ، وليس قائمة Hooks منفصلة.', 'Pillars, angles, and formats—not disconnected hooks.'),
    },
    {
      label: localized('القياس', 'Measurement'),
      value: compactValue(strategy.kpis || strategy.successMetrics, text('خط الأساس مطلوب', 'Baseline required')),
      helper: localized('لا يتم إعلان نجاح أو ROAS قبل وصول بيانات حقيقية.', 'No success or ROAS claim before real data arrives.'),
      tone: strategy.kpis?.length || strategy.successMetrics?.length ? 'muted' : 'warning',
    },
  ]

  return (
    <div className="space-y-5" dir={isArabic ? 'rtl' : 'ltr'}>
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_46%),linear-gradient(135deg,#ffffff,#f8fafc)] px-5 py-7 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700">NEXUS Strategy Desk</span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">{text('قرار قبل التنفيذ', 'Decision before execution')}</span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600">{strategyScopeTruth}</span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{text('مكتب قرار الاستراتيجية', 'Strategy decision desk')}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                {text('مُلخص تنفيذي يوضح ما نعرفه، ما ينقصنا، وما القرار التالي قبل تحويل الاستراتيجية إلى محتوى أو إبداع أو نشر.', 'An executive view of what is known, what is missing, and the next decision before strategy becomes content, creative, or publishing.')}
              </p>
              <p className="mt-3 text-xs font-bold text-slate-500">{campaign.name}</p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">{text('القرار التالي', 'Next decision')}</p>
                <p className="mt-1 text-base font-bold leading-6 text-slate-950">{nextAction.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{nextAction.helper}</p>
                <Link href={nextAction.href} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                  {nextAction.label}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
              <button type="button" onClick={onReadDocument} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                <FileCheck2 className="h-4 w-4" />
                {text('فتح وثيقة الاستراتيجية الكاملة', 'Open full strategy document')}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-8">
          {cards.map((item) => <Card key={getText(item.label, isArabic)} item={item} isArabic={isArabic} />)}
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{text('خط التشغيل', 'Operating path')}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{text('مسار واحد، مالك واضح لكل خطوة', 'One path, one owner per step')}</h2>
          </div>
          <p className="text-xs leading-5 text-slate-500">{text('الاستراتيجية تقرر، والصفحات الأخرى تنفذ.', 'Strategy decides; the other surfaces execute.')}</p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((step) => <StepCard key={step.id} step={step} isArabic={isArabic} />)}
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{text('بنية القرار', 'Decision anatomy')}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{text('ما الذي تقوله الاستراتيجية فعليًا؟', 'What does the strategy actually say?')}</h2>
          </div>
          <ShieldCheck className="h-5 w-5 text-indigo-500" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {strategyAnatomy.map((item) => <Card key={getText(item.label, isArabic)} item={item} isArabic={isArabic} />)}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <details className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">
            <span className="inline-flex items-center gap-2">{text('الأدلة والافتراضات', 'Evidence & assumptions')} <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{evidenceCount}</span></span>
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>{text('كل ادعاء يجب أن يكون مرتبطًا بمصدر من Brand Brain أو ملف أو بيانات حقيقية. ما عدا ذلك يظل افتراضًا للمراجعة.', 'Every claim must link to Brand Brain, a file, or real data. Everything else remains a review-only assumption.')}</p>
            <Link href="/brand" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900">{text('راجع الأدلة في Brand Brain', 'Review evidence in Brand Brain')} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        </details>
        <details open={missingData.length > 0} className={`rounded-[26px] border p-5 shadow-sm sm:p-7 ${missingData.length > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">
            {text('ما ينقص قبل التنفيذ', 'What is missing before execution')} <span className="ms-1 rounded-full bg-white/80 px-2 py-1 text-[10px] text-amber-800">{missingData.length}</span>
          </summary>
          <div className="mt-4 space-y-2">
            {missingData.length > 0 ? missingData.map((item) => <p key={item} className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-xs font-semibold text-amber-950">{item}</p>) : <p className="text-sm text-slate-600">{text('لا توجد مدخلات معلقة.', 'No missing inputs.')}</p>}
          </div>
        </details>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>{text('هذه الصفحة للقرار والمراجعة فقط. لا نشر أو جدولة أو صرف أو تعلم تلقائي منها.', 'This page is for decision and review only. No publishing, scheduling, spend, or automatic learning happens here.')}</span>
        <span className="font-bold text-slate-800">{campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleDateString(isArabic ? 'ar' : 'en') : ''}</span>
      </div>
    </div>
  )
}
