'use client'

import { useI18n } from '@/lib/i18n-context'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

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
    bodyAr: `1. التخزين الأساسي (Essential)\nضروري لتشغيل المنتج واستمرار ما طلبته — يحافظ على جلسة تسجيل الدخول وخيارات الأمان واللغة وحالة الواجهة واستمرارية المسودة.\n\n2. تحليلات الاستخدام والأداء الاختيارية (Analytics)\nVercel Web Analytics وSpeed Insights — لا يتم تحميلهما إلا بعد اختيار «أوافق على الكل».`,
    bodyEn: `1. Essential storage\nRequired to operate the product and continue actions you requested — it maintains sign-in state, security choices, language, interface state, and draft continuity.\n\n2. Optional usage and performance analytics\nVercel Web Analytics and Speed Insights — they load only after you choose “Accept all.”`,
  },
  {
    titleAr: 'مدة ملفات تعريف الارتباط',
    titleEn: 'Cookie Duration',
    bodyAr: `• مدة جلسة تسجيل الدخول يحددها مزود المصادقة وإعدادات الأمان.\n• يبقى اختيار الموافقة وتفضيلات التشغيل والمسودات المحلية في متصفحك حتى تحذفها أو تغيرها أو يزيلها مسار المنتج المعني.\n• تخضع بيانات التحليلات الاختيارية لإعدادات الاحتفاظ لدى Vercel.`,
    bodyEn: `• Sign-in session duration is controlled by the authentication provider and security settings.\n• Consent, operating preferences, and local drafts remain in your browser until you remove or change them, or the relevant product flow clears them.\n• Optional analytics data follows Vercel's configured retention settings.`,
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
    bodyAr: 'للأسئلة المتعلقة بالخصوصية: privacy@nexus-grow.com',
    bodyEn: 'For privacy questions: privacy@nexus-grow.com',
  },
]

export default function CookiePolicyPage() {
  const { t, locale, isRTL } = useI18n()
  const lgT = t('legal')
  const year = new Date().getFullYear()
  const isAr = locale === 'ar'

  return (
    <LegalDocumentPage
      badge="Cookie Policy"
      title={lgT?.cookiesTitle as string}
      subtitle={lgT?.cookiesSubtitle as string}
      lastUpdated={(lgT?.lastUpdated as string)?.replace('{year}', String(year))}
      sections={SECTIONS}
      isAr={isAr}
      isRTL={isRTL}
    />
  )
}
