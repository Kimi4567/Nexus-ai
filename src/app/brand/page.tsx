'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'

interface BrandProfile {
  brandName?: string
  industry?: string
  description?: string
  toneKeywords: string[]
  avoidKeywords: string[]
  writingStyle?: string
  targetAudience?: string
  audienceAge?: string
  audienceLocation?: string
  audiencePainPoints: string[]
  audienceDesires: string[]
  primaryOffer?: string
  secondaryOffers: string[]
  pricePoint?: string
  uniqueAdvantages: string[]
  visualStyle?: string
  colorPalette: string[]
  winningHooks: string[]
  winningAngles: string[]
  strategicNotes?: string
  competitorNotes?: string
}

const emptyProfile: BrandProfile = {
  brandName: '', industry: '', description: '',
  toneKeywords: [], avoidKeywords: [], writingStyle: '',
  targetAudience: '', audienceAge: '', audienceLocation: '',
  audiencePainPoints: [], audienceDesires: [],
  primaryOffer: '', secondaryOffers: [], pricePoint: '',
  uniqueAdvantages: [], visualStyle: '', colorPalette: [],
  winningHooks: [], winningAngles: [], strategicNotes: '', competitorNotes: '',
}

const TONE_OPTIONS = ['Bold', 'Conversational', 'Premium', 'Minimal', 'Energetic', 'Authoritative', 'Friendly', 'Witty', 'Urgent', 'Inspirational']
const STYLE_OPTIONS = ['Short & punchy', 'Long-form storytelling', 'Bullet-led', 'Question-led', 'Data-driven', 'Narrative', 'Direct response']
const VISUAL_OPTIONS = ['Minimalist', 'Bold & graphic', 'Lifestyle photography', 'Corporate clean', 'Dark premium', 'Bright & playful', 'Editorial']
const PRICE_OPTIONS = ['Budget', 'Mid-range', 'Premium', 'Luxury']
const AGE_OPTIONS = ['13–17', '18–24', '25–34', '35–44', '45–54', '55–64', '65+']

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="text-[12px] text-t3 mt-0.5">{description}</p>
    </div>
  )
}

function TagInput({
  label, values, onChange, placeholder, suggestions,
}: {
  label: string
  values: string[]
  onChange: (vals: string[]) => void
  placeholder?: string
  suggestions?: string[]
}) {
  const [input, setInput] = useState('')

  const add = (val: string) => {
    const trimmed = val.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInput('')
  }

  const remove = (val: string) => onChange(values.filter(v => v !== val))

  return (
    <div>
      <label className="block text-[11px] font-medium text-t3 uppercase tracking-wide mb-2">{label}</label>
      {/* Suggestion pills */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {suggestions.filter(s => !values.includes(s)).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-[11px] px-2.5 py-1 bg-s3 border border-s4 text-t3 rounded-full hover:text-white hover:border-s5 transition"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      {/* Selected tags */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-accent/15 border border-accent/30 text-accent rounded-full">
            {v}
            <button type="button" onClick={() => remove(v)} className="hover:text-white transition leading-none">×</button>
          </span>
        ))}
      </div>
      {/* Input */}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) } }}
        placeholder={placeholder || 'Type and press Enter'}
        className="w-full px-3 py-2 bg-s1 border border-s4 rounded-lg text-sm text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
      />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-t3 uppercase tracking-wide mb-2">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 bg-s1 border border-s4 rounded-lg text-sm text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition resize-none"
      />
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-t3 uppercase tracking-wide mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-s1 border border-s4 rounded-lg text-sm text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
      />
    </div>
  )
}

function PillSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-t3 uppercase tracking-wide mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? '' : opt)}
            className={`text-[11px] px-3 py-1.5 rounded-full border transition font-medium ${
              value === opt
                ? 'bg-accent border-accent text-white'
                : 'bg-s1 border-s4 text-t3 hover:text-white hover:border-s5'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

const SECTIONS = ['Identity', 'Voice & Tone', 'Audience', 'Offer', 'Visual', 'Memory']

export default function BrandIntelligencePage() {
  const router = useRouter()
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [profile, setProfile] = useState<BrandProfile>(emptyProfile)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState(0)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  const fetchProfile = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setFetching(true)
    try {
      const res = await fetch('/api/brand', { headers: { Authorization: token } })
      const data = await res.json()
      if (data.brandProfile) {
        setProfile({ ...emptyProfile, ...data.brandProfile })
      }
    } catch { /* ignore */ }
    setFetching(false)
  }, [authHeader])

  useEffect(() => {
    if (isAuthenticated) fetchProfile()
  }, [isAuthenticated, fetchProfile])

  const update = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    const token = authHeader()
    if (!token) return
    setSaving(true)
    try {
      await fetch('/api/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(profile),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* ignore */ }
    setSaving(false)
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

  const completionFields = [
    profile.brandName, profile.industry, profile.description,
    profile.toneKeywords.length > 0, profile.writingStyle,
    profile.targetAudience, profile.primaryOffer,
  ]
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100)

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-[900px] page-enter">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Brand Intelligence</h1>
            <p className="text-sm text-t3">
              Your brand memory — the AI reads this before every campaign to stay on-voice.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-t3 mb-1">Profile completion</div>
              <div className="w-32 h-1.5 bg-s3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-accent hover:bg-accent-light text-white'
              }`}
            >
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-1">
          {SECTIONS.map((s, i) => (
            <button
              key={s}
              onClick={() => setActiveSection(i)}
              className={`px-3.5 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition ${
                activeSection === i
                  ? 'bg-s3 text-t1'
                  : 'text-t3 hover:text-t2'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="space-y-6">

          {/* Identity */}
          {activeSection === 0 && (
            <div className="surface-card rounded-card p-6 space-y-5">
              <SectionHeader
                title="Brand Identity"
                description="The foundation of your brand — who you are and what you do."
              />
              <div className="grid grid-cols-2 gap-5">
                <TextField label="Brand name" value={profile.brandName || ''} onChange={v => update('brandName', v)} placeholder="e.g., Acme Co." />
                <TextField label="Industry" value={profile.industry || ''} onChange={v => update('industry', v)} placeholder="e.g., E-commerce, SaaS, Beauty" />
              </div>
              <TextArea
                label="Brand description"
                value={profile.description || ''}
                onChange={v => update('description', v)}
                placeholder="What does your brand do? What problem do you solve? What makes you different?"
                rows={4}
              />
            </div>
          )}

          {/* Voice & Tone */}
          {activeSection === 1 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="Voice & Tone"
                description="Define how your brand sounds. The AI will write in this voice for every campaign."
              />
              <TagInput
                label="Tone keywords"
                values={profile.toneKeywords}
                onChange={v => update('toneKeywords', v)}
                suggestions={TONE_OPTIONS}
                placeholder="Add tone descriptors and press Enter"
              />
              <TagInput
                label="Words / styles to avoid"
                values={profile.avoidKeywords}
                onChange={v => update('avoidKeywords', v)}
                placeholder="e.g., 'revolutionary', corporate jargon, exclamation marks"
              />
              <PillSelect
                label="Writing style"
                options={STYLE_OPTIONS}
                value={profile.writingStyle || ''}
                onChange={v => update('writingStyle', v)}
              />
            </div>
          )}

          {/* Audience */}
          {activeSection === 2 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="Target Audience"
                description="Who are you speaking to? The more specific, the better the AI understands them."
              />
              <TextArea
                label="Audience description"
                value={profile.targetAudience || ''}
                onChange={v => update('targetAudience', v)}
                placeholder="Describe your ideal customer in detail — their day, values, frustrations, dreams..."
                rows={4}
              />
              <div className="grid grid-cols-2 gap-5">
                <PillSelect
                  label="Age group"
                  options={AGE_OPTIONS}
                  value={profile.audienceAge || ''}
                  onChange={v => update('audienceAge', v)}
                />
                <TextField
                  label="Location / Market"
                  value={profile.audienceLocation || ''}
                  onChange={v => update('audienceLocation', v)}
                  placeholder="e.g., US, UK, Australia, Global"
                />
              </div>
              <TagInput
                label="Pain points"
                values={profile.audiencePainPoints}
                onChange={v => update('audiencePainPoints', v)}
                placeholder="What frustrates them? Press Enter after each"
              />
              <TagInput
                label="Desires & goals"
                values={profile.audienceDesires}
                onChange={v => update('audienceDesires', v)}
                placeholder="What do they want? Press Enter after each"
              />
            </div>
          )}

          {/* Offer */}
          {activeSection === 3 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="Offer & Positioning"
                description="What are you selling and why is it better? This shapes every campaign strategy."
              />
              <TextArea
                label="Primary offer"
                value={profile.primaryOffer || ''}
                onChange={v => update('primaryOffer', v)}
                placeholder="Your core product/service and what it delivers..."
                rows={3}
              />
              <TagInput
                label="Secondary offers / upsells"
                values={profile.secondaryOffers}
                onChange={v => update('secondaryOffers', v)}
                placeholder="Other products, add-ons, or services"
              />
              <PillSelect
                label="Price point"
                options={PRICE_OPTIONS}
                value={profile.pricePoint || ''}
                onChange={v => update('pricePoint', v)}
              />
              <TagInput
                label="Unique advantages"
                values={profile.uniqueAdvantages}
                onChange={v => update('uniqueAdvantages', v)}
                placeholder="What makes you better than alternatives? Press Enter after each"
              />
            </div>
          )}

          {/* Visual */}
          {activeSection === 4 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="Visual Identity"
                description="Your aesthetic preferences — guides image and creative direction."
              />
              <PillSelect
                label="Visual style"
                options={VISUAL_OPTIONS}
                value={profile.visualStyle || ''}
                onChange={v => update('visualStyle', v)}
              />
              <TagInput
                label="Brand colors"
                values={profile.colorPalette}
                onChange={v => update('colorPalette', v)}
                placeholder="e.g., Navy blue, Gold, #1a1a2e — press Enter after each"
              />
            </div>
          )}

          {/* Memory */}
          {activeSection === 5 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="Campaign Memory"
                description="What has worked and what hasn't. The AI learns from your history."
              />
              <TagInput
                label="Winning hooks"
                values={profile.winningHooks}
                onChange={v => update('winningHooks', v)}
                placeholder="Hooks that drove engagement — press Enter after each"
              />
              <TagInput
                label="Winning angles"
                values={profile.winningAngles}
                onChange={v => update('winningAngles', v)}
                placeholder="Campaign angles that converted — press Enter after each"
              />
              <TextArea
                label="Strategic notes"
                value={profile.strategicNotes || ''}
                onChange={v => update('strategicNotes', v)}
                placeholder="Any strategic context the AI should always know — seasonality, positioning shifts, upcoming launches..."
                rows={4}
              />
              <TextArea
                label="Competitor notes"
                value={profile.competitorNotes || ''}
                onChange={v => update('competitorNotes', v)}
                placeholder="Who are your competitors? How do you differentiate from them?"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Bottom save */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-accent hover:bg-accent-light text-white'
            }`}
          >
            {saving ? 'Saving...' : saved ? '✓ Brand profile saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
