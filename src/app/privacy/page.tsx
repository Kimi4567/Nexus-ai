'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'

const SECTIONS = [
  {
    titleAr: '1. المعلومات التي نجمعها',
    titleEn: '1. Information We Collect',
    bodyAr: `المعلومات التي تُقدمها مباشرة:\n• الاسم، البريد الإلكتروني، كلمة المرور (مشفرة)\n• معلومات الدفع (تُعالج بواسطة Stripe — لا نخزن بيانات البطاقة)\n• بيانات الحملات التسويقية والمحتوى المُدخل\n\nالمعلومات التي نجمعها تلقائياً:\n• سجل الاستخدام (الصفحات المُزارة، الميزات المُستخدمة)\n• عنوان IP، نوع المتصفح، نظام التشغيل\n• ملفات تعريف الارتباط وتقنيات التتبع المشابهة`,
    bodyEn: `Information you provide directly:\n• Name, email, encrypted password\n• Payment info (processed by Stripe — we do not store card data)\n• Campaign data and content you input\n\nAutomatically collected:\n• Usage logs (pages visited, features used)\n• IP address, browser type, operating system\n• Cookies and similar tracking technologies`,
  },
  {
    titleAr: '2. كيف نستخدم معلوماتك',
    titleEn: '2. How We Use Your Information',
    bodyAr: `نستخدم معلوماتك فقط للأغراض التالية:\n• تقديم وتحسين خدماتنا\n• معالجة المدفوعات والاشتراكات\n• إرسال إشعارات فنية ورسائل الدعم\n• تحليل الأنماط المجمّعة (anonymized) لتحسين الجودة\n• منع الاحتيال وسوء الاستخدام\n• الامتثال للالتزامات القانونية`,
    bodyEn: `We use your information solely to:\n• Provide and improve our services\n• Process payments and manage subscriptions\n• Send technical notices and support messages\n• Analyze anonymized usage patterns to improve quality\n• Prevent fraud and abuse\n• Comply with legal obligations`,
  },
  {
    titleAr: '3. الذكاء الاصطناعي وملكية المحتوى',
    titleEn: '3. AI & Content Ownership',
    bodyAr: `• المحتوى المُولّد بالذكاء الاصطناعي بناءً على مدخلاتك هو ملك لك\n• لا نستخدم مدخلاتك المحددة لتدريب نماذج الذكاء الاصطناعي\n• نستخدم أنماط الاستخدام المجمّعة والمجهولة لتحسين جودة الخدمة\n• OpenAI API تُعالج المدخلات بموجب سياساتها الخاصة (انظر: openai.com/privacy)`,
    bodyEn: `• AI-generated content based on your inputs is yours\n• We do not use your specific inputs to train AI models\n• We use aggregated, anonymized usage patterns to improve service quality\n• OpenAI API processes inputs under their own policies (see: openai.com/privacy)`,
  },
  {
    titleAr: '4. التخزين والأمان',
    titleEn: '4. Data Storage & Security',
    bodyAr: `• البيانات مُخزنة على Supabase (AWS infrastructure)\n• تشفير البيانات أثناء النقل (TLS 1.3) وأثناء التخزين (AES-256)\n• نفحص الأمان باستمرار ونُجري اختبارات اختراق دورية\n• الموظفون يخضعون لاتفاقيات سرية ويصلون للبيانات بأساس "الحاجة للمعرفة"\n• نحتفظ ببياناتك طالما حسابك نشط أو حسب الحاجة لتقديم الخدمة`,
    bodyEn: `• Data stored on Supabase (AWS infrastructure)\n• Encryption: TLS 1.3 in transit, AES-256 at rest\n• Continuous security scans and periodic penetration testing\n• Staff under NDAs with need-to-know data access\n• Data retained while your account is active or as needed to provide the service`,
  },
  {
    titleAr: '5. مشاركة المعلومات',
    titleEn: '5. Sharing of Information',
    bodyAr: `لا نبيع أو نتاجر أو نؤجر معلوماتك الشخصية لأطراف ثالثة.\n\nمقدمو الخدمات الموثوقين:\n• Supabase — تخزين البيانات\n• Stripe — معالجة المدفوعات\n• OpenAI — توليد المحتوى بالذكاء الاصطناعي\n• Cloudinary — استضافة الوسائط\n• Vercel — استضافة المنصة\n\nجميع المقدمين يخضعون لالتزامات سرية صارمة.`,
    bodyEn: `We do not sell, trade, or rent your personal information to third parties.\n\nTrusted service providers:\n• Supabase — data storage\n• Stripe — payment processing\n• OpenAI — AI content generation\n• Cloudinary — media hosting\n• Vercel — platform hosting\n\nAll providers are under strict confidentiality obligations.`,
  },
  {
    titleAr: '6. ملفات تعريف الارتباط والتتبع',
    titleEn: '6. Cookies & Tracking',
    bodyAr: `نستخدم ملفات تعريف الارتباط للأغراض التالية:\n• الأساسية: الحفاظ على جلستك وتفضيلاتك\n• التحليلية: Google Analytics (مجهولة الهوية)\n• الوظيفية: تذكر اختياراتك في الواجهة\n\nيمكنك التحكم عبر إعدادات المتصفح. تعطيل الملفات الأساسية قد يؤثر على بعض الوظائف.`,
    bodyEn: `We use cookies for:\n• Essential: maintaining your session and preferences\n• Analytics: Google Analytics (anonymized)\n• Functional: remembering your UI choices\n\nYou can control cookies via your browser settings. Disabling essential cookies may affect some functionality.`,
  },
  {
    titleAr: '7. حقوقك',
    titleEn: '7. Your Rights',
    bodyAr: `لديك الحق في:\n• الوصول — طلب نسخة من بياناتك الشخصية\n• التصحيح — تحديث معلومات غير دقيقة\n• الحذف — طلب حذف حسابك وبياناتك ("الحق في النسيان")\n• التقييد — طلب تقييد معالجة بياناتك\n• النقل — طلب نسخة قابلة للقراءة آلياً من بياناتك\n• الاعتراض — الاعتراض على معالجة بياناتك لأغراض تسويقية\n\nللممارسة هذه الحقوق: privacy@nexus-grow.com`,
    bodyEn: `You have the right to:\n• Access — request a copy of your personal data\n• Correction — update inaccurate information\n• Deletion — request account and data deletion ("right to be forgotten")\n• Restriction — request restriction of data processing\n• Portability — request a machine-readable copy of your data\n• Objection — object to processing for marketing purposes\n\nTo exercise these rights: privacy@nexus-grow.com`,
  },
  {
    titleAr: '8. GDPR & CCPA',
    titleEn: '8. GDPR & CCPA Compliance',
    bodyAr: `GDPR (الأوروبي):\n• الأساس القانوني: الموافقة (Art. 6) + العقد (Art. 6(1)(b))\n• DPO: privacy@nexus-grow.com\n• مدة الاحتفاظ: حتى إلغاء الاشتراك + 30 يوماً\n\nCCPA (كاليفورنيا):\n• لا نبيع بياناتك الشخصية\n• يمكن لسكان كاليفورنيا طلب حذف أو الكشف عن بياناتهم`,
    bodyEn: `GDPR (European):\n• Legal basis: consent (Art. 6) + contract (Art. 6(1)(b))\n• DPO: privacy@nexus-grow.com\n• Retention: until cancellation + 30 days\n\nCCPA (California):\n• We do not sell personal information\n• California residents may request deletion or disclosure of their data`,
  },
  {
    titleAr: '9. حماية الأطفال',
    titleEn: "9. Children's Privacy",
    bodyAr: 'الخدمة غير موجهة للأفراد دون 16 سنة. لا نجمع قصداً معلومات من أفراد دون 16 سنة. إذا اكتشفنا جمعاً غير مقصود، سنحذف البيانات فوراً.',
    bodyEn: 'The Service is not directed at individuals under 16. We do not knowingly collect information from children under 16. If we discover any unintentional collection, we will delete the data immediately.',
  },
  {
    titleAr: '10. تغييرات السياسة',
    titleEn: '10. Policy Changes',
    bodyAr: 'نحتفظ بالحق في تعديل هذه السياسة. التغييرات المهمة تُنشر مع إشعار 30 يوم مسبق. الاستمرار في استخدام الخدمة يعني قبولك للسياسة الجديدة.',
    bodyEn: 'We reserve the right to modify this policy. Material changes are published with 30 days advance notice (email + in-app). Continued use constitutes acceptance of the new policy.',
  },
  {
    titleAr: '11. التواصل',
    titleEn: '11. Contact Us',
    bodyAr: 'البريد: privacy@nexus-grow.com | العنوان: دبي، الإمارات العربية المتحدة | وقت الاستجابة: 24-48 ساعة عمل',
    bodyEn: 'Email: privacy@nexus-grow.com | Address: Dubai, UAE | Response time: 24-48 business hours',
  },
]

