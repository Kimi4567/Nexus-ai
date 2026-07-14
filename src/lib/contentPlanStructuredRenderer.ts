import { guardContentDraftText, type ContentDraftTruthContext } from '@/lib/ai/contentDraftTruthGuard'

export interface ContentPlanRenderContext extends ContentDraftTruthContext {
  brand: string
  campaignName?: string
  keyMessage?: string
  targetAudience?: string
  contentPillars?: string[]
  offer?: string
  platform?: string
  isArabic: boolean
  postIndex: number
}

export interface GeneratedContentPlanPostLike {
  caption?: unknown
  videoCaption?: unknown
  text?: unknown
  imagePrompt?: unknown
  videoScript?: unknown
}

export type ContentPlanSaveGateReason =
  | 'unsupported_clinic_outcome_claim'
  | 'unsupported_absolute_claim'
  | 'unsupported_fake_product_visual'
  | 'malformed_caption'

export interface ContentPlanSaveGateIssue {
  field: string
  reason: ContentPlanSaveGateReason
  match: string
}

export interface ContentPlanSaveGateResult {
  ok: boolean
  issues: ContentPlanSaveGateIssue[]
}

const ARABIC_RE = /[\u0600-\u06ff]/

// A clinic may be either the business being marketed (dentist, medical centre,
// etc.) or the customer of an operations product. The old detector treated any
// healthcare word — and even "bilingual" — as proof that the brand sold clinic
// software. That replaced valid provider copy with unrelated front-desk SaaS
// templates. Require both sides of the classification before using them.
const CLINIC_CONTEXT_RE =
  /clinic|dental|dentist|healthcare|medical|patient|appointment|عياد|أسنان|طبيب|طبي|صحي|مرضى|مريض|مواعيد|رعاية/i

const CLINIC_OPERATIONS_PRODUCT_RE =
  /saas|software|platform|dashboard|workflow|clinicflow|clinic\s+management|practice\s+management|appointment\s+management|patient\s+management|operations?\s+(?:app|system|tool|platform)|(?:app|system|tool|platform)\s+for\s+(?:clinics?|healthcare)|برنامج|منصة|تطبيق|نظام|لوحة\s+تحكم|سير\s+العمل|إدارة\s+(?:العيادات|المراكز|المواعيد|المرضى)|تشغيل\s+العيادات/i

const CUSTOMER_WORKFLOW_PRODUCT_RE =
  /saas|software|platform|workflow|crm|customer\s+(?:request|follow[-\s]?up|management)|lead\s+(?:follow[-\s]?up|management)|sales\s+(?:pipeline|opportunit)|منصة|برنامج|تطبيق|نظام|سير\s+العمل/i

const CUSTOMER_WORKFLOW_DOMAIN_RE =
  /customer|client|lead|sales|pipeline|crm|طلبات\s+العملاء|متابعة\s+العملاء|العملاء|فرص\s+البيع|إدارة\s+المبيعات|متابعة\s+المبيعات/i

const CLINIC_TOPIC_PATTERNS: Array<{ re: RegExp; ar: string; en: string }> = [
  { re: /appointment|schedule|booking|مواعيد|جدولة/i, ar: 'تنظيم المواعيد', en: 'appointment organization' },
  { re: /follow[-\s]?up|متابعة/i, ar: 'متابعة المرضى إداريًا', en: 'administrative patient follow-up' },
  { re: /bilingual|language|communication|تواصل|لغة|ثنائي/i, ar: 'التواصل الإداري ثنائي اللغة', en: 'bilingual administrative communication' },
  { re: /team|staff|فريق|مهام/i, ar: 'تنظيم مهام الفريق', en: 'team task organization' },
  { re: /workflow|operations|عمليات|سير العمل/i, ar: 'وضوح سير العمل الإداري', en: 'administrative workflow visibility' },
]

