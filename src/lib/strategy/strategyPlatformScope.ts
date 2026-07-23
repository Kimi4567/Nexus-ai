/**
 * Separates executable campaign destinations from support/conversion channels.
 *
 * Brand Brain intentionally lets a user record WhatsApp because it can be an
 * important lead destination. It is not, however, a campaign content platform
 * in NEXUS. Passing it to the strategist as an allowed platform caused the
 * model to allocate posts and paid budget to WhatsApp, while Content Hub could
 * only execute the campaign's actual social platforms.
 */

const SUPPORT_ONLY_CHANNELS = new Set([
  'WHATSAPP',
  'WHATS APP',
  'WEBSITE',
  'WEB SITE',
  'SITE',
  'LANDING PAGE',
  'FORM',
  'STORE',
  'NONE',
  'NONE YET',
])

function normalizedKey(value: string): string {
  return value.trim().toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function uniqueChannels(channels?: ReadonlyArray<string | null | undefined> | null): string[] {
  if (!Array.isArray(channels)) return []
  const seen = new Set<string>()
  const output: string[] = []

  for (const channel of channels) {
    if (typeof channel !== 'string' || !channel.trim()) continue
    const key = normalizedKey(channel)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(channel.trim())
  }

  return output
}

/** Platforms that may receive content directions, budget, and execution work. */
export function strategyExecutionPlatforms(
  channels?: ReadonlyArray<string | null | undefined> | null,
): string[] {
  return uniqueChannels(channels).filter(channel => !SUPPORT_ONLY_CHANNELS.has(normalizedKey(channel)))
}

/** Channels that remain useful for CTA, conversion, and follow-up only. */
export function strategySupportOnlyChannels(
  channels?: ReadonlyArray<string | null | undefined> | null,
): string[] {
  return uniqueChannels(channels).filter(channel => SUPPORT_ONLY_CHANNELS.has(normalizedKey(channel)))
}
