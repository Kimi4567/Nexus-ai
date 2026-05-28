'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const BUSINESS_TYPES = [
  'E-commerce', 'SaaS / Software', 'Restaurant / Food', 'Fitness / Wellness',
  'Real Estate', 'Beauty / Skincare', 'Education / Coaching', 'Consulting',
  'Healthcare', 'Fashion / Apparel', 'Travel / Hospitality', 'Finance',
  'Agency / Marketing', 'Retail', 'Other',
]

const GOALS = [
  { value: 'SALES', label: '💰 Drive Sales', desc: 'Convert browsers into buyers' },
  { value: 'LEADS', label: '🎯 Generate Leads', desc: 'Capture qualified prospects' },
  { value: 'AWARENESS', label: '📣 Brand Awareness', desc: 'Get seen by more people' },
  { value: 'ENGAGEMENT', label: '❤️ Build Community', desc: 'Grow a loyal audience' },
  { value: 'TRAFFIC', label: '🚦 Drive Traffic', desc: 'Send visitors to your site' },
]

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn', YOUTUBE_SHORTS: 'YouTube Shorts',
}

const GENERATION_STEPS = [
  'Analyzing your business…',
  'Building campaign strategy…',
  'Crafting scroll-stopping hooks…',
  'Writing platform-native copy…',
  'Finalizing your results…',
]

