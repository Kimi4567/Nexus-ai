# NEXUS AI — Deep New-User Journey & Product Truth Audit

**تاريخ التدقيق:** 22 يوليو 2026  
**النطاق:** الإنتاج `https://www.nexus-grow.com` + مراجعة الكود والاختبارات والاعتمادات  
**نوع التدقيق:** استخدام فعلي كعميل جديد + خبير تسويق + تدقيق UX/Visual + تدقيق هندسي  
**قاعدة العمل:** لم يُصلح هذا التدقيق أي كود أو واجهة. كل ما يلي ملاحظات وأدلة فقط، لتتحول لاحقًا إلى Roadmap مستقلة.

---

## 1) الحكم التنفيذي

**لا، NEXUS لم يصل بعد إلى “شركة تسويق كاملة” قابلة للاعتماد من أول الـonboarding حتى الإنتاج والنشر.**

الوصف الصادق حاليًا هو:

> **Pre-launch AI Marketing OS قوي في جمع سياق البراند، التخطيط العضوي الأولي، صفحات التحويل، CRM، وقياس first-party attribution — لكنه غير جاهز بعد لتسليم Paid أو Full Strategy، ولا يستطيع تمرير Organic من الاستراتيجية إلى المحتوى بسبب بوابة جودة داخلية.**

هذا الحكم لا يرجع إلى غياب تصاريح المنصات فقط. اختبارات المسار توقفت **قبل** بوابة التصاريح في نقاط داخلية:

1. Paid Strategy فشلت مرتين بعد اكتمال الـbrief.
2. Full Strategy فشلت بالطريقة نفسها بسبب مكوّن Paid.
3. ثلاث استراتيجيات Organic أصبحت محجوبة في مراجعة الجودة، اثنتان منها بسبب false positives واضحة من Sentinel/claim guard.
4. نتيجة ذلك: لم يمكن إنشاء Content Plan، ولم يمكن اختبار اعتماد منشور أو جدولة أو نشر من مخرج حقيقي للحملة.

في المقابل، هناك أساس منتج مهم بالفعل:

- الـonboarding وBrand Brain منظمين وشفافين.
- Landing Pages وLead Forms وCRM وUTM attribution تعمل بأرقام صحيحة في الاختبار.
- المنتج لا يدّعي نشرًا أو صرفًا أو نتائج منصة غير موجودة.
- الفوترة التجريبية، الخصم، الاسترداد، وحدود الباقات واضحة نسبيًا وتعمل transactionally.
- lint وtype-check والاختبارات والبناء نجحوا.

### تقدير النضج

هذا **تقدير تدقيق نوعي وليس مقياس أداء تجاريًا**:

| البعد | التقدير | الحكم |
|---|---:|---|
| التصميم والاتساق البصري | 82/100 | احترافي وفاخر إجمالًا مع مشاكل mobile/overlay محدودة |
| سهولة وفهم الرحلة | 72/100 | واضحة في البداية، ثم تتعقد وتتكرر حالات “راجع الجودة” بلا مخرج |
| الصدق وعدم اختلاق التنفيذ | 83/100 | قوي جدًا في عدم ادعاء publish/spend/analytics غير موجودة |
| جودة Organic Strategy | 45/100 | الأعداد غالبًا صحيحة، لكن توجد هلوسات وCTA غير صالحة وتناقضات تكرار |
| Paid Strategy | 10/100 | العقد واضح، لكن لم ينتج أي حزمة في محاولتين فعليتين |
| Full Strategy | 10/100 | فشل قبل إنشاء حملة بسبب مكوّن Paid |
| جودة Sentinel والحماية من الهلوسة | 25/100 | حجب نفيًا صحيحًا وفاته ادعاء فعلي؛ حوّل الحماية إلى blocker للمنتج |
| Landing + CRM + first-party attribution | 87/100 | أفضل جزء تنفيذي في الرحلة الحالية |
| Content → Approval → Schedule → Publish | غير مثبت | تعذّر الوصول إليه بسبب internal quality gate، لا بسبب التصاريح فقط |
| الجاهزية القانونية والتجارية | 35/100 | Sandbox ومحتوى قانوني صريح، لكن لا كيان/اختصاص منشور وتوجد دعوى امتثال متناقضة |
| الصحة الهندسية | 78/100 | البناء والاختبارات سليمة، مع 3 ثغرات High ومخاطر bundle/production config |

**الجاهزية الإجمالية قبل طلب التصاريح: قرابة 49/100.**  
**جاهزية “شركة تسويق كاملة”: غير متحققة.**

---

## 2) منهج الاختبار ونطاق الرحلة

تم إنشاء واستخدام حساب تدقيق جديد باسم **Mariam Hassan** لعلامة تجريبية ثابتة:

