# تقرير تدقيق NEXUS من الصفر — تجربة مستخدم وخبرة تسويق

**التاريخ:** 12 يوليو 2026  
**البيئة:** الإنتاج — `https://www.nexus-grow.com`  
**سيناريو الاختبار:** Reset Workspace ثم بناء Brand Brain لعيادة أسنان افتراضية في أبوظبي، وإنشاء Strategy، ومراجعة الجودة، وتوليد Content Plan، ثم فحص Creative وPublishing وAutopilot وAnalytics وLearning وOperations وDecisions وIntegrations وBilling والمساعد الداخلي.

## الحكم التنفيذي

NEXUS أصبح منتجًا بصريًا قويًا ومنظمًا، ولديه حدود أمان ممتازة تمنع النشر والصرف والتعلّم الوهمي دون موافقة أو بيانات حقيقية. لكنه **غير جاهز حاليًا ليُباع بوصفه “قسم تسويق ذكي يعمل بدل المستخدم”**؛ السبب ليس نقص الصفحات، بل أن العمود الفقري Brand Brain → Strategy → Content ينقطع عند أهم نقطة: المحتوى الناتج لا يطابق الاستراتيجية، ومع ذلك يُعرض باعتباره “Matched” ويجتاز Quality Review.

**التقييم العام: 4.4 / 10 — Controlled beta، وليس Production-grade autonomous marketing OS بعد.**

أقوى ما في المنتج: الأمان، وضوح حدود التنفيذ، التصميم، وصدق صفحات Analytics/Learning عند غياب البيانات.  
أضعف ما فيه: جودة واتساق المخرجات، تعدد مسارات التشغيل، شفافية الكريدت، وربط حالات التشغيل بين الصفحات.

## بطاقة التقييم

| المحور | الدرجة | الحكم |
|---|---:|---|
| الشكل والفخامة والتنظيم | 8/10 | واجهة Premium ومتسقة بصريًا في أغلب المسارات |
| وضوح تجربة البداية | 5/10 | Brand Brain جيد، لكن به تكرار وأزرار مبكرة وتضارب مع Strategy |
| منطق التشغيل التسويقي | 4/10 | المراحل صحيحة نظريًا، لكن انتقالات الموافقة والتنفيذ غير متماسكة |
| جودة Strategy | 5/10 | منظمة وغنية، لكنها اخترعت Claims وخدمات وتفاصيل غير موثقة |
| جودة Content | 1/10 | المخرجات الأساسية بعيدة تمامًا عن نشاط العيادة والجمهور |
| منع الهلوسة | 3/10 | توجد Guards نصية ممتازة، لكنها لا تمنع الهلوسة الفعلية أو الانحراف الدلالي |
| الشفافية المالية | 3/10 | بعض التأكيدات ممتازة، لكن حدث خصم غير معلن، وصفحة الأسعار متناقضة |
| الموافقات والأمان | 8/10 | لا نشر ولا صرف خارجي دون بوابات صريحة؛ نقطة قوة حقيقية |
| Analytics وLearning | 8/10 | لا توجد أرقام أداء وهمية، والتعلّم مقفول حتى وصول Evidence حقيقي |
| Autopilot وعمليات 24/7 | 4/10 | توجد بنية Monitoring، لكن الحالات والقرارات لا تتطابق بين الصفحات |
| الجاهزية التجارية | 4/10 | يصلح لاختبار مغلق؛ لا يصلح بعد لوعد “يعمل بدل فريق التسويق” |

## النتائج الحرجة

### P0 — المحتوى انفصل كليًا عن Brand Brain والاستراتيجية

Brand Brain كان لعيادة أسنان Premium في أبوظبي، بهدف Consultation bookings وبنبرة Professional / Calm، والاستراتيجية بنت محاور عن العلاج الواضح، تجربة هادئة، والتواصل مع المرضى.

لكن Content Hub ولّد أربع مسودات تتحدث عن:

