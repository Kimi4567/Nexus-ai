'use client'

import Link from 'next/link'
import { ArrowUpRight, BarChart3, Brain, FileText, Palette, Send, Sparkles, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

type SpineStep = 'brand' | 'strategy' | 'content' | 'creative' | 'publish' | 'performance'

interface StrategySpineCardProps {
  current?: SpineStep
  title?: string
  body?: string
  nextHref?: string
  nextLabel?: string
  className?: string
}

const stepMeta: Record<SpineStep, { ar: string; en: string; href: string; Icon: LucideIcon }> = {
  brand: { ar: 'Brand Brain', en: 'Brand Brain', href: '/brand', Icon: Brain },
  strategy: { ar: 'الاستراتيجية', en: 'Strategy', href: '/strategy', Icon: Sparkles },
  content: { ar: 'المحتوى', en: 'Content', href: '/content-hub', Icon: FileText },
  creative: { ar: 'الإبداع', en: 'Creative', href: '/studio', Icon: Palette },
  publish: { ar: 'النشر', en: 'Publish', href: '/publish', Icon: Send },
  performance: { ar: 'النتائج', en: 'Results', href: '/analytics', Icon: BarChart3 },
}

export default function StrategySpineCard({
  current,
  title,
  body,
  nextHref = '/strategy',
  nextLabel,
  className = '',
}: StrategySpineCardProps) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)
  const resolvedTitle = title || copy('مسار العمل التسويقي', 'Marketing workflow')
  const resolvedBody = body || copy(
    'ابدأ بسياق العلامة، ثم الاستراتيجية، ثم الإنتاج والنشر والقياس.',
    'Move from brand context to strategy, production, publishing, and measurement.',
  )
  const resolvedNextLabel = nextLabel || copy('افتح الخطوة التالية', 'Open next step')

  return (
    <section dir={ar ? 'rtl' : 'ltr'} className={`nx-os-card p-3.5 ${className}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5E63FF]">
            {copy('مسار NEXUS', 'NEXUS path')}
          </p>
          <h2 className="mt-1 text-[15px] font-black text-[#071236]">{resolvedTitle}</h2>
          <p className="mt-0.5 line-clamp-1 max-w-4xl text-[11px] font-medium leading-5 text-slate-500">
            {resolvedBody}
          </p>
        </div>

        <Link
          href={nextHref}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D8DDFF] bg-[#F5F6FF] px-3.5 text-[11px] font-black text-[#4F46E5] transition hover:border-[#AEB8FF]"
        >
          {resolvedNextLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <nav aria-label={copy('مراحل مسار التسويق', 'Marketing workflow stages')} className="mt-3 grid grid-cols-3 gap-1.5 lg:grid-cols-6">
        {(Object.keys(stepMeta) as SpineStep[]).map((step, index) => {
          const meta = stepMeta[step]
          const Icon = meta.Icon
          const active = step === current
          return (
            <Link
              key={step}
              href={meta.href}
              aria-current={active ? 'step' : undefined}
              className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
                active
                  ? 'border-[#938BFF] bg-[#F2F1FF] text-[#4F46E5]'
                  : 'border-slate-200 bg-slate-50/70 text-slate-500 hover:border-[#CBD4FF] hover:bg-white hover:text-[#4F46E5]'
              }`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? 'bg-white' : 'bg-white text-slate-400'}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-black text-slate-400" dir="ltr">0{index + 1}</span>
                <span className="block truncate text-[10px] font-black">{ar ? meta.ar : meta.en}</span>
              </span>
            </Link>
          )
        })}
      </nav>
    </section>
  )
}
