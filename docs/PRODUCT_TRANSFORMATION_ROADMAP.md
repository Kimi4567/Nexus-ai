# NEXUS — خارطة التحول إلى قسم تسويق كامل وموثوق

آخر تحديث: 2026-07-21

## الهدف

تحويل NEXUS من نظام قوي لتخطيط وحوكمة الاستراتيجية والمحتوى إلى قسم تسويق رقمي متكامل يغلق الحلقة التالية بأدلة قابلة للتدقيق:

`Brand truth → Strategy → Campaign → Content → Creative → Approval → Distribution → Leads/Revenue → Measurement → Learning`

لا يُعتبر أي جزء "تشغيليًا" لمجرد وجود صفحة أو API. التشغيل يعني أن رحلة حقيقية نجحت، ولها سجل قرار، ومعرّف من المزود، وقياس موثوق، وحالة فشل واسترداد آمنة.

## تموضع المنتج أثناء التنفيذ

حتى اجتياز مرحلة التصاريح والقياس، الوعد التجاري الصحيح هو:

> AI Marketing Operating System للاستراتيجية والمحتوى والموافقات، مع تنفيذ مشروط بتصاريح المنصات وبيانات حقيقية.

لا يُستخدم وعد "قسم تسويق كامل" في التسويق العام قبل اجتياز بوابات المراحل 0–4 أدناه.

## حالة التنفيذ الحالية — 2026-07-21

### ما اكتمل تنفيذه والتحقق منه

