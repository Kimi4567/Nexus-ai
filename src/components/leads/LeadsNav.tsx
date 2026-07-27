'use client'

import { BellRing, ClipboardList, FileUp, FormInput, MailCheck } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'

const ITEMS = [
  { href: '/leads', icon: ClipboardList, ar: 'المسار', en: 'Pipeline', exact: true },
  { href: '/leads/import', icon: FileUp, ar: 'استيراد CSV', en: 'CSV import' },
  { href: '/leads/forms', icon: FormInput, ar: 'نماذج الاستقبال', en: 'Capture forms' },
  { href: '/leads/alerts', icon: BellRing, ar: 'تنبيهات SLA', en: 'SLA alerts' },
  { href: '/leads/lifecycle', icon: MailCheck, ar: 'Lifecycle', en: 'Lifecycle' },
] as const

export function LeadsNav() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const ar = locale === 'ar'

  return (
    <nav
      aria-label={ar ? 'أقسام CRM' : 'CRM sections'}
      className="mb-5 flex flex-wrap gap-2 pb-1 sm:flex-nowrap sm:overflow-x-auto"
    >
      {ITEMS.map(item => {
        const active = 'exact' in item && item.exact ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-xs font-black transition ${active ? 'border-[#101A4D] bg-[#101A4D] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'}`}>
            <Icon className="h-4 w-4" />
            {ar ? item.ar : item.en}
          </Link>
        )
      })}
    </nav>
  )
}
