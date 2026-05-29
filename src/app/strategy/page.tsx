'use client'

import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'
import AppShell from '@/components/AppShell'

const GOALS = [
  { id: 'grow_followers',   label: 'زيادة المتابعين',       icon: '📈', desc: 'بناء جمهور أكبر ومتفاعل' },
  { id: 'generate_leads',   label: 'توليد عملاء محتملين',            icon: '🎯', desc: 'جمع الإيميلات والاستفسارات' },
  { id: 'launch_product',   label: 'إطلاق منتج جديد',       icon: '🚀', desc: 'الإعلان عن منتج وبيعه' },
  { id: 'drive_sales',      label: 'زيادة المبيعات',         icon: '💰', desc: 'تحويل الجمهور لعملاء' },
  { id: 'build_brand',      label: 'بناء الوعي بالعلامة',   icon: '✨', desc: 'ترسيخ السلطة والتميز' },
  { id: 'retain_customers', label: 'الاحتفاظ بالعملاء',     icon: '🤝', desc: 'تعزيز الولاء وتقليل الفقد' },
]

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook',  label: 'Facebook',  icon: '👥' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { id: 'snapchat',  label: 'Snapchat',  icon: '👻' },
  { id: 'multi',     label: 'متعدد المنصات', icon: '🌐' },
]

const BUDGETS = [
  { id: 'bootstrap', label: 'مجاني',      desc: 'عضوي بالكامل، بلا إنفاق إعلاني' },
  { id: 'small',     label: 'صغير',       desc: '500–2,000 ريال / شهر' },
  { id: 'medium',    label: 'متوسط',      desc: '2,000–8,000 ريال / شهر' },
  { id: 'growth',    label: 'نمو',        desc: '+8,000 ريال / شهر' },
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
  const [step, setStep]               = useState<'setup' | 'generating' | 'result'>('setup')
  const [goal, setGoal]               = useState('')
  const [timeframe, setTimeframe]     = useState('30')
  const [platform, setPlatform]       = useState('multi')
  const [budget, setBudget]           = useState('bootstrap')
  const [strategy, setStrategy]       = useState<Strategy | null>(null)
  const [activeTab, setActiveTab]     = useState('overview')
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1)
  const [error, setError]             = useState('')

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

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
        setError('فشل في توليد الاستراتيجية. حاول مرة أخرى.')
        setStep('setup')
      }
    } catch {
      setError('حدث خطأ. تأكد من الاتصال وحاول مرة أخرى.')
      setStep('setup')
    }
  }

  const TABS = [
    { id: 'overview',  label: 'نظرة عامة' },
    { id: 'calendar',  label: 'تقويم المحتوى' },
    { id: 'tactics',   label: 'تكتيكات المنصات' },
    { id: 'kpis',      label: 'مؤشرات الأداء' },
  ]

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 page-enter" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-t3 mb-3">
            <span>Nexus</span>
            <span>/</span>
            <span className="text-t2">الاستراتيجية</span>
          </div>
          <h1 className="text-3xl font-bold mb-1">مولّد الاستراتيجية بالـ AI</h1>
          <p className="text-t2">خارطة طريق تسويقية لـ 30–90 يوماً، مبنية بالـ AI حول أهدافك.</p>
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
              <h2 className="text-sm font-semibold text-t2 mb-3 uppercase tracking-wider">ما هو هدفك الرئيسي؟</h2>
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
              <h2 className="text-sm font-semibold text-t2 mb-3 uppercase tracking-wider">المدة الزمنية</h2>
              <div className="flex gap-3">
                {[
                  { value: '30', label: '30 يوماً', sub: 'سريع' },
                  { value: '60', label: '60 يوماً', sub: 'نمو'  },
                  { value: '90', label: '90 يوماً', sub: 'توسع' },
                ].map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTimeframe(t.value)}
                    className={`flex-1 py-4 rounded-xl border text-center transition-all ${
                      timeframe === t.value
                        ? 'border-accent bg-accent/10'
                        : 'border-dark-tertiary bg-dark-secondary hover:border-accent/30'
                    }`}
                  >
                    <div className="font-bold text-lg text-white">{t.label}</div>
                    <div className="text-xs text-t3 mt-0.5">{t.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <h2 className="text-sm font-semibold text-t2 mb-3 uppercase tracking-wider">المنصة الرئيسية</h2>
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
              <h2 className="text-sm font-semibold text-t2 mb-3 uppercase tracking-wider">مستوى الميزانية</h2>
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
                ? `ولّد استراتيجية ${timeframe} يوماً ←`
                : 'اختر هدفاً للمتابعة'}
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
              <h2 className="text-xl font-bold mb-2">جاري بناء الاستراتيجية...</h2>
              <p className="text-t2 text-sm">تحليل علامتك والسوق وهدفك...<br />يستغرق حوالي 15 ثانية.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {['بحث السوق', 'تحديد ركائز المحتوى', 'بناء التقويم', 'تحديد مؤشرات الأداء'].map((s, i) => (
                <div
                  key={s}
                  className="text-xs px-3 py-1.5 rounded-full border border-dark-tertiary text-t3 animate-pulse"
                  style={{ animationDelay: `${i * 0.3}s` }}
                >
                  {s}
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
                    استراتيجية {strategy.timeframe}
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{strategy.title}</h2>
                  <p className="text-t2 text-sm leading-relaxed">{strategy.summary}</p>
                </div>
                <button
                  onClick={() => { setStep('setup'); setStrategy(null) }}
                  className="shrink-0 px-4 py-2 text-sm border border-dark-tertiary rounded-lg text-t2 hover:text-white hover:border-accent/30 transition-all"
                >
                  استراتيجية جديدة
                </button>
              </div>

              {/* Quick wins */}
              {strategy.quickWins?.length > 0 && (
                <div className="mt-5 pt-5 border-t border-accent/10">
                  <div className="text-xs font-bold uppercase tracking-wider text-t3 mb-3">
                    ابدأ اليوم — أسرع نتائج
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
                  <h3 className="font-bold mb-4 text-white">ركائز المحتوى</h3>
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
                  <h3 className="font-bold mb-4 text-white">مواضيع الأسابيع</h3>
                  <div className="space-y-3">
                    {strategy.themes?.map((theme, i) => (
                      <div key={i} className="p-3 rounded-lg bg-dark border border-dark-tertiary">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-md"
                            style={{ background: `${PILLAR_COLORS[i % 5]}20`, color: PILLAR_COLORS[i % 5] }}
                          >
                            الأسبوع {theme.week}
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
                    <h3 className="font-bold mb-4 text-white">استراتيجية الميزانية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">عضوي</div>
                        <p className="text-sm text-t1">{strategy.budget.organic}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-accent mb-2">مدفوع / تعزيز</div>
                        <p className="text-sm text-t1">{strategy.budget.paid}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-t2 mb-2">أدوات موصى بها</div>
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
                          الأسبوع {week.week}
                        </span>
                        <span className="font-semibold text-white">{week.theme}</span>
                        <span className="text-xs text-t3">{week.posts?.length} منشور</span>
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
                              إنشاء ←
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
                        { label: 'التكرار',       value: tactic.frequency },
                        { label: 'أفضل وقت',      value: tactic.bestTime },
                        { label: 'نوع المحتوى',   value: tactic.contentType },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between text-sm">
                          <span className="text-t3">{item.label}</span>
                          <span className="text-white font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-dark-tertiary">
                      <div className="text-xs text-t3 mb-1">نصيحة احترافية</div>
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
                        الهدف
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
