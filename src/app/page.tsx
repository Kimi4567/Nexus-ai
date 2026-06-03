'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useInView, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import {
  Compass, Sparkles, Megaphone, Activity, ShieldCheck, Brain,
  Users, CheckCircle, Rocket, ArrowRight, Play, Globe, Menu, X,
  ChevronDown, Lock, Eye, Zap, Target, TrendingUp, BarChart3,
  MessageCircle, CreditCard, Cpu, Database, Mail, Cloud,
  ChevronLeft, ChevronRight, Star, AlertCircle, HelpCircle,
  Building2, UtensilsCrossed, Heart, Dumbbell, ShoppingBag,
  Scissors, MapPin, Diamond,
} from 'lucide-react'
import { useTranslation } from '@/i18n'

/* ─────────────────────────────────────────────────────────────
   PARTICLE BACKGROUND
───────────────────────────────────────────────────────────── */
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let w = 0, h = 0, animId = 0
    const particles: { x: number; y: number; vx: number; vy: number; r: number; color: string }[] = []

    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight }
    const init = () => {
      particles.length = 0
      const n = window.innerWidth < 768 ? 20 : 45
      for (let i = 0; i < n; i++) particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 1,
        color: Math.random() > 0.5 ? 'rgba(139,92,246,0.35)' : 'rgba(16,185,129,0.25)',
      })
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const dx = p.x - mouseRef.current.x, dy = p.y - mouseRef.current.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < 180) { const f = (180 - d) / 180; p.vx += (dx / d) * f * 0.3; p.vy += (dy / d) * f * 0.3 }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.vy *= 0.99
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color; ctx.fill()
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j], dd = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2)
          if (dd < 120) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = `rgba(139,92,246,${0.07 * (1 - dd / 120)})`; ctx.lineWidth = 0.5; ctx.stroke() }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    resize(); init(); draw()
    canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top } }, { passive: true })
    window.addEventListener('resize', () => { resize(); init() })
    return () => cancelAnimationFrame(animId)
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} />
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] }}
      className={className}>
      {children}
    </motion.div>
  )
}

function SectionLabel({ text, color = 'text-accent-purple' }: { text: string; color?: string }) {
  return <p className={`font-mono text-[11px] font-semibold uppercase tracking-[3px] ${color} mb-3`}>{text}</p>
}

function SectionHeading({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <h2 className={`font-heading text-[28px] sm:text-[36px] lg:text-[44px] font-bold text-white leading-[1.12] tracking-[-1.5px] ${center ? 'text-center' : ''}`}>
      {children}
    </h2>
  )
}

