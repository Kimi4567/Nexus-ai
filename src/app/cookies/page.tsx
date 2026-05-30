'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'

const SECTIONS = [
  {
    titleAr: 'ما هي ملفات تعريف الارتباط؟',
    titleEn: 'What Are Cookies?',
    bodyAr: 'ملفات تعريف الارتباط هي ملفات نصية صغيرة تُخزن على جهازك عند زيارة موقع إلكتروني. تُستخدم للتعرف على متصفحك وتوفير تجربة أفضل. نستخدم أيضاً تقنيات مشابهة مثل local storage وsession storage.',
    bodyEn: 'Cookies are small text files stored on your device when you visit a website. They are used to recognize your browser and provide a better experience. We also use similar technologies like local storage and session storage.',
  },
  {
    titleAr: 'أنواع ملفات تعريف الارتباط التي نستخدمها',
    titleEn: 'Types of Cookies We Use',
    bodyAr: `1. ملفات تعريف الارتباط الأساسية (Essential)\nضرورية لتشغيل الموقع — تذكر جلستك، تتيح لك تسجيل الدخول، وتحافظ على أمان حسابك. لا يمكن تعطيلها.\n\n2. ملفات تعريف الارتباط الوظيفية (Functional)\nتذكر تفضيلاتك (مثل اللغة، الوضع المظلم) وتحسين تجربتك الشخصية.\n\n3. ملفات تعريف الارتباط التحليلية (Analytics)\nGoogle Analytics (مجهولة الهوية) — تساعدنا في فهم كيفية استخدام الموقع لتحسينه.`,
    bodyEn: `1. Essential Cookies\nRequired for the website to function — they maintain your session, enable login, and keep your account secure. Cannot be disabled.\n\n2. Functional Cookies\nRemember your preferences (language, dark mode) and enhance your personal experience.\n\n3. Analytics Cookies\nGoogle Analytics (anonymized) — help us understand how the site is used so we can improve it.`,
  },
  {
    titleAr: 'مدة ملفات تعريف الارتباط',
    titleEn: 'Cookie Duration',
    bodyAr: `• ملفات تعريف ارتباط الجلسة: تُحذف عند إغلاق المتصفح\n• ملفات تعريف الارتباط التفضيلات: 1 سنة\n• ملفات تعريف الارتباط التحليلات: 13 شهر (Google Analytics)`,
    bodyEn: `• Session cookies: deleted when you close your browser\n• Preference cookies: 1 year\n• Analytics cookies: 13 months (Google Analytics)`,
  },
  {
    titleAr: 'كيفية التحكم في ملفات تعريف الارتباط',
    titleEn: 'How to Control Cookies',
    bodyAr: `يمكنك التحكم في ملفات تعريف الارتباط عبر إعدادات متصفحك:\n• Chrome: Settings → Privacy and security → Cookies\n• Safari: Preferences → Privacy → Manage Website Data\n• Firefox: Options → Privacy & Security → Cookies\n\nتعطيل ملفات تعريف الارتباط الأساسية قد يُعيق استخدام بعض ميزات المنصة.`,
    bodyEn: `You can control cookies via your browser settings:\n• Chrome: Settings → Privacy and security → Cookies\n• Safari: Preferences → Privacy → Manage Website Data\n• Firefox: Options → Privacy & Security → Cookies\n\nDisabling essential cookies may impact some platform features.`,
  },
  {
    titleAr: 'التواصل',
    titleEn: 'Contact',
    bodyAr: 'للأسئلة: privacy@nexus-grow.com | دبي، الإمارات العربية المتحدة',
    bodyEn: 'For questions: privacy@nexus-grow.com | Dubai, UAE',
  },
]

export default function CookiePolicyPage() {
  const { t, locale, isRTL } = useI18n()
  const lgT = t('legal')
  const year = new Date().getFullYear()
  const isAr = locale === 'ar'

  return (
    <div className="min-h-screen" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: '#020204' }}>
      <nav className="sticky top-0 z-40 px-6 py-4 flex justify-between items-center"
        style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" className="text-2xl font-bold gradient-text">NEXUS AI</Link>
        <Link href="/auth/login" className="text-sm text-text-muted hover:text-text-primary transition">
          {lgT?.navLogin as string}
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
            Cookie Policy
          </span>
          <span className="text-text-muted text-sm">
            {(lgT?.lastUpdated as string)?.replace('{year}', String(year))}
          </span>
        </div>
        <h1 className="text-4xl font-bold mb-2">{lgT?.cookiesTitle as string}</h1>
        <p className="text-text-muted mb-10">{lgT?.cookiesSubtitle as string}</p>

        <div className="space-y-8">
          {SECTIONS.map((sec, i) => (
            <section key={i} className="p-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
              <h2 className="text-lg font-bold text-emerald-400 mb-3">
                {isAr ? sec.titleAr : sec.titleEn}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {isAr ? sec.bodyAr : sec.bodyEn}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 flex gap-6 text-sm text-text-muted"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/" className="hover:text-text-primary transition">{lgT?.backHome as string}</Link>
          <Link href="/privacy" className="hover:text-text-primary transition">{lgT?.linkPrivacy as string}</Link>
          <Link href="/terms" className="hover:text-text-primary transition">{lgT?.linkTerms as string}</Link>
        </div>
      </div>
    </div>
  )
}
