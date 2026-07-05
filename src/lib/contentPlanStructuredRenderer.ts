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
  const slot = (ctx.postIndex % 3) + 1

  if (ctx.isArabic) {
    const templates = [
      `راجع ${topic.ar} في العيادة بخطوات أوضح. ${brand} يساعد الفريق على تنظيم المهام الإدارية ومراجعتها قبل قرارات التشغيل. ابدأ بمراجعة طريقة العمل الحالية. #إدارة_العيادات #تنظيم_العمل`,
      `${topic.ar} يحتاج إلى رؤية واضحة للخطوات اليومية. استخدم ${brand} كمساعد تشغيلي لمراجعة المواعيد والمتابعة والمهام دون افتراض نتائج طبية أو وعود أداء. راجع الخطة مع فريقك. #عيادات #تشغيل_العيادات`,
      `قبل توسيع التسويق، تأكد أن ${topic.ar} مفهوم وقابل للمراجعة. ${brand} يضع نقاط العمل في مسار إداري أوضح حتى يعرف الفريق ما يجب متابعته. ابدأ بخطوة مراجعة واحدة اليوم. #إدارة_العيادات #متابعة_المرضى`,
    ]
    return templates[slot - 1]
  }

  const templates = [
    `Review ${topic.en} with clearer daily steps. ${brand} helps the team organize administrative tasks before operational decisions are made. Start by reviewing the current workflow.`,
    `${topic.en} needs visible steps, not assumptions. Use ${brand} as an operational assistant to review appointments, follow-up, and team tasks without implying medical outcomes or performance promises.`,
    `Before scaling marketing, make ${topic.en} easy to review. ${brand} turns the work into clearer administrative checkpoints for the team. Start with one workflow review this week.`,
  ]
  return `${templates[slot - 1]} #${platformLabel(ctx.platform)}`
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
