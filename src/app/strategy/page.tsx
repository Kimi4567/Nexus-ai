'use client'

import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

// ─── Static data (icons + IDs only — labels come from i18n) ───────────────────

const GOALS_DATA = [
  { id: 'grow_followers',   icon: '📈' },
  { id: 'generate_leads',   icon: '🎯' },
  { id: 'launch_product',   icon: '🚀' },
  { id: 'drive_sales',      icon: '💰' },
  { id: 'build_brand',      icon: '✨' },
  { id: 'retain_customers', icon: '🤝' },
]

const PLATFORMS_DATA = [
  { id: 'instagram', icon: '📸', label: 'Instagram' },
  { id: 'facebook',  icon: '👥', label: 'Facebook' },
  { id: 'tiktok',    icon: '🎵', label: 'TikTok' },
  { id: 'snapchat',  icon: '👻', label: 'Snapchat' },
  { id: 'multi',     icon: '🌐' },
]

const BUDGETS_DATA = [
  { id: 'bootstrap' },
  { id: 'small' },
  { id: 'medium' },
  { id: 'growth' },
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

const PILLAR_COLORS = ['#FF9500', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']

export default function StrategyPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { t, dir } = useI18n()
  const sT = t('strategy')

  const [step, setStep]               = useState<'setup' | 'generating' | 'result'>('setup')
  const [goal, setGoal]               = useState('')
  const [timeframe, setTimeframe]     = useState('30')
  const [platform, setPlatform]       = useState('multi')
  const [budget, setBudget]           = useState('bootstrap')
  const [strategy, setStrategy]       = useState<Strategy | null>(null)
  const [activeTab, setActiveTab]     = useState('overview')
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1)
  const [error, setError]             = useState('')

  // ── Localised data arrays ────────────────────────────────────────────────────

  const GOALS = [
    { id: 'grow_followers',   icon: '📈', label: sT?.goalGrowFollowers as string,   desc: sT?.goalGrowFollowersDesc as string },
    { id: 'generate_leads',   icon: '🎯', label: sT?.goalGenerateLeads as string,   desc: sT?.goalGenerateLeadsDesc as string },
    { id: 'launch_product',   icon: '🚀', label: sT?.goalLaunchProduct as string,   desc: sT?.goalLaunchProductDesc as string },
    { id: 'drive_sales',      icon: '💰', label: sT?.goalDriveSales as string,       desc: sT?.goalDriveSalesDesc as string },
    { id: 'build_brand',      icon: '✨', label: sT?.goalBuildBrand as string,       desc: sT?.goalBuildBrandDesc as string },
    { id: 'retain_customers', icon: '🤝', label: sT?.goalRetainCustomers as string, desc: sT?.goalRetainCustomersDesc as string },
  ]

  const PLATFORMS = PLATFORMS_DATA.map(p => ({
    ...p,
    label: p.id === 'multi' ? sT?.platformMulti as string : p.label,
  }))

  const BUDGETS = [
    { id: 'bootstrap', label: sT?.budgetBootstrap as string, desc: sT?.budgetBootstrapDesc as string },
    { id: 'small',     label: sT?.budgetSmall as string,     desc: sT?.budgetSmallDesc as string },
    { id: 'medium',    label: sT?.budgetMedium as string,    desc: sT?.budgetMediumDesc as string },
    { id: 'growth',    label: sT?.budgetGrowth as string,    desc: sT?.budgetGrowthDesc as string },
  ]

  const TIMEFRAMES = [
    { value: '30', label: sT?.time30 as string, sub: sT?.time30sub as string },
    { value: '60', label: sT?.time60 as string, sub: sT?.time60sub as string },
    { value: '90', label: sT?.time90 as string, sub: sT?.time90sub as string },
  ]

  const TABS = [
    { id: 'overview',  label: sT?.tabOverview as string },
    { id: 'calendar',  label: sT?.tabCalendar as string },
    { id: 'tactics',   label: sT?.tabTactics as string },
    { id: 'kpis',      label: sT?.tabKpis as string },
  ]

  const GEN_STEPS = [sT?.genStep1, sT?.genStep2, sT?.genStep3, sT?.genStep4]

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!goal) return
    setStep('generating')
    setError('')

    try {
      const res  = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, timeframe, platform, budget }),
      })
      const data = await res.json()
      if (data.strategy) {
        setStrategy(data.strategy)
        setStep('result')
      } else {
        setError(sT?.errGenerate as string)
        setStep('setup')
      }
    } catch {
      setError(sT?.errNetwork as string)
      setStep('setup')
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 page-enter" dir={dir}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-t3 mb-3">
            <span>Nexus</span>
            <span>/</span>
            <span className="text-t2">{sT?.breadcrumb as string}</span>
          </div>
          <h1 className="text-3xl font-bold mb-1">{sT?.title as string}</h1>
          <p className="text-t2">{sT?.subtitle as string}</p>
        </div>

        {/* ── SETUP ──────────────────────────────────────────────────────── */}
        {step === 'setup' && (
          <div className="space-y-8">

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Goal */}
            <div>
              <h2 className="text-sm font-semibold text-t2 mb-3 uppercase tracking-wider">{sT?.goalSection as string}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {GOALS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`p-4 rounded-xl border text-right transition-all ${
                      goal === g.id
                        ? 'border-accent bg-accent/10'
                        : 'border-dark-tertiary bg-dark-secondary hover:border-accent/30'
                    }`}
                  >
                    <div className="text-2xl mb-2">{g.icon}</div>
                    <div className="font-semibold text-sm text-white mb-0.5">{g.label}</div>
                    <div className="text-xs text-t3">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe */}
            <div>
              <h2 className="text-sm font-semibold text-t2 mb-3 uppercase tracking-wider">{sT?.timeframeSection as string}</h2>
              <div className="flex gap-3">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    className={`flex-1 py-4 rounded-xl border text-center transition-all ${
                      timeframe === tf.value
                        ? 'border-accent bg-accent/10'
                        : 'border-dark-tertiary bg-dark-secondary hover:border-accent/30'
                    }`}
                  >
                    <div className="font-bold text-lg text-white">{tf.label}</div>
                    <div className="text-xs text-t3 mt-0.5">{tf.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <h2 className="text-sm font-semibold text-t2 mb-3 uppercase tracking-wider">{sT?.platformSection as string}</h2>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      platform === p.id
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-dark-tertiary bg-dark-secondary text-t2 hover:border-accent/30 hover:text-white'
                    }`}
                  >
                    <span>{p.icon}</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div>
              <h2 className="text-sm font-semibold text-t2 mb-3 uppercase tracking-wider">{sT?.budgetSection as string}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BUDGETS.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setBudget(b.id)}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      budget === b.id
                        ? 'border-accent bg-accent/10'
                        : 'border-dark-tertiary bg-dark-secondary hover:border-accent/30'
                    }`}
                  >
                    <div className="font-semibold text-sm text-white">{b.label}</div>
                    <div className="text-xs text-t3 mt-0.5">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!goal}
              className="w-full py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-xl text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: goal ? '0 0 32px rgba(255,149,0,0.20)' : 'none' }}
            >
              {goal
                ? (sT?.btnGenerate as string)?.replace('{days}', timeframe)
                : sT?.btnChooseGoal as string}
            </button>
          </div>
        )}

        {/* ── GENERATING ─────────────────────────────────────────────────── */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-accent/20 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">{sT?.generatingTitle as string}</h2>
              <p className="text-t2 text-sm whitespace-pre-line">{sT?.generatingSubtitle as string}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {GEN_STEPS.map((s, i) => (
                <div
                  key={i}
                  className="text-xs px-3 py-1.5 rounded-full border border-dark-tertiary text-t3 animate-pulse"
                  style={{ animationDelay: `${i * 0.3}s` }}
                >
                  {s as string}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULT ─────────────────────────────────────────────────────── */}
        {step === 'result' && strategy && (
          <div className="space-y-6">

            {/* Strategy header card */}
            <div
              className="rounded-2xl border border-accent/20 bg-accent/5 p-6"
              style={{ boxShadow: '0 0 40px rgba(255,149,0,0.08)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-accent mb-2">
                    {(sT?.strategyLabel as string)?.replace('{timeframe}', strategy.timeframe)}
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{strategy.title}</h2>
                  <p className="text-t2 text-sm leading-relaxed">{strategy.summary}</p>
                </div>
                <button
                  onClick={() => { setStep('setup'); setStrategy(null) }}
                  className="shrink-0 px-4 py-2 text-sm border border-dark-tertiary rounded-lg text-t2 hover:text-white hover:border-accent/30 transition-all"
                >
                  {sT?.btnNewStrategy as string}
                </button>
              </div>

              {/* Quick wins */}
              {strategy.quickWins?.length > 0 && (
                <div className="mt-5 pt-5 border-t border-accent/10">
                  <div className="text-xs font-bold uppercase tracking-wider text-t3 mb-3">
                    {sT?.quickWinsTitle as string}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {strategy.quickWins.map((win, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-t1">
                        <span className="text-accent mt-0.5 shrink-0">←</span>
                        {win}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-dark-secondary border border-dark-tertiary rounded-xl w-fit">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-accent text-white'
                      : 'text-t2 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Content Pillars */}
                <div className="rounded-xl border border-dark-tertiary bg-dark-secondary p-5">
                  <h3 className="font-bold mb-4 text-white">{sT?.pillarsTitle as string}</h3>
                  <div className="space-y-4">
                    {strategy.pillars?.map((pillar, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-white">{pillar.name}</span>
                          <span className="text-xs font-bold" style={{ color: PILLAR_COLORS[i % 5] }}>
                            {pillar.percentage}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-dark-tertiary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pillar.percentage}%`, background: PILLAR_COLORS[i % 5] }}
                          />
                        </div>
                        <p className="text-xs text-t3 mt-1.5">{pillar.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weekly Themes */}
                <div className="rounded-xl border border-dark-tertiary bg-dark-secondary p-5">
                  <h3 className="font-bold mb-4 text-white">{sT?.weekThemesTitle as string}</h3>
                  <div className="space-y-3">
                    {strategy.themes?.map((theme, i) => (
                      <div key={i} className="p-3 rounded-lg bg-dark border border-dark-tertiary">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-md"
                            style={{ background: `${PILLAR_COLORS[i % 5]}20`, color: PILLAR_COLORS[i % 5] }}
                          >
                            {(sT?.weekLabel as string)?.replace('{n}', String(theme.week))}
                          </span>
                          <span className="text-sm font-semibold text-white">{theme.title}</span>
                        </div>
                        <p className="text-xs text-t3 mb-2">{theme.focus}</p>
                        <div className="flex flex-wrap gap-1">
                          {theme.contentIdeas?.slice(0, 2).map((idea, j) => (
                            <span key={j} className="text-xs px-2 py-0.5 rounded border border-dark-tertiary text-t2">
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
                  <div className="md:col-span-2 rounded-xl border border-dark-tertiary bg-dark-secondary p-5">
                    <h3 className="font-bold mb-4 text-white">{sT?.budgetTitle as string}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">{sT?.budgetOrganic as string}</div>
                        <p className="text-sm text-t1">{strategy.budget.organic}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-accent mb-2">{sT?.budgetPaid as string}</div>
                        <p className="text-sm text-t1">{strategy.budget.paid}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-t2 mb-2">{sT?.budgetTools as string}</div>
                        <div className="space-y-1">
                          {strategy.budget.tools?.map((tool, i) => (
                            <div key={i} className="text-sm text-t1 flex items-center gap-1.5">
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

            {/* ── CALENDAR TAB ─────────────────────────────────────────── */}
            {activeTab === 'calendar' && (
              <div className="space-y-3">
                {strategy.weeklyPlan?.map((week) => (
                  <div key={week.week} className="rounded-xl border border-dark-tertiary bg-dark-secondary overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all"
                      onClick={() => setExpandedWeek(expandedWeek === week.week ? null : week.week)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-accent/15 text-accent">
                          {(sT?.weekLabel as string)?.replace('{n}', String(week.week))}
                        </span>
                        <span className="font-semibold text-white">{week.theme}</span>
                        <span className="text-xs text-t3">
                          {(sT?.weekPostCount as string)?.replace('{n}', String(week.posts?.length ?? 0))}
                        </span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round"
                        className={`text-t3 transition-transform ${expandedWeek === week.week ? 'rotate-180' : ''}`}>
                        <path d="M2 5l5 5 5-5" />
                      </svg>
                    </button>

                    {expandedWeek === week.week && (
                      <div className="border-t border-dark-tertiary divide-y divide-dark-tertiary">
                        {week.posts?.map((post, i) => (
                          <div key={i} className="flex items-start gap-4 p-4">
                            <div className="w-20 shrink-0 text-right">
                              <div className="text-xs font-bold text-t2">{post.day}</div>
                              <div className="text-xs text-t3 mt-0.5">{post.platform}</div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-dark-tertiary text-t2 font-medium">
                                  {post.type}
                                </span>
                              </div>
                              <div className="text-sm font-semibold text-white mb-1">{post.hook}</div>
                              <div className="text-xs text-t3 leading-relaxed">{post.caption}</div>
                            </div>
                            <a
                              href="/campaigns/new"
                              className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-all"
                            >
                              {sT?.btnCreate as string}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── TACTICS TAB ──────────────────────────────────────────── */}
            {activeTab === 'tactics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategy.tactics?.map((tactic, i) => (
                  <div key={i} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: `${PILLAR_COLORS[i % 5]}15` }}
                      >
                        📱
                      </div>
                      <h3 className="font-bold text-white">{tactic.platform}</h3>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: sT?.tacticFreq as string,        value: tactic.frequency },
                        { label: sT?.tacticBestTime as string,    value: tactic.bestTime },
                        { label: sT?.tacticContentType as string, value: tactic.contentType },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between text-sm">
                          <span className="text-t3">{item.label}</span>
                          <span className="text-white font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-dark-tertiary">
                      <div className="text-xs text-t3 mb-1">{sT?.tacticTip as string}</div>
                      <p className="text-sm text-t1">{tactic.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── KPIS TAB ─────────────────────────────────────────────── */}
            {activeTab === 'kpis' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategy.kpis?.map((kpi, i) => (
                  <div key={i} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-white">{kpi.metric}</h3>
                      <div
                        className="text-xs font-bold px-2.5 py-1 rounded-lg"
                        style={{ background: `${PILLAR_COLORS[i % 5]}15`, color: PILLAR_COLORS[i % 5] }}
                      >
                        {sT?.kpiTarget as string}
                      </div>
                    </div>
                    <div
                      className="text-2xl font-black mb-2"
                      style={{ color: PILLAR_COLORS[i % 5] }}
                    >
                      {kpi.target}
                    </div>
                    <p className="text-xs text-t3">{kpi.how}</p>
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