- “bilingual administrative communication”
- “front desk handoff problem before leadership sees it”
- “request, owner, last update, and next step”
- “review the last five appointments”
- “bring the checklist to your next team meeting”

هذا محتوى B2B لعمليات إدارية داخلية، وليس محتوى عيادة أسنان موجهًا للمرضى. الأخطر أن الشاشة عرضت:

- `Strategy promise match: Matched`
- `Matched: 4 / 4 posts`
- `Quality check complete`

المطابقة الحالية تتحقق من العدد والنوع أكثر من المعنى. هذا يجعل الـGuard يعطي ثقة زائفة بدل أن يمنع الخطأ.

**قرار:** منع اعتماد أو توليد صور أو نشر أي Content Plan لا يجتاز Semantic alignment حقيقي مع Brand Brain وStrategy وAudience وOffer وGoal.

### P0 — ذاكرة المساعد بقيت من Brand قديم بعد Reset

بعد نجاح Reset وبناء Noura Dental Studio، فتح NEXUS Assistant محادثة قديمة تقول إن الإرشادات مخصصة لـ`Reem Hospital`. السبب المؤكد من الكود أن المحادثة محفوظة في Local Storage تحت مفتاح عام:

`nexus_chat_v2`

ولا يتم مسحه في مسار Reset، ولا يبدو أنه Namespaced حسب user/workspace. ثبت في الاختبار تلوث السياق داخل نفس المتصفح؛ وعلى جهاز مشترك قد يتحول هذا إلى خطر خصوصية بين حسابين، ولذلك يجب اعتباره خطرًا عاليًا حتى يثبت العكس.

**قرار:** عند Reset أو Logout امسح ذاكرة المحادثة المحلية، واحفظها تحت مفتاح يحتوي `userId + workspaceId`، ولا ترسل تاريخًا قديمًا إلى API بعد تبديل الحساب أو الـworkspace.

## نتائج P1 — يجب إصلاحها قبل الإطلاق التجاري

### 1. Full Strategy طريق مسدود

اختيار Full وصل إلى الخطوة الرابعة ثم توقف بسبب نقص:

- Conversion destination
- Paid budget
- Lead handling

الرسالة صحيحة، لكن لا يوجد رابط أو نموذج لإكمال المدخلات، والزر الوحيد معطل: `Complete brief inputs first`.

**المطلوب:** زر مباشر `Add paid inputs` يفتح الحقول المطلوبة داخل Brand Brain أو داخل الـmodal، ثم يعيد المستخدم لنفس الطلب دون فقد الاختيارات.

### 2. أول Strategy فشلت بسبب Contract عددي لا بسبب اللغة

طلب Standard كان 16 post directions. النموذج أعاد 4، ففشل backend بالسبب الفعلي:

`contentAnglesDetailed.count: 4/16`  
`weeklyExecutionPlan.deliverableCount: 4/16`

لكن الواجهة قالت إن الناتج لم يطابق اللغة أو review-quality requirements. تم رد الكريدت بأمان، وهذه نقطة جيدة، لكن الرسالة لا تشرح العطل الحقيقي. نجح الاختبار فقط بعد اختيار English وإدخال exact count = 4.

كما أن اختيار Light 8–10 ثم تفعيل exact count أعطى افتراضيًا 12، وقَبِل 4؛ أي أن UI نفسه يسمح بقيمة تناقض مستوى الكثافة.

**المطلوب:** Validation موحّد بين intensity وexact count، وإصلاح prompt/output repair بحيث يكمل العدد المطلوب أو يخفّضه قبل التأكيد، ورسالة خطأ دقيقة للمستخدم.

### 3. Claims غير موثقة في Strategy

Brand Brain لم يحتوِ Proof أو سياسات أسعار أو خدمات أطفال أو تأكيدًا أن الطاقم ثنائي اللغة، لكن Strategy أنشأت Claims مثل:

- “No hidden costs”
- “Transparent pricing ensures no surprises”
- “Clear communication in your preferred language”
- “Family-friendly services”
- “Visit us for a tour”

