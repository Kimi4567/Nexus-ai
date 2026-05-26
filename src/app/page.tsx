'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// ── Logo ───────────────────────────────────────────────────────────────
function NexusLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="7" fill="#FF9500" />
      <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7H21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Animated hero product window ───────────────────────────────────────
const INSIGHTS = [
  { type: 'action',  icon: '⚡', msg: '2 campaigns ready to activate' },
  { type: 'success', icon: '🧠', msg: 'Brand voice active — AI using your tone' },
  { type: 'info',    icon: '🎨', msg: 'Visual generation complete — Q3 Launch' },
  { type: 'warning', icon: '📋', msg: 'Summer campaign missing hero asset' },
]

const INSIGHT_STYLE: Record<string, string> = {
  action:  'text-accent  border-accent/15  bg-accent/5',
  success: 'text-emerald-400 border-emerald-500/15 bg-emerald-500/5',
  info:    'text-gray-400 border-[#222] bg-[#111]',
  warning: 'text-amber-400 border-amber-500/15 bg-amber-500/5',
}
const INSIGHT_DOT: Record<string, string> = {
  action: 'bg-accent', success: 'bg-emerald-400',
  info: 'bg-gray-500', warning: 'bg-amber-400',
}

const CAMPAIGNS = [
  { name: 'Q3 Product Launch',     status: 'ACTIVE',     platform: 'IG · TT · LI',  goal: 'Sales' },
  { name: 'Brand Awareness Push',  status: 'DRAFT',      platform: 'LI · FB',        goal: 'Awareness' },
  { name: 'Summer Sale Campaign',  status: 'COMPLETED',  platform: 'IG · TT · FB',   goal: 'Sales' },
]

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400', DRAFT: 'bg-amber-400', COMPLETED: 'bg-blue-400',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active', DRAFT: 'Draft', COMPLETED: 'Done',
}
const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'text-emerald-400', DRAFT: 'text-amber-400', COMPLETED: 'text-blue-400',
}

