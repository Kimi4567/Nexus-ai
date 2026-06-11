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

function CommandCenterVisual({ ar, steps }: {
  ar: boolean
  steps: { icon: ElementType; label: string; status: string; color: string }[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[650px] lg:max-w-none"
    >
      <div className="absolute -inset-8 rounded-[42px] blur-3xl opacity-60" style={{ background: 'radial-gradient(circle at 40% 45%, rgba(139,92,246,0.28), transparent 45%), radial-gradient(circle at 75% 62%, rgba(34,211,238,0.18), transparent 42%), radial-gradient(circle at 20% 82%, rgba(16,185,129,0.12), transparent 36%)' }} />
      <div className="absolute inset-x-8 top-8 h-px opacity-70" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.75), rgba(34,211,238,0.55), transparent)' }} />

      <div className="relative rounded-[28px] p-3 sm:p-4" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 35px 90px rgba(0,0,0,0.45)' }}>
        <div className="rounded-[22px] overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(8,10,33,0.96), rgba(7,8,27,0.92))', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_14px_rgba(139,92,246,0.8)]" />
              <span className="font-mono text-[10px] font-bold tracking-[2px] text-slate-400">NEXUS COMMAND CENTER</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {ar ? 'مباشر' : 'LIVE'}
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[2px] text-slate-500">{ar ? 'خطة الشهر' : 'Monthly plan'}</p>
                  <p className="text-[20px] font-extrabold text-white">{ar ? '30 بوست جاهز' : '30 posts ready'}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl grid place-items-center" style={{ background: 'conic-gradient(from 20deg,#8B5CF6,#22D3EE,#10B981,#8B5CF6)' }}>
                  <div className="w-10 h-10 rounded-xl bg-[#07081d] grid place-items-center">
                    <Sparkles size={18} className="text-white" />
                  </div>
                </div>
              </div>
              <div className="h-[150px] rounded-xl relative overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.09), rgba(34,211,238,0.02))' }}>
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 150" fill="none" aria-hidden="true">
                  <path d="M16 118 C55 92 71 102 103 76 C139 46 159 63 190 48 C235 25 254 71 293 46 C319 30 336 23 350 18" stroke="url(#heroLine)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M16 118 C55 92 71 102 103 76 C139 46 159 63 190 48 C235 25 254 71 293 46 C319 30 336 23 350 18" stroke="white" strokeOpacity="0.14" strokeWidth="10" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="heroLine" x1="16" y1="118" x2="350" y2="18" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#8B5CF6" />
                      <stop offset="0.55" stopColor="#22D3EE" />
                      <stop offset="1" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-2">
                  {[
                    { platform: 'Instagram', count: '12', accent: '#EC4899', label: ar ? 'إعلان' : 'Ad' },
                    { platform: 'LinkedIn', count: '9', accent: '#22D3EE', label: ar ? 'بوست' : 'Post' },
                    { platform: 'TikTok', count: '9', accent: '#8B5CF6', label: ar ? 'فيديو' : 'Video' },
                  ].map((item) => (
                    <div key={item.platform} className="rounded-lg px-2 py-2 overflow-hidden relative" style={{ background: 'rgba(7,8,29,0.82)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div className="h-10 rounded-md mb-1.5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${item.accent}, #0f172a)` }}>
                        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                        <span className="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[7px] font-bold text-white bg-black/35">{item.label}</span>
                      </div>
                      <p className="text-[9px] text-slate-500">{item.platform}</p>
                      <p className="text-[13px] font-bold text-white">{item.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-mono uppercase tracking-[2px] text-slate-500">AI AGENTS</p>
                  <span className="text-[10px] text-emerald-300">{ar ? 'متصل' : 'Connected'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['NEXUS', 'NEX', 'VEX', 'SENTINEL'].map((name, i) => (
                    <div key={name} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.035)', border: `1px solid ${['#8B5CF6', '#22D3EE', '#F97316', '#10B981'][i]}22` }}>
                      <span className="font-mono text-[10px] font-bold" style={{ color: ['#8B5CF6', '#22D3EE', '#F97316', '#10B981'][i] }}>{name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[11px] font-mono uppercase tracking-[2px] text-slate-500 mb-3">{ar ? 'التنفيذ' : 'Execution'}</p>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg grid place-items-center" style={{ background: `${step.color}14`, border: `1px solid ${step.color}22` }}>
                        <step.icon size={13} style={{ color: step.color }} />
                      </div>
                      <span className="text-[11px] text-slate-300 flex-1">{step.label}</span>
                      <span className="text-[9px] font-mono" style={{ color: step.color }}>{step.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden">
          <p className="mb-3 text-center font-mono text-[10px] font-bold uppercase tracking-[2px] text-slate-500">
            {ar ? 'منشورات جاهزة كما تظهر على المنصات' : 'Ready-to-publish social posts'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(12,12,15,0.96)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 18px 46px rgba(0,0,0,0.34)' }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
              <span className="h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#F97316,#EC4899,#8B5CF6)' }}>N</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold leading-none text-white">luna.restaurant</p>
                <p className="text-[8px] leading-none text-slate-500 mt-1">{ar ? 'إعلان ممول' : 'Sponsored'}</p>
              </div>
              <span className="ml-auto text-[13px] text-slate-500">•••</span>
            </div>
            <div className="aspect-[4/3] relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#180b12 0%,#3b1d12 42%,#071827 100%)' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 58% 46%, rgba(251,191,36,0.42), transparent 23%), radial-gradient(circle at 28% 28%, rgba(236,72,153,0.28), transparent 28%)' }} />
              <div className="absolute left-1/2 top-[46%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle,#f8e7bd 0%,#d97706 38%,#451a03 70%)', boxShadow: '0 0 40px rgba(251,191,36,0.4)' }} />
              <div className="absolute left-[28%] top-[36%] h-7 w-16 rotate-[-18deg] rounded-full bg-emerald-300/70 blur-[1px]" />
              <div className="absolute right-[23%] top-[58%] h-6 w-14 rotate-[18deg] rounded-full bg-orange-300/80 blur-[1px]" />
              <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                <span className="rounded-full bg-black/45 px-2 py-0.5 text-[7px] font-bold text-white backdrop-blur-sm">{ar ? 'عرض العشاء' : 'Dinner offer'}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[7px] font-extrabold text-slate-950">20% OFF</span>
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="flex items-center gap-3 text-[13px] text-white">
                <span>♡</span><span>💬</span><span>↗</span>
                <span className="ml-auto">🔖</span>
              </div>
              <p className="mt-1.5 text-[9px] font-bold text-white">2,418 likes</p>
              <p className="mt-1 text-[9px] leading-tight text-slate-300">
                <span className="font-bold text-white">luna.restaurant </span>
                {ar ? 'ليلة مميزة تبدأ بطبق لا يُنسى. احجز الآن.' : 'A dinner worth posting about. Reserve your table tonight.'}
              </p>
              <p className="mt-1 text-[8px] text-slate-600">{ar ? 'عرض 63 تعليقاً' : 'View 63 comments'}</p>
            </div>
          </div>
            </motion.div>

            <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
              <div className="rounded-2xl p-2" style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 18px 46px rgba(0,0,0,0.34)' }}>
            <div className="h-[250px] rounded-xl relative overflow-hidden" style={{ background: 'linear-gradient(180deg,#06131f,#020617)' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 52% 28%, rgba(14,165,233,0.34), transparent 30%), radial-gradient(circle at 58% 74%, rgba(16,185,129,0.28), transparent 34%)' }} />
              <div className="absolute inset-x-4 top-5 h-[126px] rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f172a,#1d4ed8 48%,#10b981)', border: '1px solid rgba(255,255,255,0.22)' }}>
                <div className="absolute bottom-0 left-3 h-16 w-20 rounded-t-xl bg-white/18" />
                <div className="absolute bottom-0 right-4 h-24 w-14 rounded-t-lg bg-white/24" />
                <div className="absolute left-4 top-4 rounded-full bg-black/40 px-2 py-0.5 text-[7px] font-bold text-white">NEW LISTING</div>
              </div>
              <Play size={24} fill="white" className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.65)]" />
              <div className="absolute right-2 top-[48%] -translate-y-1/2 flex flex-col items-center gap-2 text-white">
                {[
                  ['♡', '12.4K'],
                  ['💬', '284'],
                  ['↗', '1.2K'],
                ].map(([icon, count]) => (
                  <div key={icon} className="text-center leading-none">
                    <div className="text-[14px]">{icon}</div>
                    <div className="text-[7px] font-bold mt-1">{count}</div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-4 left-3 right-8">
                <span className="block text-[10px] font-bold text-white">@primehomes</span>
                <span className="block text-[9px] leading-tight text-slate-300">{ar ? 'جولة سريعة داخل فيلا جديدة على البحر.' : 'Quick tour of a new waterfront villa.'}</span>
                <span className="mt-1 block text-[8px] text-slate-500">♪ {ar ? 'صوت أصلي' : 'Original sound'}</span>
              </div>
            </div>
          </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function SocialPostCards({ ar }: { ar: boolean }) {
  return (
    <div className="my-5 max-w-[620px]">
      <p className={`mb-3 font-mono text-[10px] font-bold uppercase tracking-[2px] text-slate-500 ${ar ? 'text-right' : 'text-left'}`}>
        {ar ? 'منشورات جاهزة كما تظهر على المنصات' : 'Ready-to-publish social posts'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(12,12,15,0.96)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 18px 46px rgba(0,0,0,0.34)' }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
              <span className="h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#F97316,#EC4899,#8B5CF6)' }}>L</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold leading-none text-white">luna.restaurant</p>
                <p className="text-[8px] leading-none text-slate-500 mt-1">{ar ? 'إعلان ممول' : 'Sponsored'}</p>
              </div>
              <span className="ml-auto text-[13px] text-slate-500">•••</span>
            </div>
            <div className="aspect-video relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#180b12 0%,#3b1d12 42%,#071827 100%)' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 58% 46%, rgba(251,191,36,0.42), transparent 23%), radial-gradient(circle at 28% 28%, rgba(236,72,153,0.28), transparent 28%)' }} />
              <div className="absolute left-1/2 top-[48%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle,#f8e7bd 0%,#d97706 38%,#451a03 70%)', boxShadow: '0 0 40px rgba(251,191,36,0.4)' }} />
              <div className="absolute left-[28%] top-[36%] h-7 w-16 rotate-[-18deg] rounded-full bg-emerald-300/70 blur-[1px]" />
              <div className="absolute right-[23%] top-[58%] h-6 w-14 rotate-[18deg] rounded-full bg-orange-300/80 blur-[1px]" />
              <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                <span className="rounded-full bg-black/45 px-2 py-0.5 text-[7px] font-bold text-white backdrop-blur-sm">{ar ? 'عرض العشاء' : 'Dinner offer'}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[7px] font-extrabold text-slate-950">20% OFF</span>
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="flex items-center gap-3 text-[13px] text-white">
                <span>♡</span><span>💬</span><span>↗</span>
                <span className="ml-auto">🔖</span>
              </div>
              <p className="mt-1.5 text-[9px] font-bold text-white">2,418 likes</p>
              <p className="mt-1 text-[9px] leading-tight text-slate-300">
                <span className="font-bold text-white">luna.restaurant </span>
                {ar ? 'ليلة مميزة تبدأ بطبق لا يُنسى. احجز الآن.' : 'A dinner worth posting about. Reserve your table tonight.'}
              </p>
              <p className="mt-1 text-[8px] text-slate-600">{ar ? 'عرض 63 تعليقاً' : 'View 63 comments'}</p>
            </div>
          </div>
        </motion.div>

        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="rounded-2xl p-2" style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 18px 46px rgba(0,0,0,0.34)' }}>
            <div className="h-[190px] rounded-xl relative overflow-hidden" style={{ background: 'linear-gradient(180deg,#06131f,#020617)' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 52% 28%, rgba(14,165,233,0.34), transparent 30%), radial-gradient(circle at 58% 74%, rgba(16,185,129,0.28), transparent 34%)' }} />
              <div className="absolute inset-x-4 top-4 h-[92px] rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f172a,#1d4ed8 48%,#10b981)', border: '1px solid rgba(255,255,255,0.22)' }}>
                <div className="absolute bottom-0 left-3 h-16 w-20 rounded-t-xl bg-white/18" />
                <div className="absolute bottom-0 right-4 h-24 w-14 rounded-t-lg bg-white/24" />
                <div className="absolute left-4 top-4 rounded-full bg-black/40 px-2 py-0.5 text-[7px] font-bold text-white">NEW LISTING</div>
              </div>
              <Play size={24} fill="white" className="absolute left-1/2 top-[33%] -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.65)]" />
              <div className="absolute right-2 top-[48%] -translate-y-1/2 flex flex-col items-center gap-2 text-white">
                {[
                  ['♡', '12.4K'],
                  ['💬', '284'],
                  ['↗', '1.2K'],
                ].map(([icon, count]) => (
                  <div key={icon} className="text-center leading-none">
                    <div className="text-[14px]">{icon}</div>
                    <div className="text-[7px] font-bold mt-1">{count}</div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-4 left-3 right-8">
                <span className="block text-[10px] font-bold text-white">@primehomes</span>
                <span className="block text-[9px] leading-tight text-slate-300">{ar ? 'جولة سريعة داخل فيلا جديدة على البحر.' : 'Quick tour of a new waterfront villa.'}</span>
                <span className="mt-1 block text-[8px] text-slate-500">♪ {ar ? 'صوت أصلي' : 'Original sound'}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
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
        : ['Instagram', 'LinkedIn', 'TikTok', 'Brand voice injection', 'Arabic & English', 'One-click AI Rewrite'],
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
      desc: ar
        ? 'اكتشف القوة الكاملة بدون بطاقة ائتمان.'
        : 'Explore the full power. No credit card needed.',
      features: ar
        ? [
            '10 رصيد AI للتجربة',
            '1 workspace · 1 حملة كاملة',
            'استراتيجية + محتوى + صور',
            'Brand Brain (قراءة وكتابة)',
            '3 بوستات / شهر',
          ]
        : [
            '10 AI credits to explore',
            '1 workspace · 1 full campaign',
            'Strategy + content + images',
            'Brand Brain (read & write)',
            '3 posts / month',
          ],
      upgradeHint: null,
      cta: ar ? 'ابدأ مجاناً' : 'Start Free',
      href: '/auth/register',
      featured: false,
    },
    {
      name: ar ? 'ستارتر' : 'Starter',
      price: '19',
      period: ar ? '/شهر' : '/mo',
      badge: '',
      desc: ar
        ? 'للأفراد وأصحاب المشاريع الناشئة.'
        : 'For individuals and early-stage businesses.',
      features: ar
        ? [
            '50 رصيد AI — يتجدد شهرياً',
            '1 workspace · 2 حملة / شهر',
            '10 بوستات / شهر · منصتين',
            'Brand Brain الكامل + الوكلاء',
            'تصدير PDF + DOCX',
          ]
        : [
            '50 AI credits — renews monthly',
            '1 workspace · 2 campaigns / month',
            '10 posts / month · 2 platforms',
            'Full Brand Brain + all agents',
            'PDF + DOCX export',
          ],
      upgradeHint: ar
        ? '⚠️ 10 بوستات / شهر أقل من عتبة الـ 16 بوست الضرورية لمضاعفة الـ leads 4.5×. Growth يتجاوزها.'
        : '⚠️ 10 posts/mo is below the 16-post threshold for 4.5× more leads. Growth crosses it.',
      cta: ar ? 'ابدأ Starter — $19/شهر' : 'Start Starter — $19/mo',
      href: '/auth/register',
      featured: false,
    },
    {
      name: ar ? 'جروث' : 'Growth',
      price: '49',
      period: ar ? '/شهر' : '/mo',
      badge: ar ? 'الأكثر شيوعاً' : 'Most popular',
      desc: ar
        ? 'تجاوز عتبة الـ 16 بوست وضاعف النتائج 4.5×.'
        : 'Cross the 16-post threshold. 4.5× more leads.',
      features: ar
        ? [
            '150 رصيد AI — يتجدد شهرياً',
            '3 workspaces · 5 حملات / شهر',
            '25 بوست / شهر · 4 منصات',
            'Brand Brain الكامل + كل الوكلاء',
            'تقويم محتوى 4 أسابيع كامل',
            'A/B Testing + AI Rewrite',
            'لوحة تحليلات + تصدير',
          ]
        : [
            '150 AI credits — renews monthly',
            '3 workspaces · 5 campaigns / month',
            '25 posts / month · 4 platforms',
            'Full Brand Brain + all agents',
            'Full 4-week content calendar',
            'A/B Testing + AI Rewrite',
            'Analytics dashboard + export',
          ],
      upgradeHint: null,
      cta: ar ? 'ابدأ Growth — $49/شهر' : 'Start Growth — $49/mo',
      href: '/auth/register',
      featured: true,
    },
    {
      name: ar ? 'أيجنسي' : 'Agency',
      price: '99',
      period: ar ? '/شهر' : '/mo',
      badge: '',
      desc: ar
        ? 'للوكالات وفرق التسويق المتخصصة.'
        : 'For agencies and dedicated marketing teams.',
      features: ar
        ? [
            '500 رصيد AI — يتجدد شهرياً',
            '10 workspaces · حملات غير محدودة',
            '60 بوست / شهر · 6 منصات',
            'تصدير White-label بشعارك',
            '4 أسابيع تقويم · 4 شرائح جمهور',
            'Priority support',
          ]
        : [
            '500 AI credits — renews monthly',
            '10 workspaces · unlimited campaigns',
            '60 posts / month · 6 platforms',
            'White-label exports (your logo)',
            '4-week calendar · 4 audience segments',
            'Priority support',
          ],
      upgradeHint: null,
      cta: ar ? 'ابدأ Agency — $99/شهر' : 'Start Agency — $99/mo',
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

        <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 w-full pt-16 lg:pt-24 pb-16">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-8 items-center">
            <div className={ar ? 'text-right' : 'text-left'}>
              <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.5 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.08)] mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[2.5px] text-emerald-400">
                  {ar ? 'قسم التسويق الذكي بالكامل' : 'YOUR COMPLETE AI MARKETING DEPARTMENT'}
                </span>
              </motion.div>

              <motion.h1 initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25, duration:0.65 }}
                className="text-[42px] sm:text-[58px] lg:text-[70px] font-extrabold leading-[1.04] tracking-[-3px] mb-6">
                {ar ? (
                  <>
                    فريق التسويق<br />
                    <span style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6 0%,#22D3EE 50%,#10B981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                      الذي لا تقدر عليه —
                    </span>
                    <br />حتى الآن.
                  </>
                ) : (
                  <>
                    The marketing team<br />
                    <span style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6 0%,#22D3EE 50%,#10B981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                      you couldn&apos;t afford —
                    </span>
                    <br />until now.
                  </>
                )}
              </motion.h1>

              <motion.p initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.45, duration:0.6 }}
                className="text-[17px] sm:text-[20px] text-slate-400 leading-relaxed max-w-[620px] mb-3">
                {ar
                  ? 'NEXUS يبني استراتيجيتك، يكتب ٣٠ بوست مخصص لكل منصة، وينشرها تلقائياً — بدل $٥٠٠٠/شهر لوكالة.'
                  : 'NEXUS builds your strategy, writes 30 posts tailored to every platform, and publishes them automatically — instead of $5,000/month for an agency.'}
              </motion.p>
              <motion.p initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5, duration:0.6 }}
                className="text-[14px] text-slate-500 leading-relaxed max-w-[520px] mb-9">
                {ar
                  ? '⚡ من الفكرة إلى ٣٠ بوست مجدول في ٢٠ دقيقة.'
                  : '⚡ From idea to 30 scheduled posts in 20 minutes.'}
              </motion.p>

              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.65, duration:0.5 }}
                className="flex flex-wrap items-center gap-4 mb-6">
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

              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.85, duration:0.5 }}
                className="flex items-center gap-4 text-[12px] text-slate-500 flex-wrap">
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

            <CommandCenterVisual ar={ar} steps={pipelineSteps} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          CAPABILITIES BAR (honest product specs)
      ══════════════════════════════════ */}
      <div className="border-y border-[rgba(255,255,255,0.05)]" style={{ background:'rgba(255,255,255,0.015)' }}>
        <div className="max-w-[1100px] mx-auto px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { num: '30+', labelAr: 'بوست / حملة', labelEn: 'posts per campaign' },
              { num: '4', labelAr: 'وكلاء AI متخصصون', labelEn: 'specialized AI agents' },
              { num: '10×', labelAr: 'أقل تكلفة من أي وكالة', labelEn: 'cheaper than an agency' },
              { num: '< 20 min', labelAr: 'من الفكرة لأول بوست منشور', labelEn: 'from idea to first published post' },
            ].map(stat => (
              <div key={stat.num} className="flex flex-col items-center gap-1">
                <span className="text-[22px] sm:text-[28px] font-extrabold text-white tracking-tight">{stat.num}</span>
                <span className="text-[11px] text-slate-500">{ar ? stat.labelAr : stat.labelEn}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          PAIN SECTION
      ══════════════════════════════════ */}
      <section className="py-16 lg:py-24 relative overflow-hidden">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <Label text={ar ? 'المشكلة' : 'THE PROBLEM'} />
            <h2 className="text-[28px] sm:text-[38px] lg:text-[46px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-3">
              {ar ? 'التسويق مكسور للمؤسسين.' : 'Marketing is broken for founders.'}
            </h2>
            <p className="text-[15px] text-slate-400 max-w-[520px] mx-auto">
              {ar ? 'عندك ٣ خيارات. كل واحد له ثمنه.' : 'You have 3 options. Each one costs you something.'}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {[
              {
                icon: '🏢',
                titleAr: 'وكالة تسويق',
                titleEn: 'Marketing Agency',
                costAr: '$3,000 – $10,000+ / شهر',
                costEn: '$3,000 – $10,000+ / month',
                problemsAr: ['تكلفة ثابتة حتى لو البيزنس صغير', '٢-٤ أسابيع للبوست الأول', 'تشرح علامتك من جديد كل شهر', 'بعيدة عن نبض علامتك اليومي'],
                problemsEn: ['Fixed overhead even in slow months', '2-4 weeks to see first post', 'Re-brief them on your brand every month', 'Never as close to your brand as you are'],
                accent: '#F43F5E',
              },
              {
                icon: '🤖',
                titleAr: 'ChatGPT / أدوات AI عشوائية',
                titleEn: 'ChatGPT / Generic AI',
                costAr: 'بدون ذاكرة، بدون استراتيجية',
                costEn: 'No memory, no strategy',
                problemsAr: ['ينسى علامتك في كل جلسة', 'محتوى عام بدون هوية', 'لا يستطيع النشر تلقائياً', 'أنت من يكتب كل الـ prompts بنفسك'],
                problemsEn: ['Forgets your brand every session', 'Generic output with no identity', 'Cannot publish anything for you', 'You write every single prompt yourself'],
                accent: '#F97316',
              },
              {
                icon: '😰',
                titleAr: 'بنفسك',
                titleEn: 'Do It Yourself',
                costAr: '٢٠+ ساعة / أسبوع من وقتك',
                costEn: '20+ hours / week of your time',
                problemsAr: ['يتوقف حين تنشغل', 'لست متخصصاً في التسويق', 'لا وقت لبيزنسك الفعلي', 'بدون استراتيجية — مجرد تخمين'],
                problemsEn: ['Stops the moment you get busy', 'You\'re a founder, not a marketer', 'No time left for your actual product', 'No strategy — just guessing'],
                accent: '#EAB308',
              },
            ].map((opt, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="rounded-2xl p-5 h-full"
                  style={{ background:`${opt.accent}06`, border:`1px solid ${opt.accent}18` }}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <h3 className="font-bold text-[15px] text-white">{ar ? opt.titleAr : opt.titleEn}</h3>
                      <span className="text-[11px] font-mono" style={{ color: opt.accent }}>{ar ? opt.costAr : opt.costEn}</span>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {(ar ? opt.problemsAr : opt.problemsEn).map(p => (
                      <li key={p} className="flex items-start gap-2 text-[12px] text-slate-400">
                        <AlertCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: opt.accent }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="text-center">
            <div className="inline-flex items-center gap-3 px-5 py-3.5 rounded-2xl"
              style={{ background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)' }}>
              <Sparkles size={18} style={{ color:'#8B5CF6' }} />
              <p className="text-[14px] font-semibold text-white">
                {ar
                  ? 'الخيار الرابع: قسم تسويق AI كامل بأقل من $30/شهر.'
                  : 'The fourth option: a full AI marketing department for under $30/month.'}
              </p>
              <ArrowRight size={16} style={{ color:'#8B5CF6' }} />
            </div>
          </Reveal>
        </div>
      </section>

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
          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="absolute inset-0 -z-10 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(139,92,246,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.1) 1px, transparent 1px)', backgroundSize: '56px 56px', maskImage: 'radial-gradient(circle at center, black, transparent 72%)' }} />
            {[
              { icon: '🏷️', title: ar ? 'هوية العلامة' : 'Brand Identity',  desc: ar ? 'الاسم، الوصف، الفئة' : 'Name, tagline, category' },
              { icon: '🎙️', title: ar ? 'الصوت والأسلوب' : 'Voice & Tone',   desc: ar ? 'كيف تتحدث علامتك' : 'How your brand speaks' },
              { icon: '🎯', title: ar ? 'الجمهور المستهدف' : 'Target Audience', desc: ar ? 'من تخاطب' : "Who you're talking to" },
              { icon: '⚔️', title: ar ? 'المنافسون' : 'Competitors',      desc: ar ? 'من تتفوق عليهم' : "Who you're beating" },
              { icon: '💡', title: ar ? 'القيمة الفريدة' : 'Unique Value', desc: ar ? 'لماذا تفوز' : 'Why you win' },
              { icon: '📣', title: ar ? 'الخطافات الرابحة' : 'Winning Hooks', desc: ar ? 'ما يحوّل' : 'What converts' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="relative rounded-2xl p-5 h-full overflow-hidden group transition-all hover:-translate-y-1"
                  style={{ background:'linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))', border:'1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.16)' }}>
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[40px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'radial-gradient(circle at top right, rgba(139,92,246,0.26), transparent 68%)' }} />
                  <div className="flex items-center gap-3">
                    <div className="text-2xl w-11 h-11 rounded-xl grid place-items-center" style={{ background: 'rgba(139,92,246,0.09)', border: '1px solid rgba(139,92,246,0.18)' }}>{s.icon}</div>
                    <div>
                      <p className="font-semibold text-[14px] text-white mb-1">{s.title}</p>
                      <p className="text-[12px] text-slate-500 leading-snug">{s.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          PIPELINE
      ══════════════════════════════════ */}
      <section id="pipeline" className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 50% 40% at 80% 50%, rgba(34,211,238,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal className="text-center mb-16">
            <Label text={ar ? 'كيف يعمل' : 'How It Works'} />
            <h2 className="text-[30px] sm:text-[42px] lg:text-[52px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-4">
              {ar ? 'Brief واحد. شهر تسويق كامل. جاهز للنشر.' : 'One brief. A full month of marketing. Ready to publish.'}
            </h2>
          </Reveal>

          {/* Steps */}
          <div className="relative grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="hidden md:block absolute left-[8%] right-[8%] top-[44px] h-px" style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.2), rgba(34,211,238,0.45), rgba(16,185,129,0.25), rgba(249,115,22,0.3))' }} />
            {[
              {
                num: '01', color: '#8B5CF6', icon: Brain,
                title: ar ? 'Brand Brain' : 'Brand Brain',
                status: ar ? 'جاهز' : 'Ready',
              },
              {
                num: '02', color: '#818CF8', icon: Target,
                title: ar ? 'Strategy' : 'Strategy',
                status: ar ? 'مولّدة' : 'Generated',
              },
              {
                num: '03', color: '#22D3EE', icon: LayoutGrid,
                title: ar ? 'Content Hub — 30 بوست' : 'Content Hub — 30 posts',
                status: ar ? '30 بوست' : '30 posts',
              },
              {
                num: '04', color: '#34D399', icon: Eye,
                title: ar ? 'Approved' : 'Approved',
                status: ar ? 'تم' : 'Done',
              },
              {
                num: '05', color: '#F97316', icon: Rocket,
                title: ar ? 'Published' : 'Published',
                status: ar ? 'مباشر' : 'Live',
              },
            ].map((step, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div className="relative rounded-2xl p-5 text-center h-full group hover:-translate-y-1 transition-transform"
                  style={{ background:'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018))', border:`1px solid ${step.color}24` }}>
                  <div className="relative z-10 mx-auto mb-4 w-[72px] h-[72px] rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform"
                    style={{ background:`linear-gradient(145deg, ${step.color}22, rgba(255,255,255,0.03))`, border:`1px solid ${step.color}36`, boxShadow: `0 0 35px ${step.color}16` }}>
                    <step.icon size={20} style={{ color: step.color }} />
                  </div>
                  <span className="font-mono text-[11px] font-semibold" style={{ color: step.color }}>{step.num}</span>
                  <h3 className="font-bold text-[15px] text-white mt-2">{step.title}</h3>
                  <span className="inline-flex mt-3 text-[11px] font-mono px-2.5 py-0.5 rounded-full"
                    style={{ background:`${step.color}12`, color: step.color, border:`1px solid ${step.color}25` }}>
                    {step.status}
                  </span>
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
            <Label text={ar ? 'الفريق' : 'THE TEAM'} />
            <h2 className="text-[30px] sm:text-[42px] lg:text-[52px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-4">
              {ar ? '4 وكلاء AI. مهمة واحدة: تنمية علامتك.' : '4 AI agents. One mission: grow your brand.'}
            </h2>
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
          SESSION DEMO (product capabilities — no fake metrics)
      ══════════════════════════════════ */}
      <section className="py-16 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(16,185,129,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-10">
            <Label text={ar ? 'كيف يبدو النظام فعلياً' : 'WHAT A SESSION LOOKS LIKE'} />
            <h2 className="text-[28px] sm:text-[38px] lg:text-[46px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-3">
              {ar ? 'من فكرة إلى ٣٠ بوست مجدول في ٢٠ دقيقة.' : 'From idea to 30 scheduled posts in 20 minutes.'}
            </h2>
            <p className="text-[14px] text-slate-500">
              {ar ? 'هذه هي الخطوات الفعلية داخل NEXUS — بدون مبالغة.' : 'These are the real steps inside NEXUS — no exaggeration.'}
            </p>
          </Reveal>

          <Reveal>
            <div className="rounded-2xl overflow-hidden" style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.08)' }}>
              {/* Timeline steps */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-white/5">
                {[
                  { time: ar ? 'الدقيقة ١' : 'Min 1', action: ar ? 'تملأ Brand Brain — اسم، أسلوب، جمهور' : 'Fill Brand Brain — name, tone, audience', color:'#8B5CF6' },
                  { time: ar ? 'الدقيقة ٢' : 'Min 2', action: ar ? 'تنشئ حملة — عنوان + هدف' : 'Create campaign — title + goal', color:'#22D3EE' },
                  { time: ar ? 'الدقيقة ٥' : 'Min 5', action: ar ? 'NEXUS يولد استراتيجية كاملة + خطة محتوى ٣٠ بوست' : 'NEXUS generates full strategy + 30-post content plan', color:'#10B981' },
                  { time: ar ? 'الدقيقة ٢٠' : 'Min 20', action: ar ? 'تراجع، تعدّل، توافق، وتجدول الكل تلقائياً' : 'Review, edit, approve, and auto-schedule everything', color:'#F97316' },
                ].map((t, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-xl p-4"
                    style={{ background:`${t.color}06`, border:`1px solid ${t.color}15` }}>
                    <span className="text-[11px] font-mono font-bold" style={{ color: t.color }}>{t.time}</span>
                    <p className="text-[12px] text-slate-300 leading-snug">{t.action}</p>
                  </div>
                ))}
              </div>
              {/* What you get */}
              <div className="p-6">
                <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mb-4">
                  {ar ? 'ماذا تحصل في نهاية الجلسة' : 'What you get at the end of the session'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { icon:'📋', label: ar ? 'استراتيجية تسويق كاملة' : 'Full marketing strategy', color:'#8B5CF6' },
                    { icon:'📝', label: ar ? '٣٠ بوست مكتوب ومصنّف' : '30 written & categorized posts', color:'#22D3EE' },
                    { icon:'🖼️', label: ar ? 'صور AI لكل بوست' : 'AI-generated images per post', color:'#10B981' },
                    { icon:'📅', label: ar ? 'جدولة تلقائية للنشر' : 'Auto-scheduled publishing', color:'#F97316' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                      style={{ background:`${item.color}07`, border:`1px solid ${item.color}15` }}>
                      <span className="text-lg">{item.icon}</span>
                      <p className="text-[11px] text-slate-300 leading-snug">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════
          COMPARISON TABLE (honest pricing comparisons)
      ══════════════════════════════════ */}
      <section className="py-8 lg:py-12">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-6 py-4 text-center" style={{ background:'rgba(139,92,246,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <p className="font-bold text-white text-[15px]">
                  {ar ? 'NEXUS مقابل البدائل — مقارنة واضحة' : 'NEXUS vs the alternatives — an honest comparison'}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.015)' }}>
                      <th className="px-5 py-3 text-left text-slate-500 font-semibold">{ar ? 'المقارنة' : 'Feature'}</th>
                      <th className="px-5 py-3 text-center font-bold" style={{ color:'#8B5CF6' }}>NEXUS Growth ($49)</th>
                      <th className="px-5 py-3 text-center text-slate-500 font-medium">{ar ? 'وكالة تسويق' : 'Agency'}</th>
                      <th className="px-5 py-3 text-center text-slate-500 font-medium">{ar ? 'ChatGPT' : 'ChatGPT'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: ar ? 'التكلفة الشهرية' : 'Monthly cost', nexus: '$49', agency: ar ? '$3,000 – $10,000' : '$3,000 – $10,000', diy: ar ? 'مجاني لكن وقتك ثمين' : 'Free but your time has value' },
                      { feature: ar ? 'الوقت للبوست الأول' : 'Time to first post', nexus: ar ? '< ٢٠ دقيقة' : '< 20 min', agency: ar ? '٢–٤ أسابيع' : '2–4 weeks', diy: ar ? 'فوري لكن بدون استراتيجية' : 'Instant but no strategy' },
                      { feature: ar ? 'ذاكرة علامتك (Brand Brain)' : 'Brand memory (Brand Brain)', nexus: '✅ دائمة', agency: ar ? '⚠️ تحتاج re-brief كل شهر' : '⚠️ Re-brief every month', diy: ar ? '❌ تنسى بعد كل جلسة' : '❌ Resets every session' },
                      { feature: ar ? 'النشر التلقائي' : 'Auto-publishing', nexus: '✅', agency: ar ? '❌ يرسلون لك الملفات' : '❌ They send you files', diy: '❌' },
                      { feature: ar ? 'دعم العربية' : 'Arabic support', nexus: ar ? '✅ أصيل' : '✅ Native', agency: ar ? '⚠️ حسب الوكالة' : '⚠️ Varies', diy: ar ? '⚠️ جزئي' : '⚠️ Partial' },
                      { feature: ar ? 'عدد البوستات/شهر' : 'Posts/month', nexus: ar ? '٣٠+ لكل حملة' : '30+ per campaign', agency: ar ? '٨–١٢ عادةً' : '8–12 typically', diy: ar ? 'حسب وقتك' : 'Depends on your time' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td className="px-5 py-3 text-slate-400">{row.feature}</td>
                        <td className="px-5 py-3 text-center font-semibold" style={{ color:'#8B5CF6' }}>{row.nexus}</td>
                        <td className="px-5 py-3 text-center text-slate-500">{row.agency}</td>
                        <td className="px-5 py-3 text-center text-slate-500">{row.diy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 text-center border-t border-white/5">
                <p className="text-[10px] text-slate-600">{ar ? '* أسعار الوكالات استناداً لمتوسطات السوق العالمية — تختلف حسب المنطقة والتخصص' : '* Agency costs based on global market averages — vary by region and scope'}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════
          PRICING
      ══════════════════════════════════ */}
      <section id="pricing" className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal className="text-center mb-14">
            <Label text={ar ? 'الأسعار' : 'PRICING'} />
            <h2 className="text-[30px] sm:text-[42px] lg:text-[50px] font-extrabold text-white leading-[1.1] tracking-[-2px] mb-3">
              {ar ? 'ابدأ مجاناً. تطور عندما تكون جاهزاً.' : 'Start free. Scale when ready.'}
            </h2>
            <p className="text-[15px] text-slate-400 max-w-[520px] mx-auto">
              {ar
                ? 'أربع خطط مصممة على أساس بيانات حقيقية — كل خطة محسوبة لتحقق أقصى نتيجة بأقل تكلفة.'
                : 'Four plans built on real marketing data — each calibrated for maximum results at the right scale.'}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
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
                    <p className="font-mono text-[12px] font-semibold uppercase tracking-[2px] text-slate-400 mb-2" dir="ltr">{plan.name}</p>
                    <div className="flex items-end gap-1 mb-2" dir="ltr">
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

                  {plan.upgradeHint && (
                    <div className="mb-4 rounded-xl px-3 py-2.5 text-[11px] leading-snug text-amber-300"
                      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      {plan.upgradeHint}
                    </div>
                  )}

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

          <Reveal className="text-center mt-8">
            <p className="text-[11px] text-slate-600">
              {ar
                ? '* 16+ بوست/شهر = 4.5× leads أكتر — HubSpot State of Marketing (13,000+ شركة) · Starter=$0.38/cr · Growth=$0.33/cr · Agency=$0.20/cr'
                : '* 16+ posts/month = 4.5× more leads — HubSpot State of Marketing (13,000+ companies) · Starter=$0.38/cr · Growth=$0.33/cr · Agency=$0.20/cr'}
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
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(139,92,246,0.1) 0%, transparent 65%)' }} />
        <div className="relative z-10 max-w-[720px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.08)] mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[2.5px] text-emerald-400">
                {ar ? 'ابدأ مجاناً — لا بطاقة ائتمان' : 'START FREE — NO CREDIT CARD'}
              </span>
            </div>
            <h2 className="text-[32px] sm:text-[48px] lg:text-[56px] font-extrabold text-white leading-[1.08] tracking-[-2.5px] mb-5">
              {ar ? (
                <>
                  جاهز لبناء قسم<br />
                  <span style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6 0%,#22D3EE 50%,#10B981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                    تسويقك الذكي؟
                  </span>
                </>
              ) : (
                <>
                  Ready to build your<br />
                  <span style={{ backgroundImage:'linear-gradient(135deg,#8B5CF6 0%,#22D3EE 50%,#10B981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                    AI marketing department?
                  </span>
                </>
              )}
            </h2>
            <p className="text-[16px] sm:text-[18px] text-slate-400 mb-10 max-w-[540px] mx-auto leading-relaxed">
              {ar
                ? 'ابدأ مجاناً — لا تحتاج بطاقة ائتمان. جرّب NEXUS على حملتك الأولى بالكامل.'
                : 'Start free — no credit card needed. Try NEXUS on your first full campaign.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link href="/auth/register"
                className="inline-flex items-center gap-2 text-[15px] font-bold text-white px-9 py-4 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background:'linear-gradient(135deg,#7C3AED,#8B5CF6,#06B6D4)', boxShadow:'0 0 50px rgba(139,92,246,0.4), 0 4px 24px rgba(6,182,212,0.2)' }}>
                {ar ? 'ابدأ مجاناً الآن' : 'Start Free Now'} <ArrowRight size={17} />
              </Link>
              <a href="#pipeline" className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors">
                {ar ? 'شاهد كيف يعمل ↓' : 'See how it works ↓'}
              </a>
            </div>
            <div className="flex items-center justify-center gap-5 text-[11px] text-slate-500 flex-wrap">
              {[
                { icon: CheckCircle, text: ar ? '٢٠ رصيد AI في الخطة المجانية' : '20 AI credits on free plan' },
                { icon: CheckCircle, text: ar ? 'لا بطاقة ائتمان مطلوبة' : 'No credit card required' },
                { icon: CheckCircle, text: ar ? 'إلغاء في أي وقت' : 'Cancel anytime' },
                { icon: CheckCircle, text: ar ? 'عربي وإنجليزي' : 'Arabic & English' },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon size={11} className="text-emerald-500" />{text}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════
          FOOTER
      ══════════════════════════════════ */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] py-10">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <span className="font-extrabold text-[17px] text-white tracking-tight">NEXUS</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background:'linear-gradient(135deg,#8B5CF6,#22D3EE)' }}>AI</span>
              </div>
              <p className="text-[12px] text-slate-500">AI-powered marketing intelligence for serious businesses.</p>
            </div>
            <div className="flex items-center gap-5 text-[12px] text-slate-500">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <a href="mailto:support@nexus-grow.com" className="hover:text-white transition-colors">Contact</a>
              <button onClick={() => setLang(ar ? 'en' : 'ar')} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Globe size={11} />{ar ? 'English' : 'العربية'}
              </button>
            </div>
            <p className="text-[11px] text-slate-600">
              © 2026 NEXUS AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
