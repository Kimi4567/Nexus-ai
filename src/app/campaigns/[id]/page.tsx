'use client'

import { useEffect, useState, useCallback, useRef, Suspense, type ReactNode } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot, Clock3, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'
import VisualGenerator from '@/components/VisualGenerator'
import BrandDNABadge, { type BrandDNAData } from '@/components/BrandDNABadge'
import CampaignProofOfWork from '@/components/campaign/CampaignProofOfWork'
import StrategyDecisionDesk from '@/components/campaign/StrategyDecisionDesk'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import UpgradeModal from '@/components/UpgradeModal'
import CreditConfirmModal from '@/components/CreditConfirmModal'
import { useBillingStatus } from '@/lib/useBillingStatus'
import { getCreditActionTruth } from '@/lib/creditActionTruth'
import PlatformNativeCard from '@/components/PlatformNativeCard'
import {
  deriveCampaignOperatingState,
  type CampaignOperatingInput,
  type CampaignOperatingStage,
} from '@/lib/campaignOperatingState'
import {
  deriveCampaignCommandFlow,
  type CampaignCommandFlowStepId,
  type CampaignCommandFlowStepStatus,
} from '@/lib/campaignCommandFlow'
import { derivePublishTabReadinessSummary } from '@/lib/publishReadiness'
import {
  deriveEngineRebuildAvailability,
  ENGINE_REBUILD_CREDIT_COST,
} from '@/lib/campaignDangerActions'
import {
  campaignRoomTabIndexFromQuery,
  campaignRoomTabKeyFromIndex,
} from '@/lib/campaignRoomTabs'
import { resolveStrategyScope } from '@/lib/strategy/strategyScope'
import { normalizeStrategyEvidenceLedger } from '@/lib/strategy/strategyEvidenceLedger'
import { summarizeCreativeRequirements } from '@/lib/creativeRequirements'
import { formatStrategyPlatformLabel, guardStrategyOutputContract } from '@/lib/ai/strategyOutputContractGuard'
import { guardStrategyKpis } from '@/lib/ai/strategyKpiGuard'
import { guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { deriveStrategyRoomStateCopy } from '@/lib/strategyRoomStateCopy'
import { derivePlatformReadiness, type PlatformState } from '@/lib/platformReadiness'
import { deriveStrategyExecutionBridge, type StrategyExecutionRequirement } from '@/lib/strategyExecutionBridge'
import { deriveStrategyFulfillmentSummary, type StrategyFulfillmentTone } from '@/lib/strategyFulfillment'
import { creditOperationScope, fetchCreditOperation } from '@/lib/creditOperationClient'
import { buildStrategySnapshot } from '@/lib/strategy/strategySnapshot'
import type { StrategyApprovalState } from '@/lib/strategyApproval'

interface Activity {
  id: string
  type: string
  description: string
  createdAt: string
}

interface Campaign {
  id: string
  name: string
  description?: string
  goal: string
  audience?: string
  tone: string
  platforms: string[]
  status: string
  favorite: boolean
  thumbnail?: string
  aiOutput?: any
  lastViewedAt?: string
  createdAt: string
  updatedAt: string
  activities: Activity[]
  autopilotEnabled?: boolean
  autopilotActivatedAt?: string
  socialPostCount?: number
}

interface AutopilotPost {
  id: string
  platform: string
  caption: string
  imageUrl?: string | null
  imagePrompt?: string | null
  weekNumber?: number | null
  scheduledAt?: string | null
  status: string
  publishMode?: string | null
  manuallyPublishedAt?: string | null
  pageName?: string | null
}

type CampaignOperatingPost = NonNullable<CampaignOperatingInput['posts']>[number]

const ACTIVITY_ICONS: Record<string, string> = {
  created: '✨', generated: '🤖', viewed: '👁', regenerated: '♻️',
  exported: '📤', duplicated: '📋', archived: '📦', favorited: '⭐',
  updated: '✏️', engine_run: '⚙️',
}

const PLATFORM_ICONS: Record<string, string> = {
  META: '👥', FACEBOOK: '👥', INSTAGRAM: '📸', THREADS: '@',
  TIKTOK: '🎵', LINKEDIN: '💼', X: '𝕏', TWITTER: '𝕏',
  YOUTUBE: '▶️', YOUTUBE_SHORTS: '▶️', PINTEREST: '📌',
  SNAPCHAT: '👻', WEBSITE: '🌐',
}

const PLATFORM_COLORS: Record<string, string> = {
  META: '#1877F2', FACEBOOK: '#1877F2', INSTAGRAM: '#C13584',
  THREADS: '#111111', TIKTOK: '#010101', LINKEDIN: '#0A66C2',
  X: '#111111', TWITTER: '#111111', YOUTUBE: '#FF0000',
  YOUTUBE_SHORTS: '#FF0000', PINTEREST: '#E60023', SNAPCHAT: '#EAB308',
}

const CONTENT_PLAN_CREDIT_COST = getCreditActionTruth({
  action: 'CONTENT_PLAN_GENERATION',
  creditsRemaining: 0,
}).cost

function formatCampaignToneLabel(tone: string | null | undefined): string {
  if (!tone) return ''
  return tone
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatCampaignToneForLocale(tone: string | null | undefined, locale: string): string {
  const normalized = formatCampaignToneLabel(tone)
  if (!normalized) return ''
  if (locale !== 'ar') return normalized
  const arToneLabels: Record<string, string> = {
    Modern: 'حديثة',
    Professional: 'احترافية',
    Friendly: 'ودودة',
    Bold: 'جريئة',
    Luxury: 'فاخرة',
    Trustworthy: 'موثوقة',
    Educational: 'تعليمية',
    Conversational: 'حوارية',
  }
  return arToneLabels[normalized] || normalized
}

const STRATEGY_DISPLAY_VALUE_TRANSLATIONS: Record<string, { en: string; ar: string }> = {
  awareness: { en: 'Awareness', ar: 'الوعي' },
  consideration: { en: 'Consideration', ar: 'المقارنة والتفكير' },
  conversion: { en: 'Conversion', ar: 'التحويل' },
  retention: { en: 'Retention', ar: 'الاحتفاظ' },
  loyalty: { en: 'Loyalty', ar: 'الولاء' },
  advocacy: { en: 'Advocacy', ar: 'التوصية' },
  tofu: { en: 'Top of funnel', ar: 'أعلى القمع' },
  mofu: { en: 'Middle of funnel', ar: 'منتصف القمع' },
  bofu: { en: 'Bottom of funnel', ar: 'أسفل القمع' },
  lead: { en: 'Lead', ar: 'عميل محتمل' },
  leads: { en: 'Leads', ar: 'عملاء محتملون' },
  organic: { en: 'Organic', ar: 'عضوي' },
  paid: { en: 'Paid', ar: 'مدفوع' },
  full: { en: 'Full', ar: 'شامل' },
  carousel: { en: 'Carousel', ar: 'كاروسيل' },
  reel: { en: 'Reel', ar: 'ريل' },
  reels: { en: 'Reels', ar: 'ريلز' },
  story: { en: 'Story', ar: 'قصة' },
  stories: { en: 'Stories', ar: 'قصص' },
  staticpost: { en: 'Static post', ar: 'منشور ثابت' },
  socialpost: { en: 'Social post', ar: 'منشور اجتماعي' },
  shortformvideo: { en: 'Short-form video', ar: 'فيديو قصير' },
  explainervideo: { en: 'Explainer video', ar: 'فيديو توضيحي' },
  educationalpost: { en: 'Educational post', ar: 'منشور تعليمي' },
  casestudy: { en: 'Case study', ar: 'دراسة حالة' },
  checklist: { en: 'Checklist', ar: 'قائمة تحقق' },
  guide: { en: 'Guide', ar: 'دليل' },
  demo: { en: 'Demo', ar: 'عرض توضيحي' },
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  ready: { en: 'Ready', ar: 'جاهز' },
  checking: { en: 'Checking', ar: 'قيد الفحص' },
  blocked: { en: 'Blocked', ar: 'محجوب' },
  review: { en: 'Review', ar: 'مراجعة' },
}

function strategyDisplayValueKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_/-]+/g, '')
}

function formatStrategyDisplayText(value: string, locale: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  const normalized = trimmed.replace(/\s+/g, ' ')
  const lower = normalized.toLowerCase()
  const translated = STRATEGY_DISPLAY_VALUE_TRANSLATIONS[strategyDisplayValueKey(normalized)]
  if (translated) return locale === 'ar' ? translated.ar : translated.en

  if (lower === 'planning/review' || lower === 'planning/review stage') {
    return locale === 'ar' ? 'مرحلة التخطيط والمراجعة' : 'Planning and review stage'
  }
  if (lower === 'business already operating') {
    return locale === 'ar' ? 'النشاط التجاري يعمل حالياً' : 'Business already operating'
  }
  if (lower === 'not enough data') {
    return locale === 'ar' ? 'بيانات غير كافية بعد' : 'Not enough data yet'
  }
  if (lower.startsWith('not enough data:')) {
    return locale === 'ar'
      ? `بيانات غير كافية بعد: ${normalized.slice(normalized.indexOf(':') + 1).trim()}`
      : `Not enough data yet: ${normalized.slice(normalized.indexOf(':') + 1).trim()}`
  }

  return value
}

function resolveStrategyDocumentLocale(strategyLanguage: string | null | undefined, fallbackLocale: string): 'ar' | 'en' {
  const normalized = String(strategyLanguage || fallbackLocale || '').trim().toLowerCase()
  if (normalized.startsWith('ar') || normalized.includes('arabic') || normalized.includes('عربي')) return 'ar'
  return fallbackLocale === 'ar' ? 'ar' : 'en'
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
    >
      {copied ? '✓' : label}
    </button>
  )
}

function StrategyDocSection({
  id,
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
          )}
          <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-950">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function StrategyDocCard({
  label,
  value,
  locale = 'en',
  tone = 'default',
}: {
  label: string
  value?: ReactNode
  locale?: string
  tone?: 'default' | 'muted' | 'warning' | 'positive'
}) {
  if (!value) return null
  const effectiveLocale = locale !== 'en' || /[\u0600-\u06FF]/.test(label) ? 'ar' : locale
  const displayValue = typeof value === 'string' ? formatStrategyDisplayText(value, effectiveLocale) : value
  const toneClass = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-950'
    : tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : tone === 'muted'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-slate-200 bg-slate-50 text-slate-800'
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="mt-1 text-sm leading-6">{displayValue}</div>
    </div>
  )
}

function StrategyDocList({
  items,
  locale = 'en',
  ordered = false,
}: {
  items: ReactNode[]
  locale?: string
  ordered?: boolean
}) {
  const clean = items.filter(Boolean)
  if (!clean.length) return null
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className="space-y-2">
      {clean.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
            {ordered ? i + 1 : '•'}
          </span>
          <span>{typeof item === 'string' ? formatStrategyDisplayText(item, locale) : item}</span>
        </li>
      ))}
    </Tag>
  )
}

