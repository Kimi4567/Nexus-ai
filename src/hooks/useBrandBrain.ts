'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { calculateBrandMaturity, type BrandMaturityResult } from '@/lib/brandMaturity'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import type { BrandBrainContract } from '@/lib/brandBrainContract'
import { normalizeBrandIndustry } from '@/lib/brandIndustries'
import { normalizeBusinessGoal } from '@/lib/businessGoals'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

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
  // PR-H2 — Brand Brain v2 (additive)
  languagePreference?: string | null   // "en" | "ar" | "both" — user-chosen
  verifiedProof?: string[]             // user-confirmed proof points only
  strategyType?: 'organic' | 'paid' | 'full' | null
  strategyDuration?: '30' | '90' | '180' | 'custom' | null
  strategyCustomDays?: number | null
  campaignObjective?: 'leads' | 'sales' | 'awareness' | 'traffic' | null
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
  'verifiedProof',
]

export type BrandBrainLoadGate =
  | { status: 'wait-for-auth' }
  | { status: 'skip-unauthenticated' }
  | { status: 'load'; authorization: string }

export function getBrandBrainLoadGate(input: {
  authLoading: boolean
  isAuthenticated: boolean
  authorization: string
}): BrandBrainLoadGate {
  if (input.authLoading) return { status: 'wait-for-auth' }
  if (!input.isAuthenticated) return { status: 'skip-unauthenticated' }

  const authorization = input.authorization.trim()
  if (!authorization) return { status: 'wait-for-auth' }

  return { status: 'load', authorization }
}

const BRAND_LOAD_AUTH_RETRY_DELAY_MS = 650

async function wait(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

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
  const normalized: BrandProfile = {
    ...profile,
    industry: normalizeBrandIndustry(profile.industry),
    businessGoal: normalizeBusinessGoal(profile.businessGoal),
  }
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
  return buildBrandExecutionContext(brand as unknown as Record<string, unknown> | null)
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
  const { authHeader, loading: authLoading, isAuthenticated } = useAuth()
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maturity, setMaturity] = useState<BrandMaturityResult | null>(null)
  const [contract, setContract] = useState<BrandBrainContract | null>(null)
  const requestSeq = useRef(0)

  const fetchBrand = useCallback(async () => {
    const seq = ++requestSeq.current
    const gate = getBrandBrainLoadGate({
      authLoading,
      isAuthenticated,
      authorization: authHeader(),
    })

    if (gate.status === 'wait-for-auth') {
      setLoading(true)
      setError(null)
      return
    }

    if (gate.status === 'skip-unauthenticated') {
      setBrand(null)
      setMaturity(null)
      setContract(null)
      setLoading(false)
      setError(null)
      return
    }

    // PR-E: every fetch attempt (initial load, auth-token-ready re-fetch, or an
    // explicit Retry) returns the UI to the loading state and clears any stale
    // error. This prevents the transient "Could not load your Brand Brain" flash
    // when the first request runs before the auth header is ready and a retry is
    // already in flight. Real errors are still surfaced if the attempt fails.
    setLoading(true)
    setError(null)
    try {
      let res = await fetchWithTimeout('/api/brand', {
        headers: { Authorization: gate.authorization },
      }, 8_000)

      if (res.status === 401) {
        await wait(BRAND_LOAD_AUTH_RETRY_DELAY_MS)
        if (seq !== requestSeq.current) return

        const retryGate = getBrandBrainLoadGate({
          authLoading,
          isAuthenticated,
          authorization: authHeader(),
        })

        if (retryGate.status === 'wait-for-auth') {
          setLoading(true)
          setError(null)
          return
        }

        if (retryGate.status === 'skip-unauthenticated') {
          setBrand(null)
          setMaturity(null)
          setContract(null)
          setLoading(false)
          setError(null)
          return
        }

        res = await fetchWithTimeout('/api/brand', {
          headers: { Authorization: retryGate.authorization },
        }, 8_000)
      }

      if (seq !== requestSeq.current) return
      if (!res.ok) throw new Error('Failed to load brand')
      const data = await res.json()
      if (seq !== requestSeq.current) return
      const normalized = normalizeBrandProfile(data.brandProfile)
      setBrand(normalized)
      setMaturity(data.maturity ?? (normalized ? calculateBrandMaturity(normalized) : null))
      setContract(data.contract ?? null)
    } catch {
      if (seq === requestSeq.current) {
        setError('تعذّر تحميل بيانات العلامة التجارية')
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false)
      }
    }
  }, [authHeader, authLoading, isAuthenticated])

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
      setContract(result.contract ?? null)
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
    contract,
    missingFields: missing,
    loading,
    saving,
    error,
    saveBrand,
    refetch: fetchBrand,
  }
}
