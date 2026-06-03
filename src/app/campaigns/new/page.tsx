'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getBrandBrainReadiness, BrandReadinessResult } from '@/lib/brandReadiness'
import {
  ArrowLeft, Wand2, ChevronRight, ChevronLeft, Check,
  Target, Megaphone, Settings, Rocket, Loader2, Brain, AlertTriangle,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import UpgradeModal from '@/components/UpgradeModal'

const PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'YouTube Shorts', 'Snapchat', 'LinkedIn']

export default function NewCampaignPage() {
  const router = useRouter()
  const { authHeader } = useAuth()
  const { t, locale } = useI18n()
  const cnT = t('campaignNew')

  const GOAL_OPTIONS = [
    { value: 'SALES',     label: cnT?.goalSALES      as string },
    { value: 'AWARENESS', label: cnT?.goalAWARENESS  as string },
    { value: 'ENGAGEMENT',label: cnT?.goalENGAGEMENT as string },
    { value: 'LEADS',     label: cnT?.goalLEADS      as string },
    { value: 'TRAFFIC',   label: cnT?.goalTRAFFIC    as string },
  ]

  const TONE_OPTIONS = [
    { value: 'MODERN',       label: cnT?.toneMODERN       as string },
    { value: 'FRIENDLY',     label: cnT?.toneFRIENDLY     as string },
    { value: 'PROFESSIONAL', label: cnT?.tonePROFESSIONAL as string },
    { value: 'BOLD',         label: cnT?.toneBOLD         as string },
    { value: 'INSPIRING',    label: cnT?.toneINSPIRING    as string },
  ]

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [brandReadiness, setBrandReadiness] = useState<BrandReadinessResult | null>(null)

  // AI suggest state
  const [suggesting, setSuggesting] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<{ field: string; text: string } | null>(null)

  // Fetch Brand Brain readiness once on mount
  useEffect(() => {
    fetch('/api/brand', { headers: { Authorization: authHeader() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setBrandReadiness(getBrandBrainReadiness(data.brandProfile))
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('SALES')
  const [tone, setTone] = useState('MODERN')
  const [platforms, setPlatforms] = useState<string[]>(['Facebook'])
  const [audience, setAudience] = useState('')

  const totalSteps = 4

  const steps = [
    { num: 1, label: cnT?.step1Label as string, icon: Target },
    { num: 2, label: cnT?.step2Label as string, icon: Megaphone },
    { num: 3, label: cnT?.step3Label as string, icon: Settings },
    { num: 4, label: cnT?.step4Label as string, icon: Rocket },
  ]

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const canNext = () => {
    if (step === 1) return name.trim().length > 0
    if (step === 2) return platforms.length > 0
    return true
  }

  const brandNotReady = brandReadiness !== null && !brandReadiness.ready

  const handleCreate = async (skipGeneration = false) => {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      const saveRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({ name, description, goal, tone, platforms, audience }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        throw new Error(err.error || cnT?.errorSave as string)
      }

      const { id: campaignId } = await saveRes.json()

      // If Brand Brain is incomplete or caller explicitly skips AI, save as draft only
      if (skipGeneration || brandNotReady) {
        router.push(`/campaigns/${campaignId}?new=1`)
        return
      }

      // Kick off AI generation (async — user proceeds to campaign detail)
      // Pass locale so AI generates in the user's language (not always Arabic)
      fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({ campaignId, language: locale }),
      }).catch(() => {})

      router.push(`/campaigns/${campaignId}?generating=true&new=1`)
    } catch (err: any) {
      setError(err.message || cnT?.errorUnexpected as string)
      setSaving(false)
    }
  }

  const handleSuggest = async (field: 'name' | 'description' | 'audience') => {
    setSuggesting(field)
    setSuggestion(null)
    try {
      const res = await fetch('/api/campaigns/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ field, name, description, goal, locale }),
      })
      const data = await res.json()
      if (data.suggestion) setSuggestion({ field, text: data.suggestion })
    } catch { /* silent */ }
    finally { setSuggesting(null) }
  }

  const acceptSuggestion = () => {
    if (!suggestion) return
    if (suggestion.field === 'name') setName(suggestion.text)
    if (suggestion.field === 'description') setDescription(suggestion.text)
    if (suggestion.field === 'audience') setAudience(suggestion.text)
    setSuggestion(null)
  }

  const stepIndicatorText = (cnT?.stepIndicator as string)
    ?.replace('{step}', String(step))
    ?.replace('{total}', String(totalSteps))

  const isRTL = locale === 'ar'
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft
  const NextIcon = isRTL ? ChevronLeft : ChevronRight

  return (
    <AppShell>
    <div className="relative min-h-screen">
      <div className="absolute inset-0 nx-bg-grid pointer-events-none opacity-30" />
      <div className="relative max-w-3xl mx-auto px-4 py-10 page-enter">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="no_credits" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/campaigns"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
          style={{ background: 'rgba(12,13,36,0.6)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Wand2 className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-violet-400/70 font-mono tracking-wider">NEW CAMPAIGN</span>
          </div>
          <h1 className="text-2xl font-bold">{cnT?.pageTitle as string}</h1>
          <p className="text-text-muted text-sm">{stepIndicatorText}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s) => {
          const Icon = s.icon
          const done = step > s.num
          const active = step === s.num
          return (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                done ? 'text-white' : active ? 'text-black' : 'text-text-muted'
              }`} style={{
                background: done
                  ? 'rgba(16,185,129,0.15)'
                  : active
                  ? 'linear-gradient(135deg,#8B5CF6,#6366f1)'
                  : 'rgba(255,255,255,0.04)',
                border: done
                  ? '1px solid rgba(16,185,129,0.3)'
                  : active
                  ? 'none'
                  : '1px solid rgba(255,255,255,0.08)',
              }}>
                {done
                  ? <Check className="w-5 h-5 text-emerald-400" />
                  : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs hidden sm:block font-medium ${
                active ? 'text-white' : done ? 'text-emerald-400' : 'text-text-muted'
              }`}>
                {s.label}
              </span>
              {s.num < totalSteps && (
                <div className="flex-1 h-px mx-2" style={{
                  background: done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Card */}
      <div className="rounded-2xl p-6" style={{
        background: 'rgba(12,13,36,0.6)',
        border: '1px solid rgba(139,92,246,0.15)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">{cnT?.step1Heading as string}</h3>

            {/* Campaign Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">{cnT?.campaignNameLabel as string} <span className="text-red-400">*</span></label>
                <button
                  type="button"
                  onClick={() => handleSuggest('name')}
                  disabled={suggesting === 'name'}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                  style={{
                    background: 'rgba(139,92,246,0.12)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    color: '#a78bfa',
                  }}
                >
                  {suggesting === 'name'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Wand2 className="w-3 h-3" />}
                  {locale === 'ar' ? 'اقتراح AI' : 'AI Suggest'}
                </button>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={cnT?.campaignNamePlaceholder as string}
                className="input-nexus"
                autoFocus
              />
              {suggestion?.field === 'name' && (
                <div className="mt-2 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p className="text-violet-300 font-medium mb-2">✨ {suggestion.text}</p>
                  <div className="flex gap-2">
                    <button onClick={acceptSuggestion}
                      className="text-xs px-3 py-1 rounded-lg font-semibold"
                      style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                      {locale === 'ar' ? 'استخدم هذا' : 'Use this'}
                    </button>
                    <button onClick={() => setSuggestion(null)}
                      className="text-xs px-3 py-1 rounded-lg text-gray-500 hover:text-gray-400">
                      {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">{cnT?.descriptionLabel as string}</label>
                <button
                  type="button"
                  onClick={() => handleSuggest('description')}
                  disabled={suggesting === 'description'}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                  style={{
                    background: 'rgba(139,92,246,0.12)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    color: '#a78bfa',
                  }}
                >
                  {suggesting === 'description'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Wand2 className="w-3 h-3" />}
                  {locale === 'ar' ? 'اقتراح AI' : 'AI Suggest'}
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={cnT?.descriptionPlaceholder as string}
                rows={3}
                className="input-nexus resize-none"
              />
              {suggestion?.field === 'description' && (
                <div className="mt-2 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p className="text-violet-300 mb-2">{suggestion.text}</p>
                  <div className="flex gap-2">
                    <button onClick={acceptSuggestion}
                      className="text-xs px-3 py-1 rounded-lg font-semibold"
                      style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                      {locale === 'ar' ? 'استخدم هذا' : 'Use this'}
                    </button>
                    <button onClick={() => setSuggestion(null)}
                      className="text-xs px-3 py-1 rounded-lg text-gray-500 hover:text-gray-400">
                      {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{cnT?.goalLabel as string}</label>
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input-nexus">
                  {GOAL_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{cnT?.toneLabel as string}</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-nexus">
                  {TONE_OPTIONS.map((tn) => (
                    <option key={tn.value} value={tn.value}>{tn.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Platforms */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">{cnT?.step2Heading as string}</h3>
            <p className="text-text-muted text-sm">{cnT?.platformSubtitle as string}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`p-4 rounded-xl border text-sm font-medium transition-all ${
                    platforms.includes(p)
                      ? 'border-amber bg-amber/10 text-amber'
                      : 'border-white/10 hover:border-white/20 text-text-secondary'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {platforms.length === 0 && (
              <p className="text-red-400 text-xs">{cnT?.platformRequired as string}</p>
            )}
          </div>
        )}

        {/* Step 3: Audience */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">{cnT?.step3Heading as string}</h3>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">{cnT?.audienceLabel as string}</label>
                <button
                  type="button"
                  onClick={() => handleSuggest('audience')}
                  disabled={suggesting === 'audience'}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                  style={{
                    background: 'rgba(139,92,246,0.12)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    color: '#a78bfa',
                  }}
                >
                  {suggesting === 'audience'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Wand2 className="w-3 h-3" />}
                  {locale === 'ar' ? 'اقتراح AI' : 'AI Suggest'}
                </button>
              </div>
              <textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder={cnT?.audiencePlaceholder as string}
                rows={5}
                className="input-nexus resize-none"
                autoFocus
              />
              {suggestion?.field === 'audience' && (
                <div className="mt-2 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p className="text-violet-300 mb-2">{suggestion.text}</p>
                  <div className="flex gap-2">
                    <button onClick={acceptSuggestion}
                      className="text-xs px-3 py-1 rounded-lg font-semibold"
                      style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                      {locale === 'ar' ? 'استخدم هذا' : 'Use this'}
                    </button>
                    <button onClick={() => setSuggestion(null)}
                      className="text-xs px-3 py-1 rounded-lg text-gray-500 hover:text-gray-400">
                      {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-text-muted text-xs mt-1.5">
                {cnT?.audienceHint as string}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">{cnT?.step4Heading as string}</h3>

            {/* Brand Brain gate warning */}
            {brandNotReady && brandReadiness && (
              <div className="rounded-xl p-4"
                style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.25)' }}>
                <div className="flex items-start gap-3">
                  <Brain className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FFB800' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#FFB800' }}>
                      {(t('brandGate') as Record<string,string>).campaignTitle}
                    </p>
                    <p className="text-xs text-text-muted mb-2">
                      {(t('brandGate') as Record<string,string>).campaignDesc}
                    </p>
                    {brandReadiness.missingRequired.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {brandReadiness.missingRequired.map(key => (
                          <span key={key}
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {(t('brandGate') as Record<string,string>)[`field${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? key}
                          </span>
                        ))}
                      </div>
                    )}
                    <Link href="/brand"
                      className="inline-flex items-center gap-1 text-[11px] font-bold"
                      style={{ color: '#FFB800' }}>
                      {(t('brandGate') as Record<string,string>).completeBrandBtn} →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 p-4 rounded-xl bg-white/5">
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">{cnT?.reviewCampaignName as string}</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">{cnT?.reviewGoal as string}</span>
                <span className="font-medium">{GOAL_OPTIONS.find(g => g.value === goal)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">{cnT?.reviewTone as string}</span>
                <span className="font-medium">{TONE_OPTIONS.find(tn => tn.value === tone)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">{cnT?.reviewPlatforms as string}</span>
                <span className="font-medium">{platforms.join(cnT?.platformJoiner as string || ', ')}</span>
              </div>
              {audience && (
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted text-sm shrink-0">{cnT?.reviewAudience as string}</span>
                  <span className="font-medium text-sm text-left">{audience.slice(0, 60)}{audience.length > 60 ? '...' : ''}</span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-amber/5 border border-amber/20">
              <div className="flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-amber shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber text-sm">{cnT?.aiNoticeTitle as string}</p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {cnT?.aiNoticeDesc as string}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
            className="btn-secondary disabled:opacity-40"
          >
            <PrevIcon className="w-4 h-4" />
            {cnT?.btnPrev as string}
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="btn-primary disabled:opacity-40"
            >
              {cnT?.btnNext as string}
              <NextIcon className="w-4 h-4" />
            </button>
          ) : brandNotReady ? (
            /* Brand not ready: split into two actions */
            <div className="flex flex-col gap-2 items-end">
              <button
                onClick={() => handleCreate(true)}
                disabled={saving || !name.trim()}
                className="btn-secondary disabled:opacity-40 min-w-[160px] flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                {(t('brandGate') as Record<string,string>).saveDraftBtn}
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleCreate(false)}
              disabled={saving || !name.trim()}
              className="btn-primary disabled:opacity-40 min-w-[140px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {cnT?.btnCreating as string}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  {cnT?.btnCreate as string}
                </>
              )}
            </button>
          )}
        </div>
      </div>
      </div>
      </div>
    </AppShell>
  )
}
