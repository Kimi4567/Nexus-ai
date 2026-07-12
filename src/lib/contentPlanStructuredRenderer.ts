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
    re: /(?:الحل الأمثل|مفتاح النجاح|تحقيق النجاح|يغير منظورك|يضمن|تضمن|مضمون|دائمًا|كل مرة|أفضل|مثالي|مثالية|لا تقاوم)|(?:guarantee|guaranteed|ensure|ensures|perfect|best|ultimate|game[-\s]?changer|irresistible|unmatched|extraordinary)/i,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /(?:واجهة\s+(?:تطبيق|المستخدم)|لوحة\s+تحكم|شاشة\s+(?:تعرض|توضح)|تطبيق\s+\S+\s+(?:على|في)\s+(?:هاتف|جهاز|شاشة)|(?:app|software|product)\s+(?:interface|dashboard|screen)|dashboard\s+(?:showing|displaying)|screen\s+(?:showing|displaying))/i,
  },
]

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function contextText(ctx: ContentPlanRenderContext, gen: GeneratedContentPlanPostLike): string {
  return [
    ctx.brand,
    ctx.campaignName,
    ctx.keyMessage,
    ctx.targetAudience,
    ctx.offer,
    ...(ctx.contentPillars ?? []),
    normalizeText(gen.caption),
    normalizeText(gen.videoCaption),
    normalizeText(gen.text),
    normalizeText(gen.imagePrompt),
  ].join(' ')
}

export function isClinicOperationalSaasContent(ctx: ContentPlanRenderContext, gen: GeneratedContentPlanPostLike = {}): boolean {
  const text = contextText(ctx, gen)
  return CLINIC_CONTEXT_RE.test(text) && CLINIC_OPERATIONS_PRODUCT_RE.test(text)
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