export default function DemoPage() {
  const [step, setStep] = useState<'form' | 'loading' | 'results'>('form')
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [goal, setGoal] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Animate loading steps
  useEffect(() => {
    if (step !== 'loading') return
    const interval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev >= GENERATION_STEPS.length - 1) { clearInterval(interval); return prev }
        return prev + 1
      })
    }, 700)
    return () => clearInterval(interval)
  }, [step])

  // Scroll to results
  useEffect(() => {
    if (step === 'results') {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [step])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim() || !businessType || !goal) return

    setStep('loading')
    setLoadingStep(0)
    setError('')

    try {
      const res = await fetch('/api/demo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, businessType, goal }),
      })
      const data = await res.json()

      if (res.status === 429) {
        setError(data.message || 'Daily demo limit reached. Sign up for unlimited access.')
        setStep('form')
        return
      }

      if (!res.ok) {
        setError('Generation failed — please try again.')
        setStep('form')
        return
      }

      setResult(data)
      setStep('results')
    } catch {
      setError('Network error — please check your connection and try again.')
      setStep('form')
    }
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const reset = () => {
    setStep('form')
    setResult(null)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-dark text-white">

      {/* Nav */}
      <div className="border-b border-dark-tertiary bg-dark/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <path d="M7 7L14 21L21 7" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 7H21" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-bold text-sm">Nexus AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition hidden sm:block">Sign in</Link>
            <Link href="/auth/register" className="px-4 py-2 bg-accent text-dark text-sm font-bold rounded-lg hover:bg-accent-light transition">
              Get started free →
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-accent text-xs font-semibold mb-6">
          ✦ Free demo — no account needed
        </div>
        <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-4">
          See what Nexus creates for<br />
          <span className="text-accent">your business in 30 seconds</span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
          Enter your business details. Get a real AI-generated marketing strategy, hooks, and a ready-to-post caption — instantly.
        </p>
      </div>

      {/* Form */}
      {step === 'form' && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-20">
          <form onSubmit={handleGenerate} className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 sm:p-8 space-y-6">

            {/* Company name */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Your company or brand name <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Bloom Skincare, TechVault, FitLife Studio"
                className="w-full bg-dark border border-dark-tertiary rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/60 transition placeholder:text-gray-600"
                required
                maxLength={60}
              />
            </div>

            {/* Business type */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Business type <span className="text-accent">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BUSINESS_TYPES.map(bt => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => setBusinessType(bt)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition border ${
                      businessType === bt
                        ? 'bg-accent/10 border-accent/50 text-accent'
                        : 'bg-dark border-dark-tertiary text-gray-400 hover:border-accent/30 hover:text-white'
                    }`}
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Campaign goal <span className="text-accent">*</span>
              </label>
              <div className="space-y-2">
                {GOALS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGoal(g.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition border ${
                      goal === g.value
                        ? 'bg-accent/10 border-accent/50'
                        : 'bg-dark border-dark-tertiary hover:border-accent/30'
                    }`}
                  >
                    <span className="font-bold text-sm">{g.label}</span>
                    <span className="text-gray-400 text-xs hidden sm:block">{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <span className="mt-0.5">⚠</span>
                <div>
                  <div>{error}</div>
                  {error.includes('limit') && (
                    <Link href="/auth/register" className="text-accent hover:underline font-semibold mt-1 block">
                      Sign up free for unlimited campaigns →
                    </Link>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!companyName.trim() || !businessType || !goal}
              className="w-full py-4 bg-accent text-dark font-black text-base rounded-xl hover:bg-accent-light transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate my campaign strategy →
            </button>

            <p className="text-center text-xs text-gray-600">
              Free · No credit card · 3 demos per day · Results in ~15 seconds
            </p>
          </form>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-20">
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold mb-2">Building your campaign…</h2>
            <p className="text-gray-400 text-sm mb-8">Our AI is crafting strategy and copy for {companyName}</p>
            <div className="space-y-3 text-left max-w-sm mx-auto">
              {GENERATION_STEPS.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  i < loadingStep ? 'text-gray-600' : i === loadingStep ? 'text-accent' : 'text-gray-700'
                }`}>
                  <span className="flex-shrink-0">
                    {i < loadingStep ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="#444" strokeWidth="1.5"/>
                        <path d="M5 8l2 2 4-4" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : i === loadingStep ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="#FF9500" strokeWidth="1.5"/>
                        <circle cx="8" cy="8" r="3" fill="#FF9500" className="animate-pulse"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="#222" strokeWidth="1.5"/>
                      </svg>
                    )}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom CTA bar — results only */}
      {step === 'results' && result && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-accent/20 bg-dark/95 backdrop-blur-xl px-4 py-3 sm:py-3.5">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gray-500 leading-none mb-0.5">
                🔥 <span className="text-white font-semibold">500+ marketers</span> already using Nexus
              </div>
              <div className="text-[12px] text-gray-400 truncate">3 full campaigns free — no credit card</div>
            </div>
            <Link
              href={`/auth/register?demo=1&business=${encodeURIComponent(result.companyName)}&type=${encodeURIComponent(result.businessType)}&goal=${result.goal}`}
              className="flex-shrink-0 px-5 py-2.5 bg-accent text-dark font-black rounded-xl hover:bg-accent-light transition text-[13px] whitespace-nowrap"
            >
              Get full campaign free →
            </Link>
          </div>
        </div>
      )}

      {/* Results */}
      {step === 'results' && result && (
        <div ref={resultsRef} className="max-w-4xl mx-auto px-4 sm:px-6 pb-28 space-y-6">

          {/* Results header */}
          <div className="bg-gradient-to-r from-accent/15 via-accent/5 to-transparent border border-accent/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-accent text-sm font-semibold mb-2">
              <span>✦</span> AI Campaign Preview for <strong>{result.companyName}</strong>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
              <h2 className="text-2xl font-bold">Your marketing strategy is ready</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                500+ marketers trust Nexus
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              Best platform: <span className="text-white font-semibold">{PLATFORM_LABELS[result.platform] || result.platform}</span>
              {result.estimatedReach && <> · Estimated reach: <span className="text-white font-semibold">{result.estimatedReach}</span></>}
            </p>
          </div>

          {/* Compact upgrade prompt — above the fold */}
          <div className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-dark-secondary border border-accent/25 rounded-2xl">
            <div className="flex-1 text-center sm:text-left">
              <div className="text-sm font-bold text-white mb-0.5">This is a preview — your full campaign has 5x more</div>
              <div className="text-xs text-gray-500">Full scripts · 30-day calendar · PDF export · Brand memory</div>
            </div>
            <Link
              href={`/auth/register?demo=1&business=${encodeURIComponent(result.companyName)}&type=${encodeURIComponent(result.businessType)}&goal=${result.goal}`}
              className="flex-shrink-0 w-full sm:w-auto px-5 py-2.5 text-center bg-accent text-dark font-black rounded-xl hover:bg-accent-light transition text-sm"
            >
              Unlock full campaign — free →
            </Link>
          </div>

          {/* Strategy */}
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">🧠 Campaign Strategy</h3>
              <button
                onClick={() => copy(result.strategy, 'strategy')}
                className="text-xs text-gray-500 hover:text-accent transition flex items-center gap-1"
              >
                {copied === 'strategy' ? '✓ Copied' : '⎘ Copy'}
              </button>
            </div>
            <div className="bg-accent/5 border border-accent/15 rounded-xl p-4">
              <p className="text-gray-200 leading-relaxed text-sm">{result.strategy}</p>
            </div>
          </div>

          {/* Hooks */}
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">⚡ 3 Scroll-Stopping Hooks</h3>
            <div className="space-y-3">
              {(result.hooks || []).map((hook: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-dark rounded-xl border border-dark-tertiary group hover:border-accent/30 transition">
                  <span className="text-accent font-black text-lg leading-none mt-0.5">{i + 1}</span>
                  <p className="text-gray-200 text-sm leading-relaxed flex-1 italic">"{hook.replace(/^["']|["']$/g, '')}"</p>
                  <button
                    onClick={() => copy(hook, `hook-${i}`)}
                    className="text-xs text-gray-600 hover:text-accent transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    {copied === `hook-${i}` ? '✓' : '⎘'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Caption */}
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">📝 Ready-to-Post Caption</h3>
              <button
                onClick={() => copy(result.caption, 'caption')}
                className="text-xs px-3 py-1.5 bg-accent/10 border border-accent/20 text-accent rounded-lg hover:bg-accent hover:text-dark transition font-semibold"
              >
                {copied === 'caption' ? '✓ Copied!' : '⎘ Copy caption'}
              </button>
            </div>
            <div className="bg-dark rounded-xl p-4 border border-dark-tertiary">
              <p className="text-gray-200 text-sm leading-relaxed">{result.caption}</p>
            </div>
          </div>

          {/* CTA preview */}
          {result.cta && (
            <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex-shrink-0">CTA</span>
              <p className="text-amber-300 font-semibold text-sm">{result.cta}</p>
              <button
                onClick={() => copy(result.cta, 'cta')}
                className="text-xs text-gray-500 hover:text-accent transition ml-auto flex-shrink-0"
              >
                {copied === 'cta' ? '✓' : '⎘'}
              </button>
            </div>
          )}

          {/* What's locked / upgrade */}
          <div className="bg-dark-secondary border border-accent/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="text-xs font-bold text-accent uppercase tracking-wider mb-3">🔒 Full Campaign — Unlocked with Free Account</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                  '5 complete ad concepts with full scripts',
                  '30-day content calendar',
                  'Platform-native captions for every post',
                  'Exportable PDF campaign report',
                  'Shareable campaign link',
                  'Save to campaign history',
                  'Brand memory — never re-enter details',
                  'Unlimited generations on paid plans',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="text-accent text-xs">→</span> {item}
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/auth/register?demo=1&business=${encodeURIComponent(result.companyName)}&type=${encodeURIComponent(result.businessType)}&goal=${result.goal}`}
                  className="flex-1 py-3.5 text-center bg-accent text-dark font-black rounded-xl hover:bg-accent-light transition text-sm"
                >
                  Get the full campaign — free →
                </Link>
                <button
                  onClick={reset}
                  className="flex-1 py-3.5 border border-dark-tertiary text-gray-400 font-semibold rounded-xl hover:border-accent/40 hover:text-white transition text-sm"
                >
                  Try another business
                </button>
              </div>
              <p className="text-xs text-gray-600 text-center mt-3">No credit card needed · 3 free campaigns included</p>
            </div>
          </div>

          {result.remaining !== undefined && result.remaining > 0 && (
            <p className="text-center text-xs text-gray-600">
              {result.remaining} free demo{result.remaining !== 1 ? 's' : ''} remaining today
            </p>
          )}
        </div>
      )}

      {/* Footer CTA */}
      {step === 'form' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 text-center">
          <p className="text-xs text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-gray-400 hover:text-white transition">Sign in →</Link>
          </p>
        </div>
      )}

    </div>
  )
}
