/**
 * Strategy output contract guard.
 *
 * The strategist may suggest strong ideas, but persisted strategy output must
 * stay inside the product contract the user reviewed before spending credits:
 * selected platforms only, review-safe readiness, and strategy-only output that
 * does not pretend Content Hub drafts or platform execution already exist.
 */

type JsonObject = Record<string, unknown>

export interface StrategyOutputContractContext {
  allowedPlatforms?: string[] | null
  language?: string | null
  strategyType?: 'organic' | 'paid' | 'full' | string | null
}

interface NormalizedPlatformContext {
  allowedKeys: Set<string>
  allowedLabels: string[]
  fallbackLabel: string | null
}

const PLATFORM_ALIASES: Record<string, string[]> = {
  instagram: ['instagram', 'ig'],
  tiktok: ['tiktok', 'tik tok'],
  facebook: ['facebook', 'fb'],
  linkedin: ['linkedin', 'linked in'],
  twitter: ['twitter', 'x'],
  youtube: ['youtube', 'youtube shorts', 'youtube_short', 'youtube_shorts', 'youtube-shorts'],
  snapchat: ['snapchat'],
  website: ['website', 'site', 'blog'],
  pinterest: ['pinterest', 'pin'],
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  youtube: 'YouTube Shorts',
  snapchat: 'Snapchat',
  website: 'Website',
  pinterest: 'Pinterest',
}

const KNOWN_PLATFORM_KEYS = Object.keys(PLATFORM_ALIASES)

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizePlatform(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
  if (!normalized) return null

  for (const [key, aliases] of Object.entries(PLATFORM_ALIASES)) {
    if (aliases.includes(normalized)) return key
  }
  return normalized.replace(/\s+/g, '')
}

function platformLabel(key: string, original?: string): string {
  return PLATFORM_LABELS[key] || original?.trim() || key
}

export function formatStrategyPlatformLabel(value: unknown): string {
  if (typeof value !== 'string') return ''
  const key = normalizePlatform(value)
  return key ? platformLabel(key, value) : value.trim()
}

