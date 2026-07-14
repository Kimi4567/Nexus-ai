/**
 * PR-1M — one honest source for a campaign's platform list.
 *
 * Every surface that shows "which platforms this campaign is planned for" should
 * read the explicit `campaign.platforms` field and run it through here, so the same
 * campaign never shows a different list on Campaigns vs Content Hub vs Dashboard.
 *
 * This NEVER invents a platform and NEVER merges semantics — it only:
 *   - drops empty/blank entries,
 *   - de-duplicates case-insensitively,
 *   - orders them in one canonical order (so slice(0,3) is stable everywhere),
 *   - maps known keys to clean display labels.
 *
 * If the campaign has no platforms, callers get `isEmpty` + a localized "not set"
 * label instead of a hardcoded default. Pure + dependency-free → unit-testable.
 */

const LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  META: 'Meta',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  LINKEDIN: 'LinkedIn',
  TWITTER: 'X',
  X: 'X',
  YOUTUBE: 'YouTube',
  YOUTUBE_SHORTS: 'YouTube Shorts',
  SNAPCHAT: 'Snapchat',
  PINTEREST: 'Pinterest',
  THREADS: 'Threads',
}

// Canonical display order — keeps the list identical across surfaces.
const ORDER = ['FACEBOOK', 'INSTAGRAM', 'THREADS', 'TIKTOK', 'LINKEDIN', 'META', 'X', 'YOUTUBE', 'YOUTUBE_SHORTS', 'SNAPCHAT', 'PINTEREST']

/** Normalize raw campaign platforms: trim, upper-case key, de-dupe, canonical order. */
export function normalizeCampaignPlatforms(
  platforms?: ReadonlyArray<string | null | undefined> | null,
): string[] {
  if (!Array.isArray(platforms)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of platforms) {
    if (typeof p !== 'string' || !p.trim()) continue
    const rawKey = p.trim().toUpperCase()
    const key = rawKey === 'TWITTER' ? 'X' : rawKey
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out.sort((a, b) => {
    const ia = ORDER.indexOf(a)
    const ib = ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

/** Display label for a normalized platform key (unknown → title-cased). */
export function platformLabel(key: string): string {
  const k = key.trim().toUpperCase()
  return LABELS[k] ?? (k.charAt(0) + k.slice(1).toLowerCase())
}

export interface CampaignPlatformSummary {
  /** normalized canonical keys (e.g. ['FACEBOOK','INSTAGRAM']) */
  platforms: string[]
  /** clean display labels (e.g. ['Facebook','Instagram']) */
  labels: string[]
  /** true when the campaign has no platforms set */
  isEmpty: boolean
  /** localized empty-state label — shown instead of a hardcoded default */
  emptyLabel: string
}

/**
 * One consistent summary of a campaign's intended platforms for display.
 */
export function getCampaignPlatformSummary(
  platforms?: ReadonlyArray<string | null | undefined> | null,
  locale?: string,
): CampaignPlatformSummary {
  const norm = normalizeCampaignPlatforms(platforms)
  const ar = (locale || '').toLowerCase().startsWith('ar')
  return {
    platforms: norm,
    labels: norm.map(platformLabel),
    isEmpty: norm.length === 0,
    emptyLabel: ar ? 'لم يتم تحديد المنصات' : 'Platforms not set',
  }
}