const UNSAFE_PATTERNS: Array<{ reason: ContentPlanSaveGateReason; re: RegExp }> = [
  {
    reason: 'unsupported_clinic_outcome_claim',
    re: /(?:تحسين|تعزيز|زيادة|رفع)\s+(?:كفاءة|رضا|تجربة|خدمة|رعاية|نتائج)|(?:رضاهم|ثقتهم|رعاية صحية متميزة|مرضى راضين|نتائج أفضل)|(?:improve|boost|increase|enhance)\s+(?:clinic efficiency|patient satisfaction|patient experience|care quality|healthcare outcomes|results)/i,
  },
  {
    reason: 'unsupported_absolute_claim',
    re: /(?:الحل الأمثل|مفتاح النجاح|تحقيق النجاح|يغير منظورك|مضمون|دائمًا|كل مرة|أفضل|مثالي|مثالية|لا تقاوم)|(?:guarantee|guaranteed|ensure|ensures|perfect|best|ultimate|game[-\s]?changer|irresistible|unmatched|extraordinary)/i,
  },
  {
    reason: 'unsupported_absolute_claim',
    // Standalone guarantee verbs only. "يتضمن" means "includes" and is safe.
    re: /(?<![\p{L}\p{M}])(?:تضمن|يضمن|نضمن|أضمن)(?:\s+لك)?(?![\p{L}\p{M}])/iu,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /(?:يظهر\s+على\s+الشاشة\s+واجهة|واجهة\s+(?:إعداد|نظام|منصة|تطبيق|المستخدم)|لوحة\s+تحكم|شاشة\s+(?:تعرض|توضح)|تطبيق\s+\S+\s+(?:على|في)\s+(?:هاتف|جهاز|شاشة)|(?:app|software|product)\s+(?:interface|dashboard|screen)|dashboard\s+(?:showing|displaying)|screen\s+(?:showing|displaying))/i,
  },
]

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function stringifyContextValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(stringifyContextValue).join(' ')
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(stringifyContextValue).join(' ')
  }
  return ''
}

export function isClinicOperationalSaasContent(ctx: ContentPlanRenderContext, _gen: GeneratedContentPlanPostLike = {}): boolean {
  // Product classification must come from user-confirmed Brand Brain facts.
  // Generated copy and strategy prose are not evidence: if the model drifts into
  // "workflow/platform" language for a dental provider, it must not activate the
  // clinic-SaaS renderer and amplify that drift across every post.
  const explicitFacts = stringifyContextValue(ctx.brandFacts ?? [])
  return CLINIC_CONTEXT_RE.test(explicitFacts) && CLINIC_OPERATIONS_PRODUCT_RE.test(explicitFacts)
}

export function isCustomerWorkflowSaasContent(ctx: ContentPlanRenderContext): boolean {
  const explicitFacts = stringifyContextValue(ctx.brandFacts ?? [])
  return CUSTOMER_WORKFLOW_PRODUCT_RE.test(explicitFacts) && CUSTOMER_WORKFLOW_DOMAIN_RE.test(explicitFacts)
}

function inferClinicTopic(ctx: ContentPlanRenderContext, gen: GeneratedContentPlanPostLike): { ar: string; en: string } {
  const primaryText = [
    normalizeText(gen.caption),
    normalizeText(gen.videoCaption),
    normalizeText(gen.text),
    normalizeText(gen.imagePrompt),
  ].join(' ')
  const primaryTopic = CLINIC_TOPIC_PATTERNS.find(pattern => pattern.re.test(primaryText))
  if (primaryTopic) return primaryTopic

  const text = [
    ...(ctx.contentPillars ?? []),
    ctx.keyMessage,
    ctx.campaignName,
    ctx.targetAudience,
  ].join(' ')
  return CLINIC_TOPIC_PATTERNS.find(pattern => pattern.re.test(text)) ?? {
    ar: 'تنظيم العمل الإداري داخل العيادة',
    en: 'clinic administrative workflow review',
  }
}

function platformLabel(platform?: string): string {
  const normalized = (platform ?? '').toUpperCase()
  if (normalized === 'LINKEDIN') return 'LinkedIn'
  if (normalized === 'TIKTOK') return 'TikTok'
  if (normalized === 'YOUTUBE' || normalized === 'YOUTUBE_SHORTS') return 'YouTube Shorts'
  return 'Meta'
}