- البراند: **Luma Roast Lab**
- العرض: اشتراك 1 كجم شهريًا مقابل 149 درهمًا
- السوق: دبي فقط
- التوصيل: خلال 48 ساعة
- لا خصومات
- لا ضمان نتائج
- لا testimonials أو قصص نجاح
- لا شحن خارج دبي
- لا صلاحيات منصات

تم المرور فعليًا على:

- الصفحة العامة، التسجيل، تأكيد البريد، تسجيل الدخول
- onboarding الكامل
- Brand Brain بكل تبويباته
- Organic / Paid / Full strategy requests
- Campaign Strategy Document وSentinel
- Approvals وContent Hub وCreative Studio وMedia Library
- Calendar / Queue / Publish readiness / Performance
- Paid execution workspace
- Landing Pages وLead Forms
- CRM lifecycle وowner/SLA/tasks/WON
- Analytics وAttribution وLearning
- Connections وOAuth initiation
- Operations / 24/7 monitoring
- Billing وcredit ledger وStripe Sandbox
- Settings والأمان
- Terms / Privacy / Cookies / Refund / Data deletion
- Desktop وMobile للـlanding والـdashboard/navigation

لم تُمنح أي صلاحية منصة، ولم يبدأ إنفاق إعلاني، ولم يُرسل بريد أو SMS، ولم يتم نشر شيء خارجي.

### أدلة بصرية محفوظة

- [Public home — desktop](../../.audit-artifacts/public-home-desktop.png)
- [Dashboard — mobile](../../.audit-artifacts/dashboard-mobile.png)
- [Dashboard navigation — mobile](../../.audit-artifacts/dashboard-mobile-nav.png)
- [Luma landing page — desktop](../../.audit-artifacts/luma-landing-public.png)
- [Luma landing page — mobile](../../.audit-artifacts/luma-landing-mobile.png)

---

## 3) نتيجة كل نوع استراتيجية

| الاختبار | الوعد الظاهر قبل الدفع | الناتج الفعلي | الحساب والمنصات | الحكم |
|---|---|---|---|---|
| Organic — Exact 7 على Trial | 7 مطلوبة، مع إظهار cap التجربة إلى 3 | 3 اتجاهات فعلًا | 1 Instagram + 1 TikTok + 1 LinkedIn | العدد صادق بعد cap، لكن المحتوى به هلوسة وSentinel حجب المسار |
| Organic Light — 30 يوم، عربي | 10 اتجاهات | 10 محفوظة في API | موزعة على Instagram/TikTok/LinkedIn | التوليد نجح بعد فشل أول، لكن contract guard احتسب 8/10 ومنع المراجعة |
| Organic — Exact 3 | 3 اتجاهات | 3 فعلًا | 1 لكل منصة مختارة | العدد صحيح، لكن Sentinel حجب نفيًا صحيحًا وفاته ادعاءات أخرى |
| Paid Basic/Light — 30 يوم | 3 audiences، 4 angles، 9 ad copies، 4 briefs | لا حملة ولا package | محاولتان فاشلتان | **Blocker** |
| Full Standard — 90 يوم | 16 organic directions لأول 30 يوم + Paid package كاملة | لا حملة ولا package | فشل بسبب quality gate المدفوع | **Blocker** |

### ملاحظات الأعداد والتوزيع

- نظام Organic يملك contracts واضحة، وExact 3 نجح عدديًا تمامًا.
- Trial cap ظهر قبل التنفيذ ولم يتخفَّ: طلب 7 أصبح 3.
- Light أنشأ 10 عناصر، لكن الـcontract guard الداخلي قال `8/10` في `weeklyExecutionPlan`، فصار المنتج غير قادر على اعتماد ما عرضه للمستخدم كعشرة مخرجات.
- Frequency المقترحة داخل إحدى الخطط كانت 3 Instagram + 2 TikTok + 1 LinkedIn أسبوعيًا، أي 6 أسبوعيًا، بينما الحزمة نفسها كانت 3 اتجاهات فقط لـ30 يومًا.
- خطة Light عرضت إيقاعًا قريبًا من 7 منشورات أسبوعيًا رغم أن إجمالي وعدها 10 شهريًا.
- توزيع المنصات موجود، لكن منطق funnel في أول استراتيجية جعل مراحله كلها Instagram بينما الخطة الأسبوعية اعتمدت المنصات الثلاث.

**الخلاصة:** العدّ الأساسي تحسن، لكن “العقد العددي” لا يزال غير متماسك عبر كل أجزاء الوثيقة، ولا يكفي أن يكون array واحد صحيحًا إذا كانت الخطة الأسبوعية والفحص النهائي يناقضانه.

---

## 4) Blockers — تمنع تحقيق الوعد الأساسي

### B-01 — Paid Strategy لا تنتج حزمة رغم اكتمال الـbrief

**الشدة: Blocker**

بعد إضافة conversion destination حقيقية واختبار gross margin، أصبح الطلب مسموحًا. الواجهة وعدت بدقة:

