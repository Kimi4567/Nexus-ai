import type { BrandTone, Platform } from '@prisma/client'

const PLATFORM_MAP: Record<string, Platform> = {
  facebook: 'FACEBOOK',
  instagram: 'INSTAGRAM',
  tiktok: 'TIKTOK',
  'youtube shorts': 'YOUTUBE_SHORTS',
  youtube: 'YOUTUBE_SHORTS',
  snapchat: 'SNAPCHAT',
  linkedin: 'LINKEDIN',
  pinterest: 'PINTEREST',
  threads: 'THREADS',
  x: 'TWITTER',
  twitter: 'TWITTER',
  website: 'WEBSITE',
}

const TONE_KEYWORDS: Array<{ tone: BrandTone; terms: string[] }> = [
  { tone: 'LUXURY', terms: ['luxury', 'premium', 'فاخر', 'فخامة'] },
  { tone: 'ENERGETIC', terms: ['energetic', 'bold', 'حيوي', 'جريء'] },
  { tone: 'FRIENDLY', terms: ['friendly', 'warm', 'ودود', 'دافئ'] },
  { tone: 'CORPORATE', terms: ['corporate', 'formal', 'رسمي', 'مؤسسي'] },
  { tone: 'MINIMAL', terms: ['minimal', 'simple', 'بسيط', 'مختصر'] },
  { tone: 'MODERN', terms: ['modern', 'contemporary', 'حديث', 'عصري'] },
]

export function normalizeCampaignPlatformsForPersistence(raw: unknown): Platform[] {
  if (!Array.isArray(raw)) return []
  const normalized = raw
    .slice(0, 20)
    .map(value => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .map(value => {
      const canonical = value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
      return PLATFORM_MAP[canonical] ?? null
    })
    .filter((value): value is Platform => value !== null)

  return [...new Set(normalized)]
}

export function inferCampaignTone(toneKeywords: unknown): BrandTone {
  if (!Array.isArray(toneKeywords)) return 'PROFESSIONAL'
  const normalized = toneKeywords
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)

  for (const candidate of TONE_KEYWORDS) {
    if (candidate.terms.some(term => normalized.some(value => value.includes(term)))) {
      return candidate.tone
    }
  }
  return 'PROFESSIONAL'
}
