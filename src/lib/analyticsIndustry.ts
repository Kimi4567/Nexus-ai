/**
 * PR-1L — Analytics industry truth.
 *
 * Maps the user's real Brand Brain industry (free-text-ish, e.g. "Tech & Apps")
 * to one of the Analytics sector options. NEVER guesses: if the brand industry is
 * missing or doesn't clearly map to a known sector, returns '' (unset) so Analytics
 * can show an honest "Industry not set" state instead of defaulting to "E-commerce".
 *
 * Pure + dependency-free → unit-testable.
 */

/** Analytics sector option values (must match the PulseSelect options). */
export type AnalyticsIndustry =
  | 'ecommerce' | 'food' | 'fashion' | 'tech' | 'health' | 'realestate' | 'education' | 'services'

const MAP: Record<string, AnalyticsIndustry> = {
  'e-commerce': 'ecommerce', 'ecommerce': 'ecommerce', 'e commerce': 'ecommerce', 'retail': 'ecommerce', 'online store': 'ecommerce',
  'restaurants & food': 'food', 'food & beverage': 'food', 'food and beverage': 'food', 'food': 'food', 'restaurant': 'food', 'restaurants': 'food', 'cafe': 'food', 'f&b': 'food',
  'fashion & apparel': 'fashion', 'fashion': 'fashion', 'apparel': 'fashion', 'clothing': 'fashion',
  'tech & apps': 'tech', 'tech': 'tech', 'technology': 'tech', 'saas': 'tech', 'software': 'tech', 'app': 'tech', 'apps': 'tech', 'it': 'tech',
  'health & beauty': 'health', 'health': 'health', 'beauty': 'health', 'wellness': 'health', 'healthcare': 'health', 'fitness': 'health',
  'real estate': 'realestate', 'realestate': 'realestate', 'property': 'realestate',
  'education & training': 'education', 'education': 'education', 'training': 'education', 'edtech': 'education',
  'professional services': 'services', 'services': 'services', 'service': 'services', 'consulting': 'services', 'agency': 'services',
}

/**
 * @returns the matching analytics sector value, or '' when the brand industry is
 *          unknown/unset/unmappable (never a guessed default).
 */
export function mapBrandIndustryToAnalytics(brandIndustry?: string | null): AnalyticsIndustry | '' {
  if (!brandIndustry || typeof brandIndustry !== 'string') return ''
  return MAP[brandIndustry.trim().toLowerCase()] ?? ''
}