- 3 audiences
- 4 ad angles
- 9 ad copies
- 4 creative briefs
- 16 credits
- planning only؛ لا launch/spend/publish

النتيجة في محاولتين مستقلتين:

> «حزمة التخطيط المدفوع لم تجتز فحص جودة النسخ أو البريفات»

لم تُنشأ حملة ولم تُخصم أرصدة، وهذا جيد ماليًا، لكنه يعني أن أحد الأنواع الثلاثة المباعة لا يعمل في سيناريو طبيعي مكتمل.

### B-02 — Full Strategy تنهار بسبب نفس مكوّن Paid

**الشدة: Blocker**

Full Standard 90 يومًا تكلف 46 credit للاستراتيجية وتعد بـ16 اتجاهًا عضويًا لأول 30 يومًا مع الحزمة المدفوعة. بعد انتظار طويل فشلت بنفس رسالة Paid، من دون حملة أو تسليم جزئي.

لا يوجد fallback يحفظ الجزء العضوي ويشرح أن Paid فشل، ولا يوجد output قابل للمراجعة. لذلك Full ليست “partial success” بل non-delivery كامل.

### B-03 — Sentinel يمنع جميع حملات Organic من عبور Content Hub

**الشدة: Blocker**

الحملات الثلاث كلها ظهرت في Approvals على أنها تحتاج مراجعة جودة. في حالتين، Sentinel اعتبر تعليمات منع الادعاء نفسها ادعاءً:

- «لا تدعي أنك الأفضل في دبي»
- «عدم استخدام كلمات مثل نتائج مضمونة»

ثم اقترح استبدالها بصياغة احتمالية مثل «تهدف إلى» أو «قد تساعد»، وهو إصلاح غير منطقي لتعليمات نفي.

لا يوجد human override آمن، ولا تحرير موضعي ثم إعادة فحص محدودة، ولا bypass موثق. لذلك:

- لا Content Plan
- لا Post drafts
- لا copy approval
- لا media approval
- لا schedule
- لا publish

هذا التوقف حدث **قبل** الحاجة إلى صلاحيات المنصات.

### B-04 — المسار الكامل حتى النشر غير قابل للإثبات حاليًا

**الشدة: Blocker على claim “end-to-end”**

صفحات Publish وCalendar وPaid Execution مبنية وتعرض الحدود بأمان، لكن لا يمكن اعتبارها رحلة عاملة حتى تمر حملة حقيقية من:

`Strategy passed → Content generated → Copy approved → Media approved → Scheduled → Provider publish → Analytics → Learning applied`

الحالة الحالية تتوقف عند أول سهم.

---

## 5) Critical / High findings

### C-01 — الحارس فاته ادعاء فعلي بينما حجب النفي الصحيح

**الشدة: Critical**

أمثلة هلوسة أو ادعاءات غير مثبتة لم يمنعها Sentinel:

- «قهوتك تُحمص قبل التوصيل مباشرة» رغم أن الحقيقة المدخلة فقط “محمصة حديثًا”.
- قصص نجاح وتجارب عملاء: «تعرف على قصص نجاح عملائنا»، «استمع إلى تجارب عملائنا»، رغم عدم وجود testimonials وتعليمات صريحة بعدم اختلاقها.
- «تحسين التركيز» واستخدام المكتب/العمل.
- «لزيادة الحصة السوقية في دبي» كهدف/سياق مخترع.
- ألم جمهور مخترع: «عدم معرفة تاريخ التحميص قبل الطلب».
- «اكتشف الفرق» ومفردات جودة غير موثقة.

في المقابل، الـquality gate الأولي سجل `100/pass/no warnings` لإحدى الحزم التي تضمنت قصص نجاح غير موجودة.

### C-02 — Google Ads OAuth مكسور قبل طلب الصلاحية

**الشدة: Critical release blocker**

زر Google Ads كان enabled، لكنه فتح Google OAuth على:

> `Error 400: redirect_uri_mismatch`

الـcallback المرسل كان:

`https://nexus-grow.com/api/social/callback/google-ads`

بينما الواجهة الإنتاجية canonical على `www`. الكود يبني callback من `NEXT_PUBLIC_APP_URL` في:

- `src/app/api/social/connect/google-ads/route.ts`
- `src/app/api/social/callback/google-ads/route.ts`

المشكلة هنا config/code canonical alignment وليست انتظار platform approval.

### H-01 — زمن وفشل التوليد لا يقدمان recovery موثوقًا

**الشدة: High**

- أول Organic Light فشل بعد أكثر من 60 ثانية، ثم نجح retry.
- Rebuild لاحق فشل بعد انتظار مماثل برسالة raw داخلية: `MARKETING_QUALITY_GATE_BLOCKED:unsupported_quality_superlative`.
- Paid فشل مرتين بعد مدد طويلة.
- Full فشل بعد أكثر من 90 ثانية.

