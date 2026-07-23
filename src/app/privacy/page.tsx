'use client'

import { useI18n } from '@/lib/i18n-context'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

const SECTIONS = [
  {
    titleAr: '1. المعلومات التي نجمعها',
    titleEn: '1. Information We Collect',
    bodyAr: `المعلومات التي تُقدمها مباشرة:\n• الاسم والبريد الإلكتروني؛ تتولى Supabase Auth معالجة كلمة المرور وتخزينها كقيمة مشتقة آمنة\n• معلومات الدفع (تُعالج بواسطة Stripe — لا نخزن بيانات البطاقة)\n• بيانات الحملات التسويقية والمحتوى المُدخل\n\nالمعلومات التشغيلية:\n• سجلات فنية لازمة لتشغيل الخدمة وأمانها\n• عنوان IP ونوع المتصفح كما تعالجها خدمات الاستضافة والأمان\n• تحليلات استخدام وأداء اختيارية بعد الموافقة`,
    bodyEn: `Information you provide directly:\n• Name and email; Supabase Auth handles the password and stores a secure derived value\n• Payment information (processed by Stripe — we do not store card data)\n• Campaign data and content you enter\n\nOperational information:\n• Technical logs needed to operate and secure the service\n• IP address and browser type as processed by hosting and security services\n• Optional usage and performance analytics after consent`,
  },
  {
    titleAr: '2. كيف نستخدم معلوماتك',
    titleEn: '2. How We Use Your Information',
    bodyAr: `نستخدم معلوماتك فقط للأغراض التالية:\n• تقديم وتحسين خدماتنا\n• معالجة المدفوعات والاشتراكات\n• إرسال إشعارات فنية ورسائل الدعم\n• مراجعة بيانات الاستخدام والأداء الاختيارية عندما توافق عليها\n• منع الاحتيال وسوء الاستخدام\n• الامتثال للالتزامات القانونية`,
    bodyEn: `We use your information solely to:\n• Provide and improve our services\n• Process payments and manage subscriptions\n• Send technical notices and support messages\n• Review optional usage and performance telemetry when you consent\n• Prevent fraud and abuse\n• Comply with legal obligations`,
  },
  {
    titleAr: '3. الذكاء الاصطناعي وملكية المحتوى',
    titleEn: '3. AI & Content Ownership',
    bodyAr: `• المحتوى المُولّد بالذكاء الاصطناعي بناءً على مدخلاتك مخصص لاستخدامك وفق الشروط المطبقة\n• لا نستخدم مدخلاتك المحددة لتدريب نموذج AI خاص بـNEXUS\n• OpenAI API تُعالج المدخلات بموجب شروطها وسياساتها وإعدادات الخدمة المطبقة (انظر: openai.com/privacy)`,
    bodyEn: `• AI-generated content based on your inputs is provided for your use under the applicable terms\n• We do not use your specific inputs to train a NEXUS-owned AI model\n• OpenAI API processes inputs under its terms, policies, and the service settings in use (see: openai.com/privacy)`,
  },
  {
    titleAr: '4. التخزين والأمان',
    titleEn: '4. Data Storage & Security',
    bodyAr: `• تُخزَّن بيانات التطبيق الأساسية على Supabase، وتُخزَّن ملفات الوسائط على Cloudinary، وتعمل واجهة الخدمة على Vercel.\n• تستخدم اتصالات الخدمة HTTPS/TLS، ويطبق مقدمو البنية التحتية تشفير التخزين وفق إعداداتهم؛ كما تُشفَّر رموز OAuth الحساسة داخل التطبيق باستخدام AES-256-GCM.\n• نستخدم ضوابط وصول وسجلات تشغيل لعزل بيانات مساحات العمل ومراجعة الأعطال.\n• نحتفظ بالبيانات طالما الحساب نشط أو بالقدر اللازم لتقديم الخدمة والوفاء بالمتطلبات القانونية.`,
    bodyEn: `• Core application data is stored on Supabase, media files are stored on Cloudinary, and the service interface runs on Vercel.\n• Service connections use HTTPS/TLS and infrastructure providers apply storage encryption under their configurations; sensitive OAuth tokens are additionally encrypted by the application with AES-256-GCM.\n• We use access controls and operational logs to isolate workspace data and investigate failures.\n• Data is retained while an account is active or as needed to provide the service and meet legal obligations.`,
  },
  {
    titleAr: '5. مشاركة المعلومات',
    titleEn: '5. Sharing of Information',
    bodyAr: `لا نبيع أو نتاجر أو نؤجر معلوماتك الشخصية لأطراف ثالثة.\n\nمقدمو الخدمات المستخدمون:\n• Supabase — المصادقة وتخزين البيانات\n• Stripe — معالجة المدفوعات\n• OpenAI — توليد المحتوى والصور بالذكاء الاصطناعي\n• fal.ai — توليد صور عندما يكون هذا المزود مفعلاً\n• Cloudinary — استضافة الوسائط\n• Resend — إرسال رسائل البريد التشغيلي\n• Vercel — الاستضافة وتحليلات الاستخدام والأداء الاختيارية\n• Sentry — مراقبة أخطاء التطبيق وتشخيص الأعطال عند تفعيل المراقبة\n• Google Fonts — توصيل خطوط واجهة الموقع\n• Meta وLinkedIn وTikTok وPinterest وGoogle/YouTube وX/Threads — فقط عند ربط حساب مدعوم أو طلب إجراء مؤهل على تلك المنصة\n\nتخضع معالجة كل مزود لشروطه وإعدادات الخدمة المطبقة.`,
    bodyEn: `We do not sell, trade, or rent your personal information to third parties.\n\nService providers in use:\n• Supabase — authentication and data storage\n• Stripe — payment processing\n• OpenAI — AI text and image generation\n• fal.ai — image generation when that provider is enabled\n• Cloudinary — media hosting\n• Resend — operational email delivery\n• Vercel — hosting and optional usage/performance analytics\n• Sentry — application error monitoring and incident diagnostics when monitoring is enabled\n• Google Fonts — delivery of site interface fonts\n• Meta, LinkedIn, TikTok, Pinterest, Google/YouTube, and X/Threads — only when you connect a supported account or request an eligible platform action\n\nEach provider's processing is governed by its terms and the service settings in use.`,
  },
  {
    titleAr: '6. ملفات تعريف الارتباط والتتبع',
    titleEn: '6. Cookies & Tracking',
    bodyAr: `نستخدم التخزين الأساسي للحفاظ على جلسة الدخول ووظائف الأمان وتفضيلات التشغيل واستمرارية المسودات التي طلبتها. ويمكنك اختيار تشغيل Vercel Web Analytics وSpeed Insights من شريط الموافقة. اختيار «أساسية فقط» يمنع تحميل مكونات التحليلات الاختيارية.`,
    bodyEn: `We use essential storage for sign-in state, security functions, operating preferences, and continuity of drafts you requested. You can opt into Vercel Web Analytics/Speed Insights from the consent banner. Choosing “Essential only” prevents optional analytics components from loading.`,
  },
  {
    titleAr: '7. حقوقك',
    titleEn: '7. Your Rights',
    bodyAr: `بحسب القانون المطبق عليك، قد يكون لك حق في:\n• الوصول — طلب نسخة من بياناتك الشخصية\n• التصحيح — تحديث معلومات غير دقيقة\n• الحذف — طلب حذف الحساب والبيانات الخاضعة للحذف\n• التقييد — طلب تقييد المعالجة\n• النقل — طلب نسخة قابلة للقراءة آلياً عندما ينطبق ذلك\n• الاعتراض — الاعتراض على معالجة محددة، ومنها التسويق المباشر\n\nقد نحتفظ بسجلات محدودة للفوترة والأمان ومنع الاحتيال والالتزامات القانونية والنسخ الاحتياطية وفق مدد الاحتفاظ المطبقة. سنوضح نطاق الحذف والاستثناءات عند التحقق من الطلب. لتقديم طلب: privacy@nexus-grow.com`,
    bodyEn: `Depending on the law applicable to you, you may have rights to:\n• Access — request a copy of your personal data\n• Correction — update inaccurate information\n• Deletion — request deletion of the account and data eligible for deletion\n• Restriction — request restriction of processing\n• Portability — request a machine-readable copy where applicable\n• Objection — object to specific processing, including direct marketing\n\nWe may retain limited billing, security, fraud-prevention, legal, and backup records under applicable retention periods. We will explain the deletion scope and any exceptions when verifying a request. To submit a request: privacy@nexus-grow.com`,
  },
  {
    titleAr: '8. حقوق الخصوصية حسب القانون المطبق',
    titleEn: '8. Privacy Rights Under Applicable Law',
    bodyAr: `تختلف الحقوق والمواعيد والإعفاءات حسب موقعك والقانون الذي ينطبق عليك وعلى مشغّل الخدمة. يمكنك تقديم طلب وصول أو تصحيح أو حذف أو تقييد أو نقل أو اعتراض عبر privacy@nexus-grow.com، وسنتحقق من الهوية ونستجيب وفق المتطلبات المطبقة. لا نبيع المعلومات الشخصية. لا تُعد هذه الفقرة ادعاءً باعتماد أو امتثال شامل لكل نظام قانوني.`,
    bodyEn: `Rights, response periods, and exceptions vary by your location and the law applicable to you and the Service operator. You may submit an access, correction, deletion, restriction, portability, or objection request to privacy@nexus-grow.com; we will verify identity and respond under applicable requirements. We do not sell personal information. This section is not a claim of blanket certification or compliance under every privacy regime.`,
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
    bodyAr: 'قد نحدّث هذه السياسة عند تغير المنتج أو مقدمي الخدمة أو المتطلبات القانونية. سنحدّث تاريخ السياسة ونقدم إشعاراً إضافياً عندما تتطلب طبيعة التغيير أو القوانين المطبقة ذلك.',
    bodyEn: 'We may update this policy when the product, providers, or applicable requirements change. We will update the policy date and provide additional notice when the nature of the change or applicable law requires it.',
  },
  {
    titleAr: '11. الحسابات الاجتماعية وحسابات الإعلانات المتصلة (Meta / Facebook)',
    titleEn: '11. Connected Social and Ad Accounts (Meta / Facebook)',
    bodyAr: `عند ربط صفحة Facebook، تستخدم NEXUS أذونات Meta من أجل:\n• عرض قائمة الصفحات التي تديرها (pages_show_list)\n• قراءة التفاعل على منشوراتك الخاصة (pages_read_engagement)\n• نشر المنشورات التي تنشئها (pages_manage_posts)\n\nعند ربط حساب Meta Ads، قد تستخدم NEXUS أذونات Marketing API من أجل:\n• قراءة حسابات الإعلانات والسياق التجاري الذي يمكنك الوصول إليه (ads_read, business_management)\n• إنشاء مسودات حملات أو مجموعات إعلانية أو إعلانات في حالة متوقفة مؤقتاً فقط بعد تأكيد صريح (ads_management)\n• قراءة مقاييس أداء الإعلانات بعد توفر بيانات حقيقية من المنصة (ads_read)\n\n• لا ينشر NEXUS بمجرد الربط. النشر الفوري يحتاج ضغطك الصريح على "نشر"، والنشر المجدول عبر API يقتصر على منشور راجعته ووافقت عليه وجدولته واخترت له وضع AUTO.\n• لا تُشغّل NEXUS إعلانات مدفوعة ولا تبدأ صرف ميزانية بمجرد الربط أو التخطيط. الإنشاء على المنصة يكون كمسودة متوقفة مؤقتاً، والتفعيل يتطلب موافقة نهائية منفصلة على الإطلاق والميزانية والصرف.\n• تُشفَّر رموز الوصول باستخدام AES-256-GCM داخل التطبيق وتُحذف من NEXUS عند فصل الحساب من صفحة "الاتصالات".\n• لا نرى ولا نخزّن كلمة مرور Facebook الخاصة بك — يتم الربط عبر OAuth الرسمي من Meta.\n• لحذف البيانات المرتبطة بربط Meta: افصل الحساب من "الاتصالات" أو استخدم عملية حذف البيانات (/data-deletion).\n• مسار Instagram موجود تقنياً، لكنه لا يُعرض كجاهز حتى ينجح التحقق من حساب الأعمال وصلاحية النشر المطلوبة.`,
    bodyEn: `When you connect a Facebook Page, NEXUS uses Meta permissions to:\n• List the Pages you manage (pages_show_list)\n• Read engagement on your own posts (pages_read_engagement)\n• Publish posts you create (pages_manage_posts)\n\nWhen you connect a Meta Ads account, NEXUS may use Marketing API permissions to:\n• Read ad accounts and business context you can access (ads_read, business_management)\n• Create campaign, ad set, ad creative, or ad draft objects in a paused state only after explicit confirmation (ads_management)\n• Read paid campaign performance after real platform data exists (ads_read)\n\n• NEXUS never publishes merely because an account is connected. Immediate publishing requires your explicit Publish action; scheduled API publishing is limited to a post you reviewed, approved, scheduled, and placed in AUTO mode.\n• NEXUS does not launch paid ads or start budget spend just because an account is connected or a plan exists. Platform creation is paused-draft only, and activation requires separate final approval for launch, budget, and spend.\n• Access tokens are encrypted inside the application with AES-256-GCM and removed from NEXUS when you disconnect the account.\n• We never see or store your Facebook password — connection uses Meta's official OAuth.\n• To delete data associated with a Meta connection, disconnect in Connections or use our Data Deletion process (/data-deletion).\n• The Instagram path is implemented, but it is not shown as ready until Business-account and publishing-permission verification succeeds.`,
  },
  {
    titleAr: '12. التواصل',
    titleEn: '12. Contact Us',
    bodyAr: 'البريد المتاح لطلبات الخصوصية: privacy@nexus-grow.com',
    bodyEn: 'Privacy request email: privacy@nexus-grow.com',
  },
]

export default function PrivacyPage() {
  const { t, locale, isRTL } = useI18n()
  const lgT = t('legal')
  const isAr = locale === 'ar'

  return (
    <LegalDocumentPage
      badge="Privacy Policy"
      title={lgT?.privacyTitle as string}
      subtitle={lgT?.privacySubtitle as string}
      lastUpdated={isAr ? 'آخر تحديث: 22 يوليو 2026' : 'Last updated: July 22, 2026'}
      sections={SECTIONS}
      isAr={isAr}
      isRTL={isRTL}
    />
  )
}