function renderClinicCaption(ctx: ContentPlanRenderContext, gen: GeneratedContentPlanPostLike): string {
  const topic = inferClinicTopic(ctx, gen)
  const brand = ctx.brand.trim() || (ctx.isArabic ? 'المنصة' : 'the platform')
  const slot = ctx.postIndex % 8

  if (ctx.isArabic) {
    const templates = [
      `إذا ظهرت فوضى ${topic.ar} في نهاية اليوم، لا تبدأ بحل كبير. ابدأ بسؤالين: من سجّل المعلومة؟ ومن راجعها؟ مع ${brand} يمكن تحويل العمل الإداري إلى قائمة تشغيل داخلية قابلة للمراجعة. جرّب تدقيق يوم واحد هذا الأسبوع. #إدارة_العيادات #تشغيل_العيادات`,
      `أكثر نقطة تُرهق فريق الاستقبال ليست الموعد نفسه؛ بل ما يحدث بين الحجز والمتابعة. ارسم مسار متابعة المرضى إداريًا من أول اتصال إلى آخر ملاحظة، ثم حدّد أين تنقطع. ${brand} مناسب لترتيب هذا المسار دون وعود طبية أو نتائج غير مثبتة. اكتب نقطة التعطّل الأولى. #عيادات #تنظيم_العمل`,
      `التواصل الإداري ثنائي اللغة لا ينجح بمجرد ترجمة الرسالة. يحتاج الفريق إلى نسخة واضحة: ما المطلوب، من المسؤول، ومتى تتم المراجعة. استخدم ${brand} كإطار لتنظيم الرسائل الداخلية بالعربية والإنجليزية. اختر نموذج رسالة واحد وراجعه مع الفريق. #تواصل_إداري #عيادات`,
      `قبل أن تضيف حملة جديدة، راجع آخر خمسة مواعيد: هل يوجد سبب واضح للتأخير؟ هل المتابعة مسجلة؟ هل الخطوة التالية مفهومة؟ ${brand} يحوّل هذه الأسئلة إلى مراجعة تشغيلية بسيطة بدل ملاحظات متفرقة. احفظ القائمة وناقشها في اجتماع الفريق. #تشغيل_العيادات`,
      `الاعتماد على الذاكرة يجعل ${topic.ar} هشًا مع ضغط اليوم. اجعل لكل مهمة حالة واضحة: مفتوحة، قيد المراجعة، أو مكتملة إداريًا. مع ${brand} يمكن للفريق رؤية العمل كخطوات لا كرسائل متفرقة. ابدأ بثلاث مهام فقط. #إدارة_العمل #عيادات`,
      `إذا كان الفريق يتنقل بين العربية والإنجليزية، فالغموض يتضاعف عند التسليم بين الزملاء. جرّب قالبًا موحدًا: الحالة، المسؤول، آخر تحديث، والخطوة التالية. ${brand} يساعد على جعل ${topic.ar} أوضح للفريق. راجع قالب التسليم قبل نهاية الأسبوع. #تواصل_إداري`,
      `اجتماع الفريق لا يحتاج كلامًا أكثر؛ يحتاج جدول مراجعة أدق. ما المواعيد التي تحتاج متابعة؟ ما الرسائل المفتوحة؟ وما القرار الإداري التالي؟ استخدم ${brand} لتحويل الاجتماع إلى قائمة مراجعة تشغيلية. اختر بندًا واحدًا وابدأ به. #إدارة_العيادات`,
      `إذا كانت نفس مشكلة ${topic.ar} تتكرر كل أسبوع، فهذا مؤشر أن العملية تحتاج مراجعة لا توبيخًا. في ديمو ${brand} يمكنك رؤية كيف يتحول العمل الإداري إلى خطوات أوضح للفريق. اطلب مراجعة قصيرة لمسار العمل قبل توسيع النشاط التسويقي. #ClinicOps #عيادات`,
    ]
    return templates[slot]
  }

  const templates = [
    `When ${topic.en} gets messy, do not start with a bigger system. Start with two questions: who recorded the information, and who reviewed it? ${brand} can frame that work as a reviewable operating checklist. Pick one clinic day to audit this week.`,
    `The front desk usually feels the handoff problem before leadership sees it. Map the path from booking to follow-up, then mark where the information gets unclear. Use ${brand} to organize the admin workflow without making patient-outcome promises.`,
    `Bilingual admin communication is not only translation. The team needs a shared format: request, owner, last update, and next step. Use ${brand} as a framework for a clearer Arabic/English handoff. Review one message template before the week ends.`,
    `Before adding another campaign, review the last five appointments. Was the next admin step clear? Was follow-up recorded? Was ownership visible? ${brand} turns those questions into a practical workflow review. Bring the checklist to your next team meeting.`,
    `Memory is a fragile operating system for busy clinics. Give each task a simple state: open, under review, or administratively complete. ${brand} helps the team see the work as steps instead of scattered messages. Start with three open tasks.`,
    `If the team moves between Arabic and English, handoff ambiguity compounds quickly. Try one shared format: status, owner, latest note, next admin step. ${brand} can make ${topic.en} easier to review. Test the format on one workflow.`,
    `A better team meeting needs fewer opinions and a sharper agenda. Which appointments need admin review? Which follow-ups are open? What is the next decision? Use ${brand} to turn the conversation into a review checklist.`,
    `If the same ${topic.en} issue appears every week, the process needs review, not blame. In a ${brand} demo, teams can see how admin work becomes clearer steps. Request a short workflow review before scaling the next campaign.`,
  ]
  return `${templates[slot]} #${platformLabel(ctx.platform)}`
}

