'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const INDUSTRIES = [
  { value: 'ecommerce', label: 'E-commerce', icon: '🛍️' },
  { value: 'saas', label: 'SaaS / Tech', icon: '💻' },
  { value: 'agency', label: 'Agency', icon: '🏢' },
  { value: 'fitness', label: 'Fitness', icon: '💪' },
  { value: 'food', label: 'Food & Bev', icon: '🍕' },
  { value: 'real_estate', label: 'Real Estate', icon: '🏠' },
  { value: 'beauty', label: 'Beauty', icon: '✨' },
  { value: 'consulting', label: 'Consulting', icon: '📊' },
  { value: 'other', label: 'Other', icon: '🌐' },
]

const GOALS = [
  { id: 'grow_followers', label: 'Grow my audience', icon: '📈' },
  { id: 'generate_leads', label: 'Generate leads', icon: '🎯' },
  { id: 'launch_product', label: 'Launch a product', icon: '🚀' },
  { id: 'drive_sales', label: 'Drive more sales', icon: '💰' },
  { id: 'build_brand', label: 'Build brand awareness', icon: '✨' },
  { id: 'retain_customers', label: 'Retain customers', icon: '🤝' },
]

const TONES = [
  { id: 'bold', label: 'Bold & Direct', desc: 'Strong, confident, no fluff' },
  { id: 'friendly', label: 'Friendly & Warm', desc: 'Approachable, conversational' },
  { id: 'premium', label: 'Premium & Polished', desc: 'Sophisticated, authoritative' },
  { id: 'playful', label: 'Playful & Fun', desc: 'Creative, energetic, witty' },
]

