import { hasUsableConversionDestination } from '@/lib/strategyBriefReadiness'
import { buildStrategyEvidenceLedger } from '@/lib/strategy/strategyEvidenceLedger'

export type BrandTruthAreaKey =
  | 'offer'
  | 'pricing'
  | 'sizing'
  | 'delivery'
  | 'returns'
  | 'materials_quality'
  | 'commercial_proof'
  | 'visual_assets'
  | 'conversion_path'

export type BrandTruthAreaStatus =
  | 'SOURCE_CONFIRMED'
  | 'OWNER_CONFIRMED'
  | 'PENDING_REVIEW'
  | 'CONFLICTING'
  | 'MISSING'

export type BrandTruthBusinessModel = 'SERVICE' | 'PRODUCT_OR_MIXED' | 'UNKNOWN'

export interface BrandTruthProfileLike {
  industry?: string | null
  description?: string | null
  primaryOffer?: string | null
  secondaryOffers?: string[] | null
  pricePoint?: string | null
  averageOrderValue?: string | null
  conversionDestination?: string | null
  campaignObjective?: string | null
  verifiedProof?: string[] | null
}

export interface BrandTruthClaimLike {
  claim: string
  category: string
  status: string
  truthStatus: string
}

export interface BrandTruthArea {
  key: BrandTruthAreaKey
  status: BrandTruthAreaStatus
  sourceRequiredForStrongClaims: boolean
  evidenceCount: number
  pendingCount: number
  sample: string | null
  sourceKind: 'document' | 'uploaded_asset' | 'owner' | null
}

export interface BrandTruthSummary {
  businessModel: BrandTruthBusinessModel
  areas: BrandTruthArea[]
  sourceConfirmedAreaCount: number
  ownerConfirmedAreaCount: number
  attentionAreaCount: number
  pendingReviewCount: number
  restrictedStrongClaimKeys: BrandTruthAreaKey[]
  conversionReady: boolean
  visualAssetCount: number
}

interface BrandTruthRegistryInput {
  profile?: BrandTruthProfileLike | null
  claims?: readonly BrandTruthClaimLike[] | null
  visualAssetCount?: number | null
}

const SOURCE_REQUIRED = new Set<BrandTruthAreaKey>([
  'offer',
  'pricing',
  'sizing',
  'delivery',
  'returns',
  'materials_quality',
  'commercial_proof',
])

const AREA_ORDER: BrandTruthAreaKey[] = [
  'offer',
  'pricing',
  'sizing',
  'delivery',
  'returns',
  'materials_quality',
  'commercial_proof',
  'visual_assets',
  'conversion_path',
]

const PRODUCT_ONLY_AREAS = new Set<BrandTruthAreaKey>([
  'sizing',
  'delivery',
  'returns',
  'materials_quality',
])

const SERVICE_SIGNALS = /\b(?:agency|consulting|consultancy|marketing|strategy|strategic|service|services|saas|software|clinic|professional|education|training|coaching|broker|brokerage|real estate|property management)\b|وكالة|استشار(?:ة|ات|ي)|تسويق|استراتيج(?:ية|ي)|خدمة|خدمات|برمجيات|عيادة|مهني|تعليم|تدريب|وسيط|وساطة|عقار(?:ات|ي|ية)|إدارة عقارات/iu
const PRODUCT_SIGNALS = /\b(?:e-?commerce|product|products|store|shop|retail|food|fashion|beauty|cosmetics|furniture|apparel|clothing|restaurant)\b|تجارة إلكترونية|منتج|منتجات|متجر|تجزئة|أغذية|طعام|مطعم|موضة|أزياء|جمال|مستحضرات|أثاث|ملابس/iu