function renderClinicImagePrompt(ctx: ContentPlanRenderContext, gen: GeneratedContentPlanPostLike): string {
  const topic = inferClinicTopic(ctx, gen)
  const platform = platformLabel(ctx.platform)
  const slot = ctx.postIndex % 6
  const format = platform === 'LinkedIn'
    ? 'wide horizontal 1.91:1 composition'
    : platform === 'YouTube Shorts'
      ? 'vertical 9:16 composition'
      : 'vertical 4:5 composition'
  const scenes = [
    `tidy clinic reception desk with a blank appointment checklist, neutral laptop closed, soft daylight, organized workspace`,
    `clinic operations table with paper notes, calendar pages, pen, and a clean folder for administrative follow-up`,
    `small clinic team reviewing a printed task checklist from a respectful distance, no patient procedure shown`,
    `quiet clinic corridor with signage blurred beyond recognition, organized folders and appointment papers in the foreground`,
    `front-desk workspace prepared for bilingual administrative communication, blank paper forms and neutral devices with screens turned away`,
    `professional healthcare office still life with clipboard, calendar, and color-coded sticky notes for workflow review`,
  ]
  return [
    `${format}; ${scenes[slot]}.`,
    `Create a review-only background visual for ${topic.en}.`,
    'No readable text, no logos, no brand marks, no invented software visuals, no charts, no metrics, no before-after claim, no medical procedure.',
    'Clean premium SaaS marketing style, realistic photography, calm clinical colors, generous negative space for later editable headline and CTA layers.',
  ].join(' ')
}

