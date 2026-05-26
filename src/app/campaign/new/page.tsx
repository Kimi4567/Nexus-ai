'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'

const GOALS = [
  { value: 'SALES', label: 'Sales', icon: '💰', desc: 'Drive purchases and revenue' },
  { value: 'AWARENESS', label: 'Awareness', icon: '📣', desc: 'Grow brand visibility' },
  { value: 'LEADS', label: 'Lead Generation', icon: '🎯', desc: 'Capture qualified leads' },
  { value: 'ENGAGEMENT', label: 'Engagement', icon: '❤️', desc: 'Build community & interaction' },
  { value: 'TRAFFIC', label: 'Traffic', icon: '🚦', desc: 'Drive website visitors' },
]

const TONES = [
  { value: 'MODERN', label: 'Modern' },
  { value: 'FRIENDLY', label: 'Friendly' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'ENERGETIC', label: 'Energetic' },
  { value: 'LUXURY', label: 'Luxury' },
  { value: 'MINIMAL', label: 'Minimal' },
]

const PLATFORMS = ['TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE_SHORTS', 'LINKEDIN']
const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: 'TikTok',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  YOUTUBE_SHORTS: 'YouTube Shorts',
  LINKEDIN: 'LinkedIn',
}

const STEPS = [
  { id: 1, title: 'Campaign Basics', desc: 'Name & goal' },
  { id: 2, title: 'Audience & Tone', desc: 'Who & how' },
  { id: 3, title: 'Platforms', desc: 'Where to publish' },
  { id: 4, title: 'Review & Launch', desc: 'Confirm & generate' },
]

interface FormData {
  name: string
  goal: string
  description: string
  audience: string
  tone: string
  platforms: string[]
}

function CreateCampaignInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill from URL params (e.g. from Templates page)
  const initialGoal = searchParams.get('goal') || 'SALES'
  const initialPlatforms = searchParams.get('platforms')?.split(',').filter(Boolean) || ['INSTAGRAM']
  const initialTemplate = searchParams.get('template') || ''

  const [form, setForm] = useState<FormData>({
    name: initialTemplate ? `${initialTemplate} Campaign` : '',
    goal: GOALS.find(g => g.value === initialGoal) ? initialGoal : 'SALES',
    description: '',
    audience: '',
    tone: 'MODERN',
    platforms: initialPlatforms.filter(p => PLATFORMS.includes(p)).length
      ? initialPlatforms.filter(p => PLATFORMS.includes(p))
      : ['INSTAGRAM'],
  })

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  const update = useCallback((field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const togglePlatform = useCallback((p: string) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter(x => x !== p)
        : [...prev.platforms, p],
    }))
  }, [])

  const getOrCreateProject = async (token: string): Promise<string> => {
    // Try to fetch existing workspaces
    const wsRes = await fetch('/api/workspaces', { headers: { Authorization: token } })
    const workspaces = wsRes.ok ? await wsRes.json() : []

    let workspaceId: string

    if (Array.isArray(workspaces) && workspaces.length > 0) {
      workspaceId = workspaces[0].id
    } else {
      // Create default workspace
      const slug = `workspace-${Date.now()}`
      const wsCreate = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Workspace', slug, description: 'Default workspace' }),
      })
      const ws = await wsCreate.json()
      workspaceId = ws.id
    }

    // Fetch projects in that workspace
    const prRes = await fetch(`/api/projects?workspaceId=${workspaceId}`, { headers: { Authorization: token } })
    const projects = prRes.ok ? await prRes.json() : []

    if (Array.isArray(projects) && projects.length > 0) {
      return projects[0].id
    }

    // Create default project
    const prCreate = await fetch('/api/projects', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Project', workspaceId }),
    })
    const project = await prCreate.json()
    return project.id
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Campaign name is required'); return }
    if (form.platforms.length === 0) { setError('Select at least one platform'); return }

    setSubmitting(true)
    setError('')

    try {
      const token = authHeader()

      // Fetch brand profile to inject into AI context
      let brandProfile = null
      if (token) {
        try {
          const bpRes = await fetch('/api/brand', { headers: { Authorization: token } })
          if (bpRes.ok) {
            const bpData = await bpRes.json()
            brandProfile = bpData.brandProfile || null
          }
        } catch { /* ignore brand fetch errors */ }
      }

      // Generate AI content with brand context
      const res = await fetch('/api/generate/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({ ...form, brandProfile }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      // Store results in sessionStorage and redirect to results page
      sessionStorage.setItem('nexus_campaign_result', JSON.stringify(data))
      router.push('/campaign/results')

      // Also try to persist to DB in background (non-blocking)
      if (token) {
        getOrCreateProject(token).then(projectId => {
          if (!projectId) return
          fetch('/api/campaigns', {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, ...form }),
          }).catch(() => {}) // silent fail — DB is optional
        }).catch(() => {})
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  return (
    <AppShell>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-6 pt-8 page-enter">
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${step >= s.id ? 'text-accent' : 'text-gray-600'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${step > s.id ? 'bg-accent border-accent text-dark' : step === s.id ? 'border-accent text-accent' : 'border-gray-700 text-gray-600'}`}>
                  {step > s.id ? '✓' : s.id}
                </div>
                <span className="text-xs font-semibold hidden sm:block">{s.title}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 ${step > s.id ? 'bg-accent' : 'bg-dark-tertiary'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-6 pb-16">
        <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-8">

          {/* Step 1: Basics */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Campaign Basics</h2>
                <p className="text-gray-400 text-sm">Give your campaign a name and choose your primary goal.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Campaign Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="e.g., Summer Sale 2024"
                  className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3">Campaign Goal *</label>
                <div className="grid grid-cols-1 gap-3">
                  {GOALS.map(g => (
                    <button
                      key={g.value}
                      onClick={() => update('goal', g.value)}
                      className={`p-4 rounded-lg border-2 text-left transition ${form.goal === g.value ? 'border-accent bg-accent/10' : 'border-dark-tertiary bg-dark hover:border-accent/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{g.icon}</span>
                        <div>
                          <div className="font-semibold">{g.label}</div>
                          <div className="text-xs text-gray-400">{g.desc}</div>
                        </div>
                        {form.goal === g.value && <span className="ml-auto text-accent">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Brief Description</label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder="Describe what you're promoting..."
                  rows={3}
                  className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent transition resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Audience & Tone */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Audience & Tone</h2>
                <p className="text-gray-400 text-sm">Help the AI understand who you're targeting and how to communicate.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Target Audience</label>
                <textarea
                  value={form.audience}
                  onChange={e => update('audience', e.target.value)}
                  placeholder="e.g., Young professionals aged 25-35 interested in fitness and wellness..."
                  rows={4}
                  className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent transition resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3">Brand Tone</label>
                <div className="grid grid-cols-3 gap-3">
                  {TONES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => update('tone', t.value)}
                      className={`p-3 rounded-lg border-2 text-center transition ${form.tone === t.value ? 'border-accent bg-accent/10 text-accent font-semibold' : 'border-dark-tertiary bg-dark hover:border-accent/50'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Platforms */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Select Platforms</h2>
                <p className="text-gray-400 text-sm">Where will you publish this campaign? Select all that apply.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`p-5 rounded-lg border-2 text-center font-semibold transition ${form.platforms.includes(p) ? 'border-accent bg-accent/10 text-accent' : 'border-dark-tertiary bg-dark hover:border-accent/50'}`}
                  >
                    {PLATFORM_LABELS[p]}
                    {form.platforms.includes(p) && <div className="text-xs mt-1">✓ Selected</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Review & Launch</h2>
                <p className="text-gray-400 text-sm">The AI will generate strategy, hooks, captions, and content for your campaign.</p>
              </div>

              <div className="bg-dark rounded-xl p-6 space-y-3 text-sm">
                {[
                  { label: 'Campaign Name', value: form.name },
                  { label: 'Goal', value: GOALS.find(g => g.value === form.goal)?.label },
                  { label: 'Audience', value: form.audience || '—' },
                  { label: 'Tone', value: TONES.find(t => t.value === form.tone)?.label },
                  { label: 'Platforms', value: form.platforms.map(p => PLATFORM_LABELS[p]).join(', ') || 'None' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-2 border-b border-dark-tertiary last:border-0">
                    <span className="text-gray-400">{row.label}</span>
                    <span className="font-semibold text-right">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 text-sm text-accent">
                🤖 NEXUS AI will generate your complete marketing strategy, ad concepts, hooks, captions, and CTAs automatically.
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-6 py-3 bg-dark-tertiary hover:bg-dark-tertiary/80 rounded-lg font-semibold transition"
              >
                ← Back
              </button>
            )}

            {step < 4 ? (
              <button
                onClick={() => { setError(''); setStep(s => s + 1) }}
                disabled={step === 1 && !form.name.trim()}
                className="flex-1 px-6 py-3 bg-accent text-dark rounded-lg hover:bg-accent-light transition font-semibold disabled:opacity-50"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-accent text-dark rounded-lg hover:bg-accent-light transition font-semibold disabled:opacity-50"
              >
                {submitting ? '🤖 Generating Campaign...' : '🚀 Create Campaign'}
              </button>
            )}

            <Link href="/dashboard">
              <button className="px-6 py-3 bg-dark-tertiary hover:bg-dark-tertiary/80 rounded-lg font-semibold transition">
                Cancel
              </button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default function CreateCampaignPage() {
  return (
    <Suspense fallback={null}>
      <CreateCampaignInner />
    </Suspense>
  )
}