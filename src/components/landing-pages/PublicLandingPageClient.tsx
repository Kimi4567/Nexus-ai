'use client'

import type { PublicLandingPageSnapshot } from '@/lib/landingPageContract'
import { trustedPublishedCtaHref } from '@/lib/publicLandingPageCta'
import { ArrowUpLeft, Check, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const THEME_CLASSES = {
  MIDNIGHT: {
    page: 'bg-[#050817] text-white',
    glow: 'from-indigo-500/30 via-violet-500/10 to-transparent',
    eyebrow: 'border-white/10 bg-white/5 text-indigo-200',
    muted: 'text-slate-300',
    card: 'border-white/10 bg-white/[0.06] text-slate-100',
    button: 'bg-white text-[#0B1028] hover:bg-indigo-50',
    footer: 'text-slate-500',
  },
  IVORY: {
    page: 'bg-[#FBF8F2] text-[#17130E]',
    glow: 'from-amber-300/35 via-orange-100/20 to-transparent',
    eyebrow: 'border-amber-900/10 bg-white/70 text-amber-900',
    muted: 'text-stone-600',
    card: 'border-amber-950/10 bg-white/70 text-stone-800',
    button: 'bg-[#17130E] text-white hover:bg-stone-800',
    footer: 'text-stone-400',
  },
  VIOLET: {
    page: 'bg-[#F6F3FF] text-[#17112E]',
    glow: 'from-violet-400/35 via-fuchsia-200/20 to-transparent',
    eyebrow: 'border-violet-200 bg-white/70 text-violet-800',
    muted: 'text-slate-600',
    card: 'border-violet-200/70 bg-white/75 text-slate-800',
    button: 'bg-[#5E3FD8] text-white hover:bg-[#4F35B8]',
    footer: 'text-slate-400',
  },
} as const

function attribution() {
  const params = new URLSearchParams(window.location.search)
  return {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
    landingPage: window.location.href,
    referrer: document.referrer || null,
  }
}

function ctaWithAttribution(href: string, experimentToken?: string | null): string {
  const target = new URL(href, window.location.origin)
  const current = new URLSearchParams(window.location.search)
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = current.get(key)
    if (value && !target.searchParams.has(key)) target.searchParams.set(key, value)
  }
  if (experimentToken && target.origin === window.location.origin) target.searchParams.set('exp', experimentToken)
  return target.origin === window.location.origin
    ? `${target.pathname}${target.search}${target.hash}`
    : target.toString()
}

export function PublicLandingPageClient({
  publicId,
  page,
  experimentToken,
  measurementEligible,
}: {
  publicId: string
  page: PublicLandingPageSnapshot
  experimentToken: string | null
  measurementEligible: boolean
}) {
  const trustedCtaHref = trustedPublishedCtaHref(page, publicId)
  const [ctaHref, setCtaHref] = useState(() => trustedCtaHref)
  const viewRecorded = useRef(false)

  useEffect(() => {
    setCtaHref(ctaWithAttribution(trustedCtaHref, experimentToken))
  }, [experimentToken, trustedCtaHref])

  useEffect(() => {
    if (!measurementEligible || viewRecorded.current) return
    viewRecorded.current = true
    void fetch(`/api/landing-pages/public/${encodeURIComponent(publicId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'PAGE_VIEW', attribution: attribution(), assignmentToken: experimentToken }),
      keepalive: true,
    }).catch(() => undefined)
  }, [experimentToken, measurementEligible, publicId])

  function recordCtaClick() {
    if (!measurementEligible) return
    void fetch(`/api/landing-pages/public/${encodeURIComponent(publicId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'CTA_CLICK', attribution: attribution(), assignmentToken: experimentToken }),
      keepalive: true,
    }).catch(() => undefined)
  }

  const theme = THEME_CLASSES[page.theme.variant] || THEME_CLASSES.MIDNIGHT
  const isEnglish = page.locale === 'EN'
  const eyebrow = isEnglish ? 'Campaign landing page' : 'صفحة حملة تسويقية'
  const proofLabel = isEnglish ? 'Evidence supplied by the business' : 'إثبات مقدم من النشاط التجاري'

  return (
    <main dir={isEnglish ? 'ltr' : 'rtl'} className={`relative min-h-screen overflow-hidden ${theme.page}`}>
      <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-gradient-to-b ${theme.glow}`} />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-400/10 blur-3xl sm:h-[32rem] sm:w-[32rem]" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <span className="font-mono text-xs font-black tracking-[0.26em]">NEXUS</span>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black ${theme.eyebrow}`}><Sparkles className="h-3.5 w-3.5" />{eyebrow}</span>
      </header>

      <section className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pb-28">
        <div>
          <h1 className="max-w-4xl text-4xl font-black leading-[1.12] tracking-[-0.04em] sm:text-6xl lg:text-7xl">{page.headline}</h1>
          {page.subheadline ? <p className={`mt-6 max-w-2xl text-lg font-bold leading-8 sm:text-xl ${theme.muted}`}>{page.subheadline}</p> : null}
          {page.body ? <p className={`mt-5 max-w-2xl whitespace-pre-line text-sm leading-8 sm:text-base ${theme.muted}`}>{page.body}</p> : null}
          <a href={ctaHref} onClick={recordCtaClick} className={`mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl px-7 text-sm font-black shadow-[0_24px_60px_-24px_rgba(76,29,149,0.65)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-indigo-300/40 ${theme.button}`}>
            {page.primaryCta.label}<ArrowUpLeft className={`h-4 w-4 ${isEnglish ? 'rotate-90' : ''}`} />
          </a>
          <p className={`mt-4 text-[11px] font-medium ${theme.footer}`}>{isEnglish ? 'Submitting a form records an inquiry; it does not guarantee contact or a commercial outcome.' : 'إرسال النموذج يسجل طلبًا فقط؛ ولا يضمن تواصلًا أو نتيجة تجارية.'}</p>
        </div>

        <aside className={`rounded-[2rem] border p-6 shadow-[0_34px_90px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:p-8 ${theme.card}`}>
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-60">{isEnglish ? 'What you get' : 'ما الذي ستحصل عليه'}</p>
          <ul className="mt-6 space-y-4">
            {page.benefits.length ? page.benefits.map(benefit => (
              <li key={benefit} className="flex items-start gap-3 text-sm font-bold leading-7"><span className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-500"><Check className="h-3.5 w-3.5" /></span><span>{benefit}</span></li>
            )) : <li className={`text-sm leading-7 ${theme.muted}`}>{isEnglish ? 'Review the campaign offer, then use the action button when you are ready.' : 'راجع عرض الحملة ثم استخدم زر الإجراء عندما تكون مستعدًا.'}</li>}
          </ul>
          {page.proof ? <div className="mt-7 rounded-2xl border border-current/10 bg-current/[0.035] p-4"><p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-50">{proofLabel}</p><p className="mt-2 text-sm font-bold leading-7">{page.proof}</p></div> : null}
        </aside>
      </section>

      <footer className={`relative mx-auto flex w-full max-w-6xl items-center justify-between border-t border-current/10 px-5 py-6 text-[10px] font-bold sm:px-8 ${theme.footer}`}><span>NEXUS · MARKETING OS</span><span>{isEnglish ? 'Published campaign page' : 'صفحة حملة منشورة'}</span></footer>
    </main>
  )
}
