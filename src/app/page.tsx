'use client'

import { useEffect, useRef, useState, useCallback, useContext } from 'react'
import Link from 'next/link'
import { motion, useInView, useMotionValue, useTransform } from 'framer-motion'
import {
  Compass, Sparkles, Megaphone, Activity, ShieldCheck, Brain,
  Users, CheckCircle, Rocket, MessageCircle,
  CreditCard, Cpu, Camera, Music, Search, ArrowRight,
  Star, ChevronLeft, ChevronRight, Play, Globe, Menu, X,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { LanguageContext } from '@/contexts/LanguageContext'

/* ─── Particle Background ─── */
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let w = 0, h = 0, animId = 0
    const particles: { x: number; y: number; vx: number; vy: number; r: number; color: string }[] = []
    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight }
    const init = () => {
      particles.length = 0
      const n = window.innerWidth < 768 ? 25 : 50
      for (let i = 0; i < n; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: Math.random() * 2 + 1, color: Math.random() > 0.5 ? 'rgba(108,99,255,0.35)' : 'rgba(0,191,166,0.3)' })
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const dx = p.x - mouseRef.current.x, dy = p.y - mouseRef.current.y, dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 200 && dist > 0) { const f = (200 - dist) / 200; p.vx += (dx / dist) * f * 0.5; p.vy += (dy / dist) * f * 0.5 }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.vy *= 0.99
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill()
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j], d = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2)
          if (d < 150) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = `rgba(108,99,255,${0.08 * (1 - d / 150)})`; ctx.lineWidth = 0.5; ctx.stroke() }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    resize(); init(); draw()
    const onMove = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top } }
    const onLeave = () => { mouseRef.current = { x: -1000, y: -1000 } }
    canvas.addEventListener('mousemove', onMove, { passive: true }); canvas.addEventListener('mouseleave', onLeave); window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(animId); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} />
}

/* ─── Scroll Reveal ─── */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }} className={className}>
      {children}
    </motion.div>
  )
}

/* ─── Tilt Card ─── */
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const mx = useMotionValue(0), my = useMotionValue(0)
  const rotateX = useTransform(my, [-100, 100], [5, -5])
  const rotateY = useTransform(mx, [-100, 100], [-5, 5])
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); mx.set(e.clientX - r.left - r.width / 2); my.set(e.clientY - r.top - r.height / 2) }, [mx, my])
  const onLeave = useCallback(() => { mx.set(0); my.set(0) }, [mx, my])
  return <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 1000 }} onMouseMove={onMove} onMouseLeave={onLeave} className={className}>{children}</motion.div>
}

