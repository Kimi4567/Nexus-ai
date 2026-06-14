'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { calculateBrandMaturity, type BrandMaturityResult } from '@/lib/brandMaturity'

/* ═══════════════════════════════════════════════════════════════
   useBrandBrain — الذاكرة المشتركة لكل الوكلاء الذكيين

   يجلب brand profile المستخدم ويحوّله لـ context string
   يُضاف تلقائياً في بداية كل system prompt في NEX/VEX/PULSE/Sentinel
   ═══════════════════════════════════════════════════════════════ */

export interface BrandProfile {
  brandName?: string | null
  industry?: string | null
  description?: string | null
  logoUrl?: string | null
  toneKeywords?: string[]
  avoidKeywords?: string[]
  writingStyle?: string | null
  targetAudience?: string | null
  audienceAge?: string | null
  audienceLocation?: string | null
  audiencePainPoints?: string[]
  audienceDesires?: string[]
  primaryOffer?: string | null
  secondaryOffers?: string[]
  pricePoint?: string | null
  uniqueAdvantages?: string[]
  visualStyle?: string | null
  colorPalette?: string[]
  topPlatforms?: string[]
  winningHooks?: string[]
  winningAngles?: string[]
  failedAngles?: string[]
  competitors?: string[]
  competitorNotes?: string | null
  strategicNotes?: string | null
  websiteUrl?: string | null
  contentSamples?: string[]
  acceptedLearningCount?: number
  // PR-2A — strategy data requirements (additive, optional; free-text bands)
  businessGoal?: string | null
  marketingBudget?: string | null
  conversionDestination?: string | null
  leadHandling?: string | null
  customerObjections?: string[]
  complianceNotes?: string | null
  averageOrderValue?: string | null
  grossMargin?: string | null
  customerLifetimeValue?: string | null
  salesCycleLength?: string | null
  seasonality?: string | null
  pastAdResults?: string | null
}

const ARRAY_FIELDS: (keyof BrandProfile)[] = [
  'toneKeywords',
  'avoidKeywords',
  'audiencePainPoints',
  'audienceDesires',
  'secondaryOffers',
  'uniqueAdvantages',
  'colorPalette',
  'topPlatforms',
  'winningHooks',
  'winningAngles',
  'failedAngles',
  'competitors',
  'contentSamples',
  'customerObjections',
]

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }
  return []
}

export function normalizeBrandProfile(profile: BrandProfile | null | undefined): BrandProfile | null {
  if (!profile) return null
  const normalized: BrandProfile = { ...profile }
  for (const field of ARRAY_FIELDS) {
    ;(normalized as Record<string, unknown>)[field] = toStringArray((profile as Record<string, unknown>)[field])
  }
  return normalized
}

/**
 * Converts a BrandProfile into an Arabic context string
 * injected at the top of every AI system prompt.
 */