كما افترضت أدوارًا تشغيلية: receptionist، customer service، marketing team.

وجود سطر “Verified proof is incomplete” لا يكفي إذا كانت المخرجات نفسها تستخدم Claims تحتاج إثباتًا.

**المطلوب:** كل Claim يحمل provenance: `USER_VERIFIED` أو `INFERRED_FOR_REVIEW` أو `HYPOTHESIS`. في القطاعات الصحية، أي Claim عن السعر أو الألم أو النتائج أو اللغات أو الخدمات لا ينتقل إلى Content دون إثبات أو موافقة منفصلة.

### 4. Sentinel Review خصم 2 كريدت دون إظهار السعر على الزر

زر `Review quality` لم يعرض تكلفة. بعد الضغط، خُصم 2 كريدت، ثم ظهر ذلك فقط في Credit History باسم `Sentinel Review -2`.

الأخطر أن Sentinel مرّر Strategy تحتوي Claims غير موثقة، ثم سمح ببناء Content Plan.

**المطلوب:** إظهار `Review quality — 2 credits` قبل الضغط، أو تضمين المراجعة في سعر Strategy كخطوة جودة داخلية. ويجب أن تفشل المراجعة عند وجود unsupported claims أو semantic drift.

### 5. مساران مختلفان لإنشاء نفس المنتج

يوجد مسار Strategy OS من `/strategy`، ومسار آخر من `New Campaign` بعنوان `Generate Platform Content`.

المسار الأول في الاختبار:

- 4 post directions
- Strategy 12 credits
- Sentinel 2 credits
- Content Plan 2 credits
- الإجمالي 16 credits قبل الصور

المسار الثاني يعد بـ:

- 18 posts
- Strategy + angles + execution + content plan
- 8 credits إجمالًا

كما يبدأ المسار الثاني افتراضيًا بـSales وModern وFacebook/Instagram وEnglish، رغم أن Brand Brain كان Leads وProfessional/Calm وFacebook/Instagram/LinkedIn وSmart Mix.

**المطلوب:** مسار واحد فقط للمستخدم. إمّا حذف الـWizard القديم من الواجهة، أو تحويله إلى نفس Strategy Request Engine ونفس Pricing Contract ونفس Approval Contract.

### 6. AI Suggest اخترع دخل الجمهور وخصم كريدت دون إعلان

في الـWizard البديل، AI Suggest للجمهور اخترع:

`annual income exceeding AED 200,000`

وافترض أنهم يعانون حاليًا من ضغوط في عيادات أخرى. هذه البيانات لم تدخل في Brand Brain. تم رفض الاقتراح يدويًا، لكن الرصيد انخفض من 173 إلى 171، ما يطابق تكلفة AD_COPY = 2 credits، دون سعر ظاهر على زر AI Suggest.

**المطلوب:** اقتراح الجمهور يعيد صياغة المدخلات الموثقة فقط، ويضع أي inference كاقتراح منفصل. كل زر AI مدفوع يجب أن يعرض السعر قبل التنفيذ.

### 7. Operations وDecision Center لا يستخدمان نفس الحقيقة

Operations Room عرض:

- `Awaiting approval: 1`
- عنصر `Review draft content`
- رابط `Review decision`

لكن الرابط فتح Decision Center الذي عرض:

- Awaiting decision: 0
- Actionable: 0
- لا توجد أي قرارات

هذا يكسر وعد “one decision queue”.

**المطلوب:** بناء queue واحدة من service/query واحدة، واختبار contract يثبت أن كل عنصر ظاهر في Operations له decision id صالح في Decision Center.

### 8. Content Hub سمّى Organic request بأنه paid-only

قبل وبعد توليد المحتوى ظهر:

`Saved order: paid-only, 90-day planning horizon`

مع أن الاستراتيجية Organic-only وكل صفحات الحملة الأخرى تقول ذلك بوضوح.

