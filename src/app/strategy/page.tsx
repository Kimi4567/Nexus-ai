'use client'

import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'
import AppShell from '@/components/AppShell'

const GOALS = [
  { id: 'grow_followers', label: 'Grow Followers', icon: '📈', desc: 'Build a larger, engaged audience' },
  { id: 'generate_leads', label: 'Generate Leads', icon: '🎯', desc: 'Capture emails and inquiries' },
  { id: 'launch_product', label: 'Launch Product', icon: '🚀', desc: 'Announce and sell a new product' },
  { id: 'drive_sales', label: 'Drive Sales', icon: '💰', desc: 'Convert audience into customers' },
  { id: 'build_brand', label: 'Build Brand Awareness', icon: '✨', desc: 'Establish authority and recognition' },
  { id: 'retain_customers', label: 'Retain Customers', icon: '🤝', desc: 'Strengthen loyalty and reduce churn' },
]

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'multi', label: 'Multi-Platform', icon: '🌐' },
]

const BUDGETS = [
  { id: 'bootstrap', label: 'Bootstrap', desc: 'Organic only, no ad spend' },
  { id: 'small', label: 'Small', desc: '$100–500/month in ads' },
  { id: 'medium', label: 'Medium', desc: '$500–2000/month in ads' },
  { id: 'growth', label: 'Growth', desc: '$2000+/month in ads' },
]

type Strategy = {
  title: string
  summary: string
  goal: string
  timeframe: string
  themes: Array<{ week: number; title: string; focus: string; contentIdeas: string[] }>
  pillars: Array<{ name: string; description: string; percentage: number; examples: string[] }>
  kpis: Array<{ metric: string; target: string; how: string }>
  tactics: Array<{ platform: string; frequency: string; bestTime: string; contentType: string; tip: string }>
  weeklyPlan: Array<{ week: number; theme: string; posts: Array<{ day: string; platform: string; type: string; hook: string; caption: string }> }>
  quickWins: string[]
  budget: { organic: string; paid: string; tools: string[] }
}