function buildPlatformContext(allowedPlatforms: string[] | null | undefined): NormalizedPlatformContext {
  const allowedLabels: string[] = []
  const allowedKeys = new Set<string>()

  for (const platform of allowedPlatforms || []) {
    const key = normalizePlatform(platform)
    if (!key || allowedKeys.has(key)) continue
    allowedKeys.add(key)
    allowedLabels.push(platformLabel(key, platform))
  }

  return {
    allowedKeys,
    allowedLabels,
    fallbackLabel: allowedLabels[0] || null,
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceUnsupportedPlatformText(text: string, ctx: NormalizedPlatformContext): string {
  if (!ctx.allowedKeys.size || !ctx.fallbackLabel) return text
  let output = text

  output = output
    .replace(/\bPinterest\s+boards?\b/gi, `${ctx.fallbackLabel} reference posts`)
    .replace(/\bpin\s+boards?\b/gi, `${ctx.fallbackLabel} reference posts`)
    .replace(/\bblog\s+posts?\b/gi, ctx.allowedKeys.has('website') ? 'blog posts' : 'platform-native educational posts')

  for (const key of KNOWN_PLATFORM_KEYS) {
    if (ctx.allowedKeys.has(key)) continue
    const label = PLATFORM_LABELS[key]
    output = output.replace(new RegExp(`\\b${escapeRegExp(label)}\\b`, 'gi'), ctx.fallbackLabel)

    for (const alias of PLATFORM_ALIASES[key]) {
      if (alias.length <= 2) continue
      output = output.replace(new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'gi'), ctx.fallbackLabel)
    }
  }

  return output
}

function replaceUnsupportedCtaText(text: string): string {
  return text
    .replace(/\bDownload\s+now\b/gi, 'Request more information')
    .replace(/\bDownload\s+the\s+demo\b/gi, 'Request a demo')
}

function guardText(value: string, ctx: NormalizedPlatformContext): string {
  return replaceUnsupportedCtaText(replaceUnsupportedPlatformText(value, ctx))
}

function guardValue(value: unknown, ctx: NormalizedPlatformContext): unknown {
  if (typeof value === 'string') return guardText(value, ctx)
  if (Array.isArray(value)) return value.map(item => guardValue(item, ctx))
  if (!isObject(value)) return value

  const output: JsonObject = {}
  for (const [key, child] of Object.entries(value)) {
    output[key] = guardValue(child, ctx)
  }
  return output
}

function isAllowedPlatform(value: unknown, ctx: NormalizedPlatformContext): boolean {
  if (!ctx.allowedKeys.size) return true
  const key = normalizePlatform(value)
  return !!key && ctx.allowedKeys.has(key)
}

function normalizeAllowedPlatformValue(value: unknown, ctx: NormalizedPlatformContext): string {
  const key = normalizePlatform(value)
  if (key && ctx.allowedKeys.has(key)) return platformLabel(key, typeof value === 'string' ? value : undefined)
  return ctx.fallbackLabel || (typeof value === 'string' ? value : '')
}

function normalizeFormatForPlatform(format: unknown, platform: string): unknown {
  if (typeof format !== 'string') return format
  if (!/\b(blog|article|pin|board|platform-native educational)\b/i.test(format)) return format

  const platformKey = normalizePlatform(platform)
  if (platformKey === 'tiktok' || platformKey === 'youtube') return 'Short-form video'
  if (platformKey === 'instagram' || platformKey === 'facebook' || platformKey === 'linkedin') {
    return 'Carousel or short social post'
  }
  return 'Platform-native educational post'
}

function normalizeOrganicChannelMix(list: unknown): unknown {
  if (!Array.isArray(list)) return list

  return list.map((item) => {
    if (!isObject(item)) return item
    const output: JsonObject = { ...item }
    const effortShare = output.effortSharePercent ?? output.budgetPercent
    delete output.budgetPercent
    if (typeof effortShare === 'number') output.effortSharePercent = effortShare
    return output
  })
}

function isArabicLanguage(language: string | null | undefined): boolean {
  return typeof language === 'string' && language.toLowerCase().startsWith('ar')
}

function firstPlatformLabel(ctx: NormalizedPlatformContext): string {
  return ctx.fallbackLabel || 'Instagram'
}

function hasUsefulText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length >= 3
}

function objectHasUsefulFields(value: unknown, fields: string[]): boolean {
  if (!isObject(value)) return false
  return fields.every(field => hasUsefulText(value[field]))
}

function hasOperationalFunnelStages(list: unknown): boolean {
  if (!Array.isArray(list) || list.length < 3) return false
  return list.every(item => objectHasUsefulFields(item, [
    'stage',
    'userMindset',
    'message',
    'contentType',
    'platform',
    'cta',
    'successMetric',
    'nextStep',
    'productArea',
  ]))
}

function hasKpiMinimum(list: unknown): boolean {
  return Array.isArray(list) && list.length >= 2
}

function defaultOrganicKpis(language?: string | null): JsonObject[] {
  if (isArabicLanguage(language)) {
    return [
      {
        metric: 'طلبات عروض توضيحية مؤهلة',
        target: 'تحديد خط أساس بعد أول ٣٠ يومًا',
        timeframe: 'أول ٣٠ يومًا',
        isHypothesis: true,
      },
      {
        metric: 'تفاعل مع محتوى سير العمل',
        target: 'تحديد خط أساس بعد مراجعة أول شهر',
        timeframe: 'أول ٣٠ يومًا',
        isHypothesis: true,
      },
    ]
  }

  return [
    {
      metric: 'Qualified demo requests',
      target: 'Baseline needed after the first 30 days',
      timeframe: 'First 30 days',
      isHypothesis: true,
    },
    {
      metric: 'Workflow-content engagement',
      target: 'Baseline needed after first-month review',
      timeframe: 'First 30 days',
      isHypothesis: true,
    },
  ]
}