- فصل Strategy Quality Pipeline عن قاعدة البيانات حتى يخضع نفس مسار الإنتاج للاختبارات والتقييم الحي.
- إنشاء corpus من 30 حالة عربية/إنجليزية تغطي Organic وPaid وFull وقطاعات متعددة.
- إصلاح false positive في Marketing Quality Gate وإضافة اختبارات regression.
- تقوية Checkout باعتماد request id وStripe idempotency ومنع الاشتراكات المتوازية.
- إضافة سجل دائم لأحداث Stripe Webhook مع claim/retry ومنع fulfillment المكرر.
- تصحيح حالات الاشتراك، التجديد، الإلغاء المجدول، فشل الدفع، واسترداد رصيد المحفظة كليًا أو جزئيًا.
- إضافة رسائل رجوع Checkout صادقة، وحالة بيتا واضحة، ومراجعة Desktop/Mobile دون overflow أفقي.
- استبدال `next lint` المهجور بـESLint CLI وإضافة `npm run verify` وGitHub Actions كبوابة دمج تلقائية.
- اجتياز lint وTypeScript و2716 اختبارًا والبناء الإنتاجي لـ131 صفحة محليًا.
- بدء المرحلة 1 بإغلاق سباقات الاعتماد والجدولة والتراجع: القرارات أصبحت ذرّية ومثبتة على `updatedAt` ولا تنجح جزئيًا إذا تغير أي منشور أثناء المراجعة.
- تحويل A/B في Content Hub إلى مقارنة مسودات صادقة مرتبطة بفرضية وإشارة نجاح وحد أدنى للأدلة، مع اختيار ذريّ يقتصر على حالة `DRAFT` ولا يدّعي فائز أداء.
- تثبيت اعتماد الاستراتيجية على الإصدار الذي شاهده المستخدم وإيقاف الاعتماد إذا تغيّرت الاستراتيجية قبل القرار أو أثناء معاملته.
- توسيع لوحة جاهزية ما قبل التصاريح إلى Meta وLinkedIn وTikTok وYouTube وX وPinterest وThreads، مع fail-closed عند نقص مفاتيح OAuth أو توقيع `state`.
- منع التوكن المنتهي أو هوية Page غير المصحوبة بدليل صلاحية من الظهور كجاهزية نشر.
- جعل فصل المنصات عملية ذرّية تمسح رموز الوصول من الأعمدة ومن إعدادات المزود المتداخلة، مع سجل حدث آمن وفصل صريح بين المسح المحلي وإلغاء التفويض لدى المزود.
- إنشاء Delivery Package موحّد للحملة من نفس مصدر الحقيقة: استراتيجية معتمدة، نص معتمد، أصل مرئي معتمد، وموعد مثبت، مع التحقق من hashes والإصدارات ومنع اعتبار النسخة المنحرفة معتمدة.
- تصحيح export ونسخة الطباعة بحيث تميّزان بوضوح بين Draft وCopy Approved وReady for Scheduling، ولا تعتبران المحتوى منشورًا دون `providerPostId` موثّق.
- إنشاء أساس CRM حقيقي ومعزول لكل Workspace: Lead وLeadActivity، منع تكرار بالبريد/الهاتف، attribution محدود، consent موثّق لا يُفترض، انتقالات مراحل مضبوطة، سجل قرار، وoptimistic concurrency.
- إضافة واجهة Leads & CRM وحالات readiness صادقة. الميزة مغلقة افتراضيًا بـ`LEADS_CRM_ENABLED=false` ولا ترسل بريدًا أو SMS أو أي outreach تلقائي.
- اجتياز مراجعة Mobile لمسار `/leads` غير المسجل: التحويل إلى تسجيل الدخول صحيح، بلا overflow أفقي أو أخطاء Console. لم تُزيف جلسة مستخدم لمعاينة بيانات CRM.
- إضافة owner assignment وfirst-response SLA وLeadTask بموعد وأولوية ومسؤول وحالات Complete/Cancel، مع optimistic concurrency وسجل نشاط ذري.
- إضافة CSV import محدود بـ200 صف و256KB، يدعم dry-run، يمنع التكرار داخل الملف وداخل Workspace، ويتراجع بالكامل عند فشل قاعدة البيانات.
- إضافة Lead Capture Forms مرتبطة بالحملة: public endpoint لا يعيد بيانات Lead، origin اختياري، honeypot، rate limits، وresponse عام لا يكشف وجود duplicate.
- إضافة hosted public form مع UTM attribution وconsent checkbox صريح. الموافقة تُوسم self-attested وidentity unverified، ولا تطلق أي outreach.
- اجتياز مراجعة Mobile عند 390px للنموذج العام المقفول ومسار CSV غير المسجل: لا overflow أو Console errors أو Next overlay، والتحويل إلى Login صحيح.
- إضافة مركز تنبيهات SLA داخلي يجمع تأخر أول استجابة ومهام المتابعة من المواعيد المسجلة داخل Workspace. التنبيهات facts تشغيلية فقط و`outreachTriggered=false`.
- إنشاء Customer Lifecycle control plane مستقل عن رسائل حساب NEXUS: Email/SMS drafts، اعتماد نص بـoptimistic concurrency، وحالة تسليم ثابتة `BLOCKED / NOT_CONNECTED` بلا Queue أو Provider ID أو حالة `SENT`.
- إضافة suppression دائم لكل Workspace وقناة باستخدام keyed HMAC بدل تخزين البريد/الهاتف مرة ثانية، ويظل السجل قائمًا عند حذف Lead.
- إضافة unsubscribe عام بتوكن HMAC موقّع ومحدد الصلاحية؛ يسجل suppression ويلغي consent ذريًا من دون كشف هوية Lead أو Workspace.
- إضافة Double opt-in كغرض صياغة فقط، مع منع ادعاء التحقق من الهوية قبل ربط مزود إرسال وwebhook موثّق.
- إنشاء Landing Pages مرتبطة بحملة وLead Capture Form، مع نصوص منظمة فقط، ثلاث Themes مقيدة، وإثبات اختياري يقدمه النشاط التجاري بدل اختلاق claims.
- إضافة مراجعات versioned وpublished snapshot ثابت مع hash؛ التعديل بعد النشر يبقى غير منشور حتى قرار Publish جديد ومقيد بـoptimistic concurrency.
- إغلاق حلقة `Campaign → Landing Page → CTA/Form → Lead`: الزيارة والنقرة `CLIENT_REPORTED` فقط، بينما إرسال النموذج يُكتب `SERVER_CONFIRMED` مع Lead داخل نفس المعاملة.
- إضافة UTM passthrough، HMAC pseudonymous fingerprints، deduplication، same-origin event intake، rate limits، وSQL truth invariant يمنع المتصفح من كتابة تحويل مؤكد.
- إضافة Landing Pages Workspace تعرض reported views/clicks منفصلة عن confirmed forms، ولا تدعي revenue أو sale.
- اجتياز فحص بصري Desktop/Mobile للصفحة العربية المنشورة عبر fixture تطوير مؤقت تمت إزالته، وحالة الإغلاق العامة، مع RTL صحيح وCTA ظاهر وUTM محفوظ وصفر overflow/console errors/Next overlay.
- إنشاء سجل A/B حقيقي لصفحات الهبوط بمتغير واحد فقط (`HEADLINE / SUBHEADLINE / CTA_LABEL`) ونسختين immutable، مع توزيع HMAC ثابت وتوكن assignment موقّع يصل حتى النموذج والتحويل المؤكد.
- فصل الحد الأدنى للأدلة عن ادعاء الفوز: الزيارات والنقرات تظل `CLIENT_REPORTED`، وإرسال النموذج فقط `SERVER_CONFIRMED`؛ النظام يعرض معدلًا وصفيًا ويطلب قرارًا بشريًا وملاحظة، ولا يدّعي دلالة إحصائية.
- منع تعديل أو نشر الصفحة أثناء تجربة جارية/متوقفة مؤقتًا، ومنع أكثر من تجربة `RUNNING` لكل صفحة في SQL. اختيار Challenger ينشئ Draft Revision فقط ولا يغيّر الصفحة المنشورة دون Publish مستقل.
- إنشاء SEO foundation لصفحات الهبوط: الفهرسة `noindex` افتراضيًا وopt-in صريح، metadata وcanonical وOpen Graph من النسخة المنشورة فقط، SSR للمحتوى العام، استبعاد crawlers من A/B والقياس، وsitemap لا تضم إلا الصفحات المنشورة التي تسمح النسخة immutable بفهرستها.
- إضافة Page Quality Gate حي داخل محرر صفحات الهبوط يفصل blockers عن التحذيرات والمعلومات، يراجع اكتمال العرض وSEO وصدق القياس، ولا يقدم درجته كتوقع ترتيب أو تحويل. كما يمنع نشر النسخة المحفوظة القديمة عند وجود تعديلات غير محفوظة على الشاشة.
- إضافة Marketing Migration Contract Harness آمن لا يقبل إلا Postgres محلية disposable، ويطبق migrations الفوترة وCRM وLifecycle وLanding/CRO وA/B وSEO بالترتيب، ثم يختبر RLS وسحب صلاحيات browser roles وقيود الحقيقة والفهارس ببيانات فعلية. أضيفت له بوابة Postgres 17 مستقلة في GitHub Actions.
- إضافة فهارس مباشرة لمفاتيح `Lead.assignedToId` و`LeadTask.createdById` و`LeadCaptureForm.createdById` حتى لا تتحول عمليات حذف المستخدم و`SET NULL` إلى full-table scans.
- تطبيق جميع migrations التسويق على مشروع Supabase معزول من الصفر، وتشغيل اختبارات فعلية للعزل والقيود: Leadين معزولين، conversion مؤكد، تجربة جارية، مهمة، suppression، ورسالة Lifecycle محجوبة. المشروع الاختباري أُوقف بعد التحقق ولم تُمس production.
- إضافة قيود مركبة تمنع ربط Lead أو Task أو Landing Page أو Conversion أو LifecycleMessage بكيانات من Workspace أخرى؛ probe مباشر لمحاولة الربط المتقاطع أصبح يُرفض بـPostgres `23503`.
- إضافة بوابة فوترة موحدة fail-closed تميّز Test/Live/Invalid، تمنع تفعيل مفتاح Live دون `BILLING_LIVE_MODE_APPROVED=true`، وترفض Price IDs المكررة أو غير الصحيحة شكليًا.
- إضافة `npm run billing:verify-test-mode` لفحص مصادقة Stripe وأسعار Growth/Autopilot وأسعار المحفظة قراءةً فقط، مع رفض مفاتيح Live قبل أي API call.
- إضافة `npm run billing:sync-wallet-test-prices` كـdry run افتراضي و`--apply` صريح لإنشاء أسعار المحفظة الناقصة فقط داخل Test Mode، مع lookup keys ثابتة ورفض أي مفتاح Live أو Product غير اختباري.
- تصحيح عقد التسعير في README إلى 15 رصيدًا تجريبيًا و60 لـGrowth و180 لـAutopilot، وتوحيد اسم `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` مع إعداد Vercel.
- التحقق من البيئة الحالية عبر جلسة مستخدم حقيقية: صفحة Billing استقرت على `Stripe Sandbox is active` و`no real money is charged`، وخطة Autopilot الاختبارية ظاهرة Active.
- إنشاء أربع شرائح أسعار Test Mode صحيحة لمحفظة الكريدت (`$1.00 / $0.90 / $0.80 / $0.70`) وربط Price IDs الجديدة ببيئة Vercel Production، مع إبقاء Stripe Live مقفولًا وبدون `BILLING_LIVE_MODE_APPROVED`.
- إعادة نشر مصدر Production الحالي بنجاح إلى deployment `dpl_5BtvM8e2SEL5ACNYbKePpefQJ5Ch`؛ الحالة `Ready`، والدومين `www.nexus-grow.com` يعيد HTTP 200 من `/api/health`، ولا توجد سجلات Error على النشر خلال نافذة التحقق.
- إكمال دورة شراء محفظة حقيقية في Stripe Sandbox: شراء 20 كريدت مقابل `$20.00` ببطاقة Stripe الاختبارية، استقبال `checkout.session.completed` بالحدث `evt_1TvTMQRrREVc0xX3r01PqMMH` عبر Webhook بحالة HTTP 200، وتنفيذ fulfillment مرة واحدة فقط. ارتفع الرصيد من 495 إلى 515، وظهر سجل شراء واحد مكتمل؛ لم تُستخدم أموال حقيقية.
- إثبات عمل OpenAI في Production عبر `/api/chat`: الرد رفض ادعاء النشر إلى Meta دون صلاحيات، والطلب عاد HTTP 200، وخصم كريدت واحد فقط من حزمة الشراء. الرصيد النهائي 514 = 495 منحة يدوية + 19 مشتراة، من دون تغيير المنحة اليدوية.
- تطبيق ترحيلات الفوترة وCRM وLifecycle وLanding/CRO وA/B وSEO وعزل Workspace على مشروع Supabase الإنتاجي `qabttahvjhgzwfzqnxew` في ثماني معاملات مراقبة. أصبحت الجداول الإحدى عشرة الجديدة موجودة في Production، وكلها تستخدم RLS مع سحب DML من `anon` و`authenticated`.
- التحقق بعد cutover من أن ربط Lead بحملة من Workspace آخر يُرفض بقاعدة البيانات ولا يترك بيانات جزئية. لم تظهر Security Advisors حرجة؛ بقي تحذير واحد يجب إغلاقه قبل التوسع العام: Supabase Leaked Password Protection غير مفعّل.
- إصلاح تحذير الاعتماد الإنتاجي بتثبيت `axios` على `1.18.1` وتحديث نسخ `brace-expansion` المتأثرة فقط. اجتاز `npm audit` الكامل بنتيجة صفر ثغرات، ثم اجتاز lint وTypeScript و2714 اختبارًا وبناء 131 صفحة.
- نشر النسخة المصححة أولًا إلى Preview `dpl_HTQg5AkN5QTFUcHYJmTS4mv7RQvy` ثم إلى Production `dpl_2xSZXtaHPdcvnh6tBGnnFzp9W7fD`. حالة Production `Ready`، و`/api/health` والصفحات الأساسية تعيد HTTP 200، ولا توجد سجلات Runtime Error أو Warning في نافذة التحقق.
- استعادة تحكم Chrome واختبار Strategy Studio من جلسة المستخدم الحقيقية. الطلب يعرض الوعد التجاري قبل الخصم بوضوح: Organic لمدة 30 يومًا، 10 اتجاهات محتوى، ولا يتضمن Content Hub drafts أو تقويمًا محفوظًا أو نشرًا أو إعلانات.
- تنفيذ محاولتي استراتيجية حقيقيتين في Production مع منع الحفظ الآمن واسترداد كامل للكريديت في المرتين. المحاولة الأولى استغرقت نحو 89 ثانية وتوقفت عند ضعف `businessObjective.measurableSuccessDefinition` بتكلفة مزود تقديرية `$0.122432`. المحاولة الثانية راجعت السعر الحالي 12 كريديت والرصيد `514 → 502`، ثم توقفت بعد نحو 125 ثانية عند `unsourced_channel_market_claim` بتكلفة مزود `$0.12518`. بعد كل فشل عاد الرصيد إلى 514 ولم تُحفظ Campaign ناقصة.
- إصلاح هدف Engagement/Awareness ليحتوي تعريف نجاح تشغيلي وقرار continue/iterate، وتمرير أسباب العقد الدقيقة إلى repair prompt بدل إصلاح العدد فقط. ثم إضافة حارس حتمي موحّد مع Marketing Quality Gate يحوّل أي ادعاء غير موثّق عن شعبية/نمو/تفاعل القناة إلى فرضية صريحة قابلة للتحقق، من دون تعطيل بوابة الحقيقة.
- اجتاز الإصلاح الأخير 87 اختبارًا مركزًا ثم بوابة الإصدار الكاملة: lint وTypeScript و381 ملف اختبار ناجح + ملف متخطّى، و2716 اختبارًا ناجحًا + 30 متخطّيًا، وبناء 131 صفحة. نُشر Preview `dpl_JBzz6tE7pJBameTTUjUFEfrwLvVa` ثم Production `dpl_7ewWRMncyTQBP4mZEyzg5Zd5zUiH` بحالة `Ready`. الدومين `www.nexus-grow.com` يشير إلى النسخة الجديدة، و`/api/health` يعيد HTTP 200، ولا توجد Runtime Errors في نافذة ما بعد النشر.
- توثيق اشتراك Stripe Sandbox الفعلي `sub_1TdUcsRrREVc0xX30CMKuXPs`: Checkout أولي مدفوع في 1 يونيو، وتجديد `invoice.paid` مدفوع في 1 يوليو، وإلغاء مجدول ظاهر في Stripe. هذا الاشتراك Legacy باسم Nexus Pro وسعر `$79/month` بينما المنتج الحالي يعرض Autopilot بسعر `$99/month`؛ لا يُستخدم دليلًا على تطابق التسعير الحالي.
- مراجعة مسار refund قبل تغيير Stripe: `charge.refunded` يصالح فقط مشتريات المحفظة ذات metadata موثقة، ولا يصالح حاليًا refund لفاتورة اشتراك شهرية. لذلك لم يُنفذ refund على اشتراك `$79` القديم كي لا ينشأ فرق صامت بين Stripe واستحقاق الكريديت.
- إضافة Truth Contract حتمي للاستراتيجية يعيد تطبيق حارس الإثبات وعقد المخرجات حتى نقطة ثبات محدودة، ثم يعيد بناء الخطة الأسبوعية بعد إزالة التكرار. توسع الحارس ليمنع وعود جودة المنتج أو سهولة/ثقة تجربة الشراء ما لم يقدّم النشاط إثباتًا تجاريًا صريحًا.
- إضافة blocker باسم `placeholder_content_direction` يمنع اعتبار عبارات الحشو العامة مثل «فرضية اتجاه المحتوى» نتيجة مدفوعة صالحة. النتيجة غير القابلة للاستخدام تتوقف بأمان ويُسترد رصيدها بدل حفظ حملة شكلية.
- إضافة مصالحة Refund لفواتير الاشتراك الشهرية: الاسترداد الجزئي أو التراكمي يسحب النسبة المقابلة من منحة الدورة المحددة فقط، ولا يمس Trial أو Purchased أو Referral أو Manual. إذا كان الرصيد الشهري قد استُهلك يسجل النظام الجزء غير القابل للاسترداد بدل إنشاء رصيد سالب، مع operation key مستقل لكل حدث Stripe ومنع التنفيذ المكرر.
- اجتازت التغييرات الأخيرة lint وTypeScript و382 ملف اختبار ناجح + ملف متخطّى، و2729 اختبارًا ناجحًا + 30 متخطّيًا، وبناء إنتاجي لـ131 صفحة. نُشرت إلى Preview `dpl_ANZ3aitAPMXzt6ZDJpYvgVtMxVdr` ثم Production `dpl_EmVn6Etb6iHAC3DLRH2QMpA97BYM`; الدومين `www.nexus-grow.com` يشير إلى النسخة الجديدة و`/api/health` يعيد HTTP 200.
- نجحت محاولتا Strategy متتاليتان على Production بعد إصلاحات الحقيقة: HTTP 200، عقد بنيوي 100/100، Marketing Quality Gate 100/100، واستقرار الحفظ والخصم. سجلت كل محاولة repair واحدًا وتكلفة مزود تقريبية `$0.106478` و`$0.116985`. ما زالت بوابة الجودة النهائية والزمن تحتاجان إغلاقًا أدق قبل اعتبار المسار كاملًا.
- نُفذت دورة محفظة Stripe Sandbox أخرى كاملة: شراء 50 كريديت مقابل `$50.00`، fulfillment واحد رفع الرصيد `478 → 528`، ثم Full Refund من Stripe Test أعاد الرصيد `528 → 478` وسجل `-50` في تاريخ المحفظة بلا مساس بمنح الاشتراك. ترقية الاشتراك الحالي والتجربة على سعر جديد مؤجلتان بقرار المالك إلى مرحلة التصاريح.
- فُعلت CRM وLanding Pages و`CRO_EVENT_HASH_KEY` في Production واكتملت رحلة Signed-in واحدة: صفحة هبوط منشورة غير مفهرسة → UTM → CTA → نموذج موافقة صريحة → Lead واحد مع deduplication → owner/SLA/task → مراحل CRM حتى Lost بسبب اختبار داخلي. بقيت views/clicks browser-reported، بينما النموذجان server-confirmed؛ لم يُسجل Won أو revenue أو outreach وهمي. أُوقف النموذج وأُرشفت الصفحة مع إبقاء القياسات والسجل.
- ثبت العزل بطبقتين: رحلة Production داخل Workspace واحد، وMigration Contract Harness فعلي يرفض الربط المتقاطع بين Workspaces. لا يُدّعى تنفيذ رحلة حية بحسابين على Production.
- إضافة أرشفة Landing Page من الواجهة بمربع تأكيد داخل التطبيق، وتعطيل الرابط العام مع إبقاء التاريخ والقياسات read-only؛ أُزيلت فجوة CTA المنشور الذي يشير إلى نموذج موقوف.
- توحيد Proof Context المستخدم في التوليد والعرض وSentinel حتى لا تنجح الاستراتيجية في الإنتاج ثم تُعاد كتابتها بسياق أضيق وتظهر خطأ كحزمة قديمة. أضيفت أسباب العقد الدقيقة وإجراء recovery واضح قبل أي فحص مدفوع.
- إضافة قياس زمن Strategy إلى إيصال النجاح والسجلات، timeout محدد لكل نداء مزود داخل سقف الوظيفة، ورسائل صادقة عند انقطاع الاتصال توضح أن إعادة المحاولة تستخدم operation ID نفسه وتمنع الخصم المكرر.
- توثيق نموذج تشغيل الوكالة في `docs/MARKETING_AGENCY_OPERATING_MODEL.md`: كتالوج الخدمة، SLA، مصفوفة الموافقات، P0–P3، التصعيد، ضمان الجودة، الإيقاع التشغيلي، وحدود ما قبل التصاريح.
- رُفع سقف Campaign Engine من 60 إلى 180 ثانية بعد إثبات 504 حقيقي، مع recovery ذري رد 12 كريديت وأغلق الحجز والـAgentRun العالقين. ثم وُحد سقف Content Plan على 180 ثانية ومسار صورة Content Hub الواحدة على 300 ثانية بدل أن يعيد `vercel.json` خفضهما إلى 60.
- أصلح حارس Channel Mix إسقاط منصة راجعها المستخدم: يضيف المنصة الناقصة بوزن صفري وسبب صادق قابل للمراجعة بدل اختلاق توزيع. نجحت إعادة بناء Production بعقد 10/10 واتجاهات وتقويم 10/10، وQuality Gate 100/100، وتكلفة مزود `$0.003320` عبر نداءين `gpt-4o-mini`.
- اجتازت الحملة نفسها Sentinel على Production: `passed`، risk `18`، brand consistency `85`، بلا warnings أو fixes، وتكلفة مزود `$0.006835` على `gpt-4o`. استقر الخصمان 12 + 3 كريديت والرصيد النهائي 463.
- أُزيل التناقض بين اعتماد الاستراتيجية والجاهزية للإطلاق: الحالة الدائمة أصبحت `strategy_approved` و`currentStep=content`، بينما تعرض الواجهة 0 posts وCreative ينتظر المحتوى والنشر محجوب والAnalytics ينتظر بيانات حقيقية.
- لم تُنشأ خطة المحتوى لأن الحد الحقيقي هو 16 مسودة شهريًا، والمستخدم استهلك 12 والخطة تحتاج 10. أوقف الخادم العملية قبل خصم 6 كريديت، وأظهر التجدد في 1 أغسطس 2026 وإمكانية الانتظار بلا ترقية. صحح مركز العمليات القرار من `Generate now` عالي الأولوية إلى `Wait for reset` منخفض وmonitor-only.
- آخر إصدار Production موثق لهذه الحالة هو `dpl_91daHyBb5fvdujMUKKpURR8BvJQi` (`https://nexus-fabsr9zjb-raouf-s-projects2.vercel.app`، alias `www.nexus-grow.com`). اجتاز 389 ملف اختبار + ملفًا متجاوزًا، و2,773 اختبارًا + 30 متجاوزًا، وTypeScript وESLint والبناء المحلي والإنتاجي لـ131 صفحة، بلا Runtime errors في نافذة ما بعد النشر.

