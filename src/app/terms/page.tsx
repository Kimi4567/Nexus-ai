'use client'

import { useI18n } from '@/lib/i18n-context'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

const SECTIONS = [
  {
    titleAr: '0. حالة الإطلاق التجاري',
    titleEn: '0. Commercial Launch Status',
    bodyAr: 'NEXUS في مرحلة ما قبل الإطلاق التجاري، وStripe يعمل حالياً في Sandbox. لا تُعرض اشتراكات أو مدفوعات حقيقية قبل نشر اسم الجهة القانونية وعنوانها والقانون الحاكم وشروط الفوترة النهائية. أي دفع تجريبي لا ينشئ اشتراكاً مدفوعاً حقيقياً.',
    bodyEn: 'NEXUS is in pre-commercial launch and Stripe currently runs in Sandbox. No live subscription or real-money payment is offered until the legal entity name, address, governing law, and final billing terms are published. A test payment does not create a live paid subscription.',
  },
  {
    titleAr: '1. قبول الشروط',
    titleEn: '1. Acceptance of Terms',
    bodyAr: 'باستخدامك لمنصة NEXUS AI ("الخدمة")، فإنك توافق على الالتزام بشروط الخدمة هذه بالكامل. إذا لم توافق على أي جزء من هذه الشروط، يُرجى عدم استخدام خدماتنا.',
    bodyEn: 'By using NEXUS AI ("the Service"), you agree to be fully bound by these Terms of Service. If you do not agree to any part, please do not use our services.',
  },
  {
    titleAr: '2. وصف الخدمة',
    titleEn: '2. Description of Service',
    bodyAr: `NEXUS AI هي منصة تشغيل تسويقي مدعومة بالذكاء الاصطناعي تضم وكلاء متخصصين:\n• NEX — مسودات المحتوى والـstoryboards\n• VEX — تخطيط الإعلانات وحمولات التنفيذ\n• PULSE — تحليلات مبنية على الأدلة المتاحة\n• Sentinel — فحوص المراقبة والتنبيهات\n\nتُعرض باقتا Growth وAutopilot حالياً للتقييم قبل الإطلاق، إضافة إلى أرصدة تجربة ليست اشتراكاً مدفوعاً. لا يبدأ اشتراك أو دفع حقيقي حتى تفعيل الإطلاق التجاري وفق القسم 0. تعتمد خصائص النشر والتحليلات على صلاحيات المنصات المتصلة وتوفر بيانات مؤهلة.`,
    bodyEn: 'NEXUS AI is an AI-powered marketing operating platform with specialized agents: NEX (content drafts and storyboards), VEX (ad planning and execution payloads), PULSE (analytics based on available evidence), and Sentinel (scheduled checks and alerts). Growth and Autopilot are currently displayed for pre-launch evaluation, plus trial credits that are not a paid subscription. No live subscription or real-money payment starts until commercial launch is activated under Section 0. Publishing and analytics features depend on connected-provider permissions and eligible data availability.',
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
    bodyAr: `• هذه الأحكام تصبح سارية على المدفوعات الحقيقية فقط بعد تفعيل الإطلاق التجاري ونشر بيانات الجهة المتعاقدة\n• عند التفعيل، تُفوتر الاشتراكات المدفوعة مسبقاً شهرياً\n• يمكنك إلغاء اشتراكك؛ يسري الإلغاء في نهاية الفترة الحالية ما لم تعرض بوابة Stripe خلاف ذلك\n• تخضع طلبات الاسترداد لسياسة الاسترداد المنشورة\n• السعر المعروض عند الدفع يحكم الفترة التي اشتريتها ولا يتغير بأثر رجعي\n• تُعالج بيانات البطاقة داخل Stripe Checkout ولا نخزنها في NEXUS\n• العملة: USD (الدولار الأمريكي)`,
    bodyEn: 'These billing terms apply to real-money payments only after commercial launch is activated and contracting-entity details are published. When activated, paid subscriptions are billed monthly in advance. Cancellation takes effect at the end of the current period unless the Stripe portal states otherwise. Refund requests follow the published Refund Policy. The price shown at checkout governs the purchased period and is not changed retroactively. Card data is processed inside Stripe Checkout and is not stored by NEXUS. Currency: USD.',
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
    bodyAr: `• يمكنك إلغاء اشتراكك عبر إعدادات الحساب وبوابة Stripe عندما تكون الفوترة مفعلة\n• قد نعلّق أو ننهي الحساب عند انتهاك الشروط أو الاحتيال أو عدم سداد الرسوم المستحقة\n• يمكن تقديم طلب حذف البيانات من مسار حذف البيانات؛ وقد يلزم الاحتفاظ بسجلات محدودة للفوترة والأمان والالتزامات القانونية والنسخ الاحتياطية`,
    bodyEn: 'You may cancel through account settings and the Stripe portal when billing is enabled. We may suspend or terminate an account for Terms violations, fraud, or non-payment. A deletion request may be submitted through the Data Deletion flow; limited billing, security, legal, and backup records may need to be retained.',
  },
  {
    titleAr: '10. القانون الحاكم',
    titleEn: '10. Governing Law',
    bodyAr: 'لن تبدأ NEXUS مدفوعات تجارية حقيقية قبل نشر الجهة المتعاقدة واختصاصها والقانون الحاكم. إلى ذلك الحين تظل الفوترة Sandbox ولا ينبغي تفسير هذه الصفحة على أنها تخفي جهة أو اختصاصاً غير منشور. لا تتأثر الحقوق الإلزامية التي لا يمكن التنازل عنها. للاستفسارات: legal@nexus-grow.com.',
    bodyEn: 'NEXUS will not begin live commercial billing before publishing the contracting entity, its jurisdiction, and the governing law. Until then, billing remains Sandbox and this page should not be read as substituting an undisclosed entity or jurisdiction. Mandatory rights that cannot be waived remain unaffected. Questions: legal@nexus-grow.com.',
  },
  {
    titleAr: '11. التعديلات',
    titleEn: '11. Amendments',
    bodyAr: 'قد نحدّث هذه الشروط عند تغير المنتج أو الفوترة أو المتطلبات المطبقة. سنحدّث تاريخ الشروط ونقدم إشعاراً إضافياً عندما تتطلب طبيعة التغيير أو القوانين المطبقة ذلك. لا تغير التعديلات سعراً دُفع لفترة مكتملة بأثر رجعي.',
    bodyEn: 'We may update these Terms when the product, billing, or applicable requirements change. We will update the Terms date and provide additional notice when the nature of the change or applicable law requires it. Changes do not retroactively alter a price already paid for a completed period.',
  },
  {
    titleAr: '12. النشر على وسائل التواصل والحسابات المتصلة',
    titleEn: '12. Social Publishing & Connected Accounts',
    bodyAr: `• يمكنك ربط حسابات وسائل التواصل أو حسابات الإعلانات (مثل صفحة Facebook أو Meta Ads) عبر OAuth الرسمي لكل منصة.\n• لا ينشر NEXUS بمجرد الربط. النشر الفوري يحتاج إجراءً صريحاً منك، والنشر المجدول عبر API يقتصر على منشور راجعته ووافقت عليه وجدولته واخترت له وضع AUTO.\n• ربط Meta Ads أو إنشاء خطة مدفوعة لا يعني الموافقة على الصرف. يمكن لـ NEXUS إنشاء مسودات منصة متوقفة مؤقتاً فقط بعد تأكيد صريح، ولا يبدأ أي إعلان مدفوع أو إنفاق إلا بعد موافقة تفعيل نهائية منفصلة على الإطلاق والميزانية والصرف.\n• تسجيل نشر يدوي يعني أنك نشرت خارج NEXUS وأن NEXUS يسجل الحالة فقط؛ هذا منفصل عن النشر عبر API أو تفعيل الإعلانات المدفوعة.\n• أنت المسؤول عن المحتوى الذي تنشره أو تفعّله وعن الالتزام بسياسات كل منصة.\n• يمكنك فصل أي حساب في أي وقت، ويُحذف رمز الوصول من NEXUS عند الفصل.\n• قد تتأخر مقاييس الأداء أو لا تتوفر حسب أذونات المنصة؛ التعلم من الأداء يتطلب تحليلات حقيقية ولا يعتمد على الموافقة أو الجدولة أو التسجيل اليدوي فقط.`,
    bodyEn: `• You may connect social or ad accounts (such as a Facebook Page or Meta Ads account) via each platform's official OAuth.\n• NEXUS never publishes merely because an account is connected. Immediate publishing requires an explicit action; scheduled API publishing is limited to a post you reviewed, approved, scheduled, and placed in AUTO mode.\n• Connecting Meta Ads or creating a paid plan is not spend approval. NEXUS may create paused platform drafts only after explicit confirmation, and no paid ad delivery or spend begins until a separate final activation approval confirms launch, budget, and spend.\n• Manual publish means you published outside NEXUS and NEXUS records that status only; this is separate from API publishing or paid ad activation.\n• You are responsible for content you publish or activate and for complying with each platform's policies.\n• You can disconnect any account at any time; its access token is removed from NEXUS on disconnect.\n• Performance metrics may be delayed or unavailable depending on platform permissions; performance learning requires real analytics and is not inferred from approval, scheduling, or manual records alone.`,
  },
  {
    titleAr: '13. التواصل',
    titleEn: '13. Contact',
    bodyAr: 'البريد المتاح للاستفسارات التعاقدية: legal@nexus-grow.com',
    bodyEn: 'Contracting questions: legal@nexus-grow.com',
  },
]

export default function TermsPage() {
  const { t, locale, isRTL } = useI18n()
  const lgT = t('legal')
  const isAr = locale === 'ar'

  return (
    <LegalDocumentPage
      badge="Terms of Service"
      title={lgT?.termsTitle as string}
      subtitle={lgT?.termsSubtitle as string}
      lastUpdated={isAr ? 'آخر تحديث: 16 يوليو 2026' : 'Last updated: July 16, 2026'}
      sections={SECTIONS}
      isAr={isAr}
      isRTL={isRTL}
    />
  )
}
