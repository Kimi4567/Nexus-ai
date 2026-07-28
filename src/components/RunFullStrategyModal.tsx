'use client'

/**
 * RunFullStrategyModal
 *
 * Triggered from the dashboard to re-run the full agency orchestration.
 * Calls POST /api/strategy/run-full — which reuses runFullAgency() unchanged.
 *
 * Pre-flight gate: fetches /api/brand first. If Brand Brain is incomplete,
 * the modal shows a gate screen (hard block) before spending any credits.
 *
 * States: running -> success | no_campaign | credits | no_brand | gate | error.
 * The running state never invents sub-step completion; only the API response
 * can move the request to success.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import UpgradeModal from '@/components/UpgradeModal'
import { useI18n } from '@/lib/i18n-context'
import { getBrandBrainReadiness, BrandReadinessResult, RequiredFieldKey } from '@/lib/brandReadiness'
import {
  getStrategyBriefReadiness,
  type StrategyBriefFieldKey,
  type StrategyBriefProfileLike,
} from '@/lib/strategyBriefReadiness'
import { useBillingStatus } from '@/lib/useBillingStatus'
import { getBrandIndustryLabel } from '@/lib/brandIndustries'
import { creditOperationScope, fetchCreditOperation } from '@/lib/creditOperationClient'
import { CREDIT_ACTION_COSTS } from '@/lib/creditActionTruth'
// PR-S1b — deterministic Strategy Order Review (display-only; no generation change).
import { formatStrategyDeliverableForLocale, getStrategyDeliverables } from '@/lib/strategy/deliverablesContract'
// PR-S1c-2 — variable strategy pricing (display side). The SAME pure function runs
// server-side before deduction, so the displayed price equals the charged price.
import { getStrategyCreditCost } from '@/lib/strategy/strategyPricing'
import { getStrategyToDraftsJourneyCost } from '@/lib/strategy/strategyPricingDisplayTruth'
import {
  CURRENT_CREDIT_PRICING_EFFECTIVE_DATE,
  CURRENT_CREDIT_PRICING_VERSION,
} from '@/lib/credits/pricing'
import type { StrategyOrder, ContentIntensity } from '@/lib/strategy/strategyOrder'
import { intensityForOrganicPostCount } from '@/lib/strategy/strategyPostCount'
import {
  intensityLabel,
  strategyIntensityHelperCopy,
  strategyIntensitySecondaryLabel,
  strategyIntensitySectionLabel,
  tierToPostsPerMonth,
} from '@/lib/strategy/strategyOrderDisplay'
import {
  Cpu, BarChart3, Megaphone, Shield, Zap,
  CheckCircle2, XCircle, ArrowUpRight, X, Rocket, Sparkles,
  Brain, Globe, AlertCircle, AlertTriangle, RefreshCw,
  CalendarDays, Coins, FileText, ListChecks, LockKeyhole, PencilLine,
  Target, Users,
} from 'lucide-react'

// -- Types -------------------------------------------------------------------

interface RunResult {
  ok?: boolean
  campaignId?: string | null
  campaignName?: string | null
  suggestions?: number
  creditsRemaining?: number
  creditsUsed?: number
  errors?: string[]
  error?: string
  message?: string
  code?: string
  upgradeUrl?: string
  redirectUrl?: string
  requiredCredits?: number
  currentCredits?: number
  durationMs?: number
  warnings?: string[]
  delivery?: {
    status: 'complete' | 'partial'
    requestedStrategyType: 'organic' | 'paid' | 'full'
    deliveredStrategyType: 'organic' | 'paid' | 'full'
    failedSection?: 'paid_planning'
  }
}

type Phase =
  | 'brand_review'
  | 'lang_select'
  | 'scope_review'
  | 'cost_confirm'
  | 'running'
  | 'success'
  | 'no_campaign'
  | 'error'
  | 'credits'
  | 'no_brand'
  | 'gate'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  /** Skip any cached success when the caller explicitly requested a new run. */
  startFresh?: boolean
}

export function strategyDefaultsFromBrand(profile: StrategyBriefProfileLike | null | undefined): {
  strategyType: 'organic' | 'paid' | 'full'
  strategyDuration: '30' | '90' | '180' | 'custom'
  selectedLanguage: 'ar' | 'en' | 'bilingual'
  customDurationDays: number
} {
  const strategyType = profile?.strategyType === 'paid' || profile?.strategyType === 'full'
    ? profile.strategyType
    : 'organic'
  const strategyDuration = ['30', '90', '180', 'custom'].includes(profile?.strategyDuration || '')
    ? profile?.strategyDuration as '30' | '90' | '180' | 'custom'
    : '30'
  const selectedLanguage = profile?.languagePreference === 'en'
    ? 'en'
    : profile?.languagePreference === 'both'
      ? 'bilingual'
      : 'ar'
  const customDurationDays = Number.isInteger(profile?.strategyCustomDays)
    ? Math.max(1, Math.min(180, Number(profile?.strategyCustomDays)))
    : 45

  return { strategyType, strategyDuration, selectedLanguage, customDurationDays }
}

// -- Progress steps ----------------------------------------------------------

// Scope included in the single server-side strategy request. These labels are
// displayed as request contents, never as simulated live progress.
const STEP_ICONS     = [Brain, Cpu, BarChart3, Megaphone, Shield]
const STEP_COLORS    = ['#4F46E5', '#6366F1', '#059669', '#EA580C', '#0284C7']
const STEP_KEYS      = ['step1', 'step2', 'step3', 'step4', 'step5'] as const

// -- Shared card style -------------------------------------------------------

const CARD_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 32px 100px rgba(15,23,42,0.24)',
}

const SELECTED_OPTION_STYLE: React.CSSProperties = {
  background: '#eef2ff',
  border: '1px solid #818cf8',
  color: '#3730a3',
}

const UNSELECTED_OPTION_STYLE: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#475569',
}

const primaryButtonStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 58%, #9333EA 100%)',
  color: '#fff',
  boxShadow: '0 12px 28px rgba(79,70,229,0.24)',
}

// -- Cache helpers -----------------------------------------------------------

const CACHE_KEY = 'nexus_run_strategy_result'
const STRATEGY_HANDOFF_KEY = 'nexus_strategy_handoff'
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

function saveResultCache(res: RunResult) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ result: res, ts: Date.now() }))
  } catch {}
}

function loadResultCache(): RunResult | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { result: res, ts } = JSON.parse(raw) as { result: RunResult; ts: number }
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY); return null }
    return res
  } catch { return null }
}

function clearResultCache() {
  try { sessionStorage.removeItem(CACHE_KEY) } catch {}
}

function saveStrategyHandoff(campaignId: string, data: { language: string; selectedMediaIds: string[] }) {
  try {
    const payload = JSON.stringify({ ...data, campaignId, ts: Date.now() })
    sessionStorage.setItem(`${STRATEGY_HANDOFF_KEY}:${campaignId}`, payload)
  } catch {}
}

// -- Component ---------------------------------------------------------------

