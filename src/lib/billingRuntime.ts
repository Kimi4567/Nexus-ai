export type StripeSecretKeyMode = 'missing' | 'test' | 'live' | 'invalid'
export type BillingMode = 'disabled' | 'sandbox' | 'live'

type RuntimeEnv = Record<string, string | undefined>

const PLACEHOLDER_VALUE = /^(?:your|replace|example|tbd|todo)(?:[-_\s.]|$)/i

function configuredLegalValue(value: string | undefined): boolean {
  const normalized = value?.trim() ?? ''
  return normalized.length >= 2 && !PLACEHOLDER_VALUE.test(normalized)
}

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
  const commercialLaunchApproved = env.COMMERCIAL_LAUNCH_APPROVED === 'true'

  const core = {
    secretKey: keyMode === 'test' || keyMode === 'live',
    webhookSecret: valueWithPrefix(env.STRIPE_WEBHOOK_SECRET, 'whsec_'),
    growthPrice: valueWithPrefix(growthPrice, 'price_'),
    autopilotPrice: valueWithPrefix(autopilotPrice, 'price_'),
    pricesDistinct: Boolean(growthPrice && autopilotPrice && growthPrice !== autopilotPrice),
  }
  const prerequisitesReady = Object.values(core).every(Boolean)
  const commercialLegal = {
    launchApproved: commercialLaunchApproved,
    entityName: configuredLegalValue(env.LEGAL_ENTITY_NAME),
    entityAddress: configuredLegalValue(env.LEGAL_ENTITY_ADDRESS),
    jurisdiction: configuredLegalValue(env.LEGAL_ENTITY_JURISDICTION),
    governingLaw: configuredLegalValue(env.LEGAL_GOVERNING_LAW),
    termsVersion: configuredLegalValue(env.LEGAL_TERMS_VERSION),
  }
  const commercialLegalReady = Object.values(commercialLegal).every(Boolean)
  const liveBlockers = Object.entries({
    billingLiveModeApproved: liveModeApproved,
    ...commercialLegal,
  }).filter(([, ready]) => !ready).map(([name]) => name)
  const liveModeBlocked = keyMode === 'live' && liveBlockers.length > 0
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
    commercialLaunchApproved,
    commercialLegalReady,
    commercialLegal,
    liveBlockers,
    liveModeBlocked,
    prerequisitesReady,
    core,
  }
}