function ContentPlanApprovalDialog({
  open,
  locale,
  strategyAlreadyApproved,
  launchState,
  launchError,
  onConfirm,
  onClose,
}: {
  open: boolean
  locale: string
  strategyAlreadyApproved: boolean
  launchState: 'idle' | 'approving' | 'generating' | 'done'
  launchError: string
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null
  const isArabic = locale === 'ar'
  const isWorking = launchState === 'approving' || launchState === 'generating'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="content-plan-approval-title">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              {isArabic ? 'بوابة الانتقال إلى المحتوى' : 'Content workflow gate'}
            </p>
            <h3 id="content-plan-approval-title" className="mt-1 text-lg font-bold text-slate-950">
              {isWorking
                ? (isArabic ? 'يجري إعداد خطة المحتوى' : 'Preparing the content plan')
                : strategyAlreadyApproved
                  ? (isArabic ? 'إنشاء خطة محتوى من الاستراتيجية المعتمدة؟' : 'Build a content plan from the approved strategy?')
                  : (isArabic ? 'اعتماد الاستراتيجية وإنشاء خطة المحتوى؟' : 'Approve strategy and build the content plan?')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isWorking}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={isArabic ? 'إغلاق' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!isWorking ? (
            <>
              <p className="text-sm leading-6 text-slate-600">
                {isArabic
                  ? strategyAlreadyApproved
                    ? `الاستراتيجية معتمدة بالفعل. سيتحقق NEXUS من القرار المحفوظ، ثم يخصم ${CONTENT_PLAN_CREDIT_COST} كريديت لإنشاء مسودات Content Hub للمراجعة. لا يتم نشر أو جدولة أو تشغيل إعلان.`
                    : `سيحفظ NEXUS اعتماد وثيقة الاستراتيجية كسير عمل، ثم يخصم ${CONTENT_PLAN_CREDIT_COST} كريديت لإنشاء مسودات Content Hub للمراجعة. لا يتم نشر أو جدولة أو تشغيل إعلان.`
                  : strategyAlreadyApproved
                    ? `The strategy is already approved. NEXUS will verify the saved decision, then spend ${CONTENT_PLAN_CREDIT_COST} credits to create Content Hub drafts for review. Nothing is published, scheduled, or launched.`
                    : `NEXUS will save workflow approval for the strategy, then spend ${CONTENT_PLAN_CREDIT_COST} credits to create Content Hub drafts for review. Nothing is published, scheduled, or launched.`}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  isArabic ? `التكلفة: ${CONTENT_PLAN_CREDIT_COST} كريديت` : `Cost: ${CONTENT_PLAN_CREDIT_COST} credits`,
                  isArabic ? 'الناتج: مسودات محتوى' : 'Output: content drafts',
                  isArabic ? 'التنفيذ الخارجي: لا شيء' : 'External execution: none',
                ].map(item => (
                  <span key={item} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-[11px] font-semibold text-emerald-800">
                    {item}
                  </span>
                ))}
              </div>
              {launchError && (
                <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{launchError}</p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: strategyAlreadyApproved
                    ? (isArabic ? 'التحقق من اعتماد الاستراتيجية المحفوظ' : 'Verify saved strategy approval')
                    : (isArabic ? 'حفظ اعتماد سير عمل الاستراتيجية' : 'Save strategy workflow approval'),
                  state: launchState === 'approving' ? 'active' : 'done',
                },
                {
                  label: isArabic ? 'إنشاء مسودات Content Hub' : 'Generate Content Hub drafts',
                  state: launchState === 'generating' ? 'active' : 'pending',
                },
                {
                  label: isArabic ? 'فتح مساحة مراجعة المحتوى' : 'Open the content review workspace',
                  state: 'pending',
                },
              ].map(step => (
                <div key={step.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  {step.state === 'active' ? (
                    <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  ) : step.state === 'done' ? (
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-xs font-bold text-emerald-600">✓</span>
                  ) : (
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-xs text-slate-400">○</span>
                  )}
                  <p className={`text-sm ${step.state === 'active' ? 'font-semibold text-emerald-700' : 'text-slate-600'}`}>{step.label}</p>
                </div>
              ))}
              <p className="text-xs leading-5 text-slate-500">
                {isArabic ? 'قد يستغرق إنشاء المسودات نحو 20–30 ثانية.' : 'Draft generation may take about 20–30 seconds.'}
              </p>
            </div>
          )}
        </div>

        {!isWorking && (
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="button" onClick={onConfirm} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700">
              {strategyAlreadyApproved
                ? (isArabic ? `إنشاء خطة المحتوى — ${CONTENT_PLAN_CREDIT_COST} كريديت` : `Build content plan — ${CONTENT_PLAN_CREDIT_COST} credits`)
                : (isArabic ? `تأكيد وإنشاء الخطة — ${CONTENT_PLAN_CREDIT_COST} كريديت` : `Confirm and build plan — ${CONTENT_PLAN_CREDIT_COST} credits`)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function sanitizeStrategyLimitText(text: string): string {
  if (!text) return text
  return text
    .replace(/\bAssumes?\s+(?:\$|USD\s*)[\d,]+(?:\s*USD)?\s+budget\s+is\s+available\s+for\s+allocation\.?/gi, 'Paid budget needs user confirmation before allocation.')
    .replace(/\bAllocate\s+(?:\$|USD\s*)[\d,]+(?:\s*USD)?\s+(?:to|for)\s+paid\s+ads\.?/gi, 'Confirm the paid budget before allocating paid spend.')
    .replace(/\b(?:\$|USD\s*)[\d,]+(?:\s*USD)?\s+budget\s+is\s+available\b/gi, 'paid budget needs user confirmation')
}

function uniqueCleanList(items: string[]): string[] {
  const seen = new Set<string>()
  return items
    .map(item => item?.trim())
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// Suspense wrapper required: useSearchParams() is used inside.
export default function CampaignDetailPage() {
  return (
    <Suspense fallback={null}>
      <CampaignDetailPageInner />
    </Suspense>
  )
}

function CampaignDetailPageInner() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const campaignId = params?.id as string
  const isGenerating = searchParams?.get('generating') === 'true'
  // Capture ?new=1 immediately — router.replace() will strip it later
  const isNewCampaign = searchParams?.get('new') === '1'
  // Capture ?from=brief — show a contextual banner
  const fromBrief = searchParams?.get('from') === 'brief'
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { t, locale } = useI18n()
  const cdT = t('campaignDetail') as Record<string, string>
  const { isPaid, status: billingStatus, invalidate: refreshBillingStatus } = useBillingStatus()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [campaignPosts, setCampaignPosts] = useState<CampaignOperatingPost[]>([])
  const [operatingSnapshotsLoaded, setOperatingSnapshotsLoaded] = useState(false)
  const [strategyPlatformStates, setStrategyPlatformStates] = useState<PlatformState[]>([])
  const [strategyPlatformReadinessLoaded, setStrategyPlatformReadinessLoaded] = useState(false)
  const [pendingLearningCount, setPendingLearningCount] = useState(0)
  const [strategyApprovalTruth, setStrategyApprovalTruth] = useState<StrategyApprovalState>('draft')
  const [fetching, setFetching] = useState(true)
  const [activeTab, setActiveTab] = useState(() => campaignRoomTabIndexFromQuery(searchParams?.get('tab')))
  const pendingTabKeyRef = useRef<string | null>(null)
  const [brandScore, setBrandScore] = useState<number | null>(null)
  const [brandDNA, setBrandDNA] = useState<BrandDNAData | null>(null)
  const [brandNoticeDismissed, setBrandNoticeDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(isGenerating)
  const [generateError, setGenerateError] = useState('')
  const [engineRunning, setEngineRunning] = useState(false)
  const [engineError, setEngineError] = useState('')
  const [approvalState, setApprovalState] = useState<'idle' | 'confirming' | 'approving' | 'done'>('idle')
  const [launchState, setLaunchState] = useState<'idle' | 'approving' | 'generating' | 'done'>('idle')
  const [launchError, setLaunchError] = useState('')
  const [sentinelState, setSentinelState] = useState<'idle' | 'reviewing' | 'done'>('idle')
  const [sentinelError, setSentinelError] = useState('')
  const [showSentinelConfirm, setShowSentinelConfirm] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [briefBannerDismissed, setBriefBannerDismissed] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<'no_credits' | 'first_campaign'>('no_credits')
  // Autopilot
  const [autopilotQueue, setAutopilotQueue] = useState<AutopilotPost[]>([])
  const [autopilotActivating, setAutopilotActivating] = useState(false)
  const [autopilotError, setAutopilotError] = useState('')
  const [autopilotPausing, setAutopilotPausing] = useState(false)
  const [showAutopilotConfirm, setShowAutopilotConfirm] = useState(false)
  const [autopilotConsentAcknowledged, setAutopilotConsentAcknowledged] = useState(false)

  // VEX Ad Setup expand/collapse
  const [adSetupOpen, setAdSetupOpen] = useState(false)

  // Performance / ROI Dashboard (Tab 6)
  const [perfData, setPerfData] = useState<any>(null)
  const [perfLoading, setPerfLoading] = useState(false)

  // Sprint H — Push to Calendar
  const [calendarPushState, setCalendarPushState] = useState<'idle' | 'pushing' | 'done' | 'already'>('idle')
  const [calendarPushCount, setCalendarPushCount] = useState(0)
  const [calendarPushError, setCalendarPushError] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  // UX: header overflow menu
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [showStrategyDocument, setShowStrategyDocument] = useState(false)
  const [campaignAction, setCampaignAction] = useState<'duplicate' | 'archive' | 'restore' | null>(null)
  const [campaignActionBusy, setCampaignActionBusy] = useState(false)
  const [campaignActionError, setCampaignActionError] = useState('')
  const [showEngineRebuildModal, setShowEngineRebuildModal] = useState(false)
  const [engineRebuildAcknowledged, setEngineRebuildAcknowledged] = useState(false)

  // Keep legacy indices stable for old deep links, but expose only the four
  // decision workspaces a user needs. Content inputs and execution rhythm are
  // sections of the strategy, while Autopilot is a publishing mode.
  const AGENT_TABS = [
    { name: cdT?.agentStrategyName || 'Strategist', icon: '🧠', title: cdT?.agentStrategyTitle, color: 'text-indigo-400',  border: 'border-indigo-500/30', bg: 'bg-indigo-500/5',  label: cdT?.tabStrategy },
    {
      hidden: true,
      name: locale === 'ar' ? 'مدخلات تخطيط المحتوى' : 'Content planning inputs',
      icon: '✍️',
      title: locale === 'ar' ? 'هوكس وزوايا للمراجعة' : 'Hooks and angles for review',
      color: 'text-pink-500',
      border: 'border-pink-200',
      bg: 'bg-pink-50',
      label: cdT?.tabContent,
    },
    {
      hidden: true,
      name: locale === 'ar' ? 'إيقاع التنفيذ' : 'Execution rhythm',
      icon: '⚡',
      title: locale === 'ar' ? 'خطة مراجعة — ليست جدولة' : 'Planned, not scheduled',
      color: 'text-amber-600',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      label: cdT?.tabCalendar,
    },
    { name: '',                                      icon: '🎨', title: '',                       color: 'text-purple-400',  border: 'border-purple-500/30', bg: 'bg-purple-500/5',  label: locale === 'ar' ? 'المحتوى والإبداع' : 'Content & creative' },
    { name: '',                                      icon: '📤', title: '',                       color: 'text-green-400',   border: 'border-green-500/30',  bg: 'bg-green-500/5',   label: locale === 'ar' ? 'النشر والأتمتة' : 'Publishing & automation' },
    { name: '', hidden: true,                        icon: '🤖', title: '',                       color: 'text-violet-400',  border: 'border-violet-500/30', bg: 'bg-violet-500/5',  label: locale === 'ar' ? 'إعدادات الأتمتة' : 'Automation settings' },
    { name: '', hidden: false,                       icon: '📊', title: '',                       color: 'text-cyan-400',    border: 'border-cyan-500/30',   bg: 'bg-cyan-500/5',    label: locale === 'ar' ? 'الأداء' : 'Performance' },
  ]

  // Locale-aware timeAgo
  const timeAgo = useCallback((date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return cdT?.timeNow
    if (seconds < 3600) return cdT?.timeMinutesAgo?.replace('{n}', String(Math.floor(seconds / 60)))
    if (seconds < 86400) return cdT?.timeHoursAgo?.replace('{n}', String(Math.floor(seconds / 3600)))
    return new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')
  }, [cdT, locale])
  const scrollToStrategySection = useCallback((sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (!section) return
    const stickyNav = document.querySelector('[data-strategy-operating-nav]')
    const stickyOffset = stickyNav instanceof HTMLElement
      ? stickyNav.getBoundingClientRect().height + 24
      : 160
    const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - stickyOffset)
    window.scrollTo({ top, behavior: 'smooth' })
    window.history.replaceState(null, '', `#${sectionId}`)
  }, [])

  function AgentBanner({ idx }: { idx: number }) {
    const agent = AGENT_TABS[idx]
    if (!agent.name) return null
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${agent.border} ${agent.bg} mb-5`}>
        <span className="text-lg">{agent.icon}</span>
        <div>
          <span className={`font-bold text-sm ${agent.color}`}>{agent.name}</span>
          {agent.title && <span className="text-gray-500 text-xs ml-2">· {agent.title}</span>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${agent.color.replace('text-', 'bg-')} animate-pulse`} />
          <span className="text-xs text-gray-600">{cdT?.agentCompletedSection}</span>
        </div>
      </div>
    )
  }

  useEffect(() => {
    const nextKey = campaignRoomTabKeyFromIndex(campaignRoomTabIndexFromQuery(searchParams?.get('tab')))
    // Keep the selected workspace stable while router.replace settles. This
    // prevents a slow query update from visually jumping back to the previous
    // tab after the user has already chosen the next one.
    if (pendingTabKeyRef.current && pendingTabKeyRef.current !== nextKey) return
    pendingTabKeyRef.current = null
    setActiveTab(campaignRoomTabIndexFromQuery(searchParams?.get('tab')))
  }, [searchParams])

  const handleCampaignRoomTabClick = useCallback((index: number) => {
    const tabKey = campaignRoomTabKeyFromIndex(index)
    pendingTabKeyRef.current = tabKey
    setActiveTab(index)
    // Build from the browser's current URL instead of the captured searchParams
    // object. Rapid tab changes can otherwise reuse a stale query and leave the
    // visible workspace one step ahead of the deep link after a refresh.
    const nextParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : searchParams?.toString())
    nextParams.set('tab', tabKey)
    const query = nextParams.toString()
    router.replace(`/campaigns/${campaignId}${query ? `?${query}` : ''}`, { scroll: false })
  }, [campaignId, router, searchParams])

  const fetchCampaign = useCallback(async () => {
    const token = authHeader()
    if (!token) return null
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } })
      const d = await res.json()
      if (d.campaign) {
        setCampaign(d.campaign)
        // Restore sentinel state from stored review so we never show stale errors
        // when the user navigates back to a campaign that already passed
        const storedReview = (d.campaign?.aiOutput as any)?.sentinelReview
        if (storedReview?.status === 'passed') setSentinelState('done')

        // Fix 4: Background generation persistence
        // If _generatingAt is set and < 5 minutes old, the engine is still running.
        // Restore the generating UI and start polling so the user sees progress even
        // after navigating away and coming back.
        const generatingAt = (d.campaign?.aiOutput as any)?._generatingAt
        if (generatingAt && !d.campaign?.aiOutput?.strategy) {
          const ageMs = Date.now() - new Date(generatingAt).getTime()
          if (ageMs < 5 * 60 * 1000) { // < 5 minutes = still in-flight
            setGenerating(true)
          }
        }

        return d.campaign
      }
    } catch {}
    return null
  }, [campaignId, authHeader])

  const fetchOperatingSnapshots = useCallback(async () => {
    const token = authHeader()
    if (!token) {
      setOperatingSnapshotsLoaded(false)
      return
    }

    setOperatingSnapshotsLoaded(false)
    let loadedPosts = false
    try {
      const [contentPlanRes, proposalsRes, strategyApprovalRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/content-plan`, { headers: { Authorization: token } }),
        fetch('/api/brain/proposals?status=pending', { headers: { Authorization: token } }),
        fetch(`/api/campaigns/${campaignId}/strategy-approval`, { headers: { Authorization: token } }),
      ])

      if (contentPlanRes.ok) {
        const data = await contentPlanRes.json().catch(() => ({}))
        setCampaignPosts(Array.isArray(data.posts) ? data.posts : [])
        loadedPosts = true
      }

      if (proposalsRes.ok) {
        const data = await proposalsRes.json().catch(() => ({}))
        const proposals = Array.isArray(data.proposals) ? data.proposals : []
        setPendingLearningCount(proposals.filter((proposal: any) => proposal?.campaignId === campaignId).length)
      }

      if (strategyApprovalRes.ok) {
        const data = await strategyApprovalRes.json().catch(() => ({}))
        const state = data?.approval?.state
        if (['draft', 'blocked', 'ready_for_review', 'approved', 'revoked'].includes(state)) {
          setStrategyApprovalTruth(state as StrategyApprovalState)
        }
      }
    } catch {
      // Operating state is display-only. If these optional reads fail, keep the
      // campaign room usable and let the helper fall back conservatively.
    } finally {
      setOperatingSnapshotsLoaded(loadedPosts)
    }
  }, [authHeader, campaignId])

  const fetchStrategyPlatformReadiness = useCallback(async () => {
    const token = authHeader()
    if (!token) {
      setStrategyPlatformReadinessLoaded(false)
      setStrategyPlatformStates([])
      return
    }

    setStrategyPlatformReadinessLoaded(false)
    try {
      const [socialRes, adRes] = await Promise.all([
        fetch('/api/social/accounts', { headers: { Authorization: token } }),
        fetch('/api/ad-accounts', { headers: { Authorization: token } }),
      ])
      const [socialData, adData] = await Promise.all([
        socialRes.ok ? socialRes.json().catch(() => ({})) : Promise.resolve({}),
        adRes.ok ? adRes.json().catch(() => ({})) : Promise.resolve({}),
      ])
      const socialAccounts = Array.isArray(socialData?.accounts) ? socialData.accounts : []
      const adAccounts = Array.isArray(adData?.accounts) ? adData.accounts : []
      setStrategyPlatformStates(derivePlatformReadiness(socialAccounts, adAccounts))
    } catch {
      // Read-only bridge: on read failure, keep the UI conservative and avoid
      // implying execution readiness from campaign state alone.
      setStrategyPlatformStates([])
    } finally {
      setStrategyPlatformReadinessLoaded(true)
    }
  }, [authHeader])

  useEffect(() => {
    if (!loading && !isAuthenticated) { router.push('/auth/login'); return }
    if (!isAuthenticated) return
    fetchCampaign().finally(() => setFetching(false))
    fetchOperatingSnapshots()
    fetchStrategyPlatformReadiness()
    // Fetch brand readiness for the quality notice
    const token = authHeader()
    if (token) {
      fetch('/api/brand', { headers: { Authorization: token } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setBrandScore(
              data.contract?.readiness?.brandCompleteness?.score
                ?? getBrandBrainReadiness(data.brandProfile).score,
            )
            if (data.brandProfile) setBrandDNA(data.brandProfile as BrandDNAData)
          }
        })
        .catch(() => {})
    }
  }, [loading, isAuthenticated, fetchCampaign, fetchOperatingSnapshots, fetchStrategyPlatformReadiness, router, authHeader])

  // Publishing owns automation, so load its queue from either the unified
  // publishing workspace or the legacy automation deep link.
  useEffect(() => {
    if ((activeTab !== 4 && activeTab !== 5) || !isAuthenticated) return
    const token = authHeader()
    if (!token) return
    fetch(`/api/autopilot/queue?campaignId=${campaignId}`, { headers: { Authorization: token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.posts) setAutopilotQueue(d.posts) })
      .catch(() => {})
  }, [activeTab, isAuthenticated, campaignId, authHeader])

  // Load performance data when tab 6 is active
  useEffect(() => {
    if (activeTab !== 6 || !isAuthenticated || perfData) return
    const token = authHeader()
    if (!token) return
    setPerfLoading(true)
    fetch(`/api/campaigns/${campaignId}/performance`, { headers: { Authorization: token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPerfData(d) })
      .catch(() => {})
      .finally(() => setPerfLoading(false))
  }, [activeTab, isAuthenticated, campaignId, authHeader, perfData])

  // Auto-trigger generation for new campaigns that have no aiOutput yet
  const autoTriggeredRef = useRef(false)
  useEffect(() => {
    if (!isNewCampaign) return
    if (!campaign) return                   // wait for campaign to load
    if (campaign.aiOutput) return           // already has content — nothing to do
    if (generating) return                  // already in progress
    if (autoTriggeredRef.current) return    // already triggered once this mount
    if (loading) return                     // wait for auth to settle before checking token
    if (!authHeader()) return               // no token yet — will re-run when auth resolves
    autoTriggeredRef.current = true
    handleRunEngine()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, isNewCampaign, generating, engineRunning, loading])

  // Poll for AI output when generating=true
  // Stops when strategy is populated OR _generatingAt is cleared (done / error) OR max attempts
  useEffect(() => {
    if (!generating || !isAuthenticated) return
    let attempts = 0
    const MAX_ATTEMPTS = 36  // 36 × 5s = 3 minutes max

    pollRef.current = setInterval(async () => {
      attempts++
      const c = await fetchCampaign()
      const strategyDone = !!(c?.aiOutput as any)?.strategy
      const flagGone     = !(c?.aiOutput as any)?._generatingAt
      const timedOut     = attempts >= MAX_ATTEMPTS

      if (strategyDone || flagGone || timedOut) {
        setGenerating(false)
        if (pollRef.current) clearInterval(pollRef.current)
        // If strategy was generated (not just flag cleared by error), navigate to refresh view
        if (strategyDone) {
          router.replace(`/campaigns/${campaignId}`)
        }
      }
    }, 5000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [generating, isAuthenticated, campaignId, fetchCampaign, router])

  // Y3 — post-campaign upgrade nudge
  // Show after generation completes (or immediately for draft) if user is on free plan
  useEffect(() => {
    if (!isNewCampaign) return
    // Wait for billing status to resolve (avoid showing while loading)
    if (billingStatus === null) return
    if (isPaid) return
    // If still generating: the poll effect will set generating=false, then this runs again
    if (generating) return
    const t = setTimeout(() => {
      setUpgradeReason('first_campaign')
      setShowUpgrade(true)
    }, 3000)
    return () => clearTimeout(t)
  }, [isNewCampaign, isPaid, billingStatus, generating])

  useEffect(() => {
    if (loading || fetching || !campaign?.aiOutput || activeTab !== 0) return
    const sectionId = window.location.hash.replace('#', '')
    if (!sectionId.startsWith('strategy-')) return
    const timer = window.setTimeout(() => scrollToStrategySection(sectionId), 120)
    return () => window.clearTimeout(timer)
  }, [activeTab, campaign?.aiOutput, fetching, loading, scrollToStrategySection])

  const updateCampaign = async (data: Partial<Campaign>): Promise<boolean> => {
    const token = authHeader()
    if (!token || !campaign) return false
    setSaving(true)
    setCampaignActionError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(data),
      })
      const d = await res.json()
      if (!res.ok || !d.campaign) {
        setCampaignActionError(d.message || d.error || (locale === 'ar' ? 'تعذر تحديث الحملة.' : 'Could not update the campaign.'))
        return false
      }
      setCampaign(prev => prev ? { ...prev, ...d.campaign } : prev)
      return true
    } catch {
      setCampaignActionError(locale === 'ar' ? 'تعذر الاتصال. لم تتغير الحملة.' : 'Could not connect. The campaign was not changed.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleRunEngine = async (
    force = false,
    confirmation?: {
      explicitEngineRebuildConfirmed: true
      acknowledgedCreditCost: number
      acknowledgedOutputOverwrite: true
    },
  ) => {
    const token = authHeader()
    if (!token || !campaignId || engineRunning) return
    setEngineRunning(true)
    setGenerating(true)
    setEngineError('')
    setGenerateError('')
    setSentinelError('')
    setCalendarPushError('')
    try {
      const res = await fetchCreditOperation(creditOperationScope('campaign:engine', JSON.stringify({ campaignId, force, locale })), `/api/campaigns/${campaignId}/engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ language: locale, force, ...(force ? confirmation : {}) }),
      })
      const d = await res.json()
      if (!res.ok) {
        if (res.status === 402 || d.error === 'INSUFFICIENT_CREDITS') {
          setUpgradeReason('no_credits')
          setShowUpgrade(true)
        }
        setEngineError(d.message || d.error || (locale === 'ar' ? 'فشل تشغيل NEXUS Engine' : 'NEXUS Engine failed'))
        return
      }
      if (d.campaign) {
        setCampaign(d.campaign)
        if (force) {
          setShowEngineRebuildModal(false)
          setEngineRebuildAcknowledged(false)
        }
        const count = d.engine?.calendarCount || d.campaign.aiOutput?.calendarItems?.length || 0
        if (count > 0) {
          setCalendarPushCount(count)
          setCalendarPushState('done')
        }
        if (d.engine?.sentinelStatus === 'passed') setSentinelState('done')
      } else {
        await fetchCampaign()
      }
    } catch {
      setEngineError(locale === 'ar' ? 'خطأ في الشبكة أثناء تشغيل الماكينة' : 'Network error while running the engine')
    } finally {
      setEngineRunning(false)
      setGenerating(false)
    }
  }

  const duplicate = async (): Promise<boolean> => {
    const token = authHeader()
    if (!token) return false
    setCampaignActionError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/duplicate`, { method: 'POST', headers: { Authorization: token } })
      const d = await res.json()
      if (!res.ok || !d.campaign) {
        setCampaignActionError(d.message || d.error || (locale === 'ar' ? 'تعذر إنشاء نسخة مسودة.' : 'Could not create a draft copy.'))
        return false
      }
      router.push(`/campaigns/${d.campaign.id}`)
      return true
    } catch {
      setCampaignActionError(locale === 'ar' ? 'تعذر الاتصال. لم يتم إنشاء نسخة.' : 'Could not connect. No copy was created.')
      return false
    }
  }

  const confirmCampaignAction = async () => {
    if (!campaignAction || campaignActionBusy) return
    setCampaignActionBusy(true)
    setCampaignActionError('')
    const succeeded = campaignAction === 'duplicate'
      ? await duplicate()
      : await updateCampaign({ status: campaignAction === 'archive' ? 'ARCHIVED' : 'DRAFT' })
    setCampaignActionBusy(false)
    if (succeeded) setCampaignAction(null)
  }

  const handleApproveAndBuildContent = async () => {
    const token = authHeader()
    if (!token || !campaign) return
    setApprovalState('approving')
    setLaunchState('approving')
    setLaunchError('')
    try {
      // Step 1: record or idempotently verify the reviewed strategy decision
      // through the authoritative approval workflow. This does not launch
      // spend or publish anything.
      const approveRes = await fetch(`/api/campaigns/${campaignId}/strategy-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ action: 'approve' }),
      })
      const approveData = await approveRes.json()
      if (!approveRes.ok || approveData.approval?.state !== 'approved') {
        setApprovalState('confirming')
        setLaunchState('idle')
        setLaunchError(approveData.message || approveData.error || (locale === 'ar' ? 'فشل الاعتماد، حاول مرة أخرى' : 'Approval failed, please try again'))
        return
      }
      setCampaign(prev => prev ? { ...prev, status: 'ACTIVE' } : prev)
      setStrategyApprovalTruth('approved')

      // Step 2: Check if content plan already exists
      setLaunchState('generating')
      const existingRes = await fetch(`/api/campaigns/${campaignId}/content-plan`, {
        headers: { Authorization: token },
      })
      const existingData = await existingRes.json()

      if (!existingData.posts || existingData.posts.length === 0) {
        // Generate content plan — use MIXED so all workspace media gets assigned to posts
        const genRes = await fetchCreditOperation(`campaign:content-plan:${campaignId}`, `/api/campaigns/${campaignId}/generate-content-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({ mediaSource: 'MIXED' }),
        })
        const genData = await genRes.json()
        if (!genRes.ok) {
          setApprovalState('confirming')
          setLaunchState('idle')
          if (genData.code === 'INSUFFICIENT_CREDITS') {
            setUpgradeReason('no_credits')
            setShowUpgrade(true)
          } else if (genData.error === 'POST_LIMIT_REACHED') {
            setLaunchError(locale === 'ar'
              ? `وصلت إلى حد الخطة الشهري (${genData.limit ?? 0} منشورات). استُخدم ${genData.current ?? 0}، بينما تحتاج هذه الخطة ${genData.requested ?? 0}. راجع الباقة قبل إعادة المحاولة.`
              : `Your monthly plan limit is ${genData.limit ?? 0} posts. ${genData.current ?? 0} are already used and this plan needs ${genData.requested ?? 0}. Review your plan before retrying.`)
          } else {
            setLaunchError(
              locale === 'ar' && typeof genData.messageAr === 'string'
                ? genData.messageAr
                : genData.error ?? (locale === 'ar' ? 'فشل توليد خطة المحتوى' : 'Failed to generate content plan'),
            )
          }
          return
        }
        await refreshBillingStatus()
      }

      // Step 3: Navigate to Content Hub
      setApprovalState('done')
      setLaunchState('done')
      router.push(`/campaigns/${campaignId}/content-hub`)
    } catch {
      setApprovalState('confirming')
      setLaunchState('idle')
      setLaunchError(locale === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong, please try again')
    }
  }

  const handleSentinelReview = async () => {
    const token = authHeader()
    if (!token || !campaign) return
    setSentinelState('reviewing')
    setSentinelError('')
    try {
      const res = await fetchCreditOperation(`campaign:sentinel:${campaignId}`, `/api/campaigns/${campaignId}/sentinel-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        // The API treats the saved strategy language as authoritative. Passing
        // the UI locale is only a fallback for legacy campaigns.
        body: JSON.stringify({ language: locale }),
      })
      const d = await res.json()
      if (d.qualityGate) {
        // Persist the deterministic, no-cost truth review in local state even
        // when Sentinel is intentionally not called because grounding failed.
        setCampaign(prev => {
          if (!prev) return prev
          const existing = (prev.aiOutput as any) || {}
          return {
            ...prev,
            aiOutput: { ...existing, qualityGate: d.qualityGate },
          }
        })
      }
      if (d.sentinelReview) {
        // Patch local campaign state with updated aiOutput
        setCampaign(prev => {
          if (!prev) return prev
          const existing = (prev.aiOutput as any) || {}
          return {
            ...prev,
            aiOutput: {
              ...existing,
              sentinelReview: d.sentinelReview,
              ...(d.qualityGate ? { qualityGate: d.qualityGate } : {}),
            },
          }
        })
        await refreshBillingStatus()
        setSentinelState('done')
      } else if (d.error === 'INSUFFICIENT_CREDITS') {
        setUpgradeReason('no_credits')
        setShowUpgrade(true)
        setSentinelState('idle')
      } else {
        setSentinelError(d.error || 'Review failed')
        setSentinelState('idle')
      }
    } catch {
      setSentinelError('Network error — please try again')
      setSentinelState('idle')
    }
  }

  const handleEnableAutopilot = async () => {
    const token = authHeader()
    if (!token || autopilotActivating || !autopilotRequirementsMet || !autopilotConsentAcknowledged) return
    setAutopilotActivating(true)
    setAutopilotError('')
    try {
      const res = await fetch('/api/autopilot/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ campaignId, explicitAutopilotConfirmed: true }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setAutopilotError(data.error || (locale === 'ar' ? 'تعذر تفعيل الأوتوبايلوت' : 'Autopilot activation failed'))
        return
      }
      setCampaign(prev => prev ? {
        ...prev,
        autopilotEnabled: true,
        autopilotActivatedAt: new Date().toISOString(),
      } : prev)
      setAutopilotQueue(Array.isArray(data.posts) ? data.posts : [])
      setShowAutopilotConfirm(false)
      setAutopilotConsentAcknowledged(false)
    } catch {
      setAutopilotError(locale === 'ar' ? 'خطأ في الاتصال — حاول مرة أخرى' : 'Network error — please try again')
    } finally {
      setAutopilotActivating(false)
    }
  }

  // Generate AI strategy for this campaign (used when aiOutput is empty)
  const handleGenerateStrategy = async () => {
    const token = authHeader()
    if (!token || !campaignId) return
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetchCreditOperation(`campaign:generate:${campaignId}:${locale}`, '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ campaignId, language: locale }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 402) {
          setUpgradeReason('no_credits')
          setShowUpgrade(true)
        } else {
          setGenerateError(err.error || (locale === 'ar' ? 'فشل التوليد، حاول مرة أخرى' : 'Generation failed — please try again'))
        }
        console.error('[handleGenerateStrategy]', err)
        setGenerating(false)
        return
      }
      const d = await res.json()
      if (d.strategy) {
        setCampaign(prev => prev ? { ...prev, aiOutput: { strategy: d.strategy, concepts: d.concepts } } : prev)
      } else {
        // Fallback: refetch the campaign to get updated aiOutput
        await fetchCampaign()
      }
    } catch (e: any) {
      console.error('[handleGenerateStrategy] network error', e)
      setGenerateError(locale === 'ar' ? 'خطأ في الشبكة، حاول مرة أخرى' : 'Network error — please try again')
    } finally {
      setGenerating(false)
    }
  }

  // Sprint H — Push to Calendar
  const handlePushToCalendar = async (force = false) => {
    const token = authHeader()
    if (!token || !campaign) return
    setCalendarPushState('pushing')
    setCalendarPushError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/push-to-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ force }),
      })
      const d = await res.json()
      if (d.alreadyPushed && !force) {
        setCalendarPushCount(d.count ?? 0)
        setCalendarPushState('already')
      } else if (d.success) {
        setCalendarPushCount(d.count ?? 0)
        setCalendarPushState('done')
        // Update local aiOutput with calendarPushedAt
        setCampaign(prev => prev ? {
          ...prev,
          aiOutput: { ...(prev.aiOutput as any), calendarPushedAt: d.pushedAt }
        } : prev)
      } else if (d.error === 'NO_CONTENT_CALENDAR') {
        setCalendarPushError(cdT?.pushCalendarNoContent || 'No content calendar found. Run Full Strategy first.')
        setCalendarPushState('idle')
      } else {
        setCalendarPushError(d.error || cdT?.pushCalendarFailed || 'Push failed. Please try again.')
        setCalendarPushState('idle')
      }
    } catch {
      setCalendarPushError(cdT?.pushCalendarFailed || 'Push failed. Please try again.')
      setCalendarPushState('idle')
    }
  }

  if (loading || fetching) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-5xl mb-4">😕</div>
            <h2 className="mb-2 text-xl font-bold text-slate-950">{cdT?.notFoundTitle}</h2>
            <Link href="/campaigns" className="text-accent hover:text-accent-light transition text-sm">{cdT?.notFoundBack}</Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const aiOutput = campaign.aiOutput as any
  const strategyScope = resolveStrategyScope(aiOutput)
  const strategyLanguage = typeof aiOutput?.language === 'string' ? aiOutput.language : locale
  const strategyDocumentLocale = resolveStrategyDocumentLocale(strategyLanguage, locale)
  const strategyDocIsArabic = strategyDocumentLocale === 'ar'
  const strategyDocText = (ar: string, en: string): string => strategyDocIsArabic ? ar : en
  const uiIsArabic = locale === 'ar'
  const uiText = (ar: string, en: string): string => uiIsArabic ? ar : en
  const proofContext = {
    verifiedProof: Array.isArray((brandDNA as any)?.verifiedProof) ? (brandDNA as any).verifiedProof : [],
    allowedClaimText: [
      (brandDNA as any)?.description,
      (brandDNA as any)?.primaryOffer,
      (brandDNA as any)?.pricePoint,
      ...(Array.isArray((brandDNA as any)?.uniqueAdvantages) ? (brandDNA as any).uniqueAdvantages : []),
      (brandDNA as any)?.complianceNotes,
      ...(Array.isArray((brandDNA as any)?.verifiedProof) ? (brandDNA as any).verifiedProof : []),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  }
  const guardedAiOutput = guardStrategyProof(aiOutput || {}, proofContext) as any
  const strategy = guardStrategyKpis(
    guardStrategyOutputContract(guardedAiOutput?.strategy || {}, {
      allowedPlatforms: campaign.platforms,
      language: strategyLanguage,
      strategyType: strategyScope.type,
      hasConversionDestination: Boolean((brandDNA as any)?.conversionDestination),
      goal: campaign.goal,
    }) as Record<string, unknown>,
    [(brandDNA as any)?.marketingBudget, (brandDNA as any)?.pastAdResults]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    { language: strategyLanguage },
  ) as any
  const topHooks: string[] = strategy.topHooks || guardedAiOutput?.topHooks || []
  const ctaVariations: string[] = strategy.ctaVariations || guardedAiOutput?.ctaVariations || []
  const captionFormulas: string[] = guardedAiOutput?.captionFormulas || []
  const scriptTemplate: string = guardedAiOutput?.scriptTemplate || ''
  const contentCalendar: any[] = guardedAiOutput?.contentCalendar || strategy.contentCalendar || []
  // Sprint D2 — deep strategy fields
  const contentAngles: string[] = strategy.contentAngles || []
  const audienceSegments: string[] = strategy.audienceSegments || []
  const weeklyPlan: any[] = strategy.weeklyPlan || []
  const channelStrategy: any[] = strategy.channelStrategy || []
  const successMetrics: string[] = strategy.successMetrics || []
  const riskNotes: string[] = strategy.riskNotes || []
  // Sprint M — operational strategy fields
  const businessObjective: any = strategy.businessObjective || null
  const diagnosisDetails: any = strategy.diagnosisDetails || null
  const audienceSegmentsDetailed: any[] = strategy.audienceSegmentsDetailed || []
  const funnelStages: any[] = strategy.funnelStages || []
  const contentAnglesDetailed: any[] = strategy.contentAnglesDetailed || []
  const weeklyExecutionPlan: any[] = strategy.weeklyExecutionPlan || []
  const assetRequirements: any = strategy.assetRequirements || null
  const adSetupPlan: any = strategy.adSetupPlan || null
  const paidPlanning: any = strategy.paidPlanning && typeof strategy.paidPlanning === 'object'
    ? strategy.paidPlanning
    : null
  const readinessChecklist: any[] = strategy.readinessChecklist || []
  const doNotDoYet: string[] = strategy.doNotDoYet || []
  const successMetricsDetailed: any[] = strategy.successMetricsDetailed || []
  const executionAssumptions: string[] = strategy.executionAssumptions || []
  // PR-2B1 — honesty scaffold (server-authoritative confidence/missing-data)
  const assumptions: string[] = (strategy as any).assumptions || []
  const evidenceLedger = normalizeStrategyEvidenceLedger((strategy as any).evidenceLedger)
  const missingDataKeys: string[] = (strategy as any).missingData || []
  const confidenceReport: any = (strategy as any).confidenceReport || null
  const competitorAnalysisComplete: boolean | null =
    typeof (strategy as any).competitorAnalysisComplete === 'boolean' ? (strategy as any).competitorAnalysisComplete : null
  // Localized labels for stable readiness keys (mirrors PR-2A Brand Brain wording).
  const MISSING_KEY_LABELS: Record<string, { en: string; ar: string }> = {
    brandName: { en: 'brand name', ar: 'اسم العلامة' },
    industry: { en: 'industry', ar: 'المجال' },
    description: { en: 'business description', ar: 'وصف النشاط' },
    targetAudience: { en: 'target audience', ar: 'الجمهور المستهدف' },
    topPlatforms: { en: 'platforms', ar: 'المنصات' },
    businessGoal: { en: 'main business goal', ar: 'الهدف التجاري' },
    primaryOffer: { en: 'primary offer', ar: 'العرض الأساسي' },
    audienceLocation: { en: 'location', ar: 'الموقع الجغرافي' },
    uniqueAdvantages: { en: 'differentiator', ar: 'الميزة التنافسية' },
    marketingBudget: { en: 'monthly budget', ar: 'الميزانية الشهرية' },
    conversionDestination: { en: 'conversion destination', ar: 'وجهة التحويل' },
    leadHandling: { en: 'lead handling', ar: 'إدارة العملاء المحتملين' },
    competitors: { en: 'competitors', ar: 'المنافسون' },
    pixel: { en: 'pixel / analytics', ar: 'بكسل / تحليلات' },
  }
  const missingDataLabels: string[] = missingDataKeys.map(k => MISSING_KEY_LABELS[k] ? (locale === 'ar' ? MISSING_KEY_LABELS[k].ar : MISSING_KEY_LABELS[k].en) : k)
  const strategyDocMissingDataLabels: string[] = missingDataKeys.map(k => MISSING_KEY_LABELS[k] ? (strategyDocIsArabic ? MISSING_KEY_LABELS[k].ar : MISSING_KEY_LABELS[k].en) : k)
  const paidPlanningMissingKeys = missingDataKeys.filter(k => ['marketingBudget', 'conversionDestination', 'leadHandling', 'pixel'].includes(k))
  const paidPlanningMissingLabels = paidPlanningMissingKeys.map(k => MISSING_KEY_LABELS[k] ? (locale === 'ar' ? MISSING_KEY_LABELS[k].ar : MISSING_KEY_LABELS[k].en) : k)
  const strategyDocPaidPlanningMissingLabels = paidPlanningMissingKeys.map(k => MISSING_KEY_LABELS[k] ? (strategyDocIsArabic ? MISSING_KEY_LABELS[k].ar : MISSING_KEY_LABELS[k].en) : k)
  const campaignToneLabel = formatCampaignToneForLocale(campaign.tone, locale)
  const safeExecutionAssumptions = uniqueCleanList(executionAssumptions.map((item: string) => sanitizeStrategyLimitText(item)))
  const safeAssumptions = uniqueCleanList(assumptions.map((item: string) => sanitizeStrategyLimitText(item)))
  const includesPaidPlanningStrategy = strategyScope.includesPaid
  const hasPaidPlanningGaps = includesPaidPlanningStrategy && paidPlanningMissingLabels.length > 0
  const hasExecutiveStrategySection =
    !!(strategy.diagnosis || strategy.keyMessage || strategy.positioning || strategy.differentiation || strategy.targetAudienceRefined || weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0)
  const hasDiagnosisSection = !!(strategy.diagnosis || diagnosisDetails)
  const hasBusinessObjectiveSection = !!businessObjective
  const hasAudienceSection = audienceSegmentsDetailed.length > 0 || audienceSegments.length > 0
  const isPaidOnlyStrategy = strategyScope.paidOnly
  const includesOrganicStrategy = strategyScope.includesOrganic
  const strategyExecutionBridge = deriveStrategyExecutionBridge({
    scopeType: strategyScope.type,
    campaignPlatforms: campaign.platforms,
    platformStates: strategyPlatformStates,
    platformReadinessLoaded: strategyPlatformReadinessLoaded,
    campaignId: campaign.id,
  })
  const hasOrganicContentSection =
    includesOrganicStrategy && !!(strategy.valueProps?.length > 0 || strategy.valuePropositions?.length > 0 || strategy.estimatedResults || topHooks.length > 0 || ctaVariations.length > 0 || strategy.contentPillars?.length > 0 || contentAngles.length > 0 || contentAnglesDetailed.length > 0)
  const hasPaidPlanningAnglesSection =
    isPaidOnlyStrategy && !!(paidPlanning || topHooks.length > 0 || ctaVariations.length > 0 || strategy.contentPillars?.length > 0 || contentAngles.length > 0 || contentAnglesDetailed.length > 0)
  const hasStrategyContentSection = hasOrganicContentSection || hasPaidPlanningAnglesSection
  const hasExecutionSection =
    !!(funnelStages.length > 0 || strategy.funnelStrategy || strategy.channelMix?.length > 0 || channelStrategy.length > 0 || strategy.offerCTAStrategy || strategy.visualDirection || weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0)
  const hasStrategyExecutionBridge = !!aiOutput
  const hasMetricsSection = !!(strategy.kpis?.length > 0 || successMetricsDetailed.length > 0 || successMetrics.length > 0)
  const hasReadinessSection =
    !!(readinessChecklist.length > 0 || assetRequirements || strategy.executionChecklist?.length > 0 || adSetupPlan || hasStrategyExecutionBridge)
  const hasRisksSection =
    !!(evidenceLedger.length > 0 || doNotDoYet.length > 0 || riskNotes.length > 0 || safeExecutionAssumptions.length > 0 || safeAssumptions.length > 0 || missingDataLabels.length > 0 || confidenceReport || competitorAnalysisComplete === false)
  const strategySectionNavItems = [
    { num: '01', label: strategyDocText('التنفيذي', 'Executive'), id: 'strategy-executive', show: hasExecutiveStrategySection },
    { num: '02', label: strategyDocText('التشخيص', 'Diagnosis'), id: 'strategy-diagnosis', show: hasDiagnosisSection },
    { num: '03', label: strategyDocText('الهدف', 'Objective'), id: 'strategy-objective', show: hasBusinessObjectiveSection },
    { num: '04', label: strategyDocText('الجمهور', 'Audience'), id: 'strategy-audience', show: hasAudienceSection },
    { num: '05', label: isPaidOnlyStrategy ? strategyDocText('زوايا مدفوعة', 'Paid angles') : strategyDocText('المحتوى', 'Content'), id: 'strategy-content', show: hasStrategyContentSection },
    { num: '06', label: strategyDocText('التنفيذ', 'Execution'), id: 'strategy-execution', show: hasExecutionSection },
    { num: '07', label: strategyDocText('القياس', 'Metrics'), id: 'strategy-metrics', show: hasMetricsSection },
    { num: '08', label: strategyDocText('الجاهزية', 'Readiness'), id: 'strategy-readiness', show: hasReadinessSection },
    { num: '09', label: strategyDocText('المخاطر', 'Risks'), id: 'strategy-risks', show: hasRisksSection },
  ].filter(item => item.show)
  const displayedConfidenceLevel = confidenceReport?.overall === 'high' && (missingDataLabels.length > 0 || competitorAnalysisComplete === false)
    ? 'medium'
    : confidenceReport?.overall
  const confLevelLabel = (lvl: string, labelLocale: string = locale): string => {
    const map: Record<string, { en: string; ar: string }> = {
      high: { en: 'High confidence', ar: 'ثقة عالية' },
      medium: { en: 'Medium confidence', ar: 'ثقة متوسطة' },
      low: { en: 'Low confidence — needs more data', ar: 'ثقة منخفضة — تحتاج بيانات أكثر' },
    }
    return map[lvl] ? (labelLocale === 'ar' ? map[lvl].ar : map[lvl].en) : lvl
  }
  const strategyFieldLabel = (key: string, labelLocale: string = locale): string => {
    const normalized = key.replace(/[_\s-]+/g, '').toLowerCase()
    const useRuntimeTranslations = labelLocale === locale
    const isArabicLabel = labelLocale === 'ar'
    const labels: Record<string, string> = {
      situation: (useRuntimeTranslations && cdT?.fieldSituation) || (isArabicLabel ? 'الموقف' : 'Situation'),
      pain: (useRuntimeTranslations && cdT?.fieldPain) || (isArabicLabel ? 'الألم' : 'Pain'),
      desiredoutcome: (useRuntimeTranslations && cdT?.fieldDesiredOutcome) || (isArabicLabel ? 'النتيجة المطلوبة' : 'Desired Outcome'),
      want: (useRuntimeTranslations && cdT?.fieldDesiredOutcome) || (isArabicLabel ? 'النتيجة المطلوبة' : 'Desired Outcome'),
      objection: (useRuntimeTranslations && cdT?.fieldObjection) || (isArabicLabel ? 'الاعتراض' : 'Objection'),
      message: (useRuntimeTranslations && cdT?.fieldMessage) || (isArabicLabel ? 'الرسالة' : 'Message'),
      format: (useRuntimeTranslations && cdT?.fieldFormat) || (isArabicLabel ? 'الصيغة' : 'Format'),
      contenttype: (useRuntimeTranslations && cdT?.fieldFormat) || (isArabicLabel ? 'الصيغة' : 'Format'),
      platform: (useRuntimeTranslations && cdT?.fieldPlatform) || (isArabicLabel ? 'القناة' : 'Platform'),
      cta: (useRuntimeTranslations && cdT?.fieldCta) || (isArabicLabel ? 'الدعوة للإجراء' : 'CTA'),
      metric: (useRuntimeTranslations && cdT?.fieldMetric) || (isArabicLabel ? 'مؤشر القياس' : 'Metric'),
      successmetric: (useRuntimeTranslations && (cdT?.weekSuccessMetric || cdT?.fieldMetric)) || (isArabicLabel ? 'مؤشر النجاح' : 'Success Metric'),
      objective: (useRuntimeTranslations && cdT?.fieldObjective) || (isArabicLabel ? 'الهدف' : 'Objective'),
      exclusions: (useRuntimeTranslations && cdT?.fieldExclusions) || (isArabicLabel ? 'استثناءات الاستهداف' : 'Exclusions'),
      adcopyangles: (useRuntimeTranslations && cdT?.fieldAdCopyAngles) || (isArabicLabel ? 'زوايا نصوص الإعلانات' : 'Ad Copy Angles'),
      funnelstage: (useRuntimeTranslations && cdT?.fieldFunnelStage) || (isArabicLabel ? 'مرحلة القمع' : 'Funnel Stage'),
      usermindset: (useRuntimeTranslations && cdT?.funnelMindset) || (isArabicLabel ? 'حالة المستخدم الذهنية' : 'User Mindset'),
      nextstep: (useRuntimeTranslations && cdT?.funnelNextStep) || (isArabicLabel ? 'الخطوة التالية' : 'Next Step'),
      productarea: (useRuntimeTranslations && cdT?.funnelProductArea) || (isArabicLabel ? 'يُغذّي' : 'Powers'),
    }
    if (labels[normalized]) return labels[normalized]
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
  }
  const strategyDocFieldLabel = (key: string): string => strategyFieldLabel(key, strategyDocumentLocale)
  const strategyDocDisplayValue = (value: unknown): string => {
    if (typeof value === 'string') return formatStrategyDisplayText(value, strategyDocumentLocale)
    return value == null ? '' : String(value)
  }
  const confLevelColor = (lvl: string): string => (lvl === 'high' ? '#10b981' : lvl === 'medium' ? '#f59e0b' : '#ef4444')

  // Sprint F — creative brief
  const creativeBrief = aiOutput?.creativeBrief || null
  const creativeMode: 'asset' | 'concept' | null = aiOutput?.creativeMode || null
  // Sprint G — sentinel review
  const sentinelReview = aiOutput?.sentinelReview || null
  const sentinelStatus: 'not_reviewed' | 'passed' | 'needs_attention' =
    sentinelReview ? sentinelReview.status : 'not_reviewed'
  const qualityGate = aiOutput?.qualityGate || null
  const qualityGatePassed = qualityGate?.schemaVersion === 1
    && qualityGate?.status === 'passed'
    && Array.isArray(qualityGate?.blockers)
    && qualityGate.blockers.length === 0
  const brandTruthReview = reviewBrandTruthConsistency(brandDNA)
  const brandTruthBlocked = Boolean(brandDNA) && brandTruthReview.status === 'blocked'
  const completeQualityReviewPassed = sentinelStatus === 'passed' && qualityGatePassed && !brandTruthBlocked
  const operatingState = deriveCampaignOperatingState({
    campaign: {
      status: campaign.status,
      aiOutput: campaign.aiOutput,
      autopilotEnabled: campaign.autopilotEnabled,
      autopilotActivatedAt: campaign.autopilotActivatedAt,
      platforms: campaign.platforms,
    },
    posts: campaignPosts,
    pendingLearningCount,
  })
  const strategyDocOperatingLabel = brandTruthBlocked
    ? (strategyDocIsArabic ? 'مخرجات مرجعية محجوبة' : 'Blocked reference outputs')
    : strategyDocIsArabic ? operatingState.stageLabelAr : operatingState.stageLabel
  const strategyDocOperatingHelper = brandTruthBlocked
    ? (strategyDocIsArabic
      ? 'السجلات الحالية للرجوع التاريخي فقط. صحّح Brand Brain ثم أنشئ استراتيجية ومحتوى جديدين قبل أي تنفيذ.'
      : 'Current records are for historical reference only. Fix Brand Brain, then create a new strategy and content before execution.')
    : strategyDocIsArabic ? operatingState.stageHelperAr : operatingState.stageHelper
  const uiOperatingLabel = uiIsArabic ? operatingState.stageLabelAr : operatingState.stageLabel
  const uiOperatingHelper = uiIsArabic ? operatingState.stageHelperAr : operatingState.stageHelper
  const operatingActionLabel = locale === 'ar'
    ? operatingState.primaryAction.labelAr
    : operatingState.primaryAction.label
  const displayOperatingLabel = isPaidOnlyStrategy
    ? uiText('بريف تخطيط مدفوع للمراجعة', 'Paid planning brief for review')
    : uiOperatingLabel
  const displayOperatingHelper = isPaidOnlyStrategy
    ? (uiIsArabic
      ? 'لا توجد خطة محتوى عضوية من هذا التوليد. أكمل التتبع والحسابات والموافقة قبل أي إطلاق أو صرف.'
      : 'No organic content plan was created by this run. Complete tracking, accounts, and approval before any launch or spend.')
    : uiOperatingHelper
  const effectiveDisplayOperatingLabel = brandTruthBlocked
    ? uiText('مخرجات مرجعية محجوبة', 'Blocked reference outputs')
    : displayOperatingLabel
  const effectiveDisplayOperatingHelper = brandTruthBlocked
    ? uiText('السجلات الحالية للرجوع التاريخي فقط. صحّح Brand Brain ثم أنشئ استراتيجية ومحتوى جديدين قبل أي تنفيذ.', 'Current records are for historical reference only. Fix Brand Brain, then create a new strategy and content before execution.')
    : displayOperatingHelper
  const strategyRoomStateCopy = deriveStrategyRoomStateCopy({
    locale,
    isPaidOnlyStrategy,
    hasContentPlan: operatingState.truthFlags.hasContentPlan,
    operatingSnapshotsLoaded,
  })
  const strategyDocStateCopy = deriveStrategyRoomStateCopy({
    locale: strategyDocumentLocale,
    isPaidOnlyStrategy,
    hasContentPlan: operatingState.truthFlags.hasContentPlan,
    operatingSnapshotsLoaded,
  })
  const strategyGuidanceCopy = strategyRoomStateCopy.guidance
  const strategyDocGuidanceCopy = strategyDocStateCopy.guidance
  const strategyReviewChecklistCopy = strategyDocStateCopy.checklist
  const mustHaveAssetCount = Array.isArray(assetRequirements?.mustHave) ? assetRequirements.mustHave.length : 0
  const proofAssetCount = Array.isArray(assetRequirements?.forProof) ? assetRequirements.forProof.length : 0
  const verifiedProofCount = proofContext.verifiedProof.length
  const analyticsBaselineMissing = missingDataKeys.includes('pixel') || confidenceReport?.byCapability?.measurement !== 'high'
  const strategyExecutionReadinessItems = [
    {
      label: strategyDocText('اتجاه الرسالة والجمهور', 'Message and audience direction'),
      value: hasExecutiveStrategySection && hasBusinessObjectiveSection && hasAudienceSection
        ? strategyDocText('جاهز للمراجعة', 'Ready for review')
        : strategyDocText('يحتاج هدفاً وجمهوراً أوضح', 'Needs clearer objective or audience'),
      helper: strategyDocIsArabic
        ? 'راجع القرار، التشخيص، والشرائح قبل تحويل الاستراتيجية إلى خطة عمل.'
        : 'Review the decision, diagnosis, and segments before turning the strategy into work.',
      tone: hasExecutiveStrategySection && hasBusinessObjectiveSection && hasAudienceSection ? 'positive' : 'warning',
    },
    {
      label: strategyDocText('حالة خطة المحتوى', 'Content plan status'),
      value: strategyDocStateCopy.contentPlanStatusValue,
      helper: strategyDocIsArabic
        ? 'Content Hub هو مكان خطة المنشورات النهائية وحالة الوسائط، وليس هذه الصفحة.'
        : 'Content Hub owns final post planning and media state, not this page.',
      tone: strategyDocStateCopy.contentPlanTone,
    },
    {
      label: strategyDocText('الإثبات والثقة', 'Proof and trust'),
      value: verifiedProofCount > 0
        ? (strategyDocIsArabic ? `${verifiedProofCount} دليل موثق للمراجعة` : `${verifiedProofCount} verified proof signal${verifiedProofCount === 1 ? '' : 's'} for review`)
        : proofAssetCount > 0
          ? (strategyDocIsArabic ? `${proofAssetCount} أصل ثقة مطلوب` : `${proofAssetCount} proof asset${proofAssetCount === 1 ? '' : 's'} needed`)
          : strategyDocText('استخدم ادعاءات محافظة حتى تتوفر أدلة', 'Keep claims conservative until proof exists'),
      helper: strategyDocIsArabic
        ? 'لا تعتبر الشهادات أو النتائج مثبتة إلا إذا أضافها المستخدم أو جاءت من تحليلات حقيقية.'
        : 'Testimonials and outcomes are not proven unless the user supplied them or real analytics support them.',
      tone: verifiedProofCount > 0 ? 'positive' : 'warning',
    },
    {
      label: strategyDocText('الأصول الإبداعية', 'Creative assets'),
      value: mustHaveAssetCount > 0
        ? (strategyDocIsArabic ? `${mustHaveAssetCount} أصل أساسي قبل التنفيذ` : `${mustHaveAssetCount} must-have asset${mustHaveAssetCount === 1 ? '' : 's'} before execution`)
        : strategyDocText('لا توجد أصول أساسية مذكورة', 'No must-have assets listed'),
      helper: strategyDocIsArabic
        ? 'لقطات المنتج، الفيديو التوضيحي، والإثباتات تتحكم في جودة المحتوى أكثر من طول التقرير.'
        : 'Product shots, demos, and proof assets matter more than report length for execution quality.',
      tone: mustHaveAssetCount > 0 ? 'warning' : 'muted',
    },
    {
      label: strategyDocText('خط أساس التحليلات', 'Analytics baseline'),
      value: analyticsBaselineMissing
        ? strategyDocText('مطلوب قبل الحكم على الأداء', 'Needed before judging performance')
        : strategyDocText('متاح للمراجعة', 'Available for review'),
      helper: strategyDocIsArabic
        ? 'الأرقام في الاستراتيجية تظل فرضيات حتى تظهر بيانات نشر أو تحليلات حقيقية.'
        : 'Strategy numbers stay hypotheses until published content or analytics data exists.',
      tone: analyticsBaselineMissing ? 'warning' : 'positive',
    },
    {
      label: strategyDocText('نطاق التخطيط المدفوع', 'Paid planning scope'),
      value: !includesPaidPlanningStrategy
        ? strategyDocText('غير مشمول في هذا التشغيل العضوي', 'Not included in this organic run')
        : hasPaidPlanningGaps
          ? (strategyDocIsArabic
              ? `ناقص قبل التنفيذ: ${strategyDocPaidPlanningMissingLabels.join('، ')}`
              : `Missing before execution: ${strategyDocPaidPlanningMissingLabels.join(', ')}`)
          : strategyDocText('تخطيط للمراجعة فقط', 'Planning for review only'),
      helper: strategyDocIsArabic
        ? 'لا يوجد صرف أو إطلاق أو جاهزية حسابات من صفحة الاستراتيجية.'
        : 'No spend, launch, or account readiness happens from the Strategy page.',
      tone: includesPaidPlanningStrategy && hasPaidPlanningGaps ? 'warning' : 'muted',
    },
  ]
  const strategyExecutionBridgeTone: Record<typeof strategyExecutionBridge.overallStatus, string> = {
    ready: 'border-emerald-200 bg-emerald-50',
    blocked: 'border-amber-200 bg-amber-50',
    checking: 'border-blue-200 bg-blue-50',
    not_in_scope: 'border-slate-200 bg-slate-50',
  }
  const strategyExecutionRequirementTone: Record<StrategyExecutionRequirement['status'], string> = {
    ready: 'border-emerald-200 bg-white text-emerald-900',
    blocked: 'border-amber-200 bg-white text-amber-950',
    checking: 'border-blue-200 bg-white text-blue-900',
    not_in_scope: 'border-slate-200 bg-white text-slate-600',
  }
  const strategyExecutionStatusLabel = (requirement: StrategyExecutionRequirement): string => {
    if (requirement.status === 'ready') return strategyDocText('متاح للمراجعة', 'Available for review')
    if (requirement.status === 'checking') return strategyDocText('قيد الفحص', 'Checking')
    if (requirement.readinessStatus === 'permission_unverified') return strategyDocText('الصلاحية غير مثبتة', 'Permission unverified')
    if (requirement.readinessStatus === 'not_available') return strategyDocText('غير متاح بعد', 'Not available yet')
    if (requirement.readinessStatus === 'not_connected') return strategyDocText('غير متصل', 'Not connected')
    if (requirement.readinessStatus === 'needs_setup') return strategyDocText('يحتاج إعداداً', 'Needs setup')
    return strategyDocText('غير جاهز', 'Not ready')
  }
  const renderStrategyExecutionRequirement = (requirement: StrategyExecutionRequirement) => (
    <div key={requirement.id} className={`rounded-2xl border p-4 ${strategyExecutionRequirementTone[requirement.status]}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">
            {strategyDocIsArabic ? requirement.titleAr : requirement.titleEn}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {strategyDocIsArabic ? requirement.reasonAr : requirement.reasonEn}
          </p>
        </div>
        <span className="w-fit rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold">
          {strategyExecutionStatusLabel(requirement)}
        </span>
      </div>
      {requirement.actionHref && requirement.status === 'blocked' && (
        <Link
          href={requirement.actionHref}
          className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          {strategyDocIsArabic ? requirement.actionLabelAr : requirement.actionLabelEn}
        </Link>
      )}
    </div>
  )
  const operatingTone: Record<CampaignOperatingStage, string> = {
    strategy_missing: 'border-amber-200 bg-amber-50 text-amber-800',
    strategy_review_needed: 'border-blue-200 bg-blue-50 text-blue-700',
    content_plan_missing: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    content_review_needed: 'border-amber-200 bg-amber-50 text-amber-800',
    content_approved_not_scheduled: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    scheduled_manual: 'border-violet-200 bg-violet-50 text-violet-700',
    scheduled_auto: 'border-violet-200 bg-violet-50 text-violet-700',
    auto_publish_enabled: 'border-violet-200 bg-violet-50 text-violet-700',
    publishing_processing: 'border-violet-200 bg-violet-50 text-violet-700',
    published_waiting_for_analytics: 'border-sky-200 bg-sky-50 text-sky-700',
    performance_ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    learning_review_needed: 'border-purple-200 bg-purple-50 text-purple-700',
    paused_or_archived: 'border-slate-200 bg-slate-100 text-slate-600',
  }

  const operatingActionHref = (() => {
    if (operatingState.primaryAction.href === '/content-hub') return `/campaigns/${campaign.id}/content-hub`
    if (operatingState.primaryAction.href === '#autopilot') return `/campaigns/${campaign.id}?tab=autopilot`
    if (operatingState.primaryAction.href === '#performance') return `/campaigns/${campaign.id}?tab=performance`
    if (operatingState.primaryAction.href === '#strategy' || operatingState.primaryAction.href === '#campaign') return `/campaigns/${campaign.id}?tab=strategy`
    return operatingState.primaryAction.href
  })()
  const engineRebuildStatusPending = !operatingSnapshotsLoaded
  const engineRebuildAvailability = deriveEngineRebuildAvailability({
    postStatuses: engineRebuildStatusPending ? ['APPROVED'] : campaignPosts.map(post => post.status),
    explicitEngineRebuildConfirmed: engineRebuildAcknowledged,
    acknowledgedCreditCost: engineRebuildAcknowledged ? ENGINE_REBUILD_CREDIT_COST : undefined,
    acknowledgedOutputOverwrite: engineRebuildAcknowledged,
  })
  const engineRebuildLockedByProgress = engineRebuildAvailability.reason === 'LOCKED_BY_PROGRESS'

  const hasVerifiedPublishingConnection = strategyPlatformReadinessLoaded
    && strategyPlatformStates.some(platform => platform.status === 'ready')
  const hasReviewedContent = operatingState.truthFlags.hasReviewedContent
  const hasExplicitAutoSchedule = operatingState.counts.autoScheduledPosts > 0
  const autopilotRequirementsMet = Boolean(
    completeQualityReviewPassed &&
    hasReviewedContent &&
    hasExplicitAutoSchedule &&
    hasVerifiedPublishingConnection,
  )
  const publishTabSummary = derivePublishTabReadinessSummary({
    posts: campaignPosts,
    hasConnectedPublishingAccount: hasVerifiedPublishingConnection,
    hasAutopilotEnabled: campaign.autopilotEnabled,
    hasAnalyticsData: operatingState.truthFlags.hasAnalyticsData,
  })
  const autopilotQueueScheduledCount = autopilotQueue.filter(post => post.status === 'SCHEDULED' && post.scheduledAt).length
  const autopilotQueueManualPublishedCount = autopilotQueue.filter(post =>
    post.status === 'PUBLISHED' &&
    (post.publishMode === 'MANUAL' || Boolean(post.manuallyPublishedAt))
  ).length
  const autopilotQueueHasScheduled = autopilotQueueScheduledCount > 0
  const autopilotQueueHasMixedManualAndScheduled = autopilotQueueManualPublishedCount > 0 && autopilotQueueScheduledCount > 0
  const creativeNeedsStrategyReview = brandTruthBlocked || (operatingSnapshotsLoaded && operatingState.stage === 'strategy_review_needed')
  const creativeHasPostRecords = operatingState.counts.totalPosts > 0 || operatingState.truthFlags.hasContentPlan
  const creativeCanUsePostMediaFlow = creativeHasPostRecords && !creativeNeedsStrategyReview
  const creativeCanUseConceptGallery = creativeCanUsePostMediaFlow && !!creativeBrief
  const creativeStrategyScopeLabel = isPaidOnlyStrategy
    ? (locale === 'ar' ? 'مسار إبداعي للتخطيط المدفوع فقط' : 'Creative path for paid planning only')
    : includesPaidPlanningStrategy
      ? (locale === 'ar' ? 'مسار إبداعي لاستراتيجية شاملة' : 'Creative path for a full strategy')
      : (locale === 'ar' ? 'مسار إبداعي لاستراتيجية عضوية فقط' : 'Creative path for organic strategy only')

  const nextCreativeAction = (() => {
    if (brandTruthBlocked) {
      return {
        title: locale === 'ar' ? 'صحّح Brand Brain قبل الإنتاج الإبداعي' : 'Fix Brand Brain before creative production',
        helper: locale === 'ar'
          ? 'مصدر الحقيقة متناقض حالياً. أوقفنا توليد الأصول واستهلاك الكريديت حتى تصحيح البيانات وإنشاء استراتيجية متسقة.'
          : 'The current source of truth conflicts. Asset generation and credit spending are blocked until the data is corrected and a consistent strategy is created.',
        cta: locale === 'ar' ? 'تصحيح Brand Brain' : 'Fix Brand Brain',
        href: '/brand',
      }
    }

    if (!operatingState.truthFlags.hasStrategy) {
      return {
        title: locale === 'ar' ? 'راجع الاستراتيجية قبل الإنتاج الإبداعي' : 'Review strategy before creative production',
        helper: locale === 'ar'
          ? 'ابدأ من اتجاه الحملة حتى تأتي المخرجات البصرية منسجمة مع الرسالة والجمهور.'
          : 'Start from the campaign direction so creative work follows the message and audience.',
        cta: locale === 'ar' ? 'راجع الاستراتيجية' : 'Review strategy',
        href: `/campaigns/${campaign.id}?tab=strategy`,
      }
    }

    if (!operatingSnapshotsLoaded) {
      return {
        title: locale === 'ar' ? 'نفحص حالة Content Hub أولاً' : 'Checking Content Hub state first',
        helper: locale === 'ar'
          ? 'لا يبدأ المسار الإبداعي بحكم نهائي قبل تحميل سجلات المنشورات الفعلية. انتظر لحظة حتى تظهر حالة المحتوى والوسائط.'
          : 'The creative path does not make a final call before real post records load. Wait a moment for content and media state to appear.',
        cta: locale === 'ar' ? 'راجع الحالة هنا' : 'Review status here',
        href: '#campaign-creative-work',
      }
    }

    if (creativeNeedsStrategyReview) {
      return {
        title: locale === 'ar' ? 'راجع جودة الاستراتيجية أولاً' : 'Review strategy quality first',
        helper: locale === 'ar'
          ? 'لا يبدأ المسار الإبداعي العملي قبل تثبيت الرسالة والجمهور ونطاق التشغيل. هذه الصفحة تعرض الحدود التالية فقط حتى تنتهي مراجعة الاستراتيجية.'
          : 'The practical creative path should not start before the message, audience, and execution scope are reviewed. This tab shows the next boundaries until strategy review is complete.',
        cta: locale === 'ar' ? 'راجع جودة الاستراتيجية' : 'Review strategy quality',
        href: `/campaigns/${campaign.id}?tab=strategy`,
      }
    }

    if (!creativeHasPostRecords) {
      return {
        title: locale === 'ar' ? 'حضّر خطة المحتوى قبل قرارات الإبداع' : 'Prepare the content plan before creative decisions',
        helper: locale === 'ar'
          ? 'لا توجد منشورات Content Hub بعد. حوّل الاستراتيجية إلى خطة محتوى أولاً، ثم تصبح متطلبات الوسائط والطبقات الإبداعية مرتبطة بمنشورات حقيقية.'
          : 'No Content Hub posts exist yet. Turn the strategy into a content plan first, then media requirements and creative layers can attach to real posts.',
        cta: locale === 'ar' ? 'حضّر خطة المحتوى' : 'Prepare content plan',
        href: `/campaigns/${campaign.id}/content-hub`,
      }
    }

    if (!creativeBrief) {
      return {
        title: locale === 'ar' ? 'افتح مخطط الإبداع' : 'Open the creative brief planner',
        helper: locale === 'ar'
          ? 'مخطط الإبداع هو خطوة التنظيم قبل قرارات الصور والطبقات. يحدد احتياجات الأصول؛ المعاينات والأصول لا تُرفق بالمنشورات تلقائياً، ولا يعتمد أو يجدول أو ينشر شيئاً.'
          : 'The creative brief planner is the organizing step before image and layer decisions. It defines asset needs; previews and assets are not automatically attached to posts, and it does not approve, schedule, or publish anything.',
        cta: locale === 'ar' ? 'افتح مخطط الإبداع' : 'Open creative brief planner',
        href: `/campaigns/${campaign.id}/creative-brief`,
      }
    }

    if (operatingState.truthFlags.hasContentPlan && operatingState.counts.pendingGenerationPosts > 0) {
      return {
        title: locale === 'ar' ? 'راجع وسائط المنشورات في مركز المحتوى' : 'Review post media in Content Hub',
        helper: locale === 'ar'
          ? 'Content Hub هو مصدر المراجعة النهائي للمنشورات ووسائطها المرتبطة. راجع الصور أو الأصول الناقصة هناك.'
          : 'Content Hub is the final review surface for posts and their linked media. Review missing images or assets there.',
        cta: locale === 'ar' ? 'راجع وسائط المنشورات' : 'Review post media',
        href: `/campaigns/${campaign.id}/content-hub`,
      }
    }

    if (operatingState.truthFlags.hasContentPlan && operatingState.truthFlags.hasDraftContent) {
      return {
        title: locale === 'ar' ? 'راجع مسودات المحتوى' : 'Review draft posts',
        helper: locale === 'ar'
          ? 'المسودات ومعاينات المنصات تحتاج مراجعة في Content Hub قبل قرارات الجدولة أو النشر.'
          : 'Draft posts and platform previews need Content Hub review before scheduling or publishing decisions.',
        cta: locale === 'ar' ? 'افتح Content Hub' : 'Open Content Hub',
        href: `/campaigns/${campaign.id}/content-hub`,
      }
    }

    return {
      title: locale === 'ar' ? 'راجع المرئيات المفهومية للحملة' : 'Review campaign concept visuals',
      helper: locale === 'ar'
        ? 'المرئيات المفهومية تظل في معرض الحملة للمراجعة فقط. لا تُرفق بالمنشورات أو تُنشر أو تُستخدم في الإعلانات تلقائياً.'
        : 'Concept visuals stay in the campaign gallery for review only. They are not attached to posts, published, or used in ads automatically.',
      cta: locale === 'ar' ? 'راجع المرئيات المفهومية' : 'Review concept visuals',
      href: '#campaign-visual-generator',
    }
  })()

  const visualContext = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignGoal: campaign.goal,
    campaignTone: campaign.tone,
    audience: campaign.audience,
  }
  const totalPostMediaSlots = operatingState.counts.totalPosts
  const pendingPostMediaSlots = operatingState.counts.pendingGenerationPosts
  const readyPostMediaSlots = Math.max(0, totalPostMediaSlots - pendingPostMediaSlots)
  const creativeRequirementsSummary = summarizeCreativeRequirements(
    campaignPosts.map((post: any) => ({
      postId: post.id,
      platform: post.platform,
      caption: post.caption,
      status: post.status,
      imageUrl: post.imageUrl,
      uploadedMediaId: post.uploadedMediaId,
      mediaSource: post.mediaSource,
      generationStatus: post.generationStatus,
      isVideoPost: post.isVideoPost,
      campaignGoal: campaign.goal,
      campaignName: campaign.name,
      brandName: brandDNA?.brandName,
    })),
  )
  const commandFlowCurrentStepId: CampaignCommandFlowStepId | undefined = (() => {
    if (activeTab === 0) return 'strategy'
    if (activeTab === 3) return 'creative'
    if (activeTab === 4 || activeTab === 5) return 'publishing'
    if (activeTab === 6) return 'performance'
    return undefined
  })()
  const campaignCommandFlow = deriveCampaignCommandFlow({
    campaignId: campaign.id,
    operatingState,
    creativeSummary: creativeRequirementsSummary,
    publishSummary: publishTabSummary,
    brandScore,
    brandTruthBlocked,
    isPaidOnlyStrategy,
    includesPaidPlanning: includesPaidPlanningStrategy,
    hasCreativeBrief: Boolean(creativeBrief),
    currentStepId: commandFlowCurrentStepId,
    operatingSnapshotsLoaded,
  })
  const commandFlowStepTone: Record<CampaignCommandFlowStepStatus, string> = {
    complete: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    current: 'border-indigo-200 bg-indigo-50 text-indigo-950',
    review: 'border-amber-200 bg-amber-50 text-amber-950',
    blocked: 'border-rose-200 bg-rose-50 text-rose-950',
    pending: 'border-slate-200 bg-slate-50 text-slate-600',
  }
  const commandFlowPillTone: Record<CampaignCommandFlowStepStatus, string> = {
    complete: 'border-emerald-200 bg-white text-emerald-700',
    current: 'border-indigo-200 bg-white text-indigo-700',
    review: 'border-amber-200 bg-white text-amber-700',
    blocked: 'border-rose-200 bg-white text-rose-700',
    pending: 'border-slate-200 bg-white text-slate-500',
  }
  const commandFlowStatusLabel = (status: CampaignCommandFlowStepStatus): string => {
    const labels: Record<CampaignCommandFlowStepStatus, { en: string; ar: string }> = {
      complete: { en: 'Complete', ar: 'مكتمل' },
      current: { en: 'Next', ar: 'التالي' },
      review: { en: 'Review', ar: 'مراجعة' },
      blocked: { en: 'Blocked', ar: 'متوقف' },
      pending: { en: 'Pending', ar: 'لاحقاً' },
    }
    return uiIsArabic ? labels[status].ar : labels[status].en
  }
  const strategyHeaderNextActionTitle = brandTruthBlocked
    ? uiText('صحّح مصدر الحقيقة قبل متابعة الحملة', 'Fix the source of truth before continuing the campaign')
    : uiIsArabic
      ? campaignCommandFlow.nextAction.titleAr
      : campaignCommandFlow.nextAction.titleEn
  const strategyHeaderNextActionHelper = brandTruthBlocked
    ? uiText('الاستراتيجية الحالية للمرجع فقط. لا محتوى أو صور أو نشر أو صرف كريديت حتى تصحيح Brand Brain ثم إنشاء استراتيجية جديدة.', 'The current strategy is reference-only. Content, images, publishing, and credit spend remain blocked until Brand Brain is corrected and a new strategy is created.')
    : uiIsArabic
      ? campaignCommandFlow.nextAction.helperAr
      : campaignCommandFlow.nextAction.helperEn
  const strategyHeaderNextActionLabel = brandTruthBlocked
    ? uiText('تصحيح Brand Brain', 'Fix Brand Brain')
    : uiIsArabic
      ? campaignCommandFlow.nextAction.labelAr
      : campaignCommandFlow.nextAction.labelEn
  const strategyHeaderNextActionHref = brandTruthBlocked ? '/brand' : campaignCommandFlow.nextAction.href
  const sentinelCreditCost = getCreditActionTruth({
    action: 'SENTINEL_REVIEW',
    creditsRemaining: 0,
  }).cost
  const contentPlanCreditCost = getCreditActionTruth({
    action: 'CONTENT_PLAN_GENERATION',
    creditsRemaining: 0,
  }).cost
  const strategyDeskCanReviewQuality = !brandTruthBlocked
    && !engineRunning
    && operatingState.stage === 'strategy_review_needed'
  const strategyDeskCanApproveAndBuild = !brandTruthBlocked
    && !engineRunning
    && !isPaidOnlyStrategy
    && sentinelStatus === 'passed'
    && operatingState.stage === 'content_plan_missing'
  // The seven-step campaign map is owned by the Strategy desk. Repeating it
  // above Creative, Publish, Calendar, and Performance made every workspace
  // feel like an explanation page. Those tabs now show one executable next
  // action and then their actual tool.
  const showFullCampaignOperatingFlow = false
  const showLegacyCampaignSummaryPanels = false
  const firstViewportHref = (href: string) => (
    !showFullCampaignOperatingFlow && href === '#campaign-operating-flow'
      ? '#campaign-room-workspace'
      : href
  )
  const firstViewportAction = activeTab === 3
    ? {
      eyebrow: uiText('الخطوة الإبداعية التالية', 'Next creative step'),
      workspace: AGENT_TABS[activeTab]?.label || uiText('الإبداع', 'Creative'),
      title: nextCreativeAction.title,
      helper: nextCreativeAction.helper,
      label: nextCreativeAction.cta,
      href: firstViewportHref(nextCreativeAction.href),
    }
    : {
      eyebrow: uiText('الخطوة العملية الآن', 'Practical next step'),
      workspace: AGENT_TABS[activeTab]?.label || uiText('غرفة الحملة', 'Campaign Room'),
      title: strategyHeaderNextActionTitle,
      helper: strategyHeaderNextActionHelper,
      label: strategyHeaderNextActionLabel,
      href: firstViewportHref(strategyHeaderNextActionHref),
    }
  const creativeOperatingSequence = [
    {
      step: '01',
      title: uiText('مخطط الإبداع', 'Creative brief planner'),
      helper: uiText('حدد اتجاه الصورة، احتياجات الأصول، والطبقات قبل أي توليد أو ربط.', 'Define visual direction, asset needs, and layers before any generation or attachment.'),
      status: creativeBrief ? 'complete' : 'current',
    },
    {
      step: '02',
      title: uiText('قرارات وسائط المنشورات', 'Post media decisions'),
      helper: uiText('راجع كل منشور في Content Hub واربط الوسائط بشكل صريح فقط.', 'Review each post in Content Hub and attach media only through an explicit action.'),
      status: !creativeBrief ? 'pending' : pendingPostMediaSlots > 0 ? 'current' : 'complete',
    },
    {
      step: '03',
      title: uiText('مرئيات مفهومية اختيارية', 'Optional concept visuals'),
      helper: uiText('أصول معرض للمراجعة فقط؛ ليست وسائط منشورات ولا إعلاناً نهائياً.', 'Gallery assets for review only; not post media and not final ad creative.'),
      status: creativeCanUseConceptGallery ? 'optional' : 'locked',
    },
  ] as const
  const creativeOperatingStepTone: Record<(typeof creativeOperatingSequence)[number]['status'], string> = {
    complete: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    current: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    pending: 'border-slate-200 bg-slate-50 text-slate-600',
    locked: 'border-slate-200 bg-slate-50 text-slate-500',
    optional: 'border-purple-200 bg-purple-50 text-purple-800',
  }
  const creativeOperatingStepLabel: Record<(typeof creativeOperatingSequence)[number]['status'], string> = {
    complete: uiText('تم', 'Done'),
    current: uiText('الآن', 'Now'),
    pending: uiText('بعد ذلك', 'Next'),
    locked: uiText('مقفل', 'Locked'),
    optional: uiText('اختياري', 'Optional'),
  }
  const renderCommandFlowIcon = (status: CampaignCommandFlowStepStatus) => {
    const iconClass = 'h-4 w-4 flex-shrink-0'
    if (status === 'complete') return <CheckCircle2 className={iconClass} />
    if (status === 'current') return <CircleDot className={iconClass} />
    if (status === 'review' || status === 'blocked') return <AlertTriangle className={iconClass} />
    return <Clock3 className={iconClass} />
  }
  const strategyExecutionPathStatus = (() => {
    if (strategyExecutionBridge.overallStatus === 'ready') {
      return uiText('متطلبات التنفيذ متاحة للمراجعة', 'Execution prerequisites available for review')
    }
    if (strategyExecutionBridge.overallStatus === 'checking') {
      return uiText('قيد فحص الاتصالات', 'Checking connections')
    }
    if (strategyExecutionBridge.overallStatus === 'not_in_scope') {
      return uiText('خارج نطاق هذا التشغيل', 'Outside this run')
    }
    return uiText('تحتاج اتصالات أو صلاحيات', 'Needs connections or permissions')
  })()
  const strategyExecutionPathItems: Array<{
    step: string
    title: string
    status: string
    helper: string
    href: string
    cta: string
    tone: 'positive' | 'warning' | 'muted'
  }> = [
    {
      step: '01',
      title: isPaidOnlyStrategy
        ? uiText('بريف التخطيط المدفوع', 'Paid planning brief')
        : uiText('مراجعة منشورات Content Hub', 'Review Content Hub posts'),
      status: isPaidOnlyStrategy
        ? uiText('مراجعة فقط — لا إطلاق', 'Review only — no launch')
        : strategyRoomStateCopy.contentPlanStatusValue,
      helper: isPaidOnlyStrategy
        ? (uiIsArabic
          ? 'راجع الزوايا والقيود ومدخلات الإطلاق قبل أي صرف أو إنشاء مسودات منصة.'
          : 'Review paid angles, constraints, and launch inputs before any spend or platform draft creation.')
        : operatingState.truthFlags.hasContentPlan
          ? (uiIsArabic
            ? 'راجع النسخ، حالة الوسائط، وحالة كل منشور قبل أي جدولة أو نشر.'
            : 'Review copy, media state, and each post lifecycle before scheduling or publishing.')
          : (uiIsArabic
            ? 'حضّر أول خطة محتوى بعد مراجعة القرار والافتراضات.'
            : 'Prepare the first content plan after reviewing the decision and assumptions.'),
      href: isPaidOnlyStrategy ? `/campaigns/${campaign.id}/paid-launch` : `/campaigns/${campaign.id}/content-hub`,
      cta: isPaidOnlyStrategy
        ? uiText('ابدأ تنفيذ الاستراتيجية', 'Start strategy execution')
        : strategyRoomStateCopy.contentHubCta,
      tone: operatingState.truthFlags.hasContentPlan || isPaidOnlyStrategy ? 'positive' : 'muted',
    },
    {
      step: '02',
      title: uiText('جاهزية الإبداع والوسائط', 'Creative and media readiness'),
      status: creativeHasPostRecords
        ? (uiIsArabic
          ? `${creativeRequirementsSummary.mediaNeeded} تحتاج وسائط · ${creativeRequirementsSummary.attachedToPost} مرتبطة`
          : `${creativeRequirementsSummary.mediaNeeded} need media · ${creativeRequirementsSummary.attachedToPost} attached`)
        : uiText('ينتظر منشورات Content Hub', 'Waiting for Content Hub posts'),
      helper: creativeHasPostRecords
        ? (uiIsArabic
          ? 'راجع متطلبات الوسائط والطبقات في تبويب الإبداع. لا توليد أو ربط تلقائي من هنا.'
          : 'Review media and layer requirements in Creative. Nothing generates or attaches automatically here.')
        : (uiIsArabic
          ? 'تظهر متطلبات الإبداع العملية بعد وجود منشورات مرتبطة في Content Hub.'
          : 'Practical creative requirements appear after post-linked Content Hub records exist.'),
      href: `/campaigns/${campaign.id}?tab=creative`,
      cta: uiText('راجع الإبداع', 'Review Creative'),
      tone: creativeRequirementsSummary.mediaNeeded > 0 ? 'warning' : creativeHasPostRecords ? 'positive' : 'muted',
    },
    {
      step: '03',
      title: includesPaidPlanningStrategy
        ? uiText('جاهزية المنصات والمدفوع', 'Platform and paid readiness')
        : uiText('جاهزية منصات النشر', 'Publishing platform readiness'),
      status: strategyExecutionPathStatus,
      helper: strategyExecutionBridge.overallStatus === 'ready'
        ? (uiIsArabic
          ? 'المتطلبات متاحة للمراجعة فقط. أي نشر أو إطلاق يحتاج تأكيداً صريحاً في مكانه الصحيح.'
          : 'Prerequisites are available for review only. Any publishing or launch still needs explicit confirmation in the right surface.')
        : (uiIsArabic
          ? 'راجع الاتصالات والصلاحيات قبل اعتبار النشر أو الإعلانات قابلة للتنفيذ.'
          : 'Review connections and permissions before treating publishing or ads as executable.'),
      href: '/connections',
      cta: uiText('راجع الاتصالات', 'Review Connections'),
      tone: strategyExecutionBridge.overallStatus === 'ready'
        ? 'positive'
        : strategyExecutionBridge.overallStatus === 'not_in_scope'
          ? 'muted'
          : 'warning',
    },
  ]
  const strategyExecutionPathTone: Record<'positive' | 'warning' | 'muted', string> = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    muted: 'border-slate-200 bg-slate-50 text-slate-700',
  }
  const strategyScopeTruth = isPaidOnlyStrategy
    ? uiText('تخطيط مدفوع فقط — لا محتوى عضوي', 'Paid planning only — no organic content')
    : includesPaidPlanningStrategy
      ? uiText('استراتيجية كاملة — المدفوع تخطيط فقط', 'Full strategy — paid is planning only')
      : uiText('استراتيجية عضوية فقط — لا صرف إعلاني', 'Organic strategy only — no ad spend')
  const strategyConfidenceTruth = displayedConfidenceLevel
    ? `${confLevelLabel(displayedConfidenceLevel, locale)}${missingDataLabels.length > 0
      ? uiText(` · ${missingDataLabels.length} مدخلات ناقصة`, ` · ${missingDataLabels.length} missing input${missingDataLabels.length === 1 ? '' : 's'}`)
      : ''}`
    : uiText('تحتاج مراجعة بشرية قبل التنفيذ', 'Needs human review before execution')
  const strategySnapshot = buildStrategySnapshot({
    campaignId: campaign.id,
    scope: strategyScope.type,
    goal: campaign.goal,
    planningHorizonDays: (aiOutput as any)?.strategyDeliverables?.planningHorizonDays
      ?? (aiOutput as any)?.strategyOrder?.durationDays,
    plannedOrganicPostCount: (aiOutput as any)?.strategyDeliverables?.organicPostCount
      ?? (aiOutput as any)?.strategyDeliverables?.requestedOrganicPostCount
      ?? (aiOutput as any)?.strategyOrder?.customOrganicPostCount,
    strategy,
    evidenceRefs: evidenceLedger,
    assumptions: [...safeAssumptions, ...safeExecutionAssumptions],
    missingInputs: missingDataLabels,
    riskFlags: [...riskNotes, ...safeExecutionAssumptions],
    approvalState: strategyApprovalTruth === 'approved'
      ? 'approved'
      : strategyApprovalTruth === 'blocked' || brandTruthBlocked
        ? 'blocked'
        : strategyApprovalTruth === 'revoked'
          ? 'superseded'
          : strategyApprovalTruth === 'ready_for_review'
            ? 'review'
            : 'draft',
    version: typeof (aiOutput as any)?.strategyVersion === 'number' ? (aiOutput as any).strategyVersion : null,
  })
  const strategyApprovalStatusLabel = !operatingSnapshotsLoaded
    ? uiText('جارٍ التحقق من قرار الاعتماد', 'Checking approval decision')
    : strategySnapshot.approvalState === 'approved'
      ? uiText('معتمدة للتنفيذ', 'Approved for execution')
      : strategySnapshot.approvalState === 'review'
        ? uiText('بانتظار مراجعتك', 'Awaiting your review')
        : strategySnapshot.approvalState === 'blocked'
          ? uiText('محجوبة حتى حل المتطلبات', 'Blocked pending requirements')
          : strategySnapshot.approvalState === 'superseded'
            ? uiText('اعتماد سابق ملغي', 'Previous approval revoked')
            : uiText('مسودة غير معتمدة', 'Unapproved draft')
  const strategyFulfillmentSummary = deriveStrategyFulfillmentSummary({
    aiOutput: campaign.aiOutput,
    posts: campaignPosts.map((post: any) => ({
      contentPlanIndex: post.contentPlanIndex,
      variantGroup: post.variantGroup,
    })),
    operatingSnapshotsLoaded,
    locale: uiIsArabic ? 'ar' : 'en',
  })
  const strategyFulfillmentToneClass: Record<StrategyFulfillmentTone, string> = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    danger: 'border-rose-200 bg-rose-50 text-rose-950',
    muted: 'border-slate-200 bg-slate-50 text-slate-700',
    checking: 'border-blue-200 bg-blue-50 text-blue-950',
  }
  const strategyOperatingTone: StrategyFulfillmentTone = !operatingSnapshotsLoaded
    ? 'checking'
    : [
      'strategy_missing',
      'strategy_review_needed',
      'content_plan_missing',
      'content_review_needed',
    ].includes(operatingState.stage)
      ? 'warning'
      : [
        'content_approved_not_scheduled',
        'scheduled_manual',
        'scheduled_auto',
        'auto_publish_enabled',
        'published_waiting_for_analytics',
        'performance_ready',
      ].includes(operatingState.stage)
        ? 'positive'
        : 'muted'
  const strategyFirstViewportTruthCards = [
    {
      label: uiText('نطاق هذه الحملة', 'This campaign scope'),
      value: strategyScopeTruth,
      helper: uiText('يعكس أمر التوليد المحفوظ لهذه الحملة فقط.', 'Reflects the saved generation order for this campaign only.'),
      tone: 'muted' as StrategyFulfillmentTone,
    },
    {
      label: strategyFulfillmentSummary.label,
      value: strategyFulfillmentSummary.value,
      helper: strategyFulfillmentSummary.helper,
      tone: strategyFulfillmentSummary.tone,
    },
    {
      label: uiText('الحالة التشغيلية', 'Operating state'),
      value: effectiveDisplayOperatingLabel,
      helper: uiText('Content Hub هو مصدر حقيقة المنشورات والوسائط.', 'Content Hub is the source of truth for posts and media.'),
      tone: strategyOperatingTone,
    },
    {
      label: uiText('الثقة والبيانات', 'Confidence and inputs'),
      value: strategyConfidenceTruth,
      helper: uiText('أي افتراضات تظل للمراجعة حتى تظهر أدلة أو تحليلات.', 'Assumptions stay review-only until proof or analytics exist.'),
      tone: 'muted' as StrategyFulfillmentTone,
    },
  ]
  const strategyReviewDeskCards = [
    {
      label: uiText('ما هذا؟', 'What this is'),
      value: uiText('وثيقة قرار وتشغيل، ليست زر إطلاق.', 'A decision and operating brief, not a launch button.'),
      tone: 'positive' as const,
    },
    {
      label: uiText('ما الذي لا يحدث هنا؟', 'What does not happen here'),
      value: uiText('لا توليد محتوى، لا نشر، لا جدولة، لا صرف، ولا تحديث تعلّم.', 'No content generation, publishing, scheduling, spend, or learning update.'),
      tone: 'muted' as const,
    },
    {
      label: uiText('أين القيمة الفعلية؟', 'Where the value lives'),
      value: uiText('الرسائل، الجمهور، المحتوى، التنفيذ، القياس، والمخاطر مقسمة أدناه.', 'Message, audience, content, execution, metrics, and risks are organized below.'),
      tone: 'default' as const,
    },
    {
      label: uiText('قرارك التالي', 'Your next decision'),
      value: strategyHeaderNextActionTitle,
      tone: strategyExecutionBridge.overallStatus === 'ready' ? 'positive' as const : 'warning' as const,
    },
  ]
  const luxuryStrategySteps = [
    {
      number: '1',
      label: uiText('الاستراتيجية', 'Strategy'),
      href: `/campaigns/${campaign.id}?tab=strategy`,
      active: activeTab === 0,
      status: brandTruthBlocked
        ? uiText('متوقفة لتصحيح Brand Brain', 'Blocked for Brand Brain correction')
        : operatingState.truthFlags.hasStrategy ? strategyApprovalStatusLabel : uiText('قيد الإعداد', 'Preparing'),
    },
    {
      number: '2',
      label: uiText('المحتوى', 'Content'),
      href: `/campaigns/${campaign.id}/content-hub`,
      active: false,
      status: brandTruthBlocked
        ? uiText('سجلات مرجعية محجوبة', 'Blocked reference records')
        : !operatingSnapshotsLoaded
        ? uiText('جارٍ التحقق من السجلات', 'Checking records')
        : operatingState.truthFlags.hasContentPlan
        ? uiText(`${operatingState.counts.totalPosts} عنصر`, `${operatingState.counts.totalPosts} items`)
        : uiText('غير مبني بعد', 'Not built yet'),
    },
    {
      number: '3',
      label: uiText('الإبداع', 'Creative'),
      href: `/campaigns/${campaign.id}?tab=creative`,
      active: activeTab === 3,
      status: brandTruthBlocked
        ? uiText('متوقف حتى التصحيح', 'Blocked pending fix')
        : !operatingSnapshotsLoaded
        ? uiText('جارٍ التحقق من الأصول', 'Checking assets')
        : creativeHasPostRecords
        ? uiText(`${creativeRequirementsSummary.mediaNeeded} تحتاج وسائط`, `${creativeRequirementsSummary.mediaNeeded} need media`)
        : uiText('ينتظر المحتوى', 'Waiting for content'),
    },
    {
      number: '4',
      label: uiText('النشر', 'Publishing'),
      href: `/campaigns/${campaign.id}?tab=publish`,
      active: activeTab === 4 || activeTab === 5,
      status: brandTruthBlocked
        ? uiText('متوقف حتى التصحيح', 'Blocked pending fix')
        : !operatingSnapshotsLoaded
        ? uiText('جارٍ التحقق من التنفيذ', 'Checking execution')
        : uiIsArabic ? publishTabSummary.safeCopy.title.ar : publishTabSummary.safeCopy.title.en,
    },
    {
      number: '5',
      label: uiText('التحليلات', 'Analytics'),
      href: `/campaigns/${campaign.id}?tab=performance`,
      active: activeTab === 6,
      status: operatingState.truthFlags.hasAnalyticsData
        ? uiText('بيانات متاحة', 'Data available')
        : !operatingSnapshotsLoaded
          ? uiText('جارٍ التحقق من البيانات', 'Checking data')
          : uiText('بانتظار بيانات حقيقية', 'Awaiting real data'),
    },
  ]
  // ── Empty section component ──────────────────────────────────────────────
  function EmptySection({ icon, message }: { icon: string; message: string }) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-3xl mb-3">{icon}</div>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    )
  }

  const mediaStrategy = aiOutput?.mediaStrategy || null
  const creativeAssets: any[] = mediaStrategy?.assets?.length
    ? mediaStrategy.assets
    : creativeBrief?.assetAnalyses || []

  const platformTheme = (platformRaw: string) => {
    const platform = (platformRaw || 'GENERAL').toUpperCase()
    if (platform.includes('INSTAGRAM')) return {
      key: 'INSTAGRAM', label: 'Instagram', icon: '📸', accent: '#e879f9',
      bg: 'linear-gradient(145deg, rgba(236,72,153,0.14), rgba(249,115,22,0.08))',
      border: 'rgba(236,72,153,0.28)',
    }
    if (platform.includes('TIKTOK')) return {
      key: 'TIKTOK', label: 'TikTok', icon: '🎵', accent: '#22d3ee',
      bg: 'linear-gradient(145deg, rgba(34,211,238,0.14), rgba(244,63,94,0.08))',
      border: 'rgba(34,211,238,0.28)',
    }
    if (platform.includes('LINKEDIN')) return {
      key: 'LINKEDIN', label: 'LinkedIn', icon: '💼', accent: '#60a5fa',
      bg: 'linear-gradient(145deg, rgba(37,99,235,0.16), rgba(14,165,233,0.06))',
      border: 'rgba(96,165,250,0.26)',
    }
    if (platform.includes('THREADS')) return {
      key: 'THREADS', label: 'Threads', icon: '@', accent: '#111827',
      bg: 'linear-gradient(145deg, rgba(17,24,39,0.12), rgba(99,102,241,0.06))',
      border: 'rgba(17,24,39,0.22)',
    }
    if (platform === 'X' || platform.includes('TWITTER')) return {
      key: 'X', label: 'X', icon: '𝕏', accent: '#111827',
      bg: 'linear-gradient(145deg, rgba(17,24,39,0.12), rgba(71,85,105,0.06))',
      border: 'rgba(17,24,39,0.22)',
    }
    if (platform.includes('YOUTUBE')) return {
      key: 'YOUTUBE', label: platform.includes('SHORT') ? 'YouTube Shorts' : 'YouTube', icon: '▶️', accent: '#ef4444',
      bg: 'linear-gradient(145deg, rgba(239,68,68,0.12), rgba(248,113,113,0.05))',
      border: 'rgba(239,68,68,0.22)',
    }
    if (platform.includes('PINTEREST')) return {
      key: 'PINTEREST', label: 'Pinterest', icon: '📌', accent: '#e60023',
      bg: 'linear-gradient(145deg, rgba(230,0,35,0.11), rgba(244,63,94,0.05))',
      border: 'rgba(230,0,35,0.22)',
    }
    if (platform.includes('FACEBOOK') || platform.includes('META')) return {
      key: 'FACEBOOK', label: 'Facebook', icon: '👥', accent: '#818cf8',
      bg: 'linear-gradient(145deg, rgba(99,102,241,0.14), rgba(59,130,246,0.06))',
      border: 'rgba(129,140,248,0.26)',
    }
    return {
      key: platform || 'GENERAL', label: platform || 'General', icon: '🌐', accent: '#a78bfa',
      bg: 'rgba(139,92,246,0.08)',
      border: 'rgba(139,92,246,0.2)',
    }
  }

  const resolvePreviewAsset = (item: any, index: number) => {
    if (item.imageUrl || item.url) return item.imageUrl || item.url
    const assetByName = creativeAssets.find((asset: any) => {
      const haystack = `${item.visualNote || ''} ${item.topic || ''} ${item.title || ''}`.toLowerCase()
      return asset.fileName && haystack.includes(String(asset.fileName).toLowerCase())
    })
    if (assetByName?.url) return assetByName.url
    const usable = creativeAssets.filter((asset: any) => asset.type !== 'VIDEO' && asset.url)
    return usable.length > 0 ? usable[index % usable.length].url : null
  }

  const monthlyPreviewItems = (() => {
    const items: any[] = []
    const pushed = Array.isArray(aiOutput?.calendarItems) ? aiOutput.calendarItems : []
    if (pushed.length > 0) {
      return pushed.map((item: any, index: number) => ({
        id: item.id || `pushed-${index}`,
        date: item.date,
        week: item.week,
        platform: item.platform || 'GENERAL',
        topic: item.topic || item.title || 'Campaign Post',
        title: item.title,
        hook: item.hook,
        caption: item.caption,
        cta: item.cta,
        visualNote: item.visualNote,
        contentType: item.contentType,
        assetUrl: resolvePreviewAsset(item, index),
      }))
    }

    contentCalendar.forEach((week: any, wi: number) => {
      ;(week.posts || []).forEach((post: any, pi: number) => {
        items.push({
          id: `week-${wi}-post-${pi}`,
          date: post.date || post.day || `${cdT?.weekLabel || 'Week'} ${week.week || wi + 1}`,
          week: week.week || wi + 1,
          platform: post.platform || 'GENERAL',
          topic: post.topic || post.contentPillar || post.title || 'Campaign Post',
          title: post.title || post.headline,
          hook: post.hook,
          caption: post.caption || post.content,
          cta: post.cta || post.callToAction,
          visualNote: post.visual || post.visualNote || post.visualDirection,
          contentType: post.type || post.format || post.contentType,
          assetUrl: resolvePreviewAsset(post, items.length),
        })
      })
    })
    return items
  })()

  const postsByPlatform = monthlyPreviewItems.reduce((acc: Record<string, any[]>, item: any) => {
    const key = platformTheme(item.platform).key
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
  const socialPostCalendarItems = campaignPosts
    .filter((post: any) => (post.status === 'SCHEDULED' || post.status === 'PUBLISHED') && post.scheduledAt)
    .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .map((post: any, index: number) => ({
      id: post.id || `social-post-${index}`,
      date: post.scheduledAt
        ? new Date(post.scheduledAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
      platform: post.platform || 'GENERAL',
      title: post.status === 'PUBLISHED'
        ? (locale === 'ar' ? 'منشور مؤكد يدويًا' : 'User-confirmed manual publish')
        : (locale === 'ar' ? 'منشور مجدول في NEXUS فقط' : 'Scheduled in NEXUS — not published'),
      topic: post.caption ? String(post.caption).slice(0, 96) : 'Campaign Post',
      caption: post.caption,
      cta: post.status === 'PUBLISHED'
        ? (locale === 'ar' ? 'سجل يدوي — ليس إثبات API' : 'Manual record — not API proof')
        : (locale === 'ar' ? 'النشر يتطلب خطوة منفصلة' : 'Publishing requires a separate step'),
      visualNote: post.imageUrl
        ? (locale === 'ar' ? 'وسائط مرتبطة للمراجعة' : 'Post-linked media for review')
        : (locale === 'ar' ? 'الوسائط تحتاج قرارًا' : 'Media decision needed'),
      contentType: post.status === 'PUBLISHED'
        ? (locale === 'ar' ? 'منشور يدويًا' : 'Manually published')
        : (locale === 'ar' ? 'مجدول فقط' : 'Scheduled only'),
      assetUrl: post.imageUrl || null,
    }))

  // Platform-native card is now handled by PlatformNativeCard component
  const _postBrandName = brandDNA?.brandName || campaign.name || 'NEXUS'

  return (
    <>
    <AppShell>
      <div className="max-w-[1200px] mx-auto px-6 py-8 page-enter">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/dashboard" className="transition hover:text-slate-950">{cdT?.breadcrumbHome}</Link>
          <span>/</span>
          <Link href="/campaigns" className="transition hover:text-slate-950">{cdT?.breadcrumbCampaigns}</Link>
          <span>/</span>
          <span className="max-w-xs truncate text-slate-800">{campaign.name}</span>
        </div>

        {brandTruthBlocked && (
          <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-950 shadow-[0_14px_36px_rgba(234,88,12,0.08)]" role="alert">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-200 bg-white text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black">{uiText('الحملة متوقفة بسبب تعارض في Brand Brain', 'Campaign blocked by a Brand Brain conflict')}</p>
                  <p className="mt-1 max-w-4xl text-[13px] font-semibold leading-6 text-orange-900/80">
                    {uiText(
                      `وجد NEXUS ${brandTruthReview.blockers.length} تعارضاً في مصدر الحقيقة. الاستراتيجية الحالية معروضة للمرجع فقط، وكل التوليد والنشر والصرف مقفل حتى التصحيح وإعادة إنشاء الاستراتيجية.`,
                      `NEXUS found ${brandTruthReview.blockers.length} source-truth conflict${brandTruthReview.blockers.length === 1 ? '' : 's'}. The current strategy is reference-only; generation, publishing, and spend stay locked until correction and strategy regeneration.`,
                    )}
                  </p>
                </div>
              </div>
              <Link href="/brand" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-700 px-4 text-sm font-black text-white">
                {uiText('تصحيح Brand Brain', 'Fix Brand Brain')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Brand Brain quality notice (shown when score < 60 and not dismissed) */}
        {brandScore !== null && brandScore < 60 && !brandNoticeDismissed && (() => {
          const bg = t('brandGate') as Record<string, string>
          return (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 justify-between"
              style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.18)' }}>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="text-sm" style={{ color: '#FFB800' }}>⚠</span>
                <p className="text-xs text-text-muted">{bg.campaignNotice}</p>
                <Link href="/brand"
                  className="text-[11px] font-bold flex-shrink-0"
                  style={{ color: '#FFB800' }}>
                  {bg.campaignNoticeBtn} →
                </Link>
              </div>
              <button
                onClick={() => setBrandNoticeDismissed(true)}
                className="flex-shrink-0 px-1 text-xs text-slate-400 transition-all hover:text-slate-700">
                ✕
              </button>
            </div>
          )
        })()}

        {aiOutput && activeTab === 0 && (
          <section className="mb-5 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div className="p-4 lg:p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-3 py-1 ${brandTruthBlocked ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {brandTruthBlocked
                          ? uiText('متوقفة حتى تصحيح Brand Brain', 'Blocked until Brand Brain is fixed')
                          : operatingState.truthFlags.hasStrategy ? strategyApprovalStatusLabel : uiText('قيد الإعداد', 'Preparing')}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-500">
                        {strategyScopeTruth}
                      </span>
                    </div>
                    <h1 className="max-w-3xl text-xl font-semibold tracking-tight text-slate-950 lg:text-2xl">
                      {campaign.name}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      {strategy.positioning || strategy.keyMessage || campaign.description || effectiveDisplayOperatingHelper}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>{uiText('أُنشئت', 'Created')}: {timeAgo(campaign.createdAt)}</span>
                      <span>{uiText('الهدف', 'Goal')}: {strategyDocDisplayValue(campaign.goal)}</span>
                      <span>{uiText('المنصات', 'Platforms')}: {campaign.platforms.map((p) => formatStrategyPlatformLabel(p) || p).join(' · ') || uiText('غير محددة', 'Not set')}</span>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-5 xl:min-w-[500px]">
                  {luxuryStrategySteps.map((step) => (
                    <Link
                      key={step.number}
                      href={step.href}
                      className={`relative rounded-[14px] border p-2.5 text-center transition hover:-translate-y-0.5 hover:shadow-sm ${
                        step.active
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-800 shadow-[0_0_0_1px_rgba(99,102,241,0.08)]'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        step.active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {step.number}
                      </span>
                      <span className="mt-2 block text-xs font-bold">{step.label}</span>
                      <span className="mt-1 block text-[10px] leading-4 text-current/65">{step.status}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

          </section>
        )}

        {/* FL4: Content-plan banner — shown when stored content-plan posts exist. */}
        {activeTab !== 0 && operatingState.truthFlags.hasContentPlan && (() => {
          const postCount = operatingState.counts.totalPosts
          return (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-4"
              style={brandTruthBlocked
                ? { background: '#FFF7ED', border: '1px solid rgba(234,88,12,0.24)' }
                : { background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`text-sm flex-shrink-0 ${brandTruthBlocked ? 'text-orange-700' : 'text-green-400'}`}>
                  {brandTruthBlocked ? '⚠' : '✅'}
                </span>
                <p className={`text-xs ${brandTruthBlocked ? 'font-semibold text-orange-800' : 'text-emerald-700'}`}>
                  {brandTruthBlocked
                    ? (locale === 'ar'
                        ? `${postCount} سجلات محتوى قديمة محجوبة — للرجوع فقط حتى تصحيح Brand Brain`
                        : `${postCount} older content records are blocked — reference only until Brand Brain is fixed`)
                    : locale === 'ar'
                    ? `${postCount} عنصر محتوى في الخطة — راجع الحالة في Content Hub`
                    : `${postCount} content item${postCount !== 1 ? 's' : ''} in the plan — review status in Content Hub`}
                </p>
              </div>
              <Link
                href={brandTruthBlocked ? '/brand' : `/campaigns/${campaign.id}/content-hub`}
                className="text-xs font-bold flex-shrink-0 px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
                style={brandTruthBlocked
                  ? { background: '#FFEDD5', border: '1px solid rgba(234,88,12,0.24)', color: '#9A3412' }
                  : { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#047857' }}>
                {brandTruthBlocked
                  ? (locale === 'ar' ? 'تصحيح Brand Brain' : 'Fix Brand Brain')
                  : (locale === 'ar' ? 'مركز المحتوى →' : 'View Content Hub →')}
              </Link>
            </div>
          )
        })()}

        {/* Above-the-fold operating decision — keep the real next step visible before summary/proof detail. */}
        {aiOutput && activeTab !== 0 && (
          <section
            data-campaign-first-viewport-action
            className="mb-4 overflow-hidden rounded-[24px] border border-indigo-100 bg-white shadow-sm"
          >
            <div className="h-px bg-gradient-to-r from-indigo-300 via-sky-200 to-emerald-200" />
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                    {firstViewportAction.eyebrow}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    {firstViewportAction.workspace}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                  {firstViewportAction.title}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {firstViewportAction.helper}
                </p>
                {activeTab === 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {strategyFirstViewportTruthCards.map((item) => (
                      <div key={item.label} className={`rounded-2xl border px-3 py-3 ${strategyFulfillmentToneClass[item.tone]}`}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-current/45">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-current">
                          {item.value}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-current/70">
                          {item.helper}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {activeTab !== 0 && !brandTruthBlocked && !engineRunning && operatingState.stage === 'strategy_review_needed' ? (
                <button
                  type="button"
                  onClick={() => setShowSentinelConfirm(true)}
                  disabled={sentinelState === 'reviewing'}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {sentinelState === 'reviewing'
                    ? uiText('يجري الفحص...', 'Reviewing...')
                    : uiText(`فحص الجودة — ${sentinelCreditCost} كريديت`, `Review quality — ${sentinelCreditCost} credits`)}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : activeTab !== 0 && !brandTruthBlocked && !isPaidOnlyStrategy && !engineRunning && completeQualityReviewPassed && operatingState.stage === 'content_plan_missing' ? (
                <button
                  type="button"
                  onClick={() => {
                    setLaunchError('')
                    setApprovalState('confirming')
                  }}
                  disabled={approvalState === 'approving' || launchState === 'approving' || launchState === 'generating'}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {uiText('اعتماد الاستراتيجية وبناء المحتوى', 'Approve strategy and build content')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : firstViewportAction.href.startsWith('#') ? (
                <a
                  href={firstViewportAction.href}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {firstViewportAction.label}
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <Link
                  href={firstViewportAction.href}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {firstViewportAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </section>
        )}

        {/* What NEXUS did here — Proof of Work (Operator Foundation PR-1C1, read-only) */}
        {activeTab !== 0 && showLegacyCampaignSummaryPanels && (brandTruthBlocked ? (
          <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3" dir={uiIsArabic ? 'rtl' : 'ltr'}>
            <p className="text-sm font-semibold text-orange-950">
              {uiText('المخرجات السابقة محفوظة كمرجع فقط', 'Previous outputs are retained as reference only')}
            </p>
            <p className="mt-1 text-xs leading-5 text-orange-800">
              {uiText('لا تُعد الاستراتيجية أو مسودات المحتوى عملاً مكتملًا أو صالحًا للتنفيذ بعد اكتشاف تعارض Brand Brain. لا اعتماد ولا توليد ولا خصم كريديت حتى التصحيح.', 'The strategy and content drafts are not treated as complete or executable after the Brand Brain conflict was detected. No approval, generation, or credit spend is available until it is fixed.')}
            </p>
          </div>
        ) : <CampaignProofOfWork campaignId={campaign.id} campaign={campaign as any} compact />)}

        {/* Brief banner — shown when arriving from Marketing Operating Brief */}
        {fromBrief && !briefBannerDismissed && (
          <div className="rounded-2xl overflow-hidden mb-4"
            style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.3)', backdropFilter: 'blur(12px)' }}>
            <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)' }} />
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <Sparkles className="w-4 h-4" style={{ color: '#A78BFA' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold mb-0.5" style={{ color: '#C4B5FD' }}>
                    {locale === 'ar' ? 'NEXUS يقترح إنشاء خطة محتوى' : 'NEXUS recommends generating a content plan'}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--nx-text-3)' }}>
                    {locale === 'ar'
                      ? 'الاستراتيجية جاهزة — ابدأ بإنشاء خطة محتوى كاملة عند استعدادك للمراجعة.'
                      : 'Strategy is ready — generate a full content plan when you are ready to review it.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBriefBannerDismissed(true)}
                className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                style={{ color: 'var(--nx-text-3)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Header card — light campaign summary */}
        {activeTab !== 0 && showLegacyCampaignSummaryPanels && <div className="mb-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="h-px bg-gradient-to-r from-indigo-200 via-sky-100 to-emerald-100" />
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #eef2ff, #f8fafc)', border: '1px solid rgb(226,232,240)' }}>
                  {campaign.thumbnail || '🎯'}
                </div>
                <div>
                  <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-950">{campaign.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span className="capitalize">{campaign.goal?.toLowerCase()}</span>
                    <span className="text-slate-300">·</span>
                    {campaignToneLabel && (
                      <>
                        <span>{locale === 'ar' ? 'نبرة: ' : 'Tone: '}{campaignToneLabel}</span>
                        <span className="text-slate-300">·</span>
                      </>
                    )}
                    <span>{cdT?.createdLabel?.replace('{timeAgo}', timeAgo(campaign.createdAt) ?? '')}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {campaign.platforms.map(p => (
                      <span key={p} className="text-base" title={formatStrategyPlatformLabel(p) || p}>{PLATFORM_ICONS[p.toUpperCase()] || '🌐'}</span>
                    ))}
                  </div>
                  {campaign.audience && (
                    <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">{cdT?.audienceLabel}: {campaign.audience}</p>
                  )}
                  {/* Campaign operating state badge */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${operatingTone[operatingState.stage]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {effectiveDisplayOperatingLabel}
                    </span>
                    <span className="text-xs text-slate-400">
                      {effectiveDisplayOperatingHelper}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions — primary CTA + overflow menu */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={brandTruthBlocked ? '/brand' : '/campaigns/new'}
                  className="px-3 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap"
                  style={{ background: brandTruthBlocked ? '#9A3412' : '#4f46e5', color: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.12)' }}
                >
                  {brandTruthBlocked
                    ? uiText('تصحيح Brand Brain', 'Fix Brand Brain')
                    : cdT?.btnNewCampaign || '+ New Campaign'}
                </Link>
                {/* Overflow menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowHeaderMenu(v => !v)}
                    className="px-3 py-2 rounded-xl text-sm font-bold transition"
                    style={{ background: '#f8fafc', border: '1px solid rgb(226,232,240)', color: '#475569' }}
                    title={locale === 'ar' ? 'المزيد' : 'More options'}
                  >
                    ···
                  </button>
                  {showHeaderMenu && (
                    <>
                      {/* Click-away backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setShowHeaderMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 min-w-44 rounded-xl shadow-2xl overflow-hidden"
                        style={{ background: '#fff', border: '1px solid rgb(226,232,240)' }}>
                        <button
                          onClick={() => { updateCampaign({ favorite: !campaign.favorite }); setShowHeaderMenu(false) }}
                          disabled={saving}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-slate-50"
                          style={{ color: campaign.favorite ? '#ca8a04' : '#334155' }}
                        >
                          {campaign.favorite
                            ? (locale === 'ar' ? '★ إزالة من المفضلة' : '★ Remove from favorites')
                            : (locale === 'ar' ? '☆ إضافة إلى المفضلة' : '☆ Add to favorites')}
                        </button>
                        <button
                          onClick={() => {
                            setCampaignActionError('')
                            setCampaignAction('duplicate')
                            setShowHeaderMenu(false)
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-slate-50"
                          style={{ color: '#334155' }}
                        >
                          {`⧉ ${cdT?.btnDuplicate || 'Duplicate'}`}
                        </button>
                        <button
                          onClick={() => window.open(`/campaigns/${campaign.id}/print`, '_blank')}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-slate-50"
                          style={{ color: '#334155' }}
                        >
                          {`⬇ ${cdT?.btnExportPdf || 'Export PDF'}`}
                        </button>
                        <div className="h-px mx-3 bg-slate-100" />
                        <button
                          onClick={() => {
                            setCampaignActionError('')
                            setCampaignAction(campaign.status === 'ARCHIVED' ? 'restore' : 'archive')
                            setShowHeaderMenu(false)
                          }}
                          disabled={saving}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-slate-50"
                          style={{ color: campaign.status === 'ARCHIVED' ? '#4f46e5' : '#64748b' }}
                        >
                          {campaign.status === 'ARCHIVED' ? `↩ ${cdT?.btnRestore || 'Restore'}` : `📦 ${cdT?.btnArchive || 'Archive'}`}
                        </button>
                        <div className="h-px mx-3 bg-slate-100" />
                        <div className="px-4 py-3 text-left">
                          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                            {locale === 'ar' ? 'إجراء حساس' : 'Dangerous action'}
                          </p>
                          {brandTruthBlocked ? (
                            <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                              <p className="text-xs font-semibold leading-5 text-orange-800">
                                {uiText('إعادة البناء المدفوعة مقفلة حتى تصحيح Brand Brain، ولن يُخصم أي كريديت.', 'Credit-spending rebuild is locked until Brand Brain is fixed, and no credits will be charged.')}
                              </p>
                              <Link href="/brand" className="mt-2 inline-flex text-xs font-bold text-orange-900 underline underline-offset-2">
                                {uiText('تصحيح Brand Brain', 'Fix Brand Brain')}
                              </Link>
                            </div>
                          ) : engineRebuildStatusPending ? (
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {locale === 'ar'
                                ? 'يتم التحقق من حالة المنشورات قبل إتاحة أي إعادة بناء مدفوعة.'
                                : 'Checking post status before any credit-spending rebuild can be available.'}
                            </p>
                          ) : engineRebuildLockedByProgress ? (
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {locale === 'ar'
                                ? 'إعادة البناء مقفلة لأن هذه الحملة لديها منشورات معتمدة أو مجدولة أو منشورة. يلزم مسار خطة مسودة جديدة قبل إعادة توليد مخرجات الحملة.'
                                : 'Rebuild is locked because this campaign already has approved, scheduled, or published posts. Create a new draft plan flow is required before regenerating campaign outputs.'}
                            </p>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setShowHeaderMenu(false)
                                  setEngineRebuildAcknowledged(false)
                                  setShowEngineRebuildModal(true)
                                }}
                                disabled={engineRunning}
                                className="mt-2 w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                              >
                                {locale === 'ar' ? 'إعادة بناء حزمة الحملة' : 'Rebuild campaign package'}
                              </button>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {locale === 'ar'
                                  ? `يكلف ${ENGINE_REBUILD_CREDIT_COST} كريديت ويستبدل مخرجات استراتيجية/حزمة الحملة. لا ينشر أو يجدول أو يحدّث المنشورات الحالية.`
                                  : `Costs ${ENGINE_REBUILD_CREDIT_COST} credits and overwrites campaign strategy/package output. Does not publish, schedule, or update existing SocialPosts.`}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>}

        {/* ── Campaign Progress Panel ─────────────────────────────────────
            The full map belongs on Strategy. Other tabs prioritize the active
            workspace after the top decision strip so the user is not forced
            through a large overview before doing the current job. */}
        {aiOutput && showFullCampaignOperatingFlow && activeTab !== 0 && (
          <div id="campaign-operating-flow" className="mb-6 scroll-mt-24 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-500">
                      {uiIsArabic ? campaignCommandFlow.scopeLabelAr : campaignCommandFlow.scopeLabelEn}
                    </span>
                    <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                      {uiText('تشغيل منظم', 'Operating flow')}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                    {uiIsArabic ? campaignCommandFlow.headlineAr : campaignCommandFlow.headlineEn}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {uiIsArabic ? campaignCommandFlow.helperAr : campaignCommandFlow.helperEn}
                  </p>
                  <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                    {uiIsArabic ? campaignCommandFlow.boundaryAr : campaignCommandFlow.boundaryEn}
                  </p>
                </div>

                <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:max-w-sm">
                  <p className="text-[11px] font-bold text-slate-400">
                    {uiText('الإجراء التالي', 'Next action')}
                  </p>
                  <p className="mt-1 text-base font-semibold leading-6 text-slate-950">
                    {uiIsArabic ? campaignCommandFlow.nextAction.titleAr : campaignCommandFlow.nextAction.titleEn}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {uiIsArabic ? campaignCommandFlow.nextAction.helperAr : campaignCommandFlow.nextAction.helperEn}
                  </p>
                  <Link
                    href={campaignCommandFlow.nextAction.href}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {uiIsArabic ? campaignCommandFlow.nextAction.labelAr : campaignCommandFlow.nextAction.labelEn}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
                {campaignCommandFlow.steps.map((step, index) => (
                  <Link
                    key={step.id}
                    href={step.href}
                    className={`group flex min-h-[168px] flex-col rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${commandFlowStepTone[step.status]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold text-current/45">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${commandFlowPillTone[step.status]}`}>
                        {renderCommandFlowIcon(step.status)}
                        {commandFlowStatusLabel(step.status)}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold leading-5">
                      {uiIsArabic ? step.titleAr : step.titleEn}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-current/55">
                      {uiIsArabic ? step.metricAr : step.metricEn}
                    </p>
                    <p className="mt-2 flex-1 text-xs leading-5 text-current/75">
                      {uiIsArabic ? step.helperAr : step.helperEn}
                    </p>
                  </Link>
                ))}
              </div>

              {/* ── Status message + context-aware primary CTA ── */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${engineRunning ? 'text-amber-700' : 'text-slate-950'}`}>
                    {engineRunning
                      ? (locale === 'ar' ? '⏳ يجري إعداد المخرجات...' : '⏳ Preparing campaign outputs...')
                      : effectiveDisplayOperatingLabel}
                  </p>
                  {!engineRunning && (
                    <p className="mt-1 text-xs leading-5 text-slate-500">{effectiveDisplayOperatingHelper}</p>
                  )}
                  {(engineError || generateError) && (
                    <p className="text-xs text-red-400 mt-1">{engineError || generateError}</p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                {/* Primary CTA — context aware, one at a time */}
                {activeTab !== 0 && !brandTruthBlocked && !engineRunning && operatingState.stage === 'strategy_review_needed' && (
                  <button
                    onClick={() => setShowSentinelConfirm(true)}
                    disabled={sentinelState === 'reviewing'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60"
                    style={{ background: '#2563eb', color: '#fff' }}
                  >
                    {sentinelState === 'reviewing'
                      ? '⏳...'
                      : sentinelStatus === 'needs_attention'
                        ? (locale === 'ar'
                          ? `طبّق الإصلاح الآمن وأعد الفحص — ${sentinelCreditCost} كريديت`
                          : `Apply safe correction and re-review — ${sentinelCreditCost} credits`)
                        : (locale === 'ar'
                          ? `🔍 فحص الجودة — ${sentinelCreditCost} كريديت`
                          : `🔍 Review quality — ${sentinelCreditCost} credits`)}
                  </button>
                )}

                {activeTab !== 0 && !isPaidOnlyStrategy && !engineRunning && completeQualityReviewPassed && operatingState.stage === 'content_plan_missing' && !brandTruthBlocked && (
                  <button
                    onClick={() => {
                      setLaunchError('')
                      setApprovalState('confirming')
                    }}
                    disabled={approvalState === 'approving' || launchState === 'approving' || launchState === 'generating'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60"
                    style={{ background: '#059669', color: '#fff' }}
                  >
                    {launchState === 'approving'
                      ? (locale === 'ar' ? '⏳ يجري إعداد المحتوى...' : '⏳ Preparing content...')
                      : launchState === 'generating'
                        ? (locale === 'ar' ? '⚙️ جارٍ إنشاء الخطة...' : '⚙️ Generating plan...')
                        : (locale === 'ar' ? 'إنشاء خطة المحتوى' : 'Build content plan')}
                  </button>
                )}

                {activeTab !== 0 && !brandTruthBlocked && operatingState.truthFlags.hasContentPlan && (
                  <Link
                    href={operatingActionHref}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={{ background: '#4f46e5', color: '#fff' }}
                  >
                    {operatingActionLabel}
                  </Link>
                )}

                {engineRunning && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-500">
                    <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
                    {locale === 'ar' ? 'جاري التشغيل...' : 'Running...'}
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* ── Quality review detail — collapsible ── */}
            {(sentinelReview || qualityGate) && (
              <details className="mt-4">
                <summary className={`cursor-pointer text-xs font-semibold select-none ${
                  completeQualityReviewPassed ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {completeQualityReviewPassed
                    ? (locale === 'ar' ? '✓ مراجعة الحقيقة والجودة مكتملة — عرض التفاصيل ▾' : '✓ Truth and quality review complete — see details ▾')
                    : (locale === 'ar' ? '⚠ المراجعة غير مكتملة أو محجوبة — عرض التفاصيل ▾' : '⚠ Review incomplete or blocked — see details ▾')}
                </summary>
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  <div className={`rounded-xl border p-3 ${
                    qualityGatePassed
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {locale === 'ar'
                            ? 'تأسيس الاستراتيجية على الـ Brand Brain والنطاق المعتمد'
                            : 'Brand Brain and approved-scope grounding'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {qualityGate
                            ? (locale === 'ar'
                                ? 'فحص حتمي بلا استهلاك كريديت يمنع اختراع الجمهور أو القنوات أو تحويل نشاط البراند إلى نشاط آخر.'
                                : 'A deterministic, zero-credit gate that blocks invented audiences, channels, or a change in the brand\'s business model.')
                            : (locale === 'ar'
                                ? 'هذه استراتيجية قديمة ولم تمر بعد ببوابة الحقيقة الحالية.'
                                : 'This legacy strategy has not passed the current truth gate yet.')}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        qualityGatePassed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {qualityGatePassed
                          ? (locale === 'ar' ? 'ناجح' : 'Passed')
                          : (locale === 'ar' ? 'محجوب' : 'Blocked')}
                      </span>
                    </div>
                    {Array.isArray(qualityGate?.blockers) && qualityGate.blockers.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-amber-200 pt-3">
                        {qualityGate.blockers.map((blocker: string, index: number) => (
                          <p key={`${blocker}-${index}`} className="flex items-start gap-2 text-xs leading-5 text-amber-900">
                            <span aria-hidden="true">•</span>
                            <span>{blocker}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {sentinelReview && <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-500">{cdT?.sentinelRiskScore || 'Risk Score'}</span>
                        <span className={`text-sm font-bold ${sentinelReview.riskScore < 30 ? 'text-green-400' : sentinelReview.riskScore < 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {sentinelReview.riskScore}/100
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${sentinelReview.riskScore < 30 ? 'bg-green-500' : sentinelReview.riskScore < 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${sentinelReview.riskScore}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{cdT?.sentinelRiskLow || 'Lower is better'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-500">{cdT?.sentinelBrandScore || 'Brand Match'}</span>
                        <span className={`text-sm font-bold ${sentinelReview.brandConsistencyScore >= 75 ? 'text-green-400' : sentinelReview.brandConsistencyScore >= 55 ? 'text-amber-400' : 'text-red-400'}`}>
                          {sentinelReview.brandConsistencyScore}/100
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${sentinelReview.brandConsistencyScore >= 75 ? 'bg-green-500' : sentinelReview.brandConsistencyScore >= 55 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${sentinelReview.brandConsistencyScore}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{cdT?.sentinelBrandHigh || 'Higher is better'}</p>
                    </div>
                  </div>
                  {sentinelReview.summary && (
                    <p className="text-sm leading-relaxed text-slate-600">{sentinelReview.summary}</p>
                  )}
                  {sentinelReview.complianceWarnings?.length > 0 && (
                    <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <p className="text-xs font-bold text-amber-400 mb-2">{cdT?.sentinelComplianceWarnings || 'Compliance Warnings'}</p>
                      {sentinelReview.complianceWarnings.map((w: string, i: number) => (
                        <p key={i} className="mb-1 flex items-start gap-2 text-xs text-amber-700"><span className="flex-shrink-0">⚠</span>{w}</p>
                      ))}
                    </div>
                  )}
                  {sentinelReview.recommendedFixes?.length > 0 && (
                    <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                      <p className="text-xs font-bold text-blue-400 mb-2">{cdT?.sentinelRecommendedFixes || 'Recommended Fixes'}</p>
                      {sentinelReview.recommendedFixes.map((fix: string, i: number) => (
                        <p key={i} className="mb-1 flex items-start gap-2 text-xs text-blue-700"><span className="flex-shrink-0 text-blue-500">→</span>{fix}</p>
                      ))}
                    </div>
                  )}
                  </>}
                </div>
              </details>
            )}

            {/* Not yet reviewed hint */}
            {!sentinelReview && !qualityGate && sentinelState !== 'reviewing' && (
              <p className="mt-3 text-xs text-gray-600">
                {strategyGuidanceCopy.hint}
              </p>
            )}
            {sentinelState === 'reviewing' && (
              <div className="mt-3 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-xs text-blue-600">{locale === 'ar' ? 'يجري فحص جودة الحملة...' : 'Reviewing campaign quality...'}</p>
              </div>
            )}
            {sentinelError && sentinelState === 'idle' && (
              <p className="mt-2 text-xs text-red-400">⚠️ {sentinelError}</p>
            )}

          </div>
        )}

        {/* Generating state */}
        {!aiOutput && generating && (
          <div className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 p-12 text-center shadow-sm">
            <div className="text-5xl mb-4 animate-bounce">🤖</div>
            <h3 className="text-xl font-bold mb-2 text-amber-900">{cdT?.generatingTitle}</h3>
            <p className="mb-6 text-sm text-amber-800">{cdT?.generatingSubtitle}</p>
            <div className="flex justify-center gap-4 mb-4 flex-wrap">
              {([cdT?.genStep1, cdT?.genStep2, cdT?.genStep3, cdT?.genStep4]).map((step, i) => (
                <div key={i} className="flex items-center gap-1 text-xs text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500/50 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  {step}
                </div>
              ))}
            </div>
            <div className="w-48 h-1 bg-amber-100 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* No AI output state (not generating) — NEXUS UI */}
        {!aiOutput && !generating && (
          <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
              <span className="text-3xl">🤖</span>
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-950">{cdT?.noOutputTitle}</h3>
            <p className="mb-6 text-sm text-slate-500">{cdT?.noOutputDesc}</p>
            <button
              onClick={() => handleRunEngine()}
              disabled={engineRunning}
              className="px-6 py-3 rounded-xl font-bold transition disabled:opacity-60"
              style={{ background: '#4f46e5', color: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.12)' }}>
              {engineRunning
                ? (locale === 'ar' ? '⏳ جاري التوليد...' : '⏳ Generating...')
                : (cdT?.noOutputBtn || (locale === 'ar' ? 'توليد الاستراتيجية الكاملة' : 'Generate Full Strategy'))}
            </button>
            {generateError && (
              <p className="mt-3 text-sm text-red-400">{generateError}</p>
            )}
          </div>
        )}

        {/* Tabs + content */}
        {aiOutput && (
          <>
            {/* NEXUS tab navigation */}
            <div id="campaign-room-workspace" data-strategy-operating-nav className="sticky top-0 z-30 mb-6 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    {locale === 'ar' ? 'مساحة الحملة الحالية' : 'Current campaign workspace'}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    <span className="me-1.5 text-xs">{AGENT_TABS[activeTab]?.icon}</span>
                    {AGENT_TABS[activeTab]?.label || cdT?.tabStrategy || 'Strategy'}
                  </p>
                </div>
                <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500 sm:min-w-[260px]">
                  <span className="whitespace-nowrap">{locale === 'ar' ? 'تغيير المساحة' : 'Switch workspace'}</span>
                  <select
                    aria-label={locale === 'ar' ? 'تغيير مساحة الحملة' : 'Switch campaign workspace'}
                    value={activeTab}
                    onChange={(event) => handleCampaignRoomTabClick(Number(event.target.value))}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white"
                  >
                    {AGENT_TABS.map((tab, index) => tab.hidden && index !== activeTab ? null : (
                      <option key={index} value={index} hidden={Boolean(tab.hidden)}>{tab.icon} {tab.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {activeTab === 0 && strategySectionNavItems.length > 0 && showStrategyDocument && (
                <details className="mt-3 border-t border-slate-200 pt-3">
                  <summary className="cursor-pointer text-xs font-bold text-indigo-700">
                    {strategyDocText(`أقسام وثيقة الاستراتيجية (${strategySectionNavItems.length})`, `Strategy document sections (${strategySectionNavItems.length})`)}
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {strategySectionNavItems.map(({ num, label, id }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => scrollToStrategySection(id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <span className="text-[10px] text-slate-400">{num}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* ── Tab 0: Strategy (Strategist) ─────────────────────────────── */}
            {activeTab === 0 && !showStrategyDocument && (
              <StrategyDecisionDesk
                campaign={campaign}
                snapshot={strategySnapshot}
                strategy={strategy}
                brandProfile={brandDNA as Record<string, any> | null}
                strategyScopeTruth={strategyScopeTruth}
                strategyConfidenceTruth={strategyConfidenceTruth}
                operatingState={operatingState}
                fulfillment={strategyFulfillmentSummary}
                executionBridge={strategyExecutionBridge}
                creativeSummary={creativeRequirementsSummary}
                brandScore={brandScore}
                brandTruthBlocked={brandTruthBlocked}
                missingData={missingDataLabels}
                evidenceItems={evidenceLedger}
                actualPosts={campaignPosts.map((post: any) => ({
                  id: String(post.id),
                  platform: post.platform,
                  status: post.status,
                  caption: post.caption,
                  imageUrl: post.imageUrl,
                  publishedAt: post.publishedAt,
                  scheduledAt: post.scheduledAt,
                  analyticsData: post.analyticsData,
                }))}
                platformStates={strategyPlatformStates}
                nextAction={{
                  title: strategyHeaderNextActionTitle,
                  helper: strategyHeaderNextActionHelper,
                  label: strategyDeskCanReviewQuality
                    ? (sentinelStatus === 'needs_attention'
                      ? uiText('طبّق الإصلاح الآمن وأعد الفحص', 'Apply safe correction and re-review')
                      : uiText('ابدأ فحص الجودة', 'Start quality review'))
                    : strategyDeskCanApproveAndBuild
                      ? (campaign.status === 'ACTIVE'
                        ? uiText('أنشئ خطة المحتوى', 'Build content plan')
                        : uiText('اعتمد الاستراتيجية وأنشئ الخطة', 'Approve strategy and build plan'))
                      : strategyHeaderNextActionLabel,
                  href: strategyHeaderNextActionHref,
                  costLabel: strategyDeskCanReviewQuality
                    ? uiText(`${sentinelCreditCost} كريديت`, `${sentinelCreditCost} credits`)
                    : strategyDeskCanApproveAndBuild
                      ? uiText(`${contentPlanCreditCost} كريديت`, `${contentPlanCreditCost} credits`)
                      : null,
                }}
                onNextAction={strategyDeskCanReviewQuality
                  ? () => setShowSentinelConfirm(true)
                  : strategyDeskCanApproveAndBuild
                    ? () => {
                      setLaunchError('')
                      setApprovalState('confirming')
                    }
                    : undefined}
                nextActionDisabled={sentinelState === 'reviewing'
                  || approvalState === 'approving'
                  || launchState === 'approving'
                  || launchState === 'generating'}
                qualityState={sentinelStatus}
                locale={uiIsArabic ? 'ar' : 'en'}
                onReadDocument={() => setShowStrategyDocument(true)}
              />
            )}
            {activeTab === 0 && showStrategyDocument && (
              <div className="space-y-5">
                <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-white px-5 py-6 sm:px-7">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-4xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                            {uiText('مركز قيادة الاستراتيجية', 'Strategy command center')}
                          </span>
                          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                            {uiText('مراجعة قبل التنفيذ', 'Review before execution')}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                            {strategyScopeTruth}
                          </span>
                          {sentinelStatus === 'passed' && !brandTruthBlocked && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                              {uiText('✓ فحص الجودة مكتمل', '✓ Quality review complete')}
                            </span>
                          )}
                          {brandTruthBlocked && (
                            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700">
                              {uiText('تعارض Brand Brain يمنع التنفيذ', 'Brand Brain conflict blocks execution')}
                            </span>
                          )}
                          {sentinelStatus === 'needs_attention' && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                              {uiText('فحص الجودة يحتاج معالجة', 'Quality findings need attention')}
                            </span>
                          )}
                        </div>
                        <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                          {uiText('مكتب مراجعة الاستراتيجية', 'Strategy review desk')}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                          {uiText(
                            'ابدأ من القرار التنفيذي: ما النطاق، ما الجاهز، ما الناقص، وما الخطوة الصحيحة قبل تحويل الاستراتيجية إلى محتوى أو إبداع أو نشر.',
                            'Start with the executive decision: scope, readiness, gaps, and the right next step before turning strategy into content, creative, or publishing.',
                          )}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {campaign.name}
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">
                              {uiText('الإجراء التالي', 'Next action')}
                            </p>
                            <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">
                              {strategyHeaderNextActionTitle}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {strategyHeaderNextActionHelper}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                              {uiText('حدود التشغيل', 'Operating boundary')}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {uiIsArabic
                                ? 'لا نشر، لا جدولة، لا صرف إعلاني، ولا تحديث Brand Brain من هذه الصفحة.'
                                : 'No publishing, scheduling, ad spend, or Brand Brain updates happen from this page.'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-4">
                          {strategyReviewDeskCards.map((item) => (
                            <StrategyDocCard
                              key={item.label}
                              label={item.label}
                              value={item.value}
                              locale={locale}
                              tone={item.tone}
                            />
                          ))}
                        </div>
                        <p className="mt-4 text-xs text-slate-500">
                          {uiText('آخر تحديث', 'Last updated')}: {new Date(campaign.updatedAt).toLocaleDateString(uiIsArabic ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        {brandTruthBlocked ? (
                          <Link
                            href="/brand"
                            className="inline-flex items-center justify-center rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-800"
                          >
                            {uiText('تصحيح Brand Brain', 'Fix Brand Brain')}
                          </Link>
                        ) : !engineRunning && operatingState.stage === 'strategy_review_needed' ? (
                          <button
                            type="button"
                            onClick={() => setShowSentinelConfirm(true)}
                            disabled={sentinelState === 'reviewing'}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                          >
                            {sentinelState === 'reviewing'
                              ? uiText('جارٍ فحص الجودة...', 'Reviewing quality...')
                              : sentinelStatus === 'needs_attention'
                                ? uiText(
                                  `طبّق الإصلاح الآمن وأعد الفحص — ${sentinelCreditCost} كريديت`,
                                  `Apply safe correction and re-review — ${sentinelCreditCost} credits`,
                                )
                                : uiText(
                                  `فحص الجودة — ${sentinelCreditCost} كريديت`,
                                  `Review quality — ${sentinelCreditCost} credits`,
                                )}
                          </button>
                        ) : !engineRunning && !isPaidOnlyStrategy && sentinelStatus === 'passed' && operatingState.stage === 'content_plan_missing' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLaunchError('')
                              setApprovalState('confirming')
                            }}
                            disabled={approvalState === 'approving' || launchState === 'approving' || launchState === 'generating'}
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {campaign.status === 'ACTIVE'
                              ? uiText(`إنشاء خطة المحتوى — ${CONTENT_PLAN_CREDIT_COST} كريديت`, `Build content plan — ${CONTENT_PLAN_CREDIT_COST} credits`)
                              : uiText('اعتمد الاستراتيجية وأنشئ الخطة', 'Approve strategy and build plan')}
                          </button>
                        ) : (
                          <Link
                            href={strategyHeaderNextActionHref}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            {strategyHeaderNextActionLabel}
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!showStrategyDocument) {
                              setShowStrategyDocument(true)
                              window.setTimeout(() => scrollToStrategySection('strategy-executive'), 0)
                              return
                            }
                            scrollToStrategySection('strategy-executive')
                          }}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          {uiText('اقرأ وثيقة الاستراتيجية', 'Read strategy document')}
                        </button>
                        {sentinelError && sentinelState === 'idle' && (
                          <p role="alert" className="max-w-sm rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                            {sentinelError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-5 sm:px-7">
                    {(sentinelReview || qualityGate) && (
                      <details
                        open={sentinelStatus === 'needs_attention'}
                        className={`mb-5 overflow-hidden rounded-2xl border ${
                          completeQualityReviewPassed
                            ? 'border-emerald-200 bg-emerald-50/70'
                            : 'border-amber-200 bg-amber-50/80'
                        }`}
                      >
                        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-950">
                          {completeQualityReviewPassed
                            ? uiText('✓ نتيجة فحص الحقيقة والجودة: مكتملة', '✓ Truth and quality result: complete')
                            : uiText('⚠ نتيجة فحص الجودة: المعالجة مطلوبة', '⚠ Quality review result: action required')}
                        </summary>
                        <div className="space-y-4 border-t border-current/10 px-4 py-4">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                              <p className="text-[11px] font-bold text-slate-500">{uiText('مخاطر الادعاءات', 'Claim risk')}</p>
                              <p className={`mt-1 text-lg font-semibold ${
                                Number(sentinelReview?.riskScore ?? 0) > 40 ? 'text-rose-700' : 'text-emerald-700'
                              }`}>
                                {sentinelReview ? `${sentinelReview.riskScore}/100` : uiText('لم يُفحص', 'Not reviewed')}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                              <p className="text-[11px] font-bold text-slate-500">{uiText('اتساق البراند', 'Brand consistency')}</p>
                              <p className="mt-1 text-lg font-semibold text-slate-950">
                                {sentinelReview ? `${sentinelReview.brandConsistencyScore}/100` : (qualityGatePassed ? uiText('مؤسس على Brand Brain', 'Grounded in Brand Brain') : uiText('محجوب', 'Blocked'))}
                              </p>
                            </div>
                          </div>

                          {sentinelReview?.summary && (
                            <p className="text-sm leading-6 text-slate-700">{sentinelReview.summary}</p>
                          )}
                          {sentinelReview?.claimSafetyNotes && (
                            <p className="rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs leading-5 text-slate-600">
                              {sentinelReview.claimSafetyNotes}
                            </p>
                          )}
                          {Array.isArray(sentinelReview?.complianceWarnings) && sentinelReview.complianceWarnings.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-amber-900">{uiText('النص الذي يمنع الاعتماد', 'Text blocking approval')}</p>
                              <ul className="mt-2 space-y-2">
                                {sentinelReview.complianceWarnings.map((warning: string, index: number) => (
                                  <li key={`${warning}-${index}`} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs leading-5 text-amber-950">
                                    {warning}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(sentinelReview?.recommendedFixes) && sentinelReview.recommendedFixes.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-indigo-900">{uiText('الإصلاح المقترح', 'Recommended correction')}</p>
                              <ul className="mt-2 space-y-2">
                                {sentinelReview.recommendedFixes.map((fix: string, index: number) => (
                                  <li key={`${fix}-${index}`} className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs leading-5 text-indigo-950">
                                    {fix}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {sentinelStatus === 'needs_attention' && (
                            <p className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold leading-5 text-amber-950">
                              {uiText(
                                'لن يتم الاعتماد بهذه الحالة. زر «طبّق الإصلاح الآمن» يزيل الأرقام الأدائية غير الموثقة قبل إعادة الفحص؛ ولا ينشر أو يعتمد شيئًا تلقائيًا.',
                                'Approval remains blocked. Apply safe correction removes unsupported performance numbers before the re-review; it does not publish or approve anything automatically.',
                              )}
                            </p>
                          )}
                        </div>
                      </details>
                    )}
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                      <StrategyDocCard
                        label={uiText('ما تم توليده', 'What was generated')}
                        locale={locale}
                        value={effectiveDisplayOperatingLabel}
                        tone="positive"
                      />
                      <StrategyDocCard
                        label={isPaidOnlyStrategy
                          ? uiText('النطاق العضوي', 'Organic scope')
                          : uiText('مصدر حقيقة المحتوى', 'Content source of truth')}
                        locale={locale}
                        value={strategyRoomStateCopy.organicPlanValue}
                        tone={strategyRoomStateCopy.contentPlanTone}
                      />
                      <StrategyDocCard
                        label={uiText('نطاق المدفوع', 'Paid scope')}
                        locale={locale}
                        value={!includesPaidPlanningStrategy
                          ? uiText('غير مشمول في هذا التشغيل العضوي', 'Not included in this organic run')
                          : hasPaidPlanningGaps
                            ? (uiIsArabic
                                ? `غير جاهز: ${paidPlanningMissingLabels.slice(0, 3).join('، ')}`
                                : `Not ready: ${paidPlanningMissingLabels.slice(0, 3).join(', ')}`)
                            : isPaidOnlyStrategy
                              ? uiText('بريف تخطيط للمراجعة فقط', 'Planning brief for review only')
                              : uiText('تخطيط فقط — لا صرف بدون موافقة', 'Planning only — no spend without approval')}
                        tone={includesPaidPlanningStrategy ? 'warning' : 'muted'}
                      />
                      <StrategyDocCard
                        label={uiText('الثقة قبل التنفيذ', 'Pre-execution confidence')}
                        locale={locale}
                        value={displayedConfidenceLevel
                          ? `${confLevelLabel(displayedConfidenceLevel, locale)}${confidenceReport?.overall === 'high' && displayedConfidenceLevel !== 'high'
                            ? uiText(' بسبب بيانات ناقصة', ' due to missing inputs')
                            : ''}`
                          : uiText('تحتاج مراجعة', 'Needs review')}
                        tone={displayedConfidenceLevel === 'low' ? 'warning' : 'muted'}
                      />
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            {uiText('مسار التشغيل التالي', 'Next operating path')}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {uiText('اتبع هذا الترتيب: محتوى، إبداع، ثم جاهزية المنصات.', 'Follow this order: content, creative, then platform readiness.')}
                          </p>
                        </div>
                        <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200">
                          {uiText('قراءة وتوجيه فقط', 'Read and route only')}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                        {strategyExecutionPathItems.map((item) => (
                          <div key={item.step} className={`rounded-xl border p-3 ${strategyExecutionPathTone[item.tone]}`}>
                            <div className="flex items-start gap-3">
                              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/60 text-[11px] font-bold">
                                {item.step}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-5">{item.title}</p>
                                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{item.status}</p>
                                <p className="mt-1 text-xs leading-5 opacity-85">{item.helper}</p>
                                <Link
                                  href={item.href}
                                  className="mt-3 inline-flex rounded-full border border-current/15 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                                >
                                  {item.cta}
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] leading-5 text-slate-400">
                        {strategyDocIsArabic
                          ? 'هذه الروابط لا تولّد ولا تعتمد ولا تجدول ولا تنشر ولا تطلق إعلانات. هي تنقل كل قرار إلى سطحه التشغيلي الصحيح.'
                          : 'These links do not generate, approve, schedule, publish, or launch ads. They route each decision to the correct operating surface.'}
                      </p>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {strategyReviewChecklistCopy.title}
                          </p>
                          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                            {strategyReviewChecklistCopy.helper}
                          </p>
                        </div>
                        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                          {strategyDocText('مراجعة فقط', 'Review only')}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
                        {strategyExecutionReadinessItems.map((item, i) => {
                          const toneClass = item.tone === 'warning'
                            ? 'border-amber-200 bg-amber-50 text-amber-950'
                            : item.tone === 'positive'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          const dotClass = item.tone === 'warning'
                            ? 'bg-amber-500'
                            : item.tone === 'positive'
                              ? 'bg-emerald-500'
                              : 'bg-slate-400'
                          return (
                            <div key={i} className={`rounded-xl border p-3 ${toneClass}`}>
                              <div className="flex items-start gap-3">
                                <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotClass}`} />
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                                  <p className="mt-1 text-sm font-semibold leading-5">{item.value}</p>
                                  <p className="mt-1 text-xs leading-5 opacity-80">{item.helper}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {strategyDocMissingDataLabels.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-950">
                          {strategyDocText('ما ينقص قبل قرارات التنفيذ', 'Missing before execution decisions')}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {strategyDocMissingDataLabels.map((label, i) => (
                            <span key={i} className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section id="strategy-summary" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <StrategyDocCard
                      label={strategyDocText('المصدر', 'Source')}
                      value={strategyDocText('Brand Brain وبيانات الحملة', 'Brand Brain and campaign inputs')}
                      locale={strategyDocumentLocale}
                    />
                    <StrategyDocCard
                      label={strategyDocText('التحليلات', 'Analytics')}
                      locale={strategyDocumentLocale}
                      value={confidenceReport?.byCapability?.measurement === 'high'
                        ? strategyDocText('بيانات متاحة جزئياً', 'Partial data available')
                        : strategyDocText('تحتاج خط أساس', 'Baseline needed')}
                      tone="muted"
                    />
                    <StrategyDocCard
                      label={strategyDocText('حدود التنفيذ', 'Execution limits')}
                      value={strategyDocText('لا إعلانات ولا نشر بدون مراجعة صريحة', 'No ads or publishing without explicit review')}
                      locale={strategyDocumentLocale}
                      tone="muted"
                    />
                  </div>
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                    {isPaidOnlyStrategy
                      ? (strategyDocIsArabic
                        ? 'هذه الصفحة تحفظ بريف التخطيط المدفوع كمادة مراجعة فقط. لا توجد منشورات Content Hub من هذا التوليد، ولا إطلاق أو صرف بدون تأكيد صريح.'
                        : 'This page keeps the paid planning brief as review material only. No Content Hub posts were created by this run, and no launch or spend happens without explicit confirmation.')
                      : (strategyDocIsArabic
                        ? 'هذه الصفحة تحفظ قيمة الاستراتيجية كاملة، لكنها تقسمها إلى قرارات قابلة للمراجعة. Content Hub يظل مصدر الحقيقة لحالة المنشورات والوسائط.'
                        : 'This page keeps the full strategy value, but organizes it into reviewable decisions. Content Hub remains the source of truth for post and media state.')}
                  </p>
                </section>

                {!showStrategyDocument && (
                  <section className="rounded-[24px] border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-indigo-950">
                          {uiText(`وثيقة الاستراتيجية الكاملة (${strategySectionNavItems.length} أقسام)`, `Full strategy document (${strategySectionNavItems.length} sections)`)}
                        </p>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-indigo-900/70">
                          {uiText('الملخص وقرار التنفيذ يظهران أولاً لتقليل التشتيت. افتح الوثيقة فقط عندما تحتاج مراجعة التفاصيل والافتراضات والمخاطر.', 'The summary and execution decision stay first to reduce noise. Open the full document only when you need detailed assumptions, plans, and risks.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowStrategyDocument(true)
                          window.setTimeout(() => scrollToStrategySection('strategy-executive'), 0)
                        }}
                        className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-indigo-700 px-4 text-sm font-black text-white transition hover:bg-indigo-800"
                      >
                        {uiText('فتح الوثيقة الكاملة', 'Open full document')}
                      </button>
                    </div>
                  </section>
                )}

                {showStrategyDocument && (
                  <>
                {hasExecutiveStrategySection && (
                  <StrategyDocSection
                    id="strategy-executive"
                    eyebrow="01"
                    title={strategyDocText('الاستراتيجية التنفيذية', 'Executive Strategy')}
                    description={strategyDocIsArabic
                      ? 'الاتجاه الأساسي، لماذا يناسب العلامة، وما يجب التركيز عليه أولاً.'
                      : 'The core direction, why it fits the brand, and what to focus on first.'}
                  >
                    <div className="space-y-4">
                      {strategy.keyMessage && (
                        <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-500">
                            {strategyDocText('الرسالة الأساسية', 'Key Message')}
                          </p>
                          <p className="mt-2 text-xl font-semibold leading-8 text-slate-950">"{strategy.keyMessage}"</p>
                          <div className="mt-3">
                            <CopyBtn text={strategy.keyMessage} label={cdT?.copyBtn || 'Copy'} />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <StrategyDocCard label={strategyDocText('التموضع', 'Positioning')} value={strategy.positioning} locale={strategyDocumentLocale} />
                        <StrategyDocCard label={strategyDocText('التميّز', 'Differentiation')} value={strategy.differentiation} locale={strategyDocumentLocale} />
                      </div>
                      {strategy.nextBestAction && (
                        <StrategyDocCard
                          label={strategyDocText('الخطوة التالية المقترحة', 'Suggested next step')}
                          locale={strategyDocumentLocale}
                          value={strategy.nextBestAction}
                          tone="muted"
                        />
                      )}
                    </div>
                  </StrategyDocSection>
                )}

                {hasDiagnosisSection && (
                  <StrategyDocSection
                    id="strategy-diagnosis"
                    eyebrow="02"
                    title={strategyDocText('تشخيص التسويق', 'Marketing Diagnosis')}
                    description={strategy.diagnosis}
                  >
                    {diagnosisDetails && (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <StrategyDocCard label={strategyDocText('مرحلة النشاط', 'Business stage')} value={diagnosisDetails.stage} locale={strategyDocumentLocale} />
                        <StrategyDocCard label={strategyDocText('العائق الأساسي', 'Main bottleneck')} value={diagnosisDetails.bottleneck} locale={strategyDocumentLocale} />
                        <StrategyDocCard label={strategyDocText('فجوة الثقة', 'Trust gap')} value={diagnosisDetails.trustGap} locale={strategyDocumentLocale} tone="warning" />
                        <StrategyDocCard label={strategyDocText('الخطر الأساسي', 'Main risk')} value={diagnosisDetails.mainRisk} locale={strategyDocumentLocale} tone="warning" />
                        <StrategyDocCard
                          label={strategyDocText('جاهزية التخطيط المدفوع', 'Paid planning status')}
                          locale={strategyDocumentLocale}
                          value={!includesPaidPlanningStrategy
                            ? strategyDocText('غير مشمول في هذا التشغيل العضوي', 'Not included in this organic run')
                            : diagnosisDetails.readyForPaidAds
                              ? strategyDocText('يمكن إعداد خطة للمراجعة', 'Can prepare a plan for review')
                              : hasPaidPlanningGaps
                                ? (strategyDocIsArabic
                                    ? `التنفيذ متوقف حتى إضافة: ${strategyDocPaidPlanningMissingLabels.join('، ')}`
                                    : `Execution blocked until added: ${strategyDocPaidPlanningMissingLabels.join(', ')}`)
                                : strategyDocText('تخطيط للمراجعة فقط؛ لا صرف بدون موافقة', 'Planning for review only; no spend without approval')}
                          tone={!includesPaidPlanningStrategy ? 'muted' : 'warning'}
                        />
                        <StrategyDocCard label={strategyDocText('السبب', 'Reason')} value={diagnosisDetails.readyForPaidAdsReason} locale={strategyDocumentLocale} />
                      </div>
                    )}
                  </StrategyDocSection>
                )}

                {hasBusinessObjectiveSection && (
                  <StrategyDocSection id="strategy-objective" eyebrow="03" title={strategyDocText('الهدف التجاري', 'Business Objective')}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[
                        { label: strategyDocText('الهدف التجاري', 'Business objective'), value: businessObjective.primary },
                        { label: strategyDocText('هدف التسويق', 'Marketing objective'), value: businessObjective.marketing },
                        { label: strategyDocText('إجراء التحويل', 'Conversion action'), value: businessObjective.conversionAction },
                        { label: strategyDocText('الفعل المتوقع من المستخدم', 'Expected user action'), value: businessObjective.expectedUserAction },
                        { label: strategyDocText('لماذا الآن', 'Why now'), value: businessObjective.whyNow },
                        { label: strategyDocText('تعريف النجاح', 'Success definition'), value: businessObjective.successIn30Days },
                      ].map((item, i) => (
                        <StrategyDocCard key={i} label={item.label} value={item.value} locale={strategyDocumentLocale} />
                      ))}
                    </div>
                  </StrategyDocSection>
                )}

                {hasAudienceSection && (
                  <StrategyDocSection id="strategy-audience" eyebrow="04" title={strategyDocText('شرائح الجمهور', 'Audience Segments')}>
                    {audienceSegmentsDetailed.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {audienceSegmentsDetailed.map((seg: any, i: number) => (
                          <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-950">{i + 1}. {strategyDocDisplayValue(seg.segment)}</p>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700">
                              <StrategyDocCard label={strategyDocFieldLabel('situation')} value={seg.situation} locale={strategyDocumentLocale} />
                              <StrategyDocCard label={strategyDocFieldLabel('pain')} value={seg.pain} locale={strategyDocumentLocale} tone="warning" />
                              <StrategyDocCard label={strategyDocFieldLabel('desiredOutcome')} value={seg.desiredOutcome} locale={strategyDocumentLocale} tone="positive" />
                              <StrategyDocCard label={strategyDocFieldLabel('objection')} value={seg.objection} locale={strategyDocumentLocale} tone="warning" />
                              <StrategyDocCard label={strategyDocFieldLabel('message')} value={seg.message} locale={strategyDocumentLocale} />
                              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                {seg.platform && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{strategyDocFieldLabel('platform')}: {formatStrategyPlatformLabel(seg.platform) || seg.platform}</span>}
                                {seg.format && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{strategyDocFieldLabel('format')}: {strategyDocDisplayValue(seg.format)}</span>}
                                {seg.cta && <span className="rounded-full bg-white px-2 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">{strategyDocFieldLabel('cta')}: {seg.cta}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <StrategyDocList ordered locale={strategyDocumentLocale} items={audienceSegments.map((seg: string) => seg)} />
                    )}
                  </StrategyDocSection>
                )}

                {hasStrategyContentSection && (
                  <StrategyDocSection
                    id="strategy-content"
                    eyebrow="05"
                    title={isPaidOnlyStrategy
                      ? strategyDocText('زوايا التخطيط المدفوع', 'Paid Planning Angles')
                      : includesPaidPlanningStrategy
                        ? strategyDocText('خطة المحتوى والتخطيط المدفوع', 'Content & Paid Planning')
                        : strategyDocText('خطة المحتوى العضوي', 'Organic Content Plan')}
                    description={isPaidOnlyStrategy
                      ? (strategyDocIsArabic
                        ? 'فرضيات الجمهور والزوايا والنسخ الإعلانية للمراجعة فقط. ليست خطة منشورات عضوية ولا Content Hub.'
                        : 'Audience hypotheses, paid angles, and ad-copy directions for review only. This is not an organic post plan or Content Hub output.')
                      : (strategyDocIsArabic
                        ? 'الرسائل والركائز والخطافات التي تحوّل الاستراتيجية إلى محتوى قابل للمراجعة.'
                        : 'The messages, pillars, hooks, and angles that turn the strategy into reviewable content.')}
                  >
                    {paidPlanning && (
                      <div className="mb-6 space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">{strategyDocText('حزمة التخطيط المدفوع', 'Paid planning package')}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-950">{strategyDocDisplayValue(paidPlanning.objective)}</p>
                          </div>
                          <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-bold text-indigo-700">
                            {strategyDocText('تخطيط فقط · لا صرف أو إطلاق', 'Planning only · no spend or launch')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          {[
                            [strategyDocText('فرضيات الجمهور', 'Audience hypotheses'), paidPlanning.audienceHypotheses?.length || 0],
                            [strategyDocText('الزوايا', 'Ad angles'), paidPlanning.adAngles?.length || 0],
                            [strategyDocText('النسخ الإعلانية', 'Ad copy variations'), paidPlanning.adCopyVariations?.length || 0],
                            [strategyDocText('البريفات الإبداعية', 'Creative briefs'), paidPlanning.creativeBriefs?.length || 0],
                          ].map(([label, count]) => (
                            <div key={String(label)} className="rounded-xl border border-indigo-100 bg-white p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                              <p className="mt-1 text-xl font-black text-slate-950">{count}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          <StrategyDocCard label={strategyDocText('إطار الميزانية', 'Budget framework')} value={paidPlanning.budgetFramework} locale={strategyDocumentLocale} tone="warning" />
                          <StrategyDocCard label={strategyDocText('عوائق الإطلاق', 'Launch blockers')} value={paidPlanning.launchBlockers?.length ? <StrategyDocList locale={strategyDocumentLocale} items={paidPlanning.launchBlockers} /> : null} locale={strategyDocumentLocale} tone="warning" />
                        </div>
                        {Array.isArray(paidPlanning.adCopyVariations) && paidPlanning.adCopyVariations.length > 0 && (
                          <details className="rounded-xl border border-indigo-100 bg-white p-3">
                            <summary className="cursor-pointer text-sm font-bold text-slate-900">
                              {strategyDocText(`عرض ${paidPlanning.adCopyVariations.length} نسخ إعلانية`, `Show ${paidPlanning.adCopyVariations.length} ad-copy variations`)}
                            </summary>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {paidPlanning.adCopyVariations.map((copy: any, index: number) => (
                                <div key={copy.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-xs font-bold text-indigo-700">{copy.id || `${index + 1}`}</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-950">{copy.headline}</p>
                                  <p className="mt-2 text-xs leading-5 text-slate-600">{copy.primaryText}</p>
                                  <p className="mt-2 text-[11px] font-semibold text-slate-500">CTA: {copy.cta}</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                    <div className={isPaidOnlyStrategy ? 'hidden' : 'space-y-5'}>
                      {strategy.contentPillars?.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            {isPaidOnlyStrategy
                              ? strategyDocText('محاور التخطيط المدفوع', 'Paid planning pillars')
                              : strategyDocText('ركائز المحتوى', 'Content Pillars')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {strategy.contentPillars.map((p: string, i: number) => (
                              <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(strategy.valueProps?.length > 0 || strategy.valuePropositions?.length > 0 || strategy.estimatedResults) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            {isPaidOnlyStrategy
                              ? strategyDocText('فرضيات قيمة للمراجعة', 'Value hypotheses for review')
                              : strategyDocText('وعود القيمة', 'Value Propositions')}
                          </p>
                          {(strategy.valueProps?.length > 0 || strategy.valuePropositions?.length > 0) ? (
                            <StrategyDocList locale={strategyDocumentLocale} items={(strategy.valueProps || strategy.valuePropositions).map((vp: string) => vp)} />
                          ) : (
                            <p className="text-sm leading-6 text-slate-700">{strategy.estimatedResults}</p>
                          )}
                        </div>
                      )}
                      {topHooks.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            {isPaidOnlyStrategy
                              ? strategyDocText('خطافات إعلانية للمراجعة', 'Paid hooks for review')
                              : strategyDocText('خطافات المحتوى', 'Content Hooks')}
                          </p>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {topHooks.slice(0, 8).map((hook: string, i: number) => (
                              <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <span className="text-xs font-bold text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                                <p className="flex-1 text-sm leading-6 text-slate-700">{hook}</p>
                                <CopyBtn text={hook} label={cdT?.copyBtn || 'Copy'} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {ctaVariations.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{strategyDocText('دعوات الإجراء', 'CTAs')}</p>
                          <div className="flex flex-wrap gap-2">
                            {ctaVariations.map((cta: string, i: number) => (
                              <span key={i} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">{cta}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(contentAnglesDetailed.length > 0 || contentAngles.length > 0) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            {isPaidOnlyStrategy
                              ? strategyDocText('زوايا إعلانية للمراجعة', 'Paid ad angles for review')
                              : strategyDocText('زوايا المحتوى', 'Content Angles')}
                          </p>
                          {contentAnglesDetailed.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {contentAnglesDetailed.map((angle: any, i: number) => (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-sm font-semibold text-slate-950">{angle.title || `${strategyDocText('زاوية', 'Angle')} ${i + 1}`}</p>
                                  {angle.hook && <p className="mt-2 text-sm leading-6 text-slate-700">"{angle.hook}"</p>}
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                    {angle.pain && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{strategyDocFieldLabel('pain')}: {angle.pain}</span>}
                                    {angle.format && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{strategyDocFieldLabel('format')}: {strategyDocDisplayValue(angle.format)}</span>}
                                    {angle.platform && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{strategyDocFieldLabel('platform')}: {formatStrategyPlatformLabel(angle.platform) || angle.platform}</span>}
                                    {angle.cta && <span className="rounded-full bg-white px-2 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">{strategyDocFieldLabel('cta')}: {angle.cta}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <StrategyDocList locale={strategyDocumentLocale} items={contentAngles.map((angle: string) => angle)} />
                          )}
                        </div>
                      )}
                    </div>
                  </StrategyDocSection>
                )}

                {hasExecutionSection && (
                  <StrategyDocSection id="strategy-execution" eyebrow="06" title={strategyDocText('خطة التنفيذ', 'Execution Plan')}>
                    <div className="space-y-5">
                      {(funnelStages.length > 0 || strategy.funnelStrategy) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{strategyDocText('مراحل القمع', 'Funnel stages')}</p>
                          {funnelStages.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {funnelStages.map((stage: any, i: number) => (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-sm font-semibold text-slate-950">{stage.stage ? strategyDocDisplayValue(stage.stage) : `${strategyDocText('مرحلة', 'Stage')} ${i + 1}`}</p>
                                  <div className="mt-3 grid gap-2">
                                    <StrategyDocCard label={strategyDocFieldLabel('userMindset')} value={stage.userMindset} locale={strategyDocumentLocale} />
                                    <StrategyDocCard label={strategyDocFieldLabel('message')} value={stage.message} locale={strategyDocumentLocale} />
                                    <StrategyDocCard label={strategyDocFieldLabel('contentType')} value={stage.contentType} locale={strategyDocumentLocale} />
                                    <StrategyDocCard label={strategyDocFieldLabel('platform')} value={formatStrategyPlatformLabel(stage.platform) || stage.platform} locale={strategyDocumentLocale} />
                                    <StrategyDocCard label={strategyDocFieldLabel('cta')} value={stage.cta} locale={strategyDocumentLocale} />
                                    <StrategyDocCard label={strategyDocFieldLabel('successMetric')} value={stage.successMetric} locale={strategyDocumentLocale} tone="muted" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {Object.entries(strategy.funnelStrategy || {}).map(([key, value]) => (
                                value ? <StrategyDocCard key={key} label={strategyDocFieldLabel(key)} value={String(value)} locale={strategyDocumentLocale} /> : null
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {(strategy.channelMix?.length > 0 || channelStrategy.length > 0) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{strategyDocText('استراتيجية القنوات', 'Channel Strategy')}</p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {(channelStrategy.length > 0 ? channelStrategy : strategy.channelMix).map((ch: any, i: number) => (
                              <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-semibold capitalize text-slate-950">{formatStrategyPlatformLabel(ch.platform) || ch.platform}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{ch.role || ch.rationale || ch.postingApproach}</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                  {ch.contentType && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{strategyDocDisplayValue(ch.contentType)}</span>}
                                  {ch.cta && <span className="rounded-full bg-white px-2 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">{ch.cta}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {strategy.offerCTAStrategy && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{strategyDocText('العرض والدعوة للإجراء', 'Offer & CTA')}</p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[
                              { label: strategyDocText('الدعوة الأساسية', 'Primary CTA'), value: strategy.offerCTAStrategy.primaryCTA },
                              { label: strategyDocText('الدعوة الثانوية', 'Secondary CTA'), value: strategy.offerCTAStrategy.secondaryCTA },
                              { label: strategyDocText('مغناطيس العملاء المحتملين', 'Lead magnet'), value: strategy.offerCTAStrategy.leadMagnet },
                              { label: strategyDocText('عرض تجريبي', 'Beta offer'), value: strategy.offerCTAStrategy.betaOffer },
                              { label: strategyDocText('مسار التواصل', 'Contact flow'), value: strategy.offerCTAStrategy.contactFlow },
                            ].map((item, i) => (
                              <StrategyDocCard key={i} label={item.label} value={item.value} locale={strategyDocumentLocale} />
                            ))}
                          </div>
                        </div>
                      )}
                      {strategy.visualDirection && (
                        <StrategyDocCard label={strategyDocText('الاتجاه البصري', 'Visual Direction')} value={strategy.visualDirection} locale={strategyDocumentLocale} />
                      )}
                      {(weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{strategyDocText('خطة التنفيذ الأسبوعية', 'Weekly Execution Plan')}</p>
                          <div className="space-y-3">
                            {(weeklyExecutionPlan.length > 0 ? weeklyExecutionPlan : weeklyPlan).map((w: any) => (
                              <div key={w.week} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-sm font-semibold text-slate-950">{strategyDocText('الأسبوع', 'Week')} {w.week}: {strategyDocDisplayValue(w.objective)}</p>
                                  {w.cta && <span className="text-xs font-semibold text-indigo-600">{w.cta}</span>}
                                </div>
                                {w.keyMessage && <p className="mt-2 text-sm leading-6 text-slate-600">"{w.keyMessage}"</p>}
                                {w.deliverables?.length > 0 && (
                                  <div className="mt-3">
                                    <StrategyDocList locale={strategyDocumentLocale} items={w.deliverables.map((d: string) => d)} />
                                  </div>
                                )}
                                {(w.platforms?.length > 0 || w.channels?.length > 0) && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {(w.platforms || w.channels).map((p: string, pi: number) => (
                                      <span key={pi} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">{formatStrategyPlatformLabel(p) || p}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </StrategyDocSection>
                )}

                {(strategy.kpis?.length > 0 || successMetricsDetailed.length > 0 || successMetrics.length > 0) && (
                  <StrategyDocSection
                    id="strategy-metrics"
                    eyebrow="07"
                    title={strategyDocText('مؤشرات القياس', 'KPIs & Metrics')}
                    description={strategyDocIsArabic
                      ? 'المؤشرات هنا فرضيات حتى يتم إنشاء خط أساس من بيانات حقيقية.'
                      : 'These indicators are hypotheses until a real baseline is available.'}
                  >
                    <div className="space-y-5">
                      {strategy.kpis?.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          {strategy.kpis.map((kpi: any, i: number) => (
                            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-lg font-semibold text-slate-950">{kpi.target ? strategyDocDisplayValue(kpi.target) : strategyDocText('يُحدد لاحقاً', 'Target to define')}</p>
                              <p className="mt-1 text-sm text-slate-600">{strategyDocDisplayValue(kpi.metric)}</p>
                              <p className="mt-2 text-xs text-slate-400">{kpi.timeframe ? strategyDocDisplayValue(kpi.timeframe) : strategyDocText('بعد أول 30 يوماً', 'After the first 30 days')}</p>
                              <span className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                                {strategyDocText('فرضية', 'Hypothesis')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {successMetricsDetailed.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {successMetricsDetailed.map((m: any, i: number) => (
                            <StrategyDocCard
                              key={i}
                              label={m.category ? strategyDocDisplayValue(m.category) : strategyDocText('مؤشر', 'Metric')}
                              value={`${m.metric}${m.target ? ` — ${m.target}` : ''}${m.timeframe ? ` (${m.timeframe})` : ''}`}
                              locale={strategyDocumentLocale}
                              tone="muted"
                            />
                          ))}
                        </div>
                      )}
                      {successMetrics.length > 0 && successMetricsDetailed.length === 0 && (
                        <StrategyDocList locale={strategyDocumentLocale} items={successMetrics.map((metric: string) => metric)} />
                      )}
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                        {strategyDocIsArabic
                          ? 'خط أساس مطلوب. تُعرّف الأهداف النهائية بعد أول 30 يوماً من البيانات.'
                          : 'Baseline needed. Final targets should be defined after the first 30 days of real data.'}
                      </div>
                    </div>
                  </StrategyDocSection>
                )}

                {hasReadinessSection && (
                  <StrategyDocSection
                    id="strategy-readiness"
                    eyebrow="08"
                    title={includesPaidPlanningStrategy
                      ? strategyDocText('الجاهزية والتخطيط المدفوع', 'Readiness & Paid Planning')
                      : strategyDocText('الجاهزية وحدود التنفيذ', 'Readiness & Execution Boundaries')}
                    description={strategyDocIsArabic
                      ? (includesPaidPlanningStrategy
                        ? 'تخطيط فقط. لا يتم صرف ميزانية أو نشر محتوى من هذه الصفحة.'
                        : 'هذا تشغيل عضوي فقط. لا يتضمن بريف تخطيط مدفوع أو صرف ميزانية أو إطلاق إعلانات.')
                      : (includesPaidPlanningStrategy
                        ? 'Planning only. No budget is spent and no content goes out from this page.'
                        : 'This is an organic-only run. It does not include a paid planning brief, budget spend, or ad launch.')}
                    >
                      <div className="space-y-5">
                        {hasStrategyExecutionBridge && (
                          <div className={`rounded-2xl border p-4 ${strategyExecutionBridgeTone[strategyExecutionBridge.overallStatus]}`}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                  {strategyDocText('ربط الاستراتيجية بالتنفيذ', 'Strategy to execution bridge')}
                                </p>
                                <h3 className="mt-1 text-base font-semibold text-slate-950">
                                  {strategyDocIsArabic ? strategyExecutionBridge.summaryAr : strategyExecutionBridge.summaryEn}
                                </h3>
                                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                                  {strategyDocIsArabic ? strategyExecutionBridge.helperAr : strategyExecutionBridge.helperEn}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  {strategyScope.type === 'organic'
                                    ? strategyDocText('استراتيجية عضوية فقط', 'Organic-only strategy')
                                    : strategyScope.type === 'paid'
                                      ? strategyDocText('استراتيجية مدفوعة فقط', 'Paid-only strategy')
                                      : strategyDocText('استراتيجية شاملة', 'Full strategy')}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  {strategyDocIsArabic
                                    ? `${strategyExecutionBridge.readyCount} جاهز · ${strategyExecutionBridge.blockedCount} تحتاج ربطاً أو دعماً`
                                    : `${strategyExecutionBridge.readyCount} ready · ${strategyExecutionBridge.blockedCount} need connection/support`}
                                </span>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    {strategyDocText('مسار النشر العضوي', 'Organic publishing lane')}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {strategyExecutionBridge.organicNoteAr && strategyDocIsArabic
                                      ? strategyExecutionBridge.organicNoteAr
                                      : strategyExecutionBridge.organicNoteEn && !strategyDocIsArabic
                                        ? strategyExecutionBridge.organicNoteEn
                                        : (strategyDocIsArabic
                                          ? 'يعرض فقط منصات الحملة المطلوبة في هذه الاستراتيجية.'
                                          : 'Shows only the campaign platforms required by this strategy.')}
                                  </p>
                                </div>
	                                {strategyExecutionBridge.organicRequirements.length > 0
	                                  ? strategyExecutionBridge.organicRequirements.map(renderStrategyExecutionRequirement)
	                                  : null}
                              </div>

                                <div className="space-y-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">
                                      {strategyDocText('مسار التنفيذ المدفوع', 'Paid execution lane')}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                      {strategyExecutionBridge.paidNoteAr && strategyDocIsArabic
                                        ? strategyExecutionBridge.paidNoteAr
                                        : strategyExecutionBridge.paidNoteEn && !strategyDocIsArabic
                                          ? strategyExecutionBridge.paidNoteEn
                                          : (strategyDocIsArabic
                                            ? 'يتحقق من متطلبات Meta Ads/API فقط. التنفيذ المدفوع النهائي مسار منفصل يحتاج تأكيداً صريحاً.'
                                            : 'Checks Meta Ads/API prerequisites only. Final paid execution is separate and requires explicit confirmation.')}
                                    </p>
                                  </div>
	                                {strategyExecutionBridge.paidRequirements.length > 0
	                                  ? strategyExecutionBridge.paidRequirements.map(renderStrategyExecutionRequirement)
	                                  : null}
                                </div>
                              </div>
                            </div>
                          )}
                          {readinessChecklist.length > 0 && (
                            <div>
                              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{strategyDocText('قائمة الجاهزية', 'Readiness Checklist')}</p>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                {readinessChecklist.map((item: any, i: number) => (
                                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                    <span className={`h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    <span className="flex-1">{item.label || item.item}</span>
                                    <span className="text-xs text-slate-400">{item.done ? strategyDocText('تم', 'Done') : strategyDocText('قيد الانتظار', 'Pending')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      {assetRequirements && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <StrategyDocCard label={strategyDocText('ضروري', 'Must have')} value={assetRequirements.mustHave?.length ? <StrategyDocList locale={strategyDocumentLocale} items={assetRequirements.mustHave.map((a: string) => a)} /> : null} tone="warning" />
                          <StrategyDocCard label={strategyDocText('مفيد إن وجد', 'Nice to have')} value={assetRequirements.niceToHave?.length ? <StrategyDocList locale={strategyDocumentLocale} items={assetRequirements.niceToHave.map((a: string) => a)} /> : null} />
                          <StrategyDocCard
                            label={includesPaidPlanningStrategy
                              ? strategyDocText('للتخطيط المدفوع', 'For paid planning')
                              : strategyDocText('المدفوع غير مشمول', 'Paid not included')}
                            value={includesPaidPlanningStrategy
                              ? (assetRequirements.forAds?.length ? <StrategyDocList locale={strategyDocumentLocale} items={assetRequirements.forAds.map((a: string) => a)} /> : null)
                              : (strategyDocIsArabic
                                ? 'التشغيل العضوي لا يحتاج أصول إعلان مدفوعة. شغّل Paid أو Full لاحقاً عند توفر ميزانية ووجهة تحويل.'
                                : 'This organic run does not require paid ad assets. Run Paid or Full later when budget and conversion inputs are available.')}
                            tone={includesPaidPlanningStrategy ? 'warning' : 'muted'}
                          />
                          <StrategyDocCard label={strategyDocText('إثبات الثقة', 'Social proof')} value={assetRequirements.forProof?.length ? <StrategyDocList locale={strategyDocumentLocale} items={assetRequirements.forProof.map((a: string) => a)} /> : null} />
                        </div>
                      )}
                      {strategy.executionChecklist?.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{strategyDocText('قائمة التنفيذ', 'Execution Checklist')}</p>
                          <StrategyDocList locale={strategyDocumentLocale} items={strategy.executionChecklist.map((item: string) => item)} />
                        </div>
                      )}
                      {(() => {
                        const hasAdContent = adSetupPlan && (
                          adSetupPlan.testBudget || adSetupPlan.duration || adSetupPlan.targeting ||
                          adSetupPlan.abTestPlan || adSetupPlan.landingPath || adSetupPlan.trackingRequired ||
                          adSetupPlan.adCopyAngles?.length > 0 || adSetupPlan.notReadyIf?.length > 0 ||
                          adSetupPlan.objective || adSetupPlan.platformPriority?.length > 0
                        )
                        if (!includesPaidPlanningStrategy) {
                          return (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                              {strategyDocIsArabic
                                ? 'التخطيط المدفوع غير مشمول في هذا التشغيل العضوي. يمكن إنشاء بريف Paid أو Full منفصل بعد إضافة الميزانية ووجهة التحويل ومدخلات التتبع.'
                                : 'Paid planning is not included in this organic run. Create a separate Paid or Full brief after adding budget, conversion, and tracking inputs.'}
                            </div>
                          )
                        }
                        // The current paidPlanning contract is authoritative and
                        // already rendered above with exact counts. Do not show
                        // the legacy adSetupPlan empty-state underneath it or
                        // falsely ask for budget/destination fields that may
                        // already exist in Brand Brain.
                        if (paidPlanning) return null
                        if (!hasAdContent) {
                          return (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                              {strategyDocIsArabic
                                ? 'التخطيط المدفوع غير جاهز بعد — أضف الميزانية ووجهة التحويل والتحليلات في Brand Brain.'
                                : 'Paid planning is not ready yet — add budget, conversion destination, and analytics context in Brand Brain.'}
                            </div>
                          )
                        }
                        return (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <button
                              type="button"
                              onClick={() => setAdSetupOpen(v => !v)}
                              className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-amber-950"
                            >
                              <span>{strategyDocText('خطة مدفوعة للمراجعة', 'Paid plan for review')}</span>
                              <span className="text-xs text-amber-700">{adSetupOpen ? strategyDocText('إخفاء', 'Hide') : strategyDocText('عرض', 'Show')}</span>
                            </button>
                            {adSetupOpen && (
                              <div className="mt-4 space-y-3">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                  {[
                                    { label: strategyDocText('ميزانية الاختبار', 'Test budget'), value: adSetupPlan.testBudget },
                                    { label: strategyDocText('المدة', 'Duration'), value: adSetupPlan.duration },
                                    { label: strategyDocText('خطة اختبار A/B', 'A/B test plan'), value: adSetupPlan.abTestPlan },
                                    { label: strategyDocText('مسار الهبوط', 'Landing path'), value: adSetupPlan.landingPath },
                                    { label: strategyDocText('التتبع', 'Tracking'), value: adSetupPlan.trackingRequired },
                                    { label: strategyDocFieldLabel('objective'), value: adSetupPlan.objective },
                                  ].map((item, i) => <StrategyDocCard key={i} label={item.label} value={item.value} locale={strategyDocumentLocale} />)}
                                </div>
                                <StrategyDocCard label={strategyDocText('الاستهداف', 'Targeting')} value={adSetupPlan.targeting} locale={strategyDocumentLocale} />
                                <StrategyDocCard label={strategyDocFieldLabel('exclusions')} value={adSetupPlan.exclusions} locale={strategyDocumentLocale} />
                                {adSetupPlan.adCopyAngles?.length > 0 && (
                                  <StrategyDocCard label={strategyDocFieldLabel('adCopyAngles')} value={<StrategyDocList locale={strategyDocumentLocale} items={adSetupPlan.adCopyAngles.map((angle: string) => angle)} />} />
                                )}
                                {adSetupPlan.notReadyIf?.length > 0 && (
                                  <StrategyDocCard
                                    label={strategyDocText('لا تشغّل الإعلانات إذا', 'Do not run ads if')}
                                    value={<StrategyDocList locale={strategyDocumentLocale} items={adSetupPlan.notReadyIf.map((item: string) => item)} />}
                                    tone="warning"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </StrategyDocSection>
                )}

                {hasRisksSection && (
                  <StrategyDocSection
                    id="strategy-risks"
                    eyebrow="09"
                    title={strategyDocText('المخاطر والافتراضات والبيانات الناقصة', 'Risks, Assumptions & Missing Data')}
                    description={strategyDocIsArabic
                      ? 'هذه الحدود تساعد على مراجعة الاستراتيجية بصدق قبل الانتقال إلى المحتوى.'
                      : 'These limits keep the strategy honest before it moves into content planning.'}
                  >
                    <div className="space-y-4">
                      <StrategyDocCard
                        label={strategyDocText('لقطة الأدلة عند الإنشاء', 'Evidence snapshot at generation')}
                        value={evidenceLedger.length > 0
                          ? <StrategyDocList
                              locale={strategyDocumentLocale}
                              items={evidenceLedger.map(item => item.status === 'source_linked'
                                ? `${item.statement} — ${strategyDocText('المصدر', 'Source')}: ${item.sourceName}${item.sourceLocator ? ` — ${item.sourceLocator}` : ''}`
                                : `${item.statement} — ${strategyDocText('مدخل Brand Brain بلا ملف مصدر', 'Brand Brain entry without an attached source file')}`)}
                            />
                          : strategyDocText(
                              'لم تُحفظ أدلة مع هذه الاستراتيجية؛ تعامل مع الادعاءات كفرضيات حتى إضافة مصدر واعتماده.',
                              'No approved evidence was saved with this strategy; treat claims as hypotheses until a source is added and approved.',
                            )}
                        locale={strategyDocumentLocale}
                        tone={evidenceLedger.length > 0 ? 'muted' : 'warning'}
                      />
                      {displayedConfidenceLevel && (
                        <StrategyDocCard
                          label={strategyDocText('الثقة', 'Confidence')}
                          value={`${confLevelLabel(displayedConfidenceLevel, strategyDocumentLocale)}${confidenceReport?.overall === 'high' && displayedConfidenceLevel !== 'high'
                            ? strategyDocText(' — خُفّضت بسبب بيانات ناقصة', ' — adjusted because inputs are missing')
                            : ''}`}
                          locale={strategyDocumentLocale}
                          tone="muted"
                        />
                      )}
                      {strategyDocMissingDataLabels.length > 0 && (
                        <StrategyDocCard
                          label={strategyDocText('بيانات ناقصة', 'Missing data')}
                          value={<StrategyDocList locale={strategyDocumentLocale} items={strategyDocMissingDataLabels.map(label => label)} />}
                          tone="warning"
                        />
                      )}
                      {competitorAnalysisComplete === false && (
                        <StrategyDocCard
                          label={strategyDocText('تحليل المنافسين', 'Competitor analysis')}
                          value={strategyDocIsArabic
                            ? 'غير مكتمل — لم تُضف منافسين، ولن يتم اختراع منافسين.'
                            : 'Incomplete — no competitors were provided, and competitors will not be invented.'}
                          locale={strategyDocumentLocale}
                          tone="warning"
                        />
                      )}
                      {doNotDoYet.length > 0 && (
                        <StrategyDocCard label={strategyDocText('لا تفعل الآن', 'Do not do yet')} value={<StrategyDocList locale={strategyDocumentLocale} items={doNotDoYet.map((item: string) => item)} />} tone="warning" />
                      )}
                      {riskNotes.length > 0 && (
                        <StrategyDocCard label={strategyDocText('ملاحظات المخاطر', 'Risk notes')} value={<StrategyDocList locale={strategyDocumentLocale} items={riskNotes.map((note: string) => note)} />} tone="warning" />
                      )}
                      {safeExecutionAssumptions.length > 0 && (
                        <StrategyDocCard label={strategyDocText('افتراضات التنفيذ', 'Execution assumptions')} value={<StrategyDocList locale={strategyDocumentLocale} items={safeExecutionAssumptions.map((item: string) => item)} />} />
                      )}
                      {safeAssumptions.length > 0 && (
                        <StrategyDocCard label={strategyDocText('افتراضات', 'Assumptions')} value={<StrategyDocList locale={strategyDocumentLocale} items={safeAssumptions.map((item: string) => item)} />} />
                      )}
                    </div>
                  </StrategyDocSection>
                )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowStrategyDocument(false)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      {uiText('إغلاق الوثيقة والعودة للملخص', 'Close document and return to summary')}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Tab 1: Content & Hooks (content workflow) ─────────────────── */}
            {activeTab === 1 && (
              <div className="space-y-4">
                <AgentBanner idx={1} />
                <BrandDNABadge brand={brandDNA} locale={locale} />
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                  <p className="text-sm font-semibold text-indigo-900">
                    {strategyRoomStateCopy.contentHooks.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-indigo-800">
                    {strategyRoomStateCopy.contentHooks.helper}
                  </p>
                  <p className="mt-3 rounded-xl border border-indigo-200 bg-white/70 px-3 py-2 text-xs leading-5 text-indigo-800">
                    {locale === 'ar'
                      ? 'الهوكس والزوايا هنا مواد مراجعة للحملة. تحديثات Brand Brain تتم عبر مقترحات إشارات مراجَعة أو من أسطح Brand Brain؛ الموافقات والتفضيلات إشارات وليست تعلّماً مدعوماً بالتحليلات.'
                      : 'Hooks and angles shown here are campaign review material. Brand Brain updates happen through reviewed signal proposals or Brand Brain surfaces; approvals and preferences are signals, not analytics-backed learning.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/campaigns/${campaignId}/content-hub`}
                      className="inline-flex items-center justify-center rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800"
                    >
                      {strategyRoomStateCopy.contentHooks.cta}
                    </Link>
                    <Link
                      href="/brand"
                      className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      {locale === 'ar' ? 'راجع إشارات Brand Brain' : 'Review Brand Brain signals'}
                    </Link>
                  </div>
                </div>

                {/* Top Hooks */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>🪝</span> {cdT?.sectionTopHooks}</h3>
                  {topHooks.length > 0 ? (
                    <div className="space-y-3">
                      {topHooks.map((hook: string, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="flex-1 text-sm font-semibold leading-6 text-indigo-700">"{hook}"</p>
                            <div className="flex gap-1 flex-shrink-0">
                              <CopyBtn text={hook} label={cdT?.copyBtn || 'Copy'} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySection icon="🪝" message={cdT?.emptyHooksDesc || 'No hooks generated yet.'} />
                  )}
                </div>

                {/* CTA Variations */}
                {ctaVariations.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>📣</span> {cdT?.sectionCtaVariations}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ctaVariations.map((cta: string, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 gap-3">
                          <span className="flex-1 text-sm text-slate-700">{cta}</span>
                          <CopyBtn text={cta} label={cdT?.copyBtn || 'Copy'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Caption Formulas */}
                {captionFormulas.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>✍️</span> {cdT?.sectionCaptionFormulas}</h3>
                    <div className="space-y-3">
                      {captionFormulas.map((caption: string, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="flex-1 text-sm leading-6 text-slate-700">{caption}</p>
                            <CopyBtn text={caption} label={cdT?.copyBtn || 'Copy'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Script Template */}
                {scriptTemplate && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>📝</span> {cdT?.sectionScriptTemplate}</h3>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="text-xs uppercase tracking-wide text-slate-400">{cdT?.sectionScriptTemplate || 'Script Template'}</span>
                        <CopyBtn text={scriptTemplate} label={cdT?.copyBtn || 'Copy'} />
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{scriptTemplate}</pre>
                    </div>
                  </div>
                )}

                {/* Content Angles — Sprint M detailed view (show both) */}
                {contentAnglesDetailed.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>💡</span> {cdT?.sectionContentAnglesDetailed || cdT?.sectionContentAngles || 'Content Angles'}</h3>
                    <div className="space-y-3">
                      {contentAnglesDetailed.map((angle: any, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{i + 1}</span>
                              <p className="text-sm font-semibold text-slate-950">{angle.title}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <CopyBtn text={`${angle.title}\n${angle.hook}`} label={cdT?.copyBtn || 'Copy'} />
                            </div>
                          </div>
                          {angle.hook && (
                            <p className="mb-2 text-sm italic text-indigo-700">"{angle.hook}"</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            {angle.pain && (
                              <div>
                                <span className="uppercase tracking-wide text-slate-400">{cdT?.anglePain || 'Pain'}: </span>
                                <span className="text-slate-600">{angle.pain}</span>
                              </div>
                            )}
                            {angle.format && (
                              <div>
                                <span className="uppercase tracking-wide text-slate-400">{strategyFieldLabel('format')}: </span>
                                <span className="text-slate-600">{formatStrategyDisplayText(angle.format, locale)}</span>
                              </div>
                            )}
                            {angle.platform && (
                              <div>
                                <span className="uppercase tracking-wide text-slate-400">{strategyFieldLabel('platform')}: </span>
                                <span className="text-slate-600">{formatStrategyPlatformLabel(angle.platform) || angle.platform}</span>
                              </div>
                            )}
                            {angle.asset && (
                              <div>
                                <span className="uppercase tracking-wide text-slate-400">{cdT?.angleAsset || 'Asset'}: </span>
                                <span className="text-slate-600">{angle.asset}</span>
                              </div>
                            )}
                          </div>
                          {(angle.cta || angle.funnelStage) && (
                            <div className="mt-2 flex items-center gap-3 border-t border-slate-200 pt-2 text-xs">
                              {angle.funnelStage && (
                                <span className="capitalize text-slate-500">{formatStrategyDisplayText(angle.funnelStage, locale)}</span>
                              )}
                              {angle.cta && (
                                <span className="ml-auto font-semibold text-indigo-700">{angle.cta}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Angles — legacy string list */}
                {contentAngles.length > 0 && contentAnglesDetailed.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>💡</span> {cdT?.sectionContentAngles || 'Content Angles'}</h3>
                    <div className="space-y-2">
                      {contentAngles.map((angle: string, i: number) => (
                        <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="mt-0.5 w-5 flex-shrink-0 text-xs font-bold text-indigo-700">{i + 1}</span>
                            <p className="text-sm leading-6 text-slate-700">{angle}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <CopyBtn text={angle} label={cdT?.copyBtn || 'Copy'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback if all empty */}
                {topHooks.length === 0 && ctaVariations.length === 0 && captionFormulas.length === 0 && contentAngles.length === 0 && contentAnglesDetailed.length === 0 && (
                  <EmptySection icon="✍️" message={cdT?.emptyHooksDesc || 'No content generated yet.'} />
                )}
              </div>
            )}

            {/* ── Tab 2: Calendar (campaign calendar) ───────────────────────── */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <AgentBanner idx={2} />
                {(weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && socialPostCalendarItems.length === 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="text-sm font-semibold text-amber-950">
                      {locale === 'ar' ? 'خطة تنفيذ للمراجعة — ليست جدولة منشورات' : 'Execution rhythm for review — not scheduled posts'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-900">
                      {locale === 'ar'
                        ? 'يعرض هذا التبويب أسابيع ورسائل وأصول مقترحة من الاستراتيجية فقط. لا توجد منشورات Content Hub مجدولة أو منشورة حتى يتم بناء خطة محتوى ومراجعتها صراحةً.'
                        : 'This tab shows strategy weeks, messages, and suggested assets only. No Content Hub posts are scheduled or published until a content plan is built and explicitly reviewed.'}
                    </p>
                  </div>
                )}

                {/* Weekly Execution Plan — Sprint M detailed (shown when available) */}
                {weeklyExecutionPlan.length > 0 && (
                  <div className="space-y-4">
                    <p className="px-1 text-xs uppercase tracking-wide text-slate-500">{cdT?.sectionWeeklyExecutionPlan || '4-Week Execution Plan'}</p>
                    {weeklyExecutionPlan.map((wk: any, wi: number) => (
                      <div key={wi} className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-amber-700">{cdT?.weekLabel || 'Week'} {wk.week}</h3>
                          {wk.cta && (
                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                              {strategyFieldLabel('cta')}: {wk.cta}
                            </span>
                          )}
                        </div>
                        {wk.objective && (
                          <div className="mb-3">
                            <span className="text-xs uppercase tracking-wide text-slate-400">{cdT?.weekObjective || 'Objective'}: </span>
                            <span className="text-sm font-semibold text-slate-800">{wk.objective}</span>
                          </div>
                        )}
                        {wk.keyMessage && (
                          <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                            <span className="text-xs uppercase tracking-wide text-indigo-600">{cdT?.weekKeyMessage || 'Key Message'}: </span>
                            <span className="text-sm text-slate-700">"{wk.keyMessage}"</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          {wk.deliverables?.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekDeliverables || 'Deliverables'}</p>
                              <ul className="space-y-1">
                                {wk.deliverables.map((d: string, di: number) => (
                                  <li key={di} className="flex items-start gap-1 text-xs text-slate-700">
                                    <span className="mt-0.5 text-indigo-500">·</span> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {wk.assetsNeeded?.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekAssets || 'Assets Needed'}</p>
                              <ul className="space-y-1">
                                {wk.assetsNeeded.map((a: string, ai: number) => (
                                  <li key={ai} className="flex items-start gap-1 text-xs text-slate-600">
                                    <span className="mt-0.5 text-amber-500">◦</span> {a}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {wk.successMetric && (
                          <div className="mt-3 text-xs">
                            <span className="uppercase tracking-wide text-slate-400">{strategyFieldLabel('successMetric')}: </span>
                            <span className="text-emerald-700">{wk.successMetric}</span>
                          </div>
                        )}
                        {wk.executionNote && (
                          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                            <p className="text-xs italic text-blue-700">{cdT?.weekExecutionNote || 'Note'}: {wk.executionNote}</p>
                          </div>
                        )}
                        {wk.reviewPoints?.length > 0 && (
                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekReviewPoints || 'Review at end of week'}</p>
                            <ul className="space-y-1">
                              {wk.reviewPoints.map((rp: string, ri: number) => (
                                <li key={ri} className="flex items-start gap-1.5 text-xs text-slate-500">
                                  <span className="mt-0.5 text-slate-400">→</span>{rp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Weekly Execution Plan (Sprint D2 — rich version, shown when M version not available) */}
                {weeklyPlan.length > 0 && weeklyExecutionPlan.length === 0 && (
                  <div className="space-y-4">
                    <p className="px-1 text-xs uppercase tracking-wide text-slate-500">{cdT?.sectionWeeklyPlan || '4-Week Execution Plan'}</p>
                    {weeklyPlan.map((wk: any, wi: number) => (
                      <div key={wi} className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-amber-700">{cdT?.weekLabel || 'Week'} {wk.week}</h3>
                          {wk.cta && (
                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                              {strategyFieldLabel('cta')}: {wk.cta}
                            </span>
                          )}
                        </div>
                        {wk.objective && (
                          <div className="mb-3">
                            <span className="text-xs uppercase tracking-wide text-slate-400">{cdT?.weekObjective || 'Objective'}: </span>
                            <span className="text-sm font-semibold text-slate-800">{wk.objective}</span>
                          </div>
                        )}
                        {wk.keyMessage && (
                          <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                            <span className="text-xs uppercase tracking-wide text-indigo-600">{cdT?.weekKeyMessage || 'Key Message'}: </span>
                            <span className="text-sm text-slate-700">"{wk.keyMessage}"</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          {wk.contentThemes?.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekThemes || 'Themes'}</p>
                              <ul className="space-y-1">
                                {wk.contentThemes.map((theme: string, ti: number) => (
                                  <li key={ti} className="flex items-start gap-1 text-xs text-slate-700">
                                    <span className="mt-0.5 text-indigo-500">·</span> {theme}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {wk.deliverables?.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekDeliverables || 'Deliverables'}</p>
                              <ul className="space-y-1">
                                {wk.deliverables.map((d: string, di: number) => (
                                  <li key={di} className="flex items-start gap-1 text-xs text-slate-700">
                                    <span className="mt-0.5 text-emerald-500">□</span> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {wk.channels?.length > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {wk.channels.map((ch: string, ci: number) => (
                              <span key={ci} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs capitalize text-slate-500">
                                {PLATFORM_ICONS[ch.toUpperCase()] || '🌐'} {ch}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Platform preview calendar */}
                {monthlyPreviewItems.length > 0 && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            {locale === 'ar' ? 'خطة الشهر حسب المنصة' : 'Monthly plan by platform'}
                          </p>
                          <h3 className="mt-1 font-semibold text-slate-950">
                            {locale === 'ar'
                              ? `${monthlyPreviewItems.length} كارت محتوى جاهز للمراجعة`
                              : `${monthlyPreviewItems.length} content cards ready for review`}
                          </h3>
                        </div>
                        <div className="md:ml-auto flex flex-wrap gap-2">
                          <span className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[11px] text-cyan-700">
                            {mediaStrategy?.mode === 'client_assets'
                              ? (locale === 'ar' ? `${mediaStrategy.sourceCount} ملف من الميديا دخلوا في الخطة` : `${mediaStrategy.sourceCount} media assets used`)
                              : (locale === 'ar' ? 'بدون ميديا: الصور هتتولد بالـ AI' : 'No media: AI visuals planned')}
                          </span>
                          {creativeAssets.some((asset: any) => asset.type === 'VIDEO') && (
                            <span className="rounded-full border border-pink-100 bg-pink-50 px-2.5 py-1 text-[11px] text-pink-700">
                              {locale === 'ar' ? 'الفيديوهات محسوبة في الخطة' : 'Videos considered in plan'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {Object.entries(postsByPlatform).map(([platformKey, postsUnknown]) => {
                      const posts = postsUnknown as any[]
                      const theme = platformTheme(platformKey)
                      return (
                        <div key={platformKey} className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <span className="text-lg">{theme.icon}</span>
                            <h3 className="font-semibold text-slate-950">{theme.label}</h3>
                            <span className="text-xs text-slate-500">· {posts.length} {locale === 'ar' ? 'بوست' : 'posts'}</span>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {posts.map((item: any, index: number) => (
                              <PlatformNativeCard
                                key={item.id || index}
                                item={item}
                                index={index}
                                locale={locale}
                                brandName={_postBrandName}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {monthlyPreviewItems.length === 0 && socialPostCalendarItems.length > 0 && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
                      <p className="text-xs uppercase tracking-wide text-violet-600">
                        {locale === 'ar' ? 'تقويم من Content Hub' : 'Calendar from Content Hub'}
                      </p>
                      <h3 className="mt-1 font-semibold text-slate-950">
                        {locale === 'ar'
                          ? `${socialPostCalendarItems.length} منشورات مجدولة أو مؤكدة يدويًا`
                          : `${socialPostCalendarItems.length} scheduled or user-confirmed posts`}
                      </h3>
                      <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">
                        {locale === 'ar'
                          ? 'المنشورات المجدولة أو المؤكدة يدويًا هي سجلات سير عمل؛ لا تتطلب إعادة توليد الاستراتيجية. المنشورات المجدولة محفوظة في NEXUS فقط وليست منشورة، والمنشور المؤكد يدويًا سجل من المستخدم وليس إثبات نشر عبر API.'
                          : 'Scheduled or manually published posts are workflow records; they do not require strategy regeneration. Scheduled posts are saved in NEXUS only and are not published; user-confirmed manual publish is a user record, not API proof.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {socialPostCalendarItems.map((item: any, index: number) => (
                        <PlatformNativeCard
                          key={item.id}
                          item={item}
                          index={index}
                          locale={locale}
                          brandName={_postBrandName}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {weeklyExecutionPlan.length === 0 && weeklyPlan.length === 0 && contentCalendar.length === 0 && monthlyPreviewItems.length === 0 && socialPostCalendarItems.length === 0 && (
                  <EmptySection icon="📅" message={cdT?.emptyCalendarDesc || 'Content calendar not available yet.'} />
                )}
              </div>
            )}

            {/* ── Tab 3: Creative ───────────────────────────────────────────── */}
            {activeTab === 3 && (
              <div id="campaign-creative-work" className="space-y-4 scroll-mt-24">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {locale === 'ar' ? 'الإبداع' : 'Creative'}
                  </p>
                  <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        {creativeStrategyScopeLabel}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-slate-800">{nextCreativeAction.title}</p>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                        {nextCreativeAction.helper}
                      </p>
                      <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                        {locale === 'ar'
                          ? 'يتبع العمل الإبداعي حالة الحملة. لا ينشر NEXUS أو يجدول المحتوى أو يطلق إعلانات من هذا التبويب. وسائط المنشورات النهائية تُراجع في Content Hub؛ المعاينات والأصول المفهومية لا تُرفق بالمنشورات تلقائياً.'
                          : 'Creative work follows the campaign state. NEXUS does not publish, schedule, or start paid campaigns from this tab. Final post media is reviewed in Content Hub; previews and concept assets are not automatically attached to posts.'}
                      </p>
                      {!includesPaidPlanningStrategy && (
                        <p className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-600">
                          {locale === 'ar'
                            ? 'هذه استراتيجية عضوية فقط. متطلبات الإعلانات المدفوعة والميزانية وإطلاق المنصات خارج نطاق هذا التشغيل.'
                            : 'This is an organic-only strategy. Paid ad creative, budget, and platform launch decisions are outside this run.'}
                        </p>
                      )}
                      <div className="mt-4 grid gap-2 lg:grid-cols-3">
                        {creativeOperatingSequence.map((step) => (
                          <div
                            key={step.step}
                            className={`rounded-xl border px-3 py-3 ${creativeOperatingStepTone[step.status]}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] font-bold opacity-55">{step.step}</span>
                              <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
                                {creativeOperatingStepLabel[step.status]}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold leading-5">{step.title}</p>
                            <p className="mt-1 text-[11px] leading-5 opacity-75">{step.helper}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <a
                      href={nextCreativeAction.href}
                      target={nextCreativeAction.href.startsWith('#') ? undefined : '_blank'}
                      rel={nextCreativeAction.href.startsWith('#') ? undefined : 'noopener noreferrer'}
                      className="inline-flex flex-shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
                    >
                      {nextCreativeAction.cta}
                      {!nextCreativeAction.href.startsWith('#') && <span className="ml-2 text-xs text-indigo-100">↗</span>}
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                        {locale === 'ar' ? 'متطلبات الإبداع للمنشورات' : 'Post creative requirements'}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-950">
                        {locale === 'ar'
                          ? 'متطلبات قبل أي توليد أو ربط وسائط'
                          : 'Requirements before any media generation or attachment'}
                      </h3>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                        {creativeHasPostRecords
                          ? (locale === 'ar'
                            ? 'تُستمد متطلبات الإبداع من الحملة وسياق Brand Brain والمنصة ونص المنشور. هي توجه قرارات الوسائط ولا تولّد أو تنشر أي شيء.'
                            : 'Creative requirements are derived from the campaign, Brand Brain context, platform, and post copy. They guide media decisions; they do not generate or publish anything.')
                          : (locale === 'ar'
                            ? 'لا توجد منشورات Content Hub بعد، لذلك لا توجد متطلبات وسائط مرتبطة بمنشورات حقيقية. ابدأ بخطة المحتوى قبل قرارات الصور أو الطبقات.'
                            : 'No Content Hub posts exist yet, so there are no post-linked media requirements. Prepare the content plan before image or layer decisions.')}
                      </p>
                    </div>
                    <a
                      href={`/campaigns/${campaign.id}/content-hub`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      {locale === 'ar' ? 'افتح مركز المحتوى' : 'Open Content Hub'}
                      <span className="ml-2 text-xs text-indigo-400">↗</span>
                    </a>
                  </div>
                  {creativeHasPostRecords ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                        <div className="text-lg font-semibold text-amber-700">{creativeRequirementsSummary.mediaNeeded}</div>
                        <div className="text-[10px] leading-4 text-amber-700">{locale === 'ar' ? 'تحتاج وسائط للمنشور' : 'need post media'}</div>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
                        <div className="text-lg font-semibold text-blue-700">{creativeRequirementsSummary.readinessPending}</div>
                        <div className="text-[10px] leading-4 text-blue-700">{locale === 'ar' ? 'معاينات تحتاج تأكيداً' : 'previews need confirmation'}</div>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                        <div className="text-lg font-semibold text-emerald-700">{creativeRequirementsSummary.attachedToPost}</div>
                        <div className="text-[10px] leading-4 text-emerald-700">{locale === 'ar' ? 'مرتبطة بالمنشورات' : 'attached to posts'}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                      {locale === 'ar'
                        ? 'لا تعرض هذه الصفحة أرقام وسائط صفرية كأنها جاهزية. ستظهر متطلبات الصور والطبقات بعد إنشاء منشورات Content Hub.'
                        : 'This page does not treat zero media counts as readiness. Image and layer requirements appear after Content Hub posts exist.'}
                    </p>
                  )}
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                    {locale === 'ar'
                      ? 'Content Hub هو مكان مراجعة وربط وسائط المنشورات النهائية. Creative Studio مساحة مستقبلية تبدأ لاحقاً من منشور محدد لطبقات النص والشعار وCTA، ولا تنشر أو تطلق إعلانات.'
                      : 'Content Hub is where final post media is reviewed and attached. Creative Studio is a future context-first workspace opened later from a specific post for headline, logo, and CTA layers; it does not publish or launch ads.'}
                  </p>
                </div>

                {/* ── Creative Brief Entry Card — Sprint F ── */}
                <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎨</span>
                      <div>
                        <h3 className="text-base font-semibold text-purple-700">{cdT?.creativeBriefTitle || 'Creative brief planner'}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {cdT?.creativeBriefSubtitle || 'Turn the strategy into asset requirements and visual direction before image generation, media attachment, or publishing.'}
                        </p>
                      </div>
                    </div>
                    {creativeBrief && (
                      <span className="flex-shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                        ✓ {creativeMode === 'asset' ? (cdT?.creativeModeAsset || 'Assets Analyzed') : (cdT?.creativeModeConceptGen || 'Concepts Generated')}
                      </span>
                    )}
                  </div>

                  <p className="mb-4 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-[11px] leading-5 text-purple-800">
                    {locale === 'ar'
                      ? 'مخطط الإبداع أداة تخطيط فقط. لا يعتمد المحتوى أو يجدوله أو ينشره، ولا يطلق حملات مدفوعة.'
                      : 'The creative brief planner is a planning artifact only. It does not approve, schedule, publish, or launch paid campaigns.'}
                  </p>

                  <div className="mb-5 border-y border-slate-100 py-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {locale === 'ar' ? 'مسار الأصول الإبداعية' : 'Creative asset path'}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        locale === 'ar' ? 'ارفع الأصول في مكتبة الوسائط' : 'Upload assets in Media Library',
                        locale === 'ar' ? 'افتح مخطط الإبداع واختر الأصل' : 'Open the planner and select the asset',
                        locale === 'ar' ? 'اربط الميديا النهائية لاحقًا من Content Hub' : 'Attach final media later from Content Hub',
                      ].map((step, index) => (
                        <div key={step} className="flex items-start gap-2 text-[11px] font-semibold leading-4 text-slate-700">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[10px] font-black text-purple-700">
                            {index + 1}
                          </span>
                          {step}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      {locale === 'ar'
                        ? 'رفع أصل لا يرفقه بالمنشورات ولا يستهلك كريديت. تحليل الموجز فقط هو إجراء مؤكد ومنفصل.'
                        : 'Uploading an asset does not attach it to posts or spend credits. Brief analysis is a separate confirmed action.'}
                    </p>
                  </div>

                  {/* Mode badges */}
                  <div className="flex gap-3 mb-5">
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2">
                      <span>🖼️</span>
                      <div>
                        <p className="text-xs font-bold text-purple-700">{cdT?.creativeModeAssetLabel || 'Review uploaded assets'}</p>
                        <p className="text-xs text-slate-500">{cdT?.creativeModeAssetDesc || 'Turn real photos or logos into review-ready creative direction'}</p>
                      </div>
                    </div>
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-pink-100 bg-pink-50 px-3 py-2">
                      <span>🤖</span>
                      <div>
                        <p className="text-xs font-bold text-pink-700">{cdT?.creativeModeConceptLabel || 'Review-only visual direction'}</p>
                        <p className="text-xs text-slate-500">{cdT?.creativeModeConceptDesc || 'Plan concepts and production notes without creating a final asset'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <button
                      onClick={() => window.open(`/campaigns/${campaign.id}/creative-brief`, '_blank')}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
                        creativeCanUsePostMediaFlow
                          ? 'bg-purple-600 hover:bg-purple-500'
                          : 'border border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                      style={creativeCanUsePostMediaFlow ? { color: '#fff' } : undefined}
                    >
                      <span>🎨</span>
                      {creativeBrief
                        ? (cdT?.openCreativeBriefBtn || 'Open creative brief planner')
                        : (locale === 'ar' ? 'افتح مخطط الإبداع' : 'Open creative brief planner')
                      }
                      <span className={creativeCanUsePostMediaFlow ? 'text-purple-300 text-xs' : 'text-purple-400 text-xs'}>↗</span>
                    </button>
                    <Link
                      href="/media"
                      className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                    >
                      {locale === 'ar' ? 'مكتبة الوسائط' : 'Media Library'}
                    </Link>
                  </div>
                </div>

                {/* ── Post Media Readiness / Content Hub Entry Card ── */}
                <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">📅</span>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-indigo-700">
                        {locale === 'ar' ? 'جاهزية وسائط المنشورات' : 'Post media readiness'}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {locale === 'ar'
                          ? 'Content Hub هو مصدر الحقيقة لمعاينات المنشورات النهائية والوسائط المرتبطة بكل SocialPost.'
                          : 'Content Hub is the source of truth for final post previews and media linked to each SocialPost.'}
                      </p>
                    </div>
                  </div>
                  {totalPostMediaSlots > 0 && (
                    <div className="mb-4 grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                        <div className="text-lg font-semibold text-indigo-700">{readyPostMediaSlots}</div>
                        <div className="text-[10px] text-indigo-600">{locale === 'ar' ? 'وسائط جاهزة' : 'media ready'}</div>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
                        <div className="text-lg font-semibold text-amber-700">{pendingPostMediaSlots}</div>
                        <div className="text-[10px] text-amber-700">{locale === 'ar' ? 'تحتاج قراراً' : 'need a decision'}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {campaign.platforms.length > 0 ? campaign.platforms.map((rawPlatform) => {
                      const platformKey = rawPlatform.trim().toUpperCase() === 'TWITTER'
                        ? 'X'
                        : rawPlatform.trim().toUpperCase()
                      return (
                        <span key={platformKey} className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                          {PLATFORM_ICONS[platformKey] || '🌐'} {formatStrategyPlatformLabel(rawPlatform) || rawPlatform}
                        </span>
                      )
                    }) : (
                      <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        {locale === 'ar' ? 'لم يتم تحديد المنصات' : 'Platforms not set'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/content-hub`, '_blank')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold transition-all hover:bg-indigo-500"
                    style={{ color: '#fff' }}
                  >
                    <span>📅</span>
                    {locale === 'ar' ? 'راجع وسائط المنشورات في مركز المحتوى' : 'Review post media in Content Hub'}
                    <span className="text-purple-300 text-xs">↗</span>
                  </button>
                </div>

                {/* ── Paid Creative Requirements / Paid Planning Brief Card ── */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">📋</span>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-slate-950">
                        {includesPaidPlanningStrategy
                          ? (locale === 'ar' ? 'متطلبات الإبداع للإعلانات المدفوعة' : 'Paid creative requirements')
                          : (locale === 'ar' ? 'الإعلانات المدفوعة خارج نطاق هذه الاستراتيجية' : 'Paid creative is outside this strategy run')}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {includesPaidPlanningStrategy
                          ? (locale === 'ar'
                            ? 'موجز التخطيط المدفوع يوضح احتياجات الإبداع والزوايا للمراجعة فقط، مستنداً إلى Brand Brain.'
                            : 'The paid planning brief captures creative needs and angles for review only, informed by Brand Brain.')
                          : (locale === 'ar'
                            ? 'هذا التشغيل عضوي فقط، لذلك لا تعرض الصفحة المدفوع كخطوة تنفيذ حالية. أنشئ Paid أو Full strategy لاحقاً عند توفر الميزانية ووجهة التحويل.'
                            : 'This is an organic-only run, so paid creative is not presented as an active execution step. Create a Paid or Full strategy later when budget and conversion inputs are ready.')}
                      </p>
                    </div>
                  </div>
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                    {includesPaidPlanningStrategy
                      ? (locale === 'ar'
                        ? 'تخطيط ومراجعة فقط — لا يتم إطلاق إعلانات أو صرف ميزانية أو دفع أصول إلى المنصات من تبويب الإبداع.'
                        : 'Planning and review only — no ads launch, no budget is spent, and no assets are pushed to platforms from Creative.')
                      : (locale === 'ar'
                        ? 'لا توجد ميزانية مدفوعة أو إطلاق منصات داخل هذا المسار العضوي.'
                        : 'There is no paid budget or platform launch inside this organic creative path.')}
                  </p>
                  {includesPaidPlanningStrategy ? (
                    <>
                      <div className="flex gap-2 mb-4 flex-wrap">
                        {['𝓕 Meta', 'G Google', '♪ TikTok', 'in LinkedIn'].map(p => (
                          <span key={p} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{p}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => window.open(`/campaigns/${campaign.id}/paid-launch`, '_blank')}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100"
                      >
                        {locale === 'ar' ? 'راجع جاهزية التنفيذ المدفوع' : 'Review paid execution readiness'}
                        <span className="text-xs text-slate-400">↗</span>
                      </button>
                    </>
                  ) : (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                      {locale === 'ar'
                        ? 'عند اختيار استراتيجية مدفوعة أو شاملة، ستظهر هنا متطلبات الإعلان المدفوع كخطة مراجعة فقط قبل أي صرف أو إطلاق.'
                        : 'When the user chooses a Paid or Full strategy, paid creative requirements appear here as review-only planning before any spend or launch.'}
                    </p>
                  )}
                </div>

                {/* Visual Direction from strategy */}
                {strategy.visualDirection && (
                  <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-purple-700"><span>🎯</span> {cdT?.sectionVisualDirection}</h3>
                    <p className="text-sm leading-6 text-slate-700">{strategy.visualDirection}</p>
                  </div>
                )}

                <div id="campaign-visual-generator" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                    {locale === 'ar'
                      ? 'المرئيات المفهومية للحملة هي أصول معرض للمراجعة. لا تُرفق بالمنشورات تلقائياً، ولا تُجدول أو تُنشر أو تُستخدم في الإعلانات تلقائياً.'
                      : 'Campaign concept visuals are gallery assets for review. They are not attached to posts automatically, scheduled, published, or used in ads automatically.'}
                  </p>
                  {creativeCanUseConceptGallery ? (
                    <VisualGenerator context={visualContext} />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="text-sm font-semibold text-slate-800">
                        {locale === 'ar' ? 'معرض المفاهيم غير متاح كخطوة حالية' : 'Concept gallery is not the current step'}
                      </p>
                      <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-500">
                        {creativeHasPostRecords
                          ? (locale === 'ar'
                            ? 'منشورات Content Hub موجودة بالفعل. افتح مخطط الإبداع أولاً لتحديد احتياجات الأصول والطبقات قبل أي توليد مرئيات مفهومية. هذا يمنع صرف كريديت أو إنشاء أصول خارج مسار الحملة.'
                            : 'Content Hub posts already exist. Open the creative brief planner first to define asset and layer needs before any concept visual generation. This prevents credit spend or assets outside the campaign path.')
                          : (locale === 'ar'
                            ? 'راجع الاستراتيجية وأنشئ منشورات Content Hub أولاً، ثم افتح مخطط الإبداع قبل أي توليد مرئيات. هذا يمنع صرف كريديت أو إنشاء أصول خارج مسار الحملة.'
                            : 'Review the strategy and create Content Hub posts first, then open the creative brief planner before any visual generation. This prevents credit spend or assets outside the campaign path.')}
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ── Tab 4: Publish to Social ─────────────────────────────────── */}
            {activeTab === 4 && (
              <div id="campaign-publish-work" className="space-y-4 scroll-mt-24">
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-emerald-950">
                          {locale === 'ar' ? publishTabSummary.safeCopy.title.ar : publishTabSummary.safeCopy.title.en}
                        </p>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-800">
                          {locale === 'ar' ? publishTabSummary.safeCopy.helper.ar : publishTabSummary.safeCopy.helper.en}
                        </p>
                      </div>
                      <span className="w-fit rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {locale === 'ar' ? 'جاهزية فقط' : 'Readiness only'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {[
                        publishTabSummary.safeCopy.scheduled,
                        publishTabSummary.safeCopy.manual,
                        publishTabSummary.safeCopy.api,
                        publishTabSummary.safeCopy.accounts,
                        publishTabSummary.safeCopy.automation,
                        publishTabSummary.safeCopy.performance,
                      ].map((item, index) => (
                        <div key={index} className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                          {locale === 'ar' ? item.ar : item.en}
                        </div>
                      ))}
                    </div>
                    {publishTabSummary.manualPublishedWithoutUrl > 0 && (
                      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        {locale === 'ar'
                          ? `${publishTabSummary.manualPublishedWithoutUrl} منشور مؤكد يدويًا بدون رابط مباشر محفوظ. هذا تسجيل من المستخدم، وليس إثبات منصة أو API.`
                          : `${publishTabSummary.manualPublishedWithoutUrl} manually published post has no live URL saved. This is a user record, not platform/API proof.`}
                      </p>
                    )}
                  </div>
                  {!(completeQualityReviewPassed && (campaign.status === 'ACTIVE' || approvalState === 'done')) && (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">
                        {locale === 'ar' ? 'النشر عبر المنصات مقفل حاليًا' : 'Platform publishing is locked for now'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        {locale === 'ar'
                          ? (publishTabSummary.scheduledNotPublished > 0
                            ? 'المنشورات المجدولة محفوظة داخل NEXUS، لكن النشر عبر المنصات/API يتطلب حساب نشر متصلًا، والتحقق من الصفحة والصلاحيات والوسائط، وتأكيدًا صريحًا.'
                            : 'لا توجد منشورات Content Hub مجدولة بعد. النشر عبر المنصات/API يتطلب منشورات جاهزة، وحساب نشر متصلًا، والتحقق من الصفحة والصلاحيات والوسائط، وتأكيدًا صريحًا.')
                          : (publishTabSummary.scheduledNotPublished > 0
                            ? 'Scheduled posts are saved in NEXUS, but platform/API publishing requires a connected publishing account, page/permission checks, media readiness, and explicit confirmation.'
                            : 'No Content Hub posts are scheduled yet. Platform/API publishing requires ready posts, a connected publishing account, page/permission checks, media readiness, and explicit confirmation.')}
                      </p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">
                          {locale === 'ar' ? 'جاهزية النشر تُراجع من Content Hub' : 'Publishing readiness belongs in Content Hub'}
                        </p>
                        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                          {locale === 'ar'
                            ? 'لا ينشر NEXUS من محرر نص حر داخل تبويب الحملة. أي جاهزية للنشر عبر منصة/API يجب أن تُراجع على منشور محدد في Content Hub بعد جاهزية الوسائط والحساب والصلاحيات وتأكيد صريح.'
                            : 'NEXUS no longer publishes from a free-form composer inside the campaign tab. Platform/API publish readiness must be reviewed on a specific Content Hub post after media, account, permission, and explicit confirmation checks are ready.'}
                        </p>
                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          {locale === 'ar'
                            ? 'هذا التبويب يعرض الجاهزية والحدود فقط. الربط لا يعني النشر، والجدولة داخل NEXUS لا تعني أن المنشور أصبح منشورًا على المنصة.'
                            : 'This tab shows readiness and boundaries only. Connecting does not publish, and scheduling in NEXUS does not mean a post is live on a platform.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/campaigns/${campaign.id}/content-hub`}
                          className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          {locale === 'ar' ? 'فتح Content Hub' : 'Open Content Hub'}
                        </Link>
                        <Link
                          href="/connections"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {locale === 'ar' ? 'مراجعة الاتصالات' : 'Review Connections'}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-lg">
                      📊
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">
                        {locale === 'ar' ? 'التحليلات مطلوبة للتعلّم' : 'Analytics required for learning'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {locale === 'ar'
                          ? 'التحليلات مطلوبة للتعلّم. لا يستطيع NEXUS تعلّم أنماط الأداء إلا بعد توفر تحليلات حقيقية للمنشورات المنشورة. هذا التبويب يعرض جاهزية النشر فقط.'
                          : 'Analytics required for learning. NEXUS can only learn performance patterns after published posts collect real analytics. This tab only shows publishing readiness.'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {locale === 'ar'
                          ? 'الاعتماد والجدولة والنشر اليدوي إشارات سير عمل فقط، وليست تعلمًا مدعومًا بالتحليلات.'
                          : 'Approval, scheduling, and manual publish are workflow signals only, not analytics-backed learning.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-950">
                          {locale === 'ar' ? 'أتمتة النشر' : 'Publishing automation'}
                        </p>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${campaign.autopilotEnabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {campaign.autopilotEnabled
                            ? (locale === 'ar' ? 'مفعّلة' : 'Enabled')
                            : (locale === 'ar' ? 'غير مفعّلة' : 'Not enabled')}
                        </span>
                      </div>
                      <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">
                        {locale === 'ar'
                          ? 'الأتمتة ليست مسارًا منفصلًا: هي وضع تنفيذ لمنشورات AUTO التي راجعتها وجدولتها بموافقة صريحة. التفعيل مجاني ولا ينشئ محتوى ولا يخصم كريديت.'
                          : 'Automation is not a separate workflow. It is an execution mode for AUTO posts you explicitly reviewed and scheduled. Enabling it is free; it creates no content and spends no credits.'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {locale === 'ar'
                          ? `${hasExplicitAutoSchedule ? 'يوجد منشور AUTO مؤهل.' : 'لا يوجد منشور AUTO مؤهل بعد.'} ${hasVerifiedPublishingConnection ? 'اتصال نشر موثّق متاح.' : 'يلزم اتصال نشر موثّق.'}`
                          : `${hasExplicitAutoSchedule ? 'An eligible AUTO post exists.' : 'No eligible AUTO post exists yet.'} ${hasVerifiedPublishingConnection ? 'A provider-verified publishing connection is available.' : 'A provider-verified publishing connection is required.'}`}
                      </p>
                    </div>
                    <Link
                      href={`/campaigns/${campaign.id}?tab=autopilot`}
                      className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                    >
                      {locale === 'ar' ? 'مراجعة إعدادات الأتمتة' : 'Review automation settings'}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab 5: Autopilot ──────────────────────────────────────────── */}
            {activeTab === 5 && (
              <div className="space-y-4">

                {/* Header card */}
                <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                      <span className="text-lg">🤖</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        {locale === 'ar' ? 'الأوتوبايلوت' : 'Autopilot'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {locale === 'ar'
                          ? 'يدعم سير عمل النشر فقط بعد موافقتك الصريحة وتفعيلك له.'
                          : 'Supports your publishing workflow only after explicit review and enablement.'}
                      </p>
                    </div>
                    {campaign.autopilotEnabled && (
                      <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                        {locale === 'ar' ? 'نشط' : 'Active'}
                      </div>
                    )}
                  </div>

                  {/* Trust contract — always visible (enabled or not). Light-lavender card → darken (not on-dark muted). */}
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                    {locale === 'ar'
                      ? 'لا يتم نشر أي محتوى أو صرف أي ميزانية من هذه الصفحة بدون مراجعة وتفعيل صريح.'
                      : 'No content publishes and no budget is spent from this page without explicit review and enablement.'}
                  </p>

                  {/* Requirements checklist */}
                  {!campaign.autopilotEnabled && (
                    <div className="mt-4 space-y-1.5">
                      {[
                        { label: locale === 'ar' ? 'الاستراتيجية اجتازت الحقيقة والجودة' : 'Strategy passed truth and quality review', done: completeQualityReviewPassed },
                        { label: locale === 'ar' ? 'لكل نسخة محتوى دليل اعتماد محفوظ' : 'Every content revision has saved approval evidence', done: hasReviewedContent },
                        { label: locale === 'ar' ? 'يوجد منشور AUTO مجدول بموافقة صريحة' : 'At least one explicitly approved AUTO post is scheduled', done: hasExplicitAutoSchedule },
                        { label: locale === 'ar' ? 'صلاحية نشر موثقة من المنصة' : 'Provider-verified publishing connection', done: hasVerifiedPublishingConnection },
                      ].map((req, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={req.done ? 'text-green-600' : 'text-slate-400'}>
                            {req.done ? '✓' : '○'}
                          </span>
                          <span className={req.done ? 'text-slate-700' : 'text-slate-400'}>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action row */}
                  <div className="mt-5 flex gap-2 flex-wrap">
                    {campaign.autopilotEnabled ? (
                      <>
                        <button
                          onClick={async () => {
                            const token = authHeader()
                            if (!token || autopilotPausing) return
                            setAutopilotPausing(true)
                            try {
                              const res = await fetch(`/api/autopilot/queue?campaignId=${campaignId}`, {
                                method: 'DELETE',
                                headers: { Authorization: token },
                              })
                              if (res.ok) {
                                setCampaign(prev => prev ? { ...prev, autopilotEnabled: false } : prev)
                                setAutopilotQueue([])
                              }
                            } finally {
                              setAutopilotPausing(false)
                            }
                          }}
                          disabled={autopilotPausing}
                          className="px-4 py-2 rounded-xl border text-xs font-semibold transition"
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                          {autopilotPausing ? '...' : (locale === 'ar' ? '⏸ إيقاف الأوتوبايلوت' : '⏸ Pause Autopilot')}
                        </button>
                        <button
                          onClick={async () => {
                            const token = authHeader()
                            if (!token) return
                            const res = await fetch(`/api/autopilot/queue?campaignId=${campaignId}`, {
                              headers: { Authorization: token },
                            })
                            const d = await res.json()
                            if (d.posts) setAutopilotQueue(d.posts)
                          }}
                          className="px-4 py-2 rounded-xl border text-xs font-semibold transition"
                          style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' }}>
                          {locale === 'ar' ? '↻ تحديث القائمة' : '↻ Refresh Queue'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowAutopilotConfirm(true)}
                        disabled={autopilotActivating || !autopilotRequirementsMet}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40"
                        style={{
                          background: autopilotActivating || !autopilotRequirementsMet
                            ? '#f1f5f9'
                            : '#f5f3ff',
                          color: autopilotActivating || !autopilotRequirementsMet
                            ? '#94a3b8' : '#6d28d9',
                          border: '1px solid #ddd6fe',
                        }}>
                        {autopilotActivating
                          ? (locale === 'ar' ? 'جاري التفعيل…' : 'Enabling…')
                          : (locale === 'ar' ? 'تفعيل الأوتوبايلوت' : 'Enable Autopilot')}
                      </button>
                    )}
                  </div>

                  {autopilotError && (
                    <p className="mt-3 text-xs text-red-600">⚠ {autopilotError}</p>
                  )}
                  {!aiOutput && (
                    <p className="mt-3 text-xs text-amber-700">
                      {locale === 'ar'
                        ? '⚠ يجب تشغيل "الاستراتيجية الكاملة" أولاً لتفعيل الأوتوبايلوت'
                        : '⚠ Run Full Strategy first to enable Autopilot'}
                    </p>
                  )}
                  {aiOutput && !hasExplicitAutoSchedule && (
                    <p className="mt-3 text-xs text-amber-700">
                      {locale === 'ar'
                        ? '⚠ اعتمد المحتوى، راجع الوسائط، ثم اختر جدولة AUTO بموافقة صريحة من Content Hub قبل تفعيل الأوتوبايلوت.'
                        : '⚠ Approve content, review media, then explicitly schedule at least one AUTO post in Content Hub before enabling Autopilot.'}
                    </p>
                  )}
                </div>

                {/* Queue table */}
                {autopilotQueue.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <span>📅</span>
                        {locale === 'ar'
                          ? campaign.autopilotEnabled
                            ? `${autopilotQueueHasScheduled ? 'قائمة الأوتوبايلوت المجدولة' : 'قائمة الأوتوبايلوت المخططة'} — ${autopilotQueue.length} منشور`
                            : autopilotQueueHasMixedManualAndScheduled
                              ? `${autopilotQueueManualPublishedCount} منشور مؤكد يدويًا · ${autopilotQueueScheduledCount} مجدولة — الأوتوبايلوت غير مفعّل`
                              : `${autopilotQueueHasScheduled ? 'محتوى مجدول — الأوتوبايلوت غير مفعّل' : 'محتوى مخطط — الأوتوبايلوت غير مفعّل'} — ${autopilotQueue.length} منشور`
                          : campaign.autopilotEnabled
                            ? `${autopilotQueueHasScheduled ? 'Autopilot scheduled queue' : 'Autopilot planned queue'} — ${autopilotQueue.length} posts`
                            : autopilotQueueHasMixedManualAndScheduled
                              ? `${autopilotQueueManualPublishedCount} manually published · ${autopilotQueueScheduledCount} scheduled — Autopilot not enabled`
                              : `${autopilotQueueHasScheduled ? 'Scheduled content — Autopilot not enabled' : 'Planned content — Autopilot not enabled'} — ${autopilotQueue.length} posts`}
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {autopilotQueue.map((post) => {
                        const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                          SCHEDULED:  { bg: '#f5f3ff', text: '#6d28d9', label: post.scheduledAt ? (locale === 'ar' ? 'مجدول' : 'Scheduled') : (locale === 'ar' ? 'مخطط' : 'Planned') },
                          PUBLISHED:  { bg: '#ecfdf5', text: '#047857', label: locale === 'ar' ? 'منشور' : 'Published' },
                          FAILED:     { bg: '#fef2f2', text: '#b91c1c', label: locale === 'ar' ? 'فشل' : 'Failed' },
                          DRAFT:      { bg: '#f1f5f9', text: '#64748b', label: locale === 'ar' ? 'مسودة' : 'Draft' },
                        }
                        const sc = statusColors[post.status] || statusColors.DRAFT
                        const platformIcons: Record<string, string> = { META: '👥', LINKEDIN: '💼', TIKTOK: '🎵' }

                        return (
                          <div key={post.id} className="flex items-start gap-4 px-5 py-4">
                            {/* Image preview */}
                            <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                              {post.imageUrl ? (
                                <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg text-slate-400">🖼</span>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {post.weekNumber && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                    style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                                    {locale === 'ar' ? `الأسبوع ${post.weekNumber}` : `Week ${post.weekNumber}`}
                                  </span>
                                )}
                                <span className="text-xs font-medium" style={{ color: '#64748b' }}>
                                  {platformIcons[post.platform] || '🌐'} {post.pageName || post.platform}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                  style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.text}30` }}>
                                  {sc.label}
                                </span>
                                {!post.imageUrl && post.status === 'SCHEDULED' && (
                                  <span className="text-xs text-amber-700">
                                    {locale === 'ar' ? 'الوسائط بانتظار التوليد — لا يوجد توليد صور نشط' : 'Media pending — no image generation running'}
                                  </span>
                                )}
                              </div>
                              <p className="line-clamp-2 text-xs text-slate-600">{post.caption}</p>
                              {post.scheduledAt && (
                                <p className="mt-1 text-xs text-slate-400">
                                  📅 {new Date(post.scheduledAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                                    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state when autopilot is active but queue was just loaded */}
                {campaign.autopilotEnabled && autopilotQueue.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="text-3xl mb-3">🤖</div>
                    <p className="text-sm text-slate-500">
                      {locale === 'ar'
                        ? 'جاري تحميل قائمة المنشورات...'
                        : 'Loading content queue...'}
                    </p>
                    <button
                      onClick={async () => {
                        const token = authHeader()
                        if (!token) return
                        const res = await fetch(`/api/autopilot/queue?campaignId=${campaignId}`, {
                          headers: { Authorization: token },
                        })
                        const d = await res.json()
                        if (d.posts) setAutopilotQueue(d.posts)
                      }}
                      className="mt-3 text-xs text-violet-700 transition hover:text-violet-600">
                      {locale === 'ar' ? '↻ تحميل' : '↻ Load queue'}
                    </button>
                  </div>
                )}

                {/* How it works */}
                {!campaign.autopilotEnabled && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700">
                      {locale === 'ar' ? '⚡ كيف يعمل الأوتوبايلوت' : '⚡ How Autopilot works'}
                    </h4>
                    <div className="space-y-2.5">
                      {(locale === 'ar' ? [
                        { icon: '✓', label: 'يقبل فقط منشورات AUTO المجدولة التي تحمل موافقة نشر صريحة' },
                        { icon: '🔒', label: 'يتحقق من اعتماد الاستراتيجية والمحتوى والوسائط واتصال المنصة قبل التفعيل' },
                        { icon: '📤', label: 'يحاول نشر العناصر المستحقة فقط عبر اتصال المنصة الموثق' },
                        { icon: '⏸', label: 'يمكن إيقافه؛ ولا يولّد نصوصًا أو صورًا ولا يخصم كريديت عند التفعيل' },
                      ] : [
                        { icon: '✓', label: 'Accepts only scheduled AUTO posts carrying explicit publish consent' },
                        { icon: '🔒', label: 'Checks strategy, content, media, and provider connection readiness before enablement' },
                        { icon: '📤', label: 'Attempts only due items through a provider-verified publishing connection' },
                        { icon: '⏸', label: 'Can be paused; enabling it generates no copy or images and spends no credits' },
                      ]).map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="text-sm flex-shrink-0 mt-0.5">{step.icon}</span>
                          <p className="text-xs text-slate-500">{step.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 6: Performance / ROI Dashboard ───────────────────── */}
            {activeTab === 6 && (
              <div id="campaign-performance-work" className="space-y-4 scroll-mt-24">
                {perfLoading && (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                )}

                {!perfLoading && !perfData && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="text-4xl mb-3">📊</div>
                    <h3 className="mb-1 text-base font-semibold text-slate-950">
                      {locale === 'ar' ? 'لا توجد بيانات أداء منشورة بعد' : 'No published performance data yet'}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {locale === 'ar'
                        ? 'تظهر البيانات هنا فقط بعد نشر المحتوى وجلب التحليلات الفعلية.'
                        : 'Data appears here only after posts are published and analytics are fetched.'}
                    </p>
                  </div>
                )}

                {!perfLoading && perfData && (() => {
                  const s = perfData.summary
                  if (!s || Number(s.publishedPosts ?? 0) <= 0) {
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <div className="text-4xl mb-3">📊</div>
                        <h3 className="mb-1 text-base font-semibold text-slate-950">
                          {locale === 'ar' ? 'لا توجد بيانات أداء منشورة بعد' : 'No published performance data yet'}
                        </h3>
                        <p className="mx-auto max-w-xl text-sm text-slate-500">
                          {locale === 'ar'
                            ? operatingState.truthFlags.hasContentPlan
                              ? 'تحتوي الحملة على محتوى مخطط أو مسودات، لكن الأداء لا يظهر إلا بعد النشر وجلب التحليلات الفعلية.'
                              : 'تحتوي الحملة على مادة تخطيط استراتيجية فقط، ولا توجد تحليلات لمحتوى منشور بعد. يظهر الأداء بعد النشر وجلب التحليلات الفعلية.'
                            : operatingState.truthFlags.hasContentPlan
                              ? 'This campaign has planned or draft post records, but performance appears only after posts are published and analytics are fetched.'
                              : 'This campaign has strategy planning material, but no published post analytics yet. Performance appears only after posts are published and analytics are fetched.'}
                        </p>
                      </div>
                    )
                  }
                  if (Number(s.postsWithAnalytics ?? 0) <= 0) {
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <div className="text-4xl mb-3">📊</div>
                        <h3 className="mb-1 text-base font-semibold text-slate-950">
                          {locale === 'ar' ? 'لا توجد بيانات أداء منشورة بعد' : 'No published performance data yet'}
                        </h3>
                        <p className="mx-auto max-w-xl text-sm text-slate-500">
                          {locale === 'ar'
                            ? 'تم تسجيل محتوى منشور أو منشور يدويًا، لكن لم يتم جلب بيانات تحليلية بعد. لا يعرض NEXUS مؤشرات أداء حتى توجد بيانات تحليلية حقيقية.'
                            : 'Published or manually recorded content exists, but analytics have not been fetched yet. NEXUS does not show KPI cards until real analytics data is available.'}
                        </p>
                      </div>
                    )
                  }
                  const platforms: Record<string, any> = perfData.platformBreakdown ?? {}
                  const topPosts: any[] = perfData.topPosts ?? []
                  const trend: any[] = perfData.trend ?? []

                  return (
                    <>
                      {/* KPI summary row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Total Reach',      value: s.totalReach.toLocaleString(),       icon: '👥', color: '#22d3ee' },
                          { label: 'Impressions',      value: s.totalImpressions.toLocaleString(), icon: '👁',  color: '#a78bfa' },
                          { label: 'Engagements',      value: s.totalEngagements.toLocaleString(), icon: '💬', color: '#34d399' },
                          { label: 'Avg Engagement',   value: `${s.avgEngagementRate}%`,           icon: '📈', color: '#fb923c' },
                        ].map(kpi => (
                          <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-base">{kpi.icon}</span>
                              <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
                            </div>
                            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Posts status row */}
                      <div className="flex flex-wrap gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        {[
                          ['Total Posts', s.totalPosts, '#9ca3af'],
                          ['Published',   s.publishedPosts, '#34d399'],
                          ['Scheduled',   s.scheduledPosts, '#a78bfa'],
                          ['Awaiting analytics', s.pendingAnalytics, '#fb923c'],
                        ].map(([label, val, color]) => (
                          <div key={String(label)} className="text-center">
                            <div className="text-xl font-bold" style={{ color: String(color) }}>{val}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
                          </div>
                        ))}
                        {s.pendingAnalytics > 0 && (
                          <p className="ml-auto self-center text-xs text-amber-700">
                            Awaiting provider-backed analytics; no performance is inferred while evidence is unavailable.
                          </p>
                        )}
                      </div>

                      {/* Platform breakdown */}
                      {Object.keys(platforms).length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h4 className="mb-4 text-sm font-semibold text-slate-950">Platform Breakdown</h4>
                          <div className="space-y-3">
                            {Object.entries(platforms).map(([platform, data]: [string, any]) => {
                              const color = PLATFORM_COLORS[platform] ?? '#6366f1'
                              const icon  = PLATFORM_ICONS[platform]  ?? '📣'
                              const maxReach = Math.max(...Object.values(platforms).map((d: any) => d.reach ?? 0), 1)
                              const barWidth = Math.round((data.reach / maxReach) * 100)
                              return (
                                <div key={platform}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span>{icon}</span>
                                      <span className="text-sm font-medium text-slate-800">{platform}</span>
                                      <span className="text-xs text-slate-500">{data.posts} posts</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-500">
                                      <span>{data.reach?.toLocaleString()} reach</span>
                                      <span className="font-semibold" style={{ color }}>{data.avgEngagementRate}%</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{ width: `${barWidth}%`, background: color }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Engagement trend */}
                      {trend.length > 1 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h4 className="mb-4 text-sm font-semibold text-slate-950">Engagement Trend</h4>
                          <div className="flex items-end gap-1 h-20">
                            {(() => {
                              const maxEng = Math.max(...trend.map(t => t.engagements), 1)
                              return trend.map((t, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                  <div
                                    className="w-full rounded-sm transition-all duration-500 group-hover:opacity-100"
                                    style={{
                                      height: `${Math.max(4, Math.round((t.engagements / maxEng) * 72))}px`,
                                      background: 'linear-gradient(to top, #22d3ee, #06b6d4)',
                                      opacity: 0.7,
                                    }}
                                    title={`${t.date}: ${t.engagements} engagements`}
                                  />
                                </div>
                              ))
                            })()}
                          </div>
                          <div className="mt-1 flex justify-between text-xs text-slate-400">
                            <span>{trend[0]?.date?.slice(5)}</span>
                            <span>{trend[trend.length - 1]?.date?.slice(5)}</span>
                          </div>
                        </div>
                      )}

                      {/* Top posts */}
                      {topPosts.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h4 className="mb-4 text-sm font-semibold text-slate-950">🏆 Top Performing Posts</h4>
                          <div className="space-y-3">
                            {topPosts.map((post, i) => (
                              <div key={post.id} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{
                                    background: i === 0 ? '#fef3c7' : '#f1f5f9',
                                    color: i === 0 ? '#b45309' : '#64748b',
                                    border: `1px solid ${i === 0 ? '#fde68a' : '#e2e8f0'}`,
                                  }}>
                                  {i + 1}
                                </div>
                                {post.imageUrl && (
                                  <img src={post.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="line-clamp-2 text-sm text-slate-700">{post.caption}</p>
                                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                    <span>{PLATFORM_ICONS[String(post.platform)] ?? '📣'} {post.platform}</span>
                                    <span>❤️ {post.likes}</span>
                                    <span>💬 {post.comments}</span>
                                    <span>🔁 {post.shares}</span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-base font-bold text-cyan-400">{post.engagementRate}%</div>
                                  <div className="text-xs text-gray-600">engagement</div>
                                  {post.platformUrl && (
                                    <a href={post.platformUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-purple-400 hover:text-purple-300 mt-1 block">
                                      View →
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>

    {campaignAction && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-action-title"
      >
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                {locale === 'ar' ? 'قرار في سجل الحملة' : 'Campaign record decision'}
              </p>
              <h3 id="campaign-action-title" className="mt-1 text-lg font-bold text-slate-950">
                {campaignAction === 'duplicate'
                  ? (locale === 'ar' ? 'إنشاء نسخة مسودة مستقلة؟' : 'Create an independent draft copy?')
                  : campaignAction === 'archive'
                    ? (locale === 'ar' ? 'أرشفة الحملة؟' : 'Archive this campaign?')
                    : (locale === 'ar' ? 'إعادة الحملة إلى مساحة العمل؟' : 'Return this campaign to the workspace?')}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setCampaignAction(null)
                setCampaignActionError('')
              }}
              disabled={campaignActionBusy}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
              {campaignAction === 'duplicate'
                ? (locale === 'ar'
                  ? 'ينشئ NEXUS نسخة DRAFT من إعدادات ووثيقة الحملة الحالية. لا ينسخ منشورات Content Hub أو الموافقات أو الجداول أو حالات النشر، ولا يخصم رصيداً.'
                  : 'NEXUS creates a DRAFT copy of the current campaign settings and document. It does not copy Content Hub posts, approvals, schedules, or publishing states, and it spends no credits.')
                : campaignAction === 'archive'
                  ? (locale === 'ar'
                    ? 'تخرج الحملة من العمل اليومي مع الاحتفاظ بوثيقتها ومنشوراتها وسجلها. الأرشفة داخل NEXUS لا توقف إعلاناً أو نشراً يعمل على منصة خارجية.'
                    : 'The campaign leaves daily work while its document, posts, and history are retained. Archiving inside NEXUS does not stop ads or publishing running on an external platform.')
                  : (locale === 'ar'
                    ? 'تعود الحملة إلى مساحة العمل كمسودة للمراجعة. تظل حالات منشورات Content Hub الحالية كما هي، ولا يُستأنف نشر أو إعلان تلقائياً.'
                    : 'The campaign returns to the workspace as a draft for review. Existing Content Hub post states stay unchanged, and publishing or ads do not resume automatically.')}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {(campaignAction === 'duplicate'
                ? [
                  locale === 'ar' ? 'التكلفة: 0 رصيد' : 'Cost: 0 credits',
                  locale === 'ar' ? 'الحالة الجديدة: مسودة' : 'New state: Draft',
                  locale === 'ar' ? 'تنفيذ خارجي: لا شيء' : 'External execution: none',
                ]
                : [
                  locale === 'ar' ? 'البيانات: محفوظة' : 'Data: retained',
                  locale === 'ar' ? 'المنشورات: بلا تغيير' : 'Posts: unchanged',
                  locale === 'ar' ? 'المنصات: بلا إجراء' : 'Platforms: no action',
                ]).map((item) => (
                  <span key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-[11px] font-semibold text-slate-700">
                    {item}
                  </span>
                ))}
            </div>

            {campaignActionError && (
              <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {campaignActionError}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setCampaignAction(null)
                setCampaignActionError('')
              }}
              disabled={campaignActionBusy}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={confirmCampaignAction}
              disabled={campaignActionBusy}
              className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${campaignAction === 'archive' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {campaignActionBusy
                ? (locale === 'ar' ? 'جارٍ التنفيذ...' : 'Working...')
                : campaignAction === 'duplicate'
                  ? (locale === 'ar' ? 'إنشاء نسخة مسودة' : 'Create draft copy')
                  : campaignAction === 'archive'
                    ? (locale === 'ar' ? 'تأكيد الأرشفة' : 'Confirm archive')
                    : (locale === 'ar' ? 'إعادة كمسودة' : 'Return as draft')}
            </button>
          </div>
        </div>
      </div>
    )}

    {showEngineRebuildModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                {locale === 'ar' ? 'إجراء حساس' : 'Dangerous action'}
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">
                {locale === 'ar' ? 'إعادة بناء حزمة الحملة' : 'Rebuild campaign package'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowEngineRebuildModal(false)
                setEngineRebuildAcknowledged(false)
              }}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-800">
                {locale === 'ar'
                  ? `تأكيد إعادة البناء — ${ENGINE_REBUILD_CREDIT_COST} كريديت`
                  : `Confirm rebuild — ${ENGINE_REBUILD_CREDIT_COST} credits`}
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-rose-900">
                <li>
                  {locale === 'ar'
                    ? 'يستبدل هذا مخرجات استراتيجية/حزمة الحملة وقد تتغير النتائج.'
                    : 'This overwrites campaign strategy/package output and the results may change.'}
                </li>
                <li>
                  {locale === 'ar'
                    ? 'لا يتم استرجاع المخرجات القديمة تلقائيًا.'
                    : 'Old output is not automatically restored.'}
                </li>
                <li>
                  {locale === 'ar'
                    ? 'لا ينشر ولا يجدول ولا يحدّث المنشورات الاجتماعية الحالية.'
                    : 'It does not publish, schedule, or update existing SocialPosts.'}
                </li>
              </ul>
            </div>

            {(engineRebuildStatusPending || engineRebuildLockedByProgress) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {engineRebuildStatusPending
                  ? (locale === 'ar'
                    ? 'يتم التحقق من حالة المنشورات قبل إتاحة أي إعادة بناء مدفوعة.'
                    : 'Checking post status before any credit-spending rebuild can be available.')
                  : (locale === 'ar'
                    ? 'إعادة البناء مقفلة لأن هذه الحملة لديها منشورات معتمدة أو مجدولة أو منشورة. يلزم مسار خطة مسودة جديدة قبل إعادة توليد مخرجات الحملة.'
                    : 'Rebuild is locked because this campaign already has approved, scheduled, or published posts. Create a new draft plan flow is required before regenerating campaign outputs.')}
              </div>
            )}

            {!engineRebuildStatusPending && !engineRebuildLockedByProgress && (
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  checked={engineRebuildAcknowledged}
                  onChange={e => setEngineRebuildAcknowledged(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  {locale === 'ar'
                    ? `أفهم أن هذا يكلف ${ENGINE_REBUILD_CREDIT_COST} كريديت ويستبدل مخرجات حزمة الحملة.`
                    : `I understand this costs ${ENGINE_REBUILD_CREDIT_COST} credits and overwrites the campaign package output.`}
                </span>
              </label>
            )}

            {engineError && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {engineError}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowEngineRebuildModal(false)
                setEngineRebuildAcknowledged(false)
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => handleRunEngine(true, {
                explicitEngineRebuildConfirmed: true,
                acknowledgedCreditCost: ENGINE_REBUILD_CREDIT_COST,
                acknowledgedOutputOverwrite: true,
              })}
              disabled={engineRunning || !engineRebuildAvailability.available}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {engineRunning
                ? (locale === 'ar' ? 'جارٍ إعادة البناء...' : 'Rebuilding...')
                : (locale === 'ar' ? `تأكيد إعادة البناء — ${ENGINE_REBUILD_CREDIT_COST} كريديت` : `Confirm rebuild — ${ENGINE_REBUILD_CREDIT_COST} credits`)}
            </button>
          </div>
        </div>
      </div>
    )}

    {showAutopilotConfirm && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-slate-950">
            {locale === 'ar' ? 'تفعيل مراقبة Autopilot' : 'Enable Autopilot monitoring'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {locale === 'ar'
              ? 'لا ينشئ هذا الإجراء محتوى جديدًا ولا يستهلك كريديت. سيُراقب فقط المنشورات التي راجعتها وجدولتها صراحةً بوضع AUTO، وقد تُنشر تلقائيًا في موعدها بعد اجتياز فحوص المنصة.'
              : 'This action creates no new content and uses no credits. It monitors only posts you reviewed and explicitly scheduled as AUTO; those posts may publish at their scheduled time after provider safety checks pass.'}
          </p>
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            {locale === 'ar' ? 'التكلفة: 0 كريديت · عدد طلبات AI: صفر' : 'Cost: 0 credits · AI provider calls: zero'}
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={autopilotConsentAcknowledged}
              onChange={event => setAutopilotConsentAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <span>
              {locale === 'ar'
                ? 'أؤكد أنني راجعت قائمة AUTO وأفهم أن المنشورات المؤهلة قد تُرسل تلقائيًا إلى المنصات في مواعيدها.'
                : 'I reviewed the AUTO queue and understand that eligible posts may be sent automatically to their platforms at the scheduled times.'}
            </span>
          </label>
          {autopilotError && <p className="mt-3 text-sm text-red-600">{autopilotError}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowAutopilotConfirm(false)
                setAutopilotConsentAcknowledged(false)
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleEnableAutopilot}
              disabled={!autopilotConsentAcknowledged || autopilotActivating}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {autopilotActivating
                ? (locale === 'ar' ? 'جارٍ التفعيل...' : 'Enabling...')
                : (locale === 'ar' ? 'تأكيد التفعيل' : 'Confirm enablement')}
            </button>
          </div>
        </div>
      </div>
    )}

    <CreditConfirmModal
      isOpen={showSentinelConfirm}
      onClose={() => setShowSentinelConfirm(false)}
      onConfirm={handleSentinelReview}
      cost={sentinelCreditCost}
      actionTitle={uiText('فحص جودة الاستراتيجية', 'Strategy quality review')}
      reason={uiText(
        'يستهلك هذا الفحص استدعاء ذكاء مستقلًا لمراجعة الادعاءات واتساق البراند والمخاطر بعد نجاح الفحص الحتمي المجاني.',
        'This uses a separate AI review for claims, brand alignment, and risk after the free deterministic gate passes.',
      )}
      authHeader={authHeader}
      locale={locale}
      includedItems={uiIsArabic
        ? ['مخاطر الادعاءات', 'اتساق البراند', 'إصلاحات مقترحة', 'لا نشر تلقائي']
        : ['Claim risks', 'Brand alignment', 'Recommended fixes', 'No automatic publishing']}
    />

    <ContentPlanApprovalDialog
      open={approvalState === 'confirming' || approvalState === 'approving'}
      locale={locale}
      strategyAlreadyApproved={campaign?.status === 'ACTIVE'}
      launchState={launchState}
      launchError={launchError}
      onConfirm={handleApproveAndBuildContent}
      onClose={() => {
        if (launchState === 'approving' || launchState === 'generating') return
        setApprovalState('idle')
        setLaunchError('')
      }}
    />

    <UpgradeModal
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      reason={upgradeReason}
    />
  </>
  )
}