### بوابات لم تُجتز بعد

- Proof Context الموحّد مر فعليًا عبر Quality Gate وSentinel والاعتماد في حملة Production. مع ذلك لا يوجد P95 موثوق: المتاح محاولتان كاملتان ناجحتان فقط على GPT-4o، وإعادة بناء حملة ناجحة على `gpt-4o-mini` لا تُحسب كعينة ثالثة من المسار نفسه. يلزم 20 تشغيلًا على الأقل أو SLO متفق عليه مع عينة منفصلة لكل مسار.
- دورة محفظة Stripe Sandbox اكتملت شراءً وRefund فعليًا. المتبقي ماليًا هو اشتراك جديد بالـPrice IDs الحالية مع renewal/cancel/refund؛ أُجل عمدًا إلى نهاية الخطة مع الترقية والتصاريح، ولا يُستخدم اشتراك Nexus Pro Legacy لإثبات التسعير الحالي.
- CRM وLanding/CRO يعملان على Production واكتملت رحلة Workspace واحدة. المتبقي قبل rollout أوسع هو رحلة حية بحسابين منفصلين أو بيئة Preview مستقلة، وLifecycle Email/SMS يبقى `sendsEnabled=false` حتى تصريح المزود والـwebhooks.
- Supabase Preview branches غير متاحة على خطة المؤسسة الحالية المجانية؛ استُخدم بدلًا منها مشروع اختبار معزول وأُوقف بعد النجاح.
- تم نشر إعدادات Sandbox إلى Production deployment الحالي، لكن لا يوجد تفعيل Stripe Live ولا طلب تصاريح منصات ضمن هذه الدفعة.
- بوابة الجاهزية الداخلية ما زالت تنتظر immutable copy+media approval لحملة Sandbox كاملة. الحملة الجديدة وصلت إلى استراتيجية معتمدة وSentinel ناجح، لكن Content Hub مؤجل حتى تجدد الحد؛ لا يجوز حذف 12 منشورًا معتمدًا ومجدولًا في حملة أخرى لتجاوز الحد، ولا ترقية الخطة لمجرد إغلاق QA.
- بعض معاملات الكريديت القديمة تسبق versioned ledger وتظل ظاهرة كـLegacy evidence بلا اختلاق metadata. أحدث الخصومات الحالية كاملة التتبع، لكن legacy attention item لا يُمحى تاريخيًا.
- Supabase Leaked Password Protection ما زال غير مفعّل؛ لا يمنع ذلك جاهزية النشر الحالية لكنه يبقى Gate أمنيًا قبل فتح التسجيل على نطاق أوسع.

