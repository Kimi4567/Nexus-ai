import Link from 'next/link'

export const metadata = { title: 'سياسة الخصوصية | NEXUS AI' }

export default function PrivacyPage() {
  const year = new Date().getFullYear()

  const sections = [
    {
      title: '1. المعلومات التي نجمعها',
      titleEn: '1. Information We Collect',
      body: `المعلومات التي تُقدمها مباشرة:
• الاسم، البريد الإلكتروني، كلمة المرور (مشفرة)
• معلومات الدفع (تُعالج بواسطة Stripe — لا نخزن بيانات البطاقة)
• بيانات الحملات التسويقية والمحتوى المُدخل

المعلومات التي نجمعها تلقائياً:
• سجل الاستخدام (الصفحات المُزارة، الميزات المُستخدمة)
• عنوان IP، نوع المتصفح، نظام التشغيل
• ملفات الكوكيز وتقنيات التتبع المشابهة

Information you provide directly: name, email, encrypted password, payment info (processed by Stripe — we don't store card data), campaign data.

Automatically collected: usage logs, IP address, browser type, OS, cookies and similar tracking technologies.`,
    },
    {
      title: '2. كيف نستخدم معلوماتك',
      titleEn: '2. How We Use Your Information',
      body: `نستخدم معلوماتك فقط للأغراض التالية:
• تقديم وتحسين خدماتنا
• معالجة المدفوعات والاشتراكات
• إرسال إشعارات فنية ورسائل الدعم
• تحليل الأنماط المجمّعة (anonymized) لتحسين الجودة
• منع الاحتيال وسوء الاستخدام
• الامتثال للالتزامات القانونية

We use your information solely to: provide and improve services, process payments, send technical notices, analyze anonymized patterns, prevent fraud, and comply with legal obligations.`,
    },
    {
      title: '3. الذكاء الاصطناعي وملكية المحتوى',
      titleEn: '3. AI \u0026 Content Ownership',
      body: `• المحتوى المُولّد بالذكاء الاصطناعي بناءً على مدخلاتك (أسماء الحملات، الأهداف، الجمهور، النبرة) هو ملك لك
• لا نستخدم مدخلاتك المحددة لتدريب نماذج الذكاء الاصطناعي
• نستخدم أنماط الاستخدام المجمّعة والمجهولة لتحسين جودة الخدمة
• OpenAI API تُعالج المدخلات بموجب سياساتها الخاصة (انظر: openai.com/privacy)

AI-generated content based on your inputs is yours. We don't use your specific inputs to train AI models. OpenAI API processes inputs under their own policies.`,
    },
    {
      title: '4. التخزين والأمان',
      titleEn: '4. Data Storage \u0026 Security',
      body: `• البيانات مُخزنة على Supabase (AWS infrastructure)
• تشفير البيانات أثناء النقل (TLS 1.3) وأثناء التخزين (AES-256)
• نفحص الأمان باستمرار ونُجري اختبارات اختراق دورية
• الموظفون يخضعون لاتفاقيات سرية ويصلون للبيانات بأساس "الحاجة للمعرفة"
• نحتفظ ببياناتك طالما حسابك نشط أو حسب الحاجة لتقديم الخدمة

Data stored on Supabase (AWS). Encryption: TLS 1.3 in transit, AES-256 at rest. Continuous security scans. Staff under NDAs. Data retained while account is active or as needed for service provision.`,
    },
    {
      title: '5. مشاركة المعلومات',
      titleEn: '5. Sharing of Information',
      body: `لا نبيع أو نتاجر أو نؤجر معلوماتك الشخصية لأطراف ثالثة.

مقدمو الخدمات الموثوقين:
• Supabase — تخزين البيانات وقاعدة البيانات
• Stripe — معالجة المدفوعات
• OpenAI — توليد المحتوى بالذكاء الاصطناعي
• Cloudinary — استضافة الصور والفيديوهات
• Vercel — استضافة المنصة

جميع المقدمين يخضعون لالتزامات سرية صارمة.

We do not sell your personal information. Trusted providers: Supabase (data), Stripe (payments), OpenAI (AI), Cloudinary (media), Vercel (hosting). All under strict confidentiality.`,
    },
    {
      title: '6. الكوكيز والتتبع',
      titleEn: '6. Cookies \u0026 Tracking',
      body: `نستخدم الكوكيز للأغراض التالية:
• **أساسية**: الحفاظ على جلستك، تذكر تفضيلاتك
• **تحليلية**: Google Analytics (مجهولة الهوية)
• **وظيفية**: تذكر اختياراتك في الواجهة

يمكنك التحكم في الكوكيز عبر إعدادات المتصفح. تعطيل الكوكيز الأساسية قد يؤثر على الوظائف.

We use cookies for: essential session maintenance, preferences, and anonymous analytics (Google Analytics). Disabling essential cookies may affect functionality.`,
    },
    {
      title: '7. حقوقك',
      titleEn: '7. Your Rights',
      body: `لديك الحق في:
• **الوصول** — طلب نسخة من بياناتك الشخصية
• **التصحيح** — تحديث معلومات غير دقيقة
• **الحذف** — طلب حذف حسابك وبياناتك ("الحق في النسيان")
• **التقييد** — طلب تقييد معالجة بياناتك
• **النقل** — طلب نسخة قابلة للقراءة آلياً من بياناتك
• **الاعتراض** — الاعتراض على معالجة بياناتك لأغراض تسويقية

للممارسة هذه الحقوق: privacy@nexus-grow.com

Rights: access, correction, deletion ("right to be forgotten"), restriction, portability, objection to marketing processing. Contact: privacy@nexus-grow.com`,
    },
    {
      title: '8. GDPR \u0026 CCPA',
      titleEn: '8. GDPR \u0026 CCPA Compliance',
      body: `**GDPR (الأوروبي)**:
• الأساس القانوني: الموافقة (Art. 6) + العقد (Art. 6(1)(b))
• DPO: privacy@nexus-grow.com
• ممثل الاتحاد الأوروبي: دبي، الإمارات (بموجب Art. 27)
• مدة الاحتفاظ: حتى إلغاء الاشتراك + 30 يوماً

**CCPA (كاليفورنيا)**:
• لا نبيع بياناتك الشخصية (100%)
• يمكن لسكان كاليفورنيا طلب حذف أو الكشف عن بياناتهم
• نحن "Service Provider" — لا نستخدم بياناتك خارج تقديم الخدمة

GDPR: Legal basis is consent + contract. DPO at privacy@nexus-grow.com. Retention: until cancellation + 30 days.

CCPA: We do not sell personal information. California residents may request deletion or disclosure.`,
    },
    {
      title: '9. حماية الأطفال',
      titleEn: '9. Children\'s Privacy',
      body: `الخدمة غير موجهة للأفراد دون 16 سنة. لا نجمع قصداً معلومات من أفراد دون 16 سنة. إذا اكتشفنا جمعاً غير مقصود، سنحذف البيانات فوراً.

The Service is not directed at individuals under 16. We do not knowingly collect information from children under 16. If discovered, data will be deleted immediately.`,
    },
    {
      title: '10. تغييرات السياسة',
      titleEn: '10. Policy Changes',
      body: `نحتفظ بالحق في تعديل هذه السياسة. التغييرات المهمة تُنشر مع إشعار 30 يوم مسبق (بريد إلكتروني + إشعار داخل التطبيق). الاستمرار في استخدام الخدمة يعني قبولك للسياسة الجديدة.

Material changes published with 30 days notice (email + in-app). Continued use constitutes acceptance.`,
    },
    {
      title: '11. التواصل',
      titleEn: '11. Contact Us',
      body: `• البريد: privacy@nexus-grow.com
• العنوان: دبي، الإمارات العربية المتحدة
• وقت الاستجابة: 24-48 ساعة عمل
• للشكاوى الأوروبية: يمكن التواصل مع DPO أو السلطة المحلية للحماية

Email: privacy@nexus-grow.com | Dubai, UAE | Response: 24-48 business hours`,
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#020204' }}>
      <nav className="sticky top-0 z-40 px-6 py-4 flex justify-between items-center"
        style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" className="text-2xl font-bold gradient-text">NEXUS AI</Link>
        <Link href="/auth/login" className="text-sm text-text-muted hover:text-text-primary transition">تسجيل الدخول →</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>Privacy Policy</span>
          <span className="text-text-muted text-sm">آخر تحديث: {year}</span>
        </div>
        <h1 className="text-4xl font-bold mb-2">سياسة الخصوصية</h1>
        <p className="text-text-muted mb-10">Privacy Policy — NEXUS AI Platform | GDPR \u0026 CCPA Compliant</p>

        <div className="space-y-10">
          {sections.map((sec, i) => (
            <section key={i} className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
              <h2 className="text-lg font-bold text-cyan mb-2">{sec.title}</h2>
              <p className="text-xs text-text-muted mb-3 font-medium tracking-wide">{sec.titleEn}</p>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{sec.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 flex gap-6 text-sm text-text-muted" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/" className="hover:text-text-primary transition">← الرئيسية</Link>
          <Link href="/terms" className="hover:text-text-primary transition">شروط الخدمة</Link>
          <Link href="/cookies" className="hover:text-text-primary transition">سياسة الكوكيز</Link>
          <Link href="/refund" className="hover:text-text-primary transition">سياسة الاسترداد</Link>
        </div>
      </div>
    </div>
  )
}
