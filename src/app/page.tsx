'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// ── Mobile Nav ─────────────────────────────────────────────────────────
function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-72 z-50 bg-[#0d0d0c] border-l border-[#1f1f1d] flex flex-col"
        style={{ animation: 'slideDown 0.2s cubic-bezier(0.22,1,0.36,1)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a18]">
          <span className="font-bold text-white">Menu</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l10 10M12 2L2 12" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {[
            { href: '#platform', label: 'Platform' },
            { href: '#capabilities', label: 'Capabilities' },
            { href: '#pricing', label: 'Pricing' },
          ].map(item => (
            <a key={item.href} href={item.href} onClick={onClose}
              className="flex items-center px-4 py-3 rounded-xl text-[14px] text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
              {item.label}
            </a>
          ))}
        </div>
        <div className="p-4 space-y-2 border-t border-[#1a1a18]">
          <Link href="/auth/login" onClick={onClose}
            className="flex items-center justify-center w-full py-3 rounded-xl text-[14px] font-medium text-gray-300 border border-[#1f1f1d] hover:border-[#2a2a26] hover:text-white transition-colors">
            Log in
          </Link>
          <Link href="/auth/register" onClick={onClose}
            className="flex items-center justify-center w-full py-3 rounded-xl text-[14px] font-bold bg-accent text-white hover:bg-accent-light transition-colors">
            Get started free
          </Link>
        </div>
      </div>
    </>
  )
}

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
      className="relative w-full max-w-[480px] rounded-2xl overflow-hidden border border-dark-tertiary shadow-2xl"
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
          app.nexus-grow.com/dashboard
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

