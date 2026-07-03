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
  output.contentAnglesDetailed = guardPlatformObjectList(output.contentAnglesDetailed, ctx)
  output.audienceSegmentsDetailed = guardPlatformObjectList(output.audienceSegmentsDetailed, ctx)
  output.funnelStages = guardPlatformObjectList(output.funnelStages, ctx)
  output.channelStrategy = guardPlatformObjectList(output.channelStrategy, ctx)
  output.weeklyExecutionPlan = guardWeeklyExecutionPlan(output.weeklyExecutionPlan, ctx)
  output.readinessChecklist = guardReadinessChecklist(output.readinessChecklist, context.language)

  return output as T
}
