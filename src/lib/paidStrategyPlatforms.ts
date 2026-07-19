import type { PaidExecutionPlatform } from '@/lib/paidExecutionObjective'

type JsonRecord = Record<string, unknown>

export interface PaidStrategyPlatformEvidence {
  approvedPlatforms: PaidExecutionPlatform[]
  planningOnlyPlatforms: string[]
  source: 'paid_planning' | 'paid_channel_mix' | 'campaign_platforms' | 'missing'
}

const EXECUTION_PLATFORM_ALIASES: Array<{
  platform: PaidExecutionPlatform
  pattern: RegExp
}> = [
  { platform: 'META', pattern: /\b(meta|facebook|instagram)\b|فيسبوك|انستغرام|إنستغرام/i },
  { platform: 'GOOGLE', pattern: /\bgoogle(?:\s+ads)?\b|جوجل/i },
]

const PLANNING_ONLY_ALIASES: Array<{ label: string; pattern: RegExp }> = [
  { label: 'TikTok Ads', pattern: /\btik\s*tok\b|تيك\s*توك/i },
  { label: 'LinkedIn Ads', pattern: /\blinked\s*in\b|لينكد\s*إن/i },
  { label: 'Pinterest Ads', pattern: /\bpinterest\b|بنترست|بينترست/i },
  { label: 'YouTube Ads', pattern: /\byou\s*tube\b|يوتيوب/i },
  { label: 'Snapchat Ads', pattern: /\bsnap\s*chat\b|سناب/i },
  { label: 'X Ads', pattern: /(^|\s)(x|twitter)(\s|$)|تويتر/i },
]

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (typeof item === 'string' && item.trim()) return [item.trim()]
    const itemRecord = record(item)
    if (!itemRecord) return []
    const candidate = itemRecord.platform
      ?? itemRecord.channel
      ?? itemRecord.name
      ?? itemRecord.label
    return typeof candidate === 'string' && candidate.trim() ? [candidate.trim()] : []
  })
}

function paidChannelMixPlatforms(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const channel = record(item)
    if (!channel) return []
    const platform = channel.platform ?? channel.channel ?? channel.name
    if (typeof platform !== 'string' || !platform.trim()) return []

    const budgetPercent = Number(channel.budgetPercent)
    const roleText = [channel.role, channel.type, channel.mode, channel.purpose]
      .filter(part => typeof part === 'string')
      .join(' ')
    const explicitlyPaid = Number.isFinite(budgetPercent) && budgetPercent > 0
      || /\b(paid|ads?|acquisition|performance)\b|مدفوع|إعلانات/i.test(roleText)

    return explicitlyPaid ? [platform.trim()] : []
  })
}

function classifyPlatforms(values: string[]) {
  const approved = new Set<PaidExecutionPlatform>()
  const planningOnly = new Set<string>()

  for (const value of values) {
    const executable = EXECUTION_PLATFORM_ALIASES.find(item => item.pattern.test(value))
    if (executable) {
      approved.add(executable.platform)
      continue
    }
    const unsupported = PLANNING_ONLY_ALIASES.find(item => item.pattern.test(value))
    if (unsupported) planningOnly.add(unsupported.label)
  }

  return {
    approvedPlatforms: [...approved],
    planningOnlyPlatforms: [...planningOnly],
  }
}

/**
 * Resolves the channels the approved strategy actually authorized for paid
 * execution through an implemented provider adapter. A connected account is
 * never allowed to silently rewrite this decision. Channels without a paid
 * API adapter remain visible as planning/export-only truth.
 */
export function resolvePaidStrategyPlatforms(input: {
  aiOutput: unknown
  campaignPlatforms?: unknown
}): PaidStrategyPlatformEvidence {
  const output = record(input.aiOutput) ?? {}
  const strategy = record(output.strategy) ?? output
  const paidPlanning = record(strategy.paidPlanning)

  const paidPlanningPlatforms = stringList(
    paidPlanning?.platforms
    ?? paidPlanning?.platformPriority
    ?? paidPlanning?.channels,
  )
  if (paidPlanningPlatforms.length > 0) {
    return { ...classifyPlatforms(paidPlanningPlatforms), source: 'paid_planning' }
  }

  const channelMixPlatforms = paidChannelMixPlatforms(strategy.channelMix)
  if (channelMixPlatforms.length > 0) {
    return { ...classifyPlatforms(channelMixPlatforms), source: 'paid_channel_mix' }
  }

  const campaignPlatforms = stringList(input.campaignPlatforms)
  if (campaignPlatforms.length > 0) {
    return { ...classifyPlatforms(campaignPlatforms), source: 'campaign_platforms' }
  }

  return {
    approvedPlatforms: [],
    planningOnlyPlatforms: [],
    source: 'missing',
  }
}

export function paidStrategyAllowsPlatform(
  source: { approvedPlatforms?: PaidExecutionPlatform[] },
  platform: unknown,
): boolean {
  if (typeof platform !== 'string') return false
  // Compatibility for legacy internal callers. Live strategy truth always
  // includes approvedPlatforms because it is derived on every read.
  if (!Array.isArray(source.approvedPlatforms)) return true
  return source.approvedPlatforms.includes(platform.toUpperCase() as PaidExecutionPlatform)
}
