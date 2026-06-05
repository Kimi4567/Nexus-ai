'use client'

import { useEffect, useRef, useState, type ElementType } from 'react'
import Link from 'next/link'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Check, ChevronDown, Globe, Menu, X,
  Brain, Zap, Target, Calendar, BarChart3, Shield,
  Sparkles, Rocket, TrendingUp, Play,
  Share2 as _Share2,
  CheckCircle, AlertCircle,
  Eye, RefreshCw, LayoutGrid, Cpu,
} from 'lucide-react'
import { useTranslation } from '@/i18n'

/* ─────────────────────────────────────────────────────
   PARTICLE BG
───────────────────────────────────────────────────── */
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef  = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let w = 0, h = 0, id = 0
    const particles: { x:number; y:number; vx:number; vy:number; r:number; c:string }[] = []

    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight }
    const init   = () => {
      particles.length = 0
      const n = window.innerWidth < 768 ? 18 : 40
      for (let i = 0; i < n; i++) particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.5 + 0.8,
        c: Math.random() > 0.5 ? 'rgba(139,92,246,0.3)' : 'rgba(34,211,238,0.2)',
      })
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const dx = p.x - mouseRef.current.x, dy = p.y - mouseRef.current.y
        const d  = Math.sqrt(dx * dx + dy * dy)
        if (d < 160) { const f = (160 - d) / 160; p.vx += (dx / d) * f * 0.25; p.vy += (dy / d) * f * 0.25 }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.vy *= 0.99
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.c; ctx.fill()
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j], dd = Math.sqrt((p.x-q.x)**2+(p.y-q.y)**2)
          if (dd < 110) { ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.strokeStyle=`rgba(139,92,246,${0.06*(1-dd/110)})`; ctx.lineWidth=0.5; ctx.stroke() }
        }
      }
      id = requestAnimationFrame(draw)
    }
    resize(); init(); draw()
    canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouseRef.current = { x: e.clientX-r.left, y: e.clientY-r.top } }, { passive: true })
    window.addEventListener('resize', () => { resize(); init() })
    return () => cancelAnimationFrame(id)
  }, [])

  return <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:1 }} />
}

/* ─────────────────────────────────────────────────────
   REVEAL
───────────────────────────────────────────────────── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div ref={ref} initial={{ opacity:0, y:24 }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:0.6, delay, ease:[0.25,0.46,0.45,0.94] as [number,number,number,number] }}
      className={className}>
      {children}
    </motion.div>
  )
}

function Label({ text }: { text: string }) {
  return (
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[3px] text-purple-400 mb-3">{text}</p>
  )
}

/* ─────────────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────────────── */
function Navbar() {
  const { lang, setLang } = useTranslation()
  const ar = lang === 'ar'
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const links = [
    { label: ar ? 'Brand Brain' : 'Brand Brain', href: '#brain' },
    { label: ar ? 'كيف يعمل' : 'How It Works',  href: '#pipeline' },
    { label: ar ? 'الوكلاء' : 'Agents',          href: '#agents' },
    { label: ar ? 'الأسعار' : 'Pricing',          href: '#pricing' },
  ]

  return (
    <header className={`fixed top-0 inset-x-0 z-50 h-[64px] flex items-center transition-all duration-300 ${scrolled ? 'bg-[rgba(6,7,24,0.95)] backdrop-blur-[16px] border-b border-[rgba(255,255,255,0.06)]' : 'bg-transparent'}`}>
      <div className="w-full max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-heading font-extrabold text-[19px] text-white tracking-tight">NEXUS</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: 'linear-gradient(135deg,#8B5CF6,#22D3EE)' }}>AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <a key={l.href} href={l.href}
              className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors tracking-wide">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => setLang(ar ? 'en' : 'ar')}
            className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.18)]">
            <Globe size={12} />{ar ? 'English' : 'العربية'}
          </button>
          <Link href="/auth/login" className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors px-4 py-2">
            {ar ? 'دخول' : 'Sign In'}
          </Link>
          <Link href="/auth/register"
            className="text-[13px] font-semibold text-white px-5 py-2.5 rounded-lg transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
            {ar ? 'ابدأ مجاناً' : 'Start Free'}
          </Link>
        </div>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-white">
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
            className="fixed inset-0 top-[64px] z-40 bg-[#060718]/98 backdrop-blur-xl md:hidden flex flex-col items-center pt-10 gap-5">
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                className="text-[18px] font-medium text-slate-300 hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
            <div className="flex flex-col items-center gap-3 mt-4">
              <button onClick={() => setLang(ar ? 'en' : 'ar')} className="flex items-center gap-2 text-slate-400 hover:text-white text-[14px]">
                <Globe size={14} />{ar ? 'English' : 'العربية'}
              </button>
              <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="text-slate-300 text-[16px] hover:text-white">
                {ar ? 'دخول' : 'Sign In'}
              </Link>
              <Link href="/auth/register" onClick={() => setMobileOpen(false)}
                className="text-white font-semibold px-8 py-3 rounded-lg text-[15px]"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}>
                {ar ? 'ابدأ مجاناً' : 'Start Free'}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