const TERMS: Record<Exclude<BrandTruthAreaKey, 'visual_assets' | 'conversion_path'>, RegExp> = {
  offer: /\b(?:product|service|offer|package|plan|subscription|collection)\b|منتج|خدمة|عرض|باقة|اشتراك|تشكيلة/iu,
  pricing: /\b(?:price|pricing|cost|fee|fees|aed|usd|eur|gbp|dhs?|dirhams?|discount)\b|سعر|أسعار|تكلفة|رسوم|درهم|دولار|خصم/iu,
  sizing: /\b(?:size|sizing|fit|fitting|measurement|measurements|dimensions?)\b|مقاس|مقاسات|قياس|قياسات|أبعاد|ملاءمة/iu,
  delivery: /\b(?:delivery|deliver|shipping|ship|dispatch|fulfilment|fulfillment)\b|توصيل|تسليم|شحن|إرسال/iu,
  returns: /\b(?:return|returns|refund|refunds|exchange|exchanges|cancellation)\b|إرجاع|استرجاع|استرداد|استبدال|إلغاء/iu,
  materials_quality: /\b(?:material|materials|fabric|composition|ingredient|ingredients|quality|specification|specifications)\b|خامة|خامات|قماش|نسيج|مكونات|جودة|مواصفات/iu,
  commercial_proof: /\b(?:customer|client|testimonial|review|rating|case study|performance|result|award|certified|certification|accredited)\b|عميل|عملاء|شهادة|شهادات|تقييم|مراجعة|نتيجة|نتائج|جائزة|اعتماد/iu,
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function cleanList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(clean).filter(Boolean)
    : []
}

export function inferBrandTruthBusinessModel(
  profile: BrandTruthProfileLike = {},
): BrandTruthBusinessModel {
  const profileText = [
    clean(profile.industry),
    clean(profile.description),
    clean(profile.primaryOffer),
    ...cleanList(profile.secondaryOffers),
  ].filter(Boolean).join(' ')

  if (!profileText) return 'UNKNOWN'

  const hasServiceSignal = SERVICE_SIGNALS.test(profileText)
  const hasProductSignal = PRODUCT_SIGNALS.test(profileText)
  if (hasProductSignal) return 'PRODUCT_OR_MIXED'
  if (hasServiceSignal) return 'SERVICE'
  return 'UNKNOWN'
}

function claimMatchesArea(claim: BrandTruthClaimLike, key: BrandTruthAreaKey): boolean {
  if (key === 'visual_assets' || key === 'conversion_path') return false
  const category = clean(claim.category).toUpperCase()
  if (key === 'offer' && (category === 'PRODUCT' || category === 'OFFER')) return true
  if (key === 'commercial_proof' && ['CUSTOMER', 'PERFORMANCE', 'CERTIFICATION'].includes(category)) return true
  return TERMS[key].test(claim.claim)
}

function ownerProofAffirmsArea(
  proof: string,
  key: Exclude<BrandTruthAreaKey, 'visual_assets' | 'conversion_path'>,
): boolean {
  const pattern = TERMS[key]
  const flags = Array.from(new Set(`${pattern.flags.replace(/g/g, '')}g`.split(''))).join('')
  const scanner = new RegExp(pattern.source, flags)
  let match: RegExpExecArray | null

  while ((match = scanner.exec(proof)) !== null) {
    const before = proof.slice(Math.max(0, match.index - 120), match.index)
    const after = proof.slice(match.index + match[0].length, match.index + match[0].length + 80)
    const negatedBefore = /(?:\b(?:no|not|without|never|unverified|unconfirmed|undocumented)\b|(?:لا\s+(?:توجد|يوجد|يثبت|تثبت|تؤكد|يؤكد)|بدون|غير\s+(?:موثق|مؤكد|مثبت)))[^.!?؟]{0,100}$/iu.test(before)
    const negatedAfter = /^(?:\s+(?:is|are|remains?|was|were))?\s*(?:not|unverified|unconfirmed|undocumented)\b|^\s*(?:غير\s+(?:موثق|مؤكد|مثبت)|يحتاج\s+(?:إلى\s+)?إثبات)/iu.test(after)
    if (!negatedBefore && !negatedAfter) return true
  }

  return false
}

function ownerCandidate(
  key: BrandTruthAreaKey,
  profile: BrandTruthProfileLike,
  ownerProof: readonly string[],
): string | null {
  if (key === 'offer') {
    return clean(profile.primaryOffer) || cleanList(profile.secondaryOffers)[0] || null
  }
  if (key === 'pricing') {
    return clean(profile.pricePoint) || clean(profile.averageOrderValue) || ownerProof.find(item => ownerProofAffirmsArea(item, 'pricing')) || null
  }
  if (key === 'conversion_path') {
    return hasUsableConversionDestination(profile.conversionDestination, profile.campaignObjective)
      ? clean(profile.conversionDestination)
      : null
  }
  if (key === 'visual_assets') return null
  return ownerProof.find(item => ownerProofAffirmsArea(item, key)) || null
}