export function buildBrandContext(brand: BrandProfile | null): string {
  if (!brand || !brand.brandName) return ''

  const lines: string[] = ['═══ ذاكرة العلامة التجارية — Brand Memory ═══']

  if (brand.brandName)
    lines.push(`• الاسم: ${brand.brandName}`)
  if (brand.industry)
    lines.push(`• القطاع: ${brand.industry}`)
  if (brand.description)
    lines.push(`• الوصف: ${brand.description}`)
  if (brand.primaryOffer)
    lines.push(`• المنتج/الخدمة الرئيسية: ${brand.primaryOffer}`)
  if (brand.pricePoint)
    lines.push(`• مستوى السعر: ${brand.pricePoint}`)
  if (brand.uniqueAdvantages?.length)
    lines.push(`• المميزات الفريدة: ${brand.uniqueAdvantages.join('، ')}`)
  if (brand.targetAudience)
    lines.push(`• الجمهور المستهدف: ${brand.targetAudience}`)
  if (brand.audienceAge)
    lines.push(`• الفئة العمرية: ${brand.audienceAge}`)
  if (brand.audienceLocation)
    lines.push(`• الموقع الجغرافي: ${brand.audienceLocation}`)
  if (brand.audiencePainPoints?.length)
    lines.push(`• نقاط الألم: ${brand.audiencePainPoints.join('، ')}`)
  if (brand.audienceDesires?.length)
    lines.push(`• الرغبات والتطلعات: ${brand.audienceDesires.join('، ')}`)
  if (brand.toneKeywords?.length)
    lines.push(`• نبرة الصوت المطلوبة: ${brand.toneKeywords.join('، ')}`)
  if (brand.writingStyle)
    lines.push(`• أسلوب الكتابة: ${brand.writingStyle}`)
  if (brand.avoidKeywords?.length)
    lines.push(`• يُمنع استخدام: ${brand.avoidKeywords.join('، ')}`)
  if (brand.topPlatforms?.length)
    lines.push(`• المنصات الرئيسية: ${brand.topPlatforms.join('، ')}`)
  if (brand.winningHooks?.length)
    lines.push(`• هوكس ناجحة سابقاً: ${brand.winningHooks.join(' | ')}`)
  if (brand.competitors?.length)
    lines.push(`• المنافسون المرصودون: ${brand.competitors.join('، ')}`)
  if (brand.competitorNotes)
    lines.push(`• ملاحظات المنافسين: ${brand.competitorNotes}`)
  if (brand.strategicNotes)
    lines.push(`• ملاحظات استراتيجية: ${brand.strategicNotes}`)

  lines.push('═══════════════════════════════════════')
  lines.push('⚠️ استخدم هذه المعلومات في كل ما تولّده. اجعل كل output مخصصاً تماماً لهذه العلامة التجارية.')
  lines.push('')

  return lines.join('\n')
}

/**
 * Returns completeness score 0-100 and missing fields list (bilingual)
 */
export function getBrandCompleteness(brand: BrandProfile | null, locale?: string): { score: number; missing: string[] } {
  const maturity = calculateBrandMaturity(brand, {
    acceptedLearningCount: brand?.acceptedLearningCount ?? 0,
    locale,
  })
  return { score: maturity.score, missing: maturity.missing }
}

// ── Hook ───────────────────────────────────────────────────────
export function useBrandBrain() {
  const { authHeader } = useAuth()
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maturity, setMaturity] = useState<BrandMaturityResult | null>(null)

  const fetchBrand = useCallback(async () => {
    try {
      const res = await fetch('/api/brand', {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) throw new Error('Failed to load brand')
      const data = await res.json()
      const normalized = normalizeBrandProfile(data.brandProfile)
      setBrand(normalized)
      setMaturity(data.maturity ?? (normalized ? calculateBrandMaturity(normalized) : null))
    } catch {
      setError('تعذّر تحميل بيانات العلامة التجارية')
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => { fetchBrand() }, [fetchBrand])

  const saveBrand = useCallback(async (data: Partial<BrandProfile>) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/brand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to save')
      const result = await res.json()
      const normalized = normalizeBrandProfile(result.brandProfile)
      setBrand(normalized)
      setMaturity(result.maturity ?? (normalized ? calculateBrandMaturity(normalized) : null))
      return true
    } catch {
      setError('تعذّر حفظ البيانات. حاول مجدداً.')
      return false
    } finally {
      setSaving(false)
    }
  }, [authHeader])

  const brandContext = buildBrandContext(brand)
  const derivedMaturity = maturity ?? calculateBrandMaturity(brand, {
    acceptedLearningCount: brand?.acceptedLearningCount ?? 0,
  })
  const { score, missing } = { score: derivedMaturity.score, missing: derivedMaturity.missing }

  return {
    brand,
    brandContext,   // inject this into every AI system prompt
    completeness: score,
    maturity: derivedMaturity,
    missingFields: missing,
    loading,
    saving,
    error,
    saveBrand,
    refetch: fetchBrand,
  }
}
