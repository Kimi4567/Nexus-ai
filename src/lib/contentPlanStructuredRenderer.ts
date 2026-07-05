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

const CLINIC_CONTEXT_RE =
  /clinic|healthcare|medical|patient|appointment|follow[-\s]?up|bilingual|عياد|طبي|صحي|مرضى|مريض|مواعيد|متابعة|رعاية|ثنائي اللغة/i

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
  return CLINIC_CONTEXT_RE.test(contextText(ctx, gen))
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
  if (normalized === 'YOUTUBE') return 'YouTube'
  return 'Meta'
}

function renderClinicCaption(ctx: ContentPlanRenderContext, gen: GeneratedContentPlanPostLike): string {
  const topic = inferClinicTopic(ctx, gen)
  const brand = ctx.brand.trim() || (ctx.isArabic ? 'المنصة' : 'the platform')
  const slot = ctx.postIndex % 8

  if (ctx.isArabic) {
    const templates = [
      `عندما تتكرر ملاحظات ${topic.ar}، ابدأ من طريقة تسجيلها لا من حملة أكبر. ${brand} يساعد الفريق على تحويل العمل الإداري إلى خطوات يمكن مراجعتها بهدوء. راجع خطوة واحدة هذا الأسبوع. #إدارة_العيادات #تشغيل_العيادات`,
      `اسأل فريق الاستقبال: أين تضيع المعلومة بين الموعد والمتابعة؟ استخدم ${brand} كمساعد تشغيلي لترتيب ${topic.ar} دون وعود طبية أو نتائج غير مثبتة. اكتب نقطة التعطّل الأولى. #عيادات #تنظيم_العمل`,
      `${topic.ar} لا يحتاج إلى وعود كبيرة؛ يحتاج إلى قائمة واضحة: ما الذي تم تسجيله، من يراجعه، ومتى يعود الفريق له. ${brand} يحوّل هذه الأسئلة إلى مسار عمل قابل للفحص. جرّب مراجعة يوم واحد. #إدارة_العيادات`,
      `في العيادات الصغيرة، التفاصيل الإدارية الصغيرة تصنع فرقًا في وضوح اليوم. ${brand} يساعدك على ترتيب ${topic.ar} كمهام داخلية لا كوعود أداء. ابدأ بمراجعة آخر خمسة مواعيد. #تشغيل_العيادات`,
      `بدل الاعتماد على الذاكرة، اجعل ${topic.ar} جزءًا من روتين الفريق اليومي. ${brand} يقدّم طريقة منظمة لعرض المهام والمراجعات دون ادعاء نتائج علاجية. احفظ قائمة الفحص وراجعها مع الفريق. #إدارة_العمل`,
      `إذا كان الفريق يعمل بالعربية والإنجليزية، فوضوح ${topic.ar} يحتاج صياغة يفهمها الجميع. ${brand} يساعد على ترتيب نقاط المتابعة الإدارية بلغة أوضح. اختر نموذج رسالة واحد وراجعه. #عيادات #تواصل_إداري`,
      `اجعل اجتماع الفريق أقصر وأكثر تحديدًا: ما المواعيد التي تحتاج مراجعة؟ ما المتابعة المفتوحة؟ وما الخطوة التالية؟ ${brand} يساعد في تنظيم ${topic.ar} كمسار إداري واضح. #إدارة_العيادات`,
      `قبل أي نشاط تسويقي جديد، تأكد أن ${topic.ar} داخل العيادة واضح للفريق. ${brand} يساعد على ترتيب الأساس التشغيلي حتى لا تتحول المتابعة إلى ملاحظات متفرقة. ابدأ بتوثيق خطوة واحدة. #تشغيل_العيادات`,
    ]
    return templates[slot]
  }

  const templates = [
    `When ${topic.en} gets messy, start with how the team records the work. ${brand} helps turn admin tasks into reviewable steps. Pick one workflow to review this week.`,
    `Ask the front desk where information gets lost between booking and follow-up. Use ${brand} to organize ${topic.en} without implying medical outcomes or performance promises.`,
    `${topic.en} does not need a bigger promise. It needs a clear checklist: what was recorded, who reviews it, and when the team returns to it. ${brand} helps frame that workflow.`,
    `For small clinics, daily admin details matter. ${brand} helps structure ${topic.en} as internal operating work, not as a claim about patient results.`,
    `Move ${topic.en} out of memory and into a daily team routine. ${brand} gives the team a clearer way to review tasks and next steps.`,
    `If the team works in two languages, ${topic.en} needs wording everyone can follow. ${brand} helps organize the administrative handoff more clearly.`,
    `Make the team meeting more specific: which appointments need review, which follow-ups are open, and what is the next admin step? ${brand} helps structure that conversation.`,
    `Before adding more marketing activity, make ${topic.en} clear inside the clinic. ${brand} helps organize the operating foundation without overclaiming results.`,
  ]
  return `${templates[slot]} #${platformLabel(ctx.platform)}`
}

function renderClinicImagePrompt(ctx: ContentPlanRenderContext, gen: GeneratedContentPlanPostLike): string {
  const topic = inferClinicTopic(ctx, gen)
  const platform = platformLabel(ctx.platform)
  const slot = ctx.postIndex % 6
  const format = platform === 'LinkedIn'
    ? 'wide horizontal 1.91:1 composition'
    : platform === 'YouTube'
      ? 'square 1:1 composition'
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