/* ─────────────────────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────────────────── */
function Navbar() {
  const { lang, setLang, t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const links = [
    { label: lang === 'ar' ? 'الوكلاء' : 'Agents', href: '#agents' },
    { label: lang === 'ar' ? 'كيف يعمل' : 'How It Works', href: '#workflow' },
    { label: lang === 'ar' ? 'الأسعار' : 'Pricing', href: '#pricing' },
    { label: lang === 'ar' ? 'الصناعات' : 'Industries', href: '#industries' },
  ]

  return (
    <header className={`fixed top-0 inset-x-0 z-50 h-[68px] flex items-center transition-all duration-300 ${scrolled ? 'bg-[rgba(6,7,26,0.93)] backdrop-blur-[14px] border-b border-[rgba(139,92,246,0.12)]' : 'bg-transparent'}`}>
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-heading font-bold text-[20px] text-white tracking-tight">NEXUS</span>
          <span className="bg-accent-purple text-white text-[10px] font-bold px-1.5 py-0.5 rounded">AI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href}
              className="font-heading text-[13px] font-medium uppercase tracking-[1px] text-text-secondary hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]">
            <Globe size={13} />{lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <Link href="/auth/login" className="font-heading text-[13px] font-medium text-text-secondary hover:text-white transition-colors px-4 py-2">
            {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
          </Link>
          <Link href="/auth/register" className="btn-gradient font-heading text-[13px] font-semibold text-white px-5 py-2.5 rounded-lg">
            {lang === 'ar' ? 'ابدأ مجاناً' : 'Start Free'}
          </Link>
        </div>

        {/* Mobile */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-white">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 top-[68px] z-40 bg-bg-base/98 backdrop-blur-xl md:hidden flex flex-col items-center pt-12 gap-6">
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                className="font-heading text-[18px] font-medium uppercase tracking-[1px] text-text-secondary hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
            <div className="flex flex-col items-center gap-3 mt-4">
              <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-2 text-text-secondary hover:text-white text-[14px]">
                <Globe size={14} />{lang === 'ar' ? 'English' : 'العربية'}
              </button>
              <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="text-text-secondary text-[16px] hover:text-white">
                {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
              </Link>
              <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="btn-gradient text-white font-semibold px-8 py-3 rounded-lg text-[15px]">
                {lang === 'ar' ? 'ابدأ مجاناً' : 'Start Free'}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

/* ─────────────────────────────────────────────────────────────
   AGENT SVG PORTRAITS
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   AGENT IMAGE MAP  (real WebP portraits, ~50 KB each)
───────────────────────────────────────────────────────────── */
const agentImages: Record<string, string> = {
  STRATEGIST: '/agents/nexus-core.webp',
  NEX:        '/agents/nex.webp',
  VEX:        '/agents/vex.webp',
  PULSE:      '/agents/pulse.webp',
  SENTINEL:   '/agents/sentinel.webp',
  CORTEX:     '/agents/brand-brain.webp',
}

// DEAD CODE BELOW — kept only as safety fallback, never reached
function PortraitStrategist({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 160 200" width="160" height="200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Glow */}
      <ellipse cx="80" cy="170" rx="45" ry="12" fill={color} opacity="0.18" />
      {/* Legs */}
      <rect x="55" y="158" width="18" height="28" rx="5" fill="#1a1a2e" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="87" y="158" width="18" height="28" rx="5" fill="#1a1a2e" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="50" y="182" width="26" height="8" rx="3" fill={color} opacity="0.4" />
      <rect x="84" y="182" width="26" height="8" rx="3" fill={color} opacity="0.4" />
      {/* Body */}
      <rect x="42" y="108" width="76" height="54" rx="8" fill="#131320" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Chest emblem: compass */}
      <circle cx="80" cy="131" r="14" fill={color} opacity="0.1" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="80" y1="121" x2="80" y2="124" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
      <line x1="80" y1="138" x2="80" y2="141" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
      <line x1="70" y1="131" x2="73" y2="131" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
      <line x1="87" y1="131" x2="90" y2="131" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
      <polygon points="80,122 82,130 80,129 78,130" fill={color} opacity="0.9" />
      {/* Shoulders */}
      <rect x="18" y="112" width="26" height="20" rx="6" fill="#131320" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <rect x="116" y="112" width="26" height="20" rx="6" fill="#131320" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Neck */}
      <rect x="70" y="100" width="20" height="12" rx="4" fill="#1a1a2e" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      {/* Head: hexagonal tactical helmet */}
      <polygon points="80,52 115,68 115,100 80,116 45,100 45,68" fill="#131320" stroke={color} strokeWidth="2" strokeOpacity="0.85" />
      {/* Visor band */}
      <rect x="52" y="76" width="56" height="20" rx="3" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      {/* Eyes in visor */}
      <rect x="58" y="81" width="16" height="10" rx="2" fill={color} opacity="0.7" />
      <rect x="86" y="81" width="16" height="10" rx="2" fill={color} opacity="0.7" />
      {/* Visor inner glow */}
      <rect x="58" y="81" width="16" height="10" rx="2" fill="white" opacity="0.2" />
      <rect x="86" y="81" width="16" height="10" rx="2" fill="white" opacity="0.2" />
      {/* Antenna left */}
      <line x1="58" y1="52" x2="48" y2="34" stroke={color} strokeWidth="2" strokeOpacity="0.8" />
      <circle cx="48" cy="34" r="4" fill={color} opacity="0.9" />
      <circle cx="48" cy="34" r="6" fill={color} opacity="0.2" />
      {/* Antenna right */}
      <line x1="102" y1="52" x2="112" y2="34" stroke={color} strokeWidth="2" strokeOpacity="0.8" />
      <circle cx="112" cy="34" r="4" fill={color} opacity="0.9" />
      <circle cx="112" cy="34" r="6" fill={color} opacity="0.2" />
      {/* Chin strap detail */}
      <rect x="63" y="104" width="34" height="4" rx="2" fill={color} opacity="0.3" />
      {/* Status dot */}
      <circle cx="80" cy="63" r="3" fill={color} opacity="0.85" />
    </svg>
  )
}

function PortraitNEX({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 160 200" width="160" height="200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="170" rx="45" ry="12" fill={color} opacity="0.18" />
      {/* Legs */}
      <rect x="56" y="158" width="18" height="28" rx="5" fill="#0d1f1f" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="86" y="158" width="18" height="28" rx="5" fill="#0d1f1f" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="52" y="182" width="25" height="7" rx="3" fill={color} opacity="0.35" />
      <rect x="83" y="182" width="25" height="7" rx="3" fill={color} opacity="0.35" />
      {/* Body */}
      <rect x="40" y="108" width="80" height="54" rx="10" fill="#0c1e1e" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Chest: sparkle emitter array */}
      <circle cx="80" cy="132" r="12" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx="80" cy="132" r="5" fill={color} opacity="0.7" />
      <line x1="80" y1="118" x2="80" y2="122" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="80" y1="142" x2="80" y2="146" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="66" y1="132" x2="70" y2="132" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="90" y1="132" x2="94" y2="132" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      {/* Side sparkles */}
      <circle cx="62" cy="120" r="2.5" fill={color} opacity="0.5" />
      <circle cx="98" cy="120" r="2.5" fill={color} opacity="0.5" />
      <circle cx="62" cy="148" r="2" fill={color} opacity="0.4" />
      <circle cx="98" cy="148" r="2" fill={color} opacity="0.4" />
      {/* Shoulders */}
      <ellipse cx="30" cy="122" rx="14" ry="12" fill="#0c1e1e" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <ellipse cx="130" cy="122" rx="14" ry="12" fill="#0c1e1e" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Neck */}
      <rect x="69" y="100" width="22" height="12" rx="4" fill="#0d1f1f" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      {/* Head: circular friendly face */}
      <circle cx="80" cy="74" r="38" fill="#0c1e1e" stroke={color} strokeWidth="2" strokeOpacity="0.8" />
      {/* Outer ring */}
      <circle cx="80" cy="74" r="36" fill="none" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="4 4" />
      {/* Eyes: large single lens camera */}
      <circle cx="80" cy="74" r="18" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="80" cy="74" r="10" fill={color} opacity="0.25" stroke={color} strokeWidth="1.5" />
      <circle cx="80" cy="74" r="5" fill={color} opacity="0.9" />
      <circle cx="77" cy="71" r="2" fill="white" opacity="0.7" />
      {/* Sparkle emitters on head */}
      <circle cx="48" cy="58" r="3" fill={color} opacity="0.7" />
      <circle cx="112" cy="58" r="3" fill={color} opacity="0.7" />
      <circle cx="46" cy="84" r="2" fill={color} opacity="0.5" />
      <circle cx="114" cy="84" r="2" fill={color} opacity="0.5" />
      <circle cx="63" cy="42" r="2" fill={color} opacity="0.6" />
      <circle cx="97" cy="42" r="2" fill={color} opacity="0.6" />
      {/* Smile bar */}
      <rect x="62" y="88" width="36" height="5" rx="2.5" fill={color} opacity="0.35" />
    </svg>
  )
}

function PortraitVEX({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 160 200" width="160" height="200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="170" rx="45" ry="12" fill={color} opacity="0.18" />
      {/* Legs — wide stance */}
      <rect x="50" y="155" width="22" height="32" rx="5" fill="#1f0e06" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="88" y="155" width="22" height="32" rx="5" fill="#1f0e06" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="47" y="181" width="28" height="8" rx="3" fill={color} opacity="0.4" />
      <rect x="85" y="181" width="28" height="8" rx="3" fill={color} opacity="0.4" />
      {/* Body — wide, aggressive */}
      <rect x="36" y="104" width="88" height="55" rx="8" fill="#1a0d06" stroke={color} strokeWidth="1.5" strokeOpacity="0.55" />
      {/* Broadcast icon on chest */}
      <path d="M68 120 Q80 112 92 120" stroke={color} strokeWidth="2" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
      <path d="M62 127 Q80 115 98 127" stroke={color} strokeWidth="1.5" strokeOpacity="0.35" fill="none" strokeLinecap="round" />
      <circle cx="80" cy="133" r="7" fill={color} opacity="0.8" />
      <rect x="77" y="140" width="6" height="14" rx="2" fill={color} opacity="0.5" />
      {/* Arms — wide + megaphone attachment on right */}
      <rect x="8" y="108" width="28" height="18" rx="6" fill="#1a0d06" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <rect x="124" y="104" width="32" height="24" rx="6" fill="#1a0d06" stroke={color} strokeWidth="2" strokeOpacity="0.7" />
      {/* Megaphone on right arm */}
      <polygon points="130,108 156,100 156,128 130,120" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
      <rect x="124" y="111" width="10" height="10" rx="2" fill={color} opacity="0.6" />
      {/* Signal waves from megaphone */}
      <path d="M158 104 Q163 114 158 124" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" fill="none" strokeLinecap="round" />
      {/* Neck */}
      <rect x="68" y="96" width="24" height="12" rx="4" fill="#1a0d06" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      {/* Head: angular broadcast tower */}
      <path d="M80 36 L118 62 L118 100 L80 110 L42 100 L42 62 Z" fill="#170b05" stroke={color} strokeWidth="2" strokeOpacity="0.85" />
      {/* Brow plate */}
      <rect x="48" y="62" width="64" height="10" rx="2" fill={color} opacity="0.2" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
      {/* Eyes: dual narrow horizontal bars */}
      <rect x="52" y="74" width="22" height="10" rx="2" fill={color} opacity="0.85" />
      <rect x="86" y="74" width="22" height="10" rx="2" fill={color} opacity="0.85" />
      {/* Eye inner bright */}
      <rect x="52" y="74" width="22" height="5" rx="2" fill="white" opacity="0.25" />
      <rect x="86" y="74" width="22" height="5" rx="2" fill="white" opacity="0.25" />
      {/* Broadcast antennae array — top */}
      <line x1="65" y1="36" x2="58" y2="14" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
      <line x1="80" y1="36" x2="80" y2="10" stroke={color} strokeWidth="2.5" strokeOpacity="1" />
      <line x1="95" y1="36" x2="102" y2="14" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
      <circle cx="80" cy="10" r="4" fill={color} />
      <circle cx="58" cy="14" r="3" fill={color} opacity="0.8" />
      <circle cx="102" cy="14" r="3" fill={color} opacity="0.8" />
      {/* Signal rings from top antenna */}
      <circle cx="80" cy="10" r="8" fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.35" />
      <circle cx="80" cy="10" r="13" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.2" />
      {/* Chin */}
      <rect x="60" y="100" width="40" height="5" rx="2" fill={color} opacity="0.25" />
    </svg>
  )
}

function PortraitPULSE({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 160 200" width="160" height="200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="170" rx="45" ry="12" fill={color} opacity="0.18" />
      {/* Legs */}
      <rect x="54" y="155" width="20" height="30" rx="5" fill="#051a1f" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="86" y="155" width="20" height="30" rx="5" fill="#051a1f" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="50" y="181" width="28" height="8" rx="3" fill={color} opacity="0.35" />
      <rect x="82" y="181" width="28" height="8" rx="3" fill={color} opacity="0.35" />
      {/* Body */}
      <rect x="38" y="106" width="84" height="52" rx="9" fill="#041618" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Data wave on chest */}
      <polyline points="46,130 54,130 58,120 64,140 70,125 76,135 82,128 88,132 94,128 100,135 106,122 112,130 118,130" stroke={color} strokeWidth="2" strokeOpacity="0.85" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Shoulders */}
      <rect x="14" y="110" width="26" height="18" rx="6" fill="#041618" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <rect x="120" y="110" width="26" height="18" rx="6" fill="#041618" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Wrist data cuffs */}
      <rect x="14" y="128" width="26" height="6" rx="3" fill={color} opacity="0.3" />
      <rect x="120" y="128" width="26" height="6" rx="3" fill={color} opacity="0.3" />
      {/* Neck */}
      <rect x="68" y="98" width="24" height="12" rx="4" fill="#051a1f" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      {/* Head: wide sensor array */}
      <rect x="30" y="50" width="100" height="52" rx="12" fill="#041618" stroke={color} strokeWidth="2" strokeOpacity="0.85" />
      {/* Sensor top bar */}
      <rect x="30" y="50" width="100" height="10" rx="6" fill={color} opacity="0.15" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
      {/* Three sensor eyes */}
      <circle cx="55" cy="74" r="11" fill={color} opacity="0.1" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="55" cy="74" r="6" fill={color} opacity="0.5" />
      <circle cx="55" cy="74" r="3" fill={color} opacity="0.9" />
      <circle cx="80" cy="74" r="14" fill={color} opacity="0.12" stroke={color} strokeWidth="2" strokeOpacity="0.8" />
      <circle cx="80" cy="74" r="8" fill={color} opacity="0.55" />
      <circle cx="80" cy="74" r="4" fill={color} />
      <circle cx="78" cy="72" r="2" fill="white" opacity="0.7" />
      <circle cx="105" cy="74" r="11" fill={color} opacity="0.1" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="105" cy="74" r="6" fill={color} opacity="0.5" />
      <circle cx="105" cy="74" r="3" fill={color} opacity="0.9" />
      {/* Activity bar bottom of head */}
      <rect x="40" y="90" width="80" height="5" rx="2" fill={color} opacity="0.2" />
      <rect x="40" y="90" width="52" height="5" rx="2" fill={color} opacity="0.5" />
      {/* Top antenna */}
      <line x1="80" y1="50" x2="80" y2="34" stroke={color} strokeWidth="2" strokeOpacity="0.8" />
      <rect x="70" y="28" width="20" height="8" rx="3" fill="#041618" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <rect x="70" y="28" width="12" height="8" rx="3" fill={color} opacity="0.6" />
    </svg>
  )
}

function PortraitSENTINEL({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 160 200" width="160" height="200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="170" rx="50" ry="13" fill={color} opacity="0.2" />
      {/* Legs — heavy armored */}
      <rect x="50" y="153" width="24" height="34" rx="5" fill="#1a1500" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="86" y="153" width="24" height="34" rx="5" fill="#1a1500" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="46" y="180" width="32" height="9" rx="3" fill={color} opacity="0.4" />
      <rect x="82" y="180" width="32" height="9" rx="3" fill={color} opacity="0.4" />
      {/* Knee guards */}
      <rect x="52" y="163" width="20" height="8" rx="2" fill={color} opacity="0.25" />
      <rect x="88" y="163" width="20" height="8" rx="2" fill={color} opacity="0.25" />
      {/* Body — wide armored */}
      <rect x="32" y="100" width="96" height="56" rx="8" fill="#141200" stroke={color} strokeWidth="1.5" strokeOpacity="0.55" />
      {/* Chest armor plates */}
      <rect x="40" y="108" width="36" height="32" rx="4" fill={color} opacity="0.08" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <rect x="84" y="108" width="36" height="32" rx="4" fill={color} opacity="0.08" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      {/* Center shield badge */}
      <path d="M80 108 L90 113 L90 128 L80 134 L70 128 L70 113 Z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
      <path d="M80 115 L85 117.5 L85 126 L80 129 L75 126 L75 117.5 Z" fill={color} opacity="0.5" />
      {/* Shoulder pauldrons — massive */}
      <path d="M12 102 L36 102 L36 126 L20 130 L8 122 Z" fill="#141200" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M124 102 L148 102 L152 122 L140 130 L124 126 Z" fill="#141200" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="12" y="108" width="24" height="6" rx="2" fill={color} opacity="0.3" />
      <rect x="124" y="108" width="24" height="6" rx="2" fill={color} opacity="0.3" />
      {/* Neck */}
      <rect x="66" y="92" width="28" height="12" rx="4" fill="#1a1500" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
      {/* Head: wide armored shield face */}
      <path d="M80 34 L124 52 L126 100 L80 114 L34 100 L36 52 Z" fill="#141200" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
      {/* Brow armor */}
      <rect x="40" y="60" width="80" height="12" rx="3" fill={color} opacity="0.15" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
      {/* Cheek plates */}
      <rect x="36" y="74" width="22" height="24" rx="3" fill={color} opacity="0.1" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <rect x="102" y="74" width="22" height="24" rx="3" fill={color} opacity="0.1" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      {/* Three eyes */}
      <ellipse cx="60" cy="78" rx="9" ry="7" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <ellipse cx="60" cy="78" rx="5" ry="4" fill={color} opacity="0.75" />
      <ellipse cx="80" cy="76" rx="11" ry="9" fill={color} opacity="0.12" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
      <ellipse cx="80" cy="76" rx="6" ry="5" fill={color} opacity="0.9" />
      <ellipse cx="80" cy="76" rx="3" ry="2.5" fill="white" opacity="0.6" />
      <ellipse cx="100" cy="78" rx="9" ry="7" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <ellipse cx="100" cy="78" rx="5" ry="4" fill={color} opacity="0.75" />
      {/* Scan beam */}
      <rect x="46" y="91" width="68" height="3" rx="1.5" fill={color} opacity="0.4" />
      {/* Top crest */}
      <polygon points="80,34 86,18 80,22 74,18" fill={color} opacity="0.7" />
      {/* Side antennae */}
      <line x1="40" y1="52" x2="26" y2="36" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="26" cy="36" r="3" fill={color} opacity="0.7" />
      <line x1="120" y1="52" x2="134" y2="36" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="134" cy="36" r="3" fill={color} opacity="0.7" />
    </svg>
  )
}