export default function PrivacyPage() {
  const { t, locale, isRTL } = useI18n()
  const lgT = t('legal')
  const year = new Date().getFullYear()
  const isAr = locale === 'ar'

  return (
    <div className="min-h-screen" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: '#F5F5F7' }}>
      <nav className="sticky top-0 z-40 px-6 py-4 flex justify-between items-center"
        style={{ background: '#FFFFFF', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
        <Link href="/" className="flex items-center gap-2">
          <img src="/nexus_ai_icon.png" alt="Nexus AI" width={32} height={32} style={{ borderRadius: '8px' }} />
          <span className="text-2xl font-bold gradient-text">NEXUS AI</span>
        </Link>
        <Link href="/auth/login" className="text-sm text-text-muted hover:text-text-primary transition">
          {lgT?.navLogin as string}
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* App identity header — required for TikTok / platform app review */}
        <div className="flex items-center gap-4 mb-10 p-5 rounded-2xl"
          style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)' }}>
          <img src="/nexus_ai_icon.png" alt="Nexus AI App Icon" width={56} height={56} style={{ borderRadius: '14px', flexShrink: 0 }} />
          <div>
            <div className="text-xl font-bold text-slate-900">Nexus AI</div>
            <div className="text-sm text-text-muted mt-0.5">nexus-grow.com</div>
            <div className="text-xs text-text-muted mt-1">AI-Powered Marketing Platform</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
            Privacy Policy
          </span>
          <span className="text-text-muted text-sm">
            {(lgT?.lastUpdated as string)?.replace('{year}', String(year))}
          </span>
        </div>
        <h1 className="text-4xl font-bold mb-2">{lgT?.privacyTitle as string}</h1>
        <p className="text-text-muted mb-4">{lgT?.privacySubtitle as string}</p>

        <p className="text-sm text-text-secondary leading-relaxed mb-10 p-4 rounded-xl"
          style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
          This Privacy Policy applies to the <strong className="text-slate-900">Nexus AI</strong> application (the &quot;Application&quot;), operated by Nexus AI at <a href="https://nexus-grow.com" className="text-cyan underline">nexus-grow.com</a>. By using Nexus AI, you agree to the collection and use of information as described below.
        </p>

        <div className="space-y-10">
          {SECTIONS.map((sec, i) => (
            <section key={i} className="p-6"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '16px' }}>
              <h2 className="text-lg font-bold text-cyan mb-4">
                {isAr ? sec.titleAr : sec.titleEn}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {isAr ? sec.bodyAr : sec.bodyEn}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 flex gap-6 text-sm text-text-muted"
          style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <Link href="/" className="hover:text-text-primary transition">{lgT?.backHome as string}</Link>
          <Link href="/terms" className="hover:text-text-primary transition">{lgT?.linkTerms as string}</Link>
          <Link href="/cookies" className="hover:text-text-primary transition">{lgT?.linkCookies as string}</Link>
          <Link href="/refund" className="hover:text-text-primary transition">{lgT?.linkRefund as string}</Link>
        </div>
      </div>
    </div>
  )
}
