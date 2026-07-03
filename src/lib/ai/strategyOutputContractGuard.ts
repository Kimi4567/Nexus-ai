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
  organicPostCount?: number | null
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

function normalizeArabicFormatText(value: string): string {
  return value
    .replace(/\bCarousel\s+or\s+short\s+social\s+post\b/gi, 'كاروسيل أو منشور اجتماعي قصير')
    .replace(/\bShort[-\s]?form\s+video\b/gi, 'فيديو قصير')
    .replace(/\bShort\s+video\b/gi, 'فيديو قصير')
    .replace(/\bSocial\s+post\b/gi, 'منشور اجتماعي قصير')
    .replace(/\bShort\s+social\s+post\b/gi, 'منشور اجتماعي قصير')
    .replace(/\bCarousel\s+post\b/gi, 'كاروسيل')
    .replace(/\bCarousel\b/gi, 'كاروسيل')
    .replace(/\bReels\b/gi, 'ريلز')
    .replace(/\bReel\b/gi, 'ريل')
    .replace(/\bVideo\b/gi, 'فيديو قصير')
    .replace(/\bStories\b/gi, 'ستوري')
    .replace(/\bStory\b/gi, 'ستوري')
    .replace(/\bPost\b/gi, 'منشور')
}

function guardText(value: string, ctx: NormalizedPlatformContext, language?: string | null): string {
  const platformGuarded = replaceUnsupportedCtaText(replaceUnsupportedPlatformText(value, ctx))
  return isArabicLanguage(language) ? normalizeArabicFormatText(platformGuarded) : platformGuarded
}

