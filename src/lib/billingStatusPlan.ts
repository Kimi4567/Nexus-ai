const ACTIVE_BILLING_STATUSES = new Set(['active', 'trialing', 'current', 'valid'])

function normalizePlanName(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw) return 'active'
  if (raw === 'growth') return 'pro'
  if (raw === 'agency') return 'business'
  return raw
}

function isActiveStatus(value: unknown): boolean {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ACTIVE_BILLING_STATUSES.has(raw)
}

export interface BillingStatusPlanInput {
  subscriptionPlan?: unknown
  subscriptionStatus?: unknown
  userSubscriptionStatus?: unknown
}

export interface BillingStatusPlanResult {
  plan: string
  hasActiveSubscription: boolean
}

/**
 * Resolve the product-facing billing plan from Stripe Subscription rows and
 * the User.subscriptionStatus fallback used by the admin console.
 *
 * Admin/manual QA accounts may be set to ACTIVE without a Stripe subscription
 * row. Treat that as a paid active state instead of showing FREE caps.
 */
export function resolveBillingStatusPlan(input: BillingStatusPlanInput): BillingStatusPlanResult {
  const subscriptionRowActive = isActiveStatus(input.subscriptionStatus)
  const userStatusActive = isActiveStatus(input.userSubscriptionStatus)

  if (!subscriptionRowActive && !userStatusActive) {
    return { plan: 'free', hasActiveSubscription: false }
  }

  const planSource =
    input.subscriptionPlan ||
    (subscriptionRowActive ? input.subscriptionStatus : input.userSubscriptionStatus)

  return {
    plan: normalizePlanName(planSource),
    hasActiveSubscription: true,
  }
}
