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
  Cpu, BarChart3, Film, Megaphone, Shield, Zap,
  CheckCircle2, XCircle, ArrowUpRight, X, Rocket, Sparkles,
  Brain, Globe, AlertCircle, AlertTriangle, ImageIcon, Upload,
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

type Phase = 'running' | 'success' | 'no_campaign' | 'error' | 'credits' | 'no_brand' | 'gate' | 'media_check' | 'lang_select'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

// -- Progress steps ----------------------------------------------------------

const STEP_DURATIONS = [1500, 3000, 4000, 3500, 3000]
const STEP_ICONS     = [Cpu, BarChart3, Film, Megaphone, Shield, Zap]
const STEP_COLORS    = ['#8B5CF6', '#8B5CF6', '#10B981', '#FF6B35', '#FFD700', '#00D4FF']
const STEP_KEYS      = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const

// -- Shared card style -------------------------------------------------------

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(6,7,26,0.97)',
  border: '1px solid rgba(139,92,246,0.25)',
  boxShadow: '0 24px 80px rgba(139,92,246,0.2)',
}

// -- i18n key -> field label helper ------------------------------------------

const FIELD_KEY_MAP: RequiredFieldKey[] = [
  'brandName', 'industry', 'description', 'targetAudience', 'topPlatforms',
]

// -- Cache helpers -----------------------------------------------------------

const CACHE_KEY = 'nexus_run_strategy_result'
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

// -- Component ---------------------------------------------------------------