// ── FAQ ────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What exactly is Nexus?",
    a: "Nexus is an AI-powered marketing operating system. It's not a content generator — it's a complete marketing environment that holds your brand memory, generates strategy, creates content, and helps you execute campaigns end-to-end.",
  },
  {
    q: "How is this different from ChatGPT or other AI tools?",
    a: "ChatGPT gives you generic content. Nexus builds your brand profile first, then uses that context for every campaign. Your tone, audience, positioning, and goals are remembered across every generation — so every output sounds like your brand, not like AI.",
  },
  {
    q: "What do I get on the free plan?",
    a: "You get 3 complete campaigns with full AI strategy, hooks, scripts, captions, and a 30-day content calendar. No credit card required. Most users see the value within their first campaign.",
  },
  {
    q: "How fast does AI generation work?",
    a: "A full campaign — including strategy, 4 ad concepts, captions, hooks, and content calendar — typically generates in under 60 seconds.",
  },
  {
    q: "Can I export my campaigns?",
    a: "Yes. All plans include PDF campaign exports. You can download a full branded report for each campaign and share it with your team or clients.",
  },
  {
    q: "Do I need any marketing experience to use Nexus?",
    a: "No. Nexus is designed for founders, business owners, and small teams who don't have a dedicated marketing department. Just describe your business and Nexus handles the strategy.",
  },
  {
    q: "Can agencies use Nexus for multiple clients?",
    a: "Yes. The Pro plan supports 3 workspaces and the Agency plan supports 10 — each with its own brand profile, campaigns, and history. The Agency plan also includes white-label PDF exports.",
  },
  {
    q: "What happens when I run out of AI credits?",
    a: "You'll see an upgrade prompt. Credits reset monthly on paid plans. Free users can upgrade anytime — your campaigns and brand data are never deleted.",
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[#1a1a18]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
      >
        <span className="text-[14px] font-semibold text-white group-hover:text-accent transition-colors">{q}</span>
        <span className={`flex-shrink-0 w-5 h-5 rounded-full border border-[#2a2a26] flex items-center justify-center transition-all duration-200 ${open ? 'bg-accent border-accent rotate-45' : 'bg-transparent'}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={open ? 'white' : '#666'} strokeWidth="1.5">
            <path d="M5 2v6M2 5h6" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-5 text-[13px] text-gray-400 leading-relaxed pr-8" style={{ animation: 'slideDown 0.2s ease' }}>
          {a}
        </div>
      )}
    </div>
  )
}

// ── Capability card ────────────────────────────────────────────────────
function CapCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group p-6 rounded-2xl border border-[#1a1a1a] bg-[#0e0e10] hover:border-[#262626] hover:bg-[#111] transition-all duration-200">
      <div className="w-9 h-9 rounded-xl bg-[#161618] border border-dark-tertiary flex items-center justify-center mb-4 text-accent group-hover:border-accent/30 transition-colors">
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
    features: ['5 full campaigns / month', 'Brand Memory — AI learns your brand', 'Strategy + hooks + captions + calendar', 'PDF campaign exports', 'Email support'],
    cta: 'Start free — no card needed',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$79',
    desc: 'For growing brands that ship daily',
    features: ['Unlimited campaigns', 'Brand Memory across all campaigns', 'Social publishing (TikTok, IG, FB, LI)', 'Weekly AI strategy brief', 'Priority support'],
    cta: 'Start with Pro',
    highlight: true,
  },
  {
    name: 'Agency',
    price: '$199',
    desc: 'For agencies managing multiple clients',
    features: ['Unlimited campaigns', '10 client workspaces', 'White-label PDF exports', 'Client reporting dashboard', 'Dedicated support'],
    cta: 'Get Agency access',
    highlight: false,
  },
]

// ── Main page ──────────────────────────────────────────────────────────
export default function HomePage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-dark text-white overflow-x-hidden">

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#141414] bg-dark/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NexusLogo size={26} />
            <span className="font-bold text-white tracking-tight">Nexus</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-[13px] text-gray-500">
            <a href="#platform" className="hover:text-white transition-colors">Platform</a>
            <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link href="/demo" className="text-accent font-semibold hover:text-accent-light transition-colors">Live Demo</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login"
              className="hidden sm:block text-[13px] text-gray-400 hover:text-white transition-colors px-3 py-1.5">
              Log in
            </Link>
            <Link href="/auth/register"
              className="hidden sm:block text-[13px] px-4 py-1.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Get access
            </Link>
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 sm:pt-24 pb-14 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — copy */}
          <div className="text-center lg:text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-5 sm:mb-6">
              <span className="w-4 h-px bg-accent hidden sm:block" />
              Marketing Operations Infrastructure
            </div>

            <h1 className="text-[38px] sm:text-[52px] font-bold leading-[1.05] tracking-tight text-white mb-4 sm:mb-6">
              Operate your<br />
              marketing with<br />
              <span style={{ color: '#FF9500' }}>intelligence.</span>
            </h1>

            <p className="text-[15px] sm:text-[16px] text-gray-400 leading-relaxed mb-7 sm:mb-8 max-w-md mx-auto lg:mx-0">
              Nexus is the operational layer between your brand and your campaigns.
              Strategy, content, visuals, and execution — unified in one intelligent environment.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8 sm:mb-12">
              <Link href="/demo"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition-colors text-[14px]">
                See it in action — free demo
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2.5 7h9M8 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/auth/register"
                className="inline-flex items-center justify-center px-6 py-3.5 border border-dark-tertiary text-gray-300 font-medium rounded-xl hover:border-accent/40 hover:text-white transition-colors text-[14px]">
                Start free →
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-[11px] text-gray-500 mb-5">
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#22c55e" strokeWidth="1.5"><path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                No credit card required
              </span>
              <span className="text-gray-700">·</span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#22c55e" strokeWidth="1.5"><path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                3 full campaigns free
              </span>
              <span className="text-gray-700">·</span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#22c55e" strokeWidth="1.5"><path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Cancel anytime
              </span>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center lg:justify-start gap-6 sm:gap-8 text-[12px]">
              {[
                { val: '60s', label: 'full campaign' },
                { val: '500+', label: 'campaigns created' },
                { val: '$0', label: 'to get started' },
              ].map((s, i) => (
                <div key={i} className="text-center lg:text-left">
                  <div className="text-white font-bold text-[18px] mb-0.5">{s.val}</div>
                  <div className="text-gray-600">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — animated product window */}
          <div className="flex justify-center lg:justify-end mt-4 lg:mt-0">
            <HeroProductWindow />
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ───────────────────────────────────────────── */}
      <div className="border-y border-[#141414] py-5 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-y-4 gap-x-8 sm:gap-x-12">
            <span className="uppercase tracking-widest font-semibold text-[10px] text-gray-600 w-full text-center sm:w-auto sm:mr-2">Publishes to</span>
            {[
              { label: 'TikTok', color: '#ff0050' },
              { label: 'Instagram', color: '#e1306c' },
              { label: 'Facebook', color: '#1877f2' },
              { label: 'LinkedIn', color: '#0a66c2' },
              { label: 'YouTube', color: '#ff0000' },
            ].map(p => (
              <span key={p.label} className="text-[13px] font-semibold" style={{ color: '#4a4a48' }}>
                {p.label}
              </span>
            ))}
            <span className="hidden sm:block w-px h-4 bg-[#1a1a18]" />
            <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              500+ campaigns generated
            </span>
          </div>
        </div>
      </div>

      {/* ── PLATFORM SECTION ────────────────────────────────────── */}
      <section id="platform" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-28">
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
      <section id="capabilities" className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="bg-[#0e0e10] border border-[#1a1a1a] rounded-3xl p-10 md:p-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-4">AI Presence</div>
              <h2 className="text-[30px] font-bold tracking-tight mb-4">
                Always one step ahead. Never letting things slip.
              </h2>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-6">
                Nexus surfaces insights from your live workspace — missing assets, inactive campaigns,
                brand gaps, content opportunities — so you always know exactly what to do next without having to ask.
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
      <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
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
                    : 'bg-[#161616] border border-[#222] text-gray-300 hover:border-s4 hover:text-white'
                  }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── REAL OUTPUT PREVIEW ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-24">
        <div className="text-center mb-12">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-3">Real output</div>
          <h2 className="text-[28px] sm:text-[32px] font-bold tracking-tight mb-3">
            This is what Nexus actually produces.
          </h2>
          <p className="text-[14px] text-gray-500">
            One campaign brief. 60 seconds. Everything below — ready to use.
          </p>
        </div>

        {/* Campaign brief input strip */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 bg-[#0e0e10] border border-[#1a1a1a] rounded-2xl text-[12px]">
            <span className="text-gray-600 font-semibold uppercase tracking-widest text-[10px]">Brief</span>
            <span className="px-2.5 py-1 bg-[#161616] border border-[#222] rounded-lg text-gray-300">FitFlow App</span>
            <span className="text-gray-700">·</span>
            <span className="px-2.5 py-1 bg-[#161616] border border-[#222] rounded-lg text-gray-300">Fitness / Wellness</span>
            <span className="text-gray-700">·</span>
            <span className="px-2.5 py-1 bg-[#161616] border border-[#222] rounded-lg text-gray-300">Drive Sales</span>
            <span className="text-gray-700">·</span>
            <span className="px-2.5 py-1 bg-[#161616] border border-[#222] rounded-lg text-gray-300">TikTok + Instagram</span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Generated in 52s
            </span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">

          {/* Strategy */}
          <div className="bg-[#0e0e10] border border-[#1a1a1a] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Campaign Strategy</span>
            </div>
            <p className="text-[14px] text-gray-300 leading-relaxed mb-4">
              Position FitFlow as the fitness app that works around your life — not the other way around. Target burned-out professionals aged 25–38 who've tried gym memberships and failed. Lead with the identity shift: from "person who wants to get fit" to "person who actually does." Drive urgency with a limited free trial that ends Sunday.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Positioning', val: 'The fitness habit for busy people' },
                { label: 'Tone', val: 'Direct, empowering, zero fluff' },
                { label: 'Primary CTA', val: 'Start your free 7-day trial' },
                { label: 'Key platform', val: 'TikTok (organic reach window)' },
              ].map(r => (
                <div key={r.label} className="bg-[#131315] rounded-xl px-4 py-3">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{r.label}</div>
                  <div className="text-[12px] text-white font-medium">{r.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hooks */}
          <div className="bg-[#0e0e10] border border-[#1a1a1a] rounded-2xl p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-4">5 Ad Hooks — Ready to Record</div>
            <div className="space-y-3">
              {[
                { angle: 'Pattern Interrupt', hook: '"I used to spend $120/month on a gym I visited twice. Here\'s what changed."' },
                { angle: 'Social Proof',      hook: '"83,000 people started working out consistently with this one change."' },
                { angle: 'Curiosity Gap',     hook: '"The fitness app your trainer doesn\'t want you to find."' },
                { angle: 'Problem/Agitation', hook: '"Another Monday, another skipped workout. Sound familiar? This stops today."' },
                { angle: 'FOMO/Urgency',      hook: '"Free trial ends Sunday. 6 minutes a day. Real results in 3 weeks."' },
              ].map((h, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 bg-[#131315] rounded-xl">
                  <span className="text-[11px] font-bold text-accent/50 tabular-nums mt-0.5 flex-shrink-0">0{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{h.angle}</div>
                    <div className="text-[13px] text-gray-200 leading-snug">{h.hook}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Caption + CTA */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-[#0e0e10] border border-[#1a1a1a] rounded-2xl p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-3">Ready-to-Post Caption</div>
              <p className="text-[13px] text-gray-300 leading-relaxed">
                You don't need 2 hours at the gym.<br />You need 6 minutes and a plan that sticks. 🔥<br /><br />
                FitFlow builds a workout habit around your schedule — not the other way around. 83,000 people already made the switch.<br /><br />
                Free trial ends Sunday. Link in bio.<br /><br />
                <span className="text-gray-500">#fitness #workoutroutine #fitnesstiktok #healthylifestyle #gymtok #fitlife</span>
              </p>
            </div>
            <div className="bg-[#0e0e10] border border-[#1a1a1a] rounded-2xl p-6 flex flex-col">
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-3">30-Day Content Calendar</div>
              <div className="space-y-2 flex-1">
                {[
                  { day: 'Mon', type: 'Hook video', platform: 'TikTok' },
                  { day: 'Wed', type: 'Transformation story', platform: 'Instagram Reel' },
                  { day: 'Fri', type: 'Social proof post', platform: 'TikTok' },
                  { day: 'Sun', type: 'CTA + trial push', platform: 'IG + TikTok' },
                ].map(r => (
                  <div key={r.day} className="flex items-center gap-3 text-[11px]">
                    <span className="w-8 text-gray-600 font-semibold">{r.day}</span>
                    <span className="flex-1 text-gray-300">{r.type}</span>
                    <span className="text-gray-600">{r.platform}</span>
                  </div>
                ))}
                <div className="text-[11px] text-gray-600 pt-2 border-t border-[#1a1a1a]">+ 24 more posts across 4 weeks</div>
              </div>
            </div>
          </div>

          {/* CTA under output */}
          <div className="text-center pt-4">
            <p className="text-[13px] text-gray-500 mb-4">This is one campaign. You get 3 free when you sign up.</p>
            <Link href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent-light transition-colors text-[13px]">
              Generate yours free — no account needed
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 6.5h8M7 4l3 2.5-3 2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-12">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-3">FAQ</div>
          <h2 className="text-[28px] sm:text-[32px] font-bold tracking-tight">Everything you need to know</h2>
        </div>
        <div>
          {FAQS.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
        <div className="text-center mt-10">
          <p className="text-[13px] text-gray-500">
            Still have questions?{' '}
            <a href="mailto:hello@nexus-grow.com" className="text-accent hover:text-accent-light transition-colors">
              hello@nexus-grow.com
            </a>
          </p>
        </div>
      </section>

      {/* ── SOCIAL PROOF STRIP ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
          {[
            { icon: '⚡', stat: '60 seconds', label: 'from brief to full campaign' },
            { icon: '🧠', stat: 'Brand Memory', label: 'AI remembers your brand forever' },
            { icon: '📅', stat: '30-day calendar', label: 'ready-to-execute content plan' },
            { icon: '🔒', stat: 'No lock-in', label: 'export everything, cancel anytime' },
          ].map(item => (
            <div key={item.stat} className="flex items-center gap-3 text-[12px]">
              <span className="text-lg">{item.icon}</span>
              <div>
                <span className="font-bold text-white">{item.stat}</span>
                <span className="text-gray-600 ml-1.5">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
        <div className="border border-[#1a1a1a] rounded-3xl px-6 sm:px-12 py-12 sm:py-16 bg-[#0e0e10]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-6">Get started</div>
          <h2 className="text-[32px] sm:text-[36px] font-bold tracking-tight mb-4">
            Your marketing operation<br />starts here.
          </h2>
          <p className="text-[14px] text-gray-500 mb-8 max-w-md mx-auto">
            Try the live demo first — no account needed. Or sign up and get 3 complete campaigns free.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <Link href="/demo"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-accent text-white font-bold rounded-xl hover:bg-accent-light transition-colors text-[14px]">
              Try free demo
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 7h9M8 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/auth/register"
              className="inline-flex items-center justify-center px-7 py-3.5 border border-[#2a2a26] text-gray-300 font-semibold rounded-xl hover:border-accent/40 hover:text-white transition-colors text-[14px]">
              Create free account →
            </Link>
          </div>
          <p className="text-[11px] text-gray-600">
            No credit card · 3 campaigns free · Cancel anytime
          </p>
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