### الإجراء التالي الإلزامي

1. في 1 أغسطس 2026 أو بعد توفر allowance حقيقي، أنشئ Content Hub plan للحملة المعتمدة ثم أكمل copy review → media generation/attach → immutable copy/media approval من دون نشر.
2. حفظ Price IDs الاختبارية الحالية كمصدر حقيقة، وتشغيل `npm run billing:verify-test-mode` من بيئة آمنة عند كل تغيير تسعير؛ يظل Stripe Live مقفولًا.
3. أبقِ Stripe Live والترقية مؤجلين. عند فتح المرحلة النهائية: أنشئ اشتراكًا جديدًا بالـPrice IDs الحالية ثم اختبر `checkout → invoice.paid → renewal → scheduled cancel → partial/full refund` مع idempotency ومصالحة المنحة.
4. اجمع عينة Reliability منفصلة لا تقل عن 20 تشغيلًا كاملًا لـStrategy مع duration/cost/repair/failure reason، ثم احسب first-pass وrepair success وP95؛ لا تخلط Campaign Engine mini مع Full Strategy.
5. نفّذ Signed-in E2E بحسابين وWorkspace مختلفين في Preview/بيئة معزولة قبل تعميم CRM/Landing على عملاء إضافيين؛ production single-workspace وSQL isolation مثبتان بالفعل.
6. رحلة Lead الداخلية اكتملت حتى Lost مع dedup/SLA/task. المتبقي اختبار حذف/retention وسياسة Won/revenue بقرار تجاري حقيقي لا ببيانات QA.
7. الترحيل مطبق؛ اضبط مفتاحي HMAC مستقلين في Preview ثم اختبر `draft → copy approval → suppression → signed unsubscribe` مع بقاء `sendsEnabled=false`.
8. لا يُوصل Resend/SMS للعملاء قبل domain/number verification وprovider approval وidempotent queue وdelivery/bounce/complaint webhooks.
9. `CRO_EVENT_HASH_KEY` ورحلة Production الواحدة مثبتان؛ كرر `publish → view → CTA → form → Lead → confirmed conversion` في Workspace ثانٍ مع إبقاء الـbrowser signals منفصلة عن server-confirmed evidence.
10. لا يُفتح Stripe Live أو Lifecycle delivery أو platform execution قبل نجاح الدورات وتوثيق الأدلة؛ CRM/Landing الحاليان يظلان rollout داخليًا مراقبًا.
11. بعد نجاح Landing/CRO في Preview، فعّل `LANDING_PAGE_EXPERIMENTS_ENABLED` هناك فقط، ثم اختبر `create → start → stable assignment → view/click → confirmed form → minimum evidence → human decision → draft-only challenger`.
12. فعّل Supabase Leaked Password Protection واختبر التسجيل وإعادة تعيين كلمة المرور قبل توسيع التسجيل العام.