const STEPS = ['Welcome', 'Your Brand', 'Your Goal', 'AI is Working', 'Ready']

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()
  const [step, setStep] = useState(0)

  const [brandName, setBrandName] = useState('')
  const [industry, setIndustry] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('')
  const [goal, setGoal] = useState('')
  const [strategy, setStrategy] = useState<any>(null)

  const displayName = user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    fetch('/api/workspaces', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) router.push('/dashboard')
      })
      .catch(() => {})
  }, [isAuthenticated, authHeader, router])

  const handleFinishSetup = async () => {
    setStep(3)
    const token = authHeader()
    const name = brandName.trim() || 'My Brand'
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()

    try {
      await fetch('/api/workspaces', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, description: industry }),
      })
      await fetch('/api/brand', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: name,
          industry,
          targetAudience: audience,
          toneKeywords: tone ? [tone] : ['professional'],
        }),
      }).catch(() => {})
      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, timeframe: '30', platform: 'multi', budget: 'bootstrap' }),
      })
      const data = await res.json()
      if (data.strategy) setStrategy(data.strategy)
    } catch {
      // fail silently
    }
    setStep(4)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-[#FF9500] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center px-4 py-10"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,149,0,0.12), transparent)' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: '#FF9500' }}>
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 7H21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="font-bold text-white text-lg tracking-tight">Nexus</span>
      </div>

      {/* Progress bar */}
      {step > 0 && step < 4 && (
        <div className="w-full max-w-md mb-8">
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Step {step} of 3</span>
            <span>{STEPS[step]}</span>
          </div>
          <div className="h-1 rounded-full bg-[#1a1a25]">
            <div className="h-full rounded-full bg-[#FF9500] transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="w-full max-w-md">

        {/* STEP 0 — WELCOME */}
        {step === 0 && (
          <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d18] p-8 text-center"
            style={{ boxShadow: '0 0 60px rgba(255,149,0,0.08)' }}>
            <div className="w-16 h-16 rounded-2xl bg-[#FF9500]/10 border border-[#FF9500]/20 flex items-center justify-center mx-auto mb-5 text-3xl">
              👋
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome, {displayName}</h1>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              You are about to get a full AI marketing team — strategy, campaigns, calendar, and publishing — all in one place.
              Takes 60 seconds to set up.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { icon: '🧠', label: 'AI Strategy' },
                { icon: '📅', label: 'Auto Calendar' },
                { icon: '📤', label: 'Auto Publish' },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl bg-[#111119] border border-[#1e1e2e] text-center">
                  <div className="text-xl mb-1">{f.icon}</div>
                  <div className="text-xs font-semibold text-gray-300">{f.label}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep(1)}
              className="w-full py-3.5 bg-[#FF9500] hover:bg-[#5558e8] text-white font-bold rounded-xl transition-all text-sm"
              style={{ boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}>
              Build My Marketing OS →
            </button>
          </div>
        )}

        {/* STEP 1 — BRAND */}
        {step === 1 && (
          <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d18] p-8"
            style={{ boxShadow: '0 0 60px rgba(255,149,0,0.06)' }}>
            <h2 className="text-xl font-bold text-white mb-1">Tell us about your brand</h2>
            <p className="text-gray-500 text-sm mb-6">This trains the AI on your specific business.</p>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Brand / Business Name</label>
                <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)}
                  placeholder="e.g. My Brand, Acme Co."
                  className="w-full px-4 py-3 rounded-xl bg-[#111119] border border-[#1e1e2e] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#FF9500]/50 transition-all"
                  autoFocus />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Industry</label>
                <div className="grid grid-cols-3 gap-2">
                  {INDUSTRIES.map(ind => (
                    <button key={ind.value} onClick={() => setIndustry(ind.value)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        industry === ind.value
                          ? 'border-[#FF9500] bg-[#FF9500]/10 text-white'
                          : 'border-[#1e1e2e] bg-[#111119] text-gray-400 hover:border-[#2e2e3e]'
                      }`}>
                      <div className="text-lg mb-0.5">{ind.icon}</div>
                      <div className="text-[10px] font-semibold leading-tight">{ind.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  Target Audience <span className="text-gray-700 normal-case font-normal">(optional)</span>
                </label>
                <input type="text" value={audience} onChange={e => setAudience(e.target.value)}
                  placeholder="e.g. Women 25-40 interested in fitness"
                  className="w-full px-4 py-3 rounded-xl bg-[#111119] border border-[#1e1e2e] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#FF9500]/50 transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Brand Tone</label>
                <div className="grid grid-cols-2 gap-2">
                  {TONES.map(t => (
                    <button key={t.id} onClick={() => setTone(t.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        tone === t.id ? 'border-[#FF9500] bg-[#FF9500]/10' : 'border-[#1e1e2e] bg-[#111119] hover:border-[#2e2e3e]'
                      }`}>
                      <div className="text-xs font-bold text-white">{t.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!brandName.trim() || !industry}
              className="w-full py-3.5 mt-6 bg-[#FF9500] hover:bg-[#5558e8] text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Continue →
            </button>
          </div>
        )}

        {/* STEP 2 — GOAL */}
        {step === 2 && (
          <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d18] p-8"
            style={{ boxShadow: '0 0 60px rgba(255,149,0,0.06)' }}>
            <h2 className="text-xl font-bold text-white mb-1">What is your #1 goal right now?</h2>
            <p className="text-gray-500 text-sm mb-6">We will build your first 30-day strategy around this.</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {GOALS.map(g => (
                <button key={g.id} onClick={() => setGoal(g.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    goal === g.id ? 'border-[#FF9500] bg-[#FF9500]/10' : 'border-[#1e1e2e] bg-[#111119] hover:border-[#2e2e3e]'
                  }`}>
                  <div className="text-xl mb-1.5">{g.icon}</div>
                  <div className="text-xs font-semibold text-white leading-tight">{g.label}</div>
                </button>
              ))}
            </div>
            <button onClick={handleFinishSetup} disabled={!goal}
              className="w-full py-3.5 bg-[#FF9500] hover:bg-[#5558e8] text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: goal ? '0 0 24px rgba(99,102,241,0.3)' : 'none' }}>
              {goal ? 'Generate My Strategy →' : 'Select a goal to continue'}
            </button>
          </div>
        )}

        {/* STEP 3 — GENERATING */}
        {step === 3 && (
          <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d18] p-8 text-center"
            style={{ boxShadow: '0 0 60px rgba(255,149,0,0.08)' }}>
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 w-16 h-16 border-2 border-[#FF9500]/20 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-[#FF9500] border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🧠</div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Building your strategy...</h2>
            <p className="text-gray-500 text-sm mb-6">Training the AI on your brand and generating your 30-day plan.</p>
            <div className="space-y-2 text-left max-w-xs mx-auto">
              {['Setting up your workspace', 'Learning your brand voice', 'Mapping your audience', 'Creating 30-day strategy'].map((s, i) => (
                <div key={s} className="flex items-center gap-3 text-sm text-gray-500 animate-pulse"
                  style={{ animationDelay: `${i * 0.4}s` }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF9500] shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 — DONE */}
        {step === 4 && (
          <div className="rounded-2xl border border-[#FF9500]/20 bg-[#0d0d18] overflow-hidden"
            style={{ boxShadow: '0 0 60px rgba(255,149,0,0.12)' }}>
            <div className="p-6 border-b border-[#1e1e2e]"
              style={{ background: 'linear-gradient(135deg, rgba(255,149,0,0.08), transparent)' }}>
              <div className="text-2xl mb-2">🎉</div>
              <h2 className="text-xl font-bold text-white mb-1">Your marketing OS is ready</h2>
              <p className="text-gray-400 text-sm">{strategy?.title || 'Your 30-day strategy has been created.'}</p>
            </div>
            {strategy?.quickWins?.length > 0 && (
              <div className="p-5 border-b border-[#1e1e2e]">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">Quick Wins — Start Today</div>
                <div className="space-y-2">
                  {strategy.quickWins.slice(0, 3).map((win: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-[#FF9500] shrink-0 mt-0.5">→</span>
                      <span>{win}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="p-5 border-b border-[#1e1e2e]">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">What is waiting for you</div>
              <div className="space-y-2.5">
                {[
                  { icon: '📅', label: 'Your 30-day content calendar' },
                  { icon: '🎯', label: 'Full campaign strategy breakdown' },
                  { icon: '⚡', label: 'AI campaign generator' },
                  { icon: '📊', label: 'Analytics dashboard' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 text-sm text-gray-300">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 space-y-2">
              <button onClick={() => router.push('/strategy')}
                className="w-full py-3 bg-[#FF9500] hover:bg-[#5558e8] text-white font-bold rounded-xl transition-all text-sm"
                style={{ boxShadow: '0 0 20px rgba(255,149,0,0.20)' }}>
                View My Full Strategy →
              </button>
              <button onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 border border-[#1e1e2e] hover:border-[#2e2e3e] text-gray-400 hover:text-white rounded-xl transition-all text-sm">
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
