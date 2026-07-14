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
  const billingRequested = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true'
  const walletRequested = process.env.CREDIT_WALLET_ENABLED === 'true'

  const billingCore = {
    secretKey: configured(process.env.STRIPE_SECRET_KEY),
    webhookSecret: configured(process.env.STRIPE_WEBHOOK_SECRET),
    growthPrice: configured(process.env.STRIPE_PRICE_PRO),
    autopilotPrice: configured(process.env.STRIPE_PRICE_BUSINESS),
  }
  const billingReady = billingRequested && Object.values(billingCore).every(Boolean)

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
  if (billingRequested && !billingReady) {
    warnings.push('Billing is requested but Stripe key, webhook secret, or both subscription prices are missing.')
  }
  if (walletRequested && !configured(process.env.DATABASE_URL)) {
    warnings.push('Credit wallet is requested without a configured database.')
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
      // Keep this redacted: health responses must never include IDs or keys.
      core: billingCore,
    },
    wallet: {
      requested: walletRequested,
      // A migration cannot be inferred without a database round-trip. The
      // explicit flag remains the activation gate; health surfaces that fact.
      activationGate: 'CREDIT_WALLET_ENABLED',
    },
    cron: {
      configured: configured(process.env.CRON_SECRET),
      strong: !production || (process.env.CRON_SECRET?.trim().length ?? 0) >= 32,
    },
    warnings,
    ready: requiredMissing.length === 0 && warnings.length === 0,
  }
}