## مبادئ التنفيذ

1. الثقة قبل الاتساع: لا نضيف قناة أو صفحة جديدة قبل استقرار المسار الحالي.
2. الأدلة قبل الادعاء: كل KPI أو learning أو claim يحتاج provenance واضحًا.
3. موافقة بشرية قبل النشر أو الإنفاق.
4. الكريديت لا يُخصم مقابل نتيجة غير قابلة للاستخدام.
5. كل تكامل له sandbox، readiness check، token refresh، revoke، وdata deletion.
6. كل مرحلة لها exit criteria قابلة للقياس؛ النجاح البصري وحده لا يكفي.

---

## المرحلة 0 — الثقة والاستقرار التجاري

المدة التقديرية: 1–2 أسبوع.

### نطاق العمل

- إصلاح Strategy OS contract وMarketing Quality Gate ومنع false positives.
- إنشاء eval corpus عربي/إنجليزي لقطاعات متعددة.
- إصلاح دورة Stripe: checkout، webhook، renewal، cancel، refund، monthly grants.
- مواءمة Vercel Functions مع منطقة Supabase.
- توحيد Brand Brain readiness مع truth gate.
- إصلاح accessibility ومسارات feedback الحرجة.
- تحويل lint وtype-check والاختبارات والبناء إلى release gates.