function guardValue(value: unknown, ctx: NormalizedPlatformContext, language?: string | null): unknown {
  if (typeof value === 'string') return guardText(value, ctx, language)
  if (Array.isArray(value)) return value.map(item => guardValue(item, ctx, language))
  if (!isObject(value)) return value

  const output: JsonObject = {}
  for (const [key, child] of Object.entries(value)) {
    output[key] = guardValue(child, ctx, language)
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

function normalizeFormatForPlatform(format: unknown, platform: string, language?: string | null): unknown {
  if (typeof format !== 'string') return format
  const ar = isArabicLanguage(language)
  if (ar) {
    const normalized = format.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
    const localized = normalizeArabicFormatText(format)
    if (localized !== format) return localized

    if (/^(reel|reels|short form video|short video|video|youtube short|youtube shorts)$/.test(normalized)) {
      return 'فيديو قصير'
    }
    if (/^(carousel|carousel post|carousel or short social post)$/.test(normalized)) {
      return 'كاروسيل'
    }
    if (/^(post|social post|short social post)$/.test(normalized)) {
      return 'منشور اجتماعي قصير'
    }
    if (/^(story|stories)$/.test(normalized)) {
      return 'ستوري'
    }
  }
  if (!/\b(blog|article|pin|board|platform-native educational)\b/i.test(format)) return format

  const platformKey = normalizePlatform(platform)
  if (platformKey === 'tiktok' || platformKey === 'youtube') return ar ? 'فيديو قصير' : 'Short-form video'
  if (platformKey === 'instagram' || platformKey === 'facebook' || platformKey === 'linkedin') {
    return ar ? 'كاروسيل أو منشور اجتماعي قصير' : 'Carousel or short social post'
  }
  return ar ? 'منشور تعليمي داخل المنصة' : 'Platform-native educational post'
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

function fallbackOperationalText(key: string, language?: string | null): string {
  const ar = isArabicLanguage(language)
  const text: Record<string, { en: string; ar: string }> = {
    desiredOutcome: {
      en: 'Make the practical outcome clear enough to review before draft creation.',
      ar: 'توضيح النتيجة العملية بما يكفي لمراجعتها قبل إنشاء المسودات.',
    },
    objection: {
      en: 'Buyer concern still needs validation before production.',
      ar: 'اعتراض المشتري يحتاج تحققًا قبل الإنتاج.',
    },
    proofNeeded: {
      en: 'Not enough data: collect a real demo detail, screenshot, customer quote, or compliance-safe proof before using stronger claims.',
      ar: 'لا توجد بيانات كافية: اجمع تفصيل عرض حقيقي، لقطة شاشة، اقتباس عميل، أو إثباتًا آمنًا قبل استخدام ادعاءات أقوى.',
    },
    responseHandoff: {
      en: 'Confirm the response owner, qualification question, and follow-up message before sending leads to this CTA.',
      ar: 'تأكيد مسؤول الرد، سؤال التأهيل، ورسالة المتابعة قبل توجيه العملاء المحتملين إلى هذا النداء.',
    },
    reviewPoint: {
      en: 'Review message clarity, proof availability, and lead quality before repeating or scaling.',
      ar: 'مراجعة وضوح الرسالة، توفر الإثبات، وجودة الطلبات قبل التكرار أو التوسيع.',
    },
    asset: {
      en: 'Real product/process visual or demo screenshot needed before production.',
      ar: 'أصل بصري حقيقي للمنتج أو سير العمل، أو لقطة عرض توضيحي قبل الإنتاج.',
    },
    executionNote: {
      en: 'Keep this as a reviewable planning direction; confirm response handoff before production.',
      ar: 'احتفظ بهذا كاتجاه تخطيطي قابل للمراجعة؛ أكّد تسليم الرد قبل الإنتاج.',
    },
    successMetric: {
      en: 'Baseline needed after first review cycle',
      ar: 'يحتاج إلى خط أساس بعد أول دورة مراجعة',
    },
  }
  const match = text[key]
  return match ? (ar ? match.ar : match.en) : (ar ? 'يحتاج إلى مراجعة قبل التنفيذ.' : 'Needs review before execution.')
}

function guardContentAnglesOperationalDepth(list: unknown, language?: string | null): unknown {
  if (!Array.isArray(list)) return list

  return list.map((item) => {
    if (!isObject(item)) return item
    return {
      ...item,
      desiredOutcome: hasUsefulText(item.desiredOutcome) ? item.desiredOutcome : fallbackOperationalText('desiredOutcome', language),
      objection: hasUsefulText(item.objection) ? item.objection : fallbackOperationalText('objection', language),
      asset: hasUsefulText(item.asset) ? item.asset : fallbackOperationalText('asset', language),
      proofNeeded: hasUsefulText(item.proofNeeded) ? item.proofNeeded : fallbackOperationalText('proofNeeded', language),
      responseHandoff: hasUsefulText(item.responseHandoff) ? item.responseHandoff : fallbackOperationalText('responseHandoff', language),
      reviewPoint: hasUsefulText(item.reviewPoint) ? item.reviewPoint : fallbackOperationalText('reviewPoint', language),
    }
  })
}

function hasKpiMinimum(list: unknown): boolean {
  return Array.isArray(list) && list.length >= 2
}

function readLeadingCount(value: unknown): number {
  if (typeof value !== 'string') return 0
  const normalized = value
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .trim()
  const match = normalized.match(/^(\d{1,2})\b/)
  if (!match) return 1
  const count = Number(match[1])
  return Number.isFinite(count) && count > 0 ? count : 1
}

function deliverableCount(list: unknown): number {
  if (!Array.isArray(list)) return 0
  return list.reduce((sum, item) => sum + readLeadingCount(item), 0)
}

function weeklyDeliverableCount(list: unknown): number {
  if (!Array.isArray(list)) return 0
  return list.reduce((sum, item) => {
    if (!isObject(item)) return sum
    return sum + deliverableCount(item.deliverables)
  }, 0)
}

function angleTitle(angle: unknown, index: number, ar: boolean): string {
  if (isObject(angle)) {
    const candidates = [angle.title, angle.hook, angle.message, angle.pain]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
  }
  return ar ? `اتجاه منشور ${index + 1}` : `Post direction ${index + 1}`
}

function angleFormat(angle: unknown, ar: boolean): string {
  if (isObject(angle) && typeof angle.format === 'string' && angle.format.trim()) {
    return angle.format.trim()
  }
  return ar ? 'منشور' : 'post'
}

function anglePlatform(angle: unknown, fallback: string | null): string | null {
  return isObject(angle) && typeof angle.platform === 'string' && angle.platform.trim()
    ? angle.platform.trim()
    : fallback
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const text = value?.trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(text)
  }
  return output
}

function distributeAnglesAcrossWeeks(angles: unknown[], targetCount: number): unknown[][] {
  const selected = angles.slice(0, targetCount)
  const weekCount = Math.min(4, Math.max(1, selected.length))
  const buckets = Array.from({ length: weekCount }, () => [] as unknown[])
  selected.forEach((angle, index) => {
    buckets[index % weekCount].push(angle)
  })
  return buckets
}

function alignWeeklyExecutionPlanToOrganicCount(
  weeklyPlan: unknown,
  contentAngles: unknown,
  ctx: NormalizedPlatformContext,
  targetCount?: number | null,
  language?: string | null,
): unknown {
  if (!targetCount || targetCount <= 0 || !Array.isArray(contentAngles) || contentAngles.length === 0) {
    return weeklyPlan
  }
  const currentCount = weeklyDeliverableCount(weeklyPlan)
  if (currentCount === targetCount) return weeklyPlan

  const ar = isArabicLanguage(language)
  const existingWeeks = Array.isArray(weeklyPlan) ? weeklyPlan.filter(isObject) : []
  const buckets = distributeAnglesAcrossWeeks(contentAngles, targetCount)

  return buckets.map((bucket, index) => {
    const existing = existingWeeks[index] ?? {}
    const platforms = uniqueStrings(bucket.map(angle => anglePlatform(angle, ctx.fallbackLabel)))
    const deliverables = bucket.map((angle, angleIndex) => {
      const title = angleTitle(angle, index + angleIndex, ar)
      const format = angleFormat(angle, ar)
      return ar
        ? `1 ${format}: ${title}`
        : `1 ${format}: ${title}`
    })

    return {
      ...existing,
      week: index + 1,
      objective: typeof existing.objective === 'string' && existing.objective.trim()
        ? existing.objective
        : (ar ? `مراجعة وتنفيذ اتجاهات الأسبوع ${index + 1}` : `Review and execute week ${index + 1} directions`),
      keyMessage: typeof existing.keyMessage === 'string' && existing.keyMessage.trim()
        ? existing.keyMessage
        : (ar ? 'رسالة تشغيلية قابلة للمراجعة قبل إنشاء المسودات.' : 'A reviewable operating message before draft creation.'),
      deliverables,
      platforms: platforms.length ? platforms : (ctx.fallbackLabel ? [ctx.fallbackLabel] : []),
      assetsNeeded: Array.isArray(existing.assetsNeeded) && existing.assetsNeeded.length
        ? existing.assetsNeeded
        : bucket.map(angle => isObject(angle) && typeof angle.asset === 'string' && angle.asset.trim()
          ? angle.asset.trim()
          : fallbackOperationalText('asset', language)),
      cta: typeof existing.cta === 'string' && existing.cta.trim()
        ? existing.cta
        : (ar ? 'راجع الاتجاه' : 'Review the direction'),
      successMetric: typeof existing.successMetric === 'string' && existing.successMetric.trim()
        ? existing.successMetric
        : fallbackOperationalText('successMetric', language),
      executionNote: typeof existing.executionNote === 'string' && existing.executionNote.trim()
        ? existing.executionNote
        : fallbackOperationalText('executionNote', language),
      reviewPoints: Array.isArray(existing.reviewPoints) && existing.reviewPoints.length
        ? existing.reviewPoints
        : [fallbackOperationalText('reviewPoint', language)],
    }
  })
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

function guardPlatformObjectList(list: unknown, ctx: NormalizedPlatformContext, language?: string | null): unknown {
  if (!Array.isArray(list) || !ctx.allowedKeys.size) return list

  return list.map((item) => {
    if (!isObject(item)) return item
    const platform = normalizeAllowedPlatformValue(item.platform, ctx)
    return {
      ...item,
      platform,
      ...(typeof item.format === 'string' ? { format: normalizeFormatForPlatform(item.format, platform, language) } : {}),
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

function guardWeeklyExecutionOperationalDepth(list: unknown, language?: string | null): unknown {
  if (!Array.isArray(list)) return list

  return list.map((item) => {
    if (!isObject(item)) return item
    return {
      ...item,
      assetsNeeded: Array.isArray(item.assetsNeeded) && item.assetsNeeded.length
        ? item.assetsNeeded
        : [fallbackOperationalText('asset', language)],
      successMetric: hasUsefulText(item.successMetric)
        ? item.successMetric
        : fallbackOperationalText('successMetric', language),
      executionNote: hasUsefulText(item.executionNote)
        ? item.executionNote
        : fallbackOperationalText('executionNote', language),
      reviewPoints: Array.isArray(item.reviewPoints) && item.reviewPoints.length
        ? item.reviewPoints
        : [fallbackOperationalText('reviewPoint', language)],
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

function guardAssetRequirements(value: unknown, language?: string | null): unknown {
  if (isObject(value)) {
    const output: JsonObject = { ...value }
    const ar = isArabicLanguage(language)
    const defaults = ar
      ? {
          mustHave: ['لقطات شاشة أو مثال عرض توضيحي حقيقي قبل تحويل الاتجاهات إلى مسودات.'],
          niceToHave: ['مقارنة قبل/بعد آمنة أو مخطط سير عمل قابل للمراجعة.'],
          forAds: ['أصول مدفوعة لاحقة فقط بعد تأكيد الميزانية، التتبع، والحسابات المتصلة.'],
          forOrganic: ['خلفيات أو صور عملية لكل اتجاه منشور في أول 30 يومًا.'],
          forProof: ['إثباتات موثقة أو ملاحظات عملاء حقيقية قبل أي ادعاء أداء.'],
          nextToCreate: ['تجهيز مثال عرض توضيحي ومكتبة لقطات سير عمل قبل الإنتاج.'],
          canStartWithoutNote: 'يمكن بدء التخطيط العضوي، لكن الإنتاج يحتاج أصولًا وإثباتات مراجعة.',
        }
      : {
          mustHave: ['Real screenshot, demo example, or workflow visual before turning directions into drafts.'],
          niceToHave: ['Safe before/after comparison or reviewable workflow diagram.'],
          forAds: ['Paid assets only after budget, tracking, and connected-account readiness are confirmed.'],
          forOrganic: ['Backgrounds or practical visuals for each first-30-day post direction.'],
          forProof: ['Verified proof or real customer feedback before any performance or testimonial claim.'],
          nextToCreate: ['Prepare a demo example and workflow screenshot library before production.'],
          canStartWithoutNote: 'Organic planning can start, but production needs reviewable assets and proof.',
        }

    for (const key of ['mustHave', 'niceToHave', 'forAds', 'forOrganic', 'forProof', 'nextToCreate'] as const) {
      output[key] = Array.isArray(output[key]) && (output[key] as unknown[]).length ? output[key] : defaults[key]
    }
    output.canStartWithout = typeof output.canStartWithout === 'boolean' ? output.canStartWithout : true
    output.canStartWithoutNote = hasUsefulText(output.canStartWithoutNote) ? output.canStartWithoutNote : defaults.canStartWithoutNote
    return output
  }

  return guardAssetRequirements({}, language)
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
  const output = guardValue(input, ctx, context.language) as JsonObject

  output.channelMix = guardChannelMix(output.channelMix, ctx, context.strategyType)
  output.kpis = guardKpisMinimum(output.kpis, context.language)
  output.funnelStages = guardFunnelStagesMinimum(output.funnelStages, ctx, context.language)
  output.contentAnglesDetailed = guardPlatformObjectList(output.contentAnglesDetailed, ctx, context.language)
  output.contentAnglesDetailed = guardContentAnglesOperationalDepth(output.contentAnglesDetailed, context.language)
  output.audienceSegmentsDetailed = guardPlatformObjectList(output.audienceSegmentsDetailed, ctx, context.language)
  output.funnelStages = guardPlatformObjectList(output.funnelStages, ctx, context.language)
  output.channelStrategy = guardPlatformObjectList(output.channelStrategy, ctx, context.language)
  output.weeklyExecutionPlan = guardWeeklyExecutionPlan(output.weeklyExecutionPlan, ctx)
  output.weeklyExecutionPlan = alignWeeklyExecutionPlanToOrganicCount(
    output.weeklyExecutionPlan,
    output.contentAnglesDetailed,
    ctx,
    context.organicPostCount,
    context.language,
  )
  output.weeklyExecutionPlan = guardWeeklyExecutionOperationalDepth(output.weeklyExecutionPlan, context.language)
  output.assetRequirements = guardAssetRequirements(output.assetRequirements, context.language)
  output.readinessChecklist = guardReadinessChecklist(output.readinessChecklist, context.language)

  return output as T
}