الخصم والاسترداد صحيحان، لكن المستخدم لا يحصل على تشخيص قابل للتصرف أو نسخة partial أو historical failure record في الحملة.

### H-02 — Trial promise مضللة بخصوص حجم Organic Light

**الشدة: High — Commercial truth**

صفحة Billing تقول إن التجربة تغطي Organic Light + quality review مقابل 15 credit. لكن Organic Light يعد 8–10 اتجاهات، بينما trial plan يفرض حد 3 مخرجات. الواجهة عند الطلب تكشف cap، لكن وعد الباقة العام يجعل التقييم يبدو أوسع من الحقيقة.

### H-03 — مثال سعة Autopilot مستحيل بسبب post cap

**الشدة: High — Pricing contradiction**

Autopilot يقول:

> «3 رحلات Full Standard إلى المسودات»

التكلفة 55 credit للرحلة؛ 3 × 55 = 165، وهي داخل 180 credit. لكن كل Full Standard يولد 16 مسودة، أي 48 مسودة، بينما الباقة تحدّ المخطط شهريًا إلى 40. الوعد ينجح ماليًا ويفشل في limit آخر.

### H-04 — Privacy تقول “GDPR/CCPA compliant” ثم تنفي الامتثال الشامل

**الشدة: High — Legal trust**

Subtitle العام:

> “GDPR & CCPA Compliant” / «متوافقة مع GDPR وCCPA»

ثم Section 8 يقول صراحة إن النص ليس ادعاء اعتماد أو امتثال شامل. لا ينبغي وجود الادعاء المطلق في العنوان مع هذا النفي.

### H-05 — الكيان القانوني والاختصاص غير منشورين

**الشدة: High قبل commercial launch**

Terms صريحة بأن NEXUS pre-commercial، وأن Stripe Sandbox، وأنه لا توجد جهة متعاقدة/اختصاص/قانون حاكم منشور بعد. هذه شفافية جيدة، لكنها تمنع اعتبار المنتج شركة مكتملة أو إطلاق real-money آمن.

### H-06 — Referral promise موجود بلا نقطة وصول للمستخدم

**الشدة: High — Promise unreachable**

FAQ تعد الطرفين بـ+5 credits، والـAPI والـcomponent موجودان. لكن `ReferralWidget` غير mounted في أي صفحة، ولا يظهر referral URL في Settings أو Billing. الوعد الخلفي غير قابل للاستخدام من الواجهة.

### H-07 — 3 ثغرات High في production dependencies

**الشدة: High — Security**

`npm audit --omit=dev` في 22 يوليو 2026 وجد:

- `fast-uri` — High
- `sharp` — High
- `next` متأثر عبر `sharp` — High

لا توجد Critical حسب التقرير، لكن لا ينبغي الإطلاق التجاري قبل معالجة/تقييم هذه النتائج.

### H-08 — الحملات المتشابهة غير قابلة للتمييز

**الشدة: High UX/Operations**

حملتان تحملان نفس الاسم والوصف والتاريخ والمنصات. قائمة Campaigns وOperations تظهرهما كصفوف شبه متطابقة، ولا تعرض سبب الإنشاء أو scope/count أو “quality blocked” بوضوح في القائمة.

### H-09 — المساعد غير واعٍ بما يكفي بحالة الـworkspace

**الشدة: High product intelligence**

عند سؤاله عما يستطيع فعله بلا تصاريح:

- كان صادقًا بشأن عدم النشر أو الصرف.
- لكنه قال إنه لا يمكن التحقق من أي أداء، رغم وجود visits/forms/WON/UTM first-party حقيقية.
- لم يذكر Landing Pages أو Lead Forms أو CRM أو attribution الموجودة بالفعل.
- استخدم اسم “Strategy Studio” القديم.
- لم يذكر أن الحملات الثلاث blocked في الجودة.

### H-10 — الصفحة العامة تَعِد بمسار لا يستطيع المنتج تسليمه الآن

**الشدة: High — Marketing truth**

الصفحة العامة صادقة في أن النشر مشروط بالصلاحيات، وصادقة أن الوكالة الكاملة تأتي بعد صلاحيات وبيانات. لكن عبارات “استراتيجية كاملة” و“كل منشور يدخل Content Hub” لا تتفق مع:

- فشل Paid وFull.
- حجب Organic قبل Content Hub.

الحل المستقبلي ليس حذف الوعد بالضرورة؛ بل عدم عرضه كحقيقة تشغيلية قبل أن ينجح golden path فعليًا.

---

## 6) Medium / UX / Visual findings

### M-01 — Readiness labels لا تستخدم نفس تعريف الجاهزية

- onboarding قال “Organic ready” قبل اكتمال حقل voice المطلوب.
- Brand Brain قال “Paid brief complete” بعد budget فقط، بينما الطلب لاحقًا منع التنفيذ لغياب conversion destination وgross margin.
- Brand Brain 100% يعني اكتمال context، لكنه قد يُفهم على أنه جاهزية تسويقية كاملة رغم غياب proofs/connections/performance.