### مؤشرات النجاح

- نجاح الاستراتيجية من أول محاولة: 95% على الأقل.
- نجاح بعد repair واحد: 99% على الأقل.
- P95 لزمن الاستراتيجية: أقل من 60 ثانية، أو progress state صادق للمهام الأطول.
- صفر كريديت مفقود في جميع حالات الفشل وإعادة المحاولة.
- نجاح cron jobs الحرجة: 99.9% خلال 14 يومًا.
- صفر تناقض بين readiness المعروض والبوابة الفعلية.

### بوابة الخروج

- 30 fixture على الأقل عبر العربية والإنجليزية و6 قطاعات.
- دورة فوترة Stripe Test Mode كاملة وموثقة.
- Brand → Strategy تنجح ثلاث مرات متتالية على Production-like environment.
- لا توجد أخطاء P0 أو P1 مفتوحة في هذا المسار.

---

## المرحلة 1 — إثبات رحلة الحملة كاملة

المدة التقديرية: 2–4 أسابيع بعد المرحلة 0.

### نطاق العمل

- Strategy approval مع versioning وdecision history.
- Content Plan بنصوص نهائية قابلة للتحرير، لا مجرد اتجاهات.
- A/B variants مرتبطة بفرضية وsuccess signal.
- Creative briefs وmedia queue مع asset provenance.
- approval workflow للنص والصورة والفيديو والمنصة والموعد.
- تقويم موحّد يعرض draft/approved/scheduled/published/failed.
- exports مطابقة لنفس source of truth.
- retries idempotent وdead-letter/reconciliation للمهام الثقيلة.

