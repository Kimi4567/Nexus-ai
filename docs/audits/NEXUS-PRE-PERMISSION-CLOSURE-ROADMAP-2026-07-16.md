# NEXUS — خارطة إغلاق الجاهزية قبل تصاريح المنصات

التاريخ: 2026-07-16
النطاق: رحلة Brand Brain → Strategy → Content → Approval → Execution → Results، والأمن، والكريديت، ووضوح الوعود.
الحكم: **البنية الداخلية قابلة لاختبار ما قبل التصاريح، لكنها ليست بعدُ دليلاً على شركة تسويق ذاتية مكتملة؛ هذا الوصف يحتاج Pilot منشورًا وبيانات أداء حقيقية.**

## ما تم تدقيقه بصريًا في الإنتاج

- Today / Dashboard.
- Brand Brain، بما في ذلك Review & Readiness ومكان Evidence Library.
- Strategy portfolio وصفحة الحملة الكاملة.
- Content production.
- Approvals.
- Execution queue / Calendar.
- Results & learning / Analytics.
- Connections.
- Billing، Credit wallet، Credit History.
- Paid execution draft المرتبط بالاستراتيجية.

لم تظهر أخطاء Console في الصفحات النهائية المدققة. ظهر القرار الأول في Today خلال نحو `4.05s` في القياس المسجّل.

## الأخطاء التي أُغلقت في مرشح الإصدار الحالي

### P0 — حقيقة التشغيل

- توحيد Inbox الموافقات في خدمة وAPI واحدة بدل أعداد متنافسة بين Sidebar وApprovals وOperations.
- منع إنشاء Paid execution من استراتيجية Organic أو استراتيجية لم تجتز Quality review.
- الحفاظ على `sourceCampaignId` وعرض سبب المنع الحقيقي بدل اختيار حملة أخرى بصمت.
- توحيد معنى Paid readiness: اكتمال Brief التخطيطي لا يعني جاهزية الإنفاق أو الإطلاق.
- منع CTA أو أصل تسويقي غير موثق مثل guide أو report أو demo غير موجود.
- إبقاء التنفيذ مقفلاً أثناء فحص Brand Brain، مع عدم عرض رسالة فشل كاذبة في حالة `checking`.
- احتساب Readiness & risks من الفجوات + متطلبات الجاهزية غير المكتملة + المخاطر بنفس منطق العلامات المرئية.
- استخدام `audiencePainPoints` المحفوظة عند غياب Problem داخل وثيقة الاستراتيجية بدل عرض “Not defined” خطأً.

### P0 — الأمن والبيانات

- كل جداول `public` الحالية عليها RLS، وأدوار `anon` و`authenticated` لا تملك صلاحيات الجداول.
- تطبيق Event Trigger حي يفعّل RLS تلقائيًا لأي جدول `public` جديد، مع اختبار Transactional probe ناجح.
- لا توجد تحذيرات Supabase حرجة من نوع `rls_disabled_in_public` أو `sensitive_columns_exposed`.
- تحذير Auth المتبقي هو leaked-password protection، وهو إعداد Supabase Pro خارجي وليس ثغرة تُحل بواجهة المنتج.

### P1 — وضوح المنتج والاقتصاديات

- تسمية خطوة Brand Brain أصبحت `Voice, Proof & Messaging` حتى لا تبقى Evidence Library مدفونة.
- Credit History يشرح المعاملات القديمة دون اختراع Pricing version أو مخرج غير محفوظ.
- المخرج المرتبط قابل للفتح عندما يكون نوع الكيان معروفًا.
- سبب الخصم لا يكرر قيمة الخصم نفسها داخل النص وعمود المبلغ.
- الخطط الحالية: Growth `$49 / 60 credits` وAutopilot `$99 / 180 credits`، مع Wallet منفصل وبقاء الكريديت المشترى 12 شهرًا.
- التسعير الحالي Versioned، والحجز قبل العملية والتسوية بعد النجاح والاسترداد عند الفشل، مع Idempotency.
- نصوص Meta وTikTok review والخصوصية والشروط وحذف البيانات أصبحت مقيدة بما ينفذه النظام فعلًا.