function HeroProductWindow() {
  const [insight, setInsight] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 200)
    const t2 = setInterval(() => setInsight(i => (i + 1) % INSIGHTS.length), 3500)
    return () => { clearTimeout(t1); clearInterval(t2) }
  }, [])

  const current = INSIGHTS[insight]

  return (
    <div
      className="relative w-full max-w-[480px] rounded-2xl overflow-hidden border border-[#1e1e1e] shadow-2xl"
      style={{
        background: '#0e0e10',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a] bg-[#0a0a0c]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 mx-3 bg-[#151515] rounded-md px-3 py-1 text-[11px] text-gray-600 text-center">
          app.nexus-ai.com/dashboard
        </div>
      </div>

      {/* AI presence bar — rotates */}
      <div
        key={insight}
        className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#181818] text-xs font-medium transition-all duration-300 ${INSIGHT_STYLE[current.type]}`}
      >
        <span className="relative flex-shrink-0 w-1.5 h-1.5">
          <span className={`absolute inset-0 rounded-full ${INSIGHT_DOT[current.type]} animate-ping opacity-60`} />
          <span className={`relative rounded-full w-1.5 h-1.5 block ${INSIGHT_DOT[current.type]}`} />
        </span>
        <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold flex-shrink-0">Nexus AI</span>
        <span className="truncate">{current.icon} {current.msg}</span>
      </div>

      {/* Content area */}
      <div className="p-4 space-y-3">

        {/* Header row */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-white">Recent campaigns</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
        </div>

        {/* Campaign rows */}
        {CAMPAIGNS.map((c, i) => (
          <div
            key={c.name}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#131315] border border-[#1a1a1a] hover:border-[#222] transition-colors"
            style={{ animation: `slideUp 0.3s ease both`, animationDelay: `${i * 80 + 300}ms` }}
          >
            <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-xs flex-shrink-0">
              {i === 0 ? '🚀' : i === 1 ? '📣' : '✅'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-gray-200 truncate">{c.name}</div>
              <div className="text-[10px] text-gray-600">{c.platform}</div>
            </div>
            <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${STATUS_TEXT[c.status]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
              {STATUS_LABEL[c.status]}
            </div>
          </div>
        ))}

        {/* Brand + Visual row */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-[#131315] border border-[#1a1a1a] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Brand Memory</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="text-[11px] font-semibold text-white">Voice active</div>
            <div className="text-[10px] text-gray-600 mt-0.5">AI trained on your tone</div>
          </div>
          <div className="bg-[#131315] border border-[#1a1a1a] rounded-xl p-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">Visual Gen</div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="h-1 flex-1 bg-[#1f1f1f] rounded-full overflow-hidden">
                <div className="h-1 bg-accent rounded-full w-[72%] animate-pulse" />
              </div>
              <span className="text-[10px] text-accent font-semibold">72%</span>
            </div>
            <div className="text-[11px] text-gray-400">Generating hero…</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Capability card ────────────────────────────────────────────────────
function CapCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group p-6 rounded-2xl border border-[#1a1a1a] bg-[#0e0e10] hover:border-[#262626] hover:bg-[#111] transition-all duration-200">
      <div className="w-9 h-9 rounded-xl bg-[#161618] border border-[#1e1e1e] flex items-center justify-center mb-4 text-accent group-hover:border-accent/30 transition-colors">
        {icon}
      </div>
      <div className="text-[13px] font-semibold text-white mb-1.5">{title}</div>
      <div className="text-[12px] text-gray-500 leading-relaxed">{body}</div>
    </div>
  )
}

// ── Plans ──────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter',
    price: '$29',
    desc: 'For solo founders and small brands',
    features: ['50 AI credits / month', '3 campaigns / month', 'Brand memory', 'PDF exports', 'Email support'],
    cta: 'Get started free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$79',
    desc: 'For growing brands that ship daily',
    features: ['200 AI credits / month', 'Unlimited campaigns', 'Social publishing', 'Weekly strategy brief', 'Priority support'],
    cta: 'Start with Pro',
    highlight: true,
  },
  {
    name: 'Agency',
    price: '$199',
    desc: 'For agencies managing multiple clients',
    features: ['Unlimited AI credits', 'Unlimited campaigns', '10 workspaces', 'White-label exports', 'Dedicated support'],
    cta: 'Contact sales',
    highlight: false,
  },
]

// ── Main page ──────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen bg-dark text-white overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#141414] bg-dark/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NexusLogo size={26} />
            <span className="font-bold text-white tracking-tight">Nexus</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-[13px] text-gray-500">
            <a href="#platform" className="hover:text-white transition-colors">Platform</a>
            <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login"
              className="text-[13px] text-gray-400 hover:text-white transition-colors px-3 py-1.5">
              Log in
            </Link>
            <Link href="/auth/register"
              className="text-[13px] px-4 py-1.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Get access
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <div>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-6">
              <span className="w-4 h-px bg-accent" />
              Marketing Operations Infrastructure
            </div>

            <h1 className="text-[52px] font-bold leading-[1.05] tracking-tight text-white mb-6">
              Operate your<br />
              marketing with<br />
              <span style={{ color: '#FF9500' }}>intelligence.</span>
            </h1>

            <p className="text-[16px] text-gray-400 leading-relaxed mb-8 max-w-md">
              Nexus is the operational layer between your brand and your campaigns.
              Strategy, content, visuals, and execution — unified in one intelligent environment.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link href="/auth/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-light transition-colors text-[14px]">
                Start operating
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2.5 7h9M8 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/auth/login"
                className="inline-flex items-center justify-center px-6 py-3 border border-[#1e1e1e] text-gray-300 font-medium rounded-xl hover:border-[#2a2a2a] hover:text-white transition-colors text-[14px]">
                Sign in
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 text-[12px]">
              {[
                { val: '500+', label: 'campaigns created' },
                { val: '< 60s', label: 'average generation' },
                { val: 'Free', label: 'to get started' },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-white font-bold text-[18px] mb-0.5">{s.val}</div>
                  <div className="text-gray-600">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — animated product window */}
          <div className="flex justify-center lg:justify-end">
            <HeroProductWindow />
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ───────────────────────────────────────────── */}
      <div className="border-y border-[#141414] py-5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-[12px] text-gray-600">
          <span className="uppercase tracking-widest font-semibold text-[10px]">Trusted by teams at</span>
          {['E-commerce brands', 'SaaS startups', 'Marketing agencies', 'DTC founders'].map(t => (
            <span key={t} className="text-gray-500 font-medium">{t}</span>
          ))}
        </div>
      </div>

      {/* ── PLATFORM SECTION ────────────────────────────────────── */}
      <section id="platform" className="max-w-7xl mx-auto px-6 py-28">
        <div className="max-w-xl mb-16">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-4">The platform</div>
          <h2 className="text-[36px] font-bold leading-tight tracking-tight mb-4">
            Not a tool. An operating environment.
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            Most AI tools give you content. Nexus gives you infrastructure.
            Every campaign lives in memory. Every decision has context.
            Every output improves your brand over time.
          </p>
        </div>

        {/* 3-column workflow */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              step: '01',
              title: 'Define your brand once',
              body: 'Set your tone, audience, positioning, and objectives. Nexus holds this context across every campaign you ever run.',
              tag: 'Brand Memory',
            },
            {
              step: '02',
              title: 'Launch campaigns with AI',
              body: 'Describe your campaign goal. Nexus generates strategy, hooks, scripts, captions, and a full content calendar — using your brand context.',
              tag: 'AI Generation',
            },
            {
              step: '03',
              title: 'Execute with full visibility',
              body: 'Track campaign health, generate hero visuals, monitor performance, and build an operational record of everything your brand has shipped.',
              tag: 'Execution Layer',
            },
          ].map((item) => (
            <div key={item.step} className="p-7 bg-[#0e0e10] border border-[#1a1a1a] rounded-2xl">
              <div className="text-[11px] font-bold text-accent/40 mb-5 tabular-nums">{item.step}</div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-600 bg-[#141414] px-2 py-1 rounded-full mb-4 uppercase tracking-wider">
                {item.tag}
              </div>
              <h3 className="text-[16px] font-bold text-white mb-2">{item.title}</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CAPABILITIES ────────────────────────────────────────── */}
      <section id="capabilities" className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-3">Capabilities</div>
            <h2 className="text-[32px] font-bold tracking-tight">Everything in one environment</h2>
          </div>
          <p className="text-[13px] text-gray-500 max-w-sm">
            Nexus replaces a fragmented stack of disconnected tools with a single operational system.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CapCard
            title="Campaign Strategy"
            body="Full marketing strategy with positioning, audience segmentation, platform playbook, and content pillars — generated from your brief."
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M2 8h8M2 12h5" strokeLinecap="round" /></svg>}
          />
          <CapCard
            title="Brand Intelligence"
            body="Your tone, audience, and strategic memory persist across every campaign. The AI improves as your brand context grows."
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5" /><path d="M8 5v3l2 2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          />
          <CapCard
            title="Hook & Script Library"
            body="10+ proven hooks and full scripts for every ad concept. Different angles, tones, and formats ready for any platform."
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l4 4-4 4M8.5 12h3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          />
          <CapCard
            title="Visual Generation"
            body="DALL-E 3 powered visuals linked to your campaign strategy. Every image is context-aware, brand-aligned, and permanently stored."
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" /><circle cx="5.5" cy="5.5" r="1.5" /><path d="M1.5 10.5l4-3.5 3 3 2.5-2.5 3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          />
          <CapCard
            title="Content Calendar"
            body="A 30-day execution schedule with content types, formats, posting cadence, and angles for every platform you're running."
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="3" width="13" height="11" rx="2" /><path d="M5 1v4M11 1v4M1.5 7h13" strokeLinecap="round" /></svg>}
          />
          <CapCard
            title="AI Recommendations"
            body="Nexus surfaces operational insights automatically — missing assets, inactive campaigns, brand gaps, and content opportunities."
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1.5L9.5 5.5H14l-3.5 2.5 1.5 4L8 9.5 4 12l1.5-4L2 5.5h4.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          />
        </div>
      </section>

      {/* ── AI PRESENCE SHOWCASE ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-[#0e0e10] border border-[#1a1a1a] rounded-3xl p-10 md:p-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-4">AI Presence</div>
              <h2 className="text-[30px] font-bold tracking-tight mb-4">
                The system is always watching. Always recommending.
              </h2>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-6">
                Nexus doesn&apos;t wait for you to ask. It surfaces insights from your real workspace data —
                campaign gaps, brand opportunities, and execution priorities — so you always know what to do next.
              </p>
              <Link href="/auth/register"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent hover:text-accent-light transition-colors">
                See it in action
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2.5 6h7M6 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <div className="space-y-2">
              {[
                { type: 'warning', icon: '📋', msg: '3 campaigns missing hero visuals — generate now' },
                { type: 'success', icon: '🧠', msg: 'Brand voice active — AI using your custom tone' },
                { type: 'action',  icon: '⚡', msg: '2 draft campaigns ready to activate' },
                { type: 'info',    icon: '🎨', msg: 'Visual generation complete for Product Launch' },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-[12px] font-medium ${INSIGHT_STYLE[item.type]}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${INSIGHT_DOT[item.type]}`} />
                  <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold flex-shrink-0">AI</span>
                  <span className="flex-1">{item.icon} {item.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-3">Pricing</div>
          <h2 className="text-[32px] font-bold tracking-tight mb-3">Start free. Scale when ready.</h2>
          <p className="text-[14px] text-gray-500">Start free — 3 campaigns included. Upgrade when you're ready.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 items-start">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`rounded-2xl p-7 border relative transition-all duration-150
                ${plan.highlight
                  ? 'border-accent bg-accent/5 shadow-lg shadow-accent/5'
                  : 'border-[#1a1a1a] bg-[#0e0e10] hover:border-[#242424]'
                }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most popular
                </div>
              )}
              <div className="mb-6">
                <div className="text-[14px] font-bold text-white mb-1">{plan.name}</div>
                <div className="text-[12px] text-gray-500 mb-5">{plan.desc}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[36px] font-bold text-white tracking-tight">{plan.price}</span>
                  <span className="text-[13px] text-gray-500">/month</span>
                </div>
              </div>
              <ul className="space-y-2.5 mb-7">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-[12px] text-gray-400">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#FF9500" strokeWidth="1.5">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/register"
                className={`block w-full text-center py-2.5 rounded-xl font-semibold text-[13px] transition-colors
                  ${plan.highlight
                    ? 'bg-accent text-white hover:bg-accent-light'
                    : 'bg-[#161616] border border-[#222] text-gray-300 hover:border-[#2a2a2a] hover:text-white'
                  }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="border border-[#1a1a1a] rounded-3xl px-12 py-16 bg-[#0e0e10]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-6">Get started</div>
          <h2 className="text-[36px] font-bold tracking-tight mb-4">
            Your marketing operation<br />starts here.
          </h2>
          <p className="text-[14px] text-gray-500 mb-8 max-w-sm mx-auto">
            Join teams using Nexus to run their marketing with clarity, speed, and intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-light transition-colors text-[14px]">
              Start free — no card required
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 7h9M8 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/auth/login"
              className="inline-flex items-center justify-center px-7 py-3 border border-[#1e1e1e] text-gray-400 font-medium rounded-xl hover:border-[#2a2a2a] hover:text-white transition-colors text-[14px]">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t border-[#141414]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <NexusLogo size={20} />
            <span className="text-[13px] font-semibold text-white">Nexus</span>
          </div>
          <p className="text-[12px] text-gray-600">© {new Date().getFullYear()} Nexus AI. All rights reserved.</p>
          <div className="flex gap-6 text-[12px] text-gray-600">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/auth/login" className="hover:text-white transition-colors">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
