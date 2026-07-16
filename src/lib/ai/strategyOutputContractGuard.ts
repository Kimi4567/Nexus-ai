import { hasGenericMarketingHook } from '@/lib/marketingCopyGuard'

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
  hasLeadHandling?: boolean
  hasConversionDestination?: boolean
  allowedCompetitors?: string[] | null
  goal?: string | null
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
  threads: ['threads'],
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X',
  youtube: 'YouTube Shorts',
  snapchat: 'Snapchat',
  website: 'Website',
  pinterest: 'Pinterest',
  threads: 'Threads',
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
    .replace(/\bDownload\s+the\s+demo\b/gi, 'Request more information')
    .replace(/\bDownload\s+(?:the\s+|our\s+)?(?:white\s*paper|guide|report|case\s+study|success\s+stor(?:y|ies)|ebook)\b/gi, 'Review the documented details')
    .replace(/\bRegister\s+for\s+(?:the\s+|our\s+)?webinar\b/gi, 'Review the educational overview')
    .replace(/\bJoin\s+(?:the\s+|our\s+)?webinar\b/gi, 'Review the educational overview')
    .replace(/\bRead\s+(?:the\s+|our\s+)?(?:case\s+study|success\s+stor(?:y|ies))\b/gi, 'Review the verified proof when available')
    .replace(/\bWatch\s+our\s+demo\b/gi, 'Review the workflow')
    .replace(/حم[ّ]?ل\s+(?:الآن|الدليل|التقرير|الكتاب|دراسة\s+الحالة|قصة\s+النجاح)/gi, 'راجع التفاصيل الموثقة')
    .replace(/سج[ّ]?ل\s+(?:في|لحضور)\s+(?:ال)?ويبنار/gi, 'راجع الملخص التعليمي')
    .replace(/انضم\s+(?:إلى|الى)\s+(?:ال)?ويبنار/gi, 'راجع الملخص التعليمي')
    .replace(/اقرأ\s+(?:دراسة\s+الحالة|قصة\s+النجاح)/gi, 'راجع الإثبات الموثق عند توفره')
    .replace(/شاهد\s+(?:العرض|الديمو)\s+التوضيحي/gi, 'راجع طريقة العمل')
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

function guardBroadStrategyHypeText(value: string): string {
  return value
    // Product-capability claims must describe the reviewed workflow, not imply
    // every connector, permission, or analytics source is already operational.
    .replace(/\bcomplete\s+workflow\s+from\b/gi, 'governed workflow spanning')
    .replace(/\bcomplete\s+workflow\b/gi, 'governed workflow')
    .replace(/\bseamless\s+integration\s+capabilities\b/gi, 'reviewed connection capabilities')
    .replace(/\bseamless\s+integrations?\b/gi, 'reviewed connection setup')
    .replace(/\bfull\s+platform\s+integration\b/gi, 'reviewed platform connection setup')
    .replace(/\bpricing\s+details\s+available\s+to\s+discuss(?:\s+Model)?\b/gi, 'Review current pricing and credit options')
    .replace(/\bIterate\s+if\s+([^.;]+?)\s+increase(?:s)?\b/gi, 'Continue if $1 increase; iterate if the result is inconclusive')
    .replace(/سير\s+عمل\s+كامل\s+من/gi, 'سير عمل محكوم يمتد من')
    .replace(/تكاملات?\s+سلس(?:ة|ةً)?/gi, 'إعداد اتصالات خاضع للمراجعة')
    .replace(/تكامل\s+كامل\s+مع\s+المنصات/gi, 'إعداد اتصالات المنصات بعد المراجعة')
    .replace(/\b(?:the\s+)?most\s+effective\s+(?:platform|channel)\b/gi, 'the selected channel')
    .replace(/(?:هو|هي)\s+المنصة\s+الأكثر\s+(?:فعالية|فاعلية)/g, 'قناة مختارة في Brand Brain')
    .replace(/المنصة\s+الأكثر\s+(?:فعالية|فاعلية)/g, 'القناة المختارة في Brand Brain')
    .replace(/القناة\s+الأكثر\s+(?:فعالية|فاعلية)/g, 'القناة المختارة في Brand Brain')
    .replace(/\bthe\s+perfect\s+solution\s+for\b/gi, 'a practical solution for')
    .replace(/\bperfect\s+solution\s+for\b/gi, 'practical solution for')
    .replace(/\bthe\s+best\s+solution\s+for\b/gi, 'a practical solution for')
    .replace(/\bbest\s+solution\s+for\b/gi, 'practical solution for')
    .replace(/\bthe\s+ideal\s+solution\s+for\b/gi, 'a practical solution for')
    .replace(/\bideal\s+solution\s+for\b/gi, 'practical solution for')
    .replace(/\bthe\s+perfect\s+solution\b/gi, 'a practical solution')
    .replace(/\bperfect\s+solution\b/gi, 'practical solution')
    .replace(/\bthe\s+best\s+solution\b/gi, 'a practical solution')
    .replace(/\bbest\s+solution\b/gi, 'practical solution')
    .replace(/\bthe\s+ideal\s+solution\b/gi, 'a practical solution')
    .replace(/\bideal\s+solution\b/gi, 'practical solution')
    .replace(/هو\s+الحل\s+الأمثل\s+ل/g, 'هو حل عملي ل')
    .replace(/هي\s+الحل\s+الأمثل\s+ل/g, 'هي حل عملي ل')
    .replace(/هو\s+الحل\s+الأمثل/g, 'هو حل عملي')
    .replace(/هي\s+الحل\s+الأمثل/g, 'هي حل عملي')
    .replace(/الحل\s+الأمثل\s+ل/g, 'حل عملي ل')
    .replace(/الحل\s+الأمثل/g, 'حل عملي')
    .replace(/حل\s+مثالي\s+ل/g, 'حل عملي ل')
    .replace(/حل\s+مثالي/g, 'حل عملي')
    .replace(/المثالية\s+ل/g, 'المناسبة ل')
    .replace(/المثالي\s+ل/g, 'المناسب ل')
    .replace(/مثالية\s+ل/g, 'مناسبة ل')
    .replace(/مثالي\s+ل/g, 'مناسب ل')
    .replace(/يسه[ّ]?ل\s+عليك\s+متابعة\s+العملاء\s+وزيادة\s+فرص\s+البيع\s+بكفاءة/gi, 'يساعدك على تنظيم متابعة العملاء وفرص البيع في مسار أوضح')
    .replace(/يوفر\s+لك\s+الوقت\s+والجهد\s+بتكلفة\s+مناسبة/gi, 'يركّز على تنظيم المتابعة وتقليل تشتت العمل اليدوي')
    .replace(/\b([A-Za-z][A-Za-z\s-]{1,30})\s+هو\s+المنصة\s+المثلى\s+للوصول\s+إلى/gi, '$1 قناة مختارة في Brand Brain للوصول إلى')
    .replace(/إعداد\s+المحتوى\s+الأولي\s+للنشر\s+على/gi, 'مراجعة أول اتجاهات المحتوى على')
    .replace(/\bprepare\s+initial\s+content\s+for\s+publishing\s+on\b/gi, 'review the first content directions for')
}

function guardArabicFluencyText(value: string): string {
  return value
    // A model can occasionally drop the noun after "معدودة" and leave a
    // grammatically broken promise. Keep the grounded setup idea, not the
    // malformed wording.
    .replace(/ابدأ\s+باستخدام\s+(?:النظام|المنصة|الخدمة)\s+معدودة/gi, 'ابدأ بخطوات إعداد بسيطة وواضحة')
    // "manual technologies" is a literal translation that reads unnaturally in
    // Arabic. The saved pain is tool fragmentation, so express that directly.
    .replace(/دون\s+تعقيد\s+التقنيات\s+اليدوية/gi, 'دون تشتت الأدوات اليدوية')
    // Avoid an absolute sales-outcome promise when the product only supports a
    // clearer follow-up workflow.
    .replace(/لا\s+تفقد\s+أي\s+فرصة\s+بيع\s+بعد\s+اليوم/gi, 'نظّم متابعة فرص البيع بدل تركها بين الأدوات')
}

