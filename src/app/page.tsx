'use client'

import AgentAvatar from '@/components/ui/AgentAvatar'
import { useState, useCallback, memo } from 'react'
import Link from 'next/link'
import Navbar from '@/components/ui/Navbar'
import { useI18n } from '@/lib/i18n-context'
import { ChevronDown, Play, Check, ArrowLeft, Zap, Shield, BarChart3, Film, Megaphone, Users, Globe, Lock } from 'lucide-react'

const LandingPage = memo(function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const { t, isRTL } = useI18n()

  const toggleFaq = useCallback((i: number) => {
    setOpenFaq(prev => prev === i ? null : i)
  }, [])

  const crew = [
    {
      key: 'nex',
      color: 'from-amber to-orange',
      badgeClass: 'agent-badge-nex',
      icon: Film,
      stats: { videos: '10K+', time: '< 60s' },
    },
    {
      key: 'vex',
      color: 'from-cyan to-blue',
      badgeClass: 'agent-badge-vex',
      icon: Megaphone,
      stats: { campaigns: '500+', roas: '4.2x' },
    },
    {
      key: 'pulse',
      color: 'from-purple to-pink',
      badgeClass: 'agent-badge-pulse',
      icon: BarChart3,
      stats: { accuracy: '94%', insights: '24/7' },
    },
    {
      key: 'sentinel',
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
    { key: 'ahmed', avatar: isRTL ? 'أ' : 'A' },
    { key: 'sara', avatar: isRTL ? 'س' : 'S' },
    { key: 'mohamed', avatar: isRTL ? 'م' : 'M' },
  ]

  const pricingKeys = ['starter', 'pro', 'enterprise']

  const faqKeys = ['q1', 'q2', 'q3', 'q4', 'q5']

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#020204' }}>
      {/* CSS-only neural background — zero JS, GPU-only animation */}
      <div className="neural-bg" />

      <div className="fixed inset-0 grid-bg opacity-20 pointer-events-none" />

      <Navbar />

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative z-10 pt-32 pb-20 section-padding perspective-container">
        <div className="container-nexus text-center">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full hud-border mb-10 text-sm">
            <span className="status-orb status-orb-online" />
            <span className="text-emerald-400 font-medium">{t('hero.statusOnline')}</span>
            <span className="text-white/20">|</span>
            <span className="text-text-secondary">{t('hero.agentsReady')}</span>
            <span className="text-white/20">|</span>
            <span className="text-amber text-xs font-mono">{t('hero.version')}</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 leading-[1.05] tracking-tight">
            <span className="neon-text">{t('hero.headline1')}</span>
            <br />
            <span className="gradient-text">{t('hero.headline2')}</span>
          </h1>

          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-4 leading-relaxed">
            {t('hero.subheadline')}
          </p>

          <p className="text-sm text-text-muted mb-10 max-w-xl mx-auto">
            {t('hero.tagline')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/auth/register" className="btn-primary btn-3d text-lg px-8 py-4">
              <Zap className="w-5 h-5" />
              {t('hero.ctaPrimary')}
              <ArrowLeft className="w-5 h-5" style={{ transform: isRTL ? 'none' : 'rotate(180deg)' }} />
            </Link>
            <button className="btn-secondary btn-3d text-lg px-8 py-4">
              <Play className="w-5 h-5" />
              {t('hero.ctaDemo')}
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="text-text-muted text-sm">{t('hero.connectedNow')}</span>
            {platforms.filter(p => p.connected).map((platform) => (
              <div key={platform.name} className="platform-orb platform-connected" title={platform.name}>
                <span className="text-sm font-bold" style={{ color: platform.color }}>{platform.icon}</span>
              </div>
            ))}
            <span className="text-text-muted text-sm">{t('hero.comingSoon')}</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════ AGENTS ═══════════════════ */}
      <section id="crew" className="relative z-10 py-24 section-padding cv-auto">
        <div className="container-nexus">
          <div className="text-center mb-20">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">{t('agents.sectionLabel')}</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('agents.title')}</h2>
            <p className="text-text-secondary max-w-xl mx-auto">{t('agents.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 perspective-container">
            {crew.map((agent, idx) => {
              const Icon = agent.icon
              return (
                <div
                  key={agent.key}
                  className="agent-card perspective-card p-6 text-center group cursor-pointer corner-accent"
                  style={{ animationDelay: `${idx * 150}ms` }}
                >
                  <div className="relative mx-auto mb-5">
                    <AgentAvatar name={agent.key === 'sentinel' ? 'Sentinel' : agent.key.toUpperCase() as 'NEX' | 'VEX' | 'PULSE' | 'Sentinel'} size="lg" />
                  </div>

                  <h3 className="text-xl font-bold mb-1 group-hover:text-amber transition-colors">
                    {t(`agents.${agent.key}.name`)}
                  </h3>
                  <p className="text-text-muted text-sm mb-1">{t(`agents.${agent.key}.fullName`)}</p>
                  <p className="text-amber text-sm font-medium mb-4">{t(`agents.${agent.key}.role`)}</p>

                  <p className="text-text-secondary text-sm leading-relaxed mb-5">
                    {t(`agents.${agent.key}.desc`)}
                  </p>

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

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section id="how" className="relative z-10 py-24 section-padding cv-auto">
        <div className="container-nexus">
          <div className="text-center mb-20">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">{t('howItWorks.sectionLabel')}</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('howItWorks.title')}</h2>
            <p className="text-text-secondary max-w-xl mx-auto">{t('howItWorks.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {['step1', 'step2', 'step3'].map((stepKey, idx) => {
              const icons = [Users, Globe, Zap]
              const colors = ['amber', 'cyan', 'emerald']
              const Icon = icons[idx]
              return (
                <div key={stepKey} className="relative group">
                  <div className="glass p-8 text-center h-full corner-accent transition-all duration-500 group-hover:scale-[1.02]">
                    <div className="text-5xl font-black text-white/5 mb-4">{t(`howItWorks.${stepKey}.num`)}</div>
                    <div className={`w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-${colors[idx]}/10 border border-${colors[idx]}/20`}>
                      <Icon className={`w-7 h-7 text-${colors[idx]}-400`} />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{t(`howItWorks.${stepKey}.title`)}</h3>
                    <p className="text-text-secondary text-sm leading-relaxed">{t(`howItWorks.${stepKey}.desc`)}</p>
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

      {/* ═══════════════════ CLIENTS ═══════════════════ */}
      <section className="relative z-10 py-24 section-padding cv-auto">
        <div className="container-nexus">
          <div className="text-center mb-16">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">{t('clients.sectionLabel')}</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('clients.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {clients.map((client, idx) => {
              return (
                <div key={idx} className="glass p-6 corner-accent text-center group hover:scale-[1.02] transition-transform">
                  <div className="client-avatar mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-amber">
                    {client.avatar}
                  </div>
                  <h4 className="font-bold mb-1">{t(`clients.${client.key}.name`)}</h4>
                  <p className="text-text-muted text-sm mb-4">{t(`clients.${client.key}.role`)}</p>
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-emerald-400 text-sm font-medium">{t(`clients.${client.key}.result`)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section id="pricing" className="relative z-10 py-24 section-padding cv-auto">
        <div className="container-nexus">
          <div className="text-center mb-20">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">{t('pricing.sectionLabel')}</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('pricing.title')}</h2>
            <p className="text-text-secondary max-w-xl mx-auto">{t('pricing.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingKeys.map((planKey) => {
              const plan = t(`pricing.${planKey}`)
              const isPopular = planKey === 'pro'
              return (
                <div
                  key={planKey}
                  className={`relative p-6 ${isPopular ? 'holo-glow' : ''}`}
                  style={{
                    background: isPopular ? 'rgba(245,158,11,0.03)' : 'rgba(255,255,255,0.02)',
                    backdropFilter: 'blur(20px)',
                    border: isPopular ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '20px',
                  }}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber to-orange text-black text-xs font-bold">
                      {plan?.popular}
                    </div>
                  )}

                  <h3 className="text-lg font-bold mb-2">{plan?.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-extrabold">${plan?.price}</span>
                    <span className="text-text-muted text-sm">/{plan?.period}</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {(plan?.features || []).map((f: string) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/auth/register"
                    className={`block text-center py-3 rounded-xl font-bold transition-all ${isPopular ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {plan?.cta}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════ SECURITY ═══════════════════ */}
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
              <h2 className="text-2xl md:text-3xl font-bold">{t('security.title')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              {[
                { key: 'encrypted', icon: Shield },
                { key: 'consent', icon: Users },
                { key: 'gdpr', icon: Lock },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.key} className="text-center">
                    <Icon className="w-8 h-8 text-amber mx-auto mb-3" />
                    <h4 className="font-bold mb-2">{t(`security.${item.key}.title`)}</h4>
                    <p className="text-text-muted text-sm">{t(`security.${item.key}.desc`)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FAQ ═══════════════════ */}
      <section id="faq" className="relative z-10 py-24 section-padding">
        <div className="container-nexus max-w-3xl">
          <div className="text-center mb-16">
            <p className="text-amber font-semibold mb-3 text-sm tracking-widest uppercase">{t('faq.sectionLabel')}</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('faq.title')}</h2>
          </div>
          <div className="space-y-4">
            {faqKeys.map((faqKey, i) => {
              return (
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
                    onClick={() => toggleFaq(i)}
                    className="w-full flex items-center justify-between p-5"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <span className="font-medium">{t(`faq.${faqKey}.q`)}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-text-muted transition-transform shrink-0 ${isRTL ? 'mr-3' : 'ml-3'} ${
                        openFaq === i ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === i && (
                    <p className="px-5 pb-5 text-text-secondary text-sm leading-relaxed">{t(`faq.${faqKey}.a`)}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
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
              {t('cta.title1')} <span className="gradient-text">{t('cta.title2')}</span>؟
            </h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              {t('cta.subtitle')}
            </p>
            <Link href="/auth/register" className="btn-primary btn-3d text-lg px-10 py-4 inline-flex">
              <Zap className="w-5 h-5" />
              {t('cta.button')}
              <ArrowLeft className="w-5 h-5" style={{ transform: isRTL ? 'none' : 'rotate(180deg)' }} />
            </Link>
            <p className="text-text-muted text-sm mt-4">{t('cta.note')}</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="relative z-10 py-16 border-t border-white/5">
        <div className="container-nexus">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="text-2xl font-bold gradient-text mb-4">NEXUS AI</h3>
              <p className="text-text-muted text-sm leading-relaxed mb-4">
                {t('footer.description')}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-1 rounded-md text-[10px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/5">SSL</span>
                <span className="px-2 py-1 rounded-md text-[10px] font-bold text-amber border border-amber/20 bg-amber/5">Stripe</span>
                <span className="px-2 py-1 rounded-md text-[10px] font-bold text-cyan border border-cyan/20 bg-cyan/5">GDPR</span>
                <span className="px-2 py-1 rounded-md text-[10px] font-bold text-violet border border-violet/20 bg-violet/5">AES-256</span>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">{t('footer.agents')}</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li><Link href="/studio" className="hover:text-amber transition">NEX — {t('agents.nex.role')}</Link></li>
                <li><Link href="/vex" className="hover:text-amber transition">VEX — {t('agents.vex.role')}</Link></li>
                <li><Link href="/analytics" className="hover:text-amber transition">PULSE — {t('agents.pulse.role')}</Link></li>
                <li><Link href="/sentinel" className="hover:text-amber transition">Sentinel — {t('agents.sentinel.role')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">{t('footer.platforms')}</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li>Meta (Facebook + Instagram)</li>
                <li>TikTok</li>
                <li>Google Ads</li>
                <li>Snapchat</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">{t('footer.legal')}</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li><Link href="/terms" className="hover:text-amber transition">{t('footer.terms')}</Link></li>
                <li><Link href="/privacy" className="hover:text-amber transition">{t('footer.privacy')}</Link></li>
                <li><Link href="/cookies" className="hover:text-amber transition">{t('footer.cookies')}</Link></li>
                <li><Link href="/refund" className="hover:text-amber transition">{t('footer.refund')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-text-muted text-sm">{t('footer.copyright')}</p>
            <p className="text-text-muted text-xs">
              {t('footer.location')} • {t('footer.legalEmail')} • {t('footer.supportEmail')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
})

export default LandingPage