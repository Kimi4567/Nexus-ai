import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRuntimeConfig } from '@/lib/runtimeConfig'

const original = { ...process.env }

afterEach(() => {
  vi.unstubAllEnvs()
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key]
  }
  for (const [key, value] of Object.entries(original)) process.env[key] = value
})

describe('getRuntimeConfig', () => {
  it('keeps billing unavailable until all Stripe runtime values exist', () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_BILLING_ENABLED = 'true'
    process.env.STRIPE_SECRET_KEY = 'sk_test_valid'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_valid'
    process.env.STRIPE_PRICE_PRO = 'price_growth'
    delete process.env.STRIPE_PRICE_BUSINESS

    const result = getRuntimeConfig()
    expect(result.billing.requested).toBe(true)
    expect(result.billing.ready).toBe(false)
    expect(result.warnings.some((warning) => warning.includes('Stripe'))).toBe(true)
  })

  it('reports live billing as blocked without a separate launch approval', () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.NEXT_PUBLIC_BILLING_ENABLED = 'true'
    process.env.STRIPE_SECRET_KEY = 'sk_live_valid'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_valid'
    process.env.STRIPE_PRICE_PRO = 'price_growth'
    process.env.STRIPE_PRICE_BUSINESS = 'price_autopilot'
    delete process.env.BILLING_LIVE_MODE_APPROVED

    const result = getRuntimeConfig()
    expect(result.billing.ready).toBe(false)
    expect(result.billing.mode).toBe('disabled')
    expect(result.warnings.some((warning) => warning.includes('live mode is blocked'))).toBe(true)
  })

  it('reports a complete production configuration as ready', () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon_key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_key'
    process.env.DATABASE_URL = 'postgresql://localhost/db'
    process.env.OPENAI_API_KEY = 'sk-test-valid'
    process.env.CRON_SECRET = 'a'.repeat(40)
    process.env.OAUTH_STATE_SECRET = 'oauth_secret'
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64)
    process.env.NEXT_PUBLIC_APP_URL = 'https://nexus.example'

    const result = getRuntimeConfig()
    expect(result.requiredMissing).toEqual([])
    expect(result.ready).toBe(true)
    expect(result.cron.strong).toBe(true)
  })

  it('fails readiness when the credit wallet flag is on without every Stripe tier', () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.CREDIT_WALLET_ENABLED = 'true'
    process.env.NEXT_PUBLIC_BILLING_ENABLED = 'true'
    process.env.DATABASE_URL = 'postgresql://localhost/db'
    process.env.STRIPE_SECRET_KEY = 'sk_test_valid'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_valid'
    process.env.STRIPE_PRICE_PRO = 'price_growth'
    process.env.STRIPE_PRICE_BUSINESS = 'price_autopilot'
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_1 = 'price_1'
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_2 = 'price_2'
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_3 = 'price_3'
    delete process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_4

    const result = getRuntimeConfig()
    expect(result.wallet.requested).toBe(true)
    expect(result.wallet.ready).toBe(false)
    expect(result.wallet.core.tierPrices).toBe(false)
    expect(result.ready).toBe(false)
    expect(result.warnings.some((warning) => warning.includes('four Stripe tier prices'))).toBe(true)
  })

  it('keeps lifecycle controls fail-closed until both HMAC keys are strong', () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.LIFECYCLE_MESSAGING_ENABLED = 'true'
    process.env.DATABASE_URL = 'postgresql://localhost/db'
    process.env.CONTACT_SUPPRESSION_HASH_KEY = 'too-short'
    process.env.UNSUBSCRIBE_SIGNING_SECRET = 'valid-unsubscribe-secret-that-is-long-enough'

    const result = getRuntimeConfig()
    expect(result.lifecycleMessaging.requested).toBe(true)
    expect(result.lifecycleMessaging.ready).toBe(false)
    expect(result.lifecycleMessaging.deliveryProvider).toBe('NOT_CONNECTED')
    expect(result.ready).toBe(false)
  })

  it('keeps landing pages fail-closed until CRM, database, and event hashing are configured', () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.LANDING_PAGES_ENABLED = 'true'
    process.env.DATABASE_URL = 'postgresql://localhost/db'
    process.env.LEADS_CRM_ENABLED = 'false'
    process.env.CRO_EVENT_HASH_KEY = 'short'

    const result = getRuntimeConfig()
    expect(result.landingPages.requested).toBe(true)
    expect(result.landingPages.ready).toBe(false)
    expect(result.landingPages.conversionTruth.formSubmissions).toBe('SERVER_CONFIRMED')
    expect(result.landingPages.conversionTruth.revenueTracking).toBe('MANUAL_CONFIRMED')
    expect(result.landingPages.conversionTruth.platformPermissionsRequired).toBe(false)
    expect(result.ready).toBe(false)
  })

  it('keeps experiments independently gated and never claims a statistical winner', () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.LANDING_PAGE_EXPERIMENTS_ENABLED = 'true'
    process.env.LANDING_PAGES_ENABLED = 'false'

    const result = getRuntimeConfig()
    expect(result.landingPageExperiments.requested).toBe(true)
    expect(result.landingPageExperiments.ready).toBe(false)
    expect(result.landingPageExperiments.decisionTruth.statisticalWinnerClaimed).toBe(false)
    expect(result.landingPageExperiments.decisionTruth.successMetric).toBe('SERVER_CONFIRMED_FORM_SUBMISSION')
  })
})