**المطلوب:** مصدر واحد لـstrategy type، واختبار regression على Organic/Paid/Full في Strategy وCampaign وContent Hub وCreative وPublish.

## نتائج P2 — تجربة ووضوح وإتاحة

### Brand Brain

- عنوان `Brand Brain` مكرر.
- Dashboard يقول “Complete Brand Brain first”، لكن صفحة Brand تعرض “Start strategy” عند 0%.
- `Save All` نشط قبل وجود بيانات، ومكرر أربع مرات في شاشة المراجعة.
- Next لا يُغلق عند ترك required fields فارغة.
- completeness قفزت بسرعة إلى 50% ثم 90% ثم 100% رغم غياب Proof وPaid inputs وLogo/Colors/Typography.
- maturity ظهر 37% في Modal بعد أن عرضت الصفحة 100% completeness؛ يجب تسمية كل مؤشر بوضوح.
- Industry لا يحتوي Healthcare/Dental واضطر الاختبار لاختيار Health & Beauty.
- tag input يفقد الـlabel بعد أول tag.
- WhatsApp متاح ضمن channels بينما النشر غير مدعوم حاليًا.
- FAQ عن “Early at 100%” يظهر حتى عند 0%.
- Save All نجح دون success toast واضح.
- Create strategy فتح Modal نجاح ثم احتاج ضغطة ثانية، بدل انتقال مباشر.

### Strategy

- الصفحة الفارغة تعرض وثيقة ضخمة مليئة بـ0% وMissing بدل Empty state مركّز.
- زران متكرران لـCreate first strategy.
- أول تحميل يعرض صفحة فارغة بلا skeleton، ثم Modal يومض بحالة Incomplete قبل تحميل 100%.
- Saved inputs = 1 / Missing = 5 رغم Brand Brain 100%، ما يوحي بفقد بيانات.
- Standard 12–16 اختار 16 تلقائيًا دون توضيح لماذا الحد الأعلى.
- الهدف التفصيلي “consultation bookings + trust خلال 90 يومًا” اختُزل في `LEADS` في العناوين.
- `Visit us for a tour` CTA غير منطقي لعيادة دون أن يطلبه المستخدم.

### Content Hub وApproval

- المستخدم استطاع فتح تأكيد توليد المحتوى ودفع الخطوة حتى اصطدم برسالة `Approve the campaign strategy first` بعد التأكيد؛ الـgate يجب أن يظهر قبل modal الكريدت.
- زر Review quality لا يظهر داخل Strategy tab؛ ظهر فقط بعد الانتقال إلى Content & Hooks بسبب شرط UI، وهو المكان الخطأ.
- Approve all drafts يسمح باعتماد المحتوى المنحرف دون تحذير جودة أو Claim check.
- Edit copy textarea بلا label واضح.
- A/B grades مثل A/B تظهر دون شرح rubric أو أثرها.

### Creative

- Studio يقول إن Audience وTone “Missing from Brand Brain” ثم يصححهما بعد تحميل متأخر؛ flash-of-false-state.
- تبويبات Overview/Brief/Templates/Asset library/Placements/Planned tools لا تغيّر المحتوى الظاهر فعليًا بصورة واضحة.
- Studio صفحة preview-only بينما التنفيذ الحقيقي يبدأ من Content Hub، فيشعر المستخدم بوجود مركز إبداعي لا ينفذ.
- LinkedIn قناة مختارة في الحملة لكنها غير ظاهرة في Publishing placements بالـStudio.
- أدوات Planned unavailable كثيرة وتزيد الضوضاء.
- Creative Planner منظم جيدًا، لكنه أعطى score 76 و17 checks passed لمسودة محتواها خاطئ دلاليًا.
- Brand label في Studio draft هو اسم الحملة لا اسم البراند، وCTA الافتراضي `Review next step` ليس CTA للمريض.
- accent color textbox بلا label واضح.

### Publishing وAutopilot

