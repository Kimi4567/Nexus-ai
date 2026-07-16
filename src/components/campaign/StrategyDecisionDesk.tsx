'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { StrategySnapshot } from '@/lib/strategy/strategySnapshot'
import { countPendingReadinessItems, isReadinessItemComplete } from '@/lib/strategy/readinessTruth'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  Clock3,
  ExternalLink,
  FileCheck2,
  Filter,
  Layers3,
  ListChecks,
  ShieldCheck,
  Target,
  Users,
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
  snapshot: StrategySnapshot
  strategy: Record<string, any>
  brandProfile: Record<string, any> | null
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
  evidenceItems: Array<{
    statement: string
    status: 'source_linked' | 'brand_brain_entry'
    sourceName: string | null
    sourceLocator: string | null
  }>
  actualPosts: Array<{
    id: string
    platform?: string | null
    status?: string | null
    caption?: string | null
    imageUrl?: string | null
    publishedAt?: string | null
    scheduledAt?: string | null
    analyticsData?: unknown
  }>
  platformStates: Array<{
    key: string
    status: string
    tone?: string
  }>
  nextAction: {
    title: string
    helper: string
    label: string
    href: string
    costLabel?: string | null
  }
  onNextAction?: () => void
  nextActionDisabled?: boolean
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

function recordValue(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key]
  }
  return undefined
}

function listValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  return [value]
}

function normalizedPlatform(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '_') : ''
}

function platformLabel(value: unknown, isArabic: boolean): string {
  const key = normalizedPlatform(value)
  const labels: Record<string, LocalizedText> = {
    INSTAGRAM: localized('Instagram', 'Instagram'),
    FACEBOOK: localized('Facebook', 'Facebook'),
    META: localized('Meta', 'Meta'),
    LINKEDIN: localized('LinkedIn', 'LinkedIn'),
    TIKTOK: localized('TikTok', 'TikTok'),
    PINTEREST: localized('Pinterest', 'Pinterest'),
    YOUTUBE: localized('YouTube', 'YouTube'),
    YOUTUBE_SHORTS: localized('YouTube Shorts', 'YouTube Shorts'),
    INSTAGRAM_REELS: localized('Instagram Reels', 'Instagram Reels'),
    X: localized('X', 'X'),
    THREADS: localized('Threads', 'Threads'),
  }
  return labels[key] ? getText(labels[key], isArabic) : (typeof value === 'string' && value.trim() ? value : (isArabic ? 'غير محددة' : 'Not specified'))
}

function isMissingValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return !normalized
    || normalized.includes('not defined')
    || normalized.includes('not established')
    || normalized.includes('not enough data')
    || normalized.includes('غير محدد')
    || normalized.includes('لم تُحد')
    || normalized.includes('لم يتم')
    || normalized.includes('مطلوب')
}

function statusTone(status: string): Tone {
  const normalized = status.toLowerCase()
  // Negative compound states must be checked before their positive substrings:
  // "not_connected" contains "connected" and previously rendered as Ready.
  if (['blocked', 'failed', 'conflict', 'not_connected', 'not_available'].some(token => normalized.includes(token))) return 'danger'
  if (['checking', 'pending', 'review', 'needs_', 'permission_unverified', 'planning', 'scheduled'].some(token => normalized.includes(token))) return 'warning'
  if (['ready', 'connected', 'complete', 'published', 'approved', 'passed'].some(token => normalized.includes(token))) return 'positive'
  return 'muted'
}

function statusCopy(status: string, isArabic: boolean): string {
  const normalized = status.toLowerCase()
  if (normalized.includes('not_connected')) return isArabic ? 'غير متصل' : 'Not connected'
  if (normalized.includes('not_available')) return isArabic ? 'غير متاح' : 'Not available'
  if (normalized.includes('permission_unverified')) return isArabic ? 'الصلاحية غير مثبتة' : 'Permission unverified'
  if (normalized.includes('needs_setup')) return isArabic ? 'يحتاج إعدادًا' : 'Needs setup'
  if (normalized.includes('blocked') || normalized.includes('failed')) return isArabic ? 'متوقف' : 'Blocked'
  if (normalized.includes('planning')) return isArabic ? 'تخطيط فقط' : 'Planning only'
  if (normalized.includes('pending') || normalized.includes('review') || normalized.includes('needs_')) return isArabic ? 'يحتاج مراجعة' : 'Needs review'
  if (normalized.includes('ready') || normalized.includes('connected')) return isArabic ? 'جاهز للتنفيذ' : 'Execution ready'
  if (normalized.includes('published')) return isArabic ? 'منشور' : 'Published'
  if (normalized.includes('approved')) return isArabic ? 'معتمد' : 'Approved'
  return isArabic ? 'غير متاح' : 'Not available'
}

function readField(value: unknown, isArabic: boolean): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return compactValue(value, isArabic ? 'غير محدد — مطلوب قبل التنفيذ' : 'Not defined — required before execution')
  if (value && typeof value === 'object') {
    return readField(recordValue(value, ['label', 'name', 'title', 'primary', 'marketing', 'description', 'value', 'text', 'objective', 'goal', 'message', 'positioning', 'statement', 'claim', 'proof']), isArabic)
  }
  return ''
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

function SectionHeading({
  eyebrow,
  title,
  helper,
  icon,
}: {
  eyebrow: string
  title: string
  helper: string
  icon: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">{icon}</span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{helper}</p>
      </div>
    </div>
  )
}

