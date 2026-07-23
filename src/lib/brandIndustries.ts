export interface BrandIndustryOption {
  value: string
  ar: string
  en: string
  aliases?: string[]
  onboarding?: boolean
}

/**
 * Stable industry values stored in Brand Brain.
 * Labels may change with locale, but persisted values do not.
 */
export const BRAND_INDUSTRY_OPTIONS: BrandIndustryOption[] = [
  { value: 'E-commerce', ar: 'تجارة إلكترونية', en: 'E-commerce', aliases: ['ecommerce'], onboarding: true },
  { value: 'Tech & Apps', ar: 'برمجيات وتقنية', en: 'Software & Tech', aliases: ['saas', 'software & technology', 'تقنية وتطبيقات', 'technology'], onboarding: true },
  { value: 'Marketing Agency', ar: 'وكالة تسويق', en: 'Marketing Agency', aliases: ['agency'], onboarding: true },
  { value: 'Sports & Fitness', ar: 'لياقة وصحة', en: 'Fitness & Health', aliases: ['fitness', 'رياضة ولياقة'], onboarding: true },
  { value: 'Restaurants & Food', ar: 'أغذية ومشروبات', en: 'Food & Beverage', aliases: ['food', 'food & beverage', 'مطاعم وأغذية'], onboarding: true },
  { value: 'Real Estate', ar: 'عقارات', en: 'Real Estate', aliases: ['real_estate'], onboarding: true },
  { value: 'Health & Beauty', ar: 'جمال وعناية', en: 'Beauty & Care', aliases: ['beauty', 'صحة وجمال'], onboarding: true },
  { value: 'Consulting', ar: 'استشارات', en: 'Consulting', aliases: ['consulting'], onboarding: true },
  { value: 'Education & Training', ar: 'تعليم وتدريب', en: 'Education & Training', aliases: ['education'], onboarding: true },
  { value: 'Healthcare & Medical', ar: 'رعاية صحية', en: 'Healthcare', aliases: ['healthcare', 'رعاية صحية وطب'], onboarding: true },
  { value: 'Fashion & Apparel', ar: 'موضة وأزياء', en: 'Fashion & Apparel', onboarding: true },
  { value: 'Dental & Clinics', ar: 'عيادات وطب أسنان', en: 'Dental & Clinics' },
  { value: 'Professional Services', ar: 'خدمات مهنية', en: 'Professional Services', aliases: ['services'] },
  { value: 'Travel & Tourism', ar: 'سياحة وسفر', en: 'Travel & Tourism' },
  { value: 'Home & Furniture', ar: 'ديكور وأثاث', en: 'Home & Furniture', onboarding: true },
  { value: 'Automotive', ar: 'سيارات', en: 'Automotive' },
  { value: 'Other', ar: 'أخرى', en: 'Other', aliases: ['other', 'آخر'], onboarding: true },
]

export const ONBOARDING_INDUSTRY_OPTIONS = BRAND_INDUSTRY_OPTIONS.filter(option => option.onboarding)

function comparable(value: string) {
  return value.trim().toLocaleLowerCase('en-US').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function normalizeBrandIndustry(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  const key = comparable(trimmed)
  const match = BRAND_INDUSTRY_OPTIONS.find(option =>
    [option.value, option.ar, option.en, ...(option.aliases ?? [])]
      .some(candidate => comparable(candidate) === key),
  )
  return match?.value ?? trimmed
}

export function getBrandIndustryOption(value: string | null | undefined) {
  const normalized = normalizeBrandIndustry(value)
  return BRAND_INDUSTRY_OPTIONS.find(option => option.value === normalized)
}

export function getBrandIndustryLabel(value: string | null | undefined, locale: 'ar' | 'en') {
  const option = getBrandIndustryOption(value)
  return option ? option[locale] : value?.trim() ?? ''
}