export default function StrategyPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [step, setStep] = useState<'setup' | 'generating' | 'result'>('setup')
  const [goal, setGoal] = useState('')
  const [timeframe, setTimeframe] = useState('30')
  const [platform, setPlatform] = useState('multi')
  const [budget, setBudget] = useState('bootstrap')
  const [strategy, setStrategy] = useState<Strategy | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1)

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  const handleGenerate = async () => {
    if (!goal) return
    setStep('generating')

    try {
      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, timeframe, platform, budget }),
      })
      const data = await res.json()
      if (data.strategy) {
        setStrategy(data.strategy)
        setStep('result')
      } else {
        setStep('setup')
        alert('Failed to generate strategy. Please try again.')
      }
    } catch {
      setStep('setup')
      alert('Failed to generate strategy. Please try again.')
    }
  }

  const pillarsColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-10 page-enter">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <span>Nexus</span>
            <span>/</span>
            <span className="text-gray-300">Strategy</span>
          </div>
          <h1 className="text-3xl font-bold mb-1">AI Strategy Generator</h1>
          <p className="text-gray-400">Your 30–90 day marketing roadmap, built by AI around your goals.</p>
        </div>

        {/* SETUP */}
        {step === 'setup' && (
          <div className="space-y-8">

            {/* Goal */}
            <div>
              <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">What's your primary goal?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {GOALS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      goal === g.id
                        ? 'border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(99,102,241,0.3)]'
                        : 'border-[#1e1e2e] bg-[#111119] hover:border-[#2e2e3e]'
                    }`}
                  >
                    <div className="text-2xl mb-2">{g.icon}</div>
                    <div className="font-semibold text-sm text-white mb-0.5">{g.label}</div>
                    <div className="text-xs text-gray-500">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe */}
            <div>
              <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Timeframe</h2>
              <div className="flex gap-3">
                {[
                  { value: '30', label: '30 Days', sub: 'Sprint' },
                  { value: '60', label: '60 Days', sub: 'Growth' },
                  { value: '90', label: '90 Days', sub: 'Scale' },
                ].map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTimeframe(t.value)}
                    className={`flex-1 py-4 rounded-xl border text-center transition-all ${
                      timeframe === t.value
                        ? 'border-accent bg-accent/10'
                        : 'border-[#1e1e2e] bg-[#111119] hover:border-[#2e2e3e]'
                    }`}
                  >
                    <div className="font-bold text-lg text-white">{t.label}</div>
                    <div className="text-xs text-gray-500">{t.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Primary Platform</h2>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      platform === p.id
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-[#1e1e2e] bg-[#111119] text-gray-400 hover:border-[#2e2e3e] hover:text-white'
                    }`}
                  >
                    <span>{p.icon}</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div>
              <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Budget Level</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BUDGETS.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setBudget(b.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      budget === b.id
                        ? 'border-accent bg-accent/10'
                        : 'border-[#1e1e2e] bg-[#111119] hover:border-[#2e2e3e]'
                    }`}
                  >
                    <div className="font-semibold text-sm text-white">{b.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!goal}
              className="w-full py-4 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_32px_rgba(99,102,241,0.25)]"
            >
              {goal ? `Generate ${timeframe}-Day Strategy →` : 'Select a goal to continue'}
            </button>
          </div>
        )}

        {/* GENERATING */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-accent/20 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Building Your Strategy</h2>
              <p className="text-gray-400 text-sm">Analyzing your brand, market, and goal...<br />This takes about 15 seconds.</p>
            </div>
            <div className="flex gap-2 mt-4">
              {['Researching market', 'Mapping content pillars', 'Building calendar', 'Finalizing KPIs'].map((s, i) => (
                <div key={s} className="text-xs px-3 py-1.5 rounded-full border border-[#1e1e2e] text-gray-500 animate-pulse"
                  style={{ animationDelay: `${i * 0.3}s` }}>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESULT */}
        {step === 'result' && strategy && (
          <div className="space-y-6">

            {/* Strategy header */}
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-6"
              style={{ boxShadow: '0 0 40px rgba(99,102,241,0.08)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-accent mb-2">{strategy.timeframe} Strategy</div>
                  <h2 className="text-2xl font-bold text-white mb-2">{strategy.title}</h2>
                  <p className="text-gray-400 text-sm leading-relaxed">{strategy.summary}</p>
                </div>
                <button
                  onClick={() => { setStep('setup'); setStrategy(null) }}
                  className="shrink-0 px-4 py-2 text-sm border border-[#1e1e2e] rounded-lg text-gray-400 hover:text-white hover:border-[#2e2e3e] transition-all"
                >
                  New Strategy
                </button>
              </div>

              {/* Quick wins */}
              {strategy.quickWins?.length > 0 && (
                <div className="mt-5 pt-5 border-t border-accent/10">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Quick Wins — Do These Today</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {strategy.quickWins.map((win, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-accent mt-0.5">→</span> {win}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[#111119] border border-[#1e1e2e] rounded-xl w-fit">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'calendar', label: 'Content Calendar' },
                { id: 'tactics', label: 'Platform Tactics' },
                { id: 'kpis', label: 'KPIs' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-accent text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Content Pillars */}
                <div className="rounded-xl border border-[#1e1e2e] bg-[#111119] p-5">
                  <h3 className="font-bold mb-4 text-white">Content Pillars</h3>
                  <div className="space-y-4">
                    {strategy.pillars?.map((pillar, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-white">{pillar.name}</span>
                          <span className="text-xs font-bold" style={{ color: pillarsColors[i % 5] }}>{pillar.percentage}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1e1e2e] overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pillar.percentage}%`, background: pillarsColors[i % 5] }} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">{pillar.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weekly Themes */}
                <div className="rounded-xl border border-[#1e1e2e] bg-[#111119] p-5">
                  <h3 className="font-bold mb-4 text-white">Weekly Themes</h3>
                  <div className="space-y-3">
                    {strategy.themes?.map((theme, i) => (
                      <div key={i} className="p-3 rounded-lg bg-[#0d0d15] border border-[#1a1a25]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                            style={{ background: `${pillarsColors[i % 5]}20`, color: pillarsColors[i % 5] }}>
                            Week {theme.week}
                          </span>
                          <span className="text-sm font-semibold text-white">{theme.title}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{theme.focus}</p>
                        <div className="flex flex-wrap gap-1">
                          {theme.contentIdeas?.slice(0, 2).map((idea, j) => (
                            <span key={j} className="text-xs px-2 py-0.5 rounded border border-[#1e1e2e] text-gray-400">
                              {idea}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Budget Strategy */}
                {strategy.budget && (
                  <div className="md:col-span-2 rounded-xl border border-[#1e1e2e] bg-[#111119] p-5">
                    <h3 className="font-bold mb-4 text-white">Budget Strategy</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-green-400 mb-2">Organic</div>
                        <p className="text-sm text-gray-300">{strategy.budget.organic}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Paid / Boost</div>
                        <p className="text-sm text-gray-300">{strategy.budget.paid}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">Recommended Tools</div>
                        <div className="space-y-1">
                          {strategy.budget.tools?.map((tool, i) => (
                            <div key={i} className="text-sm text-gray-300 flex items-center gap-1.5">
                              <span className="text-accent">✓</span> {tool}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CALENDAR TAB */}
            {activeTab === 'calendar' && (
              <div className="space-y-3">
                {strategy.weeklyPlan?.map((week) => (
                  <div key={week.week} className="rounded-xl border border-[#1e1e2e] bg-[#111119] overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-all"
                      onClick={() => setExpandedWeek(expandedWeek === week.week ? null : week.week)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-accent/15 text-accent">
                          Week {week.week}
                        </span>
                        <span className="font-semibold text-white">{week.theme}</span>
                        <span className="text-xs text-gray-500">{week.posts?.length} posts</span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round"
                        className={`text-gray-500 transition-transform ${expandedWeek === week.week ? 'rotate-180' : ''}`}>
                        <path d="M2 5l5 5 5-5" />
                      </svg>
                    </button>

                    {expandedWeek === week.week && (
                      <div className="border-t border-[#1e1e2e]">
                        <div className="grid grid-cols-1 divide-y divide-[#1a1a25]">
                          {week.posts?.map((post, i) => (
                            <div key={i} className="flex items-start gap-4 p-4">
                              <div className="w-20 shrink-0">
                                <div className="text-xs font-bold text-gray-400">{post.day}</div>
                                <div className="text-xs text-gray-600 mt-0.5">{post.platform}</div>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-[#1e1e2e] text-gray-400 font-medium">
                                    {post.type}
                                  </span>
                                </div>
                                <div className="text-sm font-semibold text-white mb-1">{post.hook}</div>
                                <div className="text-xs text-gray-500 leading-relaxed">{post.caption}</div>
                              </div>
                              <button
                                onClick={() => window.location.href = '/campaign/new'}
                                className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-all"
                              >
                                Create →
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TACTICS TAB */}
            {activeTab === 'tactics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategy.tactics?.map((tactic, i) => (
                  <div key={i} className="rounded-xl border border-[#1e1e2e] bg-[#111119] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: `${pillarsColors[i % 5]}15` }}>
                        📱
                      </div>
                      <h3 className="font-bold text-white">{tactic.platform}</h3>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Frequency', value: tactic.frequency },
                        { label: 'Best Time', value: tactic.bestTime },
                        { label: 'Content Type', value: tactic.contentType },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{item.label}</span>
                          <span className="text-white font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#1a1a25]">
                      <div className="text-xs text-gray-500 mb-1">Pro Tip</div>
                      <p className="text-sm text-gray-300">{tactic.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* KPIS TAB */}
            {activeTab === 'kpis' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategy.kpis?.map((kpi, i) => (
                  <div key={i} className="rounded-xl border border-[#1e1e2e] bg-[#111119] p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-white">{kpi.metric}</h3>
                      <div className="text-xs font-bold px-2.5 py-1 rounded-lg"
                        style={{ background: `${pillarsColors[i % 5]}15`, color: pillarsColors[i % 5] }}>
                        Target
                      </div>
                    </div>
                    <div className="text-2xl font-black mb-2" style={{ color: pillarsColors[i % 5] }}>
                      {kpi.target}
                    </div>
                    <p className="text-xs text-gray-500">{kpi.how}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
