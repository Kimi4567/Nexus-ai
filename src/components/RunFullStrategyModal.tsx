'use client'

/**
 * RunFullStrategyModal
 *
 * Triggered from the dashboard to re-run the full agency orchestration.
 * Calls POST /api/strategy/run-full — which reuses runFullAgency() unchanged.
 *
 * States: running → success | credits | no_brand | error
 * Progress is simulated with timed steps while the API call runs (~15–25s).
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  Cpu, BarChart3, Film, Megaphone, Shield, Zap,
  CheckCircle2, XCircle, ArrowUpRight, X, Rocket, Sparkles,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface RunResult {
  ok?: boolean
  campaignId?: string | null
  campaignName?: string | null
  suggestions?: number
  creditsRemaining?: number
  errors?: string[]
  error?: string
  upgradeUrl?: string
  redirectUrl?: string
}

type Phase = 'running' | 'success' | 'error' | 'credits' | 'no_brand'

interface Props {
  isOpen: boolean
  onClose: () => void
}

// ── Progress step definitions ────────────────────────────────────────────────

// Duration in ms to spend on each step before auto-advancing.
// The last step (index 5) never auto-advances — it waits for the API.
const STEP_DURATIONS = [1500, 3000, 4000, 3500, 3000]

const STEP_ICONS = [Cpu, BarChart3, Film, Megaphone, Shield, Zap]
const STEP_COLORS = ['#6C63FF', '#6C63FF', '#00BFA6', '#FF6B35', '#FFD700', '#00D4FF']
const STEP_KEYS   = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const

// ── Component ────────────────────────────────────────────────────────────────

export default function RunFullStrategyModal({ isOpen, onClose }: Props) {
  const { authHeader } = useAuth()
  const { t, dir, locale } = useI18n()

  const [phase, setPhase]               = useState<Phase>('running')
  const [currentStep, setCurrentStep]   = useState(0)
  const [result, setResult]             = useState<RunResult | null>(null)

  // Stable ref to avoid stale-closure issues in the effect
  const authHeaderRef = useRef(authHeader)
  useEffect(() => { authHeaderRef.current = authHeader }, [authHeader])

  // ── Core effect: fires every time isOpen flips to true ───────────────────
  useEffect(() => {
    if (!isOpen) return

    // Reset state for this run
    setPhase('running')
    setCurrentStep(0)
    setResult(null)

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    let apiDone = false

    // Auto-advance through steps 0–4 on a timer
    let cumulative = 0
    STEP_DURATIONS.forEach((duration, i) => {
      cumulative += duration
      timers.push(
        setTimeout(() => {
          if (!cancelled && !apiDone) setCurrentStep(i + 1)
        }, cumulative)
      )
    })

    // Fire the API call in parallel
    fetch('/api/strategy/run-full', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeaderRef.current(),
      },
      body: JSON.stringify({ language: locale }),
    })
      .then(res => res.json().then((data: RunResult) => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, data }) => {
        if (cancelled) return

        // Stop the step timers — API result takes priority
        apiDone = true
        timers.forEach(clearTimeout)

        if (!ok || data.error) {
          setResult(data)
          if (data.error === 'CREDITS_EXHAUSTED') {
            setPhase('credits')
          } else if (data.error === 'NO_BRAND_PROFILE' || data.error === 'NO_WORKSPACE') {
            setPhase('no_brand')
          } else {
            setPhase('error')
          }
          return
        }

        // Fast-forward to the final step, then reveal success after a short pause
        setCurrentStep(5)
        timers.push(
          setTimeout(() => {
            if (!cancelled) {
              setResult(data)
              setPhase('success')
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

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [isOpen]) // intentional: authHeader captured via ref

  if (!isOpen) return null

  // ── Shared card style ─────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'rgba(17,21,54,0.97)',
    border: '1px solid rgba(108,99,255,0.25)',
    boxShadow: '0 24px 80px rgba(108,99,255,0.2)',
  }

  const rs = t('runStrategy') as Record<string, string>

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden relative" style={cardStyle}>

        {/* ═══════════════ RUNNING PHASE ═══════════════ */}
        {phase === 'running' && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">{rs.modalTitle}</h2>
                <p className="text-xs text-text-muted mt-0.5">{rs.modalSubtitle}</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)' }}>
                <div className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(108,99,255,0.3)', borderTopColor: '#6C63FF' }} />
              </div>
            </div>

            {/* Step list */}
            <div className="space-y-2">
              {STEP_KEYS.map((key, i) => {
                const Icon  = STEP_ICONS[i]
                const color = STEP_COLORS[i]
                const isDone    = i < currentStep
                const isActive  = i === currentStep
                const isPending = i > currentStep

                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300"
                    style={{
                      background: isActive  ? `${color}12`
                                : isDone    ? 'rgba(0,191,166,0.05)'
                                : 'transparent',
                      border: `1px solid ${
                        isActive  ? `${color}35`
                        : isDone  ? 'rgba(0,191,166,0.18)'
                        : 'rgba(108,99,255,0.08)'
                      }`,
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDone   ? 'rgba(0,191,166,0.15)'
                                  : isActive ? `${color}18`
                                  : 'rgba(108,99,255,0.06)',
                      }}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent-teal" />
                      ) : isActive ? (
                        <div
                          className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                          style={{ borderColor: `${color}40`, borderTopColor: color }}
                        />
                      ) : (
                        <Icon className="w-3.5 h-3.5" style={{ color, opacity: isPending ? 0.2 : 1 }} />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className="text-sm font-medium transition-colors"
                      style={{
                        color: isDone   ? '#00BFA6'
                             : isActive ? 'white'
                             : 'rgba(255,255,255,0.22)',
                      }}
                    >
                      {rs[key]}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-[10px] text-text-muted mt-4 text-center">{rs.infoUsing}</p>
          </div>
        )}

        {/* ═══════════════ SUCCESS PHASE ═══════════════ */}
        {phase === 'success' && result && (
          <div className="p-6">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon + title */}
            <div className="text-center mb-5">
              <div
                className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,191,166,0.12)', border: '1px solid rgba(0,191,166,0.25)' }}
              >
                <CheckCircle2 className="w-7 h-7 text-accent-teal" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{rs.successTitle}</h2>
              <p className="text-sm text-text-muted">{rs.successSub}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.15)' }}
              >
                <p className="text-xl font-bold text-accent-purple">1</p>
                <p className="text-[10px] text-text-muted mt-0.5">{rs.statCampaign}</p>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.15)' }}
              >
                <p className="text-xl font-bold text-accent-teal">{result.suggestions ?? 1}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{rs.statSuggestions}</p>
              </div>
            </div>

            {/* Campaign name chip */}
            {result.campaignName && (
              <div
                className="rounded-xl p-3 mb-5"
                style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.12)' }}
              >
                <p className="text-[10px] text-text-muted mb-0.5">{rs.campaignCreated}</p>
                <p className="text-sm font-semibold text-white truncate">{result.campaignName}</p>
              </div>
            )}

            {/* Next-step CTAs */}
            <div className="grid grid-cols-2 gap-2">
              {result.campaignId && (
                <Link
                  href={`/campaigns/${result.campaignId}`}
                  onClick={onClose}
                  className="col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white btn-gradient"
                >
                  <Rocket className="w-4 h-4" />
                  {rs.successCampaign}
                </Link>
              )}
              <Link
                href="/campaigns"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all hover:brightness-110"
                style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', color: '#a5a0ff' }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {rs.successCampaigns}
              </Link>
              <Link
                href="/brand"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all hover:brightness-110"
                style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.2)', color: '#00BFA6' }}
              >
                <Cpu className="w-3.5 h-3.5" />
                {rs.successBrand}
              </Link>
              {result.campaignId && (
                <Link
                  href={`/campaigns/${result.campaignId}`}
                  onClick={onClose}
                  className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all hover:brightness-110"
                  style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', color: '#FFD700' }}
                >
                  <Shield className="w-3.5 h-3.5" />
                  {rs.successSuggestions}
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ CREDITS EXHAUSTED ═══════════════ */}
        {phase === 'credits' && (
          <div className="p-6 text-center">
            <div
              className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)' }}
            >
              <Zap className="w-7 h-7" style={{ color: '#FF6B35' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{rs.creditsTitle}</h2>
            <p className="text-sm text-text-muted mb-6">{rs.creditsDesc}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted border transition-all hover:text-white"
                style={{ borderColor: 'rgba(108,99,255,0.2)' }}
              >
                {rs.errorClose}
              </button>
              <Link
                href="/billing"
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white btn-gradient"
              >
                <ArrowUpRight className="w-4 h-4" />
                {rs.creditsUpgrade}
              </Link>
            </div>
          </div>
        )}

        {/* ═══════════════ NO BRAND PROFILE ═══════════════ */}
        {phase === 'no_brand' && (
          <div className="p-6 text-center">
            <div
              className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)' }}
            >
              <Cpu className="w-7 h-7 text-accent-purple" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{rs.noBrandTitle}</h2>
            <p className="text-sm text-text-muted mb-6">{rs.noBrandDesc}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted border transition-all hover:text-white"
                style={{ borderColor: 'rgba(108,99,255,0.2)' }}
              >
                {rs.errorClose}
              </button>
              <Link
                href="/brand"
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white btn-gradient"
              >
                <ArrowUpRight className="w-4 h-4" />
                {rs.noBrandBtn}
              </Link>
            </div>
          </div>
        )}

        {/* ═══════════════ GENERIC ERROR ═══════════════ */}
        {phase === 'error' && (
          <div className="p-6 text-center">
            <div
              className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)' }}
            >
              <XCircle className="w-7 h-7 text-rose-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{rs.errorTitle}</h2>
            <p className="text-sm text-text-muted mb-2">
              {result?.error || result?.errors?.[0] || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted border transition-all hover:text-white"
                style={{ borderColor: 'rgba(108,99,255,0.2)' }}
              >
                {rs.errorClose}
              </button>
              <button
                onClick={() => { setPhase('running'); setCurrentStep(0); setResult(null) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white btn-gradient"
              >
                <Sparkles className="w-4 h-4" />
                {rs.errorRetry}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
