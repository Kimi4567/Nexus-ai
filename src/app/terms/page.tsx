'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'

const SECTIONS = [
  {
    titleAr: '1. قبول الشروط',
    titleEn: '1. Acceptance of Terms',
    bodyAr: 'باستخدامك لمنصة NEXUS AI ("الخدمة")، فإنك توافق على الالتزام بشروط الخدمة هذه بالكامل. إذا لم توافق على أي جزء من هذه الشروط، يُرجى عدم استخدام خدماتنا.',
    bodyEn: 'By using NEXUS AI ("the Service"), you agree to be fully bound by these Terms of Service. If you do not agree to any part, please do not use our services.',
  },
  {
    titleAr: '2. وصف الخدمة',
    titleEn: '2. Description of Service',
    bodyAr: `NEXUS AI هي منصة تسويق مدعومة بالذكاء الاصطناعي تضم 4 وكلاء متخصصين:\n• NEX — منتج الفيديو\n• VEX — مدير الإعلانات\n• PULSE — المحلل الاستراتيجي\n• Sentinel — الحارس الذكي\n\nالخدمة تُقدم بنظام الاشتراك الشهري بمستويات مختلفة (Starter, Pro, Enterprise).`,
    bodyEn: 'NEXUS AI is an AI-powered marketing platform featuring 4 specialized agents: NEX (Video), VEX (Ads), PULSE (Analytics), and Sentinel (Monitoring). The Service is offered on a monthly subscription basis with different tiers (Starter, Pro, Enterprise).',
  },
  {
    titleAr: '3. التسجيل والحساب',
    titleEn: '3. Account Registration',
    bodyAr: `يجب إنشاء حساب لاستخدام الخدمة. أنت مسؤول عن:\n• الحفاظ على سرية بيانات اعتماد حسابك\n• كل الأنشطة التي تحدث تحت حسابك\n• تقديم معلومات دقيقة وكاملة أثناء التسجيل\n• إبلاغنا فوراً عن أي استخدام غير مصرح به`,
    bodyEn: 'You must create an account to use the Service. You are responsible for: maintaining confidentiality of your credentials, all activities under your account, providing accurate information during registration, and reporting any unauthorized use immediately.',
  },
  {
    titleAr: '4. الاشتراكات والفوترة',
    titleEn: '4. Subscriptions & Billing',
    bodyAr: `• الاشتراكات المدفوعة تُفوتر مسبقاً شهرياً\n• يمكنك إلغاء اشتراكك في أي وقت؛ يسري الإلغاء في نهاية الفترة الحالية\n• لا توجد استردادات للأشهر الجزئية (انظر سياسة الاسترداد)\n• نحتفظ بالحق في تغيير الأسعار بإشعار 30 يوم مسبق\n• جميع المدفوعات تتم عبر Stripe — PCI DSS Level 1 compliant\n• العملة: USD (الدولار الأمريكي)`,
    bodyEn: 'Paid subscriptions are billed monthly in advance. Cancellations take effect at the end of the current billing period. No refunds for partial months (see Refund Policy). Prices may change with 30 days notice. Payments via Stripe (PCI DSS Level 1). Currency: USD.',
  },
  {
    titleAr: '5. الاستخدام المقبول',
    titleEn: '5. Acceptable Use',
    bodyAr: `يُحظر استخدام الخدمة لـ:\n• توليد محتوى غير قانوني، ضار، أو مخادع\n• إنشاء spam أو إعلانات مضللة\n• انتهاك حقوق الطرف الثالث\n• توليد محتوى يُروّج للعنف، الكراهية، أو التمييز\n• محاولات اختراق المنصة أو إساءة استخدام APIs\n• إعادة بيع الوصول للمنصة لأطراف ثالثة\n\nنحتفظ بالحق في تعليق الحسابات المنتهِكة دون استرداد.`,
    bodyEn: 'Prohibited uses include: illegal, harmful, or deceptive content; spam or misleading advertising; third-party IP violations; violence, hate, or discrimination; platform hacking or API abuse; unauthorized reselling. We reserve the right to suspend violating accounts without refund.',
  },
  {
    titleAr: '6. حقوق الملكية الفكرية',
    titleEn: '6. Intellectual Property',
    bodyAr: `• أنت تحتفظ بملكية كل المحتوى الذي تُدخله في الخدمة\n• المحتوى المُولّد بالذكاء الاصطناعي بناءً على مدخلاتك يكون ملكاً لك للاستخدام التسويقي\n• NEXUS AI تحتفظ بجميع حقوق المنصة، التقنية، والأنظمة الأساسية\n• لا يجوز استخدام علامتنا التجارية أو شعارنا دون إذن كتابي`,
    bodyEn: 'You retain ownership of all content you input. AI-generated content based on your inputs is yours for marketing use. NEXUS AI retains all rights to the platform, technology, and underlying systems. Our trademarks and logo may not be used without written permission.',
  },
  {
    titleAr: '7. الضمان والإخلاء من المسؤولية',
    titleEn: '7. Disclaimer of Warranties',
    bodyAr: `• الخدمة تُقدم "كما هي" دون أي ضمانات\n• لا نضمن دقة أو اكتمال أو ملاءمة المحتوى المُولّد بالذكاء الاصطناعي لاحتياجاتك المحددة\n• النتائج التسويقية تختلف — لا نقدم ضمانات بشأن العائد أو النتائج التجارية\n• AI يُقدم اقتراحات؛ القرار النهائي دائماً منك`,
    bodyEn: 'The Service is provided "as is" without warranties of any kind. We do not guarantee the accuracy, completeness, or suitability of AI-generated content for your specific needs. Marketing results vary — no guarantees on ROI or business outcomes. AI provides suggestions; final decisions are always yours.',
  },
  {
    titleAr: '8. تحديد المسؤولية',
    titleEn: '8. Limitation of Liability',
    bodyAr: `• إلى الحد الأقصى المسموح به قانونياً، لا تتحمل NEXUS AI مسؤولية أي أضرار غير مباشرة، عرضية، خاصة، أو تبعية\n• إجمالي مسؤوليتنا تجاهك لا يتجاوز المبلغ الذي دفعته خلال الـ 12 شهراً السابقة للمطالبة\n• هذا لا ينطبق على: الإهمال الجسيم، الاحتيال، أو الوفاة/الإصابة الشخصية`,
    bodyEn: 'To the maximum extent permitted by law, NEXUS AI shall not be liable for any indirect, incidental, special, or consequential damages. Our total liability shall not exceed the amount you paid in the 12 months preceding the claim. Exceptions: gross negligence, fraud, or personal injury/death.',
  },
  {
    titleAr: '9. إنهاء الخدمة',
    titleEn: '9. Termination',
    bodyAr: `• يمكنك إلغاء اشتراكك في أي وقت عبر إعدادات الحساب\n• نحتفظ بالحق في تعليق أو إنهاء حسابك فوراً إذا انتهكت الشروط أو قمت بأنشطة احتيالية أو لم تسدد الرسوم المستحقة\n• عند الإنهاء، يُحذف بياناتك خلال 30 يوماً (ما عدا النسخ الاحتياطية)`,
    bodyEn: 'You may cancel your subscription at any time via account settings. We may suspend or terminate your account immediately for ToS violations, fraudulent activity, or non-payment. Upon termination, your data is deleted within 30 days (except backup archives).',
  },
  {
    titleAr: '10. القانون الحاكم',
    titleEn: '10. Governing Law',
    bodyAr: 'تخضع هذه الشروط لقوانين الإمارات العربية المتحدة. أي نزاع يُحال لمحاكم دبي. بالنسبة للعملاء الأوروبيين: يُطبق GDPR كقانون إضافي (انظر سياسة الخصوصية).',
    bodyEn: 'These Terms are governed by the laws of the UAE. Disputes shall be referred to Dubai courts. For EU customers, GDPR applies additionally (see Privacy Policy).',
  },
  {
    titleAr: '11. التعديلات',
    titleEn: '11. Amendments',
    bodyAr: 'نحتفظ بالحق في تعديل هذه الشروط في أي وقت. التعديلات المهمة تُنشر مع إشعار 30 يوم مسبق (بريد إلكتروني + إشعار داخل التطبيق). الاستمرار في استخدام الخدمة يعني قبولك للشروط الجديدة.',
    bodyEn: 'We reserve the right to modify these Terms at any time. Material changes are published with 30 days advance notice (email + in-app). Continued use after changes constitutes acceptance of the new Terms.',
  },
  {
    titleAr: '12. التواصل',
    titleEn: '12. Contact',
    bodyAr: 'البريد الإلكتروني: legal@nexus-grow.com | العنوان: دبي، الإمارات العربية المتحدة | وقت الاستجابة: 24-48 ساعة عمل',
    bodyEn: 'Email: legal@nexus-grow.com | Address: Dubai, UAE | Response time: 24-48 business hours',
  },
]

export default function TermsPage() {
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
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
            Terms of Service
          </span>
          <span className="text-text-muted text-sm">
            {(lgT?.lastUpdated as string)?.replace('{year}', String(year))}
          </span>
        </div>
        <h1 className="text-4xl font-bold mb-2">{lgT?.termsTitle as string}</h1>
        <p className="text-text-muted mb-10">{lgT?.termsSubtitle as string}</p>

        <div className="space-y-10">
          {SECTIONS.map((sec, i) => (
            <section key={i} className="p-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
              <h2 className="text-lg font-bold text-amber mb-4">
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
          <Link href="/refund" className="hover:text-text-primary transition">{lgT?.linkRefund as string}</Link>
        </div>
      </div>
    </div>
  )
}
