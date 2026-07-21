export type StripeSecretKeyMode = 'missing' | 'test' | 'live' | 'invalid'
export type BillingMode = 'disabled' | 'sandbox' | 'live'

type RuntimeEnv = Record<string, string | undefined>

function valueWithPrefix(value: string | undefined, prefix: string): boolean {
  const normalized = value?.trim() ?? ''
  return normalized.length > prefix.length && normalized.startsWith(prefix)
}

export function getStripeSecretKeyMode(value: string | undefined): StripeSecretKeyMode {
  const normalized = value?.trim() ?? ''
  if (!normalized) return 'missing'
  if (valueWithPrefix(normalized, 'sk_test_')) return 'test'
  if (valueWithPrefix(normalized, 'sk_live_')) return 'live'
  return 'invalid'
}

/**
 * Single fail-closed billing gate shared by checkout, webhooks, health, and UI.
 * A live key can never become active merely because it was pasted into Vercel:
 * the operator must also set the separate server-side approval flag.
 */
export function getBillingRuntimeGate(env: RuntimeEnv = process.env) {
  const requested = env.NEXT_PUBLIC_BILLING_ENABLED === 'true'
  const keyMode = getStripeSecretKeyMode(env.STRIPE_SECRET_KEY)
  const growthPrice = env.STRIPE_PRICE_PRO?.trim() ?? ''
  const autopilotPrice = env.STRIPE_PRICE_BUSINESS?.trim() ?? ''
  const liveModeApproved = env.BILLING_LIVE_MODE_APPROVED === 'true'

  const core = {
    secretKey: keyMode === 'test' || keyMode === 'live',
    webhookSecret: valueWithPrefix(env.STRIPE_WEBHOOK_SECRET, 'whsec_'),
    growthPrice: valueWithPrefix(growthPrice, 'price_'),
    autopilotPrice: valueWithPrefix(autopilotPrice, 'price_'),
    pricesDistinct: Boolean(growthPrice && autopilotPrice && growthPrice !== autopilotPrice),
  }
  const prerequisitesReady = Object.values(core).every(Boolean)
  const liveModeBlocked = keyMode === 'live' && !liveModeApproved
  const ready = requested && prerequisitesReady && !liveModeBlocked
  const mode: BillingMode = !ready
    ? 'disabled'
    : keyMode === 'test'
      ? 'sandbox'
      : 'live'

  return {
    requested,
    ready,
    mode,
    keyMode,
    liveModeApproved,
    liveModeBlocked,
    prerequisitesReady,
    core,
  }
}
