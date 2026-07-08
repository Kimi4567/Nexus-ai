'use client'

import Link from 'next/link'
import { Bell, ChevronDown, Plus, Search, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'

interface LuxuryWorkspaceHeaderProps {
  pageTitle?: string
  pageSubtitle?: string
  primaryHref?: string
  primaryLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
}

export default function LuxuryWorkspaceHeader({
  pageTitle,
  pageSubtitle,
  primaryHref = '/strategy',
  primaryLabel,
  secondaryHref = '/brand',
  secondaryLabel,
}: LuxuryWorkspaceHeaderProps) {
  const { user } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const resolvedPrimaryLabel = primaryLabel || (ar ? 'عمل جديد' : 'New work')
  const resolvedSecondaryLabel = secondaryLabel || (ar ? 'ذكاء العلامة' : 'Brand intelligence')

  return (
    <header dir="ltr" className="mb-5 flex flex-col gap-4 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101A4D] text-white shadow-[0_16px_34px_rgba(16,26,77,0.20)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div dir={ar ? 'rtl' : 'ltr'}>
          <p className="text-[12px] font-semibold text-slate-500">{ar ? 'مساحة العمل' : 'Workspace'}</p>
          <h1 className="text-[18px] font-black tracking-normal text-[#0B1028]">
            {pageTitle || (ar ? 'نظام التسويق الذكي' : 'AI Marketing OS')}
          </h1>
          {pageSubtitle ? <p className="mt-0.5 max-w-xl text-[11px] font-semibold text-slate-500">{pageSubtitle}</p> : null}
        </div>
        <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 md:flex">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
        <div className="flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-slate-400 lg:w-[360px]">
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate text-[13px]" dir={ar ? 'rtl' : 'ltr'}>{ar ? 'ابحث في Nexus...' : 'Search in Nexus...'}</span>
          <span className="ms-auto rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] text-slate-400">⌘K</span>
        </div>
        <Link href={primaryHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#101A4D] px-4 text-[13px] font-bold text-white shadow-[0_16px_34px_rgba(16,26,77,0.18)]">
          <Plus className="h-4 w-4" />
          {resolvedPrimaryLabel}
        </Link>
        <Link href={secondaryHref} aria-label={resolvedSecondaryLabel} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#5E63FF]">
          <Sparkles className="h-4 w-4" />
        </Link>
        <Link href="/analytics" aria-label={ar ? 'التنبيهات والتحليلات' : 'Notifications and analytics'} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
          <Bell className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2" dir={ar ? 'rtl' : 'ltr'}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF2FF] text-[13px] font-black text-[#5E63FF]">
            {(displayName || 'N').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[#0B1028]">
              {displayName ? (ar ? `مرحباً ${displayName}` : `Hi, ${displayName}`) : (ar ? 'مرحباً' : 'Welcome')}
            </p>
            <p className="truncate text-[11px] text-slate-500">{ar ? 'مدير النمو' : 'Growth operator'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