### مؤشرات النجاح

- 10 حملات تجريبية كاملة دون تعديل يدوي لقاعدة البيانات.
- 100% من العناصر النهائية لها campaign، owner، approval state، وrevision.
- لا يمكن الجدولة دون approved content وeligible platform readiness.
- إعادة المحاولة لا تنشئ duplicate campaign أو post أو charge.

### بوابة الخروج

- نجاح رحلة Brand → approved Content Plan → approved Creative في 95% من التجارب.
- مراجعة بصرية Desktop/Mobile بلا عناصر وهمية أو حالات مفقودة.

---

## المرحلة 2 — التصاريح والتنفيذ على المنصات

المدة التقديرية: 3–6 أسابيع، حسب مراجعات المزودين.

### ترتيب المنصات

1. Meta/Instagram/Facebook.
2. LinkedIn.
3. TikTok.
4. Google Ads.
5. YouTube.
6. Pinterest.
7. Threads.
8. X.

### العقد التشغيلي لكل منصة

كل منصة يجب أن تنجح في:

`OAuth → account selection → scope verification → token refresh → publish/launch → provider ID → readback → metrics → revoke/delete`

### متطلبات مشتركة

- طلب أقل scopes ممكنة.
- exact redirect URIs لكل بيئة.
- test users/accounts وscreen recordings قابلة للتكرار.
- privacy policy وterms وdata deletion وsupport contact.
- platform-specific content validation قبل الإرسال.
- لا نعتبر الاتصال مؤهلًا بمجرد حفظ token.
- publish reconciliation يثبت providerPostId والحالة النهائية.
- paid launch يحتاج approval منفصل للميزانية والوجهة والتتبع.

### مؤشرات النجاح

- 99% من jobs تنتهي published أو failed بسبب موثّق وقابل للتصرف.
- صفر حالة "published" دون provider ID/readback.
- token refresh/revoke/data deletion مجرّبة لكل مزود.
- كل learning يعتمد على verified provider metrics فقط.

---

## المرحلة 3 — قدرات قسم التسويق الكامل

المدة التقديرية: 6–12 أسبوعًا، على دفعات مستقلة.

### 3.1 CRM وLead Operations

- **منجز كأساس feature-gated:** source/campaign attribution، pipeline stages، deduplication، consent، audit trail، workspace isolation، owner assignment، response SLA، وfollow-up tasks.
- **منجز كأساس feature-gated:** CSV import وhosted public capture forms مع UTM وwrite-only public boundary.
- **منجز كأساس feature-gated:** تنبيهات SLA الداخلية التي تعتمد على deadlines فعلية ولا تطلق outreach.
- **منجز ومختبر على Supabase معزول:** database-enforced tenant coherence يمنع ربط Lead/Form/Lifecycle/Landing/Experiment/Conversion بسياق Workspace أو Campaign آخر، مع فهارس تغطي كل composite foreign key.
- **متبقٍ:** form builder/landing-page blocks أكثر مرونة، والتحقق الحقيقي الاختياري من الهوية/double opt-in بعد مزود موثّق.
- HubSpot/Supabase-native adapter مع فصل provider عن domain model.

### 3.2 Lifecycle Email وSMS

- **منجز كأساس feature-gated:** Drafts لـEmail/SMS بأغراض follow-up/nurture/win-back/double-opt-in، اعتماد نص منفصل عن التسليم، consent eligibility، suppression دائم، وunsubscribe موقّع.
- **حد صريح:** لا يوجد إرسال أو scheduling أو ادعاء verification في هذه المرحلة؛ كل نسخة معتمدة تبقى `DELIVERY BLOCKED`.
- **متبقٍ:** audience segments، journeys متعددة الخطوات، send windows/timezone، idempotent queue، مزود Email/SMS مصرح، وdelivery/bounce/complaint webhooks.
- لا تستخدم رسائل حساب NEXUS كبديل عن رسائل عملاء المستخدم.

### 3.3 Landing Pages وCRO

