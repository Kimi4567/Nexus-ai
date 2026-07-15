export const MARKETING_JOURNEY_STAGE_IDS = [
  'brand',
  'strategy',
  'production',
  'execution',
  'results',
] as const

export type MarketingJourneyStageId = typeof MARKETING_JOURNEY_STAGE_IDS[number]

export interface MarketingJourneyStage {
  id: MarketingJourneyStageId
  step: number
  href: string
  label: {
    ar: string
    en: string
  }
  purpose: {
    ar: string
    en: string
  }
}

/**
 * The only user-facing operating spine. Specialist pages remain available as
 * contextual tools, but they never become extra stages in the main journey.
 */
export const MARKETING_JOURNEY: readonly MarketingJourneyStage[] = [
  {
    id: 'brand',
    step: 1,
    href: '/brand',
    label: { ar: 'Brand Brain', en: 'Brand Brain' },
    purpose: {
      ar: 'مصدر الحقيقة والأدلة والقيود',
      en: 'Source truth, evidence, and constraints',
    },
  },
  {
    id: 'strategy',
    step: 2,
    href: '/strategy',
    label: { ar: 'الاستراتيجية والحملات', en: 'Strategy & campaigns' },
    purpose: {
      ar: 'الأهداف والرسائل والقنوات وخطة القياس',
      en: 'Objectives, messages, channels, and measurement plan',
    },
  },
  {
    id: 'production',
    step: 3,
    href: '/content-hub',
    label: { ar: 'إنتاج المحتوى', en: 'Content production' },
    purpose: {
      ar: 'النص والوسائط والمراجعة في حزمة واحدة',
      en: 'Copy, media, and review in one package',
    },
  },
  {
    id: 'execution',
    step: 4,
    href: '/calendar?tab=queue',
    label: { ar: 'التنفيذ', en: 'Execution' },
    purpose: {
      ar: 'القرارات والجدولة والنشر والمراقبة',
      en: 'Decisions, scheduling, publishing, and monitoring',
    },
  },
  {
    id: 'results',
    step: 5,
    href: '/analytics',
    label: { ar: 'النتائج والتعلّم', en: 'Results & learning' },
    purpose: {
      ar: 'قياس موثّق واقتراحات تعلّم قابلة للمراجعة',
      en: 'Verified measurement and reviewable learning',
    },
  },
] as const

export function getMarketingJourneyStage(id: MarketingJourneyStageId): MarketingJourneyStage {
  return MARKETING_JOURNEY.find(stage => stage.id === id) as MarketingJourneyStage
}

export function resolveMarketingJourneyStage(pathname: string): MarketingJourneyStageId | null {
  const normalized = `/${String(pathname || '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '')}`

  if (normalized === '/brand' || normalized.startsWith('/brand/')) return 'brand'
  if (normalized === '/content-hub' || normalized.includes('/content-hub') || normalized === '/studio' || normalized.startsWith('/media')) return 'production'
  if (normalized === '/strategy' || normalized.startsWith('/campaigns') || normalized.startsWith('/paid-campaigns')) return 'strategy'
  if (normalized === '/calendar' || normalized === '/publish' || normalized === '/automation') return 'execution'
  if (normalized === '/analytics' || normalized === '/learning') return 'results'

  return null
}
