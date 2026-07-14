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
})
