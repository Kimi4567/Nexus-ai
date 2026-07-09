'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, Brain, CheckCircle2, ShieldCheck, Sparkles, Workflow } from 'lucide-react'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

type LuxuryAuthShellProps = {
  title: ReactNode
  subtitle: ReactNode
  children: ReactNode
  footer?: ReactNode
  dir?: 'rtl' | 'ltr'
  eyebrow?: ReactNode
}

const capabilities = [
  { icon: Brain, ar: 'ذاكرة علامة منظمة', en: 'Structured Brand Brain' },
  { icon: Workflow, ar: 'مسار حملة واضح', en: 'Clear campaign workflow' },
  { icon: BarChart3, ar: 'تعلم مشروط بالتحليلات', en: 'Analytics-gated learning' },
]

export default function LuxuryAuthShell({
  title,
  subtitle,
  children,
  footer,
  dir = 'rtl',
  eyebrow,
}: LuxuryAuthShellProps) {
  const isRTL = dir === 'rtl'

  return (
    <main
      dir={dir}
      className="min-h-screen overflow-hidden bg-[#f6f8fc] px-4 py-6 text-[#071332] sm:px-6 lg:px-8"
      style={{
        backgroundImage:
          'radial-gradient(circle at 12% 6%, rgba(99,102,241,0.13), transparent 28%), radial-gradient(circle at 88% 12%, rgba(16,185,129,0.10), transparent 24%)',
      }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-[1180px] overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_26px_90px_rgba(15,23,42,0.12)] lg:grid-cols-[1fr_0.88fr]">
        <section className="relative hidden overflow-hidden bg-[#020817] p-9 text-white lg:block">
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background:
                'radial-gradient(circle at 34% 18%, rgba(99,102,241,0.42), transparent 24%), radial-gradient(circle at 78% 72%, rgba(34,211,238,0.16), transparent 28%)',
            }}
          />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 shadow-[0_0_30px_rgba(99,102,241,0.45)] ring-1 ring-white/15">
                  <Sparkles className="h-5 w-5 text-[#a5b4fc]" />
                </span>
                <span>
                  <span className="block text-2xl font-semibold tracking-[0.28em]">NEXUS</span>
                  <span className="block text-[10px] font-medium tracking-[0.34em] text-slate-400">AI MARKETING OS</span>
                </span>
              </Link>

              <div className="mt-16 max-w-[520px]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#a5b4fc]">
                  {isRTL ? 'نظام تشغيل تسويقي' : 'Marketing operating system'}
                </p>
                <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em]">
                  {isRTL
                    ? 'ابدأ من ذاكرة علامة صحيحة، ثم انتقل إلى استراتيجية وتنفيذ قابل للمراجعة.'
                    : 'Start with trusted brand context, then move into strategy and reviewable execution.'}
                </h1>
                <p className="mt-5 text-sm leading-7 text-slate-300">
                  {isRTL
                    ? 'NEXUS لا ينشر، لا ينفق، ولا يعلّم Brand Brain من إشارات غير تحليلية بدون حدود واضحة وموافقة صريحة.'
                    : 'NEXUS does not publish, spend, or learn from non-analytics signals without clear boundaries and explicit confirmation.'}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {capabilities.map(item => {
                const Icon = item.icon
                return (
                  <div key={item.en} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#a5b4fc]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-slate-100">{isRTL ? item.ar : item.en}</span>
                    <CheckCircle2 className={`${isRTL ? 'mr-auto' : 'ml-auto'} h-4 w-4 text-emerald-300`} />
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="flex min-h-[680px] flex-col bg-white p-6 sm:p-9">
          <div className="mb-8 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2.5 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#071332] text-white shadow-lg">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-lg font-semibold tracking-[0.2em]">NEXUS</span>
            </Link>
            <div className="ml-auto">
              <LanguageSwitcher />
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
              <span>{eyebrow ?? (isRTL ? 'دخول آمن إلى مساحة العمل' : 'Secure workspace access')}</span>
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[#071332]">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-5">{footer}</div> : null}
          </div>
        </section>
      </div>
    </main>
  )
}