function TruthBar({
  items,
  isArabic,
}: {
  items: Array<{ key: string; label: string; value: string; helper: string; tone: Tone }>
  isArabic: boolean
}) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{isArabic ? 'شريط الحقيقة' : 'Truth bar'}</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{isArabic ? 'حالة كل طبقة من المسار التشغيلي' : 'State of every layer in the operating path'}</p>
        </div>
        <p className="text-xs text-slate-500">{isArabic ? 'كل حالة قراءة فقط ومن مصدر واحد.' : 'Read-only status, one source of truth per layer.'}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {items.map(item => (
          <div key={item.key} className={`rounded-2xl border p-3 ${TONES[item.tone]}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">{item.label}</p>
              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
            </div>
            <p className="mt-2 text-xs font-bold leading-5">{item.value}</p>
            <p className="mt-1 text-[10px] leading-4 opacity-70">{item.helper}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function HandoffLink({
  label,
  helper,
  href,
  tone,
  status,
  isArabic,
}: {
  label: string
  helper: string
  href: string
  tone: Tone
  status: string
  isArabic: boolean
}) {
  return (
    <Link href={href} className={`group rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${TONES[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">{label}</p>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100" />
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] opacity-60">{status}</p>
      <p className="mt-2 text-[11px] leading-5 opacity-75">{helper}</p>
      <span className="sr-only">{isArabic ? 'فتح المسار' : 'Open path'}</span>
    </Link>
  )
}

export default function StrategyDecisionDesk({
  campaign,
  snapshot,
  strategy,
  brandProfile,
  strategyScopeTruth,
  strategyConfidenceTruth,
  operatingState,
  fulfillment,
  executionBridge,
  creativeSummary,
  brandScore,
  brandTruthBlocked,
  missingData,
  evidenceItems,
  actualPosts,
  platformStates,
  nextAction,
  onNextAction,
  nextActionDisabled = false,
  qualityState,
  locale,
  onReadDocument,
}: StrategyDecisionDeskProps) {
  const isArabic = locale === 'ar'
  const showDeepReviewPanels = false
  const text = (ar: string, en: string) => isArabic ? ar : en
  const truthFlags = operatingState.truthFlags || {}
  const postCount = operatingState.counts.totalPosts || creativeSummary.total || 0
  const connectedState = executionBridge.overallStatus
  const fallback = text('غير محدد — مطلوب قبل التنفيذ', 'Not defined — required before execution')
  const strategyRecord = strategy || {}
  const isPaidOnly = snapshot.scope === 'paid'
  const paidPlanning = strategyRecord.paidPlanning && typeof strategyRecord.paidPlanning === 'object' && !Array.isArray(strategyRecord.paidPlanning)
    ? strategyRecord.paidPlanning as Record<string, unknown>
    : null
  const paidPackageCount = paidPlanning
    ? ['audienceHypotheses', 'adAngles', 'adCopyVariations', 'creativeBriefs']
      .reduce((total, key) => total + (Array.isArray(paidPlanning[key]) ? (paidPlanning[key] as unknown[]).length : 0), 0)
    : 0
  const paidPackageComplete = Boolean(
    paidPlanning
    && Array.isArray(paidPlanning.audienceHypotheses) && paidPlanning.audienceHypotheses.length === 3
    && Array.isArray(paidPlanning.adAngles) && paidPlanning.adAngles.length === 4
    && Array.isArray(paidPlanning.adCopyVariations) && paidPlanning.adCopyVariations.length === 9
    && Array.isArray(paidPlanning.creativeBriefs) && paidPlanning.creativeBriefs.length === 4
  )
  const brandRecord = brandProfile || {}
  const snapshotContent = snapshot.contentSystem && typeof snapshot.contentSystem === 'object' && !Array.isArray(snapshot.contentSystem)
    ? snapshot.contentSystem as Record<string, unknown>
    : {}
  const snapshotMeasurement = snapshot.measurementPlan && typeof snapshot.measurementPlan === 'object' && !Array.isArray(snapshot.measurementPlan)
    ? snapshot.measurementPlan as Record<string, unknown>
    : {}
  const plannedPlatformValues = [
    ...(campaign.platforms || []),
    ...(Array.isArray(strategyRecord.platforms) ? strategyRecord.platforms : []),
    ...snapshot.channels.map((item) => recordValue(item, ['platform', 'channel', 'name']) || item),
    ...(Array.isArray(strategyRecord.channelStrategy) ? strategyRecord.channelStrategy.map((item: unknown) => recordValue(item, ['platform', 'channel', 'name'])) : []),
    ...(Array.isArray(strategyRecord.contentCalendar)
      ? strategyRecord.contentCalendar
        .flatMap((week: unknown) => listValues(recordValue(week, ['posts', 'items'])))
        .map((post: unknown) => recordValue(post, ['platform', 'channel']))
      : []),
  ]
  const plannedPlatforms = Array.from(new Set(plannedPlatformValues.map(normalizedPlatform).filter(Boolean)))
  const actualPlatforms = Array.from(new Set(actualPosts.map(post => normalizedPlatform(post.platform)).filter(Boolean)))
  const platformMismatch = plannedPlatforms.length > 0 && actualPlatforms.length > 0
    && (plannedPlatforms.some(platform => !actualPlatforms.includes(platform)) || actualPlatforms.some(platform => !plannedPlatforms.includes(platform)))
  const audienceSegments = snapshot.audiences.length > 0
    ? snapshot.audiences
    : listValues(strategyRecord.audienceSegmentsDetailed || strategyRecord.audienceSegments || strategyRecord.targetAudienceRefined || strategyRecord.targetAudience)
  const funnelStages = snapshot.funnel.length > 0
    ? snapshot.funnel
    : listValues(strategyRecord.funnelStages || strategyRecord.funnel || strategyRecord.funnelStrategy)
  const funnelStageCards = [
    { key: 'awareness', label: text('Awareness', 'Awareness') },
    { key: 'consideration', label: text('Consideration', 'Consideration') },
    { key: 'conversion', label: text('Conversion', 'Conversion') },
    { key: 'retention', label: text('Retention', 'Retention') },
  ].map(required => {
    const match = funnelStages.find(stage => normalizedPlatform(recordValue(stage, ['stage', 'name', 'title']) || stage).toLowerCase().includes(required.key))
    return { ...required, value: match || null }
  })
  const channelStrategy = snapshot.channels.length > 0
    ? snapshot.channels
    : listValues(strategyRecord.channelStrategy || strategyRecord.channels || strategyRecord.channelMix)
  const snapshotPillars = listValues(recordValue(snapshotContent, ['pillars', 'contentPillars']))
  const snapshotAngles = listValues(recordValue(snapshotContent, ['angles', 'contentAngles']))
  const contentPillars = snapshotPillars.length > 0 || snapshotAngles.length > 0
    ? [...snapshotPillars, ...snapshotAngles]
    : listValues(strategyRecord.contentPillars || strategyRecord.contentAngles)
  const weeklyPlan = listValues(recordValue(snapshotContent, ['calendar', 'weeklyPlan', 'weeklyExecutionPlan']) || strategyRecord.weeklyExecutionPlan || strategyRecord.weeklyPlan || strategyRecord.contentCalendar)
  const kpiValues = listValues(recordValue(snapshotMeasurement, ['kpis', 'metrics', 'successMetrics']) || strategyRecord.successMetricsDetailed || strategyRecord.kpis || strategyRecord.successMetrics)
  const readinessValues = listValues(strategyRecord.readinessChecklist || strategyRecord.assetRequirements)
  const pendingReadinessCount = countPendingReadinessItems(readinessValues)
  const riskValues = [
    ...listValues(strategyRecord.riskNotes),
    ...listValues(strategyRecord.executionAssumptions),
    ...listValues(strategyRecord.doNotDoYet),
  ]
  const strategyDuration = snapshot.planningHorizonDays !== null
    ? text(`${snapshot.planningHorizonDays} يوم`, `${snapshot.planningHorizonDays} days`)
    : readField(strategyRecord.strategyDuration || strategyRecord.duration || strategyRecord.planningHorizon || strategyRecord.timeframe, isArabic) || fallback
  const strategyVersion = readField(strategyRecord.version || strategyRecord.snapshotVersion, isArabic) || `v${snapshot.version}`
  const strategyStatusLabel = {
    approved: text('معتمدة', 'Approved'),
    review: text('جاهزة للمراجعة', 'Ready for review'),
    blocked: text('محجوبة', 'Blocked'),
    superseded: text('تم إلغاء الاعتماد', 'Approval revoked'),
    draft: text('مسودة', 'Draft'),
  }[snapshot.approvalState]
  const plannedPostCountValue = snapshot.plannedOrganicPostCount
    ?? fulfillment.expectedDirections
    ?? recordValue(snapshotContent, ['expectedPostCount', 'plannedPostCount', 'postCount'])
    ?? recordValue(strategyRecord, ['expectedPostCount', 'plannedPostCount', 'organicPostCount'])
  const plannedPostCount = typeof plannedPostCountValue === 'number' && Number.isFinite(plannedPostCountValue) && plannedPostCountValue > 0
    ? plannedPostCountValue
    : null
  const handoffLinks = [
    { key: 'brand', label: text('Brand Brain', 'Brand Brain'), href: snapshot.executionLinks.brand, status: brandTruthBlocked ? text('تعارض', 'Conflict') : text('مرجع', 'Source'), tone: brandTruthBlocked ? 'danger' as Tone : 'positive' as Tone, helper: text('الأدلة والقيود التي تحكم كل قرار.', 'Evidence and constraints behind every decision.') },
    { key: 'content', label: isPaidOnly ? text('حزمة Paid', 'Paid package') : text('Content Hub', 'Content Hub'), href: isPaidOnly ? `/paid-campaigns/new?sourceCampaignId=${campaign.id}` : snapshot.executionLinks.content, status: isPaidOnly ? (paidPackageComplete ? text('مكتملة بالعقد', 'Contract complete') : text('ناقصة — لا تُعتمد', 'Incomplete — not approvable')) : (truthFlags.hasContentPlan ? text('موجود', 'Present') : text('مطلوب', 'Required')), tone: (isPaidOnly ? paidPackageComplete : truthFlags.hasContentPlan) ? 'positive' as Tone : 'warning' as Tone, helper: isPaidOnly ? text('المطلوب: 3 جماهير، 4 زوايا، 9 نسخ، و4 بريفات قبل أي صرف.', 'Required: 3 audiences, 4 angles, 9 copy variations, and 4 briefs before any spend.') : text('المنشورات وحالات دورة الحياة الفعلية.', 'Actual posts and lifecycle state.') },
    { key: 'creative', label: text('Creative Brief', 'Creative Brief'), href: isPaidOnly ? `/paid-campaigns/new?sourceCampaignId=${campaign.id}` : snapshot.executionLinks.creative, status: isPaidOnly ? (paidPackageComplete ? text('4 بريفات للمراجعة', '4 briefs for review') : text('الحزمة ناقصة', 'Package incomplete')) : (creativeSummary.mediaNeeded > 0 ? text('وسائط ناقصة', 'Media missing') : text('جاهز للمراجعة', 'Ready for review')), tone: isPaidOnly ? (paidPackageComplete ? 'checking' as Tone : 'warning' as Tone) : (creativeSummary.mediaNeeded > 0 ? 'warning' as Tone : 'positive' as Tone), helper: isPaidOnly ? text('بريفات إعلانية للمراجعة، وليست أصولًا جاهزة للإطلاق.', 'Paid creative briefs for review, not launch-ready assets.') : text('الأصل النهائي قبل الموافقة، وليس Concept فقط.', 'Final asset work—not a concept-only visual.') },
    { key: 'approvals', label: text('الموافقات', 'Approvals'), href: snapshot.executionLinks.approvals, status: truthFlags.hasReviewedContent ? text('مسجل', 'Recorded') : text('مطلوب', 'Required'), tone: truthFlags.hasReviewedContent ? 'positive' as Tone : 'warning' as Tone, helper: text('لا جدولة ولا نشر بلا موافقة موثقة.', 'No scheduling or publishing without recorded approval.') },
    { key: 'connections', label: text('الاتصالات', 'Connections'), href: snapshot.executionLinks.connections, status: statusCopy(connectedState, isArabic), tone: statusTone(connectedState), helper: text('الحسابات والصلاحيات الفعلية للمنصات.', 'Live accounts and platform permissions.') },
    { key: 'publish', label: text('النشر', 'Publishing'), href: snapshot.executionLinks.publish, status: truthFlags.hasPublishedContent ? text('منشور', 'Published') : text('مقفل حتى الجاهزية', 'Locked until ready'), tone: truthFlags.hasPublishedContent ? 'positive' as Tone : 'muted' as Tone, helper: text('النشر يملكه مسار التنفيذ وليس هذه الصفحة.', 'Publishing belongs to execution, not this desk.') },
    { key: 'paid', label: text('الحملات المدفوعة', 'Paid campaigns'), href: snapshot.executionLinks.paid, status: snapshot.scope === 'paid' || snapshot.scope === 'full' ? text('تخطيط فقط', 'Planning only') : text('خارج النطاق', 'Out of scope'), tone: snapshot.scope === 'paid' || snapshot.scope === 'full' ? 'checking' as Tone : 'muted' as Tone, helper: text('لا صرف أو إطلاق تلقائي من الاستراتيجية.', 'No spend or automatic launch from strategy.') },
    { key: 'performance', label: text('الأداء والتحليلات', 'Performance & analytics'), href: snapshot.executionLinks.performance, status: truthFlags.hasAnalyticsData ? text('بيانات حقيقية', 'Real data') : text('بانتظار البيانات', 'Awaiting data'), tone: truthFlags.hasAnalyticsData ? 'positive' as Tone : 'muted' as Tone, helper: text('التعلم اقتراح يحتاج بيانات وموافقة.', 'Learning is a proposal backed by data and approval.') },
  ]
  const executiveSummary: DecisionCard[] = [
    { label: localized('الهدف التجاري', 'Business objective'), value: readField(strategyRecord.businessObjective || strategyRecord.businessGoal || campaign.goal, isArabic) || fallback, helper: localized('النتيجة التجارية التي يجب أن تقودها الحملة.', 'The business outcome this campaign should drive.') },
    { label: localized('هدف التسويق', 'Marketing objective'), value: readField(strategyRecord.marketingObjective || recordValue(strategyRecord.businessObjective, ['marketing']) || strategyRecord.objective || strategyRecord.goal, isArabic) || fallback, helper: localized('ما الذي سنقيسه قبل أن ننتقل إلى إنتاج المحتوى.', 'What we measure before moving into production.') },
    { label: localized('الجمهور الأساسي', 'Primary audience'), value: readField(strategyRecord.targetAudienceRefined || strategyRecord.targetAudience || brandRecord.targetAudience, isArabic) || fallback, helper: localized('الشريحة التي يجب أن ترى الرسالة أولاً.', 'The segment that should see the message first.') },
    { label: localized('المشكلة', 'Problem'), value: readField(recordValue(strategyRecord.diagnosisDetails || strategyRecord.diagnosis, ['pain', 'problem', 'situation', 'mainBottleneck', 'trustGap', 'primaryChallenge']) || strategyRecord.problem || strategyRecord.diagnosis || brandRecord.audiencePainPoints, isArabic) || fallback, helper: localized('مشكلة موثقة أو افتراض يحتاج تأكيداً.', 'A documented problem or an assumption that needs confirmation.') },
    { label: localized('العرض', 'Offer'), value: readField(strategyRecord.offer || strategyRecord.primaryOffer || brandRecord.primaryOffer || strategyRecord.valuePropositions, isArabic) || fallback, helper: localized('ما نقدمه، مع قيوده وشروطه الفعلية.', 'What is offered, including its real constraints.') },
    { label: localized('الرسالة', 'Core message'), value: readField(strategyRecord.keyMessage || strategyRecord.coreMessage || strategyRecord.message, isArabic) || fallback, helper: localized('تُراجع مقابل Brand Brain قبل إنتاج أي نسخة.', 'Reviewed against Brand Brain before copy production.') },
    { label: localized('وجهة التحويل', 'Conversion destination'), value: readField(strategyRecord.conversionDestination || recordValue(strategyRecord.conversion, ['destination', 'path']) || brandRecord.conversionDestination, isArabic) || fallback, helper: localized('لا يمكن قياس التحويل دون وجهة واضحة.', 'Conversion cannot be measured without a clear destination.') },
    { label: localized('تعريف النجاح', 'Definition of success'), value: readField(strategyRecord.successDefinition || recordValue(strategyRecord.businessObjective, ['successDefinition', 'success', 'expectedOutcome', 'targetOutcome']) || strategyRecord.successMetric || strategyRecord.successMetrics || recordValue(snapshotMeasurement, ['successDefinition', 'primaryOutcome', 'targetOutcome']), isArabic) || fallback, helper: localized('لا أرقام أداء نهائية قبل Baseline حقيقي.', 'No final performance number before a real baseline.') },
  ]
  const truthBarItems = [
    { key: 'brand', label: text('تغطية الهوية الأساسية', 'Core identity coverage'), value: brandTruthBlocked ? text('تعارض', 'Conflict') : typeof brandScore === 'number' ? `${brandScore}%` : text('تحتاج مراجعة', 'Needs review'), helper: brandTruthBlocked ? text('يتوقف التنفيذ حتى التصحيح.', 'Execution blocked until fixed.') : text('حقول الهوية المحفوظة — ليست نسبة الجاهزية الكلية.', 'Saved identity fields — not overall readiness.'), tone: brandTruthBlocked ? 'danger' as Tone : typeof brandScore === 'number' && brandScore >= 70 ? 'positive' as Tone : 'warning' as Tone },
    { key: 'strategy', label: text('اعتماد الاستراتيجية', 'Strategy approval'), value: strategyStatusLabel, helper: qualityState === 'passed' ? text('فحص الجودة مكتمل؛ الحالة من سجل الاعتماد.', 'Quality review passed; state comes from the approval ledger.') : text('فحص الجودة أو الاعتماد ما زال مطلوبًا.', 'Quality review or approval is still required.'), tone: snapshot.approvalState === 'approved' ? 'positive' as Tone : snapshot.approvalState === 'blocked' ? 'danger' as Tone : 'warning' as Tone },
    { key: 'content', label: isPaidOnly ? text('حزمة Paid', 'Paid package') : text('المحتوى', 'Content'), value: isPaidOnly ? `${paidPackageCount}/20 ${text('مخرجًا تعاقديًا', 'contract outputs')}` : `${postCount} ${text('منشور', 'posts')}`, helper: isPaidOnly ? (paidPackageComplete ? text('3 + 4 + 9 + 4 مكتملة.', '3 + 4 + 9 + 4 complete.') : text('لا اعتماد أو انتقال للتنفيذ قبل اكتمال العقد.', 'No approval or execution handoff until the contract is complete.')) : (truthFlags.hasContentPlan ? text('المصدر: Content Hub.', 'Source: Content Hub.') : text('الخطة غير موجودة بعد.', 'Plan not built yet.')), tone: (isPaidOnly ? paidPackageComplete : truthFlags.hasContentPlan) ? 'positive' as Tone : 'warning' as Tone },
    { key: 'creative', label: text('الإبداع', 'Creative'), value: isPaidOnly ? `${Array.isArray(paidPlanning?.creativeBriefs) ? paidPlanning.creativeBriefs.length : 0} ${text('بريف', 'briefs')}` : `${creativeSummary.attachedToPost}/${Math.max(creativeSummary.total, postCount)}`, helper: isPaidOnly ? text('للمراجعة قبل الإنتاج والإطلاق.', 'For review before production or launch.') : (creativeSummary.mediaNeeded > 0 ? text('وسائط ناقصة.', 'Media missing.') : text('الوسائط المرتبطة تقرأ من المنشورات.', 'Reads linked post media.')), tone: isPaidOnly ? 'checking' as Tone : (creativeSummary.mediaNeeded > 0 ? 'warning' as Tone : 'positive' as Tone) },
    { key: 'approval', label: isPaidOnly ? text('اعتماد Paid', 'Paid approval') : text('اعتماد المحتوى', 'Content approval'), value: isPaidOnly ? (snapshot.approvalState === 'approved' ? text('الاستراتيجية معتمدة', 'Strategy approved') : text('مطلوب قبل الإطلاق', 'Required before launch')) : (truthFlags.hasReviewedContent ? text('مراجعة موجودة', 'Review recorded') : text('مطلوبة', 'Required')), helper: isPaidOnly ? text('اعتماد الميزانية والإطلاق يظل بوابة منفصلة.', 'Budget and launch approval remain a separate gate.') : text('اعتماد المحتوى مستقل عن اعتماد الاستراتيجية.', 'Content approval is separate from strategy approval.'), tone: isPaidOnly && snapshot.approvalState === 'approved' ? 'checking' as Tone : truthFlags.hasReviewedContent ? 'positive' as Tone : 'warning' as Tone },
    { key: 'publishing', label: text('النشر', 'Publishing'), value: statusCopy(connectedState, isArabic), helper: text('الاتصالات والصلاحيات من Connections.', 'Connections and permissions come from Connections.'), tone: statusTone(connectedState) },
    { key: 'analytics', label: text('التحليلات', 'Analytics'), value: truthFlags.hasAnalyticsData ? text('بيانات حقيقية', 'Real data') : text('بانتظار البيانات', 'Awaiting data'), helper: text('لا تعلم مباشر دون بيانات منشورة.', 'No direct learning without published data.'), tone: truthFlags.hasAnalyticsData ? 'positive' as Tone : 'muted' as Tone },
  ]
  const strategyDecisionState: StrategyStep['status'] = snapshot.approvalState === 'blocked' || brandTruthBlocked
    ? 'blocked'
    : snapshot.approvalState === 'approved'
      ? 'complete'
      : snapshot.approvalState === 'review'
      ? 'review'
      : 'pending'
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
      metric: typeof brandScore === 'number' ? localized(`تغطية الهوية ${brandScore}%`, `Identity coverage ${brandScore}%`) : localized('يحتاج مراجعة', 'Needs review'),
    },
    {
      id: '02',
      label: localized('الاستراتيجية', 'Strategy'),
      helper: localized('قرار الحملة: الهدف، الجمهور، الرسائل، القنوات، والقياس.', 'The campaign decision: objective, audience, messaging, channels, and measurement.'),
      href: `/campaigns/${campaign.id}?tab=strategy`,
      status: strategyDecisionState,
      metric: localized(strategyScopeTruth, strategyScopeTruth),
    },
    {
      id: '03',
      label: isPaidOnly ? localized('حزمة التخطيط المدفوع', 'Paid planning package') : localized('المحتوى', 'Content'),
      helper: isPaidOnly ? localized('فرضيات جمهور وزوايا ونسخ وبريفات إبداعية للمراجعة فقط.', 'Audience hypotheses, angles, copy, and creative briefs for review only.') : localized('Content Hub هو مصدر الحقيقة للمنشورات والنسخ وحالة دورة الحياة.', 'Content Hub is the source of truth for posts, copy, and lifecycle.'),
      href: isPaidOnly ? `/paid-campaigns/new?sourceCampaignId=${campaign.id}` : `/campaigns/${campaign.id}/content-hub`,
      status: isPaidOnly ? (paidPackageComplete ? 'complete' : 'review') : contentStatus,
      metric: isPaidOnly ? localized(`${paidPackageCount} مخرج تخطيط`, `${paidPackageCount} planning outputs`) : localized(`${postCount} منشورات`, `${postCount} posts`),
    },
    {
      id: '04',
      label: isPaidOnly ? localized('اعتماد الحزمة والميزانية', 'Package & budget approval') : localized('الإبداع', 'Creative'),
      helper: isPaidOnly ? localized('مراجعة التتبع والبريفات والميزانية ثم موافقة إطلاق منفصلة.', 'Review tracking, briefs, and budget, followed by a separate launch approval.') : localized('تحديد احتياجات الأصول وربط الوسائط النهائية بقرار صريح.', 'Define asset needs and attach final media through an explicit decision.'),
      href: isPaidOnly ? `/paid-campaigns/new?sourceCampaignId=${campaign.id}` : `/campaigns/${campaign.id}/creative-brief`,
      status: isPaidOnly ? (snapshot.approvalState === 'approved' ? 'current' : 'review') : creativeStatus,
      metric: isPaidOnly ? localized('لا صرف قبل الموافقة', 'No spend before approval') : localized(`${creativeSummary.attachedToPost} مرتبطة · ${creativeSummary.mediaNeeded} تحتاج وسائط`, `${creativeSummary.attachedToPost} attached · ${creativeSummary.mediaNeeded} need media`),
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
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  [text('الهدف', 'Goal'), readField(campaign.goal, isArabic) || fallback],
                  [text('المدة', 'Planning horizon'), strategyDuration],
                  [text('المنصات', 'Platforms'), (campaign.platforms || []).map(platform => platformLabel(platform, isArabic)).join(' · ') || fallback],
                  [text('النسخة', 'Version'), strategyVersion],
                  [text('الحالة', 'Status'), strategyStatusLabel],
                  [text('آخر تحديث', 'Updated'), campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleDateString(isArabic ? 'ar' : 'en') : fallback],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-800" title={value}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">{text('القرار التالي', 'Next decision')}</p>
                  {nextAction.costLabel && (
                    <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                      {nextAction.costLabel}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-base font-bold leading-6 text-slate-950">{nextAction.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{nextAction.helper}</p>
                {onNextAction ? (
                  <button
                    type="button"
                    onClick={onNextAction}
                    disabled={nextActionDisabled}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {nextAction.label}
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                ) : (
                  <Link href={nextAction.href} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                    {nextAction.label}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                )}
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

      <TruthBar items={truthBarItems} isArabic={isArabic} />

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading
          eyebrow={text('الملخص التنفيذي', 'Executive summary')}
          title={text('قرار الحملة في ثماني نقاط قابلة للمراجعة', 'The campaign decision in eight reviewable points')}
          helper={text('القيم الناقصة تظل ظاهرة ولا يتم استكمالها بتخمينات. كل بطاقة تقرأ من استراتيجية الحملة أو Brand Brain.', 'Missing values stay visible instead of being filled with guesses. Each card reads from the campaign strategy or Brand Brain.')}
          icon={<Target className="h-4 w-4" />}
        />
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {executiveSummary.map(item => <Card key={getText(item.label, isArabic)} item={{ ...item, tone: isMissingValue(getText(item.value, isArabic)) ? 'warning' : item.tone }} isArabic={isArabic} />)}
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

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <details className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" open={evidenceItems.length > 0}>
          <summary className="cursor-pointer list-none">
            <SectionHeading
              eyebrow={text('الأدلة والافتراضات', 'Evidence & assumptions')}
              title={`${text('مصدر كل قرار', 'Source behind every decision')} · ${evidenceItems.length}`}
              helper={text('المعلومة المؤكدة تحمل مصدرها، والافتراض لا يتحول إلى Claim من دون إثبات.', 'Confirmed information carries its source; assumptions never become claims without proof.')}
              icon={<ShieldCheck className="h-4 w-4" />}
            />
          </summary>
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [text('موثق', 'Linked'), evidenceItems.length],
                [text('افتراضات', 'Assumptions'), snapshot.assumptions.length],
                [text('فجوات', 'Gaps'), snapshot.missingInputs.length],
                [text('مخاطر', 'Risks'), snapshot.riskFlags.length],
              ].map(([label, count]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{count}</p></div>)}
            </div>
            {evidenceItems.length > 0 ? evidenceItems.slice(0, 8).map(item => (
              <div key={`${item.statement}-${item.sourceName || 'brand'}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${item.status === 'source_linked' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {item.status === 'source_linked' ? text('مصدر مرتبط', 'Source linked') : text('من Brand Brain', 'Brand Brain entry')}
                  </span>
                  {item.sourceName && <span className="text-[11px] font-semibold text-slate-500">{item.sourceName}</span>}
                  {item.sourceLocator && <span className="text-[11px] text-slate-400">{item.sourceLocator}</span>}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.statement}</p>
              </div>
            )) : (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{text('لا توجد أدلة موثقة بعد. ستظل التوصيات افتراضات للمراجعة.', 'No linked evidence yet. Recommendations remain review-only assumptions.')}</p>
            )}
            <Link href="/brand" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900">
              {text('فتح مكتبة Brand Brain والأدلة', 'Open Brand Brain evidence library')} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </details>

        <details className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" open={missingData.length > 0}>
          <summary className="cursor-pointer list-none">
            <SectionHeading
              eyebrow={text('الجاهزية والمخاطر', 'Readiness & risks')}
              title={`${text('ما يجب حسمه قبل التنفيذ', 'What must be decided before execution')} · ${missingData.length + pendingReadinessCount + riskValues.length}`}
              helper={text('هذه ليست أخطاء صامتة؛ كل فجوة لها مالك ومسار حل واضح.', 'These are not silent errors; every gap has an owner and a clear resolution path.')}
              icon={<ListChecks className="h-4 w-4" />}
            />
          </summary>
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {missingData.map(item => <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">{item}</div>)}
              {missingData.length === 0 && <p className="text-sm text-slate-600">{text('لا توجد فجوات مدخلة معلقة.', 'No missing inputs are currently flagged.')}</p>}
            </div>
            {readinessValues.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{text('قائمة الجاهزية', 'Readiness checklist')}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {readinessValues.slice(0, 8).map((item, index) => {
                    const label = readField(recordValue(item, ['label', 'title', 'name', 'asset', 'requirement']) || item, isArabic) || `${text('متطلب', 'Requirement')} ${index + 1}`
                    const done = isReadinessItemComplete(item)
                    return <div key={`${label}-${index}`} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><span className={done ? 'text-emerald-600' : 'text-amber-600'}>{done ? '✓' : '○'}</span><span className="text-slate-700">{label}</span></div>
                  })}
                </div>
              </div>
            )}
            {riskValues.length > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-700">{text('مخاطر وافتراضات', 'Risks & assumptions')}</p>
                <ul className="mt-3 space-y-2">
                  {riskValues.slice(0, 8).map((item, index) => <li key={`${readField(item, isArabic)}-${index}`} className="flex items-start gap-2 text-xs leading-5 text-rose-950"><span className="mt-1">•</span><span>{readField(item, isArabic)}</span></li>)}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/brand" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-indigo-200 hover:text-indigo-700">{text('حل في Brand Brain', 'Resolve in Brand Brain')} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              <Link href="/connections" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-indigo-200 hover:text-indigo-700">{text('حل الاتصالات', 'Resolve connections')} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </details>
      </section>

      {showDeepReviewPanels && <>
      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading
          eyebrow={text('الجمهور والتموضع', 'Audience & positioning')}
          title={text('من نخاطب ولماذا يختارنا؟', 'Who are we speaking to and why would they choose us?')}
          helper={text('كل شريحة تحتاج مشكلة، لحظة شراء، اعتراضًا، دليلًا، منصة، وCTA؛ لا تكفي أسماء عامة للجمهور.', 'Every segment needs a problem, buying moment, objection, proof, platform, and CTA; broad audience labels are not enough.')}
          icon={<Users className="h-4 w-4" />}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Card
            item={{
              label: localized('التموضع', 'Positioning'),
              value: readField(snapshot.positioning, isArabic) || fallback,
              helper: localized('سبب ملاءمة الحل لهذا الجمهور مقارنة بالبدائل.', 'Why the solution fits this audience versus alternatives.'),
              tone: readField(snapshot.positioning, isArabic) ? 'muted' : 'warning',
            }}
            isArabic={isArabic}
          />
          <Card
            item={{
              label: localized('دليل الاختيار', 'Reason to choose'),
              value: readField(strategyRecord.differentiation || strategyRecord.valueProposition || brandRecord.differentiation, isArabic) || fallback,
              helper: localized('لا يتحول التفوق إلى Claim قبل وجود إثبات مرتبط.', 'Differentiation stays a claim until linked proof exists.'),
              tone: readField(strategyRecord.differentiation || strategyRecord.valueProposition || brandRecord.differentiation, isArabic) ? 'muted' : 'warning',
            }}
            isArabic={isArabic}
          />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {audienceSegments.length > 0 ? audienceSegments.slice(0, 6).map((segment, index) => {
            const title = readField(segment, isArabic) || text(`شريحة ${index + 1}`, `Segment ${index + 1}`)
            const segmentFields: Array<[string, unknown]> = [
              [text('المشكلة', 'Problem'), recordValue(segment, ['pain', 'problem', 'situation'])],
              [text('لحظة الشراء', 'Buying moment'), recordValue(segment, ['buyingMoment', 'purchaseMoment', 'moment'])],
              [text('الاعتراض', 'Objection'), recordValue(segment, ['objection', 'barrier'])],
              [text('الدليل المطلوب', 'Proof needed'), recordValue(segment, ['proofNeeded', 'proof'])],
              [text('الرسالة', 'Message'), recordValue(segment, ['message', 'keyMessage'])],
              [text('المنصة', 'Platform'), recordValue(segment, ['platform', 'channel'])],
              [text('CTA', 'CTA'), recordValue(segment, ['cta', 'callToAction'])],
            ]
            return (
              <details key={`${title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer list-none text-sm font-bold text-slate-900">{title}</summary>
                <div className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
                  {segmentFields.map(([label, value]) => {
                    const display = readField(value, isArabic) || fallback
                    return <div key={label}><span className="font-bold text-slate-500">{label}: </span><span className={isMissingValue(display) ? 'text-amber-700' : 'text-slate-700'}>{display}</span></div>
                  })}
                </div>
              </details>
            )
          }) : <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{text('لا توجد شرائح مفصلة بعد — مطلوب قبل إنتاج محتوى موجّه.', 'No detailed segments yet — required before producing targeted content.')}</p>}
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading
          eyebrow={text('القمع والقنوات', 'Funnel & channels')}
          title={text('دور كل مرحلة ومنصة واضح قبل التنفيذ', 'Every funnel stage and channel has a defined role')}
          helper={text('المنصة قد تكون تخطيطًا فقط أو قابلة للتنفيذ حسب حالتها الفعلية؛ لا يتم افتراض الجاهزية من وجود الاسم.', 'A channel may be planning-only or executable based on its real state; a name alone never implies readiness.')}
          icon={<Filter className="h-4 w-4" />}
        />
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{text('مراحل Funnel', 'Funnel stages')}</p>
            {funnelStageCards.map(stage => <div key={stage.key} className={`rounded-xl border p-3 ${stage.value ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'}`}><p className="text-sm font-bold text-slate-900">{stage.label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{stage.value ? readField(recordValue(stage.value, ['mindset', 'message', 'nextStep', 'successMetric', 'cta']), isArabic) || fallback : fallback}</p></div>)}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{text('استراتيجية القنوات', 'Channel strategy')}</p>
            {(channelStrategy.length > 0 ? channelStrategy : (campaign.platforms || []).map(platform => ({ platform }))).slice(0, 8).map((channel, index) => {
              const platform = recordValue(channel, ['platform', 'channel', 'name']) || channel
              const state = platformStates.find(item => normalizedPlatform(item.key) === normalizedPlatform(platform))
              return <div key={`${readField(platform, isArabic)}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-slate-900">{platformLabel(platform, isArabic)}</p><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${TONES[statusTone(state?.status || 'planning')]}`}>{state ? statusCopy(state.status, isArabic) : text('تخطيط فقط', 'Planning only')}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{readField(recordValue(channel, ['role', 'rationale', 'reason', 'contentFrequency', 'contentType', 'purpose']), isArabic) || text('الدور يحتاج تحديدًا في الاستراتيجية.', 'Channel role needs to be defined in the strategy.')}</p></div>
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading
          eyebrow={text('نظام المحتوى', 'Content system')}
          title={text('الخطة مقابل التنفيذ الفعلي', 'Plan versus actual execution')}
          helper={text('Content Hub يملك المنشورات النهائية. هذه الصفحة تعرض الفرق وتكشف تعارض المنصات بدل إعادة بناء الوظيفة.', 'Content Hub owns final posts. This desk shows the delta and surfaces platform conflicts instead of rebuilding its functionality.')}
          icon={<Layers3 className="h-4 w-4" />}
        />
        <div className={`mt-5 rounded-2xl border p-4 ${platformMismatch ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] opacity-60">{text('مطابقة المنصات', 'Platform alignment')}</p><p className="mt-1 text-sm font-bold">{platformMismatch ? text('تعارض يحتاج مراجعة', 'Conflict needs review') : text('مطابقة أو لا توجد منشورات فعلية بعد', 'Aligned or no actual posts yet')}</p></div>
            <div className="text-xs font-semibold">{text('الخطة:', 'Plan:')} {plannedPlatforms.length > 0 ? plannedPlatforms.map(platform => platformLabel(platform, isArabic)).join(' · ') : fallback}<br />{text('الفعلي:', 'Actual:')} {actualPlatforms.length > 0 ? actualPlatforms.map(platform => platformLabel(platform, isArabic)).join(' · ') : text('لا توجد منشورات', 'No posts')}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card item={{ label: localized('ركائز المحتوى', 'Content pillars'), value: compactValue(contentPillars, fallback), helper: localized('ركائز وزوايا وصيغ، لا Hooks منفصلة فقط.', 'Pillars, angles, and formats—not hooks alone.'), tone: contentPillars.length > 0 ? 'muted' : 'warning' }} isArabic={isArabic} />
          <Card item={{ label: localized('الخطة الأسبوعية', 'Weekly plan'), value: weeklyPlan.length ? `${weeklyPlan.length} ${text('وحدة تخطيط', 'planning units')}` : fallback, helper: localized('الخطة لا تعني الجدولة أو النشر.', 'A plan is not a schedule or a publish record.'), tone: weeklyPlan.length > 0 ? 'muted' : 'warning' }} isArabic={isArabic} />
          <Card item={{ label: localized('المخطط', 'Planned'), value: plannedPostCount !== null ? `${plannedPostCount} ${text('منشور متوقع', 'expected posts')}` : fallback, helper: localized('العدد لا يظهر إلا إذا حفظته الاستراتيجية صراحة.', 'The count appears only when explicitly saved by strategy.'), tone: plannedPostCount !== null ? 'muted' : 'warning' }} isArabic={isArabic} />
          <Card item={{ label: localized('الفعلي', 'Actual'), value: `${postCount} ${text('منشور', 'posts')}`, helper: localized('يأتي من Content Hub فقط.', 'Comes from Content Hub only.'), tone: postCount > 0 ? 'positive' : 'warning' }} isArabic={isArabic} />
        </div>
        {actualPosts.length > 0 && (
          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer list-none text-sm font-bold text-slate-900">{text(`عرض ${actualPosts.length} منشورات فعلية`, `Show ${actualPosts.length} actual posts`)}</summary>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {actualPosts.slice(0, 12).map(post => <div key={post.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-800">{platformLabel(post.platform, isArabic)}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${TONES[statusTone(post.status || 'draft')]}`}>{statusCopy(post.status || 'draft', isArabic)}</span></div><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{post.caption || fallback}</p></div>)}
            </div>
            <Link href={`/campaigns/${campaign.id}/content-hub`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-700">{text('فتح Content Hub كمصدر الحقيقة', 'Open Content Hub as source of truth')} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </details>
        )}
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading
          eyebrow={text('القياس', 'Measurement')}
          title={text('مؤشرات قابلة للتعريف لا وعود رقمية', 'Defined metrics, not invented promises')}
          helper={text('كل KPI يحتاج تعريفًا ومصدرًا وحدثًا وخط أساس وفترة ومسؤولًا. لا يتم إعلان ROAS أو زيادة قبل بيانات حقيقية.', 'Every KPI needs a definition, source, event, baseline, period, and owner. No ROAS or growth claim appears before real data.')}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {kpiValues.length > 0 ? kpiValues.slice(0, 9).map((metric, index) => {
            const name = readField(recordValue(metric, ['name', 'metric', 'title', 'primaryOutcome']) || metric, isArabic) || `${text('مؤشر', 'Metric')} ${index + 1}`
            const baseline = readField(recordValue(metric, ['baseline', 'baselineStatus']), isArabic) || text('خط الأساس مطلوب', 'Baseline required')
            const source = readField(recordValue(metric, ['source', 'dataSource', 'event', 'attributionRule']), isArabic) || text('مصدر البيانات مطلوب', 'Data source required')
            const target = readField(recordValue(metric, ['target', 'goal', 'threshold']), isArabic) || text('هدف مطلوب', 'Target required')
            const period = readField(recordValue(metric, ['period', 'window', 'timeframe']), isArabic) || text('فترة مطلوبة', 'Period required')
            const owner = readField(recordValue(metric, ['owner', 'responsible']), isArabic) || text('مسؤول مطلوب', 'Owner required')
            const utm = readField(recordValue(metric, ['utm', 'utmTemplate', 'tracking']), isArabic) || text('UTM مطلوب', 'UTM required')
            return <div key={`${name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-900">{name}</p><div className="mt-2 grid gap-1 text-xs leading-5 text-slate-600"><p><strong>{text('التعريف/الخط الأساس:', 'Definition/baseline:')}</strong> {baseline}</p><p><strong>{text('المصدر/الحدث:', 'Source/event:')}</strong> {source}</p><p><strong>{text('الهدف/الفترة:', 'Target/period:')}</strong> {target} · {period}</p><p><strong>{text('المسؤول/UTM:', 'Owner/UTM:')}</strong> {owner} · {utm}</p></div><span className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">{truthFlags.hasAnalyticsData ? text('بيانات وصلت', 'Data available') : text('فرضية حتى تصل البيانات', 'Hypothesis until data arrives')}</span></div>
          }) : <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{text('لا توجد مؤشرات قابلة للقياس بعد — أضف تعريف النجاح وخط الأساس.', 'No measurable KPIs yet — add a success definition and baseline.')}</p>}
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading
          eyebrow={text('تسليم القرار', 'Decision handoff')}
          title={text('كل خطوة لها صفحة مالكة واحدة', 'Every next step has one owning surface')}
          helper={text('هذه روابط توجيه فقط. لا تعيد هذه الصفحة بناء المحتوى أو الموافقات أو النشر، ولا تفتح تنفيذًا قبل بوابته.', 'These are routing links only. This desk does not rebuild content, approvals, or publishing, and never bypasses their gates.')}
          icon={<ExternalLink className="h-4 w-4" />}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {handoffLinks.map(({ key, ...link }) => <HandoffLink key={key} {...link} isArabic={isArabic} />)}
        </div>
      </section>
      </>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <button type="button" onClick={onReadDocument} className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900">
          <FileCheck2 className="h-3.5 w-3.5" />
          {text('افتح الوثيقة الكاملة للجمهور والقنوات والقياس والمخاطر', 'Open the full document for audience, channels, measurement, and risk detail')}
        </button>
        <span className="font-bold text-slate-800">{campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleDateString(isArabic ? 'ar' : 'en') : ''}</span>
      </div>
    </div>
  )
}
