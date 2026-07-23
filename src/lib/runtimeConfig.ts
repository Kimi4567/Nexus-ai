import { getBillingRuntimeGate } from '@/lib/billingRuntime'

/**
 * Runtime configuration diagnostics.
 *
 * This module is intentionally side-effect free: it never throws, logs, or
 * exposes secret values.  It is used by the health endpoint and can therefore
 * safely run in a preview deployment where optional providers are disabled.
 */

const PLACEHOLDER_PATTERNS = [
  /^your[-_]/i,
  /^generate[-_]/i,
  /^replace[-_]/i,
  /^change[-_]/i,
  /^example(?:\.|$)/i,
  /\.\.\.$/,
]

function configured(value: string | undefined): boolean {
  const trimmed = value?.trim()
  return Boolean(trimmed && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed)))
}

function productionOnlyMissing(name: string, value: string | undefined, production: boolean): string | null {
  return production && !configured(value) ? name : null
}

export type RuntimeConfigSnapshot = ReturnType<typeof getRuntimeConfig>

/**
 * Return a redacted, serialisable view of runtime readiness.
 * `billing.ready` is deliberately stricter than the historical feature flag:
 * an operator must configure the webhook and both public subscription prices
 * before checkout/webhooks are allowed to run.
 */
export function getRuntimeConfig() {
  const production = process.env.NODE_ENV === 'production'
  const billingGate = getBillingRuntimeGate()
  const billingRequested = billingGate.requested
  const walletRequested = process.env.CREDIT_WALLET_ENABLED === 'true'
  const leadCrmRequested = process.env.LEADS_CRM_ENABLED === 'true'
  const lifecycleMessagingRequested = process.env.LIFECYCLE_MESSAGING_ENABLED === 'true'
  const landingPagesRequested = process.env.LANDING_PAGES_ENABLED === 'true'
  const landingPageExperimentsRequested = process.env.LANDING_PAGE_EXPERIMENTS_ENABLED === 'true'

  const billingCore = billingGate.core
  const billingReady = billingGate.ready
  const walletTierPrices = [
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_1,
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_2,
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_3,
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_4,
  ].map(configured)
  const walletCore = {
    database: configured(process.env.DATABASE_URL),
    billing: billingReady,
    tierPrices: walletTierPrices.every(Boolean),
  }
  const walletReady = walletRequested && Object.values(walletCore).every(Boolean)

  const requiredMissing = [
    productionOnlyMissing('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL, production),
    productionOnlyMissing('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, production),
    productionOnlyMissing('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, production),
    productionOnlyMissing('DATABASE_URL', process.env.DATABASE_URL, production),
    productionOnlyMissing('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL, production),
    productionOnlyMissing('OPENAI_API_KEY', process.env.OPENAI_API_KEY, production),
    productionOnlyMissing('CRON_SECRET', process.env.CRON_SECRET, production),
    productionOnlyMissing('OAUTH_STATE_SECRET', process.env.OAUTH_STATE_SECRET, production),
    productionOnlyMissing('TOKEN_ENCRYPTION_KEY', process.env.TOKEN_ENCRYPTION_KEY, production),
  ].filter((name): name is string => Boolean(name))

  const warnings: string[] = []
  if (billingRequested && !billingGate.prerequisitesReady) {
    warnings.push('Billing is requested but a Stripe key, webhook secret, or distinct subscription Price ID is missing or invalid.')
  }
  if (billingGate.liveModeBlocked) {
    warnings.push(`Stripe live mode is blocked by ${billingGate.liveBlockers.length} incomplete commercial launch prerequisite(s).`)
  }
  if (walletRequested && !walletReady) {
    warnings.push('Credit wallet is requested but its database, billing core, or four Stripe tier prices are incomplete.')
  }
  if (leadCrmRequested && !configured(process.env.DATABASE_URL)) {
    warnings.push('Lead CRM is requested but DATABASE_URL is missing.')
  }
  const lifecycleCore = {
    database: configured(process.env.DATABASE_URL),
    suppressionHashKey: configured(process.env.CONTACT_SUPPRESSION_HASH_KEY)
      && (process.env.CONTACT_SUPPRESSION_HASH_KEY?.trim().length ?? 0) >= 32,
    unsubscribeSigningSecret: configured(process.env.UNSUBSCRIBE_SIGNING_SECRET)
      && (process.env.UNSUBSCRIBE_SIGNING_SECRET?.trim().length ?? 0) >= 32,
  }
  const lifecycleMessagingReady = lifecycleMessagingRequested && Object.values(lifecycleCore).every(Boolean)
  if (lifecycleMessagingRequested && !lifecycleMessagingReady) {
    warnings.push('Customer lifecycle messaging is requested but its database or server-only HMAC keys are incomplete.')
  }
  const landingPagesCore = {
    database: configured(process.env.DATABASE_URL),
    leadCrm: leadCrmRequested,
    eventHashKey: configured(process.env.CRO_EVENT_HASH_KEY)
      && (process.env.CRO_EVENT_HASH_KEY?.trim().length ?? 0) >= 32,
  }
  const landingPagesReady = landingPagesRequested && Object.values(landingPagesCore).every(Boolean)
  if (landingPagesRequested && !landingPagesReady) {
    warnings.push('Landing pages are requested but their database, Lead CRM dependency, or server-only event HMAC key is incomplete.')
  }
  const landingPageExperimentsReady = landingPageExperimentsRequested && landingPagesReady
  if (landingPageExperimentsRequested && !landingPageExperimentsReady) {
    warnings.push('Landing page experiments are requested but the Landing Pages conversion layer is not ready.')
  }
  if (production && configured(process.env.CRON_SECRET) && (process.env.CRON_SECRET?.trim().length ?? 0) < 32) {
    warnings.push('CRON_SECRET must be at least 32 characters in production.')
  }

  return {
    environment: production ? 'production' : (process.env.NODE_ENV || 'development'),
    appUrlConfigured: configured(process.env.NEXT_PUBLIC_APP_URL),
    requiredMissing,
    billing: {
      requested: billingRequested,
      ready: billingReady,
      mode: billingGate.mode,
      liveModeApproved: billingGate.liveModeApproved,
      commercialLegalReady: billingGate.commercialLegalReady,
      liveBlockers: billingGate.liveBlockers,
      // Keep this redacted: health responses must never include IDs or keys.
      core: billingCore,
    },
    wallet: {
      requested: walletRequested,
      ready: walletReady,
      // Booleans only: health must expose readiness without leaking Price IDs.
      core: walletCore,
      // A migration cannot be inferred without a database round-trip. The
      // explicit flag remains the activation gate; health surfaces that fact.
      activationGate: 'CREDIT_WALLET_ENABLED',
    },
    leadCrm: {
      requested: leadCrmRequested,
      activationGate: 'LEADS_CRM_ENABLED',
    },
    lifecycleMessaging: {
      requested: lifecycleMessagingRequested,
      ready: lifecycleMessagingReady,
      core: lifecycleCore,
      activationGate: 'LIFECYCLE_MESSAGING_ENABLED',
      deliveryProvider: 'NOT_CONNECTED' as const,
    },
    landingPages: {
      requested: landingPagesRequested,
      ready: landingPagesReady,
      core: landingPagesCore,
      activationGate: 'LANDING_PAGES_ENABLED',
      conversionTruth: {
        pageViews: 'CLIENT_REPORTED' as const,
        ctaClicks: 'CLIENT_REPORTED' as const,
        formSubmissions: 'SERVER_CONFIRMED' as const,
        wonOutcomes: 'MANUAL_CONFIRMED' as const,
        revenueTracking: 'MANUAL_CONFIRMED' as const,
        platformPermissionsRequired: false,
      },
    },
    landingPageExperiments: {
      requested: landingPageExperimentsRequested,
      ready: landingPageExperimentsReady,
      activationGate: 'LANDING_PAGE_EXPERIMENTS_ENABLED',
      decisionTruth: {
        successMetric: 'SERVER_CONFIRMED_FORM_SUBMISSION' as const,
        pageViews: 'CLIENT_REPORTED' as const,
        decision: 'HUMAN_REVIEW_AFTER_MINIMUM_EVIDENCE' as const,
        statisticalWinnerClaimed: false,
        revenueTracking: false,
      },
    },
    cron: {
      configured: configured(process.env.CRON_SECRET),
      strong: !production || (process.env.CRON_SECRET?.trim().length ?? 0) >= 32,
    },
    warnings,
    ready: requiredMissing.length === 0 && warnings.length === 0,
  }
}