/* ─── Navbar ─── */
function Navbar() {
  const { t, lang } = useTranslation()
  const { setLang } = useContext(LanguageContext)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const isRTL = lang === 'ar'
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', fn, { passive: true }); return () => window.removeEventListener('scroll', fn) }, [])
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'backdrop-blur-xl' : ''}`}
      style={scrolled ? { background: 'rgba(10,14,39,0.95)', borderBottom: '1px solid rgba(108,99,255,0.15)' } : {}}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between h-16`} dir={isRTL ? 'rtl' : 'ltr'}>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center"><Sparkles size={16} className="text-white" /></div>
            <span className="font-heading font-bold text-white text-lg">NEXUS AI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {[{ href: '#how-it-works', label: t('nav.howItWorks') }, { href: '#pricing', label: t('nav.pricing') }, { href: '#agents', label: t('nav.aiTeam') }].map(item => (
              <a key={item.href} href={item.href} className="text-sm transition-colors hover:text-white" style={{ color: '#8892B0' }}>{item.label}</a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:text-white" style={{ color: '#8892B0', border: '1px solid rgba(108,99,255,0.2)' }}>
              <Globe size={13} />{lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            <Link href="/auth/login" className="text-sm px-3 py-1.5 transition-colors hover:text-white" style={{ color: '#8892B0' }}>{t('nav.login')}</Link>
            <Link href="/auth/register" className="btn-gradient text-sm font-semibold text-white px-5 py-2 rounded-xl">{t('nav.startFreeTrial')}</Link>
          </div>
          <button className="md:hidden text-white p-2" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
        {open && (
          <div className="md:hidden glass-panel rounded-xl p-4 mb-4 space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="flex items-center gap-2 text-sm w-full" style={{ color: '#8892B0' }}>
              <Globe size={14} />{lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
            </button>
            <a href="#how-it-works" className="block text-sm" style={{ color: '#8892B0' }} onClick={() => setOpen(false)}>{t('nav.howItWorks')}</a>
            <a href="#pricing" className="block text-sm" style={{ color: '#8892B0' }} onClick={() => setOpen(false)}>{t('nav.pricing')}</a>
            <Link href="/auth/login" className="block text-sm" style={{ color: '#8892B0' }}>{t('nav.login')}</Link>
            <Link href="/auth/register" className="btn-gradient text-sm font-semibold text-white px-4 py-2 rounded-xl block text-center">{t('nav.startFreeTrial')}</Link>
          </div>
        )}
      </div>
    </header>
  )
}

/* ═══════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════ */
export default function LandingPage() {
  const { t, lang } = useTranslation()
  const isRTL = lang === 'ar'
  const [testimonialIdx, setTestimonialIdx] = useState(0)

  const agents = [
    { id: 'strategist', name: 'STRATEGIST', title: t('home.strategistTitle'), desc: t('home.strategistDesc'), icon: Compass, color: '#6C63FF' },
    { id: 'nex', name: 'NEX', title: t('home.nexTitle'), desc: t('home.nexDesc'), icon: Sparkles, color: '#00BFA6' },
    { id: 'vex', name: 'VEX', title: t('home.vexTitle'), desc: t('home.vexDesc'), icon: Megaphone, color: '#FF6B35' },
    { id: 'pulse', name: 'PULSE', title: t('home.pulseTitle'), desc: t('home.pulseDesc'), icon: Activity, color: '#00D4FF' },
    { id: 'sentinel', name: 'SENTINEL', title: t('home.sentinelTitle'), desc: t('home.sentinelDesc'), icon: ShieldCheck, color: '#FFD700' },
  ]
  const steps = [
    { num: '01', title: t('home.shareBusiness'), desc: t('home.shareBusinessDesc'), icon: Users },
    { num: '02', title: t('home.buildBrain'), desc: t('home.buildBrainDesc'), icon: Brain },
    { num: '03', title: t('home.aiCollaborates'), desc: t('home.aiCollaboratesDesc'), icon: Sparkles },
    { num: '04', title: t('home.reviewApprove'), desc: t('home.reviewApproveDesc'), icon: CheckCircle },
    { num: '05', title: t('home.executeImprove'), desc: t('home.executeImproveDesc'), icon: Rocket },
  ]
  const platforms = [
    { name: t('settings.meta'), desc: t('settings.metaDesc'), icon: Globe, connected: true },
    { name: t('settings.tiktok'), desc: t('settings.tiktokDesc'), icon: Music, connected: true },
    { name: t('settings.googleAds'), desc: t('settings.googleAdsDesc'), icon: Search, connected: true },
    { name: t('settings.linkedin'), desc: t('settings.linkedinDesc'), icon: Search, connected: false },
    { name: t('settings.snapchat'), desc: t('settings.snapchatDesc'), icon: Camera, connected: false },
    { name: t('settings.whatsapp'), desc: t('settings.whatsappDesc'), icon: MessageCircle, connected: true },
    { name: t('settings.stripe'), desc: t('settings.stripeDesc'), icon: CreditCard, connected: true },
    { name: t('settings.openai'), desc: t('settings.openaiDesc'), icon: Cpu, connected: true },
  ]
  const industries = [
    { name: t('home.restaurantsCafes'), desc: t('home.restaurantsCafesDesc'), color: '#FF6B35' },
    { name: t('home.realEstate'), desc: t('home.realEstateDesc'), color: '#6C63FF' },
    { name: t('home.medicalClinics'), desc: t('home.medicalClinicsDesc'), color: '#00D4FF' },
    { name: t('home.beautySalons'), desc: t('home.beautySalonsDesc'), color: '#FF69B4' },
    { name: t('home.fitnessGyms'), desc: t('home.fitnessGymsDesc'), color: '#00BFA6' },
    { name: t('home.ecommerce'), desc: t('home.ecommerceDesc'), color: '#FFB800' },
  ]
  const testimonials = [
    { quote: isRTL ? 'فهم NEXUS AI صوت علامتنا التجارية في دقائق. المحتوى يبدو وكأنه كُتب بواسطة شخص كان جزءاً من فريقنا لسنوات.' : "NEXUS AI understood our brand voice within minutes. The content feels like it was written by someone who's been part of our team for years.", name: 'Ahmed Al-Rashid', role: isRTL ? 'مالك، مطعم زهرة الشام' : 'Owner, Zahrat Al-Sham Restaurant' },
    { quote: isRTL ? 'سير عمل الموافقة يمنحنا تحكماً كاملاً. لا شيء يُنشر دون موافقتنا الصريحة.' : 'The approval workflow gives us complete control. Nothing goes out without our explicit approval.', name: 'Fatima Hassan', role: isRTL ? 'مدير تسويق، لومينا للعقارات' : 'Marketing Director, Lumina Real Estate' },
    { quote: isRTL ? 'انتقلنا إلى استراتيجية كاملة لـ 90 يوماً مع تقويمات محتوى في أقل من أسبوع.' : 'We went from zero marketing structure to a full 90-day strategy with content calendars in under a week.', name: 'Omar Khalil', role: isRTL ? 'الرئيس التنفيذي، بولس فيتنس دبي' : 'CEO, Pulse Fitness Dubai' },
  ]
  const stats = [
    { value: '500+', label: isRTL ? 'شركة تم تأهيلها' : 'Businesses Onboarded' },
    { value: '50K+', label: isRTL ? 'قطعة محتوى' : 'Content Pieces Generated' },
    { value: '10K+', label: isRTL ? 'حملة مخططة' : 'Campaigns Planned' },
    { value: '98%', label: isRTL ? 'رضا الموافقة' : 'Approval Satisfaction' },
  ]
  const plans = [
    { name: t('home.starter'), price: '499', desc: isRTL ? 'للشركات الصغيرة' : 'For small businesses', features: isRTL ? ['وكيلان ذكاء اصطناعي', '20 قطعة محتوى/شهر', '3 حملات', 'دعم عبر البريد'] : ['2 AI Agents', '20 Content/mo', '3 Campaigns', 'Email Support'], cta: t('home.startTrial'), featured: false },
    { name: t('home.professional'), price: '1,299', desc: isRTL ? 'للفرق المتنامية' : 'For growing teams', features: isRTL ? ['جميع الوكلاء الـ 5', '100 قطعة محتوى/شهر', '10 حملات', 'تقارير متقدمة', 'سير عمل الموافقة'] : ['All 5 AI Agents', '100 Content/mo', '10 Campaigns', 'Advanced Reports', 'Approval Workflows'], cta: t('home.startTrial'), featured: true },
    { name: t('home.business'), price: '2,999', desc: isRTL ? 'للعلامات الراسخة' : 'For established brands', features: isRTL ? ['كل شيء في المحترف', 'محتوى غير محدود', 'مدير مخصص', 'وصول API'] : ['Everything in Pro', 'Unlimited Content', 'Dedicated Manager', 'API Access'], cta: t('home.contactSales'), featured: false },
  ]

  const C = { purple: '#6C63FF', teal: '#00BFA6', muted: '#8892B0', dim: '#5A6A8C', surface: 'rgba(15,19,50,0.6)', border: 'rgba(108,99,255,0.12)' }

  return (
    <div style={{ background: '#0A0E27', minHeight: '100vh' }} dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-hero" />
        <ParticleBackground />
        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 w-full py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="font-mono text-xs font-medium uppercase tracking-[2px] mb-4" style={{ color: C.teal }}>{t('home.heroOverline')}</motion.p>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6">{t('home.heroTitle')}</motion.h1>
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="text-base sm:text-lg leading-relaxed max-w-xl mb-8" style={{ color: C.muted }}>{t('home.heroSubtitle')}</motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex flex-wrap items-center gap-4 mb-6">
                <Link href="/auth/register" className="btn-gradient font-heading text-sm font-semibold uppercase tracking-wide text-white px-8 py-3.5 rounded-xl inline-flex items-center gap-2">
                  {t('home.getStarted')} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
                </Link>
                <a href="#how-it-works" className="font-heading text-sm font-medium uppercase tracking-wide inline-flex items-center gap-2 hover:text-white transition-colors" style={{ color: C.muted }}>
                  <Play size={16} /> {t('home.watchDemo')}
                </a>
              </motion.div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-xs" style={{ color: C.dim }}>
                {t('home.noCreditCard')} · {t('home.freeTrial14')} · {t('home.cancelAnytime')}
              </motion.p>
            </div>
            {/* Hero preview card */}
            <motion.div initial={{ opacity: 0, x: isRTL ? -40 : 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1, duration: 0.8 }} className="hidden lg:flex justify-center">
              <TiltCard className="w-full max-w-lg">
                <div className="glass-panel rounded-2xl p-6">
                  <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(10,14,39,0.9)', border: `1px solid ${C.border}` }}>
                    <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: C.border }}>
                      <span className="text-xs font-mono text-white font-semibold">NEXUS AI — Command Center</span>
                      <div className="flex gap-1.5">{['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}</div>
                    </div>
                    <div className="p-4 space-y-2">
                      {agents.map(a => (
                        <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(108,99,255,0.06)' }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}20` }}><a.icon size={14} style={{ color: a.color }} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono font-semibold text-white">{a.name}</p>
                            <p className="text-[10px] truncate" style={{ color: C.dim }}>{a.title}</p>
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#4CAF50', boxShadow: '0 0 6px #4CAF50' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full animate-ping" style={{ background: '#4CAF50' }} /><span className="text-xs font-mono" style={{ color: C.muted }}>5 {t('common.agentsActive')}</span></div>
                    <span className="text-xs font-mono" style={{ color: C.teal }}>{t('common.live')}</span>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ TRUSTED BY ═══ */}
      <section className="py-12 border-b" style={{ borderColor: 'rgba(108,99,255,0.1)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-mono uppercase tracking-[2px] mb-6" style={{ color: C.dim }}>{t('home.trustedBy')}</p>
          <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 opacity-40">
            {['Dubai Holding', 'Emaar', 'Aldar', 'DAMAC', 'Meraas', 'Sobha'].map(n => <span key={n} className="font-heading font-semibold text-base sm:text-lg text-white tracking-tight">{n}</span>)}
          </div>
        </div>
      </section>

      {/* ═══ AGENTS ═══ */}
      <section id="agents" className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="font-mono text-xs font-medium uppercase tracking-[2px] mb-4" style={{ color: C.purple }}>{t('home.aiTeam')}</p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-4">{t('home.aiTeamSubtitle')}</h2>
            <p className="text-base leading-relaxed max-w-xl mb-12" style={{ color: C.muted }}>{t('home.aiTeamDesc')}</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {agents.map((a, i) => (
              <Reveal key={a.id} delay={i * 0.1}>
                <div className="rounded-2xl p-6 h-full transition-all duration-300 hover:-translate-y-2 cursor-default"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${a.color}55`; el.style.boxShadow = `0 16px 48px rgba(0,0,0,0.4)` }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.border; el.style.boxShadow = '' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${a.color}20` }}><a.icon size={24} style={{ color: a.color }} /></div>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[2px] mb-1" style={{ color: a.color }}>{a.name}</p>
                  <h3 className="font-heading text-base font-semibold text-white mb-2">{a.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="py-24 lg:py-32" style={{ background: 'rgba(15,19,50,0.4)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="font-mono text-xs font-medium uppercase tracking-[2px] mb-4" style={{ color: C.teal }}>{t('home.howItWorks')}</p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-4">{t('home.howItWorksSubtitle')}</h2>
            <p className="text-base leading-relaxed max-w-xl mb-16" style={{ color: C.muted }}>{t('home.howItWorksDesc')}</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 0.1}>
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-5"><s.icon size={24} className="text-white" /></div>
                  <p className="font-mono text-xs font-medium mb-2" style={{ color: C.purple }}>{s.num}</p>
                  <h3 className="font-heading text-lg font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{s.desc}</p>
                  {i < steps.length - 1 && (
                    <div className={`hidden lg:block absolute top-7 w-full h-[2px] ${isRTL ? 'right-full' : 'left-full'}`}>
                      <div className="w-full h-full" style={{ background: 'linear-gradient(90deg, rgba(108,99,255,0.4), rgba(0,191,166,0.4))' }} />
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PLATFORMS ═══ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="font-mono text-xs font-medium uppercase tracking-[2px] mb-4" style={{ color: C.purple }}>{t('home.integrations')}</p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-4">{t('home.integrationsSubtitle')}</h2>
            <p className="text-base leading-relaxed max-w-xl mb-12" style={{ color: C.muted }}>{t('home.integrationsDesc')}</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platforms.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <div className="glass-card rounded-xl p-5 hover:scale-[1.02] transition-transform duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(21,26,58,1)' }}><p.icon size={20} style={{ color: C.muted }} /></div>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border"
                      style={p.connected ? { color: '#4CAF50', background: 'rgba(76,175,80,0.1)', borderColor: 'rgba(76,175,80,0.3)' } : { color: C.dim, background: 'rgba(90,106,140,0.1)', borderColor: 'rgba(90,106,140,0.3)' }}>
                      {p.connected ? t('settings.connected') : t('settings.comingSoon')}
                    </span>
                  </div>
                  <h4 className="font-heading text-sm font-semibold text-white mb-1">{p.name}</h4>
                  <p className="text-xs" style={{ color: C.muted }}>{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INDUSTRIES ═══ */}
      <section className="py-24 lg:py-32" style={{ background: 'rgba(15,19,50,0.4)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="font-mono text-xs font-medium uppercase tracking-[2px] mb-4" style={{ color: C.teal }}>{t('home.builtForBusiness')}</p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-4">{t('home.builtForSubtitle')}</h2>
            <p className="text-base leading-relaxed max-w-xl mb-12" style={{ color: C.muted }}>{t('home.builtForDesc')}</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((ind, i) => (
              <Reveal key={ind.name} delay={i * 0.1}>
                <div className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl" style={{ border: `1px solid ${C.border}` }}>
                  <div className="h-44 flex items-end p-6" style={{ background: `linear-gradient(135deg, ${ind.color}20 0%, ${ind.color}05 50%, #0A0E27 100%)` }}>
                    <div><h4 className="font-heading text-xl font-semibold text-white mb-1">{ind.name}</h4><p className="text-sm" style={{ color: C.muted }}>{ind.desc}</p></div>
                  </div>
                  <div className={`absolute top-0 ${isRTL ? 'right-0' : 'left-0'} w-full h-1`} style={{ background: `linear-gradient(${isRTL ? '270deg' : '90deg'}, ${ind.color}, transparent)` }} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS + TESTIMONIALS ═══ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="font-mono text-xs font-medium uppercase tracking-[2px] mb-4 text-center" style={{ color: C.purple }}>{t('home.trustedBusinesses')}</p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-16 text-center">{t('home.trustSubtitle')}</h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.1}>
                <div className="text-center">
                  <p className="font-mono text-4xl font-bold text-white mb-1">{s.value}</p>
                  <p className="text-sm" style={{ color: C.muted }}>{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="relative max-w-2xl mx-auto">
              <div className="glass-panel rounded-2xl p-8 sm:p-10">
                <div className={`flex gap-1 mb-6 ${isRTL ? 'justify-end' : ''}`}>{[...Array(5)].map((_, i) => <Star key={i} size={18} style={{ color: '#FFB800', fill: '#FFB800' }} />)}</div>
                <p className="text-base sm:text-lg leading-relaxed italic mb-8" style={{ color: C.muted }}>&ldquo;{testimonials[testimonialIdx].quote}&rdquo;</p>
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-heading font-semibold text-sm" style={{ background: 'rgba(108,99,255,0.3)' }}>
                      {testimonials[testimonialIdx].name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <p className="text-sm font-semibold text-white">{testimonials[testimonialIdx].name}</p>
                      <p className="text-xs font-mono uppercase tracking-wide" style={{ color: C.dim }}>{testimonials[testimonialIdx].role}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setTestimonialIdx(i => (i - 1 + testimonials.length) % testimonials.length)} className="p-2 rounded-lg transition-colors hover:text-white" style={{ background: 'rgba(21,26,58,1)', color: C.muted }}><ChevronLeft size={18} /></button>
                    <button onClick={() => setTestimonialIdx(i => (i + 1) % testimonials.length)} className="p-2 rounded-lg transition-colors hover:text-white" style={{ background: 'rgba(21,26,58,1)', color: C.muted }}><ChevronRight size={18} /></button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-24 lg:py-32" style={{ background: 'rgba(15,19,50,0.4)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="font-mono text-xs font-medium uppercase tracking-[2px] mb-4 text-center" style={{ color: C.teal }}>{t('home.pricing')}</p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-4 text-center">{t('home.pricingSubtitle')}</h2>
            <p className="text-base leading-relaxed max-w-xl mx-auto mb-12 text-center" style={{ color: C.muted }}>{t('home.pricingDesc')}</p>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div className="relative rounded-2xl p-6 h-full flex flex-col"
                  style={plan.featured
                    ? { background: 'rgba(15,19,50,0.8)', border: '2px solid #6C63FF', boxShadow: '0 0 40px rgba(108,99,255,0.15)' }
                    : { background: 'rgba(10,14,39,0.8)', border: `1px solid ${C.border}` }}>
                  {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-white text-[11px] font-mono font-medium uppercase tracking-wide px-3 py-1 rounded-full">{t('home.mostPopular')}</span>}
                  <h3 className="font-heading text-lg font-semibold text-white mb-2">{plan.name}</h3>
                  <div className={`flex items-baseline gap-1 mb-2 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
                    <span className="font-mono text-3xl font-bold text-white">AED {plan.price}</span>
                    <span className="text-sm" style={{ color: C.dim }}>{t('home.perMonth')}</span>
                  </div>
                  <p className="text-xs mb-6" style={{ color: C.muted }}>{plan.desc}</p>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className={`flex items-center gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`} style={{ color: C.muted }}>
                        <CheckCircle size={15} style={{ color: C.teal, flexShrink: 0 }} />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth/register" className={`block text-center font-heading text-sm font-semibold uppercase tracking-wide py-3 rounded-xl transition-all duration-300 ${plan.featured ? 'btn-gradient text-white' : 'border text-[#6C63FF] hover:bg-[rgba(108,99,255,0.1)]'}`}
                    style={plan.featured ? {} : { borderColor: C.purple }}>{plan.cta}</Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative py-32 lg:py-40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 rounded-full blur-[120px]" style={{ background: 'rgba(108,99,255,0.12)', animation: 'pulse 4s ease-in-out infinite' }} />
        </div>
        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-6">{t('home.finalCtaTitle')}</h2>
            <p className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-10" style={{ color: C.muted }}>{t('home.finalCtaDesc')}</p>
            <div className={`flex flex-wrap items-center justify-center gap-4 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link href="/auth/register" className="btn-gradient animate-pulse-glow font-heading text-sm font-semibold uppercase tracking-wide text-white px-10 py-4 rounded-xl inline-flex items-center gap-2">
                {t('home.startTrial')} — 14 {t('home.days')} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
              </Link>
              <Link href="/demo" className="font-heading text-sm font-medium uppercase tracking-wide transition-colors hover:text-white px-8 py-4 rounded-xl"
                style={{ color: C.muted, border: `1px solid ${C.border}` }}>{t('home.scheduleDemo')}</Link>
            </div>
            <p className="text-xs" style={{ color: C.dim }}>{t('home.noCreditCard')} · {t('home.fullFeatureAccess')} · {t('home.cancelAnytime')}</p>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 border-t" style={{ borderColor: 'rgba(108,99,255,0.1)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center"><Sparkles size={14} className="text-white" /></div><span className="font-heading font-bold text-white">NEXUS AI</span></div>
            <p className="text-xs" style={{ color: C.dim }}>© 2026 NEXUS AI. {isRTL ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
            <div className={`flex items-center gap-4 text-xs ${isRTL ? 'flex-row-reverse' : ''}`} style={{ color: C.dim }}>
              <Link href="/privacy" className="hover:text-white transition-colors">{isRTL ? 'الخصوصية' : 'Privacy'}</Link>
              <Link href="/terms" className="hover:text-white transition-colors">{isRTL ? 'الشروط' : 'Terms'}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