export default function RunFullStrategyModal({ isOpen, onClose, onSuccess }: Props) {
  const { authHeader } = useAuth()
  const { t, dir, locale } = useI18n()

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

  const authHeaderRef = useRef(authHeader)
  useEffect(() => { authHeaderRef.current = authHeader }, [authHeader])

  // Reset language gate when modal closes — picker shows again on next open
  useEffect(() => {
    if (!isOpen) {
      setLangConfirmed(false)
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
        body: JSON.stringify({ language: selectedLanguage, mediaIds: selectedMediaIds }),
      })
        .then(res => res.json().then((d: RunResult) => ({ ok: res.ok, data: d })))
        .then(({ ok, data: d }) => {
          if (cancelled) return
          apiDone = true
          timers.forEach(clearTimeout)

          // Check both d.error (string) and d.errors (array) — route returns errors array
          const errorMsg = d.error || (Array.isArray(d.errors) && d.errors.length > 0 ? d.errors[0] : null)

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
                  // Cache the result so reopening the modal shows success
                  // immediately instead of re-running the strategy API
                  saveResultCache(d)
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

        if (!readiness.ready) {
          setGateData(readiness)
          setPhase('gate')
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
  }, [isOpen, runKey, langConfirmed]) // runKey increments on retry; langConfirmed gates lang_select → running

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
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'running') onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden relative" style={CARD_STYLE}>

        {/* ========== LANGUAGE PICKER PHASE ========== */}
        {phase === 'lang_select' && (
          <div className="p-6">
            <button onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>

            {/* Icon + title */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                <Globe className="w-7 h-7" style={{ color: '#8B5CF6' }} />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{rs.langSelectTitle}</h2>
              <p className="text-xs text-text-muted">{rs.langSelectDesc}</p>
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
                    style={{
                      background: isSelected ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? 'rgba(139,92,246,0.45)' : 'rgba(139,92,246,0.1)'}`,
                    }}>
                    <span className="text-2xl leading-none flex-shrink-0">{opt.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{opt.label}</div>
                      <div className="text-xs text-text-muted truncate">{opt.desc}</div>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ background: '#8B5CF6' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Start button */}
            <button
              onClick={() => setLangConfirmed(true)}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' }}>
              <Rocket className="w-4 h-4" />
              {rs.langStartBtn}
            </button>
          </div>
        )}

        {/* ========== RUNNING PHASE ========== */}
        {phase === 'running' && (
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">{rs.modalTitle}</h2>
                <p className="text-xs text-text-muted mt-0.5">{rs.modalSubtitle}</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#8B5CF6' }} />
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
                      border: `1px solid ${isActive ? `${color}35` : isDone ? 'rgba(16,185,129,0.18)' : 'rgba(139,92,246,0.08)'}`,
                    }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDone   ? 'rgba(16,185,129,0.15)'
                                  : isActive ? `${color}18`
                                  : 'rgba(139,92,246,0.06)',
                      }}>
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent-teal" />
                      ) : isActive ? (
                        <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                          style={{ borderColor: `${color}40`, borderTopColor: color }} />
                      ) : (
                        <Icon className="w-3.5 h-3.5" style={{ color, opacity: i > currentStep ? 0.2 : 1 }} />
                      )}
                    </div>
                    <span className="text-sm font-medium transition-colors"
                      style={{ color: isDone ? '#10B981' : isActive ? 'white' : 'rgba(255,255,255,0.22)' }}>
                      {rs[key]}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-[10px] text-text-muted mt-4 text-center">{rs.infoUsing}</p>

            {/* Tab-hidden warning — appears if user switched away during generation */}
            {tabHiddenDuringRun && (
              <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2.5 animate-pulse"
                style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.25)' }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FFB800' }} />
                <p className="text-[11px] leading-snug" style={{ color: '#FFD47A' }}>
                  {locale === 'ar'
                    ? 'التوليد لا يزال يعمل — لا تغلق هذا التاب حتى ينتهي'
                    : 'Generation is still running — don\'t close this tab'}
                </p>
                <button
                  onClick={() => setTabHiddenDuringRun(false)}
                  className="ms-auto flex-shrink-0 text-text-muted hover:text-white transition-colors">
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
              className="absolute top-4 end-4 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>

            {/* Header row: icon+title on left, upload button on right */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: mediaItems.length > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.1)',
                  border: `1px solid ${mediaItems.length > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.2)'}`,
                }}>
                <ImageIcon className="w-5 h-5" style={{ color: mediaItems.length > 0 ? '#10B981' : '#8B5CF6' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white leading-tight">
                  {mediaItems.length > 0 ? rs.mediaCheckTitle : rs.mediaCheckTitleNoMedia}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
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
                    border: '1px solid rgba(139,92,246,0.25)',
                    color: mediaUploading ? '#6b6b80' : '#a5a0ff',
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
                <button onClick={() => setMediaUploadError(null)} className="flex-shrink-0 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Upload progress bar */}
            {mediaUploading && (
              <div className="w-full h-1 rounded-full mb-3" style={{ background: 'rgba(139,92,246,0.15)' }}>
                <div className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${mediaUploadProgress}%`, background: 'linear-gradient(90deg, #8B5CF6, #10B981)' }} />
              </div>
            )}

            {/* Selectable thumbnail grid */}
            {mediaItems.length > 0 ? (
              <>
                {/* Select All / Deselect All row */}
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs text-text-muted">
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
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.15)', color: '#a5a0ff' }}>
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
                            : '2px solid rgba(255,255,255,0.06)',
                        }}
                        title={item.fileName}
                      >
                        {/* Thumbnail */}
                        {isVideo ? (
                          <div className="w-full h-full flex items-center justify-center"
                            style={{ background: 'rgba(139,92,246,0.12)' }}>
                            <Film className="w-5 h-5 text-accent-purple" />
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
                              : 'rgba(0,0,0,0.0)',
                          }} />

                        {/* Checkmark */}
                        {isSelected && (
                          <div className="absolute top-1 end-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: '#10B981' }}>
                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}

                        {/* Video badge */}
                        {isVideo && (
                          <div className="absolute bottom-1 start-1 px-1 rounded text-[8px] font-bold"
                            style={{ background: 'rgba(139,92,246,0.9)', color: 'white' }}>
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
                style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FFB800' }} />
                <p className="text-xs text-text-muted leading-relaxed">
                  {locale === 'ar'
                    ? 'الصور والفيديوهات تساعد الاستراتيجية على اقتراح محتوى مرئي أكثر دقة. يمكنك رفعها الآن أو المتابعة بدونها.'
                    : 'Visual assets help the strategy suggest more precise content formats. You can upload now or continue without them.'}
                </p>
              </div>
            )}

            {/* Actions */}
            <button
              onClick={() => { startStrategyFnRef.current?.() }}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-white btn-gradient mb-2 transition-all hover:brightness-110">
              <Rocket className="w-4 h-4" />
              {selectedMediaIds.length > 0
                ? (locale === 'ar' ? `ابدأ بـ ${selectedMediaIds.length} أصل` : `Run with ${selectedMediaIds.length} asset${selectedMediaIds.length !== 1 ? 's' : ''}`)
                : (locale === 'ar' ? 'تابع بدون صور' : 'Continue without assets')}
            </button>

            {mediaItems.length === 0 && !mediaUploading && (
              <p className="text-center text-[11px] text-text-muted mb-1">
                {locale === 'ar' ? '← اضغط "رفع" أعلاه لإضافة صور أو فيديوهات' : '← Click "Upload" above to add photos or videos'}
              </p>
            )}
          </div>
        )}

        {/* ========== GATE PHASE (Brand Brain incomplete — hard block) ========== */}
        {phase === 'gate' && gateData && (
          <div className="p-6">
            <button onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>

            {/* Icon + title */}
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.25)' }}>
                <Brain className="w-7 h-7" style={{ color: '#FFB800' }} />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{bg.runStrategyTitle}</h2>
              <p className="text-sm text-text-muted leading-relaxed">{bg.runStrategyDesc}</p>
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
                <p className="text-[10px] font-medium text-text-muted mb-2">
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
              <p className="text-[10px] font-bold text-accent-teal mb-0.5">{bg.whyMatters}</p>
              <p className="text-[10px] text-text-muted leading-relaxed">{bg.whyMattersDesc}</p>
            </div>

            {/* CTA: Complete Brand Brain (primary — hard block) */}
            <Link href="/brand" onClick={onClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-white btn-gradient mb-2 transition-all hover:brightness-110">
              <Brain className="w-4 h-4" />
              {bg.completeBrandBtn}
            </Link>

            <button onClick={onClose}
              className="w-full px-4 py-2 rounded-xl text-xs text-text-muted hover:text-white transition-all"
              style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
              {rs.errorClose}
            </button>
          </div>
        )}

        {/* ========== SUCCESS PHASE ========== */}
        {phase === 'success' && result && (
          <div className="p-6">
            <button onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 className="w-7 h-7 text-accent-teal" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{rs.successTitle}</h2>
              <p className="text-sm text-text-muted">{rs.successSub}</p>
            </div>

            {result.campaignName && (
              <div className="rounded-xl p-3 mb-4"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
                <p className="text-[10px] text-text-muted mb-1 uppercase tracking-wide">{rs.campaignCreated}</p>
                <p className="text-sm font-bold text-white truncate">{result.campaignName}</p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { value: '1',                            label: rs.statCampaign,     color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.18)' },
                { value: String(result.suggestions ?? 0),label: rs.statSuggestions,  color: '#10B981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.18)' },
                { value: String(result.creditsUsed ?? 5), label: rs.statCreditsUsed,  color: '#FF6B35', bg: 'rgba(255,107,53,0.08)',  border: 'rgba(255,107,53,0.18)' },
                { value: String(creditsLeftDisplay),      label: rs.statCreditsLeft,  color: '#00D4FF', bg: 'rgba(0,212,255,0.08)',   border: 'rgba(0,212,255,0.18)' },
              ].map(({ value, label, color, bg: cellBg, border }) => (
                <div key={label} className="rounded-xl p-2.5 text-center"
                  style={{ background: cellBg, border: `1px solid ${border}` }}>
                  <p className="text-base font-bold leading-none mb-1" style={{ color }}>{value}</p>
                  <p className="text-[9px] text-text-muted leading-tight">{label}</p>
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
              <Link href={`/campaigns/${result.campaignId}?tab=strategy`} onClick={onClose}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-white mb-3 btn-gradient transition-all hover:brightness-110">
                <Rocket className="w-4 h-4" />
                {rs.successCampaign}
              </Link>
            ) : (
              <Link href="/campaigns" onClick={onClose}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-white mb-3 btn-gradient transition-all hover:brightness-110">
                <Sparkles className="w-4 h-4" />
                {rs.successCampaigns}
              </Link>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all hover:brightness-110"
                style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)', color: '#FFB800' }}>
                <Sparkles className="w-3.5 h-3.5" />
                {rs.successSuggestions}
              </button>
              <Link href="/brand" onClick={onClose}
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
              className="absolute top-4 end-4 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.25)' }}>
              <AlertCircle className="w-7 h-7" style={{ color: '#FFB800' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{rs.noResultTitle}</h2>
            <p className="text-sm text-text-muted mb-6">{rs.noResultDesc}</p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted border transition-all hover:text-white"
                style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                {rs.errorClose}
              </button>
              <button onClick={retry}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white btn-gradient">
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
            <h2 className="text-xl font-bold text-white mb-1">{rs.creditsTitle}</h2>
            <p className="text-sm text-text-muted mb-4">{rs.creditsDesc}</p>

            {result?.requiredCredits !== undefined && (
              <div className="grid grid-cols-2 gap-2 mb-5">
                <div className="rounded-xl p-3 text-center"
                  style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)' }}>
                  <p className="text-lg font-bold" style={{ color: '#FF6B35' }}>{result.requiredCredits}</p>
                  <p className="text-[10px] text-text-muted">{rs.creditsNeed}</p>
                </div>
                <div className="rounded-xl p-3 text-center"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p className="text-lg font-bold text-accent-purple">{result.currentCredits ?? 0}</p>
                  <p className="text-[10px] text-text-muted">{rs.creditsHave}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted border transition-all hover:text-white"
                style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                {rs.errorClose}
              </button>
              <button
                onClick={() => { onClose(); setShowUpgrade(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white btn-gradient">
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
              <Cpu className="w-7 h-7 text-accent-purple" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{rs.noBrandTitle}</h2>
            <p className="text-sm text-text-muted mb-6">{rs.noBrandDesc}</p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted border transition-all hover:text-white"
                style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                {rs.errorClose}
              </button>
              <Link href="/brand" onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white btn-gradient">
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
            <h2 className="text-xl font-bold text-white mb-1">{rs.errorTitle}</h2>
            <p className="text-sm text-text-muted mb-5">
              {result?.error || result?.errors?.[0] || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted border transition-all hover:text-white"
                style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                {rs.errorClose}
              </button>
              <button onClick={retry}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white btn-gradient">
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
