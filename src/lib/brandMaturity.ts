export type BrandMaturityProfile = {
  brandName?: string | null
  industry?: string | null
  description?: string | null
  primaryOffer?: string | null
  targetAudience?: string | null
  audienceAge?: string | null
  audienceLocation?: string | null
  topPlatforms?: string[] | null
  winningHooks?: string[] | null
  winningAngles?: string[] | null
  audiencePainPoints?: string[] | null
  toneKeywords?: string[] | null
  uniqueAdvantages?: string[] | null
}

export type BrandMaturityResult = {
  score: number
  status: 'needs_data' | 'building' | 'active'
  missing: string[]
  breakdown: {
    completeness: number
    memoryDepth: number
    learningActivity: number
  }
  acceptedLearningCount: number
}

const COMPLETENESS_FIELDS: Array<{
  key: keyof BrandMaturityProfile
  points: number
  ar: string
  en: string
}> = [
  { key: 'brandName',        points: 5, ar: 'اسم العلامة',      en: 'Brand Name' },
  { key: 'industry',         points: 5, ar: 'القطاع',           en: 'Industry' },
  { key: 'description',      points: 5, ar: 'وصف النشاط',      en: 'Description' },
  { key: 'primaryOffer',     points: 5, ar: 'المنتج الرئيسي',  en: 'Primary Offer' },
  { key: 'targetAudience',   points: 3, ar: 'الجمهور المستهدف', en: 'Target Audience' },
  { key: 'audienceAge',      points: 2, ar: 'الفئة العمرية',   en: 'Age Group' },
  { key: 'audienceLocation', points: 2, ar: 'الموقع الجغرافي', en: 'Location' },
  { key: 'topPlatforms',     points: 3, ar: 'المنصات',          en: 'Platforms' },
]

function isFilled(value: unknown): boolean {
  return Array.isArray(value)
    ? value.length > 0
    : typeof value === 'string'
      ? value.trim().length > 0
      : Boolean(value)
}

function depthScore(value: unknown, brackets: Array<[number, number]>): number {
  const len = Array.isArray(value) ? value.length : 0
  let score = 0
  for (const [threshold, points] of brackets) {
    if (len >= threshold) score = points
    else break
  }
  return score
}

function learningScore(acceptedLearningCount: number): number {
  if (acceptedLearningCount >= 13) return 20
  if (acceptedLearningCount >= 8) return 15
  if (acceptedLearningCount >= 4) return 10
  if (acceptedLearningCount >= 1) return 5
  return 0
}

export function calculateBrandMaturity(
  profile: BrandMaturityProfile | null | undefined,
  options: { acceptedLearningCount?: number; locale?: string } = {},
): BrandMaturityResult {
  const acceptedLearningCount = Math.max(0, options.acceptedLearningCount ?? 0)
  const isAr = !options.locale || options.locale === 'ar'

  if (!profile) {
    return {
      score: 0,
      status: 'needs_data',
      missing: COMPLETENESS_FIELDS.map(f => isAr ? f.ar : f.en),
      breakdown: { completeness: 0, memoryDepth: 0, learningActivity: 0 },
      acceptedLearningCount,
    }
  }

  let completeness = 0
  const missing: string[] = []

  for (const field of COMPLETENESS_FIELDS) {
    if (isFilled(profile[field.key])) completeness += field.points
    else missing.push(isAr ? field.ar : field.en)
  }

  const memoryDepth =
    depthScore(profile.winningHooks,       [[1, 4], [3, 8], [6, 12], [10, 16], [15, 20]]) +
    depthScore(profile.winningAngles,      [[1, 2], [3, 5], [6, 8], [10, 10]]) +
    depthScore(profile.audiencePainPoints, [[1, 2], [3, 5], [6, 8], [10, 10]]) +
    depthScore(profile.toneKeywords,       [[1, 2], [3, 3], [5, 5]]) +
    depthScore(profile.uniqueAdvantages,   [[1, 2], [3, 3], [5, 5]])

  const learningActivity = learningScore(acceptedLearningCount)
  const score = Math.min(100, completeness + memoryDepth + learningActivity)

  return {
    score,
    status: score >= 80 ? 'active' : score >= 50 ? 'building' : 'needs_data',
    missing,
    breakdown: { completeness, memoryDepth, learningActivity },
    acceptedLearningCount,
  }
}

export async function snapshotBrandMaturity(
  db: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  workspaceId: string,
): Promise<BrandMaturityResult | null> {
  try {
    const [brandProfile, acceptedLearningCount] = await Promise.all([
      db.brandProfile.findUnique({ where: { workspaceId } }),
      db.brainLearning.count({ where: { workspaceId, status: 'accepted' } }).catch(() => 0),
    ])
    const maturity = calculateBrandMaturity(brandProfile, { acceptedLearningCount })
    await db.brainScoreSnapshot.create({
      data: { workspaceId, score: maturity.score },
    })
    return maturity
  } catch {
    return null
  }
}
