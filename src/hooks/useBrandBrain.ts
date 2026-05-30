'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

/* ═══════════════════════════════════════════════════════════════
   useBrandBrain — الذاكرة المشتركة لكل الوكلاء الذكيين

   يجلب brand profile المستخدم ويحوّله لـ context string
   يُضاف تلقائياً في بداية كل system prompt في NEX/VEX/PULSE/Sentinel
   ═══════════════════════════════════════════════════════════════ */

export interface BrandProfile {
  brandName?: string | null
  industry?: string | null
  description?: string | null
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
  competitorNotes?: string | null
  strategicNotes?: string | null
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
 * Returns completeness score 0-100 and missing fields list
 */
export function getBrandCompleteness(brand: BrandProfile | null): { score: number; missing: string[] } {
  if (!brand) return { score: 0, missing: [] }

  const checks = [
    { key: 'brandName',        label: 'اسم العلامة' },
    { key: 'industry',         label: 'القطاع' },
    { key: 'description',      label: 'وصف النشاط' },
    { key: 'primaryOffer',     label: 'المنتج الرئيسي' },
    { key: 'targetAudience',   label: 'الجمهور المستهدف' },
    { key: 'audienceAge',      label: 'الفئة العمرية' },
    { key: 'audienceLocation', label: 'الموقع الجغرافي' },
    { key: 'toneKeywords',     label: 'نبرة الصوت' },
    { key: 'topPlatforms',     label: 'المنصات' },
    { key: 'uniqueAdvantages', label: 'المميزات الفريدة' },
  ]

  const missing: string[] = []
  let filled = 0

  for (const c of checks) {
    const val = (brand as Record<string, unknown>)[c.key]
    const ok = Array.isArray(val) ? val.length > 0 : !!val
    if (ok) filled++
    else missing.push(c.label)
  }

  return { score: Math.round((filled / checks.length) * 100), missing }
}

// ── Hook ───────────────────────────────────────────────────────
export function useBrandBrain() {
  const { authHeader } = useAuth()
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBrand = useCallback(async () => {
    try {
      const res = await fetch('/api/brand', {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) throw new Error('Failed to load brand')
      const data = await res.json()
      setBrand(data.brandProfile || null)
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
      setBrand(result.brandProfile)
      return true
    } catch {
      setError('تعذّر حفظ البيانات. حاول مجدداً.')
      return false
    } finally {
      setSaving(false)
    }
  }, [authHeader])

  const brandContext = buildBrandContext(brand)
  const { score, missing } = getBrandCompleteness(brand)

  return {
    brand,
    brandContext,   // inject this into every AI system prompt
    completeness: score,
    missingFields: missing,
    loading,
    saving,
    error,
    saveBrand,
    refetch: fetchBrand,
  }
}
