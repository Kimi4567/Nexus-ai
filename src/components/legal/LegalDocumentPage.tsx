import Link from 'next/link'

export type LegalSection = {
  titleAr: string
  titleEn: string
  bodyAr: string
  bodyEn: string
}

type Props = {
  badge: string
  title: string
  subtitle: string
  lastUpdated: string
  sections: LegalSection[]
  isAr: boolean
  isRTL: boolean
}

export default function LegalDocumentPage({
  badge,
  title,
  subtitle,
  lastUpdated,
  sections,
  isAr,
  isRTL,
}: Props) {
  const links = [
    { href: '/terms', ar: 'الشروط', en: 'Terms' },
    { href: '/privacy', ar: 'الخصوصية', en: 'Privacy' },
    { href: '/cookies', ar: 'ملفات الارتباط', en: 'Cookies' },
    { href: '/refund', ar: 'الاسترداد', en: 'Refunds' },
  ]

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-950" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950 text-xs font-bold text-white">N</span>
            <span>Nexus</span>
            <span className="hidden text-xs font-medium text-slate-400 sm:inline">AI Marketing OS</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950">
              {isAr ? 'الرئيسية' : 'Home'}
            </Link>
            <Link href="/auth/login" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              {isAr ? 'دخول' : 'Sign in'}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{badge}</span>
            <span className="text-xs font-medium text-slate-400">{lastUpdated}</span>
          </div>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{subtitle}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-950">
                {isAr ? link.ar : link.en}
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-7 space-y-4">
          {sections.map((section, index) => (
            <section key={`${section.titleEn}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
                {isAr ? section.titleAr : section.titleEn}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 sm:text-[15px]">
                {isAr ? section.bodyAr : section.bodyEn}
              </p>
            </section>
          ))}
        </div>

        <footer className="mt-10 flex flex-col gap-4 border-t border-slate-200 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Nexus AI</p>
          <p>{isAr ? 'للاستفسارات القانونية والخصوصية: legal@nexus-grow.com' : 'Legal and privacy questions: legal@nexus-grow.com'}</p>
        </footer>
      </div>
    </main>
  )
}