function guardText(value: string, ctx: NormalizedPlatformContext, language?: string | null): string {
  const hypeGuarded = guardBroadStrategyHypeText(value)
  const platformGuarded = replaceUnsupportedCtaText(replaceUnsupportedPlatformText(hypeGuarded, ctx))
  return isArabicLanguage(language)
    ? guardArabicFluencyText(normalizeArabicFormatText(platformGuarded))
    : platformGuarded
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

function mentionsUnverifiedOperatingOwner(value: string): boolean {
  return /\b(?:marketing|sales|reception|support|customer success)\s+(?:team|department|staff)\b|\b(?:team|department)\s+(?:handles|follows|responds|replies)\b|(?:فريق|قسم)\s+(?:التسويق|المبيعات|الاستقبال|الدعم|خدمة العملاء)|(?:موظف|مسؤول)\s+(?:الاستقبال|المبيعات|التسويق)/i.test(value)
}

function guardUnverifiedLeadHandling(value: unknown, language?: string | null): unknown {
  if (Array.isArray(value)) return value.map(item => guardUnverifiedLeadHandling(item, language))
  if (!isObject(value)) return value

  const output: JsonObject = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'responseHandoff' && typeof child === 'string') {
      output[key] = fallbackOperationalText('responseHandoff', language)
      continue
    }
    if ((key === 'executionNote' || key === 'nextStep') && typeof child === 'string' && mentionsUnverifiedOperatingOwner(child)) {
      output[key] = key === 'executionNote'
        ? fallbackOperationalText('executionNote', language)
        : fallbackOperationalText('responseHandoff', language)
      continue
    }
    output[key] = guardUnverifiedLeadHandling(child, language)
  }
  return output
}

const CONVERSION_CTA_KEYS = new Set(['cta', 'primaryCTA', 'secondaryCTA'])
const CONVERSION_ACTION_KEYS = new Set(['conversionAction', 'expectedUserAction'])
const CONVERSION_METRIC_KEYS = new Set(['metric', 'target', 'successMetric'])

function unsupportedConversionAction(value: string): boolean {
  return /\b(?:try|start now|get started|sign up|register|book|schedule|request|contact|call|message|whatsapp|buy|purchase|order|download|demo)\b/i.test(value)
    || /(?:جرّب|جرب|ابدأ الآن|سجّل|سجل الآن|احجز|اطلب|تواصل|راسل|واتساب|اشتر|حمّل|حمل الآن|احصل على (?:عرض|استشارة|تجربة)|استفسر)/i.test(value)
    || /(?:تحسين|زيادة)\s+(?:ال)?مبيعات(?:ك|كم|هم|ها)?/i.test(value)
}

function safeReviewCta(source: string, language?: string | null): string {
  const ar = isArabicLanguage(language)
  const choices = ar
    ? [
        'تعرّف على طريقة عمل الحل',
        'راجع خطوات سير العمل',
        'قارن الطريقة الحالية بالمسار المقترح',
        'احفظ الفكرة للمراجعة',
        'اطّلع على تفاصيل العرض',
      ]
    : [
        'Learn how the solution works',
        'Review the workflow steps',
        'Compare the current workflow with the proposed path',
        'Save this idea for review',
        'Review the offer details',
      ]
  const index = Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0) % choices.length
  return choices[index]
}

function unsupportedConversionMetric(value: string): boolean {
  return /(?:نقرات?\s+على\s+(?:الرابط|الروابط)|عدد\s+التحويلات|زيادة\s+التحويلات|معدل\s+التحويل)/i.test(value)
    || /\b(?:link clicks?|number of conversions?|conversion rate)\b/i.test(value)
}

function unresolvedConversionMetric(language?: string | null): string {
  return isArabicLanguage(language)
    ? 'يحتاج إلى خط أساس بعد تأكيد وجهة التحويل وظهور بيانات فعلية.'
    : 'Needs a baseline after the conversion destination is confirmed and real data exists.'
}

function guardUnverifiedConversionActions(value: unknown, language?: string | null): unknown {
  if (Array.isArray(value)) return value.map(item => guardUnverifiedConversionActions(item, language))
  if (!isObject(value)) return value

  const output: JsonObject = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'ctaVariations' && Array.isArray(child)) {
      output[key] = child.map(item => (
        typeof item === 'string' && unsupportedConversionAction(item)
          ? safeReviewCta(item, language)
          : guardUnverifiedConversionActions(item, language)
      ))
      continue
    }
    if (CONVERSION_CTA_KEYS.has(key) && typeof child === 'string' && unsupportedConversionAction(child)) {
      output[key] = safeReviewCta(child, language)
      continue
    }
    if (CONVERSION_ACTION_KEYS.has(key) && typeof child === 'string') {
      output[key] = isArabicLanguage(language)
        ? 'لم تُحدَّد وجهة التحويل بعد؛ أكّدها قبل التنفيذ.'
        : 'The conversion destination is not set yet; confirm it before execution.'
      continue
    }
    if (key === 'userMindset' && typeof child === 'string' && unsupportedConversionAction(child)) {
      output[key] = isArabicLanguage(language)
        ? 'مقارنة الحل بالطريقة الحالية والبحث عن خطوة تالية واضحة.'
        : 'Comparing the solution with the current workflow and looking for a clear next step.'
      continue
    }
    if (CONVERSION_METRIC_KEYS.has(key) && typeof child === 'string' && unsupportedConversionMetric(child)) {
      output[key] = unresolvedConversionMetric(language)
      continue
    }
    if (key === 'successMetrics' && Array.isArray(child)) {
      output[key] = child.map(item => (
        typeof item === 'string' && unsupportedConversionMetric(item)
          ? unresolvedConversionMetric(language)
          : item
      ))
      continue
    }
    output[key] = guardUnverifiedConversionActions(child, language)
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

function guardBusinessObjectiveGoal(
  value: unknown,
  goal: string | null | undefined,
  language?: string | null,
): unknown {
  if (!isObject(value) || typeof goal !== 'string' || !goal.trim()) return value
  const normalizedGoal = goal.trim().toLowerCase()
  const ar = isArabicLanguage(language)
  const objective = (() => {
    if (normalizedGoal === 'lead' || normalizedGoal === 'leads' || normalizedGoal.includes('qualified lead')) {
      return ar
        ? {
            marketing: 'توليد اهتمام مؤهل بالعروض التوضيحية وتسجيله عبر مسار التحويل الذي راجعه المستخدم.',
            successIn30Days: 'تحديد خط أساس للاهتمام المؤهل واكتمال مسار طلب العرض من بيانات حقيقية.',
          }
        : {
            marketing: 'Generate qualified demo interest and capture it through the user-reviewed conversion path.',
            successIn30Days: 'Establish a baseline for qualified interest and demo-path completion from real data.',
          }
    }
    if (normalizedGoal === 'sale' || normalizedGoal === 'sales' || normalizedGoal.includes('revenue')) {
      return ar
        ? {
            marketing: 'دعم قرارات الشراء عبر العرض ومسار التحويل اللذين راجعهما المستخدم.',
            successIn30Days: 'تحديد خط أساس لإشارات نية الشراء واكتمال مسار التحويل من بيانات حقيقية.',
          }
        : {
            marketing: 'Support purchase decisions through the user-reviewed offer and conversion path.',
            successIn30Days: 'Establish a baseline for purchase-intent signals and conversion-path completion from real data.',
          }
    }
    if (normalizedGoal.includes('traffic')) {
      return ar
        ? {
            marketing: 'جذب زيارات ذات صلة إلى الوجهة التي راجعها المستخدم وقياس جودة الزيارة.',
            successIn30Days: 'تحديد خط أساس للزيارات ذات الصلة وجودة التفاعل من بيانات حقيقية.',
          }
        : {
            marketing: 'Drive relevant visits to the user-reviewed destination and measure visit quality.',
            successIn30Days: 'Establish a baseline for relevant visits and engagement quality from real data.',
          }
    }
    if (normalizedGoal.includes('awareness')) {
      return ar
        ? {
            marketing: 'بناء وعي قابل للقياس لدى الجمهور والقنوات اللذين راجعهما المستخدم.',
            successIn30Days: 'تحديد خط أساس للوصول والتفاعل ذي الصلة من بيانات حقيقية.',
          }
        : {
            marketing: 'Build measurable awareness with the user-reviewed audience and channels.',
            successIn30Days: 'Establish a baseline for relevant reach and engagement from real data.',
          }
    }
    return null
  })()

  return objective ? { ...value, ...objective } : value
}

function firstPlatformLabel(ctx: NormalizedPlatformContext): string {
  return ctx.fallbackLabel || 'Instagram'
}

function hasUsefulText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length >= 3
}

function latinLetterCount(value: string): number {
  return (value.match(/[A-Za-z]/g) || []).length
}

