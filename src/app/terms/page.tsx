import Link from 'next/link'

export const metadata = { title: 'شروط الخدمة | NEXUS AI' }

export default function TermsPage() {
  const year = new Date().getFullYear()

  const sections = [
    {
      title: '1. قبول الشروط',
      titleEn: '1. Acceptance of Terms',
      body: `باستخدامك لمنصة NEXUS AI ("الخدمة")، فإنك توافق على الالتزام بشروط الخدمة هذه بالكامل. إذا لم توافق على أي جزء من هذه الشروط، يُرجى عدم استخدام خدماتنا.

By using NEXUS AI ("the Service"), you agree to be fully bound by these Terms of Service. If you do not agree to any part, please do not use our services.`,
    },
    {
      title: '2. وصف الخدمة',
      titleEn: '2. Description of Service',
      body: `NEXUS AI هي منصة تسويق مدعومة بالذكاء الاصطناعي تضم 4 وكلاء متخصصين:
• NEX — منتج الفيديو
• VEX — مدير الإعلانات
• PULSE — المحلل الاستراتيجي
• Sentinel — الحارس الذكي

الخدمة تُقدم بنظام الاشتراك الشهري بمستويات مختلفة (Starter, Pro, Enterprise).

NEXUS AI is an AI-powered marketing platform featuring 4 specialized agents: NEX (Video), VEX (Ads), PULSE (Analytics), and Sentinel (Monitoring). The Service is offered on a monthly subscription basis with different tiers.`,
    },
    {
      title: '3. التسجيل والحساب',
      titleEn: '3. Account Registration',
      body: `يجب إنشاء حساب لاستخدام الخدمة. أنت مسؤول عن:
• الحفاظ على سرية بيانات اعتماد حسابك
• كل الأنشطة التي تحدث تحت حسابك
• تقديم معلومات دقيقة وكاملة أثناء التسجيل
• إبلاغنا فوراً عن أي استخدام غير مصرح به

You must create an account to use the Service. You are responsible for maintaining confidentiality, all activities under your account, providing accurate information, and reporting unauthorized access immediately.`,
    },
    {
      title: '4. الاشتراكات والفوترة',
      titleEn: '4. Subscriptions \u0026 Billing',
      body: `• الاشتراكات المدفوعة تُفوتر مسبقاً شهرياً
• يمكنك إلغاء اشتراكك في أي وقت؛ يسري الإلغاء في نهاية الفترة الحالية
• لا توجد استردادات للأشهر الجزئية (انظر سياسة الاسترداد)
• نحتفظ بالحق في تغيير الأسعار بإشعار 30 يوم مسبق
• جميع المدفوعات تتم عبر Stripe — PCI DSS Level 1 compliant
• العملة: USD (الدولار الأمريكي)

Paid subscriptions are billed monthly in advance. Cancellation takes effect at the end of the current billing period. No refunds for partial months. Prices may change with 30 days notice. Payments via Stripe (PCI DSS Level 1). Currency: USD.`,
    },
    {
      title: '5. الاستخدام المقبول',
      titleEn: '5. Acceptable Use',
      body: `يُحظر استخدام الخدمة لـ:
• توليد محتوى غير قانوني، ضار، أو مخادع
• إنشاء spam أو إعلانات مضللة
• انتهاك حقوق الطرف الثالث
• توليد محتوى يُروّج للعنف، الكراهية، أو التمييز
• محاولات اختراق المنصة أو إساءة استخدام APIs
• إعادة بيع الوصول للمنصة لأطراف ثالثة

We reserve the right to suspend accounts without refund for violations.

Prohibited uses include: illegal/harmful/deceptive content, spam, IP violations, hate speech, platform hacking, and unauthorized reselling.`,
    },
    {
      title: '6. حقوق الملكية الفكرية',
      titleEn: '6. Intellectual Property',
      body: `• أنت تحتفظ بملكية كل المحتوى الذي تُدخله في الخدمة
• المحتوى المُولّد بالذكاء الاصطناعي بناءً على مدخلاتك يكون ملكاً لك للاستخدام التسويقي
• NEXUS AI تحتفظ بجميع حقوق المنصة، التقنية، والأنظمة الأساسية
• لا يجوز استخدام علامتنا التجارية أو شعارنا دون إذن كتابي

You retain ownership of your inputs. AI-generated content based on your inputs is yours for marketing use. NEXUS AI retains platform and technology rights.`,
    },
    {
      title: '7. الضمان والإخلاء من المسؤولية',
      titleEn: '7. Disclaimer of Warranties',
      body: `• الخدمة تُقدم "كما هي" دون أي ضمانات
• لا نضمن دقة أو اكتمال أو ملاءمة المحتوى المُولّد بالذكاء الاصطناعي لاحتياجاتك المحددة
• النتائج التسويقية تختلف — لا نقدم ضمانات بشأن العائد أو النتائج التجارية
• AI يُقدم اقتراحات؛ القرار النهائي دائماً منك

The Service is provided "as is." We do not guarantee AI content accuracy, completeness, or suitability. Marketing results vary. AI provides suggestions; final decisions are always yours.`,
    },
    {
      title: '8. تحديد المسؤولية',
      titleEn: '8. Limitation of Liability',
      body: `• إلى الحد الأقصى المسموح به قانونياً، لا تتحمل NEXUS AI مسؤولية أي أضرار غير مباشرة، عرضية، خاصة، أو تبعية
• إجمالي مسؤوليتنا تجاهك لا يتجاوز المبلغ الذي دفعته خلال الـ 12 شهراً السابقة للمطالبة
• هذا لا ينطبق على: الإهمال الجسيم، الاحتيال، أو الوفاة/الإصابة الشخصية

Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim. Exclusions: gross negligence, fraud, or personal injury/death.`,
    },
    {
      title: '9. إنهاء الخدمة',
      titleEn: '9. Termination',
      body: `• يمكنك إلغاء اشتراكك في أي وقت عبر إعدادات الحساب
• نحتفظ بالحق في تعليق أو إنهاء حسابك فوراً إذا:
  — انتهكت شروط الاستخدام المقبول
  — قمت بأنشطة احتيالية
  — لم تدفع الرسوم المستحقة بعد إشعار
• عند الإنهاء، يُحذف بياناتك خلال 30 يوماً (ما عدا backups archives)

You may cancel anytime via account settings. We may suspend for: ToS violations, fraud, or non-payment. Data deleted within 30 days post-termination (except backup archives).`,
    },
    {
      title: '10. القانون الحاكم',
      titleEn: '10. Governing Law',
      body: `• تخضع هذه الشروط لقوانين الإمارات العربية المتحدة
• أي نزاع يُحال لمحاكم دبي
• بالنسبة للعملاء الأوروبيين: يُطبق GDPR كقانون إضافي (انظر سياسة الخصوصية)

These Terms are governed by UAE law. Disputes referred to Dubai courts. For EU customers, GDPR applies additionally.`,
    },
    {
      title: '11. التعديلات',
      titleEn: '11. Amendments',
      body: `• نحتفظ بالحق في تعديل هذه الشروط في أي وقت
• التعديلات المهمة تُنشر مع إشعار 30 يوم مسبق (بريد إلكتروني + إشعار داخل التطبيق)
• الاستمرار في استخدام الخدمة بعد التعديلات يعني قبولك للشروط الجديدة

Material changes published with 30 days notice (email + in-app). Continued use constitutes acceptance.`,
    },
    {
      title: '12. التواصل',
      titleEn: '12. Contact',
      body: `• البريد الإلكتروني: legal@nexus-grow.com
• العنوان: دبي، الإمارات العربية المتحدة
• وقت الاستجابة: 24-48 ساعة عمل

Email: legal@nexus-grow.com | Dubai, UAE | Response time: 24-48 business hours`,
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#020204' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 px-6 py-4 flex justify-between items-center"
        style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" className="text-2xl font-bold gradient-text">NEXUS AI</Link>
        <Link href="/auth/login" className="text-sm text-text-muted hover:text-text-primary transition">تسجيل الدخول →</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>Terms of Service</span>
          <span className="text-text-muted text-sm">آخر تحديث: {year}</span>
        </div>
        <h1 className="text-4xl font-bold mb-2">شروط الخدمة</h1>
        <p className="text-text-muted mb-10">Terms of Service — NEXUS AI Platform</p>

        <div className="space-y-10">
          {sections.map((sec, i) => (
            <section key={i} className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
              <h2 className="text-lg font-bold text-amber mb-2">{sec.title}</h2>
              <p className="text-xs text-text-muted mb-3 font-medium tracking-wide">{sec.titleEn}</p>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{sec.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 flex gap-6 text-sm text-text-muted" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/" className="hover:text-text-primary transition">← الرئيسية</Link>
          <Link href="/privacy" className="hover:text-text-primary transition">سياسة الخصوصية</Link>
          <Link href="/refund" className="hover:text-text-primary transition">سياسة الاسترداد</Link>
        </div>
      </div>
    </div>
  )
}
