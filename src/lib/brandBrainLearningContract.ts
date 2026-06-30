export type BrandBrainSignalSource =
  | 'approval'
  | 'manual_publish'
  | 'user_variant_pick'
  | 'analytics'
  | 'missing_analytics'

export type BrandBrainLearningCategory =
  | 'CONTENT_APPROVAL_SIGNAL'
  | 'MANUAL_EXECUTION_EVENT'
  | 'USER_PREFERENCE_SIGNAL'
  | 'ANALYTICS_LEARNING'
  | 'ANALYTICS_PENDING'

export interface BrandBrainLearningCopy {
  category: BrandBrainLearningCategory
  label: string
  description: string
  canUseLearningLanguage: boolean
  canUseWinningLanguage: boolean
}

const COPY_BY_SOURCE: Record<BrandBrainSignalSource, BrandBrainLearningCopy> = {
  approval: {
    category: 'CONTENT_APPROVAL_SIGNAL',
    label: 'Approval signals saved',
    description: 'Approved content signals can inform future drafts. Performance evidence requires published analytics.',
    canUseLearningLanguage: false,
    canUseWinningLanguage: false,
  },
  manual_publish: {
    category: 'MANUAL_EXECUTION_EVENT',
    label: 'Manual execution recorded',
    description: 'The user confirmed a manual publish. Performance evidence starts after analytics data exists.',
    canUseLearningLanguage: false,
    canUseWinningLanguage: false,
  },
  user_variant_pick: {
    category: 'USER_PREFERENCE_SIGNAL',
    label: 'User-selected variant',
    description: 'The selected draft variant is an editorial preference signal, not analytics-backed performance evidence.',
    canUseLearningLanguage: false,
    canUseWinningLanguage: false,
  },
  analytics: {
    category: 'ANALYTICS_LEARNING',
    label: 'Analytics-backed learning',
    description: 'Published performance data can support learning, winning-hook, and top-performing-angle language.',
    canUseLearningLanguage: true,
    canUseWinningLanguage: true,
  },
  missing_analytics: {
    category: 'ANALYTICS_PENDING',
    label: 'Analytics pending',
    description: 'No analytics-backed performance evidence is available yet.',
    canUseLearningLanguage: false,
    canUseWinningLanguage: false,
  },
}

export function getBrandBrainLearningCopy(source: BrandBrainSignalSource): BrandBrainLearningCopy {
  return COPY_BY_SOURCE[source]
}

export function isAnalyticsBackedLearning(source: BrandBrainSignalSource): boolean {
  return getBrandBrainLearningCopy(source).canUseLearningLanguage
}