// (legacy agentPortraits removed — replaced by agentImages above)

/* ─────────────────────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────────────────── */
export default function HomePage() {
  const { lang } = useTranslation()
  const ar = lang === 'ar'
  const dir = ar ? 'rtl' : 'ltr'
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [testimonialIdx, setTestimonialIdx] = useState(0)
  const [activeAgent, setActiveAgent] = useState(0)

  /* ── DATA ── */
  const agents = [
    {
      name: 'STRATEGIST', color: '#8B5CF6', icon: Compass,
      role: ar ? 'المخطط الاستراتيجي' : 'Strategic Planner',
      desc: ar ? 'يحلل السوق والمنافسين ويبني خطة تسويق 90 يوماً مخصصة لعملك.' : 'Analyzes your market, competitors, and builds a 90-day marketing plan tailored to your business.',
      output: ar ? 'خطة تسويق كاملة · تحليل منافسين · تقويم محتوى' : 'Full marketing plan · Competitor analysis · Content calendar',
    },
    {
      name: 'NEX', color: '#10B981', icon: Sparkles,
      role: ar ? 'منشئ المحتوى' : 'Content Creator',
      desc: ar ? 'يكتب الكابشن والسكريبت والنصوص الإعلانية باللغتين العربية والإنجليزية بصوت علامتك التجارية.' : 'Writes captions, scripts, and ad copy in Arabic and English — in your brand voice.',
      output: ar ? 'كابشن · سكريبت · محتوى بريد إلكتروني · نصوص SEO' : 'Captions · Scripts · Email copy · SEO content',
    },
    {
      name: 'VEX', color: '#FF6B35', icon: Megaphone,
      role: ar ? 'مدير الحملات الإعلانية' : 'Ad Campaign Manager',
      desc: ar ? 'يبني هيكل الحملات الإعلانية مع الاستهداف والميزانيات ونصوص الإعلانات جاهزة للمراجعة.' : 'Builds ad campaign structures with targeting, budgets, and ad copy — ready for your review.',
      output: ar ? 'هيكل الحملة · نصوص الإعلانات · استهداف الجمهور' : 'Campaign structure · Ad copy · Audience targeting',
    },
    {
      name: 'PULSE', color: '#00D4FF', icon: Activity,
      role: ar ? 'محلل الأداء' : 'Performance Analyst',
      desc: ar ? 'يراقب الأداء ويحلل البيانات ويقترح تحسينات مبنية على الأرقام.' : 'Monitors performance, analyzes data, and recommends data-driven improvements.',
      output: ar ? 'تقارير الأداء · رؤى قابلة للتنفيذ · تنبيهات' : 'Performance reports · Actionable insights · Alerts',
    },
    {
      name: 'SENTINEL', color: '#FFD700', icon: ShieldCheck,
      role: ar ? 'حارس العلامة التجارية' : 'Brand Safety Monitor',
      desc: ar ? 'يراقب المنافسين وسمعة العلامة التجارية ويرصد الفرص والمخاطر في السوق.' : 'Monitors competitors, brand reputation, and identifies market opportunities and risks.',
      output: ar ? 'تقارير المنافسين · تنبيهات السمعة · رصد السوق' : 'Competitor reports · Reputation alerts · Market monitoring',
    },
    {
      name: 'CORTEX', color: '#A78BFA', icon: Brain,
      role: ar ? 'ذاكرة العلامة التجارية' : 'Brand Memory Core',
      desc: ar ? 'يحفظ هوية علامتك التجارية ونبرتك وجمهورك وأهدافك — كل الوكلاء يعملون بهذا السياق الغني في كل مهمة.' : 'Stores your brand identity, voice, audience, and goals — all agents operate with this rich context on every task.',
      output: ar ? 'هوية العلامة · نبرة الصوت · سياق الجمهور · ذاكرة المنافسين' : 'Brand identity · Voice tone · Audience context · Competitor memory',
    },
  ]

  const workflowSteps = [
    { n: '01', icon: Users,        title: ar ? 'أنشئ حسابك'            : 'Create Account',          desc: ar ? 'سجل في دقيقة واحدة'                                : 'Register in under a minute' },
    { n: '02', icon: Brain,        title: ar ? 'ابنِ Brand Brain'       : 'Build Brand Brain',       desc: ar ? 'أدخل بيانات عملك والنبرة والجمهور والمنافسين'       : 'Enter your business data, tone, audience, and competitors' },
    { n: '03', icon: Compass,      title: ar ? 'ولّد استراتيجيتك'       : 'Generate Strategy',       desc: ar ? 'STRATEGIST يبني خطة 90 يوماً مخصصة لعملك'           : 'STRATEGIST builds a custom 90-day plan for your business' },
    { n: '04', icon: Sparkles,     title: ar ? 'أنشئ المحتوى'           : 'Create Content',          desc: ar ? 'NEX يكتب المحتوى بصوت علامتك التجارية'              : 'NEX writes content in your brand voice' },
    { n: '05', icon: Megaphone,    title: ar ? 'جهّز الحملات'           : 'Prepare Campaigns',       desc: ar ? 'VEX يبني هيكل الحملات جاهزاً للمراجعة'              : 'VEX builds campaign structures ready for review' },
    { n: '06', icon: Eye,          title: ar ? 'راجع وتحكم'             : 'Review & Control',        desc: ar ? 'كل شيء يمر عليك قبل التنفيذ'                        : 'Everything passes through you before execution' },
    { n: '07', icon: CheckCircle,  title: ar ? 'وافق أو عدّل'           : 'Approve or Edit',         desc: ar ? 'أنت من يقرر ما يُنشر ويُطلق ويُنفق'                 : 'You decide what gets published, launched, and spent' },
    { n: '08', icon: Rocket,       title: ar ? 'نفّذ'                    : 'Execute',                 desc: ar ? 'يدوياً الآن أو متصلاً عند الموافقة'                 : 'Manually now, or connected where approved' },
    { n: '09', icon: BarChart3,    title: ar ? 'حلّل الأداء'             : 'Analyze Performance',    desc: ar ? 'PULSE يرصد الأداء ويولد التقارير'                   : 'PULSE monitors performance and generates reports' },
    { n: '10', icon: TrendingUp,   title: ar ? 'تحسّن باستمرار'          : 'Continuously Improve',   desc: ar ? 'الوكلاء يتعلمون من الأداء ويحسنون الاستراتيجية'     : 'Agents learn from performance and refine the strategy' },
  ]

  const industries = [
    { name: ar ? 'العقارات'          : 'Real Estate',      color: '#8B5CF6', icon: Building2,       desc: ar ? 'حملات للمشاريع والعقارات' : 'Project launches & property campaigns' },
    { name: ar ? 'المطاعم والكافيهات' : 'Restaurants',     color: '#FF6B35', icon: UtensilsCrossed, desc: ar ? 'محتوى يومي وعروض موسمية' : 'Daily content & seasonal offers' },
    { name: ar ? 'العيادات الطبية'    : 'Medical Clinics', color: '#00D4FF', icon: Heart,           desc: ar ? 'تسويق موثوق وحذر للقطاع الصحي' : 'Trusted, compliant healthcare marketing' },
    { name: ar ? 'صالونات التجميل'    : 'Beauty & Salons', color: '#FF69B4', icon: Scissors,        desc: ar ? 'محتوى بصري وترويج للخدمات' : 'Visual content & service promotions' },
    { name: ar ? 'الصالات الرياضية'   : 'Gyms & Fitness',  color: '#10B981', icon: Dumbbell,        desc: ar ? 'تحديات وعروض العضوية' : 'Challenges & membership campaigns' },
    { name: ar ? 'التجارة الإلكترونية': 'E-Commerce',      color: '#FFB800', icon: ShoppingBag,     desc: ar ? 'منتجات وتحويلات وبيع' : 'Product launches, conversions & sales' },
    { name: ar ? 'الخدمات المحلية'    : 'Local Services',  color: '#4CAF50', icon: MapPin,          desc: ar ? 'استهداف جغرافي وحملات محلية' : 'Geo-targeting & local campaigns' },
    { name: ar ? 'الفاخرة والريتيل'   : 'Luxury Retail',   color: '#C9A84C', icon: Diamond,         desc: ar ? 'تسويق راقٍ يعكس هوية العلامة' : 'Premium marketing matching brand prestige' },
  ]

  const integrations = [
    { name: 'OpenAI',        icon: Cpu,         status: ar ? 'متصل — يشغّل جميع الوكلاء' : 'Connected — powers all agents',          color: '#10B981' },
    { name: 'Supabase',      icon: Database,    status: ar ? 'متصل — Auth وقاعدة البيانات' : 'Connected — Auth & database',          color: '#3ECF8E' },
    { name: 'Cloudinary',    icon: Cloud,       status: ar ? 'متصل — رفع الوسائط وإدارتها' : 'Connected — media upload & management', color: '#3448C5' },
    { name: 'Meta / Facebook', icon: Target,    status: ar ? 'متاح عند الربط والموافقة' : 'Available when connected & approved',    color: '#1877F2' },
    { name: 'Stripe',        icon: CreditCard,  status: ar ? 'متصل — بوابة المدفوعات' : 'Connected — payments gateway',           color: '#635BFF' },
    { name: 'Resend',        icon: Mail,        status: ar ? 'متصل — إشعارات البريد الإلكتروني' : 'Connected — email notifications',  color: '#8B5CF6' },
  ]

  const pricingPlans = [
    {
      name: ar ? 'مجاني' : 'Free',
      price: '0',
      period: '',
      desc: ar ? 'جرّب المنصة — لا بطاقة ائتمان مطلوبة' : 'Try the platform — no credit card needed',
      features: ar
        ? [
            '20 رصيد AI — مرة واحدة فقط (لا يتجدد)',
            'مساحة عمل واحدة',
            'حملتان كحد أقصى للأبد',
            '2 منصة اجتماعية فقط',
            'لا توليد فيديو',
            'علامة مائية على جميع الصادرات',
          ]
        : [
            '20 AI credits — one-time only (never renews)',
            '1 workspace',
            '2 campaigns max (forever)',
            '2 social platforms only',
            'No video generation',
            'Watermark on all exports',
          ],
      cta: ar ? 'ابدأ مجاناً' : 'Start Free',
      featured: false,
    },
    {
      name: ar ? 'ستارتر' : 'Starter',
      price: '29',
      period: ar ? '/شهر' : '/month',
      desc: ar ? 'نقطة انطلاق مثالية لأصحاب المشاريع الفردية' : 'Perfect entry point for solo creators',
      features: ar
        ? [
            '150 رصيد AI / شهر — يتجدد تلقائياً كل شهر',
            'مساحتا عمل',
            '8 حملات / شهر · 50 بوست / شهر',
            '3 منصات اجتماعية (Meta · LinkedIn · TikTok)',
            'فيديوهان مولّدان بالذكاء الاصطناعي / شهر',
            'Brand Brain الكامل + جميع وكلاء الـ AI',
            'تصدير PDF + DOCX بدون علامة مائية',
          ]
        : [
            '150 AI credits / month — renews automatically',
            '2 workspaces',
            '8 campaigns / mo · 50 posts / mo',
            '3 social platforms (Meta · LinkedIn · TikTok)',
            '2 AI-generated videos / month',
            'Full Brand Brain + all AI agents',
            'No-watermark PDF + DOCX export',
          ],
      cta: ar ? 'ابدأ Starter — $29/شهر' : 'Start Starter — $29/mo',
      featured: false,
    },
    {
      name: 'Pro',
      price: '79',
      period: ar ? '/شهر' : '/month',
      desc: ar ? 'لأصحاب الأعمال والفرق الصغيرة' : 'For growing businesses & small teams',
      features: ar
        ? [
            '300 رصيد AI / شهر — يتجدد تلقائياً كل شهر',
            '3 مساحات عمل',
            '20 حملة / شهر · 100 بوست / شهر',
            'جميع المنصات الـ 5 (Meta · Instagram · TikTok · LinkedIn · جدولة)',
            '5 فيديوهات مولّدة بالذكاء الاصطناعي / شهر',
            'Brand Brain الكامل + جميع وكلاء الـ AI',
            'لوحة تحليلات + رؤى الأداء',
            'تصدير PDF + DOCX بدون علامة مائية',
            'دعم بريد إلكتروني',
          ]
        : [
            '300 AI credits / month — renews automatically',
            '3 workspaces',
            '20 campaigns / mo · 100 posts / mo',
            'All 5 platforms (Meta · Instagram · TikTok · LinkedIn · Scheduling)',
            '5 AI-generated videos / month',
            'Full Brand Brain + all AI agents',
            'Analytics dashboard + performance insights',
            'No-watermark PDF + DOCX export',
            'Email support',
          ],
      cta: ar ? 'ابدأ Pro — $79/شهر' : 'Start Pro — $79/mo',
      featured: true,
    },
    {
      name: ar ? 'بيزنس' : 'Business',
      price: '199',
      period: ar ? '/شهر' : '/month',
      desc: ar ? 'للوكالات والفرق الكبيرة' : 'For agencies and larger teams',
      features: ar
        ? [
            '1,000 رصيد AI / شهر — يتجدد تلقائياً كل شهر',
            '10 مساحات عمل',
            '60 حملة / شهر · بوستات غير محدودة',
            'جميع المنصات الـ 5 + نشر متعدد الحسابات',
            '20 فيديو مولّد بالذكاء الاصطناعي / شهر',
            '3 مقاعد لأعضاء الفريق',
            'تصدير White-label (PDF + DOCX بشعارك)',
            'تحليلات متقدمة + وصول API',
            'دعم ذو أولوية',
          ]
        : [
            '1,000 AI credits / month — renews automatically',
            '10 workspaces',
            '60 campaigns / mo · unlimited posts',
            'All 5 platforms + multi-account publishing',
            '20 AI-generated videos / month',
            '3 team seats (collaborate with your team)',
            'White-label exports (PDF + DOCX with your logo)',
            'Advanced analytics + API access',
            'Priority support',
          ],
      cta: ar ? 'ابدأ Business — $199/شهر' : 'Start Business — $199/mo',
      featured: false,
    },
  ]

  const faqs = [
    {
      q: ar ? 'هل الذكاء الاصطناعي ينشر تلقائياً؟' : 'Does the AI publish automatically?',
      a: ar ? 'لا. كل محتوى أو حملة أو إنفاق إعلاني يمر بمركز الموافقات أولاً. لا شيء يُنشر أو يُطلق دون موافقتك الصريحة.' : 'No. Every piece of content, campaign, or ad spend goes through the approval center first. Nothing is published or launched without your explicit approval.',
    },
    {
      q: ar ? 'هل يدعم العربية والإنجليزية؟' : 'Does it support Arabic and English?',
      a: ar ? 'نعم. الوكلاء يولدون المحتوى باللغتين. الواجهة الكاملة متاحة بالعربية والإنجليزية.' : 'Yes. The agents generate content in both languages. The full interface is available in Arabic and English.',
    },
    {
      q: ar ? 'هل أحتاج موافقات Meta أو Google مسبقاً؟' : 'Do I need Meta or Google approvals first?',
      a: ar ? 'لا. يمكنك البدء بالتنفيذ اليدوي فوراً. ربط الحسابات الإعلانية اختياري وتفعّله عندما تكون مستعداً.' : 'No. You can start with manual execution immediately. Connecting ad accounts is optional and you activate it when ready.',
    },
    {
      q: ar ? 'هل يناسب قطاعي؟' : 'Does it work for my industry?',
      a: ar ? 'NEXUS AI يعمل مع أي قطاع يحتاج تسويقاً رقمياً. Brand Brain يتكيف مع خصائص كل قطاع وعلامة تجارية.' : 'NEXUS AI works with any industry that needs digital marketing. The Brand Brain adapts to the specifics of each sector and brand.',
    },
    {
      q: ar ? 'هل يمكنني البدء يدوياً قبل الربط؟' : 'Can I start manually before connecting integrations?',
      a: ar ? 'نعم. التنفيذ اليدوي متاح من اليوم الأول. الربط بالمنصات الإعلانية اختياري وتفعّله عند جاهزيتك.' : 'Yes. Manual execution is available from day one. Platform integrations are optional and you activate them when ready.',
    },
    {
      q: ar ? 'ماذا يحدث ببياناتي؟' : 'What happens to my data?',
      a: ar ? 'بياناتك مشفرة وخاصة بك. لا يتم مشاركة بيانات عملك أو علامتك التجارية مع أطراف خارجية. أنت تتحكم في كل شيء.' : 'Your data is encrypted and belongs to you. We do not share your business or brand data with third parties. You are in full control.',
    },
  ]

  const testimonials = [
    {
      quote: ar
        ? 'نظام مثل هذا يمكّن الشركات العقارية من إنتاج خطة تسويق كاملة وتقويم محتوى لـ 30 يوماً دون الحاجة للتنسيق بين أطراف متعددة — المحتوى والاستراتيجية والموافقة في مكان واحد.'
        : 'A system like this enables real estate businesses to produce a full marketing plan and 30-day content calendar — without coordinating between multiple vendors. Strategy, content, and approvals in one place.',
      label: ar ? 'سيناريو مثال — قطاع العقارات' : 'Example scenario — Real Estate',
      icon: '🏢',
    },
    {
      quote: ar
        ? 'مركز الموافقات مُصمَّم لأصحاب الأعمال الذين يريدون مراجعة كل قطعة محتوى قبل نشرها — مع الحفاظ الكامل على هوية العلامة التجارية.'
        : 'The approval center is built for business owners who want to review every piece of content before it goes live — maintaining full control over brand identity.',
      label: ar ? 'سيناريو مثال — قطاع التجميل والرفاهية' : 'Example scenario — Beauty & Wellness',
      icon: '✨',
    },
    {
      quote: ar
        ? 'بدلاً من توزيع العمل على كتّاب ومصممين ووكالات منفصلة، يدمج النظام التخطيط والإنتاج والموافقة في منظومة واحدة متكاملة.'
        : 'Instead of distributing work across separate writers, designers, and agencies, the system unifies planning, production, and approvals into one integrated workflow.',
      label: ar ? 'سيناريو مثال — قطاع اللياقة البدنية' : 'Example scenario — Fitness & Gyms',
      icon: '💪',
    },
  ]

  return (
    <div className="bg-bg-base text-white" dir={dir}>
      <Navbar />

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden pt-[68px]">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 65%), radial-gradient(ellipse 40% 30% at 80% 80%, rgba(16,185,129,0.1) 0%, transparent 50%)' }} />
        <ParticleBackground />

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
          <div className="grid lg:grid-cols-[1fr_1.35fr] gap-10 items-center">
            {/* Text */}
            <div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.55 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.08)] mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-accent-teal">
                  {ar ? 'قسم التسويق الذكي الخاص بك' : 'Your AI Marketing Department'}
                </span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.65 }}
                className="font-heading text-[38px] sm:text-[52px] lg:text-[62px] font-bold text-white leading-[1.08] tracking-[-2px] mb-6">
                {ar ? <>حوّل التسويق عندك<br />إلى <span className="text-gradient">فريق AI كامل</span><br />في دقائق</> : <>Hire your<br /><span className="text-gradient">AI Marketing</span><br />Department</>}
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
                className="text-[17px] sm:text-[19px] text-text-secondary leading-relaxed max-w-[560px] mb-9">
                {ar
                  ? 'NEXUS AI يفهم علامتك التجارية، يبني الاستراتيجية، ينشئ المحتوى، يجهز الحملات، ويتابع الأداء — وأنت تبقى في التحكم الكامل دائماً.'
                  : 'NEXUS AI understands your brand, creates strategies, generates content, prepares campaigns, tracks performance, and helps your business grow — with you always in control.'}
              </motion.p>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}
                className="flex flex-wrap items-center gap-4 mb-7">
                <Link href="/auth/register"
                  className="btn-gradient font-heading text-[14px] font-semibold uppercase tracking-[1px] text-white px-8 py-3.5 rounded-lg inline-flex items-center gap-2 shadow-[0_0_30px_rgba(139,92,246,0.25)]">
                  {ar ? 'ابدأ مجاناً' : 'Start Free'} <ArrowRight size={17} />
                </Link>
                <a href="#workflow"
                  className="font-heading text-[14px] font-medium uppercase tracking-[1px] text-text-secondary hover:text-white transition-colors inline-flex items-center gap-2 border border-[rgba(255,255,255,0.1)] px-6 py-3.5 rounded-lg hover:border-[rgba(255,255,255,0.2)]">
                  <Play size={15} /> {ar ? 'شاهد كيف يعمل' : 'See How It Works'}
                </a>
              </motion.div>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }}
                className="text-[12px] text-text-muted flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1"><CheckCircle size={12} className="text-accent-teal" /> {ar ? 'بدون بطاقة ائتمان' : 'No credit card required'}</span>
                <span className="text-text-muted">·</span>
                <span className="flex items-center gap-1"><CheckCircle size={12} className="text-accent-teal" /> {ar ? '20 رصيد AI مجاناً' : '20 free AI credits'}</span>
                <span className="text-text-muted">·</span>
                <span className="flex items-center gap-1"><CheckCircle size={12} className="text-accent-teal" /> {ar ? 'إلغاء في أي وقت' : 'Cancel anytime'}</span>
              </motion.p>
            </div>

            {/* Hero visual — cinematic floating asset */}
            <motion.div initial={{ opacity: 0, scale: 0.94, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ delay: 0.8, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="hidden lg:block" style={{ position: 'relative' }}>

              {/* ── GLOW LAYER 1: Violet radial bloom (main, behind image) ── */}
              <div style={{
                position: 'absolute',
                top: '-5%', left: '-5%', right: '-8%', bottom: '-8%',
                background: 'radial-gradient(ellipse 75% 65% at 55% 48%, rgba(139,92,246,0.32) 0%, rgba(99,40,200,0.15) 40%, transparent 70%)',
                filter: 'blur(40px)',
                zIndex: 0,
                pointerEvents: 'none',
              }} />

              {/* ── GLOW LAYER 2: Blue bloom (upper-left, depth) ── */}
              <div style={{
                position: 'absolute',
                top: '-10%', left: '-10%', width: '60%', height: '60%',
                background: 'radial-gradient(ellipse 80% 70% at 30% 30%, rgba(59,130,246,0.2) 0%, transparent 65%)',
                filter: 'blur(36px)',
                zIndex: 0,
                pointerEvents: 'none',
              }} />

              {/* ── GLOW LAYER 3: Orange under-glow (floor) ── */}
              <div style={{
                position: 'absolute',
                bottom: '-12%', left: '15%', right: '15%', height: '35%',
                background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,107,53,0.18) 0%, rgba(255,160,50,0.08) 50%, transparent 75%)',
                filter: 'blur(28px)',
                zIndex: 0,
                pointerEvents: 'none',
              }} />

              {/* ── THE ASSET — sharp, no blur, no filter, transparent WebP ── */}
              <Image
                src="/hero-dashboard.webp"
                alt="NEXUS AI Dashboard"
                width={1672}
                height={941}
                priority
                style={{
                  display: 'block',
                  width: '118%',
                  height: 'auto',
                  position: 'relative',
                  zIndex: 1,
                  marginLeft: '-9%',
                  /* Only a subtle drop-shadow for depth — no blur on the asset */
                  filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.55))',
                }}
              />

              {/* ── Live status pill ── */}
              <div style={{
                position: 'absolute',
                top: '8%',
                right: '2%',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(4,4,20,0.82)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(16,185,129,0.4)',
                borderRadius: '20px',
                padding: '5px 12px',
                zIndex: 3,
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#10B981', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  {ar ? 'مباشر' : 'Live'}
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll cue */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-text-muted font-mono">{ar ? 'اكتشف المزيد' : 'Discover more'}</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
            <ChevronDown size={18} className="text-text-muted" />
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════
          PROBLEM
      ══════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 border-t border-[rgba(255,255,255,0.04)]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-[780px] mx-auto text-center">
            <SectionLabel text={ar ? 'المشكلة' : 'The Problem'} color="text-status-rejected" />
            <SectionHeading center>
              {ar ? 'التسويق أصبح أكثر تعقيداً وأكثر تكلفةً من أي وقت مضى' : 'Marketing has become more complex and expensive than ever'}
            </SectionHeading>
            <p className="text-[16px] sm:text-[18px] text-text-secondary leading-relaxed mt-6">
              {ar
                ? 'الأعمال الصغيرة تبدد وقتها ومالها بإدارة وكالات ومستقلين ومنصات ومحتوى وإعلانات وتقارير بشكل منفصل — بدون تنسيق، وبدون استراتيجية موحدة.'
                : 'Small businesses waste time and money managing agencies, freelancers, content, ads, reports, and approvals separately — without coordination and without a unified strategy.'}
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-16">
            {[
              { icon: '💸', title: ar ? 'تكاليف متفرقة' : 'Fragmented costs', desc: ar ? 'وكالة + مصمم + كاتب محتوى + مدير إعلانات = فاتورة ضخمة شهرياً بنتائج غير مضمونة' : 'Agency + designer + writer + ad manager = massive monthly bill with no guaranteed results' },
              { icon: '⏱', title: ar ? 'وقت ضائع' : 'Wasted time', desc: ar ? 'ساعات في الموافقات والمراسلات والمتابعات — بدلاً من التركيز على تطوير العمل' : 'Hours in approvals, follow-ups, and coordination — instead of focusing on growing the business' },
              { icon: '🎯', title: ar ? 'غياب الاستراتيجية' : 'No strategy', desc: ar ? 'محتوى عشوائي بدون خطة واضحة أو اتساق في الرسالة أو قياس للنتائج' : 'Random content without a clear plan, consistent message, or result measurement' },
              { icon: '🔀', title: ar ? 'تشتت الأدوات' : 'Tool fragmentation', desc: ar ? 'أدوات منفصلة لكل منصة، بدون مكان واحد لرؤية الصورة الكاملة' : 'Separate tools for every platform, with no single place to see the full picture' },
              { icon: '😰', title: ar ? 'فقدان التحكم' : 'Loss of control', desc: ar ? 'محتوى يُنشر باسمك دون مراجعتك — أو حملات تُطلق بميزانيات لم توافق عليها' : 'Content published in your name without your review — or campaigns launched with unapproved budgets' },
              { icon: '📉', title: ar ? 'نتائج غير مقاسة' : 'Unmeasured results', desc: ar ? 'لا تقارير واضحة، لا تحليل أداء، لا معرفة بما يعمل وما لا يعمل' : 'No clear reports, no performance analysis, no knowledge of what works and what does not' },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08}>
                <div className="rounded-2xl border border-[rgba(244,67,54,0.12)] bg-[rgba(244,67,54,0.04)] p-6 h-full">
                  <span className="text-2xl mb-4 block">{p.icon}</span>
                  <h3 className="font-heading text-[16px] font-semibold text-white mb-2">{p.title}</h3>
                  <p className="text-[13px] text-text-secondary leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SOLUTION
      ══════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 bg-bg-surface">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-[800px]">
            <SectionLabel text={ar ? 'الحل' : 'The Solution'} color="text-accent-teal" />
            <SectionHeading>
              {ar ? 'قسم تسويق ذكي كامل في منصة واحدة' : 'A complete AI marketing department in one platform'}
            </SectionHeading>
            <p className="text-[16px] sm:text-[18px] text-text-secondary leading-relaxed mt-5 max-w-[640px]">
              {ar
                ? 'NEXUS AI يجمع الاستراتيجية والمحتوى والحملات والتحليلات وسلامة العلامة التجارية في مكان عمل ذكي واحد — وأنت تبقى في قمة السيطرة.'
                : 'NEXUS AI brings strategy, content, campaigns, analytics, and brand safety into one intelligent workspace — and you stay firmly in control.'}
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
            {[
              { icon: Brain, color: '#8B5CF6', title: ar ? 'ذاكرة علامتك التجارية' : 'Your Brand Memory', desc: ar ? 'Brand Brain يحفظ نبرتك وجمهورك ومنافسيك وأهدافك — كل الوكلاء يعملون بهذا السياق' : 'Brand Brain stores your tone, audience, competitors, and goals — all agents work with this context' },
              { icon: Users, color: '#10B981', title: ar ? 'فريق وكلاء متخصصين' : 'Specialized Agent Team', desc: ar ? 'خمسة وكلاء ذكيين لكل منهم دور محدد: الاستراتيجية، المحتوى، الإعلانات، التحليلات، وسلامة العلامة' : 'Five AI agents each with a defined role: strategy, content, ads, analytics, and brand safety' },
              { icon: CheckCircle, color: '#00D4FF', title: ar ? 'موافقتك قبل كل شيء' : 'Your Approval Before Everything', desc: ar ? 'مركز الموافقات يضمن أن لا شيء يُنشر أو يُطلق أو يُنفق دون مراجعتك وموافقتك' : 'The approval center ensures nothing is published, launched, or spent without your review and approval' },
              { icon: Zap, color: '#FFB800', title: ar ? 'تنفيذ فوري أو متصل' : 'Instant or Connected Execution', desc: ar ? 'نسخ يدوي فوري من اليوم الأول. ربط المنصات الإعلانية متاح عند جاهزيتك' : 'Manual copy-ready output from day one. Platform connections available when you are ready' },
              { icon: BarChart3, color: '#FF6B35', title: ar ? 'تقارير وأداء مستمر' : 'Continuous Reports & Performance', desc: ar ? 'PULSE يراقب الأداء ويولد التقارير ويقترح تحسينات مبنية على البيانات الفعلية' : 'PULSE monitors performance, generates reports, and suggests data-driven improvements' },
              { icon: Lock, color: '#4CAF50', title: ar ? 'أمان وخصوصية كاملة' : 'Full Security & Privacy', desc: ar ? 'بياناتك مشفرة. لا إنفاق إعلاني تلقائي. لا نشر دون موافقة. أنت من يتحكم دائماً' : 'Your data is encrypted. No automatic ad spend. No publishing without approval. You are always in control' },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="group rounded-2xl border border-bg-border bg-bg-base p-7 h-full hover:-translate-y-1 transition-all duration-300 cursor-default"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${s.color}40`; (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px rgba(0,0,0,0.3)` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: `${s.color}18` }}>
                    <s.icon size={22} style={{ color: s.color }} />
                  </div>
                  <h3 className="font-heading text-[17px] font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-[13px] text-text-secondary leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          AI AGENTS
      ══════════════════════════════════════════ */}
      <section id="agents" className="py-24 lg:py-32 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionLabel text={ar ? 'الوكلاء الذكيون' : 'AI Agents'} color="text-accent-purple" />
            <SectionHeading>{ar ? 'تعرّف على فريقك الذكي' : 'Meet your intelligent team'}</SectionHeading>
            <p className="text-[16px] text-text-secondary leading-relaxed max-w-[580px] mt-4">
              {ar ? 'خمسة وكلاء متخصصون، كل منهم خبير في مجاله، يعملون معاً ضمن سياق علامتك التجارية.' : 'Five specialized agents, each an expert in their domain, working together within your brand context.'}
            </p>
          </Reveal>

          {/* ── Agent selector tabs ── */}
          <div className="mt-10 flex gap-2 flex-wrap">
            {agents.map((agent, i) => (
              <button
                key={agent.name}
                onClick={() => setActiveAgent(i)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-mono font-bold uppercase tracking-[1.5px] border transition-all duration-200"
                style={activeAgent === i ? {
                  borderColor: agent.color,
                  background: `${agent.color}18`,
                  color: agent.color,
                  boxShadow: `0 0 18px ${agent.color}33`,
                } : {
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.4)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: activeAgent === i ? agent.color : 'rgba(255,255,255,0.25)' }}
                />
                {agent.name}
              </button>
            ))}
          </div>

          {/* ── Featured agent panel ── */}
          <div className="mt-6">
            {agents.map((agent, i) => {
              if (i !== activeAgent) return null
              const agentImg = agentImages[agent.name]
              return (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="rounded-3xl border overflow-hidden"
                  style={{
                    borderColor: `${agent.color}33`,
                    background: `linear-gradient(135deg, ${agent.color}0a 0%, rgba(0,0,0,0) 55%)`,
                  }}
                >
                  <div className="grid lg:grid-cols-[300px_1fr] gap-0">
                    {/* Portrait — real robot image */}
                    <div
                      className="relative flex items-end justify-center overflow-hidden border-b lg:border-b-0 lg:border-r"
                      style={{
                        borderColor: `${agent.color}22`,
                        background: `radial-gradient(ellipse at 50% 80%, ${agent.color}18 0%, #050510 65%)`,
                        minHeight: '300px',
                      }}
                    >
                      {/* Scan line overlay */}
                      <div
                        className="absolute inset-0 pointer-events-none z-10"
                        style={{
                          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${agent.color}04 3px, ${agent.color}04 4px)`,
                        }}
                      />
                      {/* Corner brackets */}
                      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 z-20" style={{ borderColor: `${agent.color}88` }} />
                      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 z-20" style={{ borderColor: `${agent.color}88` }} />
                      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 z-20" style={{ borderColor: `${agent.color}88` }} />
                      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 z-20" style={{ borderColor: `${agent.color}88` }} />
                      {/* Agent image */}
                      {agentImg && (
                        <div className="relative w-full h-full flex items-end justify-center">
                          <Image
                            src={agentImg}
                            alt={agent.name}
                            width={280}
                            height={280}
                            className="object-contain object-bottom select-none"
                            priority={i === 0}
                            style={{
                              filter: `drop-shadow(0 0 32px ${agent.color}66) drop-shadow(0 0 8px ${agent.color}44)`,
                              maxHeight: '280px',
                              width: 'auto',
                            }}
                          />
                          {/* Bottom blend — hides image edge naturally */}
                          <div
                            className="absolute inset-x-0 bottom-0 h-24 pointer-events-none z-10"
                            style={{
                              background: `linear-gradient(to top, #050510 0%, transparent 100%)`,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Details panel */}
                    <div className="p-8 lg:p-10 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${agent.color}18` }}>
                          <agent.icon size={20} style={{ color: agent.color }} />
                        </div>
                        <div>
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[2.5px]" style={{ color: agent.color }}>{agent.name}</p>
                          <p className="font-heading text-[18px] font-semibold text-white leading-tight">{agent.role}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full border" style={{ borderColor: `${agent.color}33`, background: `${agent.color}0f` }}>
                          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: agent.color }} />
                          <span className="font-mono text-[10px]" style={{ color: agent.color }}>{ar ? 'نشط' : 'ACTIVE'}</span>
                        </div>
                      </div>

                      <p className="text-[15px] text-text-secondary leading-relaxed mb-8 max-w-[540px]">
                        {agent.desc}
                      </p>

                      {/* Output chips */}
                      <div>
                        <p className="font-mono text-[10px] text-text-muted uppercase tracking-[2px] mb-3">{ar ? 'المخرجات' : 'OUTPUT'}</p>
                        <div className="flex flex-wrap gap-2">
                          {agent.output.split(' · ').map((item: string) => (
                            <span
                              key={item}
                              className="px-3 py-1.5 rounded-lg text-[12px] font-mono border"
                              style={{
                                borderColor: `${agent.color}33`,
                                background: `${agent.color}0d`,
                                color: 'rgba(255,255,255,0.75)',
                              }}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Navigation hint */}
                      <div className="mt-8 flex items-center gap-4">
                        <div className="flex gap-1.5">
                          {agents.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveAgent(idx)}
                              className="rounded-full transition-all duration-200"
                              style={{
                                width: idx === activeAgent ? '20px' : '6px',
                                height: '6px',
                                background: idx === activeAgent ? agent.color : 'rgba(255,255,255,0.15)',
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2 ml-auto">
                          <button
                            onClick={() => setActiveAgent((activeAgent - 1 + agents.length) % agents.length)}
                            className="w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 hover:bg-white/5"
                            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
                          >
                            <ChevronLeft size={14} className="text-text-muted" />
                          </button>
                          <button
                            onClick={() => setActiveAgent((activeAgent + 1) % agents.length)}
                            className="w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 hover:bg-white/5"
                            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
                          >
                            <ChevronRight size={14} className="text-text-muted" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          BRAND BRAIN
      ══════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 bg-bg-surface">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <SectionLabel text="Brand Brain" color="text-accent-purple" />
              <SectionHeading>{ar ? 'الذكاء الاصطناعي يتعلم علامتك التجارية' : 'AI that learns your brand'}</SectionHeading>
              <p className="text-[16px] text-text-secondary leading-relaxed mt-5 mb-8">
                {ar
                  ? 'Brand Brain هو ذاكرة NEXUS AI. يحفظ كل ما يهم: نبرة علامتك التجارية، جمهورك المستهدف، منافسيك، منتجاتك، أهدافك، وتعليقاتك السابقة — ثم يحقن هذا السياق في كل وكيل لإنتاج محتوى دقيق ومتسق.'
                  : "Brand Brain is NEXUS AI's memory. It stores everything that matters: your brand tone, target audience, competitors, products, goals, and past feedback — then injects this context into every agent to produce precise, consistent output."}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ar ? 'نبرة العلامة التجارية' : 'Brand voice & tone',
                  ar ? 'الجمهور المستهدف' : 'Target audience profiles',
                  ar ? 'قائمة المنافسين' : 'Competitor list',
                  ar ? 'المنتجات والخدمات' : 'Products & services',
                  ar ? 'الأهداف التسويقية' : 'Marketing goals',
                  ar ? 'تعليقات الموافقات السابقة' : 'Past approval feedback',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2.5 text-[13px] text-text-secondary">
                    <CheckCircle size={14} className="text-accent-teal shrink-0" />{item}
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Brain visual */}
            <Reveal delay={0.15}>
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(139,92,246,0.15)] flex items-center justify-center">
                    <Brain size={20} className="text-accent-purple" />
                  </div>
                  <div>
                    <p className="font-heading text-[15px] font-semibold text-white">Brand Brain</p>
                    <p className="font-mono text-[11px] text-accent-teal">{ar ? 'نشط — يحقن السياق في جميع الوكلاء' : 'Active — injecting context to all agents'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: ar ? 'العلامة التجارية' : 'Brand', value: ar ? 'نبرة محترفة ودافئة · عربي وإنجليزي' : 'Professional warm tone · Arabic & English', color: '#8B5CF6' },
                    { label: ar ? 'الجمهور' : 'Audience', value: ar ? 'أصحاب الأعمال 30-55 · الإمارات والخليج' : 'Business owners 30-55 · UAE & Gulf', color: '#10B981' },
                    { label: ar ? 'الهدف الرئيسي' : 'Primary Goal', value: ar ? 'زيادة المبيعات المباشرة والوعي الرقمي' : 'Drive direct sales & digital awareness', color: '#00D4FF' },
                    { label: ar ? 'المنافسون' : 'Competitors', value: ar ? '3 منافسين محددين · استراتيجية مراقبة نشطة' : '3 identified competitors · Active monitoring', color: '#FFB800' },
                  ].map(row => (
                    <div key={row.label} className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
                      <div className="w-1 h-full rounded-full shrink-0 mt-1" style={{ background: row.color, minHeight: 8 }} />
                      <div>
                        <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider">{row.label}</p>
                        <p className="text-[12px] text-text-secondary mt-0.5">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)] flex items-center justify-between">
                  <span className="text-[12px] text-text-muted">{ar ? 'آخر تحديث: منذ 2 دقيقة' : 'Last updated: 2 minutes ago'}</span>
                  <span className="text-[11px] font-mono text-accent-purple">{ar ? 'متصل بـ 5 وكلاء' : 'Connected to 5 agents'}</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          WORKFLOW
      ══════════════════════════════════════════ */}
      <section id="workflow" className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionLabel text={ar ? 'سير العمل' : 'Workflow'} color="text-accent-teal" />
            <SectionHeading>{ar ? 'من الصفر إلى النتائج في 10 خطوات' : 'From zero to results in 10 steps'}</SectionHeading>
            <p className="text-[16px] text-text-secondary leading-relaxed max-w-[580px] mt-4 mb-14">
              {ar ? 'عملية واضحة ومنظمة تضع أنت فيها نقطة التحكم الرئيسية.' : 'A clear, structured process where you remain the primary control point.'}
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {workflowSteps.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.06}>
                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${step.n === '06' || step.n === '07' ? 'bg-[rgba(139,92,246,0.2)] ring-2 ring-[rgba(139,92,246,0.4)]' : 'bg-[rgba(139,92,246,0.1)]'}`}>
                    <step.icon size={20} className={step.n === '06' || step.n === '07' ? 'text-accent-purple' : 'text-text-secondary'} />
                  </div>
                  <p className="font-mono text-[11px] text-accent-purple mb-1.5">{step.n}</p>
                  <h3 className="font-heading text-[15px] font-semibold text-white mb-1.5">{step.title}</h3>
                  <p className="text-[12px] text-text-secondary leading-relaxed">{step.desc}</p>
                  {(step.n === '06' || step.n === '07') && (
                    <span className="mt-2 inline-block font-mono text-[9px] uppercase tracking-wider text-accent-purple bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.2)] px-2 py-0.5 rounded-full">
                      {ar ? 'أنت هنا' : 'You here'}
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          APPROVAL CONTROL
      ══════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 bg-bg-surface">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[860px] mx-auto text-center">
            <Reveal>
              <SectionLabel text={ar ? 'التحكم الكامل' : 'Full Control'} color="text-accent-teal" />
              <SectionHeading center>
                {ar ? 'الذكاء الاصطناعي يعمل. أنت تتحكم.' : 'AI does the work. You stay in control.'}
              </SectionHeading>
              <p className="text-[17px] sm:text-[19px] text-text-secondary leading-relaxed mt-6 mb-12">
                {ar
                  ? 'لا شيء يُنشر، لا شيء يُطلق، لا قرش يُنفق — دون موافقتك الصريحة.'
                  : 'Nothing is published. Nothing is launched. Not a single dirham is spent — without your explicit approval.'}
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                {[
                  { icon: Lock,         color: '#8B5CF6', title: ar ? 'موافقة قبل النشر'        : 'Approve Before Publishing',  desc: ar ? 'كل محتوى يمر بك أولاً'              : 'Every piece of content goes through you first' },
                  { icon: Target,       color: '#10B981', title: ar ? 'موافقة قبل إطلاق الحملات' : 'Approve Before Campaign Launch', desc: ar ? 'لا حملة تُطلق دون موافقتك'      : 'No campaign launches without your approval' },
                  { icon: CreditCard,   color: '#FFB800', title: ar ? 'لا إنفاق تلقائي'          : 'No Automatic Spending',      desc: ar ? 'أنت من يقرر الميزانية والإنفاق'  : 'You decide the budget and spending' },
                  { icon: Eye,          color: '#00D4FF', title: ar ? 'رؤية كاملة قبل التنفيذ'   : 'Full Visibility Before Execution', desc: ar ? 'راجع كل شيء قبل أن يخرج'   : 'Review everything before it goes out' },
                ].map((c, i) => (
                  <div key={c.title} className="glass-card rounded-xl p-5 text-center">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: `${c.color}18` }}>
                      <c.icon size={18} style={{ color: c.color }} />
                    </div>
                    <h4 className="font-heading text-[13px] font-semibold text-white mb-1.5">{c.title}</h4>
                    <p className="text-[11px] text-text-secondary">{c.desc}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="flex items-center justify-center gap-3 p-4 rounded-xl border border-[rgba(255,184,0,0.2)] bg-[rgba(255,184,0,0.05)]">
                <AlertCircle size={16} className="text-accent-amber shrink-0" />
                <p className="text-[13px] text-text-secondary text-start">
                  {ar
                    ? 'التنفيذ المتصل بالمنصات الإعلانية متاح حيث تم الربط والموافقة. التنفيذ اليدوي متاح دائماً كبديل كامل.'
                    : 'Connected execution to ad platforms is available where integrated and approved. Manual execution is always available as a full alternative.'}
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          INDUSTRIES
      ══════════════════════════════════════════ */}
      <section id="industries" className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionLabel text={ar ? 'القطاعات' : 'Industries'} color="text-accent-teal" />
            <SectionHeading>{ar ? 'مصمم لكل قطاع' : 'Built for every sector'}</SectionHeading>
            <p className="text-[16px] text-text-secondary leading-relaxed max-w-[560px] mt-4 mb-12">
              {ar ? 'Brand Brain يتكيف مع خصائص كل قطاع وكل علامة تجارية.' : 'Brand Brain adapts to the specifics of every sector and every brand.'}
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {industries.map((ind, i) => (
              <Reveal key={ind.name} delay={i * 0.07}>
                <div className="group relative rounded-2xl overflow-hidden border border-bg-border hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] cursor-default">
                  <div className="h-40 flex items-end p-5"
                    style={{ background: `linear-gradient(135deg, ${ind.color}1A 0%, ${ind.color}06 50%, #0A0E27 100%)` }}>
                    <div>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${ind.color}20` }}>
                        <ind.icon size={16} style={{ color: ind.color }} />
                      </div>
                      <h4 className="font-heading text-[15px] font-semibold text-white">{ind.name}</h4>
                      <p className="text-[12px] text-text-secondary mt-0.5">{ind.desc}</p>
                    </div>
                  </div>
                  <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${ind.color}, transparent)` }} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CASE STUDY — NEXUS AI uses itself
      ══════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 bg-bg-surface">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[860px] mx-auto">
            <Reveal>
              <SectionLabel text={ar ? 'دراسة حالة' : 'Case Study'} color="text-accent-amber" />
              <SectionHeading>
                {ar ? 'NEXUS AI يسوّق نفسه بنفسه' : 'NEXUS AI markets itself with itself'}
              </SectionHeading>
              <p className="text-[16px] text-text-secondary leading-relaxed mt-5 mb-10">
                {ar
                  ? 'فريق NEXUS AI يستخدم المنصة لتسويق NEXUS AI — من الاستراتيجية إلى المحتوى إلى الحملات. هذه الصفحة التي تقرأها الآن جزء من المخرجات التي أنتجها النظام ثم وافق عليها الفريق.'
                  : 'The NEXUS AI team uses the platform to market NEXUS AI itself — from strategy to content to campaigns. The page you are reading now is part of the output produced by the system and approved by the team.'}
              </p>
              <div className="grid sm:grid-cols-3 gap-5">
                {[
                  { step: ar ? 'الاستراتيجية' : 'Strategy', detail: ar ? 'STRATEGIST بنى خطة الإطلاق والمحاور التسويقية' : 'STRATEGIST built the launch plan and marketing pillars' },
                  { step: ar ? 'المحتوى' : 'Content', detail: ar ? 'NEX كتب النصوص والكابشن والرسائل التسويقية' : 'NEX wrote the copy, captions, and marketing messages' },
                  { step: ar ? 'الموافقة' : 'Approval', detail: ar ? 'الفريق راجع ووافق قبل النشر — كما يفعل عملاؤنا' : 'The team reviewed and approved before publishing — just like our clients do' },
                ].map((s, i) => (
                  <div key={s.step} className="glass-card rounded-xl p-5">
                    <p className="font-mono text-[10px] text-accent-amber uppercase tracking-wider mb-2">0{i + 1} — {s.step}</p>
                    <p className="text-[13px] text-text-secondary leading-relaxed">{s.detail}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          INTEGRATIONS
      ══════════════════════════════════════════ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionLabel text={ar ? 'التكاملات' : 'Integrations'} color="text-accent-purple" />
            <SectionHeading>{ar ? 'مبني على أدوات موثوقة' : 'Built on trusted tools'}</SectionHeading>
            <p className="text-[16px] text-text-secondary leading-relaxed max-w-[560px] mt-4 mb-12">
              {ar ? 'نحن نوضح بصدق ما هو متصل وما يتطلب إعداداً.' : 'We are transparent about what is connected and what requires setup.'}
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((intg, i) => (
              <Reveal key={intg.name} delay={i * 0.08}>
                <div className="glass-card rounded-xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${intg.color}18` }}>
                    <intg.icon size={18} style={{ color: intg.color }} />
                  </div>
                  <div>
                    <h4 className="font-heading text-[15px] font-semibold text-white">{intg.name}</h4>
                    <p className="text-[12px] text-text-secondary mt-0.5">{intg.status}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 bg-bg-surface">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-14">
            <SectionLabel text={ar ? 'سيناريوهات استخدام' : 'Use Case Scenarios'} color="text-accent-teal" />
            <SectionHeading center>{ar ? 'مُصمَّم لأعمال مثل عملك' : 'Designed for businesses like yours'}</SectionHeading>
          </Reveal>

          <Reveal>
            <div className="max-w-[740px] mx-auto glass-panel rounded-2xl p-8 sm:p-10">
              <AnimatePresence mode="wait">
                <motion.div key={testimonialIdx}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}>
                  <p className="text-[16px] sm:text-[18px] text-text-secondary leading-relaxed mb-8">
                    {testimonials[testimonialIdx].quote}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-[18px] shrink-0">
                        {testimonials[testimonialIdx].icon}
                      </div>
                      <p className="text-[12px] font-mono text-text-muted truncate">{testimonials[testimonialIdx].label}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setTestimonialIdx((n) => (n - 1 + testimonials.length) % testimonials.length)}
                        className="p-2 rounded-lg bg-bg-elevated text-text-secondary hover:text-white transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={() => setTestimonialIdx((n) => (n + 1) % testimonials.length)}
                        className="p-2 rounded-lg bg-bg-elevated text-text-secondary hover:text-white transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════ */}
      <section id="pricing" className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-14">
            <SectionLabel text={ar ? 'الأسعار' : 'Pricing'} color="text-accent-teal" />
            <SectionHeading center>{ar ? 'خطط واضحة وصادقة' : 'Clear, honest pricing'}</SectionHeading>
            <p className="text-[16px] text-text-secondary mt-4 max-w-[520px] mx-auto">
              {ar ? 'بدون رسوم خفية. بدون ادعاءات مبالغ فيها. سياسة استخدام عادل تسري على الخطط المفتوحة.' : 'No hidden fees. No exaggerated claims. Fair usage policy applies to unlimited plans.'}
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1000px] mx-auto">
            {pricingPlans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div className={`relative rounded-2xl p-7 h-full flex flex-col ${plan.featured ? 'bg-bg-surface border-2 border-accent-purple shadow-[0_0_50px_rgba(139,92,246,0.12)]' : 'bg-bg-surface border border-bg-border'}`}>
                  {plan.featured && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-primary text-white text-[11px] font-mono font-bold uppercase tracking-[1px] px-3 py-1 rounded-full whitespace-nowrap">
                      {ar ? 'الأكثر طلباً' : 'Most Popular'}
                    </span>
                  )}
                  <h3 className="font-heading text-[19px] font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    {plan.price === '0' ? (
                      <span className="font-mono text-[33px] font-bold text-white">{ar ? 'مجاني' : 'Free'}</span>
                    ) : (
                      <>
                        <span className="font-mono text-[33px] font-bold text-white">${plan.price}</span>
                        <span className="text-text-muted text-[14px]">{plan.period}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[13px] text-text-secondary mb-6">{plan.desc}</p>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-text-secondary">
                        <CheckCircle size={14} className="text-accent-teal shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth/register"
                    className={`block text-center font-heading text-[14px] font-semibold uppercase tracking-[1px] py-3 rounded-lg transition-all duration-300 ${plan.featured ? 'btn-gradient text-white' : 'border border-accent-purple text-accent-purple hover:bg-[rgba(139,92,246,0.1)]'}`}>
                    {plan.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TRUST
      ══════════════════════════════════════════ */}
      <section className="py-20 bg-bg-surface border-y border-[rgba(255,255,255,0.04)]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="font-mono text-[11px] text-text-muted uppercase tracking-[2px] text-center mb-8">
              {ar ? 'لماذا تثق بنا' : 'Why trust us'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {[
                { icon: Lock,        title: ar ? 'تسجيل دخول آمن'          : 'Secure Auth',           color: '#8B5CF6' },
                { icon: Eye,         title: ar ? 'مراجعة الموافقات'         : 'Approval Review',       color: '#10B981' },
                { icon: AlertCircle, title: ar ? 'لا إنفاق تلقائي'           : 'No Auto-Spend',         color: '#FFB800' },
                { icon: Database,    title: ar ? 'خصوصية البيانات'           : 'Data Privacy',          color: '#00D4FF' },
                { icon: Users,       title: ar ? 'قرارات بشرية'              : 'Human Decisions',       color: '#FF6B35' },
                { icon: Brain,       title: ar ? 'توصيات مبنية على البيانات' : 'AI-Assisted Insights',  color: '#4CAF50' },
              ].map(t => (
                <div key={t.title} className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${t.color}15` }}>
                    <t.icon size={18} style={{ color: t.color }} />
                  </div>
                  <p className="text-[12px] font-medium text-text-secondary">{t.title}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[860px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-14">
            <SectionLabel text={ar ? 'الأسئلة الشائعة' : 'FAQ'} color="text-accent-purple" />
            <SectionHeading center>{ar ? 'أسئلة تخطر على بالك' : 'Questions you might have'}</SectionHeading>
          </Reveal>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="rounded-xl border border-bg-border overflow-hidden">
                  <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-start bg-bg-surface hover:bg-bg-elevated transition-colors">
                    <span className="font-heading text-[15px] font-medium text-white">{faq.q}</span>
                    <ChevronDown size={16} className={`text-text-muted shrink-0 transition-transform duration-300 ${faqOpen === i ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {faqOpen === i && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        transition={{ duration: 0.28 }} className="overflow-hidden">
                        <p className="px-5 pb-5 text-[14px] text-text-secondary leading-relaxed">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════ */}
      <section className="relative py-32 lg:py-44 overflow-hidden bg-bg-surface">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
        <div className="relative z-10 max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[3px] text-accent-teal mb-5">{ar ? 'ابدأ اليوم' : 'Start Today'}</p>
            <h2 className="font-heading text-[32px] sm:text-[44px] lg:text-[54px] font-bold text-white leading-[1.1] tracking-[-2px] mb-6">
              {ar ? <>جهّز قسم التسويق<br /><span className="text-gradient">الذكي الخاص بك</span></> : <>Build your<br /><span className="text-gradient">AI Marketing Department</span></>}
            </h2>
            <p className="text-[17px] sm:text-[19px] text-text-secondary leading-relaxed max-w-[580px] mx-auto mb-10">
              {ar
                ? 'الاستراتيجية والمحتوى والحملات والتحليلات — في مكان واحد، بموافقتك الكاملة.'
                : 'Strategy, content, campaigns, and analytics — in one place, with your full control.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
              <Link href="/auth/register"
                className="btn-gradient font-heading text-[15px] font-semibold uppercase tracking-[1px] text-white px-10 py-4 rounded-lg inline-flex items-center gap-2 shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                {ar ? 'ابدأ مجاناً — 20 رصيداً' : 'Start Free — 20 Credits'} <ArrowRight size={18} />
              </Link>
              <a href="#workflow"
                className="font-heading text-[14px] font-medium uppercase tracking-[1px] text-text-secondary hover:text-white transition-colors border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.25)] px-8 py-4 rounded-lg">
                {ar ? 'شاهد كيف يعمل' : 'See How It Works'}
              </a>
            </div>
            <p className="text-[12px] text-text-muted">
              {ar ? 'بدون بطاقة ائتمان · 20 رصيداً AI مجاناً · إلغاء في أي وقت' : 'No credit card · 20 free AI credits · Cancel anytime'}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="border-t border-[rgba(255,255,255,0.05)] py-14">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <span className="font-heading font-bold text-[20px] text-white">NEXUS</span>
                <span className="bg-accent-purple text-white text-[10px] font-bold px-1.5 py-0.5 rounded">AI</span>
              </Link>
              <p className="text-[13px] text-text-secondary leading-relaxed">
                {ar ? 'قسم التسويق الذكي الاصطناعي الخاص بعملك.' : 'Your AI marketing department for your business.'}
              </p>
            </div>
            {/* Product */}
            <div>
              <p className="font-heading text-[13px] font-semibold text-white mb-4 uppercase tracking-[1px]">{ar ? 'المنتج' : 'Product'}</p>
              <div className="space-y-2.5">
                {[
                  { label: ar ? 'الوكلاء الذكيون' : 'AI Agents', href: '#agents' },
                  { label: 'Brand Brain', href: '#' },
                  { label: ar ? 'كيف يعمل' : 'How It Works', href: '#workflow' },
                  { label: ar ? 'الأسعار' : 'Pricing', href: '#pricing' },
                ].map(l => <a key={l.href} href={l.href} className="block text-[13px] text-text-secondary hover:text-white transition-colors">{l.label}</a>)}
              </div>
            </div>
            {/* Company */}
            <div>
              <p className="font-heading text-[13px] font-semibold text-white mb-4 uppercase tracking-[1px]">{ar ? 'الشركة' : 'Company'}</p>
              <div className="space-y-2.5">
                {[
                  { label: ar ? 'القطاعات' : 'Industries', href: '#industries' },
                  { label: ar ? 'الأسئلة الشائعة' : 'FAQ', href: '#' },
                  { label: ar ? 'اتصل بنا' : 'Contact', href: '/contact' },
                ].map(l => <a key={l.label} href={l.href} className="block text-[13px] text-text-secondary hover:text-white transition-colors">{l.label}</a>)}
              </div>
            </div>
            {/* Legal */}
            <div>
              <p className="font-heading text-[13px] font-semibold text-white mb-4 uppercase tracking-[1px]">{ar ? 'قانوني' : 'Legal'}</p>
              <div className="space-y-2.5">
                {[
                  { label: ar ? 'سياسة الخصوصية' : 'Privacy Policy', href: '/privacy' },
                  { label: ar ? 'شروط الاستخدام' : 'Terms of Use', href: '/terms' },
                  { label: ar ? 'سياسة الاسترداد' : 'Refund Policy', href: '/refund' },
                ].map(l => <Link key={l.href} href={l.href} className="block text-[13px] text-text-secondary hover:text-white transition-colors">{l.label}</Link>)}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-[rgba(255,255,255,0.05)]">
            <p className="text-[12px] text-text-muted">
              © 2026 Nexus AI. {ar ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
            </p>
            <p className="text-[11px] text-text-muted text-center">
              {ar
                ? 'NEXUS AI أداة مساعدة. النتائج تعتمد على جودة بيانات الإدخال والموافقات والتنفيذ.'
                : 'NEXUS AI is an assistive tool. Results depend on input quality, approvals, and execution.'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