### P1 — الرصد

- Sentry مهيأ للـBrowser وNode وEdge وApp Router، مع Privacy filtering وبيئات Preview/Production منفصلة وSource maps.
- لا يُرسل شيء إذا كانت بوابات Sentry أو DSN غير صالحة، ولا تُسجّل Tokens أو Cookies أو Request bodies.

## بوابة الجودة الحالية

- Vitest: `296/296` ملفات و`2,248/2,248` اختبارًا ناجحًا.
- TypeScript: ناجح.
- Next.js production build: ناجح.
- ESLint على الملفات المعدلة: صفر Errors؛ توجد Warnings قديمة مسجلة كدين تقني وليست فشل Build.
- فحص بصري للصفحات الأساسية: لا Console errors.

## المتبقي — بالترتيب الصحيح

### 1. إصدار مرشح الكود إلى Preview ثم Production

الحالة: **لم يُنفذ ضمن هذا التقرير**.

1. مراجعة Diff الحالي وعدم ضم تغييرات غير مقصودة.
2. Commit وPush وPreview deployment.
3. إعادة المسار البصري نفسه على Preview، خصوصًا العدّ، Problem fallback، رسالة Brand checking، وCredit History.
4. Promote إلى Production فقط بعد تطابق Preview.

شرط النجاح: نفس الحقائق والأعداد في كل صفحة، وصفر Console/API errors.

### 2. الإعدادات الخارجية التي لا يصح ادعاء اكتمالها برمجيًا

- تفعيل leaked-password protection عند ترقية Supabase إلى Pro قبل التسجيل العام.
- إبقاء Stripe Sandbox حتى صدور الرخصة وتجهيز Live business/payment prerequisites، ثم اختبار Checkout وWebhook حقيقيين.
- إنهاء مراجعات وصلاحيات النشر لكل منصة مطلوبة وربط حساب Organic حقيقي واحد على الأقل.
- الحفاظ على Google Ads في وضع Test/manager الحالي حتى يتوفر الحساب والصلاحية المناسبة للإنفاق الحقيقي.

شرط النجاح: Token health وProvider account IDs وصلاحيات النشر/الإعلانات مثبتة من APIs، لا من مجرد زر Connected.

### 3. Pilot حقيقي — بوابة وصف “شركة تسويق مكتملة”

1. Brand حقيقي مع مصادر وأدلة وحقوق استخدام.
2. Strategy معتمدة، Conversion destination، Baseline، KPIs، UTMs وTracking plan.
3. حزمة محتوى فعلية بمقاسات المنصات وموافقات Copy/Media/Schedule محفوظة.
4. نشر فعلي على منصتين على الأقل مع Provider IDs ومنع التكرار.
5. حملة إعلانية صغيرة بحد إنفاق وKill switch وموافقة Budget وLaunch منفصلتين.
6. سحب Analytics حقيقية والتحقق من Data freshness.
7. إنشاء Learning Proposal يوضح المصدر، الفترة، العينة، الثقة، الأثر والRollback.
8. موافقة بشرية على المقترح ثم تطبيقه وقياسه.
9. عطل متعمد لاختبار Incident وRetry وEscalation وSLA.

شرط النجاح: كل ادعاء نتيجة أو تعلم يرجع إلى Provider data حقيقية، وكل فعل وخصم له Audit trail قابل للتتبع.

## القرار النهائي

- **الجاهزية الداخلية كـMarketing Operating System مع Human approval:** مرشح إصدار قوي بعد نشر التغييرات وإعادة Smoke test.
- **جاهزية “شركة تسويق تنفذ 24/7” كادعاء تجاري:** غير مثبتة بعد؛ يحسمها Pilot الحقيقي والتصاريح والبيانات، لا عدد الصفحات أو الاختبارات.
- لا نضيف Features جديدة قبل إغلاق مراحل الإصدار الخارجي والـPilot؛ الأولوية الآن إثبات الحلقة المغلقة الموجودة بالفعل.