- صفحات النشر ممتازة في حدود الأمان ولا تدّعي نشرًا غير موجود.
- Global Publishing يعرض مرحلة `Scheduled in NEXUS — Saved` كتفسير عام رغم عدم وجود scheduled posts؛ قد تُفهم كحالة فعلية.
- Campaign tab يعرض مؤقتًا “No Content Hub posts exist” قبل اكتمال التحميل، ثم يصحح نفسه إلى 4 posts.
- Autopilot وضع ✓ أمام `Content review complete or explicitly ready` مع وجود 4 drafts و0 approved، ثم قال أسفلها إن content review مطلوب. تناقض مباشر.
- Autopilot عرض أوقاتًا مخططة لمسودات لم تُعتمد؛ مسموح كتخطيط، لكن يجب تسميتها `suggested slots` لا planned schedule.

### Analytics وLearning

- هذه من أفضل أجزاء المنتج: لا توجد Performance أو ROAS مختلقة.
- Analytics يفصل internal activity عن platform outcomes بوضوح.
- Learning يفرق بين workflow signal وperformance evidence بصورة صحيحة.
- Saved workflow event لا يوضح نوع الحدث أو الكيان أو سبب القرار، رغم وصف الصفحة لنفسها بأنها traceable.
- Reset يحافظ على Credit History وAI generation history؛ هذا منطقي ماليًا، لكن يجب أن يقول Reset بوضوح إنه لا يمس ledger أو subscription history.

### Billing

- صفحتان فقط Growth وAutopilot كما هو مطلوب، والـWallet placeholder واضح وصادق.
- `Full campaign generation = 5 cr` يتعارض جذريًا مع التكلفة الحقيقية في المسار الرئيسي (16 قبل الصور).
- `Growth = up to 30 campaign generations` مبني على 5 credits ويصبح تضليلًا مع strategy variable costs.
- يوجد حد Posts/month بجانب Credits دون شرح أيهما يُقفل أولًا وكيف يتفاعلان.
- `No hidden fees` يتعارض مع خصم Sentinel وAI Suggest دون سعر على الأزرار.
- الWallet غير مفعلة، وأزرار Buy disabled؛ البنية موجودة لكن ليست رحلة شراء كاملة.

### Assistant

- بعد Clear chat تظل اللوحة فارغة حتى إغلاقها وفتحها مرة أخرى.
- كل رسالة Chat تكلف 1 credit من backend، لكن الواجهة لا تعرض السعر قرب input أو زر الإرسال.
- System prompt الداخلي يوثق Features قديمة أو أكبر من الواقع: Visuals tab، Content Pack، Execution Package، Sentinel competitor analysis، ووعود نشر مباشر بصياغة مطلقة.
- يجب توليد Platform Knowledge من capability registry حقيقي بدل نص ثابت قديم.

## سجل الكريدت في الاختبار

| الإجراء | السعر الظاهر قبل التنفيذ | الخصم الفعلي | الملاحظة |
|---|---:|---:|---|
| Full strategy blocked | 21 | 0 | لم توجد طريقة لإكمال Paid inputs |
| Bilingual strategy 16 directions | 14 | 0 صافي | فشلت وأُعيد الخصم بأمان |
| English strategy، 4 directions | 12 | 12 | نجحت |
| Sentinel quality review | غير ظاهر | 2 | خصم مخفي على زر Review quality |
| Content plan، 4 drafts | 2 | 2 | تأكيد واضح |
| Campaign audience AI Suggest | غير ظاهر | 2 | اقترح بيانات مختلقة ثم تم رفضها |
| Creative brief | 3 | 0 | تمت مراجعة شاشة التأكيد فقط |
| 4 images | 12 | 0 | لم تُولد لأن المحتوى غير صالح |
| Alternate 18-post campaign | 8 | 0 | تمت مراجعة التأكيد فقط ولم يُنفذ |

الرصيد بدأ 189 وانتهى 171. صافي الاستهلاك 18 credits، منها 4 لم تكن أسعارها ظاهرة على أزرار التنفيذ.

## رحلة التشغيل المقترحة — مسار واحد فقط