/* ─────────────────────────────────────────────────────
   PIPELINE STEP CARD (used in hero)
───────────────────────────────────────────────────── */
function PipelineCard({ icon: Icon, label, status, color, delay }: {
  icon: ElementType; label: string; status: string; color: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      transition={{ delay, duration:0.55, ease:[0.22,1,0.36,1] }}
      style={{
        background: `linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))`,
        border: `1px solid ${color}28`,
        minWidth: '140px', flex: '1 1 140px', maxWidth: '180px',
      }}
      className="rounded-xl px-3.5 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${color}15`, color }}>
          {status}
        </span>
      </div>
      <p className="text-[12px] font-semibold text-slate-300 leading-tight">{label}</p>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────
   INSTAGRAM MOCKUP
───────────────────────────────────────────────────── */
function IGMockup({ caption, brand, ar }: { caption: string; brand: string; ar: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden text-[12px]" style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 280 }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[rgba(255,255,255,0.07)]">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#F97316,#8B5CF6)' }}>
          {brand.slice(0,1).toUpperCase()}
        </div>
        <span className="font-semibold text-white text-[12px]">{brand}</span>
        <span className="ml-auto text-slate-500 text-[18px] leading-none">···</span>
      </div>
      <div className="w-full aspect-square" style={{ background: 'linear-gradient(135deg,#1a0533 0%,#0c1a33 50%,#001a1a 100%)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="text-center opacity-30">
          <Sparkles size={28} className="text-purple-400 mx-auto mb-1" />
          <p className="text-[10px] text-slate-500">AI Generated</p>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-3 mb-2.5">
          <span className="text-[20px] cursor-pointer hover:scale-110 transition-transform">🤍</span>
          <span className="text-[20px] cursor-pointer">💬</span>
          <span className="text-[20px] cursor-pointer">↗</span>
          <span className="ml-auto text-[20px] cursor-pointer">🔖</span>
        </div>
        <p className="text-[11px] text-slate-300 font-semibold mb-1">1,284 likes</p>
        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
          <span className="text-white font-semibold">{brand} </span>{caption}
        </p>
        <p className="text-[10px] text-slate-600 mt-1.5">{ar ? 'منذ 2 ساعة' : '2 hours ago'}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   LINKEDIN MOCKUP
───────────────────────────────────────────────────── */
function LIMockup({ caption, brand, ar }: { caption: string; brand: string; ar: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden text-[12px]" style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 280 }}>
      <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.07)]">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#0077B5,#004182)' }}>
            {brand.slice(0,1).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white text-[12px]">{brand}</p>
            <p className="text-[10px] text-slate-500">{ar ? 'مدير تسويق · NEXUS AI' : 'Marketing Manager · NEXUS AI'}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-300 mt-2.5 leading-relaxed line-clamp-3">{caption}</p>
      </div>
      <div className="w-full" style={{ height: 110, background: 'linear-gradient(135deg,#001a33 0%,#1a0533 100%)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize: 28, opacity: 0.2 }}>💼</span>
      </div>
      <div className="px-3 py-2 flex items-center gap-3 text-[11px] text-slate-500">
        <span>👍 ❤️ 💡</span>
        <span className="ml-auto">234 {ar ? 'تفاعل' : 'reactions'}</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   TIKTOK MOCKUP
───────────────────────────────────────────────────── */
function TKMockup({ caption, brand, ar }: { caption: string; brand: string; ar: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden text-[11px]" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 165 }}>
      <div className="relative" style={{ height: 260, background: 'linear-gradient(180deg,#0c001a 0%,#001a10 100%)' }}>
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <Play size={36} className="text-white" fill="white" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-white font-semibold text-[11px] mb-0.5">@{brand.toLowerCase().replace(/\s/g,'')}</p>
          <p className="text-slate-300 text-[10px] leading-tight line-clamp-2">{caption}</p>
          <p className="text-slate-500 text-[9px] mt-1">♪ {ar ? 'صوت أصلي' : 'Original sound'}</p>
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[18px]">🤍</span>
            <span className="text-[9px] text-slate-300">12.4K</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[18px]">💬</span>
            <span className="text-[9px] text-slate-300">284</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[18px]">↗</span>
            <span className="text-[9px] text-slate-300">1.2K</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   FAQ ITEM
───────────────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button onClick={() => setOpen(o => !o)}
      className="w-full text-left rounded-2xl px-5 py-4 transition-all"
      style={{ background: open ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.025)', border: open ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start justify-between gap-4">
        <p className="font-semibold text-[14px] text-white leading-snug">{q}</p>
        <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.p initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
            exit={{ opacity:0, height:0 }} transition={{ duration:0.25 }}
            className="text-[13px] text-slate-400 mt-3 leading-relaxed overflow-hidden">
            {a}
          </motion.p>
        )}
      </AnimatePresence>
    </button>
  )
}

/* ─────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────── */
export default function LandingPage() {
  const { lang, setLang } = useTranslation()
  const ar  = lang === 'ar'
  const dir = ar ? 'rtl' : 'ltr'

  /* ── Pipeline steps ── */
  const pipelineSteps = [
    {
      icon: Brain,    color: '#8B5CF6',
      label: ar ? 'Brand Brain' : 'Brand Brain',
      status: ar ? 'جاهز' : 'Ready',
    },
    {
      icon: Target,   color: '#818CF8',
      label: ar ? 'الاستراتيجية' : 'Strategy',
      status: ar ? 'مولّدة' : 'Generated',
    },
    {
      icon: LayoutGrid, color: '#22D3EE',
      label: ar ? 'المحتوى' : 'Content Hub',
      status: ar ? '30 بوست' : '30 posts',
    },
    {
      icon: Eye,      color: '#34D399',
      label: ar ? 'الموافقة' : 'Approved',
      status: ar ? 'تم' : 'Done',
    },
    {
      icon: Rocket,   color: '#F97316',
      label: ar ? 'منشور' : 'Published',
      status: ar ? 'مباشر' : 'Live',
    },
  ]

  /* ── Agents ── */
  const agents = [
    {
      codename: 'NEXUS',
      role: ar ? 'كبير الاستراتيجيين' : 'Chief Strategist',
      color: '#8B5CF6',
      icon: Target,
      desc: ar
        ? 'يحلل علامتك التجارية، السوق، والمنافسين — ثم يبني استراتيجية تسويق كاملة بـ GPT-4o. positioning، hooks، CTAs، وتقويم محتوى في ثوانٍ.'
        : 'Analyzes your brand, market, and competitors — then builds a full marketing strategy with GPT-4o. Positioning, hooks, CTAs, and a content calendar in seconds.',
      skills: ar
        ? ['استراتيجية العلامة التجارية', 'تحليل المنافسين', 'CTAs وHooks', 'تقويم المحتوى']
        : ['Brand positioning', 'Competitor analysis', 'Hooks & CTAs', 'Content calendar'],
    },
    {
      codename: 'NEX',
      role: ar ? 'كاتب المحتوى' : 'Content Writer',
      color: '#22D3EE',
      icon: Sparkles,
      desc: ar
        ? 'يكتب كل بوست بأسلوب علامتك التجارية — لا templates جاهزة. يعرف المنصة، ويعرف جمهورك، ويولد caption يبدأ بـ hook قوي.'
        : 'Writes every post in your brand voice — no generic templates. Platform-aware, audience-aware, with a strong hook on every caption.',
      skills: ar
        ? ['Instagram · LinkedIn · TikTok', 'صوت العلامة التجارية', 'أسلوب عربي وإنجليزي', 'AI Rewrite في كبسة']
        : ['Instagram · LinkedIn · TikTok', 'Brand voice injection', 'Arabic & English', 'One-click AI Rewrite'],
    },
    {
      codename: 'VEX',
      role: ar ? 'مدير الحملات المدفوعة' : 'Paid Campaigns Director',
      color: '#F97316',
      icon: Zap,
      desc: ar
        ? 'يولد brief كامل للحملة المدفوعة — targeting، variants النسخ، UTM tracking، وتوجيهات الإطلاق لكل منصة. ليس مجرد أفكار — خطة تنفيذ جاهزة.'
        : 'Generates a complete paid campaign brief — audience targeting, copy variants, UTM tracking, and platform-specific launch guides. Not ideas — an execution plan.',
      skills: ar
        ? ['استهداف الجمهور', 'نسخ متعددة للإعلانات', 'UTM Tracking', 'تحليل ROI']
        : ['Audience targeting', 'Ad copy variants', 'UTM tracking', 'ROI analysis'],
    },
    {
      codename: 'SENTINEL',
      role: ar ? 'مراقب السوق' : 'Market Monitor',
      color: '#10B981',
      icon: Shield,
      desc: ar
        ? 'يراقب المشهد التنافسي في ضوء علامتك التجارية تحديداً — ما الذي ينجح معهم ولا ينجح معك؟ يراجع كل حملة قبل الإطلاق ويرفع تقرير جاهزية.'
        : 'Monitors the competitive landscape against your specific brand positioning. Reviews every campaign before launch and delivers a readiness report.',
      skills: ar
        ? ['تحليل المنافسين', 'مراجعة الحملة', 'تقرير الجاهزية', 'تنبيهات السوق']
        : ['Competitor analysis', 'Campaign review', 'Readiness report', 'Market alerts'],
    },
  ]

  /* ── Pricing ── */
  const plans = [
    {
      name: ar ? 'مجاني' : 'Free',
      price: '0',
      period: '',
      badge: '',
      desc: ar ? 'اكتشف القوة الكاملة بدون بطاقة ائتمان.' : 'Explore the full power. No credit card needed.',
      features: ar
        ? ['20 رصيد AI للتجربة', 'مساحة عمل واحدة', 'حملة واحدة كاملة', 'استراتيجية + محتوى + صور', 'Brand Brain (القراءة والكتابة)']
        : ['20 AI credits to explore', '1 workspace', '1 full campaign', 'Strategy + content + images', 'Brand Brain (read & write)'],
      cta: ar ? 'ابدأ مجاناً' : 'Start Free',
      href: '/auth/register',
      featured: false,
    },
    {
      name: ar ? 'برو' : 'Pro',
      price: '79',
      period: ar ? '/شهر' : '/mo',
      badge: ar ? 'الأكثر شيوعاً' : 'Most popular',
      desc: ar ? 'للشركات الجادة والفرق الصغيرة.' : 'For serious businesses and small teams.',
      features: ar
        ? [
            '300 رصيد AI — يتجدد شهرياً',
            '3 مساحات عمل',
            '20 حملة / شهر',
            '100 بوست مجدول / شهر',
            'النشر التلقائي: Meta · LinkedIn · TikTok',
            'Brand Brain الكامل + كل الوكلاء',
            'A/B Testing + AI Rewrite',
            'لوحة تحليلات + ROI Dashboard',
            'تصدير PDF + DOCX',
          ]
        : [
            '300 AI credits — renews monthly',
            '3 workspaces',
            '20 campaigns / month',
            '100 scheduled posts / month',
            'Auto-publish: Meta · LinkedIn · TikTok',
            'Full Brand Brain + all agents',
            'A/B Testing + AI Rewrite',
            'Analytics + ROI Dashboard',
            'PDF + DOCX export',
          ],
      cta: ar ? 'ابدأ Pro — $79/شهر' : 'Start Pro — $79/mo',
      href: '/auth/register',
      featured: true,
    },
    {
      name: ar ? 'بيزنس' : 'Business',
      price: '199',
      period: ar ? '/شهر' : '/mo',
      badge: '',
      desc: ar ? 'للوكالات والفرق الكبيرة.' : 'For agencies and larger teams.',
      features: ar
        ? [
            '1,000 رصيد AI — يتجدد شهرياً',
            '10 مساحات عمل',
            '60 حملة / شهر · بوستات غير محدودة',
            'نشر متعدد الحسابات',
            '3 مقاعد للفريق',
            'White-label exports (بشعارك)',
            'تحليلات متقدمة',
            'دعم ذو أولوية',
          ]
        : [
            '1,000 AI credits — renews monthly',
            '10 workspaces',
            '60 campaigns / mo · unlimited posts',
            'Multi-account publishing',
            '3 team seats',
            'White-label exports (your logo)',
            'Advanced analytics',
            'Priority support',
          ],
      cta: ar ? 'ابدأ Business — $199/شهر' : 'Start Business — $199/mo',
      href: '/auth/register',
      featured: false,
    },
  ]

  /* ── FAQ ── */
  const faqs = [
    {
      q: ar ? 'كيف يعرف الـ AI علامتي التجارية؟' : "How does the AI know my brand?",
      a: ar
        ? 'قبل أي شيء، تملأ Brand Brain — هوية علامتك، صوتها، جمهورها، منافسيها، وأهدافها. هذه البيانات تُحقن في كل وكيل AI قبل توليد أي محتوى. كلما استخدمت المنصة أكثر، تتعلم Brand Brain من الحملات الناجحة تلقائياً.'
        : 'Before anything, you fill in Brand Brain — your identity, voice, audience, competitors, and goals. This data is injected into every AI agent before generating any content. The more you use the platform, the smarter Brand Brain gets from successful campaigns.',
    },
    {
      q: ar ? 'هل الـ AI ينشر تلقائياً بدون إذني؟' : 'Does the AI publish automatically without my approval?',
      a: ar
        ? 'أبداً. كل بوست يمر عبر Approval Center أولاً. أنت ترى كل بوست بمظهره الفعلي على المنصة قبل النشر. Approve All يجدول الكل، لكنه لا ينشر إلا بعد مراجعتك.'
        : 'Never. Every post goes through the Approval Center first. You see each post in its actual platform preview before it goes live. Approve All schedules everything, but nothing publishes without your review.',
    },
    {
      q: ar ? 'كم وقت تأخذ الحملة الكاملة؟' : 'How long does a full campaign take?',
      a: ar
        ? 'استراتيجية كاملة في ~30 ثانية. خطة محتوى 30 بوست في ~2 دقيقة. مراجعة الكل والموافقة في 10-15 دقيقة. من الفكرة لـ 30 بوست مجدول في جلسة واحدة.'
        : 'A full strategy takes ~30 seconds. A 30-post content plan takes ~2 minutes. Reviewing and approving everything: 10-15 minutes. From idea to 30 scheduled posts in one session.',
    },
    {
      q: ar ? 'هل يدعم العربية؟' : 'Does it support Arabic?',
      a: ar
        ? 'نعم. الواجهة كاملة بالعربية مع RTL support. الوكلاء يولدون المحتوى بالعربية أو الإنجليزية حسب تفضيلك — أو كليهما في نفس الحملة.'
        : 'Yes. Full Arabic interface with RTL support. Agents generate content in Arabic or English based on your preference — or both in the same campaign.',
    },
    {
      q: ar ? 'هل أحتاج ربط حساباتي الاجتماعية فوراً؟' : 'Do I need to connect my social accounts immediately?',
      a: ar
        ? 'لا. تقدر تولد الاستراتيجية والمحتوى وتصدره وتنفذه يدوياً من اليوم الأول. ربط Facebook/LinkedIn/TikTok اختياري وتفعّله عندما تكون جاهزاً.'
        : 'No. You can generate strategy, content, and export or execute manually from day one. Connecting Facebook/LinkedIn/TikTok is optional and you activate it when ready.',
    },
    {
      q: ar ? 'ما الذي يميز NEXUS عن ChatGPT أو أي AI كتابة عشوائي؟' : 'What makes NEXUS different from ChatGPT or any random AI writing tool?',
      a: ar
        ? 'ChatGPT يكتب لك — وتنسى ما قلته بالأمس. NEXUS يبني ذاكرة حقيقية لعلامتك، يدير pipeline كامل من الاستراتيجية للنشر، ويتعلم من كل حملة. أنت لا تكتب prompts — أنت تدير قسم تسويق.'
        : "ChatGPT writes for you — and forgets what you said yesterday. NEXUS builds a real memory for your brand, manages the full pipeline from strategy to publish, and learns from every campaign. You don't write prompts — you run a marketing department.",
    },
  ]

  return (
    <div className="bg-[#060718] text-white overflow-x-hidden" dir={dir}>
      <Navbar />

      {/* ══════════════════════════════════
          HERO
      ══════════════════════════════════ */}
      <section className="relative overflow-hidden pt-[64px] min-h-screen flex flex-col justify-center">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.2) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 15% 70%, rgba(34,211,238,0.07) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 85% 70%, rgba(16,185,129,0.06) 0%, transparent 60%)',
        }} />
        <ParticleBackground />

        <div className="relative z-10 max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 w-full pt-16 lg:pt-24 pb-10 text-center">

          {/* Badge */}
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.08)] mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[2.5px] text-emerald-400">
              {ar ? 'قسم التسويق الذكي بالكامل' : 'Your Complete AI Marketing Department'}
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1 initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25, duration:0.65 }}
            className="text-[42px] sm:text-[62px] lg:text-[76px] font-extrabold leading-[1.04] tracking-[-3px] mb-6">
            {ar ? (
              <>
                من brief فارغ<br />
                <span style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6 0%,#22D3EE 50%,#10B981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                  لشهر محتوى
                </span>
                <br />في جلسة واحدة.
              </>
            ) : (
              <>
                From blank brief<br />
                <span style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6 0%,#22D3EE 50%,#10B981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                  to a month of content
                </span>
                <br />in one session.
              </>
            )}
          </motion.h1>

          {/* Sub */}
          <motion.p initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.45, duration:0.6 }}
            className="text-[17px] sm:text-[20px] text-slate-400 leading-relaxed max-w-[640px] mx-auto mb-9">
            {ar
              ? 'NEXUS يتذكر علامتك التجارية، يبني استراتيجية كاملة بالـ AI، يولد 30 بوست جاهزة للنشر، وينشر أوتوماتيك على Facebook وLinkedIn وTikTok.'
              : 'NEXUS remembers your brand, builds a full AI strategy, generates 30 publish-ready posts, and auto-publishes to Facebook, LinkedIn, and TikTok.'}
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.65, duration:0.5 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-6">
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 text-[14px] font-bold text-white px-8 py-4 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background:'linear-gradient(135deg,#7C3AED,#8B5CF6,#06B6D4)', boxShadow:'0 0 40px rgba(139,92,246,0.35), 0 4px 20px rgba(6,182,212,0.15)' }}>
              {ar ? 'ابدأ مجاناً — لا بطاقة ائتمان' : 'Start Free — No credit card'} <ArrowRight size={16} />
            </Link>
            <a href="#pipeline"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-400 hover:text-white transition-colors border border-[rgba(255,255,255,0.1)] px-6 py-4 rounded-xl hover:border-[rgba(255,255,255,0.2)]">
              <Play size={14} /> {ar ? 'شاهد كيف يعمل' : 'See how it works'}
            </a>
          </motion.div>

          {/* Trust */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.85, duration:0.5 }}
            className="flex items-center justify-center gap-4 text-[12px] text-slate-500 flex-wrap">
            {[
              { icon: CheckCircle, text: ar ? '20 رصيد AI مجاناً' : '20 free AI credits' },
              { icon: CheckCircle, text: ar ? 'إلغاء في أي وقت' : 'Cancel anytime' },
              { icon: CheckCircle, text: ar ? 'عربي وإنجليزي' : 'Arabic & English' },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5">
                <Icon size={11} className="text-emerald-500" />{text}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Pipeline cards */}
        <div className="relative z-10 max-w-[1000px] mx-auto px-4 sm:px-6 pb-16">
          <div className="flex justify-center gap-2 sm:gap-3 flex-nowrap overflow-x-auto pb-1">
            {pipelineSteps.map((s, i) => (
              <PipelineCard key={i} {...s} delay={0.7 + i * 0.08} />
            ))}
          </div>
          {/* connector line */}
          <div className="hidden sm:flex items-center justify-center mt-[-28px] mb-0 px-20 pointer-events-none">
            <div className="h-px flex-1" style={{ background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.3),rgba(34,211,238,0.3),transparent)' }} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          TECH BAR
      ══════════════════════════════════ */}
      <div className="border-y border-[rgba(255,255,255,0.05)]" style={{ background:'rgba(255,255,255,0.015)' }}>
        <div className="max-w-[1100px] mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-6 flex-wrap text-[11px] font-mono font-semibold uppercase tracking-[2px] text-slate-500">
            {[
              'GPT-4o', 'Flux 1.1 Pro', 'Meta API', 'LinkedIn API', 'TikTok API',
              ar ? 'عربي · إنجليزي' : 'Arabic · English', 'Stripe', 'Supabase',
            ].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-purple-500 opacity-60" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          BRAND BRAIN
      ══════════════════════════════════ */}
      <section id="brain" className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(139,92,246,0.07) 0%, transparent 70%)' }} />
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal className="text-center mb-14">
            <Label text={ar ? 'الذاكرة الحقيقية لعلامتك' : 'THE REAL MEMORY OF YOUR BRAND'} />
            <h2 className="text-[30px] sm:text-[42px] lg:text-[52px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-4">
              {ar ? (
                <>
                  Brand Brain —<br />
                  <span style={{ backgroundImage:'linear-gradient(90deg,#8B5CF6,#22D3EE)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                    الـ AI الذي يعرف علامتك
                  </span>
                </>
              ) : (
                <>
                  Brand Brain —<br />
                  <span style={{ backgroundImage:'linear-gradient(90deg,#8B5CF6,#22D3EE)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                    the AI that knows your brand
                  </span>
                </>
              )}
            </h2>
            <p className="text-[16px] sm:text-[18px] text-slate-400 max-w-[580px] mx-auto leading-relaxed">
              {ar
                ? 'أغلب أدوات الـ AI تنسى ما أخبرتها به بالأمس. Brand Brain يبني ذاكرة دائمة تُحقن في كل وكيل، كل بوست، وكل حملة — وتتطور مع كل نتيجة.'
                : 'Most AI tools forget what you told them yesterday. Brand Brain builds a permanent memory injected into every agent, every post, every campaign — and evolves with every result.'}
            </p>
          </Reveal>

          {/* 6 Brain sections */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
            {[
              { icon: '🏷️', title: ar ? 'هوية العلامة' : 'Brand Identity',  desc: ar ? 'الاسم، الوصف، الفئة' : 'Name, tagline, category' },
              { icon: '🎙️', title: ar ? 'الصوت والأسلوب' : 'Voice & Tone',   desc: ar ? 'كيف تتحدث علامتك' : 'How your brand speaks' },
              { icon: '🎯', title: ar ? 'الجمهور المستهدف' : 'Target Audience', desc: ar ? 'من تخاطب' : "Who you're talking to" },
              { icon: '⚔️', title: ar ? 'المنافسون' : 'Competitors',      desc: ar ? 'من تتفوق عليهم' : "Who you're beating" },
              { icon: '📈', title: ar ? 'أهداف التسويق' : 'Marketing Goals', desc: ar ? 'ما تريد تحقيقه' : 'What you want to achieve' },
              { icon: '💎', title: ar ? 'التموضع' : 'Positioning',       desc: ar ? 'لماذا أنت الخيار' : "Why you're the choice" },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="rounded-2xl p-4 h-full text-center hover:border-purple-500/30 transition-all"
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <p className="font-semibold text-[12px] text-white mb-1">{s.title}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Learning loop callout */}
          <Reveal>
            <div className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5"
              style={{ background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(139,92,246,0.15)' }}>
                <RefreshCw size={22} className="text-purple-400" />
              </div>
              <div>
                <p className="font-bold text-[15px] text-white mb-1">
                  {ar ? 'تتعلم من كل حملة — أوتوماتيك.' : 'Learns from every campaign — automatically.'}
                </p>
                <p className="text-[13px] text-slate-400 leading-relaxed">
                  {ar
                    ? 'عند الموافقة على خطة المحتوى، يستخرج النظام الـ hooks والـ angles الناجحة ويضيفها لـ Brand Brain. كلما استخدمت المنصة أكثر، ازداد المحتوى تخصصاً.'
                    : 'When you approve a content plan, the system extracts successful hooks and content angles and adds them to Brand Brain. The more you use the platform, the more personalized the output becomes.'}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════
          PIPELINE
      ══════════════════════════════════ */}
      <section id="pipeline" className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 50% 40% at 80% 50%, rgba(34,211,238,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal className="text-center mb-16">
            <Label text={ar ? 'pipeline كامل في مكان واحد' : 'FULL PIPELINE IN ONE PLACE'} />
            <h2 className="text-[30px] sm:text-[42px] lg:text-[52px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-4">
              {ar
                ? <>من brief فارغ — لحملة منشورة.<br /><span className="text-slate-400">في جلسة واحدة.</span></>
                : <>From empty brief — to live campaign.<br /><span className="text-slate-400">In one session.</span></>}
            </h2>
            <p className="text-[16px] text-slate-400 max-w-[500px] mx-auto">
              {ar
                ? 'لا تنتقل بين أدوات — الاستراتيجية والمحتوى والتصميم والنشر كلها في pipeline واحد متصل.'
                : "Don't jump between tools. Strategy, content, visuals, and publishing are all in one connected pipeline."}
            </p>
          </Reveal>

          {/* Steps */}
          <div className="space-y-4">
            {[
              {
                num: '01', color: '#8B5CF6', icon: Brain,
                title: ar ? 'Brief + Brand Brain' : 'Brief + Brand Brain',
                desc: ar
                  ? 'تملأ تفاصيل الحملة (من، ماذا، لمن، لماذا). Brand Brain يضيف هوية علامتك أوتوماتيك. الـ AI يعرف الآن كل ما يحتاجه.'
                  : 'Fill in your campaign details (who, what, for whom, why). Brand Brain automatically injects your brand identity. The AI now knows everything it needs.',
                time: ar ? '~3 دقائق' : '~3 min',
              },
              {
                num: '02', color: '#818CF8', icon: Target,
                title: ar ? 'الاستراتيجية الكاملة' : 'Full Strategy',
                desc: ar
                  ? 'في 30 ثانية: positioning statement، target hooks، content angles، CTAs، وتقويم نشر أسبوعي. ليس generic — مبني على علامتك تحديداً.'
                  : 'In 30 seconds: positioning statement, target hooks, content angles, CTAs, and a weekly publishing calendar. Not generic — built for your brand specifically.',
                time: ar ? '~30 ثانية' : '~30 sec',
              },
              {
                num: '03', color: '#22D3EE', icon: LayoutGrid,
                title: ar ? 'Content Hub — 30 بوست' : 'Content Hub — 30 posts',
                desc: ar
                  ? 'يولد 30 بوست لكل المنصات — Instagram، LinkedIn، TikTok، Facebook. كل بوست بـ hook قوي وبأسلوب علامتك. مع A/B variants لأفضل النتائج.'
                  : 'Generates 30 posts for all platforms — Instagram, LinkedIn, TikTok, Facebook. Every post with a strong hook in your brand voice. A/B variants included for best results.',
                time: ar ? '~2 دقيقة' : '~2 min',
              },
              {
                num: '04', color: '#34D399', icon: Eye,
                title: ar ? 'مراجعة وموافقة' : 'Review & Approve',
                desc: ar
                  ? 'ترى كل بوست بمظهره الفعلي على المنصة — Instagram card، LinkedIn post، TikTok caption. أعِد الكتابة بـ AI في كبسة، اختر الـ winner بين A/B، وافق على الكل دفعة واحدة.'
                  : "See every post exactly as it'll look on the platform — Instagram card, LinkedIn post, TikTok caption. Rewrite with AI in one click, pick the A/B winner, and approve everything in one go.",
                time: ar ? '~10 دقائق' : '~10 min',
              },
              {
                num: '05', color: '#F97316', icon: Rocket,
                title: ar ? 'النشر التلقائي' : 'Auto-Publish',
                desc: ar
                  ? 'البوستات تُنشر أوتوماتيك في الوقت الأمثل لكل منصة. تقرير الأداء يُعاد لـ Brand Brain لتحسين الحملات القادمة.'
                  : 'Posts publish automatically at the optimal time for each platform. Performance data feeds back into Brand Brain to improve future campaigns.',
                time: ar ? 'أوتوماتيك' : 'Automatic',
              },
            ].map((step, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div className="rounded-2xl p-5 sm:p-6 flex items-start gap-5 group hover:border-opacity-50 transition-all"
                  style={{ background:'rgba(255,255,255,0.025)', border:`1px solid ${step.color}20` }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{ background:`${step.color}15`, border:`1px solid ${step.color}30` }}>
                    <step.icon size={20} style={{ color: step.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <span className="font-mono text-[11px] font-semibold" style={{ color: step.color }}>{step.num}</span>
                      <h3 className="font-bold text-[15px] text-white">{step.title}</h3>
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full ml-auto"
                        style={{ background:`${step.color}12`, color: step.color, border:`1px solid ${step.color}25` }}>
                        {step.time}
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          CONTENT HUB — PLATFORM PREVIEWS
      ══════════════════════════════════ */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 60% 50% at 20% 50%, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal className="text-center mb-14">
            <Label text={ar ? 'Content Hub' : 'CONTENT HUB'} />
            <h2 className="text-[30px] sm:text-[42px] lg:text-[52px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-4">
              {ar
                ? <>شوف بوستاتك كما ستبدو.<br /><span className="text-slate-400">قبل النشر بلحظات.</span></>
                : <>See your posts as they'll look.<br /><span className="text-slate-400">Before they go live.</span></>}
            </h2>
            <p className="text-[16px] text-slate-400 max-w-[520px] mx-auto">
              {ar
                ? 'Content Hub يعرض كل بوست بـ mockup المنصة الحقيقي. أعِد الكتابة بـ AI، اختر الفائز بين A/B، وافق على الكل في دقائق.'
                : 'Content Hub shows every post in its real platform mockup. Rewrite with AI, pick the A/B winner, and approve everything in minutes.'}
            </p>
          </Reveal>

          {/* Mockups */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <Reveal delay={0.1} className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-[12px] font-mono font-semibold text-slate-400">
                <span className="text-[13px]">📸</span> Instagram
              </div>
              <IGMockup
                brand={ar ? 'نيكسوس' : 'Nexus Brand'}
                caption={ar ? 'حوّل استراتيجيتك التسويقية في 30 ثانية. 🚀 جرّب الآن.' : 'Transform your marketing strategy in 30 seconds. 🚀 Try now.'}
                ar={ar}
              />
            </Reveal>
            <Reveal delay={0.2} className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-[12px] font-mono font-semibold text-slate-400">
                <span className="text-[13px]">💼</span> LinkedIn
              </div>
              <LIMockup
                brand={ar ? 'نيكسوس' : 'Nexus Brand'}
                caption={ar ? 'اكتشفنا أن 80% من الشركات الصغيرة تنشر محتوى بدون استراتيجية. هذا يتغير الآن مع AI يتذكر علامتك ويبني خطة كاملة في دقائق.' : "We found that 80% of small businesses post without a strategy. That's changing — with AI that remembers your brand and builds a full plan in minutes."}
                ar={ar}
              />
            </Reveal>
            <Reveal delay={0.3} className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-[12px] font-mono font-semibold text-slate-400">
                <span className="text-[13px]">🎵</span> TikTok
              </div>
              <TKMockup
                brand={ar ? 'نيكسوس' : 'nexusbrand'}
                caption={ar ? 'من brief فارغ لـ 30 بوست في جلسة واحدة ✅ #AIMarketing #تسويق' : 'From blank brief to 30 posts in one session ✅ #AIMarketing #nexus'}
                ar={ar}
              />
            </Reveal>
          </div>

          {/* Features row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Sparkles, color: '#8B5CF6',
                title: ar ? 'AI Rewrite بكبسة' : 'One-click AI Rewrite',
                desc: ar ? 'أي بوست مش عاجبك — انقر ✨ وNEX يكتبه من جديد.' : "Any post you don't like — click ✨ and NEX rewrites it.",
              },
              {
                icon: BarChart3, color: '#22D3EE',
                title: ar ? 'A/B Testing مدمج' : 'Built-in A/B Testing',
                desc: ar ? 'كل بوست له variant. انشر الاثنين، واختر الفائز بناءً على البيانات الحقيقية.' : 'Every post has a variant. Publish both, pick the winner based on real data.',
              },
              {
                icon: CheckCircle, color: '#10B981',
                title: ar ? 'Approve All — شهر كامل في ثوانٍ' : 'Approve All — a full month in seconds',
                desc: ar ? 'راجع كل شيء. موافق؟ اضغط Approve All وتُجدوَل كل البوستات فوراً.' : "Review everything. Happy? Press Approve All and every post gets scheduled instantly.",
              },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="rounded-2xl p-5 h-full" style={{ background:'rgba(255,255,255,0.025)', border:`1px solid ${f.color}15` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background:`${f.color}15` }}>
                    <f.icon size={18} style={{ color: f.color }} />
                  </div>
                  <p className="font-bold text-[14px] text-white mb-1.5">{f.title}</p>
                  <p className="text-[13px] text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          AGENTS
      ══════════════════════════════════ */}
      <section id="agents" className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(139,92,246,0.06) 0%, transparent 60%)' }} />
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal className="text-center mb-14">
            <Label text={ar ? 'فريق الـ AI بتاعك' : 'YOUR AI TEAM'} />
            <h2 className="text-[30px] sm:text-[42px] lg:text-[52px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-4">
              {ar
                ? <>4 وكلاء متخصصون.<br /><span className="text-slate-400">يعملون معاً.</span></>
                : <>4 specialized agents.<br /><span className="text-slate-400">Working together.</span></>}
            </h2>
            <p className="text-[16px] text-slate-400 max-w-[500px] mx-auto">
              {ar
                ? 'كل وكيل متخصص في مجاله — وكلهم يقرأون من نفس Brand Brain. لا تعارض، لا تكرار، لا gap.'
                : "Each agent specializes in what it does best — all reading from the same Brand Brain. No conflicts, no repetition, no gaps."}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {agents.map((a, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="rounded-2xl p-6 h-full group hover:scale-[1.01] transition-transform"
                  style={{ background:'rgba(255,255,255,0.025)', border:`1px solid ${a.color}20` }}>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background:`${a.color}15`, border:`1px solid ${a.color}25` }}>
                      <a.icon size={22} style={{ color: a.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[12px] font-bold" style={{ color: a.color }}>{a.codename}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span className="text-[12px] text-slate-400">{a.role}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] text-emerald-400 font-mono">{ar ? 'نشط' : 'Active'}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] text-slate-400 leading-relaxed mb-4">{a.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {a.skills.map(s => (
                      <span key={s} className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                        style={{ background:`${a.color}10`, color: a.color, border:`1px solid ${a.color}20` }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          NUMBERS
      ══════════════════════════════════ */}
      <div className="py-16 border-y border-[rgba(255,255,255,0.05)]" style={{ background:'rgba(255,255,255,0.01)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: '30s',  label: ar ? 'لتوليد استراتيجية كاملة' : 'to generate a full strategy' },
              { value: '30',   label: ar ? 'بوست في حملة واحدة' : 'posts per campaign' },
              { value: '3',    label: ar ? 'منصات للنشر التلقائي' : 'platforms for auto-publish' },
              { value: '∞',    label: ar ? 'Brand Brain يتطور دائماً' : 'Brand Brain keeps evolving' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div>
                  <p className="font-mono text-[42px] lg:text-[52px] font-extrabold text-white leading-none mb-1.5"
                    style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6,#22D3EE)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                    {s.value}
                  </p>
                  <p className="text-[12px] text-slate-500">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          PRICING
      ══════════════════════════════════ */}
      <section id="pricing" className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal className="text-center mb-14">
            <Label text={ar ? 'الأسعار' : 'PRICING'} />
            <h2 className="text-[30px] sm:text-[42px] lg:text-[50px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-3">
              {ar ? 'سعر واضح. قيمة حقيقية.' : 'Clear price. Real value.'}
            </h2>
            <p className="text-[15px] text-slate-400">
              {ar ? 'ابدأ مجاناً — انتقل للـ Pro عندما تكون جاهزاً.' : 'Start free — upgrade to Pro when you\'re ready.'}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {plans.map((plan, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="rounded-2xl p-6 relative h-full flex flex-col"
                  style={{
                    background: plan.featured ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.025)',
                    border: plan.featured ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: plan.featured ? '0 0 40px rgba(139,92,246,0.12)' : 'none',
                  }}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[11px] font-bold px-3 py-1 rounded-full text-white"
                        style={{ background:'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}>
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <div className="mb-5">
                    <p className="font-mono text-[12px] font-semibold uppercase tracking-[2px] text-slate-400 mb-2">{plan.name}</p>
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-[42px] font-extrabold text-white leading-none">${plan.price}</span>
                      {plan.period && <span className="text-slate-500 text-[14px] pb-1">{plan.period}</span>}
                    </div>
                    <p className="text-[13px] text-slate-400">{plan.desc}</p>
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-[13px] text-slate-300">
                        <Check size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.href}
                    className="block text-center py-3 rounded-xl text-[13px] font-bold transition-all hover:opacity-90"
                    style={{
                      background: plan.featured ? 'linear-gradient(135deg,#7C3AED,#8B5CF6)' : 'rgba(255,255,255,0.06)',
                      color: plan.featured ? '#fff' : '#94A3B8',
                      border: plan.featured ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    }}>
                    {plan.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-6 text-center">
            <p className="text-[12px] text-slate-500">
              {ar
                ? 'جميع الخطط تشمل Brand Brain · النشر التلقائي · العربي والإنجليزي · إلغاء في أي وقت'
                : 'All plans include Brand Brain · Auto-publish · Arabic & English · Cancel anytime'}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════
          FAQ
      ══════════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <Label text={ar ? 'الأسئلة الشائعة' : 'FAQ'} />
            <h2 className="text-[28px] sm:text-[38px] font-extrabold text-white tracking-[-1.5px]">
              {ar ? 'أسئلة في ذهنك؟' : 'Questions in your head?'}
            </h2>
          </Reveal>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <Reveal key={i} delay={i * 0.04}>
                <FAQItem q={f.q} a={f.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          FINAL CTA
      ══════════════════════════════════ */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(139,92,246,0.15) 0%, transparent 70%)',
        }} />
        <div className="relative z-10 max-w-[760px] mx-auto px-4 sm:px-6 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-purple-300">
                {ar ? 'جاهز؟' : 'Ready?'}
              </span>
            </div>
            <h2 className="text-[34px] sm:text-[52px] lg:text-[62px] font-extrabold text-white leading-[1.06] tracking-[-2.5px] mb-5">
              {ar
                ? <>علامتك التجارية<br /><span style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6,#22D3EE,#10B981)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>تستحق أكثر من هذا.</span></>
                : <>Your brand deserves<br /><span style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6,#22D3EE,#10B981)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>better than this.</span></>}
            </h2>
            <p className="text-[16px] sm:text-[18px] text-slate-400 mb-9 leading-relaxed">
              {ar
                ? 'Stop posting randomly. Stop paying for tools that don\'t talk to each other. ابدأ بـ NEXUS — AI يتذكر علامتك، يبني الاستراتيجية، وينشر المحتوى بينما أنت تركز على البيزنس.'
                : "Stop posting randomly. Stop paying for tools that don't talk to each other. Start with NEXUS — AI that remembers your brand, builds the strategy, and publishes content while you focus on the business."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-7">
              <Link href="/auth/register"
                className="inline-flex items-center gap-2 text-[15px] font-bold text-white px-8 py-4 rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all"
                style={{ background:'linear-gradient(135deg,#7C3AED,#8B5CF6,#06B6D4)', boxShadow:'0 0 50px rgba(139,92,246,0.4)' }}>
                {ar ? 'ابدأ مجاناً الآن' : 'Start Free Now'} <ArrowRight size={18} />
              </Link>
            </div>
            <p className="text-[12px] text-slate-500">
              {ar ? 'لا بطاقة ائتمان · 20 رصيد AI مجاناً · حملة كاملة من الأولى' : 'No credit card · 20 free AI credits · Full campaign from day one'}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════
          FOOTER
      ══════════════════════════════════ */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] py-10">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[17px] text-white tracking-tight">NEXUS</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background:'linear-gradient(135deg,#8B5CF6,#22D3EE)' }}>AI</span>
            </div>
            <div className="flex items-center gap-5 text-[12px] text-slate-500">
              <Link href="/privacy-policy" className="hover:text-white transition-colors">{ar ? 'الخصوصية' : 'Privacy'}</Link>
              <Link href="/terms-of-service" className="hover:text-white transition-colors">{ar ? 'الشروط' : 'Terms'}</Link>
              <button onClick={() => setLang(ar ? 'en' : 'ar')} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Globe size={11} />{ar ? 'English' : 'العربية'}
              </button>
            </div>
            <p className="text-[11px] text-slate-600">
              © 2025 NEXUS AI · {ar ? 'جميع الحقوق محفوظة' : 'All rights reserved'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
