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
 * States: running -> success | no_campaign | credits | no_brand | gate | error
 * Progress is simulated with timed steps while the API call runs (~15-25s).
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
// PR-S1b — deterministic Strategy Order Review (display-only; no generation change).
import { getStrategyDeliverables } from '@/lib/strategy/deliverablesContract'
// PR-S1c-2 — variable strategy pricing (display side). The SAME pure function runs
// server-side before deduction, so the displayed price equals the charged price.
import { getStrategyCreditCost } from '@/lib/strategy/strategyPricing'
import type { StrategyOrder, ContentIntensity } from '@/lib/strategy/strategyOrder'
import { INTENSITY_RANGE_LABEL, intensityLabel, tierToPostsPerMonth } from '@/lib/strategy/strategyOrderDisplay'
import {
  Cpu, BarChart3, Film, Megaphone, Shield, Zap,
  CheckCircle2, XCircle, ArrowUpRight, X, Rocket, Sparkles,
  Brain, Globe, AlertCircle, AlertTriangle, ImageIcon, Upload, RefreshCw,
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
  upgradeUrl?: string
  redirectUrl?: string
  requiredCredits?: number
  currentCredits?: number
}

type Phase = 'running' | 'success' | 'no_campaign' | 'error' | 'credits' | 'no_brand' | 'gate' | 'media_check' | 'lang_select' | 'cost_confirm'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

// -- Progress steps ----------------------------------------------------------

// Five honest steps that reflect what actually runs: a single strategist agent
// reading Brand Brain and producing the strategic brief. No fake multi-agent theater.
const STEP_DURATIONS = [1500, 3000, 4000, 3500, 3000]
const STEP_ICONS     = [Brain, Cpu, BarChart3, Megaphone, Shield]
const STEP_COLORS    = ['#4F46E5', '#6366F1', '#059669', '#EA580C', '#0284C7']
const STEP_KEYS      = ['step1', 'step2', 'step3', 'step4', 'step5'] as const

// -- Shared card style -------------------------------------------------------

const CARD_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 80px rgba(15,23,42,0.16)',
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
  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
  color: '#fff',
}

// -- i18n key -> field label helper ------------------------------------------

const FIELD_KEY_MAP: RequiredFieldKey[] = [
  'brandName', 'industry', 'description', 'targetAudience', 'topPlatforms',
]

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