1. **Brand Brain**  
   Core brand + offer + audience + voice + channels + visual identity + verified proof + constraints + conversion destination + lead handling + paid budget (اختياري).

2. **Strategy Request**  
   يقرأ الاختيارات المحفوظة افتراضيًا، ويعرض Organic/Paid/Full فقط عندما تكون متطلباتها قابلة للإكمال من نفس الشاشة.

3. **Strategy Generation + Included Quality Gate**  
   سعر واحد ظاهر يشمل generation وclaim validation وsemantic review. الفشل يرد الكريدت تلقائيًا.

4. **Human Strategy Approval**  
   ملخص قرار من صفحة واحدة: goal، audience، positioning، claims needing proof، channels، deliverables، cost of next step.

5. **Content Preview Sample**  
   يولد 1–2 sample posts أولًا. المستخدم يوافق على الاتجاه أو يعدّله، ثم يُنشأ العدد الكامل. هذا يقلل هدر الكريدت وانحراف 18 منشورًا دفعة واحدة.

6. **Content Plan**  
   كل post مرتبط صراحة بـstrategy angle وaudience segment وgoal وclaim provenance. لا تظهر `Matched` إلا بعد semantic score وclaim safety pass.

7. **Creative per Post**  
   يبدأ من post معتمد، ثم Brief → Asset choice → Generation/Composition → Attach. Studio العام يبقى library/overview ولا ينافس المسار الحقيقي.

8. **Approval Queue**  
   Operations وDecisions يعرضان نفس records. Copy approval وMedia approval منفصلان، مع سبب واضح لكل block.

9. **Publish Readiness**  
   account + permission + approved copy + approved media + schedule + final confirmation. لا publish أو spend تلقائي.

10. **Monitor and Learn**  
    Cron/queue تراقب state وreal analytics. أي تعديل Brand Brain يأتي Proposal مع evidence، ولا يُطبق تلقائيًا.

## خطة الإصلاح الموصى بها

### المرحلة 0 — إيقاف التوسع حتى تثبيت النواة

1. إزالة أو إعادة توجيه `/campaigns/new` إلى Strategy OS الموحد.
2. إصلاح content-plan prompt/context وربطه بالـstrategy record الصحيح.
3. إضافة semantic + claim provenance contract قبل حفظ posts.
4. منع Approve All عند فشل semantic/claim checks.
5. إصلاح Reset ليزيل/يعزل Chat local storage.
6. توحيد Operations وDecision Center على queue واحدة.
7. إظهار كل تكلفة قبل كل AI call، بلا استثناء.
8. إصلاح Organic/Paid/Full type propagation عبر كل الصفحات.
9. إضافة Paid inputs editor قابل للوصول من Full strategy blocker.
10. إصلاح strategy output repair للعدد المطلوب واختبارات 4/8/10/12/16/20/30.

### المرحلة 1 — جعل التجربة احترافية وقصيرة

1. Empty states مركزة بدل وثائق مليئة بـMissing و0%.
2. إزالة الأزرار المتكررة وplanned unavailable clutter.
3. عدم إظهار false loading states؛ استخدم skeleton أو `Checking…` فقط.
4. توضيح الفرق بين completeness وmaturity وreadiness وconfidence.
5. توفير Dental/Healthcare industries ومطابقة channels مع capabilities الفعلية.
6. تضمين Sentinel في سعر Strategy أو تقديم سعره صراحة.
7. Sample-first content generation ثم batch generation بعد الموافقة.
8. تسمية كل metric بوضوح: record coverage، semantic match، readiness، أو performance.

### المرحلة 2 — تحقيق وعد 24/7 بصورة حقيقية

1. ربط Accounts وPermissions وMeasurement sources فعليًا.
2. Durable jobs للمراقبة وإعادة المحاولة والـaudit trail.
3. Decision policies قابلة للضبط: suggest-only، approve-before-action، أو bounded automation.
4. Learning proposals مرتبطة بـanalytics evidence، مع rollback وversioned Brand Brain.
5. Wallet وStripe checkout/webhooks/ledger/idempotency، ثم تفعيل Buy buttons.