function isEnglishHeavyForArabicText(value: string): boolean {
  if (!value.trim()) return false
  const latin = latinLetterCount(value)
  if (latin < 18) return false
  const arabic = (value.match(/[\u0600-\u06FF]/g) || []).length
  return arabic === 0 || latin > arabic * 2
}

function extractBrandFromCampaignName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\b(?:paid\s+planning\s+brief|paid\s+strategy|full\s+strategy|organic\s+growth\s+strategy|organic\s+strategy|campaign\s+strategy|marketing\s+strategy)\b/gi, '')
    .replace(/\b(?:for|of)\b/gi, '')
    .replace(/[—–\-:|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function guardCampaignName(value: unknown, strategyType?: string | null, language?: string | null): unknown {
  if (!isArabicLanguage(language) || typeof value !== 'string') return value
  if (!isEnglishHeavyForArabicText(value)) return value

  const brand = extractBrandFromCampaignName(value) || 'العلامة'
  if (strategyType === 'paid') return `بريف تخطيط مدفوع لـ ${brand}`
  if (strategyType === 'full') return `استراتيجية كاملة لـ ${brand}`
  return `استراتيجية نمو عضوي لـ ${brand}`
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
      en: 'Not enough data: collect a real offer detail, service example, product visual, customer quote, or compliance-safe proof before using stronger claims.',
      ar: 'لا توجد بيانات كافية: اجمع تفصيلًا حقيقيًا للعرض أو مثال خدمة أو أصل منتج أو اقتباس عميل أو إثباتًا آمنًا قبل استخدام ادعاءات أقوى.',
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
      en: 'A real visual of the offer, service, product, or customer context is needed before production.',
      ar: 'يلزم أصل بصري حقيقي للعرض أو الخدمة أو المنتج أو سياق العميل قبل الإنتاج.',
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

function isGenericStrategyHook(value: unknown): boolean {
  return hasGenericMarketingHook(value)
}

function firstAudienceNeed(output: JsonObject): {
  segment: string
  pain: string
  objection: string
  desiredOutcome: string
} | null {
  const segments = Array.isArray(output.audienceSegmentsDetailed)
    ? output.audienceSegmentsDetailed
    : []
  for (const item of segments) {
    if (!isObject(item)) continue
    const segment = typeof item.segment === 'string' ? item.segment.trim() : ''
    const pain = typeof item.pain === 'string' ? item.pain.trim() : ''
    const objection = typeof item.objection === 'string' ? item.objection.trim() : ''
    const desiredOutcome = typeof item.desiredOutcome === 'string' ? item.desiredOutcome.trim() : ''
    if (segment && pain) return { segment, pain, objection, desiredOutcome }
  }
  return null
}

function groundedHookFallback(output: JsonObject, language?: string | null, ordinal = 0): string {
  const audienceNeed = firstAudienceNeed(output)
  if (audienceNeed) {
    const arFallbacks = [
      `ابدأ من احتياج ${audienceNeed.segment}: ${audienceNeed.pain}`,
      `وضّح كيف يعالج سير العمل مشكلة ${audienceNeed.pain} لدى ${audienceNeed.segment} دون وعد بنتيجة غير مثبتة.`,
      audienceNeed.objection
        ? `جاوب بوضوح عن اعتراض ${audienceNeed.segment}: ${audienceNeed.objection}`
        : `حوّل مشكلة ${audienceNeed.pain} إلى قائمة تحقق عملية قابلة للحفظ.`,
      audienceNeed.desiredOutcome
        ? `قارن الوضع الحالي بالنتيجة المطلوبة لدى ${audienceNeed.segment}: ${audienceNeed.desiredOutcome}`
        : `قارن الوضع الحالي بالمسار المقترح لدى ${audienceNeed.segment}.`,
      `اشرح الخطوة التالية التي يستطيع ${audienceNeed.segment} مراجعتها بعد مواجهة ${audienceNeed.pain}.`,
    ]
    const enFallbacks = [
      `Lead with the documented need for ${audienceNeed.segment}: ${audienceNeed.pain}`,
      `Explain how the workflow addresses ${audienceNeed.pain} for ${audienceNeed.segment} without promising an unverified result.`,
      audienceNeed.objection
        ? `Answer the documented objection from ${audienceNeed.segment}: ${audienceNeed.objection}`
        : `Turn ${audienceNeed.pain} into a practical checklist worth saving.`,
      audienceNeed.desiredOutcome
        ? `Compare the current workflow with the outcome ${audienceNeed.segment} wants: ${audienceNeed.desiredOutcome}`
        : `Compare the current workflow with the proposed path for ${audienceNeed.segment}.`,
      `Explain the next reviewable step ${audienceNeed.segment} can take after encountering ${audienceNeed.pain}.`,
    ]
    const fallbacks = isArabicLanguage(language) ? arFallbacks : enFallbacks
    return fallbacks[ordinal % fallbacks.length]
  }
  return isArabicLanguage(language)
    ? 'اربط الرسالة بموقف الشريحة واعتراضها المحدد قبل تقديم العرض.'
    : 'Tie the message to the segment’s specific situation and objection before presenting the offer.'
}

function groundedCtaFallback(output: JsonObject, language?: string | null, ordinal = 0): string {
  const audienceNeed = firstAudienceNeed(output)
  if (!audienceNeed) return safeReviewCta(String(ordinal), language)

  const arFallbacks = [
    `راجع أثر ${audienceNeed.pain} في سير العمل الحالي.`,
    audienceNeed.desiredOutcome
      ? `قارن المسار الحالي بالنتيجة المطلوبة: ${audienceNeed.desiredOutcome}`
      : 'قارن المسار الحالي بالخطوة المقترحة.',
    `احفظ قائمة التحقق الخاصة بـ ${audienceNeed.pain}.`,
    'راجع ما يتضمنه العرض قبل اتخاذ الخطوة التالية.',
    `أكّد ملاءمة هذا المسار لـ ${audienceNeed.segment}.`,
  ]
  const enFallbacks = [
    `Review how ${audienceNeed.pain} affects the current workflow.`,
    audienceNeed.desiredOutcome
      ? `Compare the current workflow with the desired outcome: ${audienceNeed.desiredOutcome}`
      : 'Compare the current workflow with the proposed next step.',
    `Save the checklist for ${audienceNeed.pain}.`,
    'Review what the offer includes before taking the next step.',
    `Confirm whether this path fits ${audienceNeed.segment}.`,
  ]
  const fallbacks = isArabicLanguage(language) ? arFallbacks : enFallbacks
  return fallbacks[ordinal % fallbacks.length]
}

function guardGenericStrategyHooks(output: JsonObject, language?: string | null): void {
  let genericOrdinal = 0
  let genericCtaOrdinal = 0
  const nextFallback = () => groundedHookFallback(output, language, genericOrdinal++)
  const nextCtaFallback = () => groundedCtaFallback(output, language, genericCtaOrdinal++)
  const guardHookItem = (item: unknown): unknown => {
    if (typeof item === 'string') return isGenericStrategyHook(item) ? nextFallback() : item
    if (!isObject(item)) return item
    const guarded = { ...item }
    for (const key of ['hook', 'text', 'message', 'coreMessage', 'keyMessage']) {
      if (isGenericStrategyHook(guarded[key])) guarded[key] = nextFallback()
    }
    if (isGenericStrategyHook(guarded.cta)) guarded.cta = nextCtaFallback()
    return guarded
  }

  if (Array.isArray(output.topHooks)) output.topHooks = output.topHooks.map(guardHookItem)
  if (Array.isArray(output.hooks)) output.hooks = output.hooks.map(guardHookItem)
  if (Array.isArray(output.ctaVariations)) {
    output.ctaVariations = output.ctaVariations.map(item => (
      isGenericStrategyHook(item) ? nextCtaFallback() : item
    ))
  }
  if (Array.isArray(output.contentAnglesDetailed)) {
    output.contentAnglesDetailed = output.contentAnglesDetailed.map(guardHookItem)
  }
  if (Array.isArray(output.audienceSegmentsDetailed)) {
    output.audienceSegmentsDetailed = output.audienceSegmentsDetailed.map(guardHookItem)
  }
  if (Array.isArray(output.weeklyExecutionPlan)) {
    output.weeklyExecutionPlan = output.weeklyExecutionPlan.map(guardHookItem)
  }
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

function fallbackContentAngle(index: number, ctx: NormalizedPlatformContext, language?: string | null): JsonObject {
  const ar = isArabicLanguage(language)
  const platform = firstPlatformLabel(ctx)
  return ar
    ? {
        title: `فرضية اتجاه المحتوى ${index + 1}`,
        hook: `ما الرسالة التي يجب التحقق منها في اتجاه المحتوى ${index + 1}؟`,
        pain: 'لا توجد بيانات كافية لاعتماد مشكلة إضافية كحقيقة؛ يلزم تأكيدها مع الجمهور.',
        desiredOutcome: 'تحويل هذه الفرضية إلى اتجاه واضح قابل للمراجعة قبل إنشاء المسودة.',
        objection: 'اعتراض المشتري يحتاج إلى تحقق قبل الإنتاج.',
        format: 'منشور اجتماعي قصير للمراجعة',
        platform,
        cta: 'راجع ملاءمة الرسالة',
        asset: 'أصل بصري حقيقي للعرض أو الخدمة أو المنتج قبل الإنتاج.',
        funnelStage: 'awareness',
        proofNeeded: 'لا توجد بيانات كافية: اجمع تفصيلًا حقيقيًا أو إثباتًا موثقًا قبل استخدام ادعاء أقوى.',
        responseHandoff: 'تأكيد مسؤول الرد وخطوة المتابعة قبل توجيه أي طلبات إلى هذا الاتجاه.',
        reviewPoint: 'مراجعة وضوح الرسالة وتوفر الإثبات وردود الجمهور الفعلية قبل التكرار.',
      }
    : {
        title: `Content direction hypothesis ${index + 1}`,
        hook: `Which message should direction ${index + 1} validate?`,
        pain: 'There is not enough evidence to state another audience problem as fact; validate it with the audience.',
        desiredOutcome: 'Turn this hypothesis into a clear, reviewable direction before draft creation.',
        objection: 'The buyer objection still needs validation before production.',
        format: 'Short social post for review',
        platform,
        cta: 'Review message fit',
        asset: 'A real offer, service, or product visual before production.',
        funnelStage: 'awareness',
        proofNeeded: 'Not enough data: collect a real offer detail or verified proof before making a stronger claim.',
        responseHandoff: 'Confirm the response owner and follow-up step before sending inquiries to this direction.',
        reviewPoint: 'Review message clarity, proof availability, and real audience response before repeating it.',
      }
}

function alignContentAnglesToCount(
  value: unknown,
  ctx: NormalizedPlatformContext,
  targetCount: number,
  exact: boolean,
  language?: string | null,
): unknown[] {
  const output = Array.isArray(value) ? value.filter(isObject) : []
  if (exact && output.length > targetCount) output.length = targetCount
  while (output.length < targetCount) {
    output.push(fallbackContentAngle(output.length, ctx, language))
  }
  return output
}

function fallbackAudienceSegment(index: number, ctx: NormalizedPlatformContext, language?: string | null): JsonObject {
  const ar = isArabicLanguage(language)
  const platform = firstPlatformLabel(ctx)
  return ar
    ? {
        segment: `شريحة جمهور مفترضة ${index + 1} للمراجعة`,
        situation: 'تفاصيل هذه الشريحة غير مكتملة في Brand Brain وتحتاج إلى مقابلات أو بيانات فعلية.',
        pain: 'المشكلة المحددة لهذه الشريحة تحتاج إلى تحقق قبل اعتمادها.',
        desiredOutcome: 'تحديد احتياج عملي ورسالة مناسبة بعد التحقق.',
        objection: 'الاعتراض الشرائي غير مؤكد بعد.',
        message: 'رسالة تعليمية محايدة تُراجع قبل تحويلها إلى محتوى.',
        platform,
        format: 'منشور تعليمي قصير',
        cta: 'راجع ملاءمة الرسالة',
      }
    : {
        segment: `Audience hypothesis ${index + 1} to review`,
        situation: 'This segment is not fully described in Brand Brain and needs interviews or real data.',
        pain: 'The segment-specific problem needs validation before it is treated as fact.',
        desiredOutcome: 'Confirm a practical need and suitable message after validation.',
        objection: 'The buying objection is not verified yet.',
        message: 'A neutral educational message to review before content production.',
        platform,
        format: 'Short educational post',
        cta: 'Review message fit',
      }
}

function ensureAudienceSegmentsMinimum(
  value: unknown,
  ctx: NormalizedPlatformContext,
  language?: string | null,
): unknown[] {
  const output = Array.isArray(value) ? value.filter(isObject) : []
  while (output.length < 2) output.push(fallbackAudienceSegment(output.length, ctx, language))
  return output
}

function alignWeeklyExecutionPlanToOrganicCount(
  weeklyPlan: unknown,
  contentAngles: unknown,
  ctx: NormalizedPlatformContext,
  targetCount?: number | null,
  exactCount = false,
  language?: string | null,
): unknown {
  if (!targetCount || targetCount <= 0 || !Array.isArray(contentAngles) || contentAngles.length === 0) {
    return weeklyPlan
  }
  const currentCount = weeklyDeliverableCount(weeklyPlan)
  const requiredWeekCount = Math.min(4, targetCount)
  if (currentCount === targetCount && Array.isArray(weeklyPlan) && weeklyPlan.length >= requiredWeekCount) return weeklyPlan

  const ar = isArabicLanguage(language)
  const existingWeeks = Array.isArray(weeklyPlan) ? weeklyPlan.filter(isObject) : []
  const buckets = distributeAnglesAcrossWeeks(contentAngles, targetCount)

  const generatedWeeks = buckets.map((bucket, index) => {
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

  if (exactCount || existingWeeks.length === 0) return generatedWeeks
  if (existingWeeks.length >= requiredWeekCount) return existingWeeks

  return [
    ...existingWeeks,
    ...generatedWeeks.slice(existingWeeks.length, requiredWeekCount),
  ]
}

function defaultOrganicKpis(language?: string | null): JsonObject[] {
  if (isArabicLanguage(language)) {
    return [
      {
        metric: 'إجراءات تحويل مؤهلة',
        target: 'تحديد خط أساس بعد أول ٣٠ يومًا',
        timeframe: 'أول ٣٠ يومًا',
        isHypothesis: true,
      },
      {
        metric: 'تفاعل مع محتوى العرض',
        target: 'تحديد خط أساس بعد مراجعة أول شهر',
        timeframe: 'أول ٣٠ يومًا',
        isHypothesis: true,
      },
    ]
  }

  return [
    {
      metric: 'Qualified conversion actions',
      target: 'Baseline needed after the first 30 days',
      timeframe: 'First 30 days',
      isHypothesis: true,
    },
    {
      metric: 'Offer-content engagement',
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
        userMindset: 'يعرف الاحتياج العام لكنه لم يحدد بعد معايير الاختيار المناسبة.',
        message: 'اشرح المشكلة أو الاحتياج بلغة واضحة دون وعود أو نتائج غير مثبتة.',
        contentType: 'منشور تعليمي قصير',
        platform,
        cta: 'تعرّف على التفاصيل',
        successMetric: 'تفاعل نوعي يحتاج إلى خط أساس',
        nextStep: 'توجيه المهتم إلى شرح واضح للعرض أو الخدمة بعد مراجعة الرسالة.',
        productArea: 'التوعية بالاحتياج',
      },
      {
        stage: 'consideration',
        userMindset: 'يقارن بين البدائل ويحتاج فهم ما يتضمنه العرض وما لا يتضمنه.',
        message: 'اشرح تفاصيل العرض ومعايير الملاءمة والقيود دون ادعاء تفوق مطلق.',
        contentType: 'كاروسيل أو منشور مقارنة تعليمية',
        platform,
        cta: 'راجع ما يتضمنه العرض',
        successMetric: 'اهتمام مؤهل يحتاج إلى خط أساس',
        nextStep: 'تأهيل الاستفسار بسؤال واحد مرتبط بالاحتياج الفعلي للعميل.',
        productArea: 'شرح العرض وتأهيل الاهتمام',
      },
      {
        stage: 'conversion',
        userMindset: 'يريد معرفة الخطوة التالية بوضوح قبل التواصل أو الحجز أو الشراء.',
        message: 'اجعل إجراء التحويل وما سيحدث بعده واضحين دون خلق التزام أو نتيجة غير مضمونة.',
        contentType: 'منشور CTA واضح',
        platform,
        cta: 'استفسر عن الخطوة التالية',
        successMetric: 'إجراءات تحويل تحتاج إلى خط أساس',
        nextStep: 'تحديد مسؤول الرد ورسالة التأكيد وخطوة المتابعة قبل توسيع النشاط.',
        productArea: 'تحويل ومتابعة',
      },
      {
        stage: 'followUp',
        userMindset: 'تفاعل سابقًا لكنه يحتاج تذكيرًا عمليًا لا ضغطًا بيعيًا.',
        message: 'ذكّره بالاحتياج أو الفائدة العملية وبالخطوة التالية دون ضغط أو وعود.',
        contentType: 'رسالة متابعة أو منشور إعادة تذكير',
        platform,
        cta: 'تابع المعلومات',
        successMetric: 'استجابات متابعة تحتاج إلى خط أساس',
        nextStep: 'تصنيف الردود حسب الجاهزية ثم تحديد المتابعة اليدوية المناسبة.',
        productArea: 'متابعة ما بعد الاهتمام',
      },
    ]
  }

  return [
    {
      stage: 'awareness',
      userMindset: 'Aware of the general need but has not yet defined the right selection criteria.',
      message: 'Explain the need clearly without unsupported promises or outcomes.',
      contentType: 'Short educational post',
      platform,
      cta: 'Learn the details',
      successMetric: 'Qualitative engagement needs a baseline',
      nextStep: 'Send interested users to a clear explanation of the offer after reviewing the message.',
      productArea: 'Need education',
    },
    {
      stage: 'consideration',
      userMindset: 'Comparing alternatives and needs clarity on what the offer includes and excludes.',
      message: 'Explain the offer, fit criteria, and constraints without absolute superiority claims.',
      contentType: 'Educational comparison post',
      platform,
      cta: 'Review what is included',
      successMetric: 'Qualified interest needs a baseline',
      nextStep: 'Qualify the inquiry with one question tied to the customer need.',
      productArea: 'Offer explanation',
    },
    {
      stage: 'conversion',
      userMindset: 'Wants to know the next step before contacting, booking, or buying.',
      message: 'Make the conversion action and follow-up clear without implying guaranteed outcomes.',
      contentType: 'Clear CTA post',
      platform,
      cta: 'Ask about the next step',
      successMetric: 'Conversion actions need a baseline',
      nextStep: 'Confirm response owner, confirmation message, and follow-up step before scaling.',
      productArea: 'Conversion and handoff',
    },
    {
      stage: 'followUp',
      userMindset: 'Previously engaged and needs a practical reminder rather than sales pressure.',
      message: 'Remind them of the practical need or benefit and the next step without pressure.',
      contentType: 'Follow-up message or reminder post',
      platform,
      cta: 'Continue learning',
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
    const ar = isArabicLanguage(language)
    const deliverables = Array.isArray(item.deliverables)
      ? item.deliverables
          .filter(hasUsefulText)
          .map((deliverable) => {
            const text = String(deliverable).trim()
            return readLeadingCount(text) > 1 || /^1\b/.test(text)
              ? text
              : ar ? `1 مهمة تخطيط: ${text}` : `1 planning task: ${text}`
          })
      : []

    return {
      ...item,
      deliverables: deliverables.length
        ? deliverables
        : [ar ? '1 مهمة تخطيط قابلة للمراجعة قبل التنفيذ' : '1 reviewable planning task before execution'],
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
          mustHave: ['أصل بصري حقيقي للعرض أو الخدمة أو المنتج قبل تحويل الاتجاهات إلى مسودات.'],
          niceToHave: ['شرح بصري قابل للمراجعة يوضح ما يتضمنه العرض دون ادعاءات غير مثبتة.'],
          forAds: ['أصول مدفوعة لاحقة فقط بعد تأكيد الميزانية، التتبع، والحسابات المتصلة.'],
          forOrganic: ['خلفيات أو صور عملية لكل اتجاه منشور في أول 30 يومًا.'],
          forProof: ['إثباتات موثقة أو ملاحظات عملاء حقيقية قبل أي ادعاء أداء.'],
          nextToCreate: ['تجهيز مثال حقيقي للعرض ومكتبة أصول بصرية مرتبطة بالخدمة أو المنتج قبل الإنتاج.'],
          canStartWithoutNote: 'يمكن بدء التخطيط العضوي، لكن الإنتاج يحتاج أصولًا وإثباتات مراجعة.',
        }
      : {
          mustHave: ['A real offer, service, product, or customer-context visual before turning directions into drafts.'],
          niceToHave: ['A reviewable visual explanation of what the offer includes without unsupported claims.'],
          forAds: ['Paid assets only after budget, tracking, and connected-account readiness are confirmed.'],
          forOrganic: ['Backgrounds or practical visuals for each first-30-day post direction.'],
          forProof: ['Verified proof or real customer feedback before any performance or testimonial claim.'],
          nextToCreate: ['Prepare a real offer example and a service- or product-specific visual library before production.'],
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

function guardAgencyOperatingSections(
  output: JsonObject,
  language?: string | null,
  allowedCompetitors?: string[] | null,
): void {
  const ar = isArabicLanguage(language)
  const gap = ar ? 'لا توجد بيانات كافية؛ يحتاج هذا العنصر إلى تأكيد قبل التنفيذ.' : 'Not enough data; confirm this item before execution.'

  const measurement = isObject(output.measurementPlan) ? { ...output.measurementPlan } : {}
  output.measurementPlan = {
    ...measurement,
    primaryOutcome: hasUsefulText(measurement.primaryOutcome) ? measurement.primaryOutcome : (ar ? 'التحقق من جودة الطلب أو الإجراء التجاري الأساسي.' : 'Validate the quality of the primary commercial action.'),
    baselineStatus: hasUsefulText(measurement.baselineStatus) ? measurement.baselineStatus : (ar ? 'لا يوجد خط أساس موثق؛ الدورة الأولى تنشئ خط الأساس.' : 'No verified baseline exists; the first cycle establishes it.'),
    eventsToTrack: Array.isArray(measurement.eventsToTrack) && measurement.eventsToTrack.length ? measurement.eventsToTrack : [ar ? 'مصدر الطلب والإجراء التالي وحالة المتابعة.' : 'Inquiry source, next action, and follow-up status.'],
    attributionRule: hasUsefulText(measurement.attributionRule) ? measurement.attributionRule : (ar ? 'يُربط كل طلب بآخر مصدر يمكن إثباته دون افتراض.' : 'Tie each inquiry to the last verifiable source without guessing.'),
    reportingCadence: hasUsefulText(measurement.reportingCadence) ? measurement.reportingCadence : (ar ? 'مراجعة تشغيلية أسبوعية وملخص شهري.' : 'Weekly operating review and monthly summary.'),
    owner: hasUsefulText(measurement.owner) ? measurement.owner : gap,
    noDataDecision: hasUsefulText(measurement.noDataDecision) ? measurement.noDataDecision : (ar ? 'استمر في جمع خط الأساس ولا توسّع أو تلغي بناءً على عينة غير كافية.' : 'Keep collecting a baseline; do not scale or cancel from insufficient evidence.'),
  }

  const cadence = isObject(output.operatingCadence) ? { ...output.operatingCadence } : {}
  output.operatingCadence = {
    ...cadence,
    daily: Array.isArray(cadence.daily) && cadence.daily.length ? cadence.daily : [ar ? 'مراقبة الردود والتعليقات وحالات فشل النشر.' : 'Monitor replies, comments, and publishing failures.'],
    weekly: Array.isArray(cadence.weekly) && cadence.weekly.length ? cadence.weekly : [ar ? 'مراجعة جودة الإشارات والاعتراضات وحالة الأصول قبل تعديل الخطة.' : 'Review signal quality, objections, and asset readiness before changing the plan.'],
    monthly: Array.isArray(cadence.monthly) && cadence.monthly.length ? cadence.monthly : [ar ? 'اعتماد التعلمات الموثقة فقط وتحديث Brand Brain بعد المراجعة.' : 'Approve only evidenced learnings and update Brand Brain after review.'],
    approvalSla: hasUsefulText(cadence.approvalSla) ? cadence.approvalSla : (ar ? 'يحتاج زمن الموافقة إلى اتفاق تشغيلي.' : 'Approval timing needs an operating agreement.'),
    responseSla: hasUsefulText(cadence.responseSla) ? cadence.responseSla : (ar ? 'يحتاج زمن الرد إلى اتفاق مع مسؤول المتابعة.' : 'Response timing needs agreement with the follow-up owner.'),
    owners: Array.isArray(cadence.owners) && cadence.owners.length ? cadence.owners : [gap],
  }

  const experiments = Array.isArray(output.experimentBacklog) ? output.experimentBacklog.filter(isObject) : []
  const fallbackExperiments: JsonObject[] = ar
    ? [
        { hypothesis: 'تحديد شريحة واحدة سيجعل جودة الردود أسهل في التقييم.', audience: 'الشريحة الأولى في الاستراتيجية', variable: 'صياغة الرسالة', successSignal: 'ردود مرتبطة بالمشكلة المقصودة', minimumEvidence: 'إشارات حقيقية قابلة للمراجعة قبل القرار', decisionRule: 'استمر عند وضوح الملاءمة؛ عدّل الرسالة عند تكرار الالتباس.', priority: 'now', dependency: 'تأكيد الشريحة ومسؤول الرد' },
        { hypothesis: 'معالجة اعتراض واحد ستوضح سبب التردد.', audience: 'شريحة لديها اعتراض موثق أو فرضية اعتراض', variable: 'الاعتراض المعالج', successSignal: 'أسئلة أو ردود تظهر فهم العرض', minimumEvidence: 'ردود حقيقية لا افتراضات', decisionRule: 'احتفظ بالزاوية إذا تحسن وضوح الأسئلة؛ أوقفها إذا ظلت غير مرتبطة بالعرض.', priority: 'next', dependency: 'توثيق الاعتراض' },
        { hypothesis: 'إضافة أصل حقيقي ستجعل الرسالة أكثر قابلية للتصديق.', audience: 'الجمهور ذي فجوة الثقة', variable: 'الأصل البصري أو الإثبات', successSignal: 'تفاعل نوعي أو طلب معلومات مرتبطة بالأصل', minimumEvidence: 'أصل موثق وردود فعل قابلة للمراجعة', decisionRule: 'كرر الأصل إذا دعم أسئلة مؤهلة؛ استبدله إذا سبب التباسًا.', priority: 'later', dependency: 'تجهيز أصل حقيقي ومراجعته' },
      ]
    : [
        { hypothesis: 'A single specific segment will make response quality easier to evaluate.', audience: 'The first strategy segment', variable: 'Message framing', successSignal: 'Replies connected to the intended problem', minimumEvidence: 'Reviewable real signals before a decision', decisionRule: 'Continue when fit is clear; revise when confusion repeats.', priority: 'now', dependency: 'Confirm the segment and response owner' },
        { hypothesis: 'Addressing one objection will clarify why prospects hesitate.', audience: 'A segment with a documented or explicitly hypothetical objection', variable: 'Objection addressed', successSignal: 'Questions or replies that show offer understanding', minimumEvidence: 'Real replies, not assumptions', decisionRule: 'Keep the angle when questions become clearer; stop when replies remain unrelated.', priority: 'next', dependency: 'Confirm the objection' },
        { hypothesis: 'A real asset will make the message more credible.', audience: 'The segment with the clearest trust gap', variable: 'Visual or proof asset', successSignal: 'Qualitative engagement or asset-specific inquiries', minimumEvidence: 'A verified asset and reviewable response', decisionRule: 'Reuse when it supports qualified questions; replace when it causes confusion.', priority: 'later', dependency: 'Prepare and review a real asset' },
      ]
  output.experimentBacklog = [...experiments, ...fallbackExperiments].slice(0, Math.max(3, experiments.length))

  const rules = Array.isArray(output.decisionRules) ? output.decisionRules.filter(isObject) : []
  const fallbackRules: JsonObject[] = ar
    ? [
        { signal: 'جودة الردود أو الطلبات', continueWhen: 'الردود مرتبطة بالشريحة والمشكلة المقصودة.', iterateWhen: 'تتكرر أسئلة توضح غموض الرسالة أو العرض.', stopWhen: 'تظل الردود غير مرتبطة بعد تعديل موثق.', nextAction: 'حدّث الرسالة أو التأهيل ثم راقب دورة أخرى.' },
        { signal: 'سلامة النشر والأصول', continueWhen: 'تؤكد المنصة النشر وتظهر الوسائط صحيحة.', iterateWhen: 'توجد مشكلة تنسيق أو فشل يمكن إصلاحه.', stopWhen: 'تفشل الصلاحية أو الموافقة أو سلامة الادعاء.', nextAction: 'أوقف الوجهة المتأثرة واطلب مراجعة بشرية.' },
        { signal: 'كفاية بيانات القرار', continueWhen: 'توجد إشارات حقيقية قابلة للمراجعة.', iterateWhen: 'الإشارة ضعيفة لكن الاختبار سليم.', stopWhen: 'لا يمكن قياس النتيجة أو نسبها إلى مصدر.', nextAction: 'أصلح القياس قبل التوسع.' },
      ]
    : [
        { signal: 'Reply or inquiry quality', continueWhen: 'Replies match the intended segment and problem.', iterateWhen: 'Repeated questions reveal message or offer confusion.', stopWhen: 'Replies remain unrelated after a documented revision.', nextAction: 'Revise the message or qualification step, then observe another cycle.' },
        { signal: 'Publishing and asset integrity', continueWhen: 'The platform confirms publication and media renders correctly.', iterateWhen: 'A fixable format or delivery error appears.', stopWhen: 'Permission, approval, or claim-safety checks fail.', nextAction: 'Pause the affected destination and request human review.' },
        { signal: 'Decision evidence', continueWhen: 'Reviewable real signals exist.', iterateWhen: 'Signal is weak but the test ran correctly.', stopWhen: 'The outcome cannot be measured or attributed.', nextAction: 'Repair measurement before scaling.' },
      ]
  output.decisionRules = [...rules, ...fallbackRules].slice(0, Math.max(3, rules.length))

  const roadmap = Array.isArray(output.roadmap30_60_90) ? output.roadmap30_60_90.filter(isObject) : []
  const phases = ['days_1_30', 'days_31_60', 'days_61_90'] as const
  output.roadmap30_60_90 = phases.map((phase, index) => roadmap.find(item => item.phase === phase) || {
    phase,
    objective: ar ? ['إنشاء خط أساس وتشغيل أول دورة مراجعة.', 'تحسين الرسائل والأصول بناءً على إشارات موثقة.', 'توسيع ما ثبت فقط مع الحفاظ على بوابات الموافقة.'][index] : ['Establish a baseline and run the first review cycle.', 'Improve messages and assets from evidenced signals.', 'Scale only validated work while keeping approval gates.'][index],
    deliverables: [ar ? 'مخرجات تشغيلية قابلة للمراجعة وليست نتيجة مضمونة.' : 'Reviewable operating outputs, not a guaranteed result.'],
    exitGate: ar ? 'لا انتقال للمرحلة التالية دون دليل وموافقة موثقين.' : 'Do not advance without documented evidence and approval.',
  })

  const competitor = isObject(output.competitorFrame) ? { ...output.competitorFrame } : {}
  const allowed = (allowedCompetitors || []).filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
  output.competitorFrame = {
    ...competitor,
    analysisStatus: allowed.length > 0 ? 'complete' : 'incomplete',
    providedCompetitors: allowed,
    differentiationHypotheses: Array.isArray(competitor.differentiationHypotheses) && competitor.differentiationHypotheses.length
      ? competitor.differentiationHypotheses
      : [ar ? 'فرضية التمايز تحتاج مقارنة موثقة قبل اعتمادها.' : 'The differentiation hypothesis needs documented comparison before adoption.'],
    researchNeeded: Array.isArray(competitor.researchNeeded) && competitor.researchNeeded.length
      ? competitor.researchNeeded
      : [ar ? 'جمع رسائل المنافسين وعروضهم وتجربة التحويل من مصادر علنية أو مدخلة من المستخدم.' : 'Collect competitor messaging, offers, and conversion experience from public or user-provided sources.'],
  }
}

function paidPlanningFallbackStrings(kind: 'pillars' | 'hooks' | 'ctas', language?: string | null): string[] {
  const ar = isArabicLanguage(language)
  if (kind === 'pillars') {
    return ar
      ? ['هدف الحملة المدفوعة', 'فرضيات الجمهور', 'زوايا الرسائل الإعلانية', 'متطلبات التتبع والجاهزية']
      : ['Paid campaign objective', 'Audience hypotheses', 'Paid message angles', 'Tracking and readiness requirements']
  }
  if (kind === 'hooks') {
    return ar
      ? ['ما المشكلة التشغيلية التي يجب اختبارها أولاً؟', 'أي رسالة تستحق اختبارًا مدفوعًا محدودًا؟', 'ما الدليل المطلوب قبل التوسيع؟', 'ما الاعتراض الذي يجب الرد عليه في الإعلان؟']
      : ['Which operating problem should be tested first?', 'Which message deserves a limited paid test?', 'What proof is needed before scaling?', 'Which objection must the ad answer?']
  }
  return ar
    ? ['راجع العرض المدفوع', 'اختبر الرسالة', 'استفسر عن العرض', 'راجع مسار التحويل']
    : ['Review the paid offer', 'Test the message', 'Ask about the offer', 'Review the conversion path']
}

function ensureMinStringArray(list: unknown, fallback: string[], min: number): unknown {
  const values = Array.isArray(list) ? list.filter(hasUsefulText).map(String) : []
  const seen = new Set(values.map(value => value.toLowerCase()))
  for (const item of fallback) {
    if (values.length >= min) break
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    values.push(item)
    seen.add(key)
  }
  return values
}

function paidPlanningContentAngles(list: unknown, ctx: NormalizedPlatformContext, language?: string | null): unknown {
  const ar = isArabicLanguage(language)
  const platform = firstPlatformLabel(ctx)
  const existing = Array.isArray(list) ? list.filter(isObject) : []
  const fallbacks: JsonObject[] = ar
    ? [
        {
          title: 'اختبار مشكلة التشغيل الأساسية',
          hook: 'قبل الإنفاق، ما المشكلة التي تستحق الاختبار؟',
          pain: 'عدم وضوح أي رسالة ستجذب طلبات مؤهلة.',
          desiredOutcome: 'تحديد زاوية اختبار مدفوعة آمنة وقابلة للمراجعة.',
          objection: 'الخوف من إنفاق ميزانية قبل وضوح الرسالة.',
          format: 'إعلان صورة أو فيديو قصير للمراجعة',
          platform,
          cta: 'راجع مسار التحويل',
          asset: 'أصل بصري حقيقي للعرض أو الخدمة أو المنتج قبل الإنتاج.',
          funnelStage: 'consideration',
          proofNeeded: 'لا توجد بيانات كافية: اجمع دليلًا أو مثالًا عمليًا قبل ادعاءات أقوى.',
          responseHandoff: 'تأكيد مسؤول الرد وسؤال التأهيل قبل أي اختبار مدفوع.',
          reviewPoint: 'مراجعة وضوح الرسالة ومسار التحويل قبل إطلاق أي إعلان.',
        },
        {
          title: 'اختبار اعتراض الجمهور',
          hook: 'ما الاعتراض الذي يمنع الطلب الآن؟',
          pain: 'اعتراضات السعر أو الثقة أو ملاءمة الحل غير مؤكدة.',
          desiredOutcome: 'صياغة رد إعلاني يختبر اعتراضًا واحدًا فقط.',
          objection: 'هل الحل مناسب قبل مشاركة بيانات التواصل؟',
          format: 'نسخة إعلان قصيرة للمراجعة',
          platform,
          cta: 'استفسر عن العرض',
          asset: 'مثال استخدام أو لقطة منتج قابلة للمراجعة.',
          funnelStage: 'conversion',
          proofNeeded: 'إثبات موثق أو ملاحظة عميل حقيقية قبل استخدام ادعاءات أقوى.',
          responseHandoff: 'تحديد رسالة المتابعة بعد طلب العرض.',
          reviewPoint: 'قياس جودة الطلبات بعد توفر بيانات فعلية.',
        },
        {
          title: 'فرضية جمهور مدفوعة',
          hook: 'أي شريحة يجب اختبارها أولًا؟',
          pain: 'استهداف واسع قد يبدد الميزانية.',
          desiredOutcome: 'تحويل الشريحة إلى فرضية اختبار محددة.',
          objection: 'هل الجمهور المختار هو صاحب القرار؟',
          format: 'زاوية إعلان مخصصة لشريحة واحدة',
          platform,
          cta: 'راجع الملاءمة',
          asset: 'وصف شريحة ورسالة مؤهلة قبل الإنتاج.',
          funnelStage: 'awareness',
          proofNeeded: 'بيانات أداء أو ردود حقيقية بعد الاختبار الأول.',
          responseHandoff: 'تأهيل الردود حسب الدور والاحتياج.',
          reviewPoint: 'عدم توسيع الاستهداف قبل قراءة النتائج.',
        },
        {
          title: 'جاهزية التتبع قبل الإنفاق',
          hook: 'لا تختبر إعلانًا لا يمكنك قياسه.',
          pain: 'غياب التتبع يجعل نتيجة الإنفاق غير قابلة للتعلم.',
          desiredOutcome: 'تحديد متطلبات القياس قبل أي إطلاق.',
          objection: 'هل يمكن معرفة مصدر الطلب؟',
          format: 'قائمة تحقق مدفوعة للمراجعة',
          platform,
          cta: 'أكمل متطلبات التتبع',
          asset: 'قائمة تحقق للوجهة والتحويل والتتبع.',
          funnelStage: 'conversion',
          proofNeeded: 'تأكيد وجهة التحويل والتتبع قبل التنفيذ.',
          responseHandoff: 'ربط كل طلب بمصدره يدويًا أو عبر التتبع قبل التوسيع.',
          reviewPoint: 'التحقق من الجاهزية قبل صرف أي ميزانية.',
        },
      ]
    : [
        {
          title: 'Core paid problem test',
          hook: 'Before spending, which problem is worth testing?',
          pain: 'The strongest paid message is not validated yet.',
          desiredOutcome: 'Choose one safe paid test angle for review.',
          objection: 'Concern about spending before message clarity.',
          format: 'Image or short-video ad concept for review',
          platform,
          cta: 'Review the conversion path',
          asset: 'A real visual or detail of the offer, service, or product before production.',
          funnelStage: 'consideration',
          proofNeeded: 'Not enough data: collect real offer details or verified proof before stronger claims.',
          responseHandoff: 'Confirm response owner and qualification question before any paid test.',
          reviewPoint: 'Review message clarity and conversion path before launching ads.',
        },
        {
          title: 'Audience objection test',
          hook: 'Which objection is blocking demand now?',
          pain: 'Price, trust, and fit concerns are not validated.',
          desiredOutcome: 'Write one ad response to one objection.',
          objection: 'Is this right for me before I share contact details?',
          format: 'Short ad-copy variation for review',
          platform,
          cta: 'Ask about the offer',
          asset: 'Use-case example or product screenshot.',
          funnelStage: 'conversion',
          proofNeeded: 'Verified proof or real feedback before stronger claims.',
          responseHandoff: 'Define the follow-up message after an offer inquiry.',
          reviewPoint: 'Measure lead quality only after real data exists.',
        },
        {
          title: 'Paid audience hypothesis',
          hook: 'Which segment should be tested first?',
          pain: 'Broad targeting can waste budget.',
          desiredOutcome: 'Turn one segment into a narrow test hypothesis.',
          objection: 'Is this segment the decision maker?',
          format: 'Segment-specific ad angle',
          platform,
          cta: 'Review fit',
          asset: 'Segment description and qualified message.',
          funnelStage: 'awareness',
          proofNeeded: 'Real performance data after the first test.',
          responseHandoff: 'Qualify replies by role and need.',
          reviewPoint: 'Do not expand targeting before reading results.',
        },
        {
          title: 'Tracking readiness before spend',
          hook: 'Do not run an ad you cannot measure.',
          pain: 'Missing tracking makes spend impossible to learn from.',
          desiredOutcome: 'Define measurement requirements before launch.',
          objection: 'Can we identify where the lead came from?',
          format: 'Paid readiness checklist for review',
          platform,
          cta: 'Complete tracking requirements',
          asset: 'Checklist for destination, conversion, and tracking.',
          funnelStage: 'conversion',
          proofNeeded: 'Confirm conversion destination and tracking before execution.',
          responseHandoff: 'Connect every inquiry to source manually or through tracking before scaling.',
          reviewPoint: 'Verify readiness before spending budget.',
        },
      ]

  return [...existing, ...fallbacks].slice(0, Math.max(4, existing.length))
}

function paidPlanningWeeklyPlan(list: unknown, ctx: NormalizedPlatformContext, language?: string | null): unknown {
  const ar = isArabicLanguage(language)
  const platform = firstPlatformLabel(ctx)
  const existing = Array.isArray(list) ? list.filter(isObject) : []
  if (existing.length >= 4) return list

  const fallbacks: JsonObject[] = ar
    ? [
        { week: 1, objective: 'تأكيد هدف الحملة ومسار التحويل', keyMessage: 'التخطيط المدفوع يبدأ من وضوح التحويل قبل الإنفاق.', deliverables: ['1 مهمة تخطيط: مراجعة هدف الحملة ووجهة التحويل'], platforms: [platform], assetsNeeded: ['وجهة تحويل ومسؤول رد واضحان'], cta: 'راجع مسار التحويل', successMetric: 'جاهزية تحتاج تحققًا قبل الإنفاق', executionNote: 'لا إطلاق ولا صرف ميزانية من هذا البريف.', reviewPoints: ['تأكيد الوجهة ومسؤول المتابعة'] },
        { week: 2, objective: 'تحديد فرضيات الجمهور', keyMessage: 'اختبر شريحة محددة بدل استهداف واسع.', deliverables: ['1 مهمة تخطيط: صياغة فرضية جمهور مدفوعة'], platforms: [platform], assetsNeeded: ['وصف الشريحة والاعتراض الأساسي'], cta: 'راجع الملاءمة', successMetric: 'فرضيات جاهزة للمراجعة', executionNote: 'تظل الفرضيات غير مثبتة حتى تظهر بيانات حقيقية.', reviewPoints: ['هل الشريحة محددة وقابلة للتأهيل؟'] },
        { week: 3, objective: 'تحضير زوايا ورسائل الإعلان', keyMessage: 'كل زاوية يجب أن تختبر وعدًا واحدًا بلا مبالغة.', deliverables: ['1 مهمة تخطيط: مراجعة زوايا الإعلان والنسخ'], platforms: [platform], assetsNeeded: ['أصل بصري حقيقي للعرض أو الخدمة أو المنتج'], cta: 'استفسر عن العرض', successMetric: 'رسائل جاهزة للمراجعة', executionNote: 'لا تستخدم ادعاءات أداء أو إثباتًا غير موثق.', reviewPoints: ['وضوح الرسالة وغياب الادعاءات غير المثبتة'] },
        { week: 4, objective: 'مراجعة عوائق الإطلاق', keyMessage: 'لا يوجد إطلاق حتى تكتمل الجاهزية والتأكيد الصريح.', deliverables: ['1 مهمة تخطيط: مراجعة عوائق الإطلاق والتتبع'], platforms: [platform], assetsNeeded: ['قائمة تحقق للتتبع والحسابات'], cta: 'أكمل متطلبات الجاهزية', successMetric: 'قائمة عوائق واضحة', executionNote: 'هذا بريف تخطيط فقط وليس تنفيذًا مدفوعًا.', reviewPoints: ['التتبع، الحسابات، الموافقة، والأصول'] },
      ]
    : [
        { week: 1, objective: 'Confirm campaign objective and conversion path', keyMessage: 'Paid planning starts with conversion clarity before spend.', deliverables: ['1 planning task: review campaign objective and conversion destination'], platforms: [platform], assetsNeeded: ['Clear conversion destination and response owner'], cta: 'Review the conversion path', successMetric: 'Readiness needs validation before spend', executionNote: 'No launch or ad spend happens from this brief.', reviewPoints: ['Confirm destination and response owner'] },
        { week: 2, objective: 'Define audience hypotheses', keyMessage: 'Test a narrow segment instead of broad targeting.', deliverables: ['1 planning task: write paid audience hypothesis'], platforms: [platform], assetsNeeded: ['Segment description and main objection'], cta: 'Review fit', successMetric: 'Hypotheses ready for review', executionNote: 'Hypotheses remain unproven until real data exists.', reviewPoints: ['Is the segment specific and qualifiable?'] },
        { week: 3, objective: 'Prepare ad angles and copy', keyMessage: 'Each angle should test one claim without exaggeration.', deliverables: ['1 planning task: review ad angles and copy'], platforms: [platform], assetsNeeded: ['A real visual of the offer, service, or product'], cta: 'Ask about the offer', successMetric: 'Messages ready for review', executionNote: 'Do not use unverified proof or performance claims.', reviewPoints: ['Message clarity and claim safety'] },
        { week: 4, objective: 'Review launch blockers', keyMessage: 'No launch happens until readiness and explicit confirmation exist.', deliverables: ['1 planning task: review launch blockers and tracking'], platforms: [platform], assetsNeeded: ['Tracking and account-readiness checklist'], cta: 'Complete readiness requirements', successMetric: 'Clear blocker list', executionNote: 'This is a planning brief only, not paid execution.', reviewPoints: ['Tracking, accounts, approval, and assets'] },
      ]

  return [...existing, ...fallbacks].slice(0, Math.max(4, existing.length))
}

function guardPaidPlanningMinimums(output: JsonObject, ctx: NormalizedPlatformContext, language?: string | null): void {
  output.contentPillars = ensureMinStringArray(output.contentPillars, paidPlanningFallbackStrings('pillars', language), 3)
  output.topHooks = ensureMinStringArray(output.topHooks, paidPlanningFallbackStrings('hooks', language), 3)
  output.ctaVariations = ensureMinStringArray(output.ctaVariations, paidPlanningFallbackStrings('ctas', language), 3)
  output.contentAnglesDetailed = paidPlanningContentAngles(output.contentAnglesDetailed, ctx, language)
  output.weeklyExecutionPlan = paidPlanningWeeklyPlan(output.weeklyExecutionPlan, ctx, language)
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
  const guardedValue = guardValue(input, ctx, context.language)
  const leadGuardedValue = context.hasLeadHandling === false
    ? guardUnverifiedLeadHandling(guardedValue, context.language)
    : guardedValue
  const output = (context.hasConversionDestination === false
    ? guardUnverifiedConversionActions(leadGuardedValue, context.language)
    : leadGuardedValue) as JsonObject
  output.campaignName = guardCampaignName(output.campaignName, context.strategyType, context.language)
  output.businessObjective = guardBusinessObjectiveGoal(output.businessObjective, context.goal, context.language)

  if (context.strategyType === 'paid') {
    guardPaidPlanningMinimums(output, ctx, context.language)
  }

  output.channelMix = guardChannelMix(output.channelMix, ctx, context.strategyType)
  output.kpis = guardKpisMinimum(output.kpis, context.language)
  output.funnelStages = guardFunnelStagesMinimum(output.funnelStages, ctx, context.language)
  const bindingPostCount = typeof context.organicPostCount === 'number'
    && Number.isFinite(context.organicPostCount)
    && context.organicPostCount > 0
    ? Math.floor(context.organicPostCount)
    : null
  const existingAngleCount = Array.isArray(output.contentAnglesDetailed) ? output.contentAnglesDetailed.length : 0
  const planningDirectionCount = bindingPostCount ?? Math.max(4, existingAngleCount)
  output.contentAnglesDetailed = alignContentAnglesToCount(
    output.contentAnglesDetailed,
    ctx,
    planningDirectionCount,
    bindingPostCount !== null,
    context.language,
  )
  output.contentAnglesDetailed = guardPlatformObjectList(output.contentAnglesDetailed, ctx, context.language)
  output.contentAnglesDetailed = guardContentAnglesOperationalDepth(output.contentAnglesDetailed, context.language)
  output.audienceSegmentsDetailed = ensureAudienceSegmentsMinimum(output.audienceSegmentsDetailed, ctx, context.language)
  output.audienceSegmentsDetailed = guardPlatformObjectList(output.audienceSegmentsDetailed, ctx, context.language)
  output.funnelStages = guardPlatformObjectList(output.funnelStages, ctx, context.language)
  output.channelStrategy = guardPlatformObjectList(output.channelStrategy, ctx, context.language)
  output.weeklyExecutionPlan = guardWeeklyExecutionPlan(output.weeklyExecutionPlan, ctx)
  output.weeklyExecutionPlan = alignWeeklyExecutionPlanToOrganicCount(
    output.weeklyExecutionPlan,
    output.contentAnglesDetailed,
    ctx,
    planningDirectionCount,
    bindingPostCount !== null,
    context.language,
  )
  output.weeklyExecutionPlan = guardWeeklyExecutionOperationalDepth(output.weeklyExecutionPlan, context.language)
  output.assetRequirements = guardAssetRequirements(output.assetRequirements, context.language)
  output.readinessChecklist = guardReadinessChecklist(output.readinessChecklist, context.language)
  guardAgencyOperatingSections(output, context.language, context.allowedCompetitors)
  // Run copy specificity last: weekly alignment and fallback construction can
  // reuse legacy messages, so the final document must be checked after every
  // structural transformation has completed.
  guardGenericStrategyHooks(output, context.language)

  return output as T
}