export function buildBrandTruthRegistry(input: BrandTruthRegistryInput = {}): BrandTruthSummary {
  const profile = input.profile ?? {}
  const businessModel = inferBrandTruthBusinessModel(profile)
  const claims = Array.isArray(input.claims) ? input.claims : []
  const visualAssetCount = Number.isFinite(input.visualAssetCount)
    ? Math.max(0, Math.floor(Number(input.visualAssetCount)))
    : 0
  const proofLedger = buildStrategyEvidenceLedger(profile.verifiedProof)
  const ownerProof = proofLedger
    .filter(item => item.status === 'brand_brain_entry')
    .map(item => item.statement)
  const sourceProof = proofLedger
    .filter(item => item.status === 'source_linked')
    .map(item => item.statement)

  const allAreas = AREA_ORDER.map<BrandTruthArea>(key => {
    if (key === 'visual_assets') {
      return {
        key,
        status: visualAssetCount > 0 ? 'SOURCE_CONFIRMED' : 'MISSING',
        sourceRequiredForStrongClaims: false,
        evidenceCount: visualAssetCount,
        pendingCount: 0,
        sample: visualAssetCount > 0 ? `${visualAssetCount}` : null,
        sourceKind: visualAssetCount > 0 ? 'uploaded_asset' : null,
      }
    }

    const relevant = claims.filter(claim => claimMatchesArea(claim, key))
    const conflicts = relevant.filter(claim => claim.truthStatus === 'CONFLICTING' && claim.status === 'PENDING')
    const pending = relevant.filter(claim => claim.status === 'PENDING')
    const confirmed = relevant.filter(claim => claim.status === 'APPROVED' && claim.truthStatus === 'CONFIRMED')
    const sourceFallback = key === 'conversion_path'
      ? []
      : sourceProof.filter(proof => TERMS[key as Exclude<BrandTruthAreaKey, 'visual_assets' | 'conversion_path'>].test(proof))
    const sourceSamples = [...confirmed.map(claim => clean(claim.claim)), ...sourceFallback].filter(Boolean)
    const owner = ownerCandidate(key, profile, ownerProof)

    let status: BrandTruthAreaStatus = 'MISSING'
    let sample: string | null = null
    let sourceKind: BrandTruthArea['sourceKind'] = null
    if (conflicts.length > 0) {
      status = 'CONFLICTING'
      sample = clean(conflicts[0].claim) || null
      sourceKind = 'document'
    } else if (sourceSamples.length > 0) {
      status = 'SOURCE_CONFIRMED'
      sample = sourceSamples[0]
      sourceKind = 'document'
    } else if (pending.length > 0) {
      status = 'PENDING_REVIEW'
      sample = clean(pending[0].claim) || null
      sourceKind = 'document'
    } else if (owner) {
      status = 'OWNER_CONFIRMED'
      sample = owner
      sourceKind = 'owner'
    }

    return {
      key,
      status,
      sourceRequiredForStrongClaims: SOURCE_REQUIRED.has(key),
      evidenceCount: sourceSamples.length,
      pendingCount: pending.length,
      sample,
      sourceKind,
    }
  })
  const areas = businessModel === 'SERVICE'
    ? allAreas.filter(area => !PRODUCT_ONLY_AREAS.has(area.key) || area.status !== 'MISSING')
    : allAreas

  return {
    businessModel,
    areas,
    sourceConfirmedAreaCount: areas.filter(area => area.status === 'SOURCE_CONFIRMED').length,
    ownerConfirmedAreaCount: areas.filter(area => area.status === 'OWNER_CONFIRMED').length,
    attentionAreaCount: areas.filter(area => ['PENDING_REVIEW', 'CONFLICTING', 'MISSING'].includes(area.status)).length,
    pendingReviewCount: areas.reduce((sum, area) => sum + area.pendingCount, 0),
    restrictedStrongClaimKeys: areas
      .filter(area => area.sourceRequiredForStrongClaims && area.status !== 'SOURCE_CONFIRMED')
      .map(area => area.key),
    conversionReady: areas.some(area => area.key === 'conversion_path' && area.status === 'OWNER_CONFIRMED'),
    visualAssetCount,
  }
}
