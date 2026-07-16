import { resolveStrategyCharge } from '@/lib/strategy/normalizeStrategyOrder'

/**
 * Client-safe examples derived from the exact server pricing resolver. Billing,
 * onboarding, and tests can explain common journeys without copying a matrix.
 */
function priced(input: Parameters<typeof resolveStrategyCharge>[0]): number {
  return resolveStrategyCharge(input).cost ?? 0
}

export const STRATEGY_PRICING_DISPLAY_TRUTH = {
  trialActivation: {
    label: 'Organic Light · 30 days',
    cost: priced({ strategyType: 'organic', strategyDuration: '30', contentIntensity: 'light' }),
  },
  paidStandard90: {
    label: 'Paid Standard · 90 days',
    cost: priced({ strategyType: 'paid', strategyDuration: '90', contentIntensity: 'standard' }),
  },
  fullStandard90: {
    label: 'Full Standard · 90 days',
    cost: priced({ strategyType: 'full', strategyDuration: '90', contentIntensity: 'standard' }),
  },
  range: {
    minimum: priced({ strategyType: 'organic', strategyDuration: '30', contentIntensity: 'light' }),
    maximum: priced({ strategyType: 'full', strategyDuration: '180', contentIntensity: 'daily' }),
  },
} as const

export function getStrategyToDraftsJourneyCost(strategyCost: number, reviewCost: number, contentPlanCost: number): number {
  return Math.max(0, Math.floor(strategyCost))
    + Math.max(0, Math.floor(reviewCost))
    + Math.max(0, Math.floor(contentPlanCost))
}
