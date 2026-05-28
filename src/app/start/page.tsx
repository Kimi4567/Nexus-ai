'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const BUSINESS_TYPES = [
  'E-commerce / Online store',
  'Restaurant / Café / Food',
  'Fitness / Wellness / Gym',
  'Beauty / Salon / Spa',
  'Real estate',
  'Education / Coaching',
  'Healthcare / Clinic',
  'Technology / SaaS',
  'Fashion / Apparel',
  'Consulting / Agency',
  'Retail / Local business',
  'Other',
]

const BUDGET_OPTIONS = [
  { label: '$500 / mo', value: 500 },
  { label: '$1,000 / mo', value: 1000 },
  { label: '$2,500 / mo', value: 2500 },
  { label: '$5,000 / mo', value: 5000 },
  { label: '$10,000+ / mo', value: 10000 },
]

const GOAL_OPTIONS = [
  { label: 'Get more leads', value: 'leads', icon: '🎯' },
  { label: 'Drive sales', value: 'sales', icon: '💰' },
  { label: 'Grow brand awareness', value: 'awareness', icon: '📢' },
  { label: 'Increase engagement', value: 'engagement', icon: '❤️' },
]

type Step = 'brief' | 'running' | 'done'

interface AgentStatusItem {
  id: string
  label: string
  status: 'waiting' | 'running' | 'done'
  detail?: string
}