export default function RunFullStrategyModal({ isOpen, onClose, onSuccess }: Props) {
  const { authHeader } = useAuth()
  const { t, dir, locale } = useI18n()
  // PR-S1b — current plan tier (for the deterministic Order Review's plan-cap). Display only.
  const { status: billingStatus } = useBillingStatus()

  // Close from success screen — clear cache so next open starts a fresh run
  const handleCloseFromSuccess = () => {
    clearResultCache()
    onClose()
  }

  // Start a new strategy run from the success screen.
  // Routes back through the cost-confirmation gate so a second run can never
  // silently spend more credits — the user must re-confirm the (variable) cost first.
  // The phase is set EXPLICITLY to 'cost_confirm' (not inferred from a cleared
  // result / reset flag). No generation starts and no credits are spent here;
  // the run only begins after the user re-confirms on the cost screen.
  const handleRunAgain = () => {
    clearResultCache()
    setResult(null)
    setCostConfirmed(false)   // require a fresh cost confirmation
    setCreditBalance(null)    // re-fetch balance on the cost screen
    setCurrentStep(0)
    setPhase('cost_confirm')  // explicit route back to the cost-confirmation gate
    setRunKey(k => k + 1)
  }

  const [phase, setPhase]             = useState<Phase>('running')
  const [currentStep, setCurrentStep] = useState(0)
  const [result, setResult]           = useState<RunResult | null>(null)
  const [gateData, setGateData]       = useState<BrandReadinessResult | null>(null)
  // runKey increments on retry to re-trigger the effect while modal stays open
  const [runKey, setRunKey]           = useState(0)
  const [showUpgrade, setShowUpgrade] = useState(false)
  // Media check state — actual items for selection grid
  interface MediaItem { id: string; url: string; type: string; fileName: string }
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
  // Ref to the "start API call" function — called from Continue button in media_check phase
  const startStrategyFnRef = useRef<(() => void) | null>(null)
  // Skip media check on retry (we already showed it once)
  const skipMediaCheckRef = useRef(false)
  // Tab hidden during generation — show sticky warning banner
  const [tabHiddenDuringRun, setTabHiddenDuringRun] = useState(false)
  // Inline media upload state (in media_check phase)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0)
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null)
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null)
  // Language selection — user picks before running strategy
  const [selectedLanguage, setSelectedLanguage] = useState<'ar' | 'en' | 'bilingual'>('ar')
  const [langConfirmed, setLangConfirmed] = useState(false)
  // PR-I — generation-time strategy intent (not persisted; defaults Organic / 90 days).
  const [strategyType, setStrategyType] = useState<'organic' | 'paid' | 'full'>('organic')
  const [strategyDuration, setStrategyDuration] = useState<'30' | '90' | '180' | 'custom'>('90')
  // PR-S1b — content intensity (review-only; NOT sent to the backend body — that is S1c).
  const [contentIntensity, setContentIntensity] = useState<ContentIntensity>('standard')
  // PR-S1b — custom horizon in days, only used when strategyDuration === 'custom'.
  const [customDurationDays, setCustomDurationDays] = useState<number>(45)
  // Cost confirmation — shown after language selection, before media check
  const [costConfirmed, setCostConfirmed] = useState(false)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [strategyBrandProfile, setStrategyBrandProfile] = useState<StrategyBriefProfileLike | null>(null)
  const [strategyBriefLoading, setStrategyBriefLoading] = useState(false)

  const authHeaderRef = useRef(authHeader)
  useEffect(() => { authHeaderRef.current = authHeader }, [authHeader])

  // Reset language + cost gates when modal closes — both pickers show again on next open
  useEffect(() => {
    if (!isOpen) {
      setLangConfirmed(false)
      setCostConfirmed(false)
      setCreditBalance(null)
      setStrategyBrandProfile(null)
      setStrategyBriefLoading(false)
      setTabHiddenDuringRun(false)
    }
  }, [isOpen])

  // ── beforeunload + visibility protection during generation ─────────────────
  useEffect(() => {
    if (phase !== 'running') {
      setTabHiddenDuringRun(false)
      return
    }

    const warningMsg =
      locale === 'ar'
        ? 'الاستراتيجية قيد التوليد. لو خرجت ستحتاج للبدء من جديد.'
        : 'Strategy generation is in progress. Leaving will require you to start over.'

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
    const cached = loadResultCache()
    if (cached?.campaignId) {
      setResult(cached)
      setPhase('success')
      return
    }

    // ── Language not yet confirmed — show picker first ────────────────────────
    if (!langConfirmed) {
      setPhase('lang_select')
      return
    }

    // ── Cost confirmation — show breakdown before spending credits ─────────────
    if (!costConfirmed) {
      setPhase('cost_confirm')
      // Fetch current credit balance for the breakdown card
      fetch('/api/user/credits', {
        headers: { Authorization: authHeaderRef.current() },
      })
        .then(r => r.ok ? r.json() : null)
        .then((data: { creditsRemaining?: number } | null) => {
          if (data?.creditsRemaining !== undefined) {
            setCreditBalance(data.creditsRemaining)
          }
        })
        .catch(() => {})
      setStrategyBriefLoading(true)
      fetch('/api/brand', {
        headers: { Authorization: authHeaderRef.current() },
      })
        .then(r => r.ok ? r.json() : null)
        .then((data: { brandProfile?: StrategyBriefProfileLike | null } | null) => {
          setStrategyBrandProfile(data?.brandProfile ?? null)
        })
        .catch(() => setStrategyBrandProfile(null))
        .finally(() => setStrategyBriefLoading(false))
      return
    }

    setPhase('running')
    setCurrentStep(0)
    setResult(null)
    setGateData(null)

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    // ── Define the actual strategy run (called from Continue button or retry) ─
    const startStrategyRun = () => {
      if (cancelled) return
      let apiDone = false
      setPhase('running')
      setCurrentStep(0)

      let cumulative = 0
      STEP_DURATIONS.forEach((duration, i) => {
        cumulative += duration
        timers.push(
          setTimeout(() => {
            if (!cancelled && !apiDone) setCurrentStep(i + 1)
          }, cumulative)
        )
      })

      fetch('/api/strategy/run-full', {
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
          mediaIds: selectedMediaIds,
          strategyType,
          strategyDuration,
          contentIntensity,
          customDurationDays,
        }),
      })
        .then(res => res.json().then((d: RunResult) => ({ ok: res.ok, data: d })))
        .then(({ ok, data: d }) => {
          apiDone = true
          timers.forEach(clearTimeout)

          // Always persist a successful result — even if the modal was closed mid-run.
          // This means: if the user navigates away while generation is running and the
          // API finishes in the background, the result is saved to sessionStorage.
          // Next time they open the modal, loadResultCache() finds it and shows success
          // immediately without re-running the strategy.
          const errorMsg = d.error || (Array.isArray(d.errors) && d.errors.length > 0 ? d.errors[0] : null)
          if (ok && !errorMsg && d.campaignId) {
            saveResultCache(d)
            saveStrategyHandoff(d.campaignId, {
              language: selectedLanguage,
              selectedMediaIds,
            })
          }

          if (cancelled) return

          if (!ok || errorMsg) {
            setResult({ ...d, error: errorMsg || d.error })
            if (errorMsg === 'INSUFFICIENT_CREDITS' || errorMsg === 'CREDITS_EXHAUSTED' || d.error === 'INSUFFICIENT_CREDITS') {
              setPhase('credits')
            } else if (d.error === 'NO_BRAND_PROFILE' || d.error === 'NO_WORKSPACE') {
              setPhase('no_brand')
            } else {
              setPhase('error')
            }
            return
          }

          setCurrentStep(5)
          timers.push(
            setTimeout(() => {
              if (!cancelled) {
                setResult(d)
                if (!d.campaignId) {
                  setPhase('no_campaign')
                } else {
                  setPhase('success')
                  onSuccess?.()
                }
              }
            }, 600)
          )
        })
        .catch(() => {
          if (!cancelled) {
            setPhase('error')
            setResult({ ok: false, error: 'Network error. Please check your connection.' })
          }
        })
    }

    // Store so the Continue button can call it
    startStrategyFnRef.current = startStrategyRun

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

        // Brand Brain ready — check if we should skip media check (e.g. on retry)
        if (skipMediaCheckRef.current) {
          skipMediaCheckRef.current = false
          startStrategyRun()
          return
        }

        // Fetch media items to show the selectable media grid
        fetch('/api/media?limit=50', {
          headers: { Authorization: authHeaderRef.current() },
        })
          .then(r => r.ok ? r.json() : { media: [] })
          .then((mediaData: { media?: Array<{id: string; url: string; type: string; fileName: string}> }) => {
            if (cancelled) return
            const items = mediaData.media ?? []
            setMediaItems(items)
            // Pre-select all items by default
            setSelectedMediaIds(items.map(m => m.id))
            setPhase('media_check')
          })
          .catch(() => {
            if (cancelled) return
            // Media check failed — just proceed directly
            startStrategyRun()
          })
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error')
          setResult({ ok: false, error: 'Could not verify brand profile. Please try again.' })
        }
      })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      startStrategyFnRef.current = null
    }
  }, [isOpen, runKey, langConfirmed, costConfirmed]) // runKey increments on retry; gates: lang_select → cost_confirm → running

  // ── Inline media upload (in media_check phase) ────────────────────────────
  const handleMediaUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setMediaUploadError(null)

    for (const file of Array.from(files)) {
      setMediaUploading(true)
      setMediaUploadProgress(0)
      try {
        // 1. Create session
        const sessionRes = await fetch('/api/uploads/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeaderRef.current() },
          body: JSON.stringify({
            resourceType: file.type.startsWith('video') ? 'video' : 'auto',
            fileName: file.name,
          }),
        })
        const { sessionToken } = await sessionRes.json()
        if (!sessionRes.ok || !sessionToken) throw new Error('Upload session failed')

        // 2. Get signature
        const sigRes = await fetch('/api/uploads/cloudinary/signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeaderRef.current() },
          body: JSON.stringify({ sessionToken }),
        })
        const sigData = await sigRes.json()
        if (!sigRes.ok) throw new Error('Signature failed')

        // 3. Upload to Cloudinary
        const cloudinaryData = await new Promise<Record<string, unknown>>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/auto/upload`)
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setMediaUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText)
              if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data)
              else reject(new Error(data.error?.message || 'Cloudinary error'))
            } catch { reject(new Error('Parse error')) }
          }
          xhr.onerror = () => reject(new Error('Network error'))
          const form = new FormData()
          form.append('file', file)
          form.append('api_key', String(sigData.api_key))
          form.append('timestamp', String(sigData.timestamp))
          form.append('signature', String(sigData.signature))
          form.append('folder', String(sigData.folder))
          form.append('resource_type', String(sigData.resource_type))
          xhr.send(form)
        })

        // 4. Notify backend
        const notifyRes = await fetch('/api/uploads/cloudinary/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeaderRef.current() },
          body: JSON.stringify({
            fileName: cloudinaryData.original_filename || cloudinaryData.public_id,
            mimeType: cloudinaryData.resource_type === 'video' ? `video/${cloudinaryData.format}` : `image/${cloudinaryData.format}`,
            secureUrl: cloudinaryData.secure_url,
            publicId: cloudinaryData.public_id,
            bytes: cloudinaryData.bytes,
            resourceType: cloudinaryData.resource_type,
            sessionToken,
          }),
        })
        const { media: newMedia } = await notifyRes.json()
        if (newMedia?.id) {
          setMediaItems(prev => [newMedia, ...prev])
          setSelectedMediaIds(prev => [newMedia.id, ...prev])
        }
      } catch (err: unknown) {
        setMediaUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setMediaUploading(false)
        setMediaUploadProgress(0)
      }
    }
    // reset input
    if (mediaFileInputRef.current) mediaFileInputRef.current.value = ''
  }

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
    }
    const ar: Record<StrategyBriefFieldKey, string> = {
      brandName: 'اسم العلامة',
      industry: 'المجال',
      description: 'وصف النشاط',
      primaryOffer: 'العرض الأساسي',
      targetAudience: 'الجمهور المستهدف',
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
    }
    return locale === 'ar' ? ar[key] : en[key]
  }

  const retry = () => {
    clearResultCache()
    setPhase('running')
    setCurrentStep(0)
    setResult(null)
    skipMediaCheckRef.current = true  // skip media check on retry — user already saw it
    setRunKey(k => k + 1)
  }

  return (
    <>
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.32)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'running') onClose() }}
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl text-slate-700" style={CARD_STYLE}>

        {/* ========== LANGUAGE PICKER PHASE ========== */}
        {phase === 'lang_select' && (
          <div className="p-6">
            <button onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>

            {/* Icon + title */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                <Globe className="w-7 h-7" style={{ color: '#4F46E5' }} />
              </div>
              <h2 className="text-xl font-bold text-slate-950 mb-1">{rs.langSelectTitle}</h2>
              <p className="text-xs text-slate-500">{rs.langSelectDesc}</p>
            </div>

            {/* Language options */}
            <div className="space-y-2 mb-5">
              {([
                { id: 'ar' as const, flag: '🇸🇦', label: rs.langOptAr, desc: rs.langOptArDesc },
                { id: 'en' as const, flag: '🇬🇧', label: rs.langOptEn, desc: rs.langOptEnDesc },
                { id: 'bilingual' as const, flag: '🌐', label: rs.langOptMix, desc: rs.langOptMixDesc },
              ]).map(opt => {
                const isSelected = selectedLanguage === opt.id
                return (
                  <button key={opt.id} onClick={() => setSelectedLanguage(opt.id)}
                    className="w-full text-start flex items-center gap-3 p-3 rounded-xl transition-all duration-200"
                    style={isSelected ? SELECTED_OPTION_STYLE : UNSELECTED_OPTION_STYLE}>
                    <span className="text-2xl leading-none flex-shrink-0">{opt.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{opt.label}</div>
                      <div className="text-xs text-slate-500 truncate">{opt.desc}</div>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ background: '#4F46E5' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* PR-I — Strategy Type + Duration (generation-time choice) */}
            <div className="mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-slate-500">
                {locale === 'ar' ? 'نوع الاستراتيجية' : 'Strategy type'}
              </div>
              <div className="flex gap-1.5">
                {([
                  ['organic', locale === 'ar' ? 'عضوي' : 'Organic'],
                  ['paid', locale === 'ar' ? 'مدفوع' : 'Paid'],
                  ['full', locale === 'ar' ? 'كاملة' : 'Full'],
                ] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setStrategyType(v)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      ...(strategyType === v ? SELECTED_OPTION_STYLE : UNSELECTED_OPTION_STYLE),
                    }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-slate-500">
                {locale === 'ar' ? 'المدة' : 'Duration'}
              </div>
              <div className="flex gap-1.5">
                {([
                  ['30', locale === 'ar' ? '30 يوم' : '30d'],
                  ['90', locale === 'ar' ? '90 يوم' : '90d'],
                  ['180', locale === 'ar' ? '6 أشهر' : '6mo'],
                  ['custom', locale === 'ar' ? 'مخصص' : 'Custom'],
                ] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setStrategyDuration(v)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      ...(strategyDuration === v ? SELECTED_OPTION_STYLE : UNSELECTED_OPTION_STYLE),
                    }}>{l}</button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                {locale === 'ar' ? 'موصى به: 90 يوماً مع أول 30 يوماً قابلة للتنفيذ.' : 'Recommended: 90 days, first 30 actionable.'}
              </p>
              {/* PR-S1b — custom horizon (days) input, shown only for Custom. Review-only. */}
              {strategyDuration === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number" min={1} max={365} value={customDurationDays}
                    onChange={e => setCustomDurationDays(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
                    className="w-24 px-2.5 py-1.5 rounded-lg text-xs text-slate-950 bg-white outline-none"
                    style={{ border: '1px solid #cbd5e1' }}
                    dir="ltr"
                  />
                  <span className="text-[11px] text-slate-500">
                    {locale === 'ar' ? 'يوم (حتى 180؛ أطول من ذلك يحتاج عرض سعر مخصص)' : 'days (up to 180; longer needs a custom quote)'}
                  </span>
                </div>
              )}
            </div>

            {/* PR-S1b — Content intensity picker (review-only; not sent to backend in S1b). */}
            <div className="mb-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-slate-500">
                {locale === 'ar' ? 'كثافة المحتوى' : 'Content intensity'}
              </div>
              <div className="flex gap-1.5">
                {(['light', 'standard', 'growth', 'daily'] as const).map(v => (
                  <button key={v} onClick={() => setContentIntensity(v)}
                    className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all leading-tight"
                    style={{
                      ...(contentIntensity === v ? SELECTED_OPTION_STYLE : UNSELECTED_OPTION_STYLE),
                    }}>
                    {intensityLabel(v, locale)}
                    <span className="block text-[9px] font-normal opacity-70">{INTENSITY_RANGE_LABEL[v]}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                {locale === 'ar' ? 'منشورات عضوية شهرياً (قد تُقيَّد حسب خطتك).' : 'Organic posts / month (may be capped by your plan).'}
              </p>
            </div>

            {/* Start button */}
            <button
              onClick={() => setLangConfirmed(true)}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={primaryButtonStyle}>
              <Rocket className="w-4 h-4" />
              {rs.langStartBtn}
            </button>
          </div>
        )}

        {/* ========== COST CONFIRMATION PHASE ========== */}
        {phase === 'cost_confirm' && (() => {
          // ── PR-S1b — deterministic Order Review (display-only). Counts come from the
          //    pure contract, never the AI. Plan quota (if known) caps organic posts.
          const ar = locale === 'ar'
          const orderLanguage: StrategyOrder['language'] = ar ? 'ar' : 'en'
          const horizonDays =
            strategyDuration === 'custom' ? customDurationDays : Number(strategyDuration)
          const order: StrategyOrder = {
            strategyType,
            durationPreset: strategyDuration,
            durationDays: horizonDays,
            contentIntensity,
            goal: '',
            language: orderLanguage,
          }

          // ── PR-S1c-2 — variable cost. getStrategyCreditCost is the SAME pure
          //    function the backend runs before deduction, so the displayed price
          //    equals the charged price. Unsupported orders (custom > 180) yield
          //    cost:null → COST falls back to 0 and the unsupported UI branch below
          //    blocks Generate before any charge.
          const pricing = getStrategyCreditCost(order)
          const COST = pricing.cost ?? 0
          const isUnlimited = creditBalance === -1
          const balanceAfter = isUnlimited ? -1 : creditBalance !== null ? Math.max(0, creditBalance - COST) : null
          const canAfford = isUnlimited || (creditBalance !== null && creditBalance >= COST)
          const creditsNeeded = !isUnlimited && creditBalance !== null ? Math.max(0, COST - creditBalance) : 0

          const postsPerMonth = tierToPostsPerMonth(billingStatus?.plan)
          const deliverables = getStrategyDeliverables(
            order,
            typeof postsPerMonth === 'number' ? { postsPerMonth } : undefined,
          )
          const includesPaid = strategyType === 'paid' || strategyType === 'full'
          const includesOrganic = strategyType === 'organic' || strategyType === 'full'
          const typeLabel = ar
            ? { organic: 'عضوية', paid: 'مدفوعة', full: 'كاملة' }[strategyType]
            : { organic: 'Organic', paid: 'Paid', full: 'Full' }[strategyType]
          const generationTitle = ar
            ? {
                organic: 'توليد استراتيجية عضوية',
                paid: 'توليد بريف تخطيط مدفوع',
                full: 'توليد استراتيجية كاملة',
              }[strategyType]
            : {
                organic: 'Generate organic strategy',
                paid: 'Generate paid planning brief',
                full: 'Generate full strategy',
              }[strategyType]
          const strategyReadiness = getStrategyBriefReadiness({
            mode: strategyType,
            brandProfile: strategyBrandProfile,
          })
          // S1b can only proceed to generation for supported orders.
          const canGenerate = canAfford && deliverables.supported && strategyReadiness.canGenerate && !strategyBriefLoading
          const readinessStatus = strategyReadiness.canGenerate
            ? (ar ? 'جاهز للتوليد' : 'Ready to generate')
            : (ar ? 'يحتاج بيانات قبل التوليد' : 'Needs brief inputs before generation')
          const readinessTone = strategyReadiness.canGenerate ? '#059669' : '#EA580C'

          return (
            <div className="p-6">
              <button onClick={onClose}
                className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/5 transition-all">
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="text-center mb-5">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                  style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                  <Zap className="w-7 h-7" style={{ color: '#4F46E5' }} />
                </div>
                <h2 className="text-xl font-bold text-slate-950 mb-1">
                  {locale === 'ar' ? 'مراجعة تكلفة توليد الاستراتيجية' : 'Review strategy generation cost'}
                </h2>
                <p className="text-xs text-slate-500">
                  {locale === 'ar' ? 'راجع التكلفة والنطاق قبل التوليد' : 'Review the cost and scope before generation'}
                </p>
              </div>

              {/* Credit breakdown card */}
              <div className="rounded-2xl p-4 mb-4"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                {/* Action cost row */}
                <div className="flex items-center justify-between mb-3 pb-3"
                  style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(139,92,246,0.12)' }}>
                      <Rocket className="w-3.5 h-3.5" style={{ color: '#8B5CF6' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {generationTitle}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {locale === 'ar' ? 'استراتيجي تسويق ذكي من Brand Brain' : 'AI strategist, built from your Brand Brain'}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-lg font-bold" style={{ color: '#FF6B35' }}>
                      {COST} {locale === 'ar' ? 'كريديت' : 'credits'}
                    </p>
                  </div>
                </div>

                {/* Balance rows */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 text-xs">
                      {locale === 'ar' ? 'رصيدك الحالي' : 'Current balance'}
                    </span>
                    <span className="font-semibold text-sky-700">
                      {creditBalance === null
                        ? '...'
                        : isUnlimited
                        ? (locale === 'ar' ? 'غير محدود ∞' : 'Unlimited ∞')
                        : `${creditBalance} ${locale === 'ar' ? 'كريديت' : 'credits'}`}
                    </span>
                  </div>
                  {canAfford && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 text-xs">
                      {locale === 'ar' ? 'الرصيد المتوقع المتبقي' : 'Projected remaining credits'}
                    </span>
                    <span className="font-semibold" style={{
                      color: balanceAfter !== null && !isUnlimited && balanceAfter <= 2 ? '#EA580C' : '#059669',
                    }}>
                      {balanceAfter === null
                        ? '...'
                        : isUnlimited
                        ? (locale === 'ar' ? 'غير محدود ∞' : 'Unlimited ∞')
                        : `${balanceAfter} ${locale === 'ar' ? 'كريديت' : 'credits'}`}
                    </span>
                  </div>
                  )}
                </div>
              </div>

              {/* ── PR-S1b — Strategy Order Review (deterministic; counts from the contract) ── */}
              <p className="text-[11px] leading-relaxed mb-2.5 text-slate-500">
                {ar
                  ? 'ذاكرة العلامة التجارية تحفظ تفضيلاتك الافتراضية. يمكنك مراجعة وتعديل هذا الطلب قبل توليد الاستراتيجية.'
                  : 'Your Brand Brain gives NEXUS default preferences. You can review and adjust this order before generating.'}
              </p>

              {!deliverables.supported ? (
                /* Unsupported (custom > 180 days) — block generation before any charge. */
                <div className="rounded-xl p-3 mb-4 flex items-start gap-2"
                  style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FF6B35' }} />
                  <p className="text-[11px] leading-relaxed text-orange-700">
                    {ar
                      ? `الخطط الأطول من 180 يوماً غير مدعومة بعد. تواصل مع الدعم للحصول على عرض سعر مخصّص — لن يتم خصم أي كريديت.`
                      : `Strategies longer than 180 days aren’t supported yet. Contact support for a custom quote — no credits will be charged.`}
                  </p>
                </div>
              ) : (
                <>
                  {/* Order chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[
                      typeLabel,
                      ar ? `أفق ${deliverables.planningHorizonDays} يوم` : `${deliverables.planningHorizonDays}-day horizon`,
                      ar ? `${deliverables.roadmapMonths} شهر خريطة طريق` : `${deliverables.roadmapMonths}-mo roadmap`,
                      ar ? `تقويم تفصيلي ${deliverables.detailedCalendarDays} يوم` : `${deliverables.detailedCalendarDays}-day detailed`,
                      includesOrganic ? `${intensityLabel(contentIntensity, locale)} · ${INTENSITY_RANGE_LABEL[contentIntensity]}` : null,
                    ].filter(Boolean).map((chip, i) => (
                      <span key={i} className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>
                        {chip}
                      </span>
                    ))}
                  </div>

                  {/* STRATEGY-OS-1 — mode-aware Strategy Brief readiness */}
                  <div className="rounded-xl p-3 mb-3"
                    style={{
                      background: strategyReadiness.canGenerate ? '#f0fdf4' : '#fff7ed',
                      border: `1px solid ${strategyReadiness.canGenerate ? '#bbf7d0' : '#fed7aa'}`,
                    }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: readinessTone }}>
                          {ar ? 'جاهزية بريف الاستراتيجية' : 'Strategy brief readiness'}
                        </p>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5">{readinessStatus}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: '#fff', color: readinessTone, border: `1px solid ${strategyReadiness.canGenerate ? '#bbf7d0' : '#fed7aa'}` }}>
                        {typeLabel}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 mb-2">
                      {ar ? strategyReadiness.safeScopeAr : strategyReadiness.safeScope}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      <div className="rounded-lg px-2 py-1.5 text-[10px]"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', color: strategyReadiness.canGenerateOrganic ? '#047857' : '#9a3412' }}>
                        {strategyReadiness.canGenerateOrganic
                          ? (ar ? 'العضوي جاهز' : 'Organic ready')
                          : (ar ? 'العضوي يحتاج بيانات' : 'Organic needs inputs')}
                      </div>
                      <div className="rounded-lg px-2 py-1.5 text-[10px]"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', color: strategyReadiness.canGeneratePaidPlan ? '#047857' : '#9a3412' }}>
                        {strategyReadiness.canGeneratePaidPlan
                          ? (ar ? 'المدفوع تخطيط فقط' : 'Paid planning only')
                          : (ar ? 'المدفوع يحتاج بيانات' : 'Paid needs inputs')}
                      </div>
                    </div>
                    {strategyBriefLoading && (
                      <p className="text-[10px] text-slate-500">
                        {ar ? 'جارٍ فحص Brand Brain...' : 'Checking Brand Brain...'}
                      </p>
                    )}
                    {strategyReadiness.missingRequiredFields.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-orange-700 mb-1">
                          {ar ? 'أكمل هذه البيانات أولاً:' : 'Complete these inputs first:'}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {strategyReadiness.missingRequiredFields.map((field) => (
                            <span key={field} className="px-2 py-0.5 rounded-lg text-[10px]"
                              style={{ background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa' }}>
                              {strategyBriefFieldLabel(field)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {strategyReadiness.warnings.includes('verified_proof_missing') && (
                      <p className="text-[10px] leading-relaxed text-slate-500">
                        {ar
                          ? 'الإثبات الموثّق غير مكتمل. يجب أن تتجنب الاستراتيجية أي ادعاءات مبنية على شهادات أو قصص عملاء غير مقدمة.'
                          : 'Verified proof is missing. The strategy must avoid testimonial, customer-story, award, review, or proof-based claims unless you provide them.'}
                      </p>
                    )}
                  </div>

                  {/* Multi-month roadmap explanation */}
                  {deliverables.planningHorizonDays > 30 && (
                    <p className="text-[11px] leading-relaxed mb-3 text-slate-500">
                      {ar
                        ? 'خطط 90 و180 يوم تشمل خريطة طريق كاملة، وتقويم محتوى تفصيلي لأول 30 يوم فقط. يتم توليد تقاويم الشهور التالية لاحقًا بناءً على الأداء والتعلم.'
                        : '90/180-day strategies include a full roadmap and a detailed first 30-day content calendar. Future monthly calendars are generated later as NEXUS learns from performance.'}
                    </p>
                  )}

                  {/* Included */}
                  <div className="rounded-xl p-3 mb-2"
                    style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#10B981' }}>
                      {ar ? 'ما الذي ستحصل عليه' : "What you'll get"}
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {includesOrganic && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                          {ar
                            ? `منشورات عضوية لأول 30 يوم: ${deliverables.organicPostCount} (${INTENSITY_RANGE_LABEL[contentIntensity]})`
                            : `Organic posts for the first 30 days: ${deliverables.organicPostCount} (${INTENSITY_RANGE_LABEL[contentIntensity]})`}
                        </div>
                      )}
                      {includesPaid && (
                        <>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                            {ar ? `نسخ إعلانية: ${deliverables.paidAdVariationCount}` : `Ad copy variations: ${deliverables.paidAdVariationCount}`}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                            {ar ? `بريفات إبداعية: ${deliverables.creativeBriefCount}` : `Creative briefs: ${deliverables.creativeBriefCount}`}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                            {ar ? `فرضيات جمهور: ${deliverables.audienceHypothesisCount}` : `Audience hypotheses: ${deliverables.audienceHypothesisCount}`}
                          </div>
                        </>
                      )}
                      {deliverables.includedDeliverables.slice(0, 6).map(item => (
                        <div key={item} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Excluded */}
                  {deliverables.excludedDeliverables.length > 0 && (
                    <div className="rounded-xl p-3 mb-2"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-500">
                        {ar ? 'غير مشمول' : 'Not included'}
                      </p>
                      <div className="grid grid-cols-1 gap-1">
                        {deliverables.excludedDeliverables.slice(0, 6).map(item => (
                          <div key={item} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <XCircle className="w-3 h-3 flex-shrink-0 text-slate-400" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Platform-variants note */}
                  {includesOrganic && (
                    <p className="text-[10px] leading-relaxed mb-2 text-slate-500">
                      {ar
                        ? 'نسخ المنصات هي تكييفات لكل قناة، وليست منشورات إضافية منفصلة.'
                        : 'Platform variants are adaptations for each channel, not separate extra posts.'}
                    </p>
                  )}

                  {/* Plan-cap callout */}
                  {deliverables.planCapApplied && (
                    <div className="rounded-xl px-3 py-2.5 mb-2 flex items-start gap-2"
                      style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.28)' }}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#FFB800' }} />
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        {ar
                          ? `اخترت نطاق ${intensityLabel(contentIntensity, locale)} (${INTENSITY_RANGE_LABEL[contentIntensity]} شهرياً) كهدف تخطيطي، لكن خطتك الحالية تحد أول 30 يوم إلى ${deliverables.planCappedOrganicPostCount} منشورات. لذلك سيتم توليد ${deliverables.organicPostCount} منشورات الآن.`
                          : `You selected ${intensityLabel(contentIntensity, locale)} (${INTENSITY_RANGE_LABEL[contentIntensity]}/mo) as the planning range, but your current plan caps the generated first 30 days at ${deliverables.planCappedOrganicPostCount} posts. ${deliverables.organicPostCount} posts will be generated now.`}
                      </p>
                    </div>
                  )}

                  {/* Paid planning-only callout */}
                  {includesPaid && (
                    <div className="rounded-xl px-3 py-2.5 mb-4 flex items-start gap-2"
                      style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                      <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#FF6B35' }} />
                      <p className="text-[11px] leading-relaxed text-orange-700">
                        {ar
                          ? 'الاستراتيجية المدفوعة للتخطيط فقط. لن يطلق NEXUS إعلانات أو يصرف ميزانية أو ينشر بدون موافقة صريحة وجاهزية تتبع ومنصة.'
                          : 'Paid strategy is planning-only. NEXUS will not launch ads, spend budget, or publish without explicit approval plus tracking and platform readiness.'}
                      </p>
                    </div>
                  )}
                  {strategyType === 'full' && deliverables.excludedDeliverables.length > 0 && (
                    <div className="rounded-xl px-3 py-2.5 mb-4 flex items-start gap-2"
                      style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-orange-600" />
                      <p className="text-[11px] leading-relaxed text-orange-800">
                        {ar
                          ? 'اخترت استراتيجية كاملة، لكن أجزاء المدفوع تحتاج ميزانية ووجهة تحويل وتعامل مع العملاء وجاهزية تتبع ومنصة. لا يتم إطلاق إعلانات أو صرف ميزانية أو نشر محتوى.'
                          : 'You selected a full strategy, but paid sections need budget, conversion destination, lead handling, tracking, and platform readiness. No ads launch, budget spend, or publishing happens here.'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* PR-2A — honest scope note: budget/KPI/paid planning depend on Brand Brain data */}
              <div className="rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Brain className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#4F46E5' }} />
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {locale === 'ar'
                    ? 'ميزانية، KPIs، وتخطيط الإعلانات المدفوعة تُفتح عند إضافة بياناتها في Brand Brain. بدونها تبقى منخفضة الثقة.'
                    : 'Budget, KPI, and paid-ads planning unlock as you add that data in Brand Brain — without it they stay low-confidence.'}
                </p>
              </div>

              {/* Not enough credits warning */}
              {!canAfford && creditBalance !== null && (
                <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
                  style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FF6B35' }} />
                  <p className="text-[11px] text-orange-800">
                    {locale === 'ar'
                      ? `تحتاج ${creditsNeeded} كريديت إضافية لتشغيل هذه الاستراتيجية.`
                      : `You need ${creditsNeeded} more credits to run this strategy.`}
                  </p>
                </div>
              )}

              {/* Actions */}
              {!deliverables.supported ? (
                /* PR-S1b — custom > 180 days: block generation before any charge. */
                <button disabled
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-2 cursor-not-allowed"
                  style={{ background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                  {ar ? 'غير متاح — يتطلب عرض سعر مخصص' : 'Unavailable — needs a custom quote'}
                </button>
              ) : canGenerate ? (
                <button
                  onClick={() => setCostConfirmed(true)}
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-2 transition-all hover:brightness-110"
                  style={primaryButtonStyle}>
                  <Rocket className="w-4 h-4" />
                  {ar
                    ? `${generationTitle} — ${COST} كريديت`
                    : `${generationTitle} — ${COST} credits`}
                </button>
              ) : !strategyReadiness.canGenerate || strategyBriefLoading ? (
                <button disabled
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-2 cursor-not-allowed"
                  style={{ background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                  <AlertTriangle className="w-4 h-4" />
                  {strategyBriefLoading
                    ? (ar ? 'جارٍ فحص جاهزية البريف' : 'Checking brief readiness')
                    : strategyType === 'paid'
                      ? (ar ? 'راجع مدخلات المدفوع الناقصة' : 'Review missing paid inputs')
                      : strategyType === 'full'
                        ? (ar ? 'أكمل مدخلات الاستراتيجية الكاملة' : 'Complete full-strategy inputs')
                        : (ar ? 'أكمل بريف الاستراتيجية' : 'Complete strategy brief')}
                </button>
              ) : (
                <button
                  onClick={() => { onClose(); setShowUpgrade(true) }}
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-2 transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)', color: '#fff' }}>
                  <ArrowUpRight className="w-4 h-4" />
                  {locale === 'ar' ? 'ترقية الخطة' : 'Upgrade Plan'}
                </button>
              )}

              <button onClick={onClose}
                className="w-full py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 transition-all"
                style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
                {rs.errorClose}
              </button>
            </div>
          )
        })()}

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
                const isDone   = i < currentStep
                const isActive = i === currentStep
                return (
                  <div key={key}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300"
                    style={{
                      background: isActive ? `${color}12` : isDone ? 'rgba(16,185,129,0.05)' : 'transparent',
                      border: `1px solid ${isActive ? `${color}35` : isDone ? 'rgba(16,185,129,0.18)' : '#e2e8f0'}`,
                    }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDone   ? 'rgba(16,185,129,0.15)'
                                  : isActive ? `${color}18`
                                  : '#f8fafc',
                      }}>
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : isActive ? (
                        <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                          style={{ borderColor: `${color}40`, borderTopColor: color }} />
                      ) : (
                        <Icon className="w-3.5 h-3.5" style={{ color, opacity: i > currentStep ? 0.2 : 1 }} />
                      )}
                    </div>
                    <span className="text-sm font-medium transition-colors"
                      style={{ color: isDone ? '#059669' : isActive ? '#1e293b' : '#94a3b8' }}>
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
                    ? 'التوليد لا يزال يعمل — لا تغلق هذا التاب حتى ينتهي'
                    : 'Generation is still running — don\'t close this tab'}
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

        {/* ========== MEDIA CHECK PHASE ========== */}
        {phase === 'media_check' && (
          <div className="p-6">
            <button onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>

            {/* Header row: icon+title on left, upload button on right */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: mediaItems.length > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.1)',
                  border: `1px solid ${mediaItems.length > 0 ? '#bbf7d0' : '#c7d2fe'}`,
                }}>
                <ImageIcon className="w-5 h-5" style={{ color: mediaItems.length > 0 ? '#059669' : '#4F46E5' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-950 leading-tight">
                  {mediaItems.length > 0 ? rs.mediaCheckTitle : rs.mediaCheckTitleNoMedia}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mediaItems.length > 0
                    ? (locale === 'ar' ? 'اختر الأصول التي تريد استخدامها' : 'Choose which assets to use')
                    : rs.mediaCheckDescNone}
                </p>
              </div>
              {/* Inline upload button */}
              <label className="flex-shrink-0 cursor-pointer">
                <input
                  ref={mediaFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={e => handleMediaUploadFiles(e.target.files)}
                  disabled={mediaUploading}
                />
                <span
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: mediaUploading ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.1)',
                    border: '1px solid #c7d2fe',
                    color: mediaUploading ? '#94a3b8' : '#4338ca',
                    cursor: mediaUploading ? 'not-allowed' : 'pointer',
                  }}>
                  <Upload className="w-3 h-3" />
                  {mediaUploading
                    ? `${mediaUploadProgress}%`
                    : (locale === 'ar' ? 'رفع' : 'Upload')}
                </span>
              </label>
            </div>

            {/* Upload error */}
            {mediaUploadError && (
              <div className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2 text-xs"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span className="flex-1 truncate">{mediaUploadError}</span>
                <button onClick={() => setMediaUploadError(null)} className="flex-shrink-0 hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Upload progress bar */}
            {mediaUploading && (
              <div className="w-full h-1 rounded-full mb-3" style={{ background: '#e0e7ff' }}>
                <div className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${mediaUploadProgress}%`, background: 'linear-gradient(90deg, #8B5CF6, #10B981)' }} />
              </div>
            )}

            {/* Selectable thumbnail grid */}
            {mediaItems.length > 0 ? (
              <>
                {/* Select All / Deselect All row */}
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs text-slate-500">
                    {selectedMediaIds.length > 0
                      ? (locale === 'ar' ? `${selectedMediaIds.length} مختار` : `${selectedMediaIds.length} selected`)
                      : (locale === 'ar' ? 'لا يوجد مختار' : 'None selected')}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedMediaIds(mediaItems.map(m => m.id))}
                      className="text-[10px] font-medium px-2 py-1 rounded-lg transition-all"
                      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
                      {locale === 'ar' ? 'تحديد الكل' : 'Select all'}
                    </button>
                    <button
                      onClick={() => setSelectedMediaIds([])}
                      className="text-[10px] font-medium px-2 py-1 rounded-lg transition-all"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                      {locale === 'ar' ? 'إلغاء الكل' : 'Deselect all'}
                    </button>
                  </div>
                </div>

                {/* Thumbnail grid — fixed height, scrolls for 50+ items */}
                <div className="grid grid-cols-5 gap-1.5 mb-4 overflow-y-auto pr-0.5" style={{ maxHeight: '180px' }}>
                  {mediaItems.map(item => {
                    const isSelected = selectedMediaIds.includes(item.id)
                    const isVideo = item.type === 'VIDEO'
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedMediaIds(prev =>
                          isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id]
                        )}
                        className="relative aspect-square rounded-lg overflow-hidden transition-all duration-150 focus:outline-none"
                        style={{
                         border: isSelected
                            ? '2px solid #10B981'
                            : '2px solid #e2e8f0',
                        }}
                        title={item.fileName}
                      >
                        {/* Thumbnail */}
                        {isVideo ? (
                          <div className="w-full h-full flex items-center justify-center"
                            style={{ background: 'rgba(139,92,246,0.12)' }}>
                            <Film className="w-5 h-5 text-indigo-600" />
                          </div>
                        ) : (
                          <img
                            src={item.url}
                            alt={item.fileName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}

                        {/* Selection overlay */}
                        <div className="absolute inset-0 transition-opacity duration-150"
                          style={{
                            background: isSelected
                              ? 'rgba(16,185,129,0.18)'
                              : 'rgba(255,255,255,0.0)',
                          }} />

                        {/* Checkmark */}
                        {isSelected && (
                          <div className="absolute top-1 end-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: '#10B981' }}>
                            <svg className="w-2.5 h-2.5 text-slate-950" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}

                        {/* Video badge */}
                        {isVideo && (
                          <div className="absolute bottom-1 start-1 px-1 rounded text-[8px] font-bold"
                            style={{ background: 'rgba(67,56,202,0.95)', color: '#fff' }}>
                            VID
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-xl p-3 mb-4 flex items-start gap-2.5"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FFB800' }} />
                <p className="text-xs text-slate-500 leading-relaxed">
                  {locale === 'ar'
                    ? 'الصور والفيديوهات تساعد الاستراتيجية على اقتراح محتوى مرئي أكثر دقة. يمكنك رفعها الآن أو المتابعة بدونها.'
                    : 'Visual assets help the strategy suggest more precise content formats. You can upload now or continue without them.'}
                </p>
              </div>
            )}

            {/* Actions */}
            <button
              onClick={() => { startStrategyFnRef.current?.() }}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-950 btn-gradient mb-2 transition-all hover:brightness-110">
              <Rocket className="w-4 h-4" />
              {selectedMediaIds.length > 0
                ? (locale === 'ar' ? `ابدأ بـ ${selectedMediaIds.length} أصل` : `Run with ${selectedMediaIds.length} asset${selectedMediaIds.length !== 1 ? 's' : ''}`)
                : (locale === 'ar' ? 'تابع بدون صور' : 'Continue without assets')}
            </button>

            {mediaItems.length === 0 && !mediaUploading && (
              <p className="text-center text-[11px] text-slate-500 mb-1">
                {locale === 'ar' ? '← اضغط "رفع" أعلاه لإضافة صور أو فيديوهات' : '← Click "Upload" above to add photos or videos'}
              </p>
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

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { value: '1',                            label: rs.statCampaign,     color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.18)' },
                { value: String(result.suggestions ?? 0),label: rs.statSuggestions,  color: '#10B981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.18)' },
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
            <h2 className="text-xl font-bold text-slate-950 mb-1">{rs.noResultTitle}</h2>
            <p className="text-sm text-slate-500 mb-6">{rs.noResultDesc}</p>
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
