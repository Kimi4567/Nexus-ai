'use client'

import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

interface LuxuryWorkspaceHeaderProps {
  pageTitle?: string
  pageSubtitle?: string
  primaryHref?: string
  primaryLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
}

/**
 * Shared workspace header.
 *
 * The old header mixed page identity, search, notifications, account details,
 * and three competing actions. This version keeps one job: tell the user where
 * they are and what the primary action on this page is.
 */
export default function LuxuryWorkspaceHeader({
  pageTitle,
  pageSubtitle,
  primaryHref = '/strategy',
  primaryLabel,
  secondaryHref = '/brand',
  secondaryLabel,
}: LuxuryWorkspaceHeaderProps) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const resolvedPrimaryLabel = primaryLabel || (ar ? 'عمل جديد' : 'New work')
  const resolvedSecondaryLabel = secondaryLabel || (ar ? 'Brand Brain' : 'Brand Brain')

  return (
    <header
      dir={ar ? 'rtl' : 'ltr'}
      className="nx-os-workspace-header nx-os-rule mb-5 border-b pb-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#5E63FF]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF2FF]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span>{ar ? 'مساحة عمل NEXUS' : 'NEXUS workspace'}</span>
          </div>
          <h1 className="text-[24px] font-black leading-tight tracking-[-0.025em] text-[#0B1028] sm:text-[28px]">
            {pageTitle || (ar ? 'نظام التسويق الذكي' : 'AI Marketing OS')}
          </h1>
          {pageSubtitle ? (
            <p className="mt-1.5 max-w-3xl text-[13px] font-medium leading-6 text-slate-500">
              {pageSubtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-slate-600 transition hover:border-[#C7D2FE] hover:text-[#4F46E5]"
            >
              {resolvedSecondaryLabel}
            </Link>
          ) : null}
          <Link
            href={primaryHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-4 text-[12px] font-black text-white shadow-[0_12px_28px_rgba(16,26,77,0.16)] transition hover:bg-[#18245B]"
          >
            {resolvedPrimaryLabel}
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
          </Link>
        </div>
      </div>
    </header>
  )
}