function renderCustomerWorkflowCaption(ctx: ContentPlanRenderContext): string {
  const brand = ctx.brand.trim() || (ctx.isArabic ? 'المنصة' : 'the platform')
  const facts = stringifyContextValue(ctx.brandFacts ?? [])
  const hasArabicInterface = /واجهة\s+عربية|Arabic\s+interface/i.test(facts)
  const hasFastSetup = /إعداد\s+سريع|fast\s+setup|quick\s+setup/i.test(facts)
  const slot = ctx.postIndex % 8

  if (ctx.isArabic) {
    const templates = [
      'حين تتوزع متابعة العملاء بين الرسائل والجداول، يصعب معرفة آخر تحديث. ابدأ بمراجعة ثلاثة حقول: العميل، المسؤول، والخطوة التالية. ' + brand + ' يساعد على تنظيم هذه المتابعة في مسار أوضح. راجع أسبوعًا واحدًا وحدد أين تنقطع المعلومة. #متابعة_العملاء #تنظيم_المبيعات',
      'قبل إضافة أداة جديدة، ارسم مسار فرصة البيع الحالية: كيف دخل الطلب؟ من يتابعه؟ وما الحالة الآن؟ استخدم ' + brand + ' لتنظيم المسار ومراجعته دون تحويل كل رسالة إلى مهمة منفصلة. احفظ القائمة وجرّبها على خمس فرص قائمة. #فرص_البيع #سير_العمل',
      hasArabicInterface
        ? 'الواجهة العربية لا تعني ترجمة الأزرار فقط؛ قيمتها في أن تكون الحالة والمسؤول والخطوة التالية واضحة للفريق. ' + brand + ' يدعم سير عمل عربيًا لتنظيم طلبات العملاء. راجع تسمية ثلاث حالات قبل اعتمادها. #واجهة_عربية #متابعة_العملاء'
        : 'وضوح اللغة يبدأ من تسمية الحالات والخطوات بطريقة يفهمها الفريق. مع ' + brand + ' يمكن تنظيم طلبات العملاء في مسار قابل للمراجعة. اختر ثلاث حالات واكتب معنى كل حالة قبل التوسع. #سير_العمل #طلبات_العملاء',
      hasFastSetup
        ? 'الإعداد السريع لا يعني تخطي المراجعة. ابدأ في ' + brand + ' بمسار واحد، ومسؤول واحد، وقاعدة واضحة للخطوة التالية. بعد أسبوع، راجع ما نجح وما يحتاج تعديلًا قبل إضافة مزيد من المراحل. #إعداد_سريع #تنظيم_العمل'
        : 'ابدأ بمسار متابعة واحد بدل نقل كل العمل دفعة واحدة. حدّد المسؤول والحالة والخطوة التالية في ' + brand + '، ثم راجع التجربة بعد أسبوع قبل التوسع. #تنظيم_العمل #متابعة_العملاء',
      'ليست كل فرصة بيع جاهزة لنفس الإجراء. قسّم المتابعة إلى: طلب جديد، يحتاج معلومات، قيد المراجعة، وخطوة تالية محددة. ' + brand + ' يساعد على إبقاء هذه الحالات واضحة دون وعود بنتائج غير مثبتة. راجع التعريفات مع الفريق. #إدارة_المبيعات',
      'مراجعة المبيعات الأسبوعية تصبح أوضح عندما يبدأ الفريق من السجل نفسه: ما الذي تغيّر؟ من المسؤول؟ وما الخطوة التالية؟ استخدم ' + brand + ' كمرجع للمتابعة، ثم دوّن أي بيانات ما زالت ناقصة. #مراجعة_المبيعات #وضوح_العمل',
      'إذا لم يكن للطلب مسؤول وخطوة تالية، فهو معرض للنسيان مهما كانت الأداة. اجعل كل سجل في ' + brand + ' يحمل هذين القرارين بوضوح، وراجع السجلات المفتوحة قبل نهاية الأسبوع. #طلبات_العملاء #متابعة_واضحة',
      'عندما تتكرر نفس مشكلة المتابعة، راجع العملية قبل لوم الفريق. اختر نقطة واحدة في مسار العملاء، وثّق حالتها الحالية، ثم جرّب تعديلًا صغيرًا في ' + brand + '. قارن الملاحظات في المراجعة التالية. #تحسين_العمليات #فرص_البيع',
    ]
    return templates[slot]
  }

  const templates = [
    'When customer follow-up is split across messages and spreadsheets, the latest update becomes hard to see. Start with customer, owner, and next step. Use ' + brand + ' to organize one reviewable workflow, then audit a single week.',
    'Before adding another tool, map the current sales opportunity path: how did the request arrive, who owns it, and what is its status? Use ' + brand + ' to keep that path reviewable.',
    'Clear workflow language starts with states the team understands. Use ' + brand + ' to organize customer requests around a small set of defined stages, then review the names before expanding.',
    'Fast setup should not skip review. Start in ' + brand + ' with one workflow, one owner, and one clear next-step rule. Review the first week before adding more stages.',
    'Not every sales opportunity needs the same action. Separate new requests, information gaps, items under review, and confirmed next steps. Use ' + brand + ' to keep those states visible without promising outcomes.',
    'A weekly sales review is clearer when everyone starts from the same record: what changed, who owns it, and what comes next? Use ' + brand + ' as the follow-up reference.',
    'A request without an owner and a next step can be forgotten regardless of the tool. Make those two decisions explicit in ' + brand + ', then review open records.',
    'When the same follow-up issue repeats, review the process before blaming the team. Pick one point in the customer journey and test one small workflow change in ' + brand + '.',
  ]
  return templates[slot] + ' #CustomerFollowUp #SalesWorkflow'
}