### M-02 — لغة “أول استراتيجية” stale

بعد وجود عدة حملات، ما زالت modal تقول:

- «إنشاء أول استراتيجية»
- «أول طلب استراتيجية»

### M-03 — Consumer CTAs تحتوي لغة داخلية

أمثلة:

- «راجع الأدلة قبل الخطوة التالية»
- «قارن التفاصيل الموثقة»

هذه تعليمات audit/operations وليست CTA عميل قهوة.

### M-04 — Creative requirements تفترض أصولًا غير موجودة

الاستراتيجية تطلب صور عملية التحميص وفيديوهات التوصيل رغم عدم رفع هذه الأصول. يجب أن تظهر كـasset request لا كأنها ready direction.

### M-05 — Operations تستخدم “Campaigns in motion” لثلاث حملات blocked

الصفحة نفسها توضح لاحقًا أن الثلاث في Strategy Review، و0 scheduled. عبارة “in motion” أكبر من الحالة الفعلية.

### M-06 — روابط Operations ذاتية بلا أثر

روابط مثل “Details” و“Open evidence” لبعض monitor items تعيد إلى `/operations` نفسه بلا anchor أو انتقال مرئي.

### M-07 — failed Paid/Full runs لا تظهر في ledger تشغيلي للمستخدم

لا يوجد خصم، وهذا صحيح، لكن لا يوجد سجل طلب فاشل بصفر charge يشرح الوقت والسبب. كذلك rebuild عضوي ظهر في Credit Ledger باسم عام “Full marketing strategy”، وهو وصف غير مطابق للعملية.

### M-08 — OAuth loading state لا يعود بعد الرجوع

بعد فتح Meta/LinkedIn/TikTok OAuth ثم الرجوع من دون منح الصلاحية، يظل زر المزود disabled حتى reload.

### M-09 — Cookie banner يحجب جزءًا من التجربة

- Desktop: يغطي جزءًا من hero/CTA في الـlanding.
- Mobile 390px: يحتل قرابة ثلث الشاشة السفلية ويحجب جزءًا من benefit card.
- المشكلة موجودة أيضًا على الصفحة العامة بدرجة أقل.

### M-10 — Mobile navigation تقطع آخر العناصر

المنطقة السفلية sticky الخاصة بالبروفايل/الخطة تتداخل بصريًا مع آخر روابط الـnavigation قرب Connections.

### M-11 — Accessibility gaps

- أزرار overflow في Campaigns بلا accessible label.
- يوجد زر غير مسمى داخل assistant panel.
- أيام Calendar الفارغة تبدو كأزرار، لكن click لا يعطي أي feedback.
- بعض الأزرار الرمزية تعتمد على الشكل وحده.

### M-12 — نسق canonical/domain غير موحد

- الإنتاج يستخدم `www.nexus-grow.com`.
- canonical/sitemap وبعض fallback URLs تستخدم `nexus-grow.com` ثم 307 إلى `www`.
- Landing canonical يمر عبر redirect.

### M-13 — A/B experiments ظاهر لكنه غير تشغيلي

زر التجارب موجود ثم يعلن أن experiments مغلقة operationally حتى migration/Preview. الشفافية جيدة، لكن إظهار feature غير قابلة للاستخدام يزيد ضوضاء المنتج قبل اكتمال الأساس.

### M-14 — Surface duplication / legacy naming

هناك صفحات مباشرة ليست في الـprimary navigation أو أسماء قديمة:

- `/publish`
- `/paid-campaigns`
- `/automation` الذي يعرض Operations Center
- `/studio` preview-only
- legacy agent labels مثل NEX/VEX/PULSE/Sentinel في القانون وبعض copy

ليست كلها أخطاء، لكن model المستخدم للرحلة يجب أن يكون واحدًا وواضحًا.

### M-15 — حجم بعض client bundles مرتفع

بناء الإنتاج نجح، لكن أكبر First Load تقريبًا:

- Campaign detail: 428 kB
- Campaign Content Hub: 360 kB
- Strategy: 335 kB
- Brand: 300 kB

هذا يستحق performance profiling قبل توسع الاستخدام، خصوصًا للموبايل والشبكات الأبطأ.

---

## 7) ما الذي عمل جيدًا فعلًا؟

### Onboarding وBrand Brain

- خمس خطوات واضحة.
- كل اختيار تم اختباره وظهر صحيحًا في summary.
- النص يشرح أنه لا يوجد generation/publish/spend أثناء الإعداد.
- facts وevidence منفصلان، ولا تتم ترقية claim إلى verified proof تلقائيًا.
- حفظ الـconversion destination من landing page عمل.

### Landing / Lead / CRM / Attribution