function defaultFunnelStages(ctx: NormalizedPlatformContext, language?: string | null): JsonObject[] {
  const platform = firstPlatformLabel(ctx)

  if (isArabicLanguage(language)) {
    return [
      {
        stage: 'awareness',
        userMindset: 'يعرف المشكلة اليومية لكنه لم يربطها بعد بنظام تشغيل واضح.',
        message: 'حوّل الفوضى التشغيلية إلى سير عمل يمكن مراجعته قبل التنفيذ.',
        contentType: 'منشور تعليمي قصير',
        platform,
        cta: 'راجع سير العمل',
        successMetric: 'تفاعل نوعي يحتاج إلى خط أساس',
        nextStep: 'توجيه المهتم إلى مثال عملي أو عرض توضيحي بعد مراجعة الرسالة.',
        productArea: 'تثقيف وتشخيص المشكلة',
      },
      {
        stage: 'consideration',
        userMindset: 'يقارن بين العمل اليدوي وأداة منظمة لكنه يحتاج إثبات ملاءمة.',
        message: 'اعرض كيف تصبح المتابعة، المسؤوليات، والردود أوضح بدون ادعاء نتائج مضمونة.',
        contentType: 'كاروسيل أو فيديو قصير',
        platform,
        cta: 'اطلب عرضًا توضيحيًا',
        successMetric: 'طلبات اهتمام مؤهلة تحتاج إلى خط أساس',
        nextStep: 'تأهيل الطلب بسؤال عن حجم الفريق ومسار المتابعة الحالي.',
        productArea: 'شرح الحل وتأهيل الطلب',
      },
      {
        stage: 'conversion',
        userMindset: 'يريد معرفة ما سيحدث بعد طلب العرض قبل مشاركة بياناته.',
        message: 'اجعل الخطوة التالية واضحة: عرض سير عمل، مراجعة الاحتياج، ثم قرار متابعة.',
        contentType: 'منشور CTA واضح',
        platform,
        cta: 'احجز عرضًا توضيحيًا',
        successMetric: 'طلبات عروض توضيحية تحتاج إلى خط أساس',
        nextStep: 'تحديد مسؤول الرد، رسالة التأكيد، وموعد المتابعة قبل توسيع الحملة.',
        productArea: 'تحويل ومتابعة',
      },
      {
        stage: 'followUp',
        userMindset: 'تفاعل سابقًا لكنه يحتاج تذكيرًا عمليًا لا ضغطًا بيعيًا.',
        message: 'ذكّره بفجوة تشغيلية واحدة وبالخطوة الصغيرة التالية لمراجعتها.',
        contentType: 'رسالة متابعة أو منشور إعادة تذكير',
        platform,
        cta: 'راجع نقطة التشغيل هذه',
        successMetric: 'استجابات متابعة تحتاج إلى خط أساس',
        nextStep: 'تصنيف الردود حسب الجاهزية ثم تحديد المتابعة اليدوية المناسبة.',
        productArea: 'متابعة ما بعد الاهتمام',
      },
    ]
  }

  return [
    {
      stage: 'awareness',
      userMindset: 'Aware of the daily operational pain but not yet linking it to a clearer system.',
      message: 'Turn scattered work into a workflow the team can review before execution.',
      contentType: 'Short educational post',
      platform,
      cta: 'Review the workflow',
      successMetric: 'Qualitative engagement needs a baseline',
      nextStep: 'Send interested users to a practical example or demo after reviewing the message.',
      productArea: 'Problem education',
    },
    {
      stage: 'consideration',
      userMindset: 'Comparing manual work against a more organized tool and needs fit proof.',
      message: 'Show how follow-up, ownership, and responses become clearer without guaranteed-result claims.',
      contentType: 'Carousel or short video',
      platform,
      cta: 'Request a demo',
      successMetric: 'Qualified interest needs a baseline',
      nextStep: 'Qualify the request with team size and current follow-up workflow questions.',
      productArea: 'Solution explanation',
    },
    {
      stage: 'conversion',
      userMindset: 'Wants to know what happens after requesting a demo before sharing details.',
      message: 'Make the next step clear: workflow walkthrough, need review, then a follow-up decision.',
      contentType: 'Clear CTA post',
      platform,
      cta: 'Book a demo',
      successMetric: 'Demo requests need a baseline',
      nextStep: 'Confirm response owner, confirmation message, and follow-up timing before scaling.',
      productArea: 'Conversion and handoff',
    },
    {
      stage: 'followUp',
      userMindset: 'Previously engaged and needs a practical reminder rather than sales pressure.',
      message: 'Remind them of one operational gap and the small next step to review it.',
      contentType: 'Follow-up message or reminder post',
      platform,
      cta: 'Review this workflow point',
      successMetric: 'Follow-up responses need a baseline',
      nextStep: 'Classify responses by readiness and choose the appropriate manual follow-up.',
      productArea: 'Post-interest follow-up',
    },
  ]
}