## شروط Go / No-Go

### No-Go حاليًا لوعد “AI Marketing Department”

لا يجب إطلاق الوعد التجاري الكامل قبل نجاح الحالات التالية:

- 20 رحلة متتالية Brand → Strategy → Content دون semantic drift.
- 100% من AI actions تعرض تكلفة قبل الخصم.
- لا Claims صحية غير موثقة تمر إلى Content أو Creative.
- Operations وDecision Center متطابقان في كل الحالات.
- Reset وLogout يمنعان ظهور أي chat/history من workspace أو user سابق.
- Organic/Paid/Full يظهر بنفس النوع والتكلفة والمخرجات في كل صفحة.
- Content approval لا يمر إذا كان output لا يطابق الهدف والجمهور والعرض.

### ما يمكن إطلاقه الآن

يمكن تقديم المنتج كـ**private controlled beta** مع مستخدمين محدودين، بشرط مراجعة بشرية لكل Strategy وContent وعدم تفعيل نشر أو Autopilot تلقائي حتى إصلاح P0/P1.

## الخلاصة

NEXUS ليس Demo شكليًا؛ هناك أساس حقيقي قوي: تصميم ممتاز، بنية موافقات، Credit ledger، فصل صحيح بين workflow وperformance، وصفحات Analytics/Learning صادقة. لكن القيمة التجارية الأساسية لا تزال غير مستقرة لأن النظام يفهم البراند في Strategy ثم يفقده عند Content، وتوجد محركات ومسارات متعددة لا تتفق على السعر أو المخرجات أو الحالة.

الأولوية الآن ليست إضافة صفحات أو Agents جديدة. الأولوية هي جعل **مسار واحد** ينتج **محتوى صحيحًا**، بتكلفة واضحة، ومصدر حقيقة واحد، ومراجعة تمنع الأخطاء فعلًا. بعد ذلك فقط يصبح Autopilot و24/7 Monitoring وعدًا يمكن الوثوق به وبيعه.

## ملحق فحص الـPreview — 13 يوليو 2026

أُعيد تنفيذ رحلة مستخدم جديد مع حساب QA معزول على Vercel Preview. نجحت رحلة التسجيل الداخلي، Onboarding، إنشاء Workspace، وحفظ Brand Brain لعيادة أسنان بدون تسريب تصنيفها إلى SaaS. كشف الفحص ثلاثة عيوب حرجة قبل الدمج:

1. زر **أنشئ أول استراتيجية** في ملخص Onboarding لم ينتقل إلى `/strategy` رغم أنه ظاهر ومفعّل.
2. طلب الاستراتيجية الافتراضي كان 90 يومًا/قياسيًا بتكلفة 14 كريدت، بينما المستخدم الجديد يملك 10 فقط.
3. الخطة المجانية كانت تقيد المخرجات إلى 3 اتجاهات، بينما عقد الجودة يتطلب 4 اتجاهات و4 أسابيع؛ لذلك كان التوليد يفشل بنيويًا ويُرد الكريدت حتميًا.

الإصلاح المنفذ يجعل CTA رابطًا دلاليًا مباشرًا، ويضبط الطلب الافتراضي على 30 يومًا/خفيفًا بتكلفة 8 كريدت، ويوحد حد الخطة المجانية عند 4 اتجاهات، ويضيف محاولة إصلاح بنيوية واحدة عندما يعيد النموذج عددًا ناقصًا من شرائح الجمهور أو الزوايا أو الأسابيع. كما صُححت حالات الصفحة من «تحتاج مراجعة» إلى «لم تُنشأ بعد» قبل وجود Strategy فعلية.

تمرير هذا الملحق إلى الإنتاج مشروط بإعادة نشر Preview جديد ونجاح نفس رحلة Brand → Strategy الفعلية، لا بالاكتفاء باختبارات المصدر.
