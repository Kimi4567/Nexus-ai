'use client'

import Link from 'next/link'
import { ArrowUpRight, BarChart3, Brain, CheckCircle2, FileText, Palette, Send, Sparkles, type LucideIcon } from 'lucide-react'
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
  performance: { ar: 'الأداء', en: 'Performance', href: '/analytics', Icon: BarChart3 },
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

  const resolvedTitle = title || copy('كل صفحة مرتبطة بالاستراتيجية', 'Every surface is tied to strategy')
  const resolvedBody = body || copy(
    'Brand Brain يغذي الاستراتيجية، والاستراتيجية تحدد المحتوى والإبداع والنشر والقياس. لا توجد صفحة تعمل كاختصار للنشر أو الصرف أو التعلم بدون بيانات حقيقية وتأكيد صريح.',
    'Brand Brain feeds strategy, and strategy drives content, creative, publishing, and measurement. No page shortcuts publishing, spend, or learning without real data and explicit confirmation.',
  )
  const resolvedNextLabel = nextLabel || copy('افتح الخطوة الصحيحة', 'Open the right step')

  return (
    <section
      dir={ar ? 'rtl' : 'ltr'}
      className={`nx-os-panel bg-white/92 p-4 ${className}`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#d8ddff] bg-[#f4f5ff] px-3 py-1 text-[11px] font-black text-[#5366f6]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {copy('عقد تشغيل الاستراتيجية', 'Strategy operating contract')}
          </div>
          <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#071236]">{resolvedTitle}</h2>
          <p className="mt-1 max-w-4xl text-[12px] font-semibold leading-6 text-[#64708f]">{resolvedBody}</p>
        </div>

        <Link
          href={nextHref}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[16px] bg-[#071236] px-4 text-[13px] font-black text-white shadow-[0_16px_34px_rgba(31,41,130,0.2)]"
        >
          {resolvedNextLabel}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(stepMeta) as SpineStep[]).map((step) => {
          const meta = stepMeta[step]
          const Icon = meta.Icon
          const active = step === current
          return (
            <Link
              key={step}
              href={meta.href}
              className={`flex items-center gap-2 rounded-[16px] border px-3 py-2 transition ${
                active
                  ? 'border-[#938bff] bg-[#f2f1ff] text-[#4f46e5] shadow-[0_10px_24px_rgba(79,70,229,0.10)]'
                  : 'border-[#e7ecf6] bg-[#fbfcff] text-[#64708f] hover:border-[#cbd4ff] hover:text-[#4f46e5]'
              }`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[12px] ${active ? 'bg-white text-[#4f46e5]' : 'bg-white text-[#8a96ad]'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-black">{ar ? meta.ar : meta.en}</span>
                <span className="mt-0.5 block truncate text-[10px] font-bold opacity-70">
                  {active ? copy('أنت هنا', 'You are here') : copy('يرتبط بالمسار', 'Part of path')}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