function guardKpisMinimum(list: unknown, language?: string | null): unknown {
  if (hasKpiMinimum(list)) return list
  const existing = Array.isArray(list) ? list.filter(isObject) : []
  return [...existing, ...defaultOrganicKpis(language)].slice(0, Math.max(2, existing.length))
}

function guardFunnelStagesMinimum(
  list: unknown,
  ctx: NormalizedPlatformContext,
  language?: string | null,
): unknown {
  if (hasOperationalFunnelStages(list)) return list
  return defaultFunnelStages(ctx, language)
}

function guardChannelMix(
  list: unknown,
  ctx: NormalizedPlatformContext,
  strategyType?: string | null,
): unknown {
  const organicOnly = strategyType === 'organic'
  if (!Array.isArray(list)) return list
  if (!ctx.allowedKeys.size) return organicOnly ? normalizeOrganicChannelMix(list) : list

  const seen = new Set<string>()
  const guarded: unknown[] = []
  for (const item of list) {
    if (!isObject(item)) continue
    const key = normalizePlatform(item.platform)
    if (!key || !ctx.allowedKeys.has(key) || seen.has(key)) continue
    seen.add(key)
    guarded.push({ ...item, platform: platformLabel(key, typeof item.platform === 'string' ? item.platform : undefined) })
  }

  if (guarded.length) return organicOnly ? normalizeOrganicChannelMix(guarded) : guarded

  const fallback = ctx.allowedLabels.map(platform => ({
    platform,
    ...(organicOnly ? { effortSharePercent: 0 } : { budgetPercent: 0 }),
    rationale: 'Selected in Brand Brain; refine channel role before execution.',
    contentFrequency: 'To define in the Content Hub plan.',
  }))
  return fallback
}

function guardPlatformObjectList(list: unknown, ctx: NormalizedPlatformContext): unknown {
  if (!Array.isArray(list) || !ctx.allowedKeys.size) return list

  return list.map((item) => {
    if (!isObject(item)) return item
    const platform = normalizeAllowedPlatformValue(item.platform, ctx)
    return {
      ...item,
      platform,
      ...(typeof item.format === 'string' ? { format: normalizeFormatForPlatform(item.format, platform) } : {}),
    }
  })
}

function guardWeeklyExecutionPlan(list: unknown, ctx: NormalizedPlatformContext): unknown {
  if (!Array.isArray(list) || !ctx.allowedKeys.size) return list

  return list.map((item) => {
    if (!isObject(item)) return item
    const platforms = Array.isArray(item.platforms)
      ? item.platforms
          .filter(platform => isAllowedPlatform(platform, ctx))
          .map(platform => normalizeAllowedPlatformValue(platform, ctx))
      : []

    return {
      ...item,
      platforms: platforms.length ? Array.from(new Set(platforms)) : ctx.allowedLabels.slice(0, 1),
    }
  })
}

