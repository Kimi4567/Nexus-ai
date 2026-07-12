import { getBrandIndicators, type BrandIndicators } from './brandIndicators'

export type BrandBrainLayerId =
  | 'business_truth'
  | 'market_customer'
  | 'brand_system'
  | 'growth_measurement'
  | 'evidence_memory'

export type BrandFieldStatus = 'confirmed' | 'candidate' | 'missing'
export type BrandFieldSource = 'user_confirmed' | 'accepted_learning' | 'legacy_candidate' | 'none'

export interface BrandBrainField {
  key: string
  label: { en: string; ar: string }
  value: string | string[] | null
  status: BrandFieldStatus
  source: BrandFieldSource
  requiredFor: Array<'organic' | 'paid' | 'measurement'>
}

export interface BrandBrainLayer {
  id: BrandBrainLayerId
  label: { en: string; ar: string }
  confirmed: number
  total: number
  fields: BrandBrainField[]
}

export interface BrandBrainContract {
  schemaVersion: 3
  revision: {
    number: number
    updatedAt: string | null
    lastChangedFields: string[]
  }
  layers: BrandBrainLayer[]
  readiness: BrandIndicators
  pendingLearning: {
    count: number
    fields: string[]
  }
  inference: {
    available: boolean
    injectedAsTruth: false
  }
  safeguards: {
    generatedTextBecomesTruth: false
    learningRequiresEvidenceOrApproval: true
    publishingAndSpendRequirePolicy: true
  }
}

type FieldSpec = {
  key: string
  layer: BrandBrainLayerId
  en: string
  ar: string
  requiredFor?: BrandBrainField['requiredFor']
  candidate?: boolean
}

const LAYER_LABELS: Record<BrandBrainLayerId, BrandBrainLayer['label']> = {
  business_truth: { en: 'Business truth', ar: 'حقائق النشاط' },
  market_customer: { en: 'Market and customer', ar: 'السوق والعميل' },
  brand_system: { en: 'Brand system', ar: 'نظام العلامة' },
  growth_measurement: { en: 'Growth and measurement', ar: 'النمو والقياس' },
  evidence_memory: { en: 'Evidence-backed memory', ar: 'ذاكرة مبنية على الأدلة' },
}

const FIELD_SPECS: readonly FieldSpec[] = [
  { key: 'brandName', layer: 'business_truth', en: 'Brand name', ar: 'اسم العلامة', requiredFor: ['organic', 'paid'] },
  { key: 'industry', layer: 'business_truth', en: 'Industry', ar: 'المجال', requiredFor: ['organic', 'paid'] },
  { key: 'description', layer: 'business_truth', en: 'Business description', ar: 'وصف النشاط', requiredFor: ['organic'] },
  { key: 'primaryOffer', layer: 'business_truth', en: 'Primary offer', ar: 'العرض الأساسي', requiredFor: ['organic', 'paid'] },
  { key: 'secondaryOffers', layer: 'business_truth', en: 'Secondary offers', ar: 'العروض الثانوية' },
  { key: 'pricePoint', layer: 'business_truth', en: 'Price positioning', ar: 'المستوى السعري' },
  { key: 'uniqueAdvantages', layer: 'business_truth', en: 'Unique advantages', ar: 'عناصر التميز' },
  { key: 'verifiedProof', layer: 'business_truth', en: 'Verified proof', ar: 'الإثباتات الموثقة' },

  { key: 'targetAudience', layer: 'market_customer', en: 'Target audience', ar: 'الجمهور المستهدف', requiredFor: ['organic', 'paid'] },
  { key: 'audienceAge', layer: 'market_customer', en: 'Audience age', ar: 'عمر الجمهور' },
  { key: 'audienceLocation', layer: 'market_customer', en: 'Market / location', ar: 'السوق والموقع', requiredFor: ['paid'] },
  { key: 'audiencePainPoints', layer: 'market_customer', en: 'Pain points', ar: 'نقاط الألم', requiredFor: ['organic'] },
  { key: 'audienceDesires', layer: 'market_customer', en: 'Customer desires', ar: 'رغبات العملاء' },
  { key: 'customerObjections', layer: 'market_customer', en: 'Customer objections', ar: 'اعتراضات العملاء' },
  { key: 'competitors', layer: 'market_customer', en: 'Named competitors', ar: 'المنافسون' },
  { key: 'competitorNotes', layer: 'market_customer', en: 'Competitor notes', ar: 'ملاحظات المنافسين' },

  { key: 'toneKeywords', layer: 'brand_system', en: 'Tone', ar: 'النبرة' },
  { key: 'writingStyle', layer: 'brand_system', en: 'Writing style', ar: 'أسلوب الكتابة' },
  { key: 'avoidKeywords', layer: 'brand_system', en: 'Words and styles to avoid', ar: 'الكلمات والأساليب الممنوعة' },
  { key: 'visualStyle', layer: 'brand_system', en: 'Visual style', ar: 'الأسلوب البصري' },
  { key: 'colorPalette', layer: 'brand_system', en: 'Color palette', ar: 'لوحة الألوان' },
  { key: 'logoUrl', layer: 'brand_system', en: 'Logo', ar: 'الشعار' },
  { key: 'languagePreference', layer: 'brand_system', en: 'Output language', ar: 'لغة المخرجات' },
  { key: 'contentSamples', layer: 'brand_system', en: 'Approved content samples', ar: 'عينات المحتوى المعتمدة' },
  { key: 'topPlatforms', layer: 'brand_system', en: 'Priority channels', ar: 'القنوات الأساسية', requiredFor: ['organic'] },

  { key: 'businessGoal', layer: 'growth_measurement', en: 'Business goal', ar: 'الهدف التجاري', requiredFor: ['organic', 'paid', 'measurement'] },
  { key: 'marketingBudget', layer: 'growth_measurement', en: 'Marketing budget', ar: 'ميزانية التسويق', requiredFor: ['paid', 'measurement'] },
  { key: 'conversionDestination', layer: 'growth_measurement', en: 'Conversion destination', ar: 'وجهة التحويل', requiredFor: ['paid', 'measurement'] },
  { key: 'leadHandling', layer: 'growth_measurement', en: 'Lead handling', ar: 'معالجة العملاء المحتملين', requiredFor: ['measurement'] },
  { key: 'averageOrderValue', layer: 'growth_measurement', en: 'Average order value', ar: 'متوسط قيمة الطلب', requiredFor: ['measurement'] },
  { key: 'grossMargin', layer: 'growth_measurement', en: 'Gross margin', ar: 'هامش الربح', requiredFor: ['measurement'] },
  { key: 'customerLifetimeValue', layer: 'growth_measurement', en: 'Customer lifetime value', ar: 'قيمة العميل مدى الحياة', requiredFor: ['measurement'] },
  { key: 'salesCycleLength', layer: 'growth_measurement', en: 'Sales cycle', ar: 'دورة البيع', requiredFor: ['measurement'] },
  { key: 'seasonality', layer: 'growth_measurement', en: 'Seasonality', ar: 'الموسمية' },
  { key: 'pastAdResults', layer: 'growth_measurement', en: 'User-provided past results', ar: 'نتائج سابقة قدمها المستخدم' },
  { key: 'complianceNotes', layer: 'growth_measurement', en: 'Compliance constraints', ar: 'قيود الامتثال' },

  { key: 'winningHooks', layer: 'evidence_memory', en: 'Hook candidates', ar: 'مرشحات الهوكس', candidate: true },
  { key: 'winningAngles', layer: 'evidence_memory', en: 'Angle candidates', ar: 'مرشحات الزوايا', candidate: true },
  { key: 'failedAngles', layer: 'evidence_memory', en: 'Angles to avoid', ar: 'زوايا يجب تجنبها', candidate: true },
  { key: 'strategicNotes', layer: 'evidence_memory', en: 'Strategic notes', ar: 'الملاحظات الاستراتيجية' },
] as const