هذه أقوى رحلة مثبتة end-to-end قبل التصاريح:

1. إنشاء Lead Form.
2. إنشاء Landing Page ونشر v1 مع `noindex`.
3. زيارتان فعليتان.
4. CTA click مرتان.
5. form submissions مرتان.
6. direct + Instagram/organic UTM ظهر كل منهما 1/1.
7. تكرار نفس البريد تم deduplicate إلى Lead واحدة مع `FORM_RECAPTURED` events.
8. تعيين owner وSLA.
9. NEW → CONTACTED → OPPORTUNITY → WON.
10. تسجيل 149 AED.
11. first-touch attribution نسب WON إلى direct/unknown، وهو الصحيح لأن أول capture كان direct.
12. Learning رفض الاستنتاج السببي لقلة العينة وأظهر `causalClaim=false`.

هذه رحلة موثوقة ومتماسكة جدًا مقارنة ببقية المنتج.

### Billing / Credits

- كل تكلفة تظهر قبل التنفيذ.
- Trial cap ظهر قبل الدفع.
- فشل Paid/Full لم يخصم.
- فشل rebuild استرد 12 credit بتسجيل REFUND صريح.
- Sandbox واضح ولا يوهم بمال حقيقي.
- الرصيد النهائي والمحاسبة اتسقا بعد reload.

### Publishing truth

صفحة `/publish` ممتازة في الصدق:

- 0 connected accounts
- 0 confirmed media
- 0 NEXUS schedule records
- 0 provider-confirmed publishes
- لا يتم احتساب manual record كـprovider proof
- لا learning loop قبل publish + analytics + accepted proposal في نفس الحملة

### Paid execution safety

صفحة `/paid-campaigns/new` لا تسمح بإنشاء مسودة مستقلة. كل Organic strategies ظهرت disabled، ويجب اختيار approved Paid/Full source. وتفصل بين:

- strategy source
- budget
- execution
- ad copy
- review
- paused draft
- activation confirmation

هذا تصميم تشغيل صحيح، رغم أن المصدر المطلوب لا يمكن توليده حاليًا.

### Engineering controls

- `npm run lint` — Pass
- `npm run type-check` — Pass
- `npm test` — Pass
- `npm run build` — Pass
- 131 static pages، 292 API routes، 73 `page.tsx`
- Auth/workspace scoping ظاهر في المسارات الأساسية.
- Cron routes تستخدم `cronAuthError`.
- OAuth state/nonce موجودان.
- OAuth tokens مشفرة.
- Billable AI rate limits وcredit reservation/refund logic موجودة.

---

## 8) تحليل السبب من الكود

### Sentinel false positive بالعربية

`src/lib/ai/claimGuard.ts` يحتوي `isNegatedSafetyInstruction()`، لكنه يغطي صيغًا مثل:

- لا / لن / ليس / بدون / تجنب / يجب ألا

ولا يغطي بوضوح prefix مثل:

- «عدم استخدام…»

لذلك `نتائج مضمونة` داخل جملة المنع تبقى finding وتتحول إلى `needs_attention`.

### Paid/Full quality gate شديد الاتساع

`src/lib/ai/marketingQualityGate.ts` يعتبر كلمات مثل:

- premium
- high quality
- perfect
- فاخر / فاخرة
- عالية الجودة

`unsupported_quality_superlative` blockers إن لم توجد proof حرفية. هذا منطقي كتحذير، لكنه يتحول حاليًا إلى فشل كامل للحزمة بدل إصلاح/خفض ادعاء/إرجاع output قابل للمراجعة.

### الحماية Pattern-based ولا تفهم كل أنواع الهلوسة

الحارس ممتاز في أرقام ونسب وضمانات وصيغ معينة، لكنه لا يكتشف semantic drift مثل:

- “recently roasted” → “roasted immediately before delivery”
- اختلاق testimonial بلا كلمات النمط المحددة
- اختلاق audience pain أو workplace use
- CTAs داخلية وغير ملائمة للمستهلك

### Unit tests تمر رغم فشل السيناريو الحقيقي

نجاح test suite لا يعني نجاح production strategy quality. الـgolden evals الحالية لا تغطي هذا المزيج الواقعي بما يكفي:

- Arabic negated prohibited claim
- coffee brand بلا testimonials/proof
- Paid package كاملة على brand minimal evidence
- Full partial-delivery/failure recovery

---

## 9) مقارنة بالسوق — ما معنى “شركة تسويق كاملة” عمليًا؟

### معيار منصات Social Operations

- Hootsuite يجمع scheduling/publishing، paid + organic calendar، approvals متعددة الطبقات، history، permissions، analytics، listening، وinbox.
- Sprout Social يوفر multi-step/multi-user approvals، external approvers، notifications، calendar/drafts/rejected/failed posts، asset library، publishing، analytics، listening، engagement وroles.
- Buffer يوفر drafts → approval → queue/schedule، comments/notes، channel permissions، calendar موحد، sent/failed states، analytics وتقارير.

