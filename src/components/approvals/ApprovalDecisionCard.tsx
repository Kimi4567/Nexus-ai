import type { ReactNode } from 'react'

interface ApprovalDecisionCardProps {
  title: string
  reason: string
  badge: string
  badgeTone?: 'violet' | 'amber' | 'green' | 'slate'
  meta?: string
  children?: ReactNode
  actions?: ReactNode
}

const TONES = {
  violet: 'border-violet-100 bg-violet-50 text-violet-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
} as const

export function ApprovalDecisionCard({
  title,
  reason,
  badge,
  badgeTone = 'violet',
  meta,
  children,
  actions,
}: ApprovalDecisionCardProps) {
  return (
    <article className="rounded-[20px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-black leading-5 text-[#111b3f]">{title}</h3>
          {meta && <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a96ad]">{meta}</p>}
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${TONES[badgeTone]}`}>
          {badge}
        </span>
      </div>
      <p className="mt-3 text-[12px] font-semibold leading-5 text-[#64708f]">{reason}</p>
      {children && <div className="mt-3">{children}</div>}
      {actions && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e7ecf6] pt-3">{actions}</div>}
    </article>
  )
}