function renderCustomerWorkflowImagePrompt(ctx: ContentPlanRenderContext): string {
  const platform = platformLabel(ctx.platform)
  const format = platform === 'LinkedIn'
    ? 'wide horizontal 1.91:1 composition'
    : platform === 'YouTube Shorts'
      ? 'vertical 9:16 composition'
      : 'vertical 4:5 composition'
  const scenes = [
    'small business owner reviewing blank customer follow-up cards on a tidy desk, laptop screen turned away',
    'paper workflow with neutral blank cards for request, owner, status, and next step, no readable text',
    'small team reviewing a printed follow-up checklist, devices closed or screens turned away',
    'organized desk with blank pipeline cards, notebook, and pen, no charts or performance numbers',
    'customer request notes being sorted into neutral color-coded folders, no readable text',
    'weekly review setup with blank checklist sheets and a closed laptop, calm professional workspace',
  ]
  return [
    format + '; ' + scenes[ctx.postIndex % scenes.length] + '.',
    'Review-only background visual for customer follow-up workflow organization.',
    'No readable text, no logos, no brand marks, no visible software UI, no charts, no metrics, no arrows implying growth, and no before-after result claim.',
    'Realistic professional photography, calm neutral colors, generous negative space for later editable headline and CTA layers.',
  ].join(' ')
}

export function renderContentPlanDraftCaption(
  gen: GeneratedContentPlanPostLike,
  ctx: ContentPlanRenderContext,
): string {
  const guardedSource = guardContentDraftText(
    normalizeText(gen.caption) || normalizeText(gen.videoCaption) || normalizeText(gen.text),
    ctx,
  )

  if (isClinicOperationalSaasContent(ctx, gen)) {
    return guardContentDraftText(renderClinicCaption(ctx, gen), ctx)
  }

  if (isCustomerWorkflowSaasContent(ctx)) {
    return guardContentDraftText(renderCustomerWorkflowCaption(ctx), ctx)
  }

  return guardedSource || guardContentDraftText(
    ctx.isArabic
      ? `${ctx.brand || 'علامتك'} — راجع الفكرة الأساسية والخطوة التالية قبل النشر.`
      : `${ctx.brand || 'Your brand'} — review the core idea and next step before publishing.`,
    ctx,
  )
}

export function renderContentPlanDraftImagePrompt(
  gen: GeneratedContentPlanPostLike,
  ctx: ContentPlanRenderContext,
): string {
  if (isClinicOperationalSaasContent(ctx, gen)) {
    return guardContentDraftText(renderClinicImagePrompt(ctx, gen), ctx)
  }

  if (isCustomerWorkflowSaasContent(ctx)) {
    return guardContentDraftText(renderCustomerWorkflowImagePrompt(ctx), ctx)
  }

  return guardContentDraftText(normalizeText(gen.imagePrompt), ctx)
}

export function validateContentPlanDraftForSave(fields: Record<string, unknown>): ContentPlanSaveGateResult {
  const issues: ContentPlanSaveGateIssue[] = []

  for (const [field, raw] of Object.entries(fields)) {
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (field === 'caption' && value.length < 12) {
      issues.push({ field, reason: 'malformed_caption', match: value })
      continue
    }

    for (const pattern of UNSAFE_PATTERNS) {
      const match = value.match(pattern.re)
      if (match?.[0]) {
        issues.push({ field, reason: pattern.reason, match: match[0] })
      }
    }

    if (field === 'caption' && ARABIC_RE.test(value) && /\b(?:Meta|LinkedIn|TikTok|YouTube)\b/.test(value)) {
      continue
    }
  }

  return { ok: issues.length === 0, issues }
}