المصادر الرسمية:

- [Hootsuite approvals](https://www.hootsuite.com/platform/social-media-approval-tool)
- [Hootsuite publishing](https://www.hootsuite.com/platform/publishing)
- [Sprout approval workflows](https://support.sproutsocial.com/hc/en-us/articles/205974715-Message-Approval-Workflows)
- [Sprout publishing](https://support.sproutsocial.com/hc/en-us/articles/360000576466-Introduction-to-Publishing)
- [Buffer approvals](https://support.buffer.com/article/665-managing-and-approving-draft-posts)
- [Buffer collaboration](https://buffer.com/collaborate)

### معيار Campaign/CRM/Attribution

HubSpot يربط campaign واحدة بـlanding pages/forms/email/social/ads/tracking URLs/reporting وmulti-touch attribution. NEXUS يملك جزءًا مهمًا من هذا في Landing + CRM + UTM، لكنه لا يزال بلا lifecycle sending live ولا multi-channel campaign asset execution مثبت.

- [HubSpot campaign workflow](https://www.hubspot.com/running-a-campaign-in-hubspot)
- [HubSpot campaign assets](https://knowledge.hubspot.com/campaigns/understand-campaigns)
- [HubSpot attribution/reporting](https://www.hubspot.com/products/marketing/advanced-marketing-reporting?build=website)

### معيار Brand-aware AI

Jasper يركز على Brand Voice/Guidelines، رفع أمثلة، preview مقارنة with/without voice، وإنتاج channel-specific social/ad/content. NEXUS لديه evidence-first Brand Brain أقوى في بعض جوانب الصدق، لكنه يحتاج ثباتًا أعلى في تحويل هذا السياق إلى copy خالية من الاختلاق.

- [Jasper Brand Voice](https://help.jasper.ai/hc/en-us/articles/18618693085339-Brand-Voice)
- [Jasper social campaign agent](https://www.jasper.ai/agents/social-media-campaign)

### الفجوة مع وكالة بشرية متكاملة

الوكالة الكاملة لا تساوي generator. يلزم إثبات تشغيلي في:

1. discovery وbrief وmarket research
2. positioning وoffer design
3. organic content system
4. real creative production
5. media planning/buying/optimization
6. landing/CRO
7. CRM/lifecycle/outreach
8. community management/inbox
9. reporting/attribution/learning
10. account management، approvals، SLA، client communication

NEXUS قوي أو واعد في 1، 2، 6، 7، 9.  
غير مثبت في 3 و4.  
متعطل في 5.  
ولا يقدم حاليًا 8 أو طبقة client/account-management بمستوى وكالة بشرية كاملة.

---

## 10) Promise vs Delivery

| الوعد | ما تم إثباته | الفجوة |
|---|---|---|
| Brand Brain موثوق | facts/evidence separation جيدة | readiness labels غير موحدة |
| Organic strategy | output count نجح في سيناريوهين | هلوسة + frequency contradictions + Sentinel blocker |
| Paid strategy | brief gates والتكلفة واضحة | لا output بعد محاولتين |
| Full strategy | العقد والتكلفة واضحان | لا output؛ لا partial save |
| Content Hub | الواجهة والبوابات موجودة | لا يمكن الوصول من أي حملة audit |
| Creative production | preview وMedia Library موجودان | لا final asset journey مثبتة |
| Publishing | readiness truth ممتاز | لا real post وصل للبوابة |
| Ads execution | paused-draft safety جيدة | لا approved Paid/Full source؛ Google OAuth مكسور |
| Leads/CRM | رحلة كاملة ومثبتة | لا outreach/lifecycle sending live |
| Attribution | direct + UTM + first-touch WON صحيحة | sample صغير؛ platform attribution غير متاح قبل permissions |
| Learning | رفض الاستنتاج المبكر صحيح | لا closed loop من منشور منصة |
| 24/7 Operations | heartbeat أصبح Healthy أثناء التدقيق | labels وروابط self-link تحتاج ضبطًا، ولا active automation |
| Full agency/company | FAQ تقر بأن التصاريح والبيانات مطلوبة | core strategy/content path نفسه غير مستقر قبل التصاريح |

---

## 11) حدود ما تم اختباره وما لم يتم إثباته

لم يتم اختبار الآتي لأن المتطلبات الخارجية أو المسار السابق لم تكن متاحة:

- نشر فعلي على Meta/TikTok/LinkedIn/YouTube/X/Pinterest/Threads.
- إنشاء paused ad draft حقيقي أو تفعيله.
- صرف ميزانية أو مزامنة spend.
- استيراد analytics من المنصات.
- learning proposal مبنية على provider analytics.
- إرسال lifecycle email/SMS أو community replies.
- upload production asset واستخدامه في منشور نهائي؛ Media Library نفسها عُرضت وفُحصت فقط.
- حذف الحساب النهائي؛ المتاح في Settings هو workspace reset، والحذف يُطلب عبر privacy/data-deletion process.

هذه ليست نجاحات مؤجلة؛ هي **Unverified** ويجب ألا تدخل في claim الجاهزية حتى تمر Pilot حقيقية بعد التصاريح.

---

## 12) قائمة ملاحظات جاهزة للتحويل لاحقًا إلى Roadmap

هذه ليست خطة تنفيذ الآن، بل تجميع نطاق العمل حسب الأثر:

### Must fix before requesting/using platform permissions

- إصلاح Paid وFull golden path.
- إصلاح Sentinel Arabic negation والـfalse positives.
- إضافة real semantic hallucination evals للـtest brand.
- جعل Organic واحدة على الأقل تعبر إلى approved content plan كامل.
- إصلاح Google Ads redirect URI.
- معالجة 3 High dependency vulnerabilities.
- توحيد canonical على www/non-www.
- إزالة GDPR/CCPA absolute compliance claim.
- تصحيح pricing capacity وTrial promise.
- إظهار referral link أو إزالة الوعد مؤقتًا.
- تسمية campaign runs بأسماء/IDs مفهومة وإظهار blocked reason في portfolio.

### Must prove before saying end-to-end Marketing OS

- 1 campaign من كل نوع: Organic / Paid / Full.
- exact deliverable contract pass لكل نوع.
- Content Plan + Copy approval + Media approval.
- Scheduling state transitions وحالات الفشل/retry.
- provider-confirmed publish.
- analytics readback.
- learning proposal accepted + rollback evidence.
- credit ledger متطابق مع كل نجاح/فشل/استرداد.

### Needed before claiming “complete marketing company”

- تعريف صريح لنطاق الشركة: ما الذي تغطيه وما لا تغطيه.
- team/client roles وapproval comments/history/notifications.
- client-facing reporting/export/SLA/account ownership.
- community management أو إعلان واضح أنه خارج النطاق.
- lifecycle/outreach live أو إعلان واضح أنه drafts only.
- legal entity، jurisdiction، governing law، live billing readiness.
- human escalation/review model للحالات التي لا يحسمها AI بأمان.

---

## 13) Evidence appendix

### Campaign IDs

- `cmrvoumvw000c5b1wlo4u5fk0` — Trial Organic Exact 7 → capped to 3
- `cmrvpbesv000b11630i1gp02r` — Organic Light 10، contract guard 8/10، rebuild failed/refunded
- `cmrvq9ldp000ejk5hwbtx2gxu` — Organic Exact 3، Sentinel false positive

### Public conversion assets

- Landing: `https://www.nexus-grow.com/lp/961680e9-4644-4c32-b26c-0e5476ed4420`
- Lead form: `https://www.nexus-grow.com/lead-form/cf8880ba-ebb1-4e5e-9f3c-fd7295d1b09f`

### Conversion evidence at end of test

- 2 visits
- 2 CTA clicks
- 2 form submissions
- 1 deduplicated lead
- 1 WON
- 149 AED recorded revenue
- direct/unknown: 1 view / 1 form / 1 first-touch WON
- instagram/organic `luma_organic`: 1 view / 1 form / 0 first-touch WON

### Credits

- Current balance: 152/180
- Operations ledger at final check: 43 settled spend / 12 explicit refund
- Paid/Full failed attempts: no debit
- Stripe: Test/Sandbox only

### Build and package evidence

- lint: Pass
- type-check: Pass
- tests: Pass
- build: Pass
- build warning: Edge runtime disables static generation for an affected page
- production dependency audit: 3 High, 0 Critical

---

## 14) Final audit conclusion

NEXUS ليس demo شكليًا؛ فيه بنية حقيقية، ضوابط مالية، CRM وتحويل وقياس صادق، وواجهة أقرب لمنتج SaaS احترافي من أداة AI بسيطة. لكن “شركة التسويق” تقاس بقدرتها على تسليم النتيجة باستمرار، لا بعدد الصفحات أو الوكلاء المسماة.

اليوم، أفضل ما يمكن قوله بلا مبالغة:

> **NEXUS منصة pre-launch واعدة لإدارة سياق البراند، التخطيط التسويقي الأولي، التحويل والـCRM والقياس الأولي. ليست بعد شركة تسويق كاملة، لأن Paid وFull لا يُسلّمان، وOrganic لا يعبر إلى الإنتاج، والنشر والتعلم من المنصات غير مثبتين.**

طلب التصاريح الآن لن يحل الأعطال الأساسية. الصحيح أن يصبح المسار الداخلي قابلًا للإعادة والاعتماد أولًا، ثم تُستخدم التصاريح لإثبات آخر 20% من الرحلة: provider publishing، platform analytics، وclosed-loop learning.