export default function RunFullStrategyModal({ isOpen, onClose, onSuccess, startFresh = false }: Props) {
  const { authHeader } = useAuth()
  const { t, dir, locale } = useI18n()
  // PR-S1b — current plan tier (for the deterministic Order Review's plan-cap). Display only.
  const { status: billingStatus, invalidate: refreshBillingStatus } = useBillingStatus()

  // Close from success screen — clear cache so next open starts a fresh run
  const handleCloseFromSuccess = () => {
    clearResultCache()
    // Refresh the parent only after the user has seen the success receipt and
    // leaves this screen. Refreshing immediately can switch the Strategy page
    // between its empty/populated layouts, remount this modal while it is still
    // open, and incorrectly send a completed run back to the first gate.
    onSuccess?.()
    onClose()
  }

  // Start a new strategy run from the success screen.
  // Routes back through every request gate so a second run can never silently
  // spend more credits. No generation starts until the final cost confirmation.
  const handleRunAgain = () => {
    clearResultCache()
    setResult(null)
    setBrandConfirmed(false)
    setLangConfirmed(false)
    setScopeConfirmed(false)
    setCostConfirmed(false)
    setCreditBalance(null)
    setPhase('brand_review')
    setRunKey(k => k + 1)
  }

  const [phase, setPhase]             = useState<Phase>('brand_review')
  const [result, setResult]           = useState<RunResult | null>(null)
  const [gateData, setGateData]       = useState<BrandReadinessResult | null>(null)
  // runKey increments on retry to re-trigger the effect while modal stays open
  const [runKey, setRunKey]           = useState(0)
  const [showUpgrade, setShowUpgrade] = useState(false)
  // Tab hidden during generation — show sticky warning banner
  const [tabHiddenDuringRun, setTabHiddenDuringRun] = useState(false)
  // Language selection — user picks before running strategy
  const [selectedLanguage, setSelectedLanguage] = useState<'ar' | 'en' | 'bilingual'>('ar')
  const [brandConfirmed, setBrandConfirmed] = useState(false)
  const [langConfirmed, setLangConfirmed] = useState(false)
  // PR-I — generation-time strategy intent (not persisted). The default must
  // fit inside the 15-credit trial so a new user can complete the first
  // strategy and still run the required 2-credit review.
  const [strategyType, setStrategyType] = useState<'organic' | 'paid' | 'full'>('organic')
  const [strategyDuration, setStrategyDuration] = useState<'30' | '90' | '180' | 'custom'>('30')
  // PR-S1b/S1c — content intensity and optional exact organic direction count.
  const [contentIntensity, setContentIntensity] = useState<ContentIntensity>('light')
  const [useCustomPostCount, setUseCustomPostCount] = useState(false)
  const [customOrganicPostCount, setCustomOrganicPostCount] = useState<number>(12)
  // PR-S1b — custom horizon in days, only used when strategyDuration === 'custom'.
  const [customDurationDays, setCustomDurationDays] = useState<number>(45)
  // Cost confirmation — shown after language selection, before media check
  const [scopeConfirmed, setScopeConfirmed] = useState(false)
  const [costConfirmed, setCostConfirmed] = useState(false)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [strategyBrandProfile, setStrategyBrandProfile] = useState<StrategyBriefProfileLike | null>(null)
  const [strategyBriefLoading, setStrategyBriefLoading] = useState(false)

  const authHeaderRef = useRef(authHeader)
  const modalContentRef = useRef<HTMLDivElement>(null)
  useEffect(() => { authHeaderRef.current = authHeader }, [authHeader])

  useEffect(() => {
    if (isOpen && modalContentRef.current) modalContentRef.current.scrollTop = 0
  }, [isOpen, phase])

  // Reset language + cost gates when modal closes — both pickers show again on next open
  useEffect(() => {
    if (!isOpen) {
      setBrandConfirmed(false)
      setLangConfirmed(false)
      setScopeConfirmed(false)
      setCostConfirmed(false)
      setCreditBalance(null)
      setStrategyBrandProfile(null)
      setStrategyBriefLoading(false)
      setTabHiddenDuringRun(false)
      setPhase('brand_review')
    }
  }, [isOpen])

  // Load the two read-only inputs used by every preflight stage. This effect
  // never generates, charges, or mutates product data.
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setStrategyBriefLoading(true)

    Promise.all([
      fetch('/api/brand', {
        headers: { Authorization: authHeaderRef.current() },
      }).then(r => r.ok ? r.json() : null),
      fetch('/api/user/credits', {
        headers: { Authorization: authHeaderRef.current() },
      }).then(r => r.ok ? r.json() : null),
    ])
      .then(([brandData, creditData]: [
        { brandProfile?: StrategyBriefProfileLike | null } | null,
        { creditsRemaining?: number } | null,
      ]) => {
        if (cancelled) return
        const profile = brandData?.brandProfile ?? null
        setStrategyBrandProfile(profile)
        const defaults = strategyDefaultsFromBrand(profile)
        setStrategyType(defaults.strategyType)
        setStrategyDuration(defaults.strategyDuration)
        setSelectedLanguage(defaults.selectedLanguage)
        setCustomDurationDays(defaults.customDurationDays)
        if (creditData?.creditsRemaining !== undefined) {
          setCreditBalance(creditData.creditsRemaining)
        }
      })
      .catch(() => {
        if (!cancelled) setStrategyBrandProfile(null)
      })
      .finally(() => {
        if (!cancelled) setStrategyBriefLoading(false)
      })

    return () => { cancelled = true }
  }, [isOpen])

  // ── beforeunload + visibility protection during generation ─────────────────
  useEffect(() => {
    if (phase !== 'running') {
      setTabHiddenDuringRun(false)
      return
    }

    const warningMsg =
      locale === 'ar'
        ? 'الاستراتيجية قيد التوليد. أبقِ الصفحة مفتوحة لرؤية النتيجة فورًا؛ وإذا انقطع الاتصال فإعادة المحاولة تستخدم نفس العملية لمنع الخصم المكرر.'
        : 'Strategy generation is in progress. Keep this page open for the immediate result; if the connection drops, retrying reuses the same operation to prevent a duplicate charge.'

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = warningMsg
      return warningMsg
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabHiddenDuringRun(true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [phase, locale])

  // -- Core effect -----------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return

    // ── Check cache first — avoid re-running if user just closed and reopened ──
    // Only restore a cached successful run; other phases always re-run.
    if (!startFresh) {
      const cached = loadResultCache()
      if (cached?.campaignId) {
        setResult(cached)
        setPhase('success')
        return
      }
    } else {
      clearResultCache()
    }

    // Every new request passes through four explicit, read-only gates before
    // the final confirmation can start generation.
    if (!brandConfirmed) {
      setPhase('brand_review')
      return
    }

    if (!langConfirmed) {
      setPhase('lang_select')
      return
    }

    if (!scopeConfirmed) {
      setPhase('scope_review')
      return
    }

    if (!costConfirmed) {
      setPhase('cost_confirm')
      return
    }

    setPhase('running')
    setResult(null)
    setGateData(null)

    let cancelled = false

    // ── Define the actual strategy run (called from Continue button or retry) ─
    const startStrategyRun = () => {
      if (cancelled) return
      setPhase('running')

      const operationIdentity = JSON.stringify({
        selectedLanguage,
        strategyType,
        strategyDuration,
        contentIntensity,
        customDurationDays,
        customOrganicPostCount: strategyType !== 'paid' && useCustomPostCount ? customOrganicPostCount : null,
      })
      fetchCreditOperation(creditOperationScope('strategy:run-full', operationIdentity), '/api/strategy/run-full', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeaderRef.current(),
        },
        // PR-S1c-2 — send contentIntensity + customDurationDays so the backend can
        // rebuild the order and RECOMPUTE the cost. No client price is ever sent;
        // the server is the single source of truth for the charged amount.
        body: JSON.stringify({
          language: selectedLanguage,
          // Output language and interface language are separate concerns.
          // A bilingual strategy requested from the Arabic UI must still
          // receive Arabic operational errors and recovery actions.
          uiLocale: locale,
          mediaIds: [],
          strategyType,
          strategyDuration,
          contentIntensity,
          customDurationDays,
          goal: strategyBrandProfile?.campaignObjective || strategyBrandProfile?.businessGoal || undefined,
          customOrganicPostCount: strategyType !== 'paid' && useCustomPostCount
            ? customOrganicPostCount
            : null,
        }),
      })
        .then(res => res.json().then((d: RunResult) => ({ ok: res.ok, data: d })))
        .then(({ ok, data: d }) => {
          // Always persist a successful result — even if the modal was closed mid-run.
          // This means: if the user navigates away while generation is running and the
          // API finishes in the background, the result is saved to sessionStorage.
          // Next time they open the modal, loadResultCache() finds it and shows success
          // immediately without re-running the strategy.
          const errorCode = d.error
          const errorMsg = d.message || d.error || (Array.isArray(d.errors) && d.errors.length > 0 ? d.errors[0] : null)
          if (ok && !errorMsg && d.campaignId) {
            saveResultCache(d)
            saveStrategyHandoff(d.campaignId, {
              language: selectedLanguage,
              selectedMediaIds: [],
            })
          }

          if (cancelled) return

          if (!ok || errorMsg) {
            setResult({ ...d, code: errorCode, error: errorMsg || d.error })
            if (d.error === 'CAMPAIGN_LIMIT_REACHED' || d.code === 'CAMPAIGN_LIMIT_REACHED') {
              setPhase('no_campaign')
            } else if (errorMsg === 'INSUFFICIENT_CREDITS' || errorMsg === 'CREDITS_EXHAUSTED' || d.error === 'INSUFFICIENT_CREDITS') {
              setPhase('credits')
            } else if (d.error === 'NO_BRAND_PROFILE' || d.error === 'NO_WORKSPACE') {
              setPhase('no_brand')
            } else {
              setPhase('error')
            }
            return
          }

          setResult(d)
          if (!d.campaignId) {
            setPhase('no_campaign')
          } else {
            setPhase('success')
            void refreshBillingStatus()
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPhase('error')
            setResult({
              ok: false,
              error: selectedLanguage === 'ar'
                ? 'انقطع الاتصال قبل استلام النتيجة؛ قد يكون التشغيل اكتمل على الخادم. راجع قائمة الاستراتيجيات أولًا، ثم أعد المحاولة بأمان إذا لم تظهر النتيجة—سيُعاد استخدام نفس معرّف العملية ولن يبدأ خصم مكرر.'
                : 'The connection ended before the result arrived; the server run may still have completed. Check the strategy list first, then retry safely if no result appears—the same operation ID is reused and a duplicate charge is not started.',
            })
          }
        })
    }

    // Pre-flight: check Brand Brain readiness before spending credits
    fetch('/api/brand', {
      headers: { Authorization: authHeaderRef.current() },
    })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { brandProfile?: object | null } | null) => {
        if (cancelled) return

        const readiness = getBrandBrainReadiness(data?.brandProfile as any)
        const strategyReadiness = getStrategyBriefReadiness({
          mode: strategyType,
          brandProfile: data?.brandProfile as StrategyBriefProfileLike | null | undefined,
        })

        if (!readiness.ready) {
          setGateData(readiness)
          setPhase('gate')
          return
        }

        if (!strategyReadiness.canGenerate) {
          setResult({ ok: false, error: strategyReadiness.explanation })
          setPhase('error')
          return
        }

        // Cost confirmation is the final user confirmation gate. Do not insert
        // a second hidden media-selection step after a button that says
        // "Generate strategy" and shows the exact credit cost. Existing media
        // can be reviewed in Media Library/Content Hub; strategy generation
        // starts here with no upload, attach, publish, schedule, or ad action.
        startStrategyRun()
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error')
          setResult({ ok: false, error: 'Could not verify brand profile. Please try again.' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    isOpen,
    runKey,
    brandConfirmed,
    langConfirmed,
    scopeConfirmed,
    costConfirmed,
    strategyType,
    selectedLanguage,
    contentIntensity,
    customDurationDays,
    customOrganicPostCount,
    strategyDuration,
    strategyBrandProfile,
    useCustomPostCount,
    startFresh,
    refreshBillingStatus,
  ])

  if (!isOpen) return null

  const rs = t('runStrategy') as Record<string, string>
  const bg = t('brandGate')   as Record<string, string>

  const langLabel =
    selectedLanguage === 'ar' ? rs.chipLangAr
    : selectedLanguage === 'en' ? rs.chipLangEn
    : rs.chipLangMix

  const creditsLeftDisplay =
    result?.creditsRemaining === -1
      ? rs.statUnlimited
      : (result?.creditsRemaining ?? '--')
  const followUpDecisionLabel = (result?.suggestions ?? 0) === 1
    ? (locale === 'ar' ? 'قرار متابعة أُنشئ' : 'Follow-up decision created')
    : (locale === 'ar' ? 'قرارات متابعة أُنشئت' : 'Follow-up decisions created')
  const campaignLimitReached = result?.code === 'CAMPAIGN_LIMIT_REACHED'

  // Helper: translate a required field key to a human label
  const fieldLabel = (key: RequiredFieldKey) =>
    bg[`field${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? key

  const strategyBriefFieldLabel = (key: StrategyBriefFieldKey) => {
    const en: Record<StrategyBriefFieldKey, string> = {
      brandName: 'Brand name',
      industry: 'Industry',
      description: 'Business description',
      primaryOffer: 'Primary offer',
      targetAudience: 'Target audience',
      audiencePainPoints: 'Audience pain points',
      businessGoal: 'Business goal',
      topPlatforms: 'Organic platforms',
      toneOrLanguage: 'Tone or language preference',
      marketingBudget: 'Paid budget',
      conversionDestination: 'Conversion destination',
      leadHandling: 'Lead handling',
      audienceLocation: 'Audience or service location',
      trackingReadiness: 'Tracking readiness',
      platformReadiness: 'Platform readiness',
      budgetApproval: 'Budget approval',
      verifiedProof: 'Verified proof',
      pricePoint: 'Price position',
      uniqueAdvantages: 'Differentiators',
      customerObjections: 'Customer objections',
      averageOrderValue: 'Average order value',
      grossMargin: 'Gross margin',
    }
    const ar: Record<StrategyBriefFieldKey, string> = {
      brandName: 'اسم العلامة',
      industry: 'المجال',
      description: 'وصف النشاط',
      primaryOffer: 'العرض الأساسي',
      targetAudience: 'الجمهور المستهدف',
      audiencePainPoints: 'نقاط ألم الجمهور',
      businessGoal: 'هدف النشاط',
      topPlatforms: 'المنصات العضوية',
      toneOrLanguage: 'النبرة أو اللغة',
      marketingBudget: 'ميزانية المدفوع',
      conversionDestination: 'وجهة التحويل',
      leadHandling: 'التعامل مع العملاء المحتملين',
      audienceLocation: 'الموقع أو نطاق الخدمة',
      trackingReadiness: 'جاهزية التتبع',
      platformReadiness: 'جاهزية المنصة',
      budgetApproval: 'موافقة الميزانية',
      verifiedProof: 'إثبات موثّق',
      pricePoint: 'الشريحة السعرية',
      uniqueAdvantages: 'عوامل التميّز',
      customerObjections: 'اعتراضات العملاء',
      averageOrderValue: 'متوسط قيمة الطلب',
      grossMargin: 'هامش الربح',
    }
    return locale === 'ar' ? ar[key] : en[key]
  }

  const strategyOrderLanguage: StrategyOrder['language'] =
    selectedLanguage === 'bilingual' ? 'both' : selectedLanguage
  const strategyHorizonDays =
    strategyDuration === 'custom' ? customDurationDays : Number(strategyDuration)
  const strategyOrderPreview: StrategyOrder = {
    strategyType,
    durationPreset: strategyDuration,
    durationDays: strategyHorizonDays,
    contentIntensity,
    customOrganicPostCount: strategyType !== 'paid' && useCustomPostCount
      ? customOrganicPostCount
      : null,
    goal: '',
    language: strategyOrderLanguage,
  }
  const previewPostsPerMonth = tierToPostsPerMonth(billingStatus?.plan)
  const previewPlanContext =
    typeof previewPostsPerMonth === 'number' ? { postsPerMonth: previewPostsPerMonth } : undefined
  const strategyPricingPreview = getStrategyCreditCost(strategyOrderPreview, previewPlanContext)
  const strategyCostPreview = strategyPricingPreview.cost
  const strategyCostText =
    strategyCostPreview === null
      ? (locale === 'ar' ? 'عرض سعر مخصص' : 'custom quote')
      : `${strategyCostPreview} ${locale === 'ar' ? 'كريديت' : 'credits'}`
  const strategyTypePreviewLabel =
    locale === 'ar'
      ? { organic: 'عضوية', paid: 'مدفوعة', full: 'كاملة' }[strategyType]
      : { organic: 'Organic', paid: 'Paid', full: 'Full' }[strategyType]
  const strategyDurationPreviewLabel =
    strategyDuration === 'custom'
      ? (locale === 'ar' ? `${customDurationDays} يوم` : `${customDurationDays} days`)
      : (locale === 'ar' ? `${strategyHorizonDays} يوم` : `${strategyHorizonDays} days`)
  const strategyDeliverablesPreview = getStrategyDeliverables(
    strategyOrderPreview,
    previewPlanContext,
  )
  const effectiveOrganicPostCount = strategyDeliverablesPreview.organicPostCount
  const strategyIncludedGroups = [
    strategyType !== 'paid'
      ? {
          key: 'organic',
          title: locale === 'ar' ? 'الاتجاه العضوي' : 'Organic direction',
          items: locale === 'ar'
            ? [
                `استراتيجية ومخطط تنفيذ لمدة ${strategyDeliverablesPreview.detailedCalendarDays} يوماً`,
                `${effectiveOrganicPostCount} اتجاهات منشورات عضوية محددة لأول 30 يوماً`,
                'موضوعات أسبوعية وأولويات تنفيذ',
                'اتجاهات النصوص والدعوات للإجراء والمنصات',
                'تُنشأ مسودات Content Hub بشكل منفصل بعد مراجعة الاستراتيجية',
              ]
            : [
                `Detailed ${strategyDeliverablesPreview.detailedCalendarDays}-day strategy and execution outline`,
                `${effectiveOrganicPostCount} exact organic post directions for the first 30 days`,
                'Weekly themes and execution priorities',
                'Caption, CTA, and platform direction',
                'Content Hub drafts are generated separately after strategy review',
              ],
        }
      : null,
    strategyType !== 'organic'
      ? {
          key: 'paid',
          title: locale === 'ar' ? 'حزمة التخطيط المدفوع' : 'Paid planning package',
          items: locale === 'ar'
            ? [
                'هدف الحملة ومسار التحويل',
                `${strategyDeliverablesPreview.audienceHypothesisCount} فرضيات جمهور + ${strategyDeliverablesPreview.paidAdAngleCount} زوايا إعلانية`,
                `${strategyDeliverablesPreview.paidAdVariationCount} نسخ إعلانية + ${strategyDeliverablesPreview.creativeBriefCount} موجزات إبداعية`,
                'تقسيم الميزانية وقائمة التتبع وعوائق الإطلاق',
                strategyType === 'full'
                  ? 'مواءمة الرسائل والمسار وإعادة الاستهداف بين العضوي والمدفوع'
                  : 'تخطيط ومراجعة فقط — بلا إطلاق أو إنفاق',
              ]
            : [
                'Campaign objective and funnel structure',
                `${strategyDeliverablesPreview.audienceHypothesisCount} audience hypotheses + ${strategyDeliverablesPreview.paidAdAngleCount} ad angles`,
                `${strategyDeliverablesPreview.paidAdVariationCount} ad-copy variations + ${strategyDeliverablesPreview.creativeBriefCount} creative briefs`,
                'Budget split, tracking checklist, and launch blockers',
                strategyType === 'full'
                  ? 'Message, funnel, and retargeting alignment across organic and paid'
                  : 'Planning and review only — no launch or spend',
              ],
        }
      : null,
  ].filter((group): group is NonNullable<typeof group> => Boolean(group))
  const strategyPostCountPreviewLabel = strategyType === 'paid'
    ? (locale === 'ar' ? 'حزمة تخطيط مدفوع' : 'Paid planning package')
    : typeof effectiveOrganicPostCount === 'number'
      ? (useCustomPostCount && effectiveOrganicPostCount !== customOrganicPostCount
        ? (locale === 'ar'
          ? `${effectiveOrganicPostCount} اتجاهات منشورات (طُلب ${customOrganicPostCount})`
          : `${effectiveOrganicPostCount} post directions (requested ${customOrganicPostCount})`)
        : (locale === 'ar'
          ? `${effectiveOrganicPostCount} اتجاهات منشورات`
          : `${effectiveOrganicPostCount} post directions`))
      : intensityLabel(contentIntensity, locale)
  const strategyCostActionLabel =
    strategyCostPreview === null
      ? (locale === 'ar' ? 'مراجعة النطاق' : 'Review scope')
      : (locale === 'ar' ? `مراجعة التكلفة — ${strategyCostText}` : `Review cost — ${strategyCostText}`)
  const strategyReadinessPreview = getStrategyBriefReadiness({
    mode: strategyType,
    brandProfile: strategyBrandProfile,
  })
  const brandReadinessPreview = getBrandBrainReadiness(strategyBrandProfile)
  const strategyBrandRecord = (strategyBrandProfile ?? {}) as StrategyBriefProfileLike & {
    toneKeywords?: string[] | null
    competitorNotes?: string | null
    avoidKeywords?: string[] | null
  }
  const brandTone = strategyBrandRecord.writingStyle
    || strategyBrandRecord.toneKeywords?.filter(Boolean).slice(0, 3).join(' · ')
    || (locale === 'ar' ? 'لم تُحدد بعد' : 'Not set yet')
  const brandPlatforms = strategyBrandRecord.topPlatforms?.filter(Boolean).slice(0, 4) ?? []
  const languageLabels: Record<string, { ar: string; en: string }> = {
    ar: { ar: 'العربية', en: 'Arabic' },
    en: { ar: 'الإنجليزية', en: 'English' },
    both: { ar: 'العربية والإنجليزية', en: 'Arabic and English' },
  }
  const languageKey = typeof strategyBrandRecord.languagePreference === 'string'
    ? strategyBrandRecord.languagePreference.toLowerCase()
    : ''
  const brandIndustry = getBrandIndustryLabel(
    strategyBrandRecord.industry,
    locale === 'ar' ? 'ar' : 'en',
  )
  const brandLanguage = languageLabels[languageKey]
    ? languageLabels[languageKey][locale === 'ar' ? 'ar' : 'en']
    : strategyBrandRecord.languagePreference
  const includesPaidPreview = strategyType === 'paid' || strategyType === 'full'
  const hasOrganicDraftJourney = strategyDeliverablesPreview.organicPostCount > 0
  const strategyReviewCostPreview = CREDIT_ACTION_COSTS.SENTINEL_REVIEW
  const contentPlanCostPreview = hasOrganicDraftJourney
    ? CREDIT_ACTION_COSTS.CONTENT_PLAN_GENERATION
    : 0
  const copyDraftJourneyCostPreview = strategyCostPreview === null
    ? null
    : getStrategyToDraftsJourneyCost(
        strategyCostPreview,
        strategyReviewCostPreview,
        contentPlanCostPreview,
      )
  const mediaSlotCountPreview = strategyDeliverablesPreview.organicPostCount
  const generatedMediaMinimumPreview = mediaSlotCountPreview * CREDIT_ACTION_COSTS.IMAGE_GENERATION
  const generatedMediaMaximumPreview = mediaSlotCountPreview * CREDIT_ACTION_COSTS.VIDEO_GENERATION
  const fullProductionMinimumPreview = copyDraftJourneyCostPreview === null
    ? null
    : copyDraftJourneyCostPreview + generatedMediaMinimumPreview
  const fullProductionMaximumPreview = copyDraftJourneyCostPreview === null
    ? null
    : copyDraftJourneyCostPreview + generatedMediaMaximumPreview
  const isUnlimitedPreview = creditBalance === -1
  const projectedBalance = strategyCostPreview === null || creditBalance === null
    ? null
    : isUnlimitedPreview
      ? -1
      : creditBalance - strategyCostPreview
  const canAffordPreview = strategyCostPreview !== null
    && (isUnlimitedPreview || (creditBalance !== null && creditBalance >= strategyCostPreview))

  const retry = () => {
    clearResultCache()
    setPhase('running')
    setResult(null)
    setRunKey(k => k + 1)
  }

  return (
    <>
    <div
      dir={dir}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.32)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'running') onClose() }}
    >
      <div ref={modalContentRef} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] text-slate-700" style={CARD_STYLE}>

        {/* ========== BRAND CONTEXT REVIEW ========== */}
        {phase === 'brand_review' && (
          <div className="p-5 sm:p-8">
            <button type="button" onClick={onClose} aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              className="absolute top-4 end-4 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 shadow-[0_0_42px_rgba(99,102,241,0.18)]">
                <Brain className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">
                {locale === 'ar' ? 'الخطوة 1 من 4' : 'Step 1 of 4'}
              </p>
              <h2 className="text-2xl font-black text-slate-950">
                {locale === 'ar' ? 'هذا ما يفهمه NEXUS عن علامتك' : 'What NEXUS understands about your brand'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {locale === 'ar'
                  ? 'راجع السياق الفعلي المحفوظ قبل إعداد طلب الاستراتيجية.'
                  : 'Review the saved context that will inform this strategy request.'}
              </p>
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Brand Brain</p>
                    <p className="text-xs text-slate-500">
                      {strategyBriefLoading
                        ? (locale === 'ar' ? 'جارٍ قراءة السياق...' : 'Reading saved context...')
                        : brandReadinessPreview.ready
                          ? (locale === 'ar' ? 'السياق الأساسي جاهز لطلب عضوي' : 'Core context is ready for an organic request')
                          : (locale === 'ar' ? 'السياق الأساسي غير مكتمل' : 'Core context is incomplete')}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-black ${
                  strategyBriefLoading
                    ? 'bg-slate-100 text-slate-500'
                    : brandReadinessPreview.ready
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {strategyBriefLoading
                    ? (locale === 'ar' ? 'جارٍ التحقق' : 'Checking')
                    : brandReadinessPreview.ready
                      ? (locale === 'ar' ? 'جاهز للطلب العضوي' : 'Ready for organic request')
                      : (locale === 'ar' ? 'تحتاج بيانات أساسية' : 'Needs core inputs')}
                </span>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {[
                { icon: Target, label: locale === 'ar' ? 'العلامة التجارية' : 'Brand', value: strategyBrandRecord.brandName },
                { icon: ListChecks, label: locale === 'ar' ? 'المجال' : 'Industry', value: brandIndustry },
                { icon: Users, label: locale === 'ar' ? 'الجمهور' : 'Audience', value: strategyBrandRecord.targetAudience, wide: true },
                { icon: PencilLine, label: locale === 'ar' ? 'النبرة والأسلوب' : 'Tone and style', value: brandTone },
                { icon: Globe, label: locale === 'ar' ? 'لغة العملاء' : 'Customer language', value: brandLanguage },
                { icon: Globe, label: locale === 'ar' ? 'القنوات المستهدفة' : 'Target channels', value: brandPlatforms.join(' · ') },
              ].map(({ icon: Icon, label, value, wide }) => (
                <div key={label} className={`rounded-2xl border border-slate-200 bg-white p-4 ${wide ? 'sm:col-span-2' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-500">{label}</p>
                      {strategyBriefLoading ? (
                        <span className="mt-2 block h-4 w-32 max-w-full animate-pulse rounded-full bg-slate-200" aria-label={locale === 'ar' ? 'جارٍ تحميل القيمة المحفوظة' : 'Loading saved value'} />
                      ) : (
                        <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-900">
                          {value || (locale === 'ar' ? 'غير مكتمل' : 'Incomplete')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!strategyBriefLoading && brandReadinessPreview.missingRequired.length > 0 && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-black text-amber-900">
                      {locale === 'ar' ? 'أكمل البيانات الأساسية قبل التوليد' : 'Complete the core inputs before generation'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {brandReadinessPreview.missingRequired.map((key) => (
                        <span key={key} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-bold text-amber-800">
                          {fieldLabel(key)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
              <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
              <div>
                <p className="text-sm font-black text-indigo-950">
                  {locale === 'ar' ? 'الخطوة التالية' : 'Next step'}
                </p>
                <p className="mt-1 text-xs leading-5 text-indigo-800">
                  {strategyBriefLoading
                    ? (locale === 'ar' ? 'جارٍ تجهيز السياق المحفوظ. لن يظهر قرار جاهزية قبل اكتمال القراءة.' : 'Preparing the saved context. No readiness decision is shown until the read completes.')
                    : brandReadinessPreview.ready
                    ? (locale === 'ar' ? 'حدد نطاق الطلب الذي تريده. لا يبدأ أي توليد أو خصم حتى التأكيد النهائي، ويمكنك تعديل Brand Brain قبل أي طلب جديد.' : 'Choose the request scope. Nothing is generated or charged until the final confirmation, and you can update Brand Brain before any future request.')
                    : (locale === 'ar' ? 'ارجع إلى Brand Brain وأكمل الحقول المطلوبة. لا يوجد توليد أو خصم في هذه المرحلة.' : 'Return to Brand Brain and complete the required fields. Nothing is generated or charged here.')}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/brand" onClick={onClose}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">
                <PencilLine className="h-4 w-4" />
                {locale === 'ar' ? 'متابعة تعديل Brand Brain' : 'Continue editing Brand Brain'}
              </Link>
              <button type="button" disabled={strategyBriefLoading || !brandReadinessPreview.ready}
                onClick={() => setBrandConfirmed(true)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                style={strategyBriefLoading || !brandReadinessPreview.ready ? undefined : primaryButtonStyle}>
                <Rocket className="h-4 w-4" />
                {locale === 'ar' ? 'إعداد طلب الاستراتيجية' : 'Set up strategy request'}
              </button>
            </div>
          </div>
        )}

        {/* ========== REQUEST SETUP ========== */}
        {phase === 'lang_select' && (
          <div className="p-5 sm:p-8">
            <button type="button" onClick={onClose} aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              className="absolute top-4 end-4 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 shadow-[0_0_42px_rgba(99,102,241,0.18)]">
                <Globe className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">
                {locale === 'ar' ? 'الخطوة 2 من 4' : 'Step 2 of 4'}
              </p>
              <h2 className="text-2xl font-black text-slate-950">{rs.langSelectTitle}</h2>
              <p className="mt-2 text-sm text-slate-500">{rs.langSelectDesc}</p>
            </div>

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-black text-slate-900">{locale === 'ar' ? 'لغة مخرجات الاستراتيجية' : 'Strategy output language'}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  { id: 'ar' as const, flag: '🇸🇦', label: rs.langOptAr, desc: rs.langOptArDesc },
                  { id: 'en' as const, flag: '🇬🇧', label: rs.langOptEn, desc: rs.langOptEnDesc },
                  { id: 'bilingual' as const, flag: '🌐', label: rs.langOptMix, desc: rs.langOptMixDesc },
                ]).map((opt) => {
                  const selected = selectedLanguage === opt.id
                  return (
                    <button type="button" key={opt.id} aria-pressed={selected} onClick={() => setSelectedLanguage(opt.id)}
                      className="relative min-h-[112px] rounded-2xl p-4 text-center transition"
                      style={selected ? SELECTED_OPTION_STYLE : UNSELECTED_OPTION_STYLE}>
                      <span className="block text-2xl">{opt.flag}</span>
                      <span className="mt-2 block text-sm font-black text-slate-950">{opt.label}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-500">{opt.desc}</span>
                      {selected && <CheckCircle2 className="absolute start-3 top-3 h-4 w-4 text-indigo-600" />}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-black text-slate-900">{locale === 'ar' ? 'نوع الاستراتيجية' : 'Strategy type'}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ['organic', locale === 'ar' ? 'عضوي' : 'Organic', locale === 'ar' ? 'استراتيجية ومحتوى عضوي فقط' : 'Organic strategy and content direction only'],
                  ['paid', locale === 'ar' ? 'مدفوع' : 'Paid', locale === 'ar' ? 'بريف تخطيط إعلاني فقط' : 'Paid planning brief only'],
                  ['full', locale === 'ar' ? 'كامل' : 'Full', locale === 'ar' ? 'عضوي + تخطيط مدفوع' : 'Organic plus paid planning'],
                ] as const).map(([value, label, description]) => {
                  const selected = strategyType === value
                  return (
                    <button type="button" key={value} aria-pressed={selected} onClick={() => setStrategyType(value)}
                      className="relative min-h-[88px] rounded-2xl p-4 text-start transition"
                      style={selected ? SELECTED_OPTION_STYLE : UNSELECTED_OPTION_STYLE}>
                      <span className="block text-sm font-black text-slate-950">{label}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span>
                      {selected && <CheckCircle2 className="absolute start-3 top-3 h-4 w-4 text-indigo-600" />}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-black text-slate-900">{locale === 'ar' ? 'مدة الاستراتيجية' : 'Strategy horizon'}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  ['30', locale === 'ar' ? '30 يوم' : '30 days', locale === 'ar' ? 'شهر واحد' : 'One month'],
                  ['90', locale === 'ar' ? '90 يوم' : '90 days', locale === 'ar' ? '3 أشهر' : '3 months'],
                  ['180', locale === 'ar' ? '6 أشهر' : '6 months', locale === 'ar' ? '180 يوم' : '180 days'],
                  ['custom', locale === 'ar' ? 'مخصص' : 'Custom', locale === 'ar' ? 'حدد المدة' : 'Choose days'],
                ] as const).map(([value, label, description]) => {
                  const selected = strategyDuration === value
                  return (
                    <button type="button" key={value} aria-pressed={selected} onClick={() => setStrategyDuration(value)}
                      className="relative min-h-[76px] rounded-2xl p-3 text-center transition"
                      style={selected ? SELECTED_OPTION_STYLE : UNSELECTED_OPTION_STYLE}>
                      <span className="block text-sm font-black text-slate-950">{label}</span>
                      <span className="mt-1 block text-[10px] text-slate-500">{description}</span>
                      {selected && <CheckCircle2 className="absolute start-2 top-2 h-3.5 w-3.5 text-indigo-600" />}
                    </button>
                  )
                })}
              </div>
              {strategyDuration === 'custom' && (
                <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600">
                  <input type="number" min={1} max={180} value={customDurationDays}
                    aria-label={locale === 'ar' ? 'مدة الاستراتيجية بالأيام' : 'Strategy duration in days'}
                    onChange={(event) => setCustomDurationDays(Math.min(180, Math.max(1, Math.floor(Number(event.target.value) || 1))))}
                    className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-950 outline-none focus:border-indigo-500"
                    dir="ltr" />
                  {locale === 'ar' ? 'حتى 180 يوم؛ المدة الأطول تحتاج عرض سعر مخصص.' : 'Up to 180 days; longer horizons require a custom quote.'}
                </label>
              )}
            </section>

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-black text-slate-900">{strategyIntensitySectionLabel(strategyType, locale)}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(['light', 'standard', 'growth', 'daily'] as const).map((value) => {
                  const selected = contentIntensity === value
                  return (
                    <button type="button" key={value} aria-pressed={selected} onClick={() => {
                      setContentIntensity(value)
                      if (useCustomPostCount) {
                        setCustomOrganicPostCount({ light: 8, standard: 12, growth: 20, daily: 30 }[value])
                      }
                    }}
                      className="relative min-h-[76px] rounded-2xl p-3 text-center transition"
                      style={selected ? SELECTED_OPTION_STYLE : UNSELECTED_OPTION_STYLE}>
                      <span className="block text-sm font-black text-slate-950">{intensityLabel(value, locale)}</span>
                      <span className="mt-1 block text-[10px] text-slate-500">{strategyIntensitySecondaryLabel(value, strategyType, locale)}</span>
                      {selected && <CheckCircle2 className="absolute start-2 top-2 h-3.5 w-3.5 text-indigo-600" />}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[11px] leading-5 text-indigo-800">
                {strategyIntensityHelperCopy(strategyType, locale)}
              </p>
              {strategyType !== 'paid' && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={useCustomPostCount} onChange={(event) => {
                      const checked = event.target.checked
                      setUseCustomPostCount(checked)
                      if (checked) {
                        const nextCount = { light: 8, standard: 12, growth: 20, daily: 30 }[contentIntensity]
                        setCustomOrganicPostCount(nextCount)
                      }
                    }} />
                    {locale === 'ar' ? 'تحديد عدد دقيق لاتجاهات المنشورات في أول 30 يوم' : 'Set an exact post-direction count for the first 30 days'}
                  </label>
                  {useCustomPostCount && (
                    <input type="number" min={1} max={30} value={customOrganicPostCount}
                      aria-label={locale === 'ar' ? 'عدد اتجاهات المنشورات' : 'Post direction count'}
                      onChange={(event) => {
                        const nextCount = Math.min(30, Math.max(1, Math.floor(Number(event.target.value) || 1)))
                        setCustomOrganicPostCount(nextCount)
                        setContentIntensity(intensityForOrganicPostCount(nextCount))
                      }}
                      className="mt-3 w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-950 outline-none focus:border-indigo-500"
                      dir="ltr" />
                  )}
                </div>
              )}
            </section>

            <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div>
                <p className="text-sm font-black text-slate-950">{locale === 'ar' ? 'معاينة تكلفة الطلب' : 'Request cost preview'}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {locale === 'ar' ? 'قيمة العرض فقط؛ لن يُخصم أي رصيد قبل التأكيد النهائي.' : 'Display only; no credits are charged before final confirmation.'}
                </p>
              </div>
              <p className="shrink-0 text-2xl font-black text-indigo-600">{strategyCostText}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
              <button type="button" onClick={() => setBrandConfirmed(false)}
                className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">
                {locale === 'ar' ? 'رجوع إلى Brand Brain' : 'Back to Brand Brain'}
              </button>
              <button type="button" onClick={() => setLangConfirmed(true)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition hover:brightness-105"
                style={primaryButtonStyle}>
                <ListChecks className="h-4 w-4" />
                {locale === 'ar' ? 'مراجعة نطاق الاستراتيجية' : 'Review strategy scope'}
              </button>
            </div>
          </div>
        )}

        {/* ========== SCOPE REVIEW ========== */}
        {phase === 'scope_review' && (
          <div className="p-5 sm:p-8">
            <button type="button" onClick={onClose} aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              className="absolute top-4 end-4 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 shadow-[0_0_42px_rgba(99,102,241,0.18)]">
                <ListChecks className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">
                {locale === 'ar' ? 'الخطوة 3 من 4' : 'Step 3 of 4'}
              </p>
              <h2 className="text-2xl font-black text-slate-950">{locale === 'ar' ? 'مراجعة نطاق الاستراتيجية' : 'Review strategy scope'}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {locale === 'ar' ? 'راجع ما سينتجه الطلب وما يبقى خارج هذا التشغيل.' : 'Review exactly what this request creates and what remains outside this run.'}
              </p>
            </div>

            <div className="mb-5 grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:grid-cols-3">
              {[
                { icon: Rocket, label: locale === 'ar' ? 'نوع الاستراتيجية' : 'Strategy type', value: strategyTypePreviewLabel },
                { icon: CalendarDays, label: locale === 'ar' ? 'أفق التخطيط' : 'Planning horizon', value: strategyDurationPreviewLabel },
                { icon: Coins, label: locale === 'ar' ? 'تكلفة الطلب' : 'Request cost', value: strategyCostText },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl bg-white/80 p-3">
                  <Icon className="h-5 w-5 shrink-0 text-indigo-600" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {!strategyDeliverablesPreview.supported ? (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p>{locale === 'ar' ? 'هذا النطاق غير مدعوم تلقائيًا. ارجع وعدّل المدة؛ لم يتم توليد أو خصم أي شيء.' : 'This scope is not supported automatically. Go back and adjust the horizon; nothing has been generated or charged.'}</p>
                </div>
              </div>
            ) : (
              <div className="mb-5 grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" />
                    {locale === 'ar' ? 'ما الذي ستحصل عليه' : "What you'll receive"}
                  </h3>
                  <div className="space-y-4">
                    {strategyIncludedGroups.map((group) => (
                      <div key={group.key} className="rounded-xl border border-emerald-200/80 bg-white/70 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">{group.title}</p>
                        <div className="space-y-2">
                          {group.items.map((item) => (
                            <div key={item} className="flex items-start gap-2 text-xs leading-5 text-emerald-950">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-slate-700">
                    <XCircle className="h-5 w-5" />
                    {locale === 'ar' ? 'غير مشمول' : 'Not included'}
                  </h3>
                  <div className="space-y-2.5">
                    {strategyDeliverablesPreview.excludedDeliverables.slice(0, 8).map((item) => (
                      <div key={item} className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span>{formatStrategyDeliverableForLocale(item, locale === 'ar' ? 'ar' : 'en')}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {strategyDeliverablesPreview.planCapApplied && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                {locale === 'ar'
                  ? `خطتك الحالية تحد أول 30 يوم إلى ${strategyDeliverablesPreview.planCappedOrganicPostCount} اتجاهات منشورات؛ سيستخدم هذا الطلب ${strategyDeliverablesPreview.organicPostCount}.`
                  : `Your plan caps the first 30 days at ${strategyDeliverablesPreview.planCappedOrganicPostCount} post directions; this request will use ${strategyDeliverablesPreview.organicPostCount}.`}
              </div>
            )}

            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs leading-5 text-indigo-900">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
              <p>
                {locale === 'ar'
                  ? 'الاستراتيجية تنتج اتجاهًا وخطة تنفيذ. مسودات Content Hub وعناصر التقويم تُنشأ لاحقًا كخطوة منفصلة بعد مراجعة الاستراتيجية.'
                  : 'Strategy creates direction and an execution outline. Content Hub drafts and calendar entries are created later as a separate action after strategy review.'}
              </p>
            </div>

            {includesPaidPreview && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p>{locale === 'ar' ? 'المدفوع هنا تخطيط فقط. لا إطلاق، لا صرف، لا نشر، ولا إنشاء كائنات منصة بدون جاهزية وموافقة صريحة لاحقة.' : 'Paid scope is planning-only here. No launch, spend, publishing, or platform objects without later readiness and explicit approval.'}</p>
              </div>
            )}

            {!includesPaidPreview && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <p>{locale === 'ar' ? 'هذا طلب عضوي فقط. التخطيط المدفوع وإطلاق الإعلانات والإنفاق غير مشمولة في هذا التشغيل.' : 'This request is organic only. Paid planning, ad launch, and spend are not included in this run.'}</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
              <button type="button" onClick={() => setLangConfirmed(false)}
                className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">
                {locale === 'ar' ? 'رجوع وتعديل الطلب' : 'Back and edit request'}
              </button>
              <button type="button" disabled={!strategyDeliverablesPreview.supported} onClick={() => setScopeConfirmed(true)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                style={strategyDeliverablesPreview.supported ? primaryButtonStyle : undefined}>
                <Coins className="h-4 w-4" />
                {strategyCostActionLabel}
              </button>
            </div>
          </div>
        )}

        {/* ========== FINAL COST CONFIRMATION ========== */}
        {phase === 'cost_confirm' && (
          <div className="p-5 sm:p-8">
            <button type="button" onClick={onClose} aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              className="absolute top-4 end-4 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 shadow-[0_0_42px_rgba(99,102,241,0.18)]">
                <Sparkles className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">
                {locale === 'ar' ? 'الخطوة 4 من 4' : 'Step 4 of 4'}
              </p>
              <h2 className="text-2xl font-black text-slate-950">{locale === 'ar' ? 'مراجعة التكلفة والتأكيد النهائي' : 'Review cost and confirm'}</h2>
              <p className="mt-2 text-sm text-slate-500">{locale === 'ar' ? 'هذه هي النقطة الوحيدة التي تبدأ التوليد وتخصم الرصيد.' : 'This is the only action that starts generation and charges credits.'}</p>
            </div>

            <div className="mb-5 grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:grid-cols-4">
              {[
                { label: locale === 'ar' ? 'الطلب' : 'Request', value: strategyTypePreviewLabel, tone: 'text-slate-950' },
                { label: locale === 'ar' ? 'التكلفة' : 'Cost', value: strategyCostText, tone: 'text-indigo-600' },
                { label: locale === 'ar' ? 'رصيدك الحالي' : 'Current balance', value: creditBalance === null ? '...' : isUnlimitedPreview ? '∞' : String(creditBalance), tone: 'text-slate-950' },
                {
                  label: locale === 'ar' ? 'الرصيد بعد الإنشاء' : 'Balance after',
                  value: projectedBalance === null
                    ? '...'
                    : isUnlimitedPreview
                      ? '∞'
                      : !canAffordPreview
                        ? (locale === 'ar' ? 'غير كافٍ' : 'Insufficient')
                        : String(projectedBalance),
                  tone: canAffordPreview ? 'text-emerald-600' : 'text-rose-600',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-white/80 p-3 text-center">
                  <p className="text-[10px] font-bold text-slate-500">{item.label}</p>
                  <p className={`mt-1 text-lg font-black ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <p className="mb-4 text-center text-[11px] font-semibold leading-5 text-slate-500">
              {locale === 'ar'
                ? `نسخة التسعير ${CURRENT_CREDIT_PRICING_VERSION} — سارية من ${CURRENT_CREDIT_PRICING_EFFECTIVE_DATE}. يحتفظ السجل القديم بسعره ونسخته التاريخية ولا يُعاد تسعيره.`
                : `Pricing ${CURRENT_CREDIT_PRICING_VERSION} — effective ${CURRENT_CREDIT_PRICING_EFFECTIVE_DATE}. Earlier ledger entries keep their historical amount and are never repriced.`}
            </p>

            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">
                    {locale === 'ar' ? 'تقدير الرحلة قبل أن تبدأ' : 'Journey estimate before you start'}
                  </p>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
                    {locale === 'ar'
                      ? 'يُخصم الآن سعر الاستراتيجية فقط. المراجعة، مسودات النصوص، والصور أو الفيديوهات خطوات منفصلة لا تبدأ دون موافقة جديدة.'
                      : 'Only the strategy price is charged now. Quality review, copy drafts, and image or video production are separate steps that require a new approval.'}
                  </p>
                </div>
                <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-800">
                  {locale === 'ar' ? 'لا يوجد خصم وسائط الآن' : 'No media charge now'}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold text-slate-500">{locale === 'ar' ? 'الاستراتيجية الآن' : 'Strategy now'}</p>
                  <p className="mt-1 text-base font-black text-slate-950">{strategyCostText}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold text-slate-500">
                    {hasOrganicDraftJourney
                      ? (locale === 'ar' ? 'حتى مسودات النصوص' : 'Through copy drafts')
                      : (locale === 'ar' ? 'مع مراجعة الجودة' : 'With quality review')}
                  </p>
                  <p className="mt-1 text-base font-black text-slate-950">
                    {copyDraftJourneyCostPreview === null
                      ? (locale === 'ar' ? 'عرض مخصص' : 'Custom quote')
                      : `${copyDraftJourneyCostPreview} ${locale === 'ar' ? 'كريديت' : 'credits'}`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold text-slate-500">{locale === 'ar' ? 'الإنتاج الكامل التقديري' : 'Estimated full production'}</p>
                  <p className="mt-1 text-base font-black text-slate-950">
                    {mediaSlotCountPreview <= 0 || fullProductionMinimumPreview === null || fullProductionMaximumPreview === null
                      ? (locale === 'ar' ? 'يُسعّر حسب الإبداع المعتمد' : 'Quoted after creative approval')
                      : `${fullProductionMinimumPreview}–${fullProductionMaximumPreview} ${locale === 'ar' ? 'كريديت' : 'credits'}`}
                  </p>
                </div>
              </div>

              {mediaSlotCountPreview > 0 && (
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  {locale === 'ar'
                    ? `التقدير يغطي ${mediaSlotCountPreview} مسودة: يبدأ إذا استُخدمت صورة مولدة لكل مسودة (${CREDIT_ACTION_COSTS.IMAGE_GENERATION} لكل صورة)، ويصل للحد الأعلى فقط إذا اختير فيديو إعلاني احترافي مولد لكل مسودة (${CREDIT_ACTION_COSTS.VIDEO_GENERATION} لكل فيديو). تحويل فيديو أصلي مؤهل إلى Motion Design يكلف ${CREDIT_ACTION_COSTS.MOTION_DESIGN_VIDEO} كريديت. المزيج الفعلي يُعرض ويُعتمد لاحقاً لكل منشور.`
                    : `The estimate covers ${mediaSlotCountPreview} drafts: the lower bound assumes one generated image per draft (${CREDIT_ACTION_COSTS.IMAGE_GENERATION} each), while the upper bound assumes one professional generated video per draft (${CREDIT_ACTION_COSTS.VIDEO_GENERATION} each). Converting a qualified owned video into Motion Design costs ${CREDIT_ACTION_COSTS.MOTION_DESIGN_VIDEO} credits. The actual mix is quoted and approved per post later.`}
                </p>
              )}
            </div>

            <div className="mb-4 flex flex-wrap justify-center gap-2">
              {[strategyTypePreviewLabel, strategyDurationPreviewLabel, strategyPostCountPreviewLabel, langLabel].map((chip) => (
                <span key={chip} className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700">{chip}</span>
              ))}
            </div>

            <div className={`mb-4 rounded-2xl border p-4 ${strategyReadinessPreview.canGenerate ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-start gap-3">
                {strategyReadinessPreview.canGenerate
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
                <div>
                  <p className={`text-sm font-black ${strategyReadinessPreview.canGenerate ? 'text-emerald-900' : 'text-amber-900'}`}>
                    {strategyReadinessPreview.canGenerate
                      ? (locale === 'ar' ? 'البريف جاهز لهذا النطاق' : 'Brief is ready for this scope')
                      : (locale === 'ar' ? 'بيانات مطلوبة قبل التوليد' : 'Inputs required before generation')}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{locale === 'ar' ? strategyReadinessPreview.safeScopeAr : strategyReadinessPreview.safeScope}</p>
                  {strategyReadinessPreview.missingRequiredFields.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {strategyReadinessPreview.missingRequiredFields.map((field) => (
                        <span key={field} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[10px] font-bold text-amber-800">{strategyBriefFieldLabel(field)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {strategyReadinessPreview.warnings.includes('verified_proof_missing') && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <p>{locale === 'ar' ? 'لا يوجد إثبات موثّق كافٍ؛ سيُمنع استخدام شهادات أو جوائز أو نتائج عملاء غير مقدمة في المخرجات.' : 'Verified proof is incomplete; the output must not use unprovided testimonials, awards, reviews, or customer results.'}</p>
              </div>
            )}

            {!canAffordPreview && creditBalance !== null && strategyCostPreview !== null && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800">
                <Coins className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{locale === 'ar' ? `الرصيد غير كافٍ. تحتاج ${Math.max(0, strategyCostPreview - creditBalance)} كريديت إضافية.` : `Insufficient credits. You need ${Math.max(0, strategyCostPreview - creditBalance)} more credits.`}</p>
              </div>
            )}

            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-5 text-indigo-900">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
              <p>{locale === 'ar' ? 'لا يتضمن هذا التأكيد نشرًا أو جدولة أو إطلاق إعلانات أو صرف ميزانية أو تحديث تعلم الأداء. هذه إجراءات منفصلة ومقفلة.' : 'This confirmation does not publish, schedule, launch ads, spend budget, or update performance learning. Those are separate gated actions.'}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
              <button type="button" onClick={() => setScopeConfirmed(false)}
                className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">
                {locale === 'ar' ? 'رجوع إلى مراجعة النطاق' : 'Back to scope review'}
              </button>
              {strategyDeliverablesPreview.supported && strategyReadinessPreview.canGenerate && canAffordPreview && !strategyBriefLoading ? (
                <button type="button" onClick={() => setCostConfirmed(true)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition hover:brightness-105"
                  style={primaryButtonStyle}>
                  <Rocket className="h-4 w-4" />
                  {locale === 'ar' ? `تأكيد وإنشاء الاستراتيجية — ${strategyCostText}` : `Confirm and generate strategy — ${strategyCostText}`}
                </button>
              ) : !canAffordPreview && strategyCostPreview !== null ? (
                <button type="button" onClick={() => { onClose(); setShowUpgrade(true) }}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white">
                  <ArrowUpRight className="h-4 w-4" />
                  {locale === 'ar' ? 'إدارة الرصيد' : 'Manage credits'}
                </button>
              ) : strategyBriefLoading ? (
                <button type="button" disabled
                  className="flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 text-sm font-black text-slate-500">
                  <AlertTriangle className="h-4 w-4" />
                  {locale === 'ar' ? 'جارٍ فحص الجاهزية' : 'Checking readiness'}
                </button>
              ) : !strategyReadinessPreview.canGenerate ? (
                <Link href="/brand#strategy-readiness" onClick={onClose}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-black text-white transition hover:bg-amber-700">
                  <PencilLine className="h-4 w-4" />
                  {locale === 'ar' ? 'أضف بيانات النطاق في Brand Brain' : 'Add scope inputs in Brand Brain'}
                </Link>
              ) : (
                <button type="button" onClick={() => setScopeConfirmed(false)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 text-sm font-black text-slate-600">
                  <AlertTriangle className="h-4 w-4" />
                  {locale === 'ar' ? 'عدّل النطاق للمتابعة' : 'Adjust scope to continue'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========== RUNNING PHASE ========== */}
        {phase === 'running' && (
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-950">{rs.modalTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{rs.modalSubtitle}</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                <div className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: '#c7d2fe', borderTopColor: '#4F46E5' }} />
              </div>
            </div>

            <div className="space-y-2">
              {STEP_KEYS.map((key, i) => {
                const Icon     = STEP_ICONS[i]
                const color    = STEP_COLORS[i]
                return (
                  <div key={key}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: `${color}08`,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}14` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {rs[key]}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-[10px] text-slate-500 mt-4 text-center">{rs.infoUsing}</p>

            {/* Tab-hidden warning — appears if user switched away during generation */}
            {tabHiddenDuringRun && (
              <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2.5 animate-pulse"
                style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FFB800' }} />
                <p className="text-[11px] leading-snug text-amber-800">
                  {locale === 'ar'
                    ? 'التوليد لا يزال يعمل — أبقِ الصفحة مفتوحة لعرض النتيجة فورًا؛ إعادة المحاولة محمية من الخصم المكرر'
                    : 'Generation is still running — keep this page open for the immediate result; retries are protected from duplicate charges'}
                </p>
                <button
                  onClick={() => setTabHiddenDuringRun(false)}
                  className="ms-auto flex-shrink-0 text-slate-500 hover:text-slate-900 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========== GATE PHASE (Brand Brain incomplete — hard block) ========== */}
        {phase === 'gate' && gateData && (
          <div className="p-6">
            <button onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>

            {/* Icon + title */}
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.25)' }}>
                <Brain className="w-7 h-7" style={{ color: '#FFB800' }} />
              </div>
              <h2 className="text-xl font-bold text-slate-950 mb-1">{bg.runStrategyTitle}</h2>
              <p className="text-sm text-slate-500 leading-relaxed">{bg.runStrategyDesc}</p>
            </div>

            {/* Missing required fields */}
            {gateData.missingRequired.length > 0 && (
              <div className="rounded-xl p-4 mb-3"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                  style={{ color: '#EF4444' }}>
                  {bg.requiredLabel} — {bg.missingFieldsLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {gateData.missingRequired.map(key => (
                    <span key={key}
                      className="text-[11px] font-medium px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {fieldLabel(key)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing recommended fields (lighter treatment) */}
            {gateData.missingRecommended.length > 0 && (
              <div className="rounded-xl p-3 mb-4"
                style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)' }}>
                <p className="text-[10px] font-medium text-slate-500 mb-2">
                  {bg.recommendedLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {gateData.missingRecommended.slice(0, 4).map(key => (
                    <span key={key}
                      className="text-[10px] px-2 py-0.5 rounded-lg"
                      style={{ background: 'rgba(139,92,246,0.08)', color: '#a5a0ff', border: '1px solid rgba(139,92,246,0.15)' }}>
                      {bg[`field${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? key}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Why it matters */}
            <div className="rounded-xl p-3 mb-5"
              style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)' }}>
              <p className="text-[10px] font-bold text-emerald-600 mb-0.5">{bg.whyMatters}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">{bg.whyMattersDesc}</p>
            </div>

            {/* CTA: Complete Brand Brain (primary — hard block) */}
            <Link href="/brand" onClick={onClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-950 btn-gradient mb-2 transition-all hover:brightness-110">
              <Brain className="w-4 h-4" />
              {bg.completeBrandBtn}
            </Link>

            <button onClick={onClose}
              className="w-full px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 transition-all"
              style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
              {rs.errorClose}
            </button>
          </div>
        )}

        {/* ========== SUCCESS PHASE ========== */}
        {phase === 'success' && result && (
          <div className="p-6">
              <button onClick={handleCloseFromSuccess}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/5 transition-all">
                <span className="sr-only">{locale === 'ar' ? 'إغلاق' : 'Close'}</span>
                <X className="w-4 h-4" />
              </button>

            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-950 mb-1">{rs.successTitle}</h2>
              <p className="text-sm text-slate-500">{rs.successSub}</p>
            </div>

            {result.campaignName && (
              <div className="rounded-xl p-3 mb-4"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
                <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">{rs.campaignCreated}</p>
                <p className="text-sm font-bold text-slate-950 truncate">{result.campaignName}</p>
              </div>
            )}

            {result.delivery?.status === 'partial' && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-start" role="status">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-black text-amber-950">
                      {locale === 'ar' ? 'تم حفظ الجزء العضوي فقط' : 'Only the organic section was saved'}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-amber-900/80">
                      {locale === 'ar'
                        ? `حزمة التخطيط المدفوع لم تجتز عقد الجودة، لذلك لم تُحفظ ولم تُخصم تكلفتها. خُصم ${result.creditsUsed ?? 0} كريديت للنطاق العضوي الذي تم تسليمه فقط. يمكنك مراجعته الآن، ثم إنشاء طلب Paid منفصل لاحقاً دون إعادة شراء الجزء العضوي.`
                        : `The paid-planning package did not pass its quality contract, so it was neither saved nor charged. Only ${result.creditsUsed ?? 0} credits were charged for the delivered organic scope. Review it now, then create a separate Paid request later without buying the organic section again.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { value: '1',                            label: rs.statCampaign,     color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.18)' },
                { value: String(result.suggestions ?? 0),label: followUpDecisionLabel,  color: '#10B981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.18)' },
                { value: String(result.creditsUsed ?? 8), label: rs.statCreditsUsed,  color: '#FF6B35', bg: 'rgba(255,107,53,0.08)',  border: 'rgba(255,107,53,0.18)' },
                { value: String(creditsLeftDisplay),      label: rs.statCreditsLeft,  color: '#00D4FF', bg: 'rgba(0,212,255,0.08)',   border: 'rgba(0,212,255,0.18)' },
              ].map(({ value, label, color, bg: cellBg, border }) => (
                <div key={label} className="rounded-xl p-2.5 text-center"
                  style={{ background: cellBg, border: `1px solid ${border}` }}>
                  <p className="text-base font-bold leading-none mb-1" style={{ color }}>{value}</p>
                  <p className="text-[9px] text-slate-500 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {(result.suggestions ?? 0) > 0 && (
              <p className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-semibold leading-5 text-emerald-800">
                {locale === 'ar'
                  ? 'ستجد قرار المتابعة داخل الحملة وفي صفحة الموافقات عندما يحتاج تأكيدك؛ لا يُنفّذ تلقائياً.'
                  : 'The follow-up decision appears inside the campaign and in Approvals when it needs confirmation; it is not executed automatically.'}
              </p>
            )}

            {typeof result.durationMs === 'number' && result.durationMs > 0 && (
              <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] font-semibold text-slate-600">
                {locale === 'ar'
                  ? `اكتمل التشغيل وحُفظ خلال ${Math.max(1, Math.round(result.durationMs / 1000))} ثانية.`
                  : `The run completed and was saved in ${Math.max(1, Math.round(result.durationMs / 1000))} seconds.`}
              </p>
            )}

            <div className="flex gap-2 mb-5">
              <span className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a5a0ff' }}>
                <Brain className="w-3 h-3" />
                {rs.chipBrandBrain}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg"
                style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', color: '#00D4FF' }}>
                <Globe className="w-3 h-3" />
                {langLabel}
              </span>
            </div>

            {result.campaignId ? (
              <Link href={`/campaigns/${result.campaignId}?tab=strategy`} onClick={handleCloseFromSuccess}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-950 mb-3 btn-gradient transition-all hover:brightness-110">
                <Rocket className="w-4 h-4" />
                {rs.successCampaign}
              </Link>
            ) : (
              <Link href="/campaigns" onClick={handleCloseFromSuccess}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-950 mb-3 btn-gradient transition-all hover:brightness-110">
                <Sparkles className="w-4 h-4" />
                {rs.successCampaigns}
              </Link>
            )}

            {/* Run Again — clears cache and starts a fresh strategy run */}
            <button onClick={handleRunAgain}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-medium mb-3 transition-all hover:brightness-110"
              style={{ background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.18)', color: '#00D4FF' }}>
              <RefreshCw className="w-3.5 h-3.5" />
              {locale === 'ar' ? 'تشغيل استراتيجية جديدة' : 'Run New Strategy'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleCloseFromSuccess}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all hover:brightness-110"
                style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)', color: '#FFB800' }}>
                <Sparkles className="w-3.5 h-3.5" />
                {rs.successSuggestions}
              </button>
              <Link href="/brand" onClick={handleCloseFromSuccess}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all hover:brightness-110"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', color: '#10B981' }}>
                <Cpu className="w-3.5 h-3.5" />
                {rs.successBrand}
              </Link>
            </div>
          </div>
        )}

        {/* ========== NO CAMPAIGN CREATED ========== */}
        {phase === 'no_campaign' && (
          <div className="p-6 text-center">
            <button onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.25)' }}>
              <AlertCircle className="w-7 h-7" style={{ color: '#FFB800' }} />
            </div>
            <h2 className="text-xl font-bold text-slate-950 mb-1">
              {campaignLimitReached
                ? (locale === 'ar' ? 'وصلت إلى حد الحملات في باقتك' : 'Campaign limit reached')
                : rs.noResultTitle}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {campaignLimitReached && result?.error ? result.error : rs.noResultDesc}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 border transition-all hover:text-slate-900"
                style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                {rs.errorClose}
              </button>
              {campaignLimitReached ? (
                <Link href={result.upgradeUrl || '/billing'} onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-950 btn-gradient">
                  <ArrowUpRight className="w-4 h-4" />
                  {locale === 'ar' ? 'عرض الباقات' : 'View plans'}
                </Link>
              ) : (
                <button onClick={retry}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-950 btn-gradient">
                  <Sparkles className="w-4 h-4" />
                  {rs.errorRetry}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========== CREDITS PHASE ========== */}
        {phase === 'credits' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)' }}>
              <Zap className="w-7 h-7" style={{ color: '#FF6B35' }} />
            </div>
            <h2 className="text-xl font-bold text-slate-950 mb-1">{rs.creditsTitle}</h2>
            <p className="text-sm text-slate-500 mb-4">{rs.creditsDesc}</p>

            {result?.requiredCredits !== undefined && (
              <div className="grid grid-cols-2 gap-2 mb-5">
                <div className="rounded-xl p-3 text-center"
                  style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)' }}>
                  <p className="text-lg font-bold" style={{ color: '#FF6B35' }}>{result.requiredCredits}</p>
                  <p className="text-[10px] text-slate-500">{rs.creditsNeed}</p>
                </div>
                <div className="rounded-xl p-3 text-center"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p className="text-lg font-bold text-indigo-600">{result.currentCredits ?? 0}</p>
                  <p className="text-[10px] text-slate-500">{rs.creditsHave}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 border transition-all hover:text-slate-900"
                style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                {rs.errorClose}
              </button>
              <button
                onClick={() => { onClose(); setShowUpgrade(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-950 btn-gradient">
                <ArrowUpRight className="w-4 h-4" />
                {rs.creditsUpgrade}
              </button>
            </div>
          </div>
        )}

        {/* ========== NO BRAND PROFILE (server-side gate) ========== */}
        {phase === 'no_brand' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <Cpu className="w-7 h-7 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-950 mb-1">{rs.noBrandTitle}</h2>
            <p className="text-sm text-slate-500 mb-6">{rs.noBrandDesc}</p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 border transition-all hover:text-slate-900"
                style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                {rs.errorClose}
              </button>
              <Link href="/brand" onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-950 btn-gradient">
                <ArrowUpRight className="w-4 h-4" />
                {rs.noBrandBtn}
              </Link>
            </div>
          </div>
        )}

        {/* ========== GENERIC ERROR ========== */}
        {phase === 'error' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)' }}>
              <XCircle className="w-7 h-7 text-rose-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-950 mb-1">{rs.errorTitle}</h2>
            <p className="text-sm text-slate-500 mb-5">
              {result?.error || result?.errors?.[0] || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 border transition-all hover:text-slate-900"
                style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                {rs.errorClose}
              </button>
              <button onClick={retry}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-950 btn-gradient">
                <Sparkles className="w-4 h-4" />
                {rs.errorRetry}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>

    <UpgradeModal
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      reason="no_credits"
    />
  </>
  )
}
