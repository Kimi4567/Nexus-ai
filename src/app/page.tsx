'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/ui/Navbar'
import NeuralCanvas from '@/components/ui/NeuralCanvas'
import { ChevronDown, Play, Check, ArrowLeft, Zap, Shield, BarChart3, Film, Megaphone, Users, Globe, Lock } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   NEXUS AI — Spaceship Landing Page
   A machine from the future. Every pixel designed to captivate.
   ═══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const crew = [
    {
      name: 'NEX',
      fullName: 'NEX — Neural Explorer',
      role: 'منتج الفيديو',
      desc: 'يولد فيديوهات تسويقية احترافية بالكامل باستخدام أحدث نماذج الذكاء الاصطناعي. يكتب السكريبت، يختار الصوت، ويركّب المشاهد.',
      color: 'from-amber to-orange',
      badgeClass: 'agent-badge-nex',
      icon: Film,
      stats: { videos: '10K+', time: '< 60s' },
    },
    {
      name: 'VEX',
      fullName: 'VEX — Virtual Executor',
      role: 'مدير الإعلانات',
      desc: 'يُنشئ ويدير حملاتك الإعلانية على Meta، TikTok، Google، وSnapchat. يُحسّن الميزانية يومياً ويُعيد استهداف الجمهور تلقائياً.',
      color: 'from-cyan to-blue',
      badgeClass: 'agent-badge-vex',
      icon: Megaphone,
      stats: { campaigns: '500+', roas: '4.2x' },
    },
    {
      name: 'PULSE',
      fullName: 'PULSE — Predictive Learning Unit',
      role: 'المحلل الاستراتيجي',
      desc: 'يحلل بيانات حملاتك في real-time ويقدم توصيات based on patterns بيشوفها الإنسان العادي. يتنبأ بالاتجاهات قبل ما تحصل.',
      color: 'from-purple to-pink',
      badgeClass: 'agent-badge-pulse',
      icon: BarChart3,
      stats: { accuracy: '94%', insights: '24/7' },
    },
    {
      name: 'Sentinel',
      fullName: 'Sentinel — Strategic Guardian',
      role: 'الحارس الذكي',
      desc: 'يراقب كل حاجة: الميزانية، الأداء، المنافسين، والمشاكل التقنية. يحذرك قبل ما تحصل المشكلة، ويُقترح حلول فورية.',
      color: 'from-emerald to-teal',
      badgeClass: 'agent-badge-sentinel',
      icon: Shield,
      stats: { uptime: '99.9%', alerts: 'Instant' },
    },
  ]

  const platforms = [
    { name: 'Meta', icon: 'M', color: '#1877F2', connected: true },
    { name: 'TikTok', icon: 'T', color: '#FE2C55', connected: true },
    { name: 'Google', icon: 'G', color: '#4285F4', connected: true },
    { name: 'Snapchat', icon: 'S', color: '#FFFC00', connected: false },
    { name: 'LinkedIn', icon: 'in', color: '#0A66C2', connected: false },
    { name: 'X', icon: '𝕏', color: '#FFFFFF', connected: false },
  ]

  const clients = [
    { name: 'أحمد', role: 'صاحب متجر إلكتروني', avatar: 'أ', result: 'زاد المبيعات 300%' },
    { name: 'سارة', role: 'مديرة تسويق', avatar: 'س', result: 'وفرت 40 ساعة/شهر' },
    { name: 'محمد', role: 'مؤسس شركة ناشئة', avatar: 'م', result: '10K متابع جديد' },
  ]

  const pricing = [
    {
      name: 'Starter',
      price: '0',
      period: 'للأبد',
      features: ['5 فيديوهات/شهر', '3 حملات إعلانية', 'تحليلات أساسية', 'دعم عبر البريد'],
      cta: 'ابدأ مجاناً',
      popular: false,
    },
    {
      name: 'Pro',
      price: '99',
      period: 'USD/شهر',
      features: ['فيديوهات غير محدودة', 'حملات غير محدودة', 'تحليلات متقدمة + AI', 'دعم أولوية', 'ربط 5 منصات', 'API access'],
      cta: 'اشترك الآن',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: '299',
      period: 'USD/شهر',
      features: ['كل مميزات Pro', 'وكلاء مخصصين', 'تحليلات real-time', 'دعم 24/7 مباشر', 'On-premise option', 'مدير حساب مخصص'],
      cta: 'تواصل معنا',
      popular: false,
    },
  ]

  const faqs = [
    { q: 'إزاي NEXUS AI بيختلف عن ChatGPT أو الأدوات التانية؟', a: 'NEXUS AI مش أداة واحدة — ده فريق كامل من 4 وكلاء متخصصين (NEX, VEX, PULSE, Sentinel) بيشتغلوا مع بعض كـ unit متكامل. NEX بيولد الفيديو، VEX بيُدير الإعلان، PULSE بيحلل البيانات، وSentinel بيُراقب كل حاجة. كل ده في منصة واحدة موحدة.' },
    { q: 'هل أحتاج خبرة تقنية عشان استخدم المنصة؟', a: 'لا خالص! NEXUS AI مصمم خصيصاً للمسوقين وأصحاب الشركات مش للمطورين. كل حاجة drag-and-drop أو بتكتب وصف بسيط بالعربية. الـ 4 وكلاء بيفهموا العربي والإنجليزي.' },
    { q: 'إزاي بربط حساباتي على Meta و TikTok؟', a: 'من لوحة التحكم، اضغط "ربط منصة" واختار المنصة. هيتم توجيهك للتأكيد — وبعدها VEX بيبدأ يُدير الإعلانات مباشرة. كل الموافقات بتكون منك أولاً.' },
    { q: 'هل الـ AI بياخد قرارات بدون ما أعرف؟', a: 'أبداً! NEXUS AI بيُقترح وبينفذ بس بعد موافقتك. كل حملة، كل فيديو، كل تعديل — بيجيلك إشعار للموافقة. إنت المتحكم دائماً.' },
    { q: 'هل فيه فترة تجربة مجانية؟', a: 'آه! خطة Starter مجانية 100% وتكفيك لتجربة كل المميزات الأساسية. مفيش بطاقة ائتمان مطلوبة.' },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#020204' }}>
      {/* Deep space background with subtle grid */}
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
      <NeuralCanvas />

      {/* Ambient glow orbs that follow mouse */}
      <div
        className="fixed w-[600px] h-[600px] rounded-full pointer-events-none opacity-20 blur-[120px]"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.15), transparent 70%)',
          left: `${mousePos.x * 100}%`,
          top: `${mousePos.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 1.5s ease-out, top 1.5s ease-out',
        }}
      />

      <Navbar />

      {/* ═══════════════════ HERO — Spaceship Cockpit ═══════════════════ */}
      <section className="relative z-10 pt-32 pb-20 section-padding perspective-container">
        <div className="container-nexus text-center">
          {/* Status HUD */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full hud-border mb-10 text-sm">
            <span className="status-orb status-orb-online" />
            <span className="text-emerald-400 font-medium">النظام شغال</span>
            <span className="text-white/20">|</span>
            <span className="text-text-secondary">4 وكلاء جاهزين للإطلاق</span>
            <span className="text-white/20">|</span>
            <span className="text-amber text-xs font-mono">v3.0.1</span>
          </div>

          {/* Main headline with neon glow */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 leading-[1.05] tracking-tight">
            <span className="neon-text">فريق ذكاء</span>
            <br />
            <span className="gradient-text">يشتغل لك 24/7</span>
          </h1>

          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-4 leading-relaxed">
            مركبة NEXUS AI مجهزة بـ 4 وكلاء متخصصين.
            <br className="hidden md:block" />
            NEX يُنتج. VEX يُعلن. PULSE يُحلل. Sentinel يُراقب.
          </p>

          <p className="text-sm text-text-muted mb-10 max-w-xl mx-auto">
            كل ده وأنت نائم. الموافقات بتكون منك. النتائج بتكون فعلية.
          </p>

          {/* CTA Buttons with 3D effect */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/auth/register" className="btn-primary btn-3d text-lg px-8 py-4">
              <Zap className="w-5 h-5" />
              شغّل مركبتك
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <button className="btn-secondary btn-3d text-lg px-8 py-4">
              <Play className="w-5 h-5" />
              شوف العرض التوضيحي
            </button>
          </div>

          {/* Platform Orbs — Visual proof of connections */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="text-text-muted text-sm">متصل الآن:</span>
            {platforms.filter(p => p.connected).map((platform) => (
              <div key={platform.name} className="platform-orb platform-connected" title={platform.name}>
                <span className="text-sm font-bold" style={{ color: platform.color }}>{platform.icon}</span>
              </div>
            ))}
            <span className="text-text-muted text-sm">+3 قريباً</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════ AGENTS — The Crew ═══════════════════ */}
      <section className="relative z-10 py-24 section-padding">
        <div className="container-nexus">
          <div className="text-center mb-20">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">طاقم المركبة</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">4 وكلاء. مهمة واحدة.</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              كل وكيل متخصص في مجاله. يشتغلوا معاً كفريق واحد — زي ما بيحصل في أفضل الشركات، بس بالذكاء الاصطناعي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 perspective-container">
            {crew.map((agent, idx) => {
              const Icon = agent.icon
              return (
                <div
                  key={agent.name}
                  className="agent-card perspective-card p-6 text-center group cursor-pointer corner-accent"
                  style={{ animationDelay: `${idx * 150}ms` }}
                >
                  {/* Agent Avatar with glow */}
                  <div className="relative mx-auto mb-5 w-20 h-20">
                    <div className={`client-avatar mx-auto flex items-center justify-center bg-gradient-to-br ${agent.color}`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${agent.badgeClass}`}>
                      {agent.name}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold mb-1 group-hover:text-amber transition-colors">
                    {agent.name}
                  </h3>
                  <p className="text-text-muted text-sm mb-1">{agent.fullName}</p>
                  <p className="text-amber text-sm font-medium mb-4">{agent.role}</p>

                  <p className="text-text-secondary text-sm leading-relaxed mb-5">
                    {agent.desc}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
                    {Object.entries(agent.stats).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="text-lg font-bold text-text-primary">{val}</div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wider">{key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS — Launch Sequence ═══════════════════ */}
      <section className="relative z-10 py-24 section-padding">
        <div className="container-nexus">
          <div className="text-center mb-20">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">تسلسل الإطلاق</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">3 خطوات. وانطلق.</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              مفيش تعقيد. مفيش setup طويل. في 3 دقايق بس، مركبتك بتكون جاهزة للإقلاع.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: '01',
                title: 'سجّل واشترك',
                desc: 'اختار خطتك — Starter مجاني أو Pro للأعمال الجادة. مفيش بطاقة مطلوبة للتجربة.',
                icon: Users,
                color: 'amber',
              },
              {
                step: '02',
                title: 'ربط المنصات',
                desc: 'اربط Meta، TikTok، Google، أو أي منصة تانية. VEX بيبدأ يُحلل أدائك فوراً.',
                icon: Globe,
                color: 'cyan',
              },
              {
                step: '03',
                title: 'الوكلاء يشتغلوا',
                desc: 'NEX يولد فيديوهات. VEX يُدير الإعلانات. PULSE يُحلل. Sentinel يُراقب. كل ده وأنت نائم.',
                icon: Zap,
                color: 'emerald',
              },
            ].map((item, idx) => {
              const Icon = item.icon
              return (
                <div key={idx} className="relative group">
                  <div className="glass p-8 text-center h-full corner-accent transition-all duration-500 group-hover:scale-[1.02]">
                    <div className="text-5xl font-black text-white/5 mb-4">{item.step}</div>
                    <div className={`w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-${item.color}/10 border border-${item.color}/20`}>
                      <Icon className={`w-7 h-7 text-${item.color}-400`} />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-text-secondary text-sm leading-relaxed">{item.desc}</p>
                  </div>
                  {idx < 2 && (
                    <div className="hidden md:block absolute top-1/2 -left-4 w-8 h-px bg-gradient-to-l from-amber/30 to-transparent" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CLIENT AVATARS — Social Proof ═══════════════════ */}
      <section className="relative z-10 py-24 section-padding">
        <div className="container-nexus">
          <div className="text-center mb-16">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">شهادات القادة</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">عملاء غيّروا شركاتهم</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {clients.map((client, idx) => (
              <div key={idx} className="glass p-6 corner-accent text-center group hover:scale-[1.02] transition-transform">
                <div className="client-avatar mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-amber">
                  {client.avatar}
                </div>
                <h4 className="font-bold mb-1">{client.name}</h4>
                <p className="text-text-muted text-sm mb-4">{client.role}</p>
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-emerald-400 text-sm font-medium">{client.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ PRICING — Command Modules ═══════════════════ */}
      <section id="pricing" className="relative z-10 py-24 section-padding">
        <div className="container-nexus">
          <div className="text-center mb-20">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">وحدات القيادة</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">اختار قدرات مركبتك</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              كل خطة بتزود مركبتك بقدرات إضافية. ابدأ مجاناً وطوّر لما تحتاج.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-6 ${plan.popular ? 'holo-glow' : ''}`}
                style={{
                  background: plan.popular
                    ? 'rgba(245,158,11,0.03)'
                    : 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(20px)',
                  border: plan.popular
                    ? '1px solid rgba(245,158,11,0.25)'
                    : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '20px',
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber to-orange text-black text-xs font-bold">
                    الأكثر شيوعاً
                  </div>
                )}

                <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">${plan.price}</span>
                  <span className="text-text-muted text-sm">/{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth/register"
                  className={`block text-center py-3 rounded-xl font-bold transition-all ${
                    plan.popular ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ SECURITY & TRUST ═══════════════════ */}
      <section className="relative z-10 py-24 section-padding">
        <div className="container-nexus">
          <div className="glass p-12 max-w-4xl mx-auto text-center" style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '24px',
          }}>
            <div className="flex items-center justify-center gap-3 mb-6">
              <Lock className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl md:text-3xl font-bold">أمان وموثوقية على أعلى مستوى</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              {[
                { icon: Shield, title: 'بيانات مشفرة', desc: 'AES-256 encryption لكل البيانات' },
                { icon: Users, title: 'موافقة العميل', desc: 'مفيش قرار بيتاخد بدون موافقتك' },
                { icon: Lock, title: 'GDPR Ready', desc: 'متوافق مع كل معايير الخصوصية' },
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <div key={idx} className="text-center">
                    <Icon className="w-8 h-8 text-amber mx-auto mb-3" />
                    <h4 className="font-bold mb-2">{item.title}</h4>
                    <p className="text-text-muted text-sm">{item.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FAQ — Knowledge Base ═══════════════════ */}
      <section id="faq" className="relative z-10 py-24 section-padding">
        <div className="container-nexus max-w-3xl">
          <div className="text-center mb-16">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">قاعدة المعرفة</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">الأسئلة المتكررة</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="glass overflow-hidden corner-accent transition-all duration-300"
                style={{
                  background: openFaq === i ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-right"
                >
                  <span className="font-medium text-right">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-text-muted transition-transform shrink-0 mr-3 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-5 text-text-secondary text-sm leading-relaxed">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA — Final Launch ═══════════════════ */}
      <section className="relative z-10 py-24 section-padding">
        <div className="container-nexus text-center">
          <div
            className="glass p-12 max-w-3xl mx-auto energy-ring"
            style={{
              background: 'rgba(245,158,11,0.03)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: '24px',
            }}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              جاهز لـ <span className="gradient-text">الإقلاع</span>؟
            </h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              انضم لآلاف القادة اللي بيستخدموا NEXUS AI عشان يوفروا وقت، يزودوا العائد، وينموا بسرعة.
            </p>
            <Link href="/auth/register" className="btn-primary btn-3d text-lg px-10 py-4 inline-flex">
              <Zap className="w-5 h-5" />
              شغّل مركبتك الآن
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <p className="text-text-muted text-sm mt-4">مجاني تماماً — مفيش بطاقة مطلوبة</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="relative z-10 py-16 border-t border-white/5">
        <div className="container-nexus">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="text-2xl font-bold gradient-text mb-4">NEXUS AI</h3>
              <p className="text-text-muted text-sm leading-relaxed">
                فريق ذكاء اصطناعي متكامل لنمو علامتك التجارية. 4 وكلاء. هدف واحد: نجاحك.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">الوكلاء</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li>NEX — منتج الفيديو</li>
                <li>VEX — مدير الإعلانات</li>
                <li>PULSE — المحلل</li>
                <li>Sentinel — الحارس</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">المنصات</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li>Meta (Facebook + Instagram)</li>
                <li>TikTok</li>
                <li>Google Ads</li>
                <li>Snapchat</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">الشركة</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li>عن NEXUS AI</li>
                <li>الأسعار</li>
                <li>المدونة</li>
                <li>تواصل معنا</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 text-center">
            <p className="text-text-muted text-sm">
              © 2026 NEXUS AI. كل الحقوق محفوظة. مصمم للمستقبل.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