- **منجز كأساس feature-gated:** campaign-linked structured page blocks، revisions، immutable published snapshot، وثلاث Themes مقيدة.
- **منجز كأساس feature-gated:** hosted forms، UTM passthrough، browser-reported views/clicks، وserver-confirmed form conversion مربوط بالـLead.
- **منجز:** accessibility وDesktop/Mobile visual gate للصفحة العامة وحالة الإغلاق، مع منع HTML/scripts والـclaims غير الموثقة.
- **منجز كأساس feature-gated:** A/B tests بمتغير واحد، توزيع ثابت، decision rule/minimum evidence، decision evidence snapshot، وChallenger يتحول لمسودة تحتاج نشرًا منفصلًا.
- **متبقٍ:** custom domains، media blocks موثوقة، وقياسات أداء Production/Preview الفعلية.

### 3.4 SEO

- **منجز كأساس feature-gated:** SSR لصفحات الحملات، metadata/canonical/Open Graph، `noindex` افتراضي، opt-in صريح، sitemap من النسخة المنشورة، واستبعاد crawlers من التجارب والقياس.
- **منجز:** on-page quality checks إرشادية داخل المحرر للعناوين، شرح العرض، المزايا، وجهة CTA، metadata، snippet fit، واتساق الرسالة، مع فصل صريح بين اكتمال التحرير وبين توقعات ranking/conversion.
- **متبقٍ:** تدقيق الأداء وCore Web Vitals على Preview/Production، custom-domain canonicals، ووسائط اجتماعية موثقة لكل صفحة.
- keyword/topic research بمصادر مؤرخة.
- content briefs وinternal linking وon-page checks.
- Search Console integration عند التصريح.
- لا توجد وعود ranking أو traffic غير مثبتة.

### 3.5 Community وListening

- unified inbox عندما تسمح المنصات.
- reply drafting مع escalation وprohibited-response rules.
- mention/topic monitoring وsentiment كإشارة، لا حقيقة مطلقة.
- response SLA وhandoff إلى support/sales.

### بوابة الخروج

- كل capability لها owner state وdata source وapproval boundary وmeasured outcome.
- يمكن للمستخدم تتبع رحلة lead واحدة من المصدر حتى النتيجة أو سبب الفقد.

---

## المرحلة 4 — القياس والتعلم والتحسين

المدة التقديرية: 4–8 أسابيع، ويمكن بدء أجزاء منها بالتوازي بعد المرحلة 2.

### نطاق العمل

- canonical event taxonomy.
- UTM/campaign/content/ad identity ثابتة.
- attribution واضح: last verified touch كبداية، مع إظهار حدوده.
- experiment registry: hypothesis، variable، audience، minimum evidence، decision rule.
- **منجز لصفحات الهبوط كأساس feature-gated:** hypothesis، single variable، 50/50 افتراضي قابل للضبط، minimum evidence، assignment موقّع، وقرار بشري قابل للتدقيق بلا winner claim.
- learning proposals لا تصبح Brand Brain memory قبل موافقة المستخدم.
- budget recommendations لا تتحول إلى spend دون approval جديد.
- reporting أسبوعي وشهري يفصل facts عن hypotheses.

### مؤشرات النجاح

- 100% من الأرقام المعروضة تحمل source وfreshness وscope.
- لا يُنشأ learning من manual metric على أنه provider-verified.
- يمكن إعادة بناء سبب كل recommendation من evidence ledger.

---

## المرحلة 5 — التوسع والموثوقية المؤسسية

### نطاق العمل

- queue/workflow durable للمهام الثقيلة.
- idempotency keys وretry budgets وdead-letter handling.
- rate limiting موزع وabuse controls.
- SLOs لكل user journey وprovider integration.
- tenant isolation tests وRBAC وworkspace roles.
- observability: traces، structured logs، alerts، business KPIs.
- cost controls لكل AI action وmedia operation وprovider API.
- backup/restore drills وincident runbooks.

### SLOs المستهدفة

- availability للمسارات الأساسية: 99.9%.
- billing webhook processing: 99.99% دون duplicate fulfillment.
- credit ledger reconciliation: صفر فرق غير مفسر.
- RTO/RPO موثقان ومختبران.

---

## Release Gates الثابتة

لا يُنشر أي تغيير إنتاجي ما لم ينجح:

1. `npm run type-check`
2. الاختبارات الموجهة للتغيير.
3. `npm test`
4. lint بلا أخطاء blocking.
5. `npm run build`
6. `npm run db:verify-marketing-migrations` على Postgres disposable في CI عند وجود تغييرات schema/migrations.
7. Preview deployment.
8. browser/API/data verification للرحلة المتأثرة.
9. فحص logs بعد النشر وخطة rollback.

## لوحة قيادة التحول

يتم تتبع هذه الأرقام أسبوعيًا:

- Strategy first-pass success.
- Strategy latency/cost/contract failure reasons.
- Campaign-to-content completion rate.
- Approval turnaround time.
- Publish success/readback rate لكل منصة.
- Qualified lead rate وlead response SLA.
- Checkout/webhook/renewal success.
- Credit reconciliation variance.
- User activation: onboarding → first approved campaign.
- Retention: weekly active workspaces وaccepted learnings.

## تعريف النجاح النهائي

يُسمح بوصف NEXUS بأنه "قسم تسويق كامل" فقط عندما يستطيع مستخدم جديد، دون تدخل داخلي أو تعديل يدوي للبيانات، أن:

1. يبني Brand Brain موثوقًا.
2. يحصل على استراتيجية وحملة قابلة للتنفيذ.
3. ينتج ويعتمد المحتوى والمرئيات.
4. ينشر أو يطلق عبر حساب مصرح.
5. يستقبل lead أو conversion قابلاً للإسناد.
6. يرى قياسًا حقيقيًا وحدوده.
7. يوافق على learning يؤثر في الدورة التالية.
8. يدفع ويجدد ويلغي ويسترد دون تدخل يدوي.