const DEFAULT_READINESS_CHECKLIST_EN = [
  'Confirm the conversion path, response owner, and handoff process before turning this strategy into execution.',
  'Prepare or select real visual assets for the first Content Hub posts before approval or scheduling.',
  'Collect verified proof assets before using testimonials, reviews, case studies, awards, or performance claims.',
  'Review the first-month post directions in Content Hub before creating drafts or schedule decisions.',
]

const DEFAULT_READINESS_CHECKLIST_AR = [
  'تأكيد مسار التحويل، مسؤول الرد، وآلية تسليم الطلبات قبل تحويل الاستراتيجية إلى تنفيذ.',
  'تجهيز أو اختيار أصول بصرية حقيقية لأول منشورات Content Hub قبل الموافقة أو الجدولة.',
  'جمع إثباتات موثّقة قبل استخدام شهادات، مراجعات، قصص عملاء، جوائز، أو ادعاءات أداء.',
  'مراجعة اتجاهات منشورات الشهر الأول في Content Hub قبل إنشاء المسودات أو قرارات الجدولة.',
]

function normalizeChecklistLabel(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\bSet up WhatsApp consultation process\b/gi, 'Confirm WhatsApp consultation intake process')
    .replace(/\bWhatsApp consultation process is set up\b/gi, 'WhatsApp consultation intake process needs confirmation')
    .trim()
}

function shouldUseArabicChecklist(language: string | null | undefined, labels: string[]): boolean {
  if (language?.toLowerCase().startsWith('ar')) return true
  return labels.some(label => /[\u0600-\u06FF]/.test(label))
}

function guardReadinessChecklist(list: unknown, language?: string | null): unknown {
  const rawItems = Array.isArray(list) ? list : []
  const guarded: JsonObject[] = []

  for (const item of rawItems) {
    if (!isObject(item)) continue
    const label = normalizeChecklistLabel(item.label)
    if (!label) continue
    guarded.push({ ...item, label, done: false })
  }

  const seen = new Set(guarded.map(item => String(item.label).toLowerCase()))
  const defaults = shouldUseArabicChecklist(language, guarded.map(item => String(item.label)))
    ? DEFAULT_READINESS_CHECKLIST_AR
    : DEFAULT_READINESS_CHECKLIST_EN

  for (const label of defaults) {
    if (guarded.length >= 3) break
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    guarded.push({ label, done: false })
    seen.add(key)
  }

  return guarded
}

export function selectStrategyCampaignPlatforms(
  strategy: { channelMix?: unknown },
  allowedPlatforms?: string[] | null,
): string[] {
  const ctx = buildPlatformContext(allowedPlatforms)
  if (ctx.allowedLabels.length) return ctx.allowedLabels

  return Array.isArray(strategy.channelMix)
    ? strategy.channelMix
        .map((item) => isObject(item) ? item.platform : item)
        .filter((platform): platform is string => typeof platform === 'string' && platform.trim().length > 0)
        .map(formatStrategyPlatformLabel)
    : []
}

export function guardStrategyOutputContract<T>(input: T, context: StrategyOutputContractContext = {}): T {
  if (!isObject(input)) return input
  const ctx = buildPlatformContext(context.allowedPlatforms)
  const output = guardValue(input, ctx) as JsonObject

  output.channelMix = guardChannelMix(output.channelMix, ctx, context.strategyType)
  output.kpis = guardKpisMinimum(output.kpis, context.language)
  output.funnelStages = guardFunnelStagesMinimum(output.funnelStages, ctx, context.language)
  output.contentAnglesDetailed = guardPlatformObjectList(output.contentAnglesDetailed, ctx)
  output.audienceSegmentsDetailed = guardPlatformObjectList(output.audienceSegmentsDetailed, ctx)
  output.funnelStages = guardPlatformObjectList(output.funnelStages, ctx)
  output.channelStrategy = guardPlatformObjectList(output.channelStrategy, ctx)
  output.weeklyExecutionPlan = guardWeeklyExecutionPlan(output.weeklyExecutionPlan, ctx)
  output.readinessChecklist = guardReadinessChecklist(output.readinessChecklist, context.language)

  return output as T
}
