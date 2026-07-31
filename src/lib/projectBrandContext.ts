export interface ProjectBrandProfileLike {
  brandName?: string | null
  industry?: string | null
  description?: string | null
  targetAudience?: string | null
  primaryOffer?: string | null
}

export interface ProjectBrandContext {
  name: string
  description: string | null
  businessType: string | null
  businessInfo: {
    brandName: string
    industry: string | null
    description: string | null
    targetAudience: string | null
    primaryOffer: string | null
  }
}

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized ? normalized.slice(0, maxLength) : null
}

export function buildProjectBrandContext(
  profile: ProjectBrandProfileLike,
): ProjectBrandContext | null {
  const brandName = clean(profile.brandName, 120)
  if (!brandName) return null

  const industry = clean(profile.industry, 120)
  const description = clean(profile.description, 2_000)
    ?? clean(profile.primaryOffer, 2_000)
  const targetAudience = clean(profile.targetAudience, 1_000)
  const primaryOffer = clean(profile.primaryOffer, 2_000)

  return {
    name: brandName,
    description,
    businessType: industry,
    businessInfo: {
      brandName,
      industry,
      description,
      targetAudience,
      primaryOffer,
    },
  }
}
