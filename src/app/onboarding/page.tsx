'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()
  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)
  const [done, setDone] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [industry, setIndustry] = useState('ecommerce')

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    // If user already has workspace, go to dashboard
    const token = authHeader()
    if (!token) return
    fetch('/api/workspaces', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) router.push('/dashboard')
      })
      .catch(() => {})
  }, [isAuthenticated, authHeader, router])

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) return
    setCreating(true)
    const token = authHeader()
    try {
      const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()
      await fetch('/api/workspaces', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName, slug, description: industry }),
      })
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1200)
    } catch {
      // even if it fails, go to dashboard — wizard handles it
      router.push('/dashboard')
    } finally {
      setCreating(false)
    }
  }

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-accent">NEXUS</h1>
          <p className="text-gray-400 mt-2 text-sm">AI Marketing Operating System</p>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">👋</div>
            <h2 className="text-3xl font-bold mb-2">Welcome, {displayName}!</h2>
            <p className="text-gray-400 mb-8">You're about to have an AI marketing team working for you 24/7. Let's set things up — takes 60 seconds.</p>
            <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
              {[
                { icon: '⚡', label: 'AI Strategies' },
                { icon: '🎯', label: 'Ad Concepts' },
                { icon: '📅', label: 'Content Calendars' },
              ].map(f => (
                <div key={f.label} className="bg-dark rounded-xl p-4 border border-dark-tertiary">
                  <div className="text-2xl mb-1">{f.icon}</div>
                  <div className="text-gray-300 font-semibold">{f.label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-lg"
            >
              Get Started →
            </button>
          </div>
        )}

        {/* Step 2: Workspace */}
        {step === 2 && (
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-dark font-bold">2</div>
              <h2 className="text-xl font-bold">Name Your Workspace</h2>
            </div>
            <p className="text-gray-400 text-sm mb-6">This is where all your campaigns live. Use your brand or business name.</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Workspace Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                  placeholder="e.g. My Brand, Acme Co., Studio Name"
                  className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Industry</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'ecommerce', label: 'E-commerce', icon: '🛍️' },
                    { value: 'saas', label: 'SaaS', icon: '💻' },
                    { value: 'agency', label: 'Agency', icon: '🏢' },
                    { value: 'fitness', label: 'Fitness', icon: '💪' },
                    { value: 'food', label: 'Food & Bev', icon: '🍕' },
                    { value: 'other', label: 'Other', icon: '✨' },
                  ].map(ind => (
                    <button
                      key={ind.value}
                      onClick={() => setIndustry(ind.value)}
                      className={`p-3 rounded-xl border-2 text-center transition ${industry === ind.value ? 'border-accent bg-accent/10' : 'border-dark-tertiary bg-dark hover:border-accent/40'}`}
                    >
                      <div className="text-xl">{ind.icon}</div>
                      <div className="text-xs font-semibold mt-1">{ind.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-5 py-3 bg-dark-tertiary rounded-xl text-sm font-semibold hover:bg-dark-tertiary/70 transition">
                ← Back
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={!workspaceName.trim() || creating}
                className="flex-1 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition disabled:opacity-50"
              >
                {done ? '✓ Done! Redirecting...' : creating ? 'Creating...' : 'Launch My Workspace 🚀'}
              </button>
            </div>

            <p className="text-center text-xs text-gray-500 mt-4">
              <Link href="/dashboard" className="hover:text-gray-300 transition">Skip for now →</Link>
            </p>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
          {[1, 2].map(s => (
            <div key={s} className={`w-2 h-2 rounded-full transition ${step === s ? 'bg-accent w-6' : 'bg-dark-tertiary'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