export default function StartPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('brief')

  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [monthlyBudget, setMonthlyBudget] = useState<number>(1000)
  const [primaryGoal, setPrimaryGoal] = useState('leads')
  const [error, setError] = useState('')

  const [agentStatuses, setAgentStatuses] = useState<AgentStatusItem[]>([
    { id: 'strategist', label: '🧠 SAGE — Lead Marketing Strategist', status: 'waiting', detail: 'Analyzing your business and building strategy...' },
    { id: 'content',   label: '🎨 MUSE — Creative Director',          status: 'waiting', detail: 'Writing hooks, captions, and content calendar...' },
    { id: 'manager',   label: '⚡ PULSE — Campaign Operations',        status: 'waiting', detail: 'Setting up campaign monitoring...' },
    { id: 'reporting', label: '📊 PRISM — Performance Analyst',        status: 'waiting', detail: 'Configuring weekly performance reports...' },
  ])

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: unknown } }) => {
      if (!data.user) {
        // Save brief intent and redirect to login
        router.push('/login?redirect=/start')
      }
    })

    // Check for pre-filled data from demo flow
    if (typeof window !== 'undefined') {
      const intent = localStorage.getItem('nexus_demo_intent')
      if (intent) {
        try {
          const parsed = JSON.parse(intent)
          if (parsed.company) setCompanyName(parsed.company)
          if (parsed.industry) setBusinessType(parsed.industry)
        } catch {}
      }
    }
  }, [])

  const updateAgentStatus = (id: string, status: AgentStatusItem['status']) => {
    setAgentStatuses(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  const handleSubmit = async () => {
    if (!companyName.trim() || !businessType || !targetAudience.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setStep('running')

    // Animate agents one by one
    updateAgentStatus('strategist', 'running')
    await new Promise(r => setTimeout(r, 800))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ companyName, businessType, targetAudience, monthlyBudget, primaryGoal }),
      })

      // Animate remaining agents while waiting
      setTimeout(() => updateAgentStatus('content', 'running'), 2000)
      setTimeout(() => updateAgentStatus('strategist', 'done'), 4000)
      setTimeout(() => updateAgentStatus('manager', 'running'), 5000)
      setTimeout(() => updateAgentStatus('content', 'done'), 7000)
      setTimeout(() => updateAgentStatus('reporting', 'running'), 8000)
      setTimeout(() => updateAgentStatus('manager', 'done'), 10000)
      setTimeout(() => updateAgentStatus('reporting', 'done'), 12000)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Agent run failed')
      }

      // Clear demo intent
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nexus_demo_intent')
      }

      // Wait for animation to complete
      setTimeout(() => setStep('done'), 13000)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
      setStep('brief')
    }
  }

  if (step === 'running' || step === 'done') {
    return (
      <div className="min-h-screen bg-[#080807] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-[#FF9500] font-semibold text-sm mb-4">
              <span className="w-2 h-2 rounded-full bg-[#FF9500] animate-pulse" />
              Your AI marketing team is being assembled
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {step === 'done' ? 'Your team is ready.' : `Building strategy for ${companyName}...`}
            </h1>
            <p className="text-white/50 text-sm">
              {step === 'done'
                ? 'Your AI marketing agency has your first campaign ready to review.'
                : 'Four AI agents are analyzing your business and building your marketing plan.'}
            </p>
          </div>

          {/* Agent cards */}
          <div className="space-y-3 mb-10">
            {agentStatuses.map((agent) => (
              <div
                key={agent.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                  agent.status === 'done'
                    ? 'border-[#FF9500]/30 bg-[#FF9500]/5'
                    : agent.status === 'running'
                    ? 'border-[#FF9500]/50 bg-[#FF9500]/10'
                    : 'border-white/5 bg-white/2'
                }`}
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {agent.status === 'done' ? (
                    <span className="text-[#FF9500] text-lg">✓</span>
                  ) : agent.status === 'running' ? (
                    <span className="w-5 h-5 rounded-full border-2 border-[#FF9500] border-t-transparent animate-spin block" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-white/20 block" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${
                    agent.status === 'waiting' ? 'text-white/40' : 'text-white'
                  }`}>
                    {agent.label}
                  </div>
                  {agent.status !== 'waiting' && (
                    <div className="text-xs text-white/50 mt-0.5">{agent.detail}</div>
                  )}
                </div>
                <div className="text-xs text-white/30 flex-shrink-0">
                  {agent.status === 'done' ? 'Complete' : agent.status === 'running' ? 'Working...' : 'Waiting'}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {step === 'done' && (
            <div className="text-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-4 bg-[#FF9500] hover:bg-[#FFB340] text-black font-bold rounded-xl text-base transition-colors"
              >
                See your campaign →
              </button>
              <p className="text-white/30 text-xs mt-3">
                Your AI team will monitor and send you daily updates
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080807] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-[#FF9500] font-bold text-xl tracking-tight mb-2">NEXUS</div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Brief your AI marketing team
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Answer 4 questions. Your AI team builds the strategy,
            content, and monitoring — you just approve.
          </p>
        </div>

        <div className="space-y-6">
          {/* Company name */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              What's your company called?
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g., FitFlow Studio"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#FF9500]/50 transition-colors"
            />
          </div>

          {/* Business type */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              What type of business?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BUSINESS_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBusinessType(type)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                    businessType === type
                      ? 'border-[#FF9500] bg-[#FF9500]/10 text-[#FF9500]'
                      : 'border-white/10 bg-white/3 text-white/60 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Target audience */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              Who do you sell to?
            </label>
            <textarea
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              placeholder="e.g., Women aged 25–40 in Dubai who want to lose weight and build confidence. They're busy professionals who tried diets but failed."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#FF9500]/50 transition-colors resize-none"
            />
          </div>

          {/* Goal */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              Primary goal?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setPrimaryGoal(g.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-all ${
                    primaryGoal === g.value
                      ? 'border-[#FF9500] bg-[#FF9500]/10 text-[#FF9500]'
                      : 'border-white/10 bg-white/3 text-white/60 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  <span>{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              Monthly marketing budget?
            </label>
            <div className="flex gap-2 flex-wrap">
              {BUDGET_OPTIONS.map(b => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setMonthlyBudget(b.value)}
                  className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all ${
                    monthlyBudget === b.value
                      ? 'border-[#FF9500] bg-[#FF9500]/10 text-[#FF9500]'
                      : 'border-white/10 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!companyName || !businessType || !targetAudience}
            className="w-full py-4 bg-[#FF9500] hover:bg-[#FFB340] disabled:bg-white/10 disabled:text-white/30 text-black font-bold rounded-xl text-base transition-colors"
          >
            Brief my AI team →
          </button>

          <p className="text-center text-white/30 text-xs">
            Takes about 15 seconds. No credit card required.
          </p>
        </div>
      </div>
    </div>
  )
}
