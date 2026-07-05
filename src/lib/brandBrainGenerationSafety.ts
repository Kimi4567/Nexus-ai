export type BrandBrainGenerationField =
  | 'competitorNotes'
  | 'businessGoal'
  | 'marketingBudget'
  | 'conversionDestination'
  | 'leadHandling'
  | 'customerObjections'
  | 'complianceNotes'
  | 'averageOrderValue'
  | 'grossMargin'
  | 'customerLifetimeValue'
  | 'salesCycleLength'
  | 'seasonality'
  | 'pastAdResults'

export type BrandBrainGenerationProfile = {
  brandName?: string | null
  industry?: string | null
  description?: string | null
  primaryOffer?: string | null
  targetAudience?: string | null
  audienceLocation?: string | null
  businessGoal?: string | null
  marketingBudget?: string | null
  conversionDestination?: string | null
  leadHandling?: string | null
  customerObjections?: string[] | null
  complianceNotes?: string | null
  averageOrderValue?: string | null
  grossMargin?: string | null
  customerLifetimeValue?: string | null
  salesCycleLength?: string | null
  seasonality?: string | null
  pastAdResults?: string | null
  audiencePainPoints?: string[] | null
  audienceDesires?: string[] | null
  uniqueAdvantages?: string[] | null
  competitors?: string[] | null
  competitorNotes?: string | null
  secondaryOffers?: string[] | null
  strategicNotes?: string | null
  [key: string]: unknown
}

export interface BrandBrainGenerationSafety {
  anchorCategory: 'clinicOperationsSaas' | 'homeCleaning' | 'unknown'
  excludedFields: BrandBrainGenerationField[]
  safeProfile: BrandBrainGenerationProfile
}

const CLINIC_MARKERS = [
  'clinic', 'clinics', 'patient', 'patients', 'appointment', 'appointments',
  'reminder', 'reminders', 'front-desk', 'front desk', 'practice manager',
  'healthcare', 'medical', 'bilingual patient', 'follow-up task',
  'عيادة', 'عيادات', 'مرضى', 'مريض', 'مواعيد', 'موعد', 'استقبال',
  'متابعة المرضى', 'إدارة العيادات', 'تشغيل العيادات', 'رعاية', 'طبي', 'طبية',
]

const HOME_CLEANING_MARKERS = [
  'cleaning', 'cleaner', 'cleaners', 'deep clean', 'recurring cleaning',
  'home cleaning', 'home size', 'house', 'apartment', 'villa', 'maid',
  'move-in', 'move in', 'move-out', 'move out', 'lease', 'guests',
  'bathroom', 'kitchen', 'eco-friendly products',
  'تنظيف', 'منزل', 'منازل', 'شقة', 'شقق', 'فيلا', 'فلل', 'خادمة',
  'حمام', 'مطبخ', 'انتقال', 'ضيوف',
]

const SCREENED_FIELDS: BrandBrainGenerationField[] = [
  'competitorNotes',
  'businessGoal',
  'marketingBudget',
  'conversionDestination',
  'leadHandling',
  'customerObjections',
  'complianceNotes',
  'averageOrderValue',
  'grossMargin',
  'customerLifetimeValue',
  'salesCycleLength',
  'seasonality',
  'pastAdResults',
]

function joinValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ')
  if (typeof value === 'string') return value
  return ''
}

function markerScore(text: string, markers: string[]): number {
  const lower = text.toLowerCase()
  return markers.reduce((score, marker) => score + (lower.includes(marker.toLowerCase()) ? 1 : 0), 0)
}

function resolveAnchorCategory(profile: BrandBrainGenerationProfile): BrandBrainGenerationSafety['anchorCategory'] {
  const anchorText = [
    profile.brandName,
    profile.industry,
    profile.description,
    profile.primaryOffer,
    profile.targetAudience,
    profile.businessGoal,
    profile.audienceLocation,
    profile.audiencePainPoints,
    profile.audienceDesires,
    profile.uniqueAdvantages,
    profile.competitors,
    profile.secondaryOffers,
    profile.strategicNotes,
  ].map(joinValue).join(' ')

  const clinicScore = markerScore(anchorText, CLINIC_MARKERS)
  const cleaningScore = markerScore(anchorText, HOME_CLEANING_MARKERS)

  if (clinicScore >= 2 && clinicScore > cleaningScore) return 'clinicOperationsSaas'
  if (cleaningScore >= 2 && cleaningScore > clinicScore) return 'homeCleaning'
  return 'unknown'
}

function fieldConflictsWithAnchor(
  value: unknown,
  anchorCategory: BrandBrainGenerationSafety['anchorCategory'],
): boolean {
  const text = joinValue(value)
  if (!text.trim() || anchorCategory === 'unknown') return false

  if (anchorCategory === 'clinicOperationsSaas') {
    return markerScore(text, HOME_CLEANING_MARKERS) > 0
  }

  if (anchorCategory === 'homeCleaning') {
    return markerScore(text, CLINIC_MARKERS) > 0
  }

  return false
}

export function getBrandBrainGenerationSafety(
  profile: BrandBrainGenerationProfile | null | undefined,
): BrandBrainGenerationSafety {
  const source = profile ?? {}
  const anchorCategory = resolveAnchorCategory(source)
  const excludedFields = SCREENED_FIELDS.filter(field => fieldConflictsWithAnchor(source[field], anchorCategory))
  const safeProfile: BrandBrainGenerationProfile = { ...source }
  const mutableSafeProfile = safeProfile as Record<string, unknown>

  for (const field of excludedFields) {
    mutableSafeProfile[field] = Array.isArray(source[field]) ? [] : null
  }

  return { anchorCategory, excludedFields, safeProfile }
}

export function formatBrandBrainGenerationSafetyNote(safety: BrandBrainGenerationSafety): string {
  if (!safety.excludedFields.length) return ''
  return [
    'Brand Brain consistency guard:',
    `Excluded stale cross-industry fields from this generation context: ${safety.excludedFields.join(', ')}.`,
    'Do not use or infer from excluded fields. Treat them as needing user review in Brand Brain.',
  ].join(' ')
}
