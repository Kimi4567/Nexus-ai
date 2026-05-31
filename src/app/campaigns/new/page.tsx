'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  ArrowLeft, Wand2, ChevronRight, ChevronLeft, Check,
  Target, Megaphone, DollarSign, Settings, Rocket, Loader2,
} from 'lucide-react'

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

  const handleCreate = async () => {
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

      // Kick off generation (async — user proceeds to campaign detail)
      fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({ campaignId }),
      }).then(async res => {
        if (res.status === 402) {
          const d = await res.json().catch(() => ({}))
          // Surface credit error on the create page if we're still here
          if (d.error === 'INSUFFICIENT_CREDITS') {
            setSaving(false)
            setError(`Not enough credits to generate strategy (need ${d.requiredCredits}, have ${d.currentCredits}). Upgrade your plan.`)
          }
        }
      }).catch(() => {})

      router.push(`/campaigns/${campaignId}?generating=true`)
    } catch (err: any) {
      setError(err.message || cnT?.errorUnexpected as string)
      setSaving(false)
    }
  }

  const stepIndicatorText = (cnT?.stepIndicator as string)
    ?.replace('{step}', String(step))
    ?.replace('{total}', String(totalSteps))

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/campaigns" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{cnT?.pageTitle as string}</h1>
          <p className="text-text-muted text-sm">{stepIndicatorText}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                step >= s.num ? 'bg-amber text-black' : 'bg-white/5 text-text-muted'
              }`}>
                {step > s.num ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs hidden sm:block ${step >= s.num ? 'text-text-primary' : 'text-text-muted'}`}>
                {s.label}
              </span>
              {s.num < totalSteps && <div className="flex-1 h-px bg-white/10 mx-2" />}
            </div>
          )
        })}
      </div>

      <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">{cnT?.step1Heading as string}</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5">{cnT?.campaignNameLabel as string} <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={cnT?.campaignNamePlaceholder as string}
                className="input-nexus"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{cnT?.descriptionLabel as string}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={cnT?.descriptionPlaceholder as string}
                rows={3}
                className="input-nexus resize-none"
              />
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
              <label className="block text-sm font-medium mb-1.5">{cnT?.audienceLabel as string}</label>
              <textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder={cnT?.audiencePlaceholder as string}
                rows={5}
                className="input-nexus resize-none"
                autoFocus
              />
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
            <ChevronRight className="w-4 h-4" />
            {cnT?.btnPrev as string}
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="btn-primary disabled:opacity-40"
            >
              {cnT?.btnNext as string}
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
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
  )
}
