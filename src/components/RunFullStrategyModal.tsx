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
  Brain, Globe, AlertCircle, AlertTriangle,
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

type Phase = 'running' | 'success' | 'no_campaign' | 'error' | 'credits' | 'no_brand' | 'gate'

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

  const authHeaderRef = useRef(authHeader)
  useEffect(() => { authHeaderRef.current = authHeader }, [authHeader])

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

    setPhase('running')
    setCurrentStep(0)
    setResult(null)
    setGateData(null)

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    let apiDone = false

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

        // Brand Brain is ready -- start timers + main API call
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
          body: JSON.stringify({ language: locale }),
        })
          .then(res => res.json().then((d: RunResult) => ({ ok: res.ok, data: d })))
          .then(({ ok, data: d }) => {
            if (cancelled) return
            apiDone = true
            timers.forEach(clearTimeout)

            if (!ok || d.error) {
              setResult(d)
              if (d.error === 'INSUFFICIENT_CREDITS' || d.error === 'CREDITS_EXHAUSTED') {
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
    }
  }, [isOpen, runKey]) // runKey increments on retry

  if (!isOpen) return null

  const rs = t('runStrategy') as Record<string, string>
  const bg = t('brandGate')   as Record<string, string>

  const langLabel = locale === 'ar' ? rs.chipLangAr : rs.chipLangEn

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
    setRunKey(k => k + 1)
  }

  return (
    <>
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden relative" style={CARD_STYLE}>

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
              <Link href={`/campaigns/${result.campaignId}`} onClick={onClose}
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