export const BRAND_FIELD_KEYS = FIELD_SPECS.map((field) => field.key)

function normalizeValue(value: unknown): string | string[] | null {
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    const values = value
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      .map((item) => item.trim())
    return values.length ? values : null
  }
  return null
}

function stableValue(value: unknown): string {
  const normalized = normalizeValue(value)
  return JSON.stringify(normalized)
}

export function getChangedBrandFields(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): string[] {
  return BRAND_FIELD_KEYS.filter((key) => stableValue(previous?.[key]) !== stableValue(next[key]))
}

export function buildBrandBrainContract(
  profile: Record<string, unknown> | null | undefined,
  opts: {
    revisionNumber?: number
    lastChangedFields?: string[]
    learnedFields?: string[]
    pendingLearningFields?: string[]
    acceptedLearningCount?: number
    hasPixel?: boolean
  } = {},
): BrandBrainContract {
  const learned = new Set(opts.learnedFields ?? [])
  const pendingFields = Array.from(new Set(opts.pendingLearningFields ?? []))
  const p = profile ?? {}

  const layers = (Object.keys(LAYER_LABELS) as BrandBrainLayerId[]).map((layerId) => {
    const fields = FIELD_SPECS.filter((spec) => spec.layer === layerId).map((spec): BrandBrainField => {
      const value = normalizeValue(p[spec.key])
      const status: BrandFieldStatus = !value ? 'missing' : spec.candidate ? 'candidate' : 'confirmed'
      const source: BrandFieldSource = !value
        ? 'none'
        : spec.candidate
          ? 'legacy_candidate'
          : learned.has(spec.key)
            ? 'accepted_learning'
            : 'user_confirmed'
      return {
        key: spec.key,
        label: { en: spec.en, ar: spec.ar },
        value,
        status,
        source,
        requiredFor: spec.requiredFor ?? [],
      }
    })
    return {
      id: layerId,
      label: LAYER_LABELS[layerId],
      confirmed: fields.filter((field) => field.status === 'confirmed').length,
      total: fields.length,
      fields,
    }
  })

  return {
    schemaVersion: 3,
    revision: {
      number: Math.max(profile ? 1 : 0, opts.revisionNumber ?? 0),
      updatedAt: typeof p.updatedAt === 'string'
        ? p.updatedAt
        : p.updatedAt instanceof Date
          ? p.updatedAt.toISOString()
          : null,
      lastChangedFields: (opts.lastChangedFields ?? []).filter((key) => BRAND_FIELD_KEYS.includes(key)),
    },
    layers,
    readiness: getBrandIndicators(p, {
      hasPixel: opts.hasPixel,
      acceptedLearningCount: opts.acceptedLearningCount,
    }),
    pendingLearning: {
      count: pendingFields.length,
      fields: pendingFields,
    },
    inference: {
      available: Boolean(p.aiInsights),
      injectedAsTruth: false,
    },
    safeguards: {
      generatedTextBecomesTruth: false,
      learningRequiresEvidenceOrApproval: true,
      publishingAndSpendRequirePolicy: true,
    },
  }
}
