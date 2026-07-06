'use client'

/**
 * PR-J — BrandIndicatorsPanel
 *
 * Renders the four separated, honest Brand Brain indicators from a single source
 * (getBrandIndicators). Used on BOTH the Brand Brain page and the campaign
 * Strategy panel so the same concept can never show two different numbers again.
 *
 *   1. Brand completeness   (core durable fields)
 *   2. Organic readiness    (minimum organic strategy set)
 *   3. Paid readiness       (approval-gated until prerequisites + tracking exist)
 *   4. Memory richness       (saved signals/memory — NOT readiness)
 *
 * Pure presentational. `theme` adapts colors for the dark campaign card vs the
 * light Brand Brain page. No data fetching, no side effects.
 */

import { ChevronDown } from 'lucide-react'
import type { BrandIndicators } from '@/lib/brandIndicators'

type Theme = 'dark' | 'light'

interface Props {
  indicators: BrandIndicators
  locale?: string
  theme?: Theme
  /** optional "complete your profile" link target */
  completeHref?: string
}

const GREEN = '#10b981'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const VIOLET = '#8b5cf6'

function barColor(score: number): string {
  if (score >= 80) return GREEN
  if (score >= 40) return AMBER
  return RED
}

export default function BrandIndicatorsPanel({ indicators, locale = 'en', theme = 'light', completeHref = '/brand' }: Props) {
  const ar = locale === 'ar'
  const dark = theme === 'dark'

  const textSub = dark ? 'rgba(255,255,255,0.55)' : 'var(--nx-text-3, #64748b)'
  const textMain = dark ? 'rgba(255,255,255,0.9)' : 'var(--nx-text-1, #0f172a)'
  const cardBg = dark ? 'rgba(255,255,255,0.03)' : 'var(--nx-surface-2, #f8fafc)'
  const cardBorder = dark ? 'rgba(255,255,255,0.08)' : 'var(--nx-border, #e2e8f0)'
  const trackBg = dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'

  const { brandCompleteness: c, organicReadiness: o, paidReadiness: paid, memoryRichness: m } = indicators

  const Cell = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
      {children}
    </div>
  )

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: textSub }}>{children}</p>
  )

  const Bar = ({ score }: { score: number }) => (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: trackBg }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: barColor(score) }} />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: textSub }}>
          {ar ? 'حالة ذاكرة العلامة' : 'Brand Brain status'}
        </span>
        {c.score < 100 && completeHref && completeHref !== '#' && (
          <a href={completeHref} className="text-[10px] font-semibold hover:opacity-80"
            style={{ color: VIOLET }}>
            {ar ? 'أكمل الملف ←' : 'Complete profile →'}
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* 1. Brand completeness */}
        <Cell>
          <div className="flex items-center justify-between">
            <Label>{ar ? 'اكتمال العلامة' : 'Brand completeness'}</Label>
            <span className="text-[11px] font-black tabular-nums" style={{ color: barColor(c.score) }}>{c.score}%</span>
          </div>
          <Bar score={c.score} />
          <p className="text-[9px] mt-1" style={{ color: textSub }}>
            {ar ? 'الحقول الأساسية المؤكدة' : 'Core confirmed fields'}
          </p>
        </Cell>

        {/* 2. Organic readiness */}
        <Cell>
          <div className="flex items-center justify-between">
            <Label>{ar ? 'جاهزية المحتوى العضوي' : 'Organic readiness'}</Label>
            <span className="text-[10px] font-bold" style={{ color: o.ready ? GREEN : AMBER }}>
              {o.ready ? (ar ? 'جاهز' : 'Ready') : (ar ? `${o.missingKeys.length} ناقص` : `${o.missingKeys.length} to add`)}
            </span>
          </div>
          <Bar score={o.score} />
          <p className="text-[9px] mt-1" style={{ color: textSub }}>
            {o.ready ? (ar ? 'الحد الأدنى للاستراتيجية مكتمل' : 'Minimum organic set complete') : (ar ? 'أكمل الحد الأدنى للتخطيط العضوي' : 'Complete the minimum organic set')}
          </p>
        </Cell>

        {/* 3. Paid readiness — honest approval-gated setup */}
        <Cell>
          <div className="flex items-center justify-between">
            <Label>{ar ? 'جاهزية المدفوع' : 'Paid readiness'}</Label>
            <span className="text-[10px] font-bold" style={{ color: paid.ready ? AMBER : textSub }}>
              {paid.ready ? (ar ? 'المتطلبات مكتملة' : 'Prereqs met') : (ar ? 'يحتاج متطلبات' : 'Needs prerequisites')}
            </span>
          </div>
          <Bar score={paid.score} />
          <p className="text-[9px] mt-1" style={{ color: paid.ready ? textSub : AMBER }}>
            {paid.ready
              ? (ar ? 'جاهز للمراجعة — لا إطلاق أو إنفاق بدون موافقة' : 'Ready for review — no launch or spend without approval')
              : (ar ? 'يحتاج إعداد التنفيذ قبل أي إطلاق' : 'Needs execution setup before launch')}
          </p>
        </Cell>

        {/* 4. Memory richness — explicitly NOT readiness */}
        <Cell>
          <div className="flex items-center justify-between">
            <Label>{ar ? 'ثراء الذاكرة' : 'Memory richness'}</Label>
            <span className="text-[10px] font-bold" style={{ color: m.score > 0 ? VIOLET : textSub }}>
              {m.score <= 0 ? (ar ? 'لا شيء بعد' : 'None yet')
                : m.level === 'high' ? (ar ? 'غنية' : 'Rich')
                : m.level === 'medium' ? (ar ? 'تتكوّن' : 'Building')
                : (ar ? 'مبكرة' : 'Early')}
            </span>
          </div>
          <Bar score={m.score} />
          <p className="text-[9px] mt-1" style={{ color: textSub }}>
            {ar ? 'إشارات محفوظة — ليست مؤشر جاهزية' : 'Saved signals — not a readiness signal'}
          </p>
        </Cell>
      </div>

      {/* PR-N1 — per-indicator explainers: what affects this, what does not, and why
          AI can't inflate it. Collapsed by default to stay calm; works light + dark. */}
      <details className="mt-3 group">
        <summary className="cursor-pointer select-none list-none inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: textSub }}>
          <span>{ar ? 'ما الذي يؤثر على هذه المؤشرات؟' : 'What affects these?'}</span>
          <ChevronDown size={11} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 space-y-2 text-[11px] leading-relaxed" style={{ color: textSub }}>
          {([
            ar
              ? ['اكتمال العلامة', 'يتأثر بحقول علامتك الأساسية المحفوظة فقط. لا تؤثر فيه اقتراحات الذكاء الاصطناعي أو الماسح أو المحلّل إلا إذا حفظتها بنفسك.']
              : ['Brand completeness', 'affected by your saved core Brand Brain fields only. AI suggestions, Scanner, or Analyzer don’t change it unless you save them.'],
            ar
              ? ['جاهزية المحتوى العضوي', 'تتأثر بالحد الأدنى لحقول الاستراتيجية العضوية. لا تعني أن الإعلانات المدفوعة جاهزة، ولا تَعِد بأي أداء.']
              : ['Organic readiness', 'affected by the minimum organic field set. It does not mean paid ads can execute, and promises no performance.'],
            ar
              ? ['جاهزية المدفوع', 'تحتاج ميزانية ووجهة تحويل وموقعاً/هدفاً وتتبعاً عند الحاجة. لا تُشغَّل إعلانات ولا تُصرف ميزانية دون موافقتك.']
              : ['Paid readiness', 'needs budget, conversion destination, location/objective, and tracking where relevant. No ads run and no budget is spent without your approval.'],
            ar
              ? ['ثراء الذاكرة', 'ينمو من الموافقات والتعديلات والحملات والنشر والنتائج الحقيقية. ليس مؤشر جاهزية، ولا يعني أن إعدادك ناقص.']
              : ['Memory richness', 'grows from real approvals, edits, campaigns, publishing, and results. It’s not a readiness signal and doesn’t mean your setup is incomplete.'],
          ] as [string, string][]).map(([label, body], i) => (
            <p key={i}>
              <span className="font-semibold" style={{ color: textMain }}>{label}: </span>{body}
            </p>
          ))}
        </div>
      </details>
    </div>
  )
}
