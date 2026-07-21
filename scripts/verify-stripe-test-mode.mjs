#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import Stripe from 'stripe'

const SUBSCRIPTIONS = [
  { envKey: 'STRIPE_PRICE_PRO', label: 'Growth', amountCents: 4900 },
  { envKey: 'STRIPE_PRICE_BUSINESS', label: 'Autopilot', amountCents: 9900 },
]

const WALLET_TIERS = [
  { envKey: 'STRIPE_PRICE_CREDIT_WALLET_TIER_1', label: 'Wallet tier 1', amountCents: 100 },
  { envKey: 'STRIPE_PRICE_CREDIT_WALLET_TIER_2', label: 'Wallet tier 2', amountCents: 90 },
  { envKey: 'STRIPE_PRICE_CREDIT_WALLET_TIER_3', label: 'Wallet tier 3', amountCents: 80 },
  { envKey: 'STRIPE_PRICE_CREDIT_WALLET_TIER_4', label: 'Wallet tier 4', amountCents: 70 },
]

function parseEnvValue(raw) {
  const value = raw.trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value.replace(/\s+#.*$/, '').trim()
}

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || process.env[match[1]] !== undefined) continue
    process.env[match[1]] = parseEnvValue(match[2])
  }
}

// Standalone Node scripts do not receive Next.js env loading. Preserve any
// shell/Vercel values, then fill missing local values using Next-like priority.
loadLocalEnv(path.resolve('.env.local'))
loadLocalEnv(path.resolve('.env'))

const checks = []
const warnings = []

function check(name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), detail })
  return Boolean(passed)
}

function configured(name) {
  return Boolean((process.env[name] || '').trim())
}

function safeStripeError(error) {
  return {
    type: typeof error?.type === 'string' ? error.type : 'stripe_request_failed',
    code: typeof error?.code === 'string' ? error.code : null,
    statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : null,
  }
}

async function verifyPrice(stripe, spec, recurring) {
  const price = await stripe.prices.retrieve(process.env[spec.envKey])
  const common = price.livemode === false
    && price.active === true
    && price.currency?.toLowerCase() === 'usd'
    && price.unit_amount === spec.amountCents
  const schedule = recurring
    ? price.type === 'recurring'
      && price.recurring?.interval === 'month'
      && (price.recurring.interval_count ?? 1) === 1
    : price.type === 'one_time'
  check(`${spec.label} Stripe Price`, common && schedule, recurring
    ? `active Test Mode USD monthly Price at $${(spec.amountCents / 100).toFixed(2)}`
    : `active Test Mode one-time unit Price at $${(spec.amountCents / 100).toFixed(2)}`)
}

async function main() {
  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim()
  const publishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim()
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  const subscriptionIds = SUBSCRIPTIONS.map((spec) => (process.env[spec.envKey] || '').trim())

  check('Billing feature gate', process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true', 'NEXT_PUBLIC_BILLING_ENABLED=true')
  check('Stripe Test Mode secret key', secretKey.startsWith('sk_test_'), 'must start with sk_test_; live and unknown keys are refused')
  check('Stripe webhook signing secret', webhookSecret.startsWith('whsec_'), 'must start with whsec_')
  check('Subscription Price IDs', SUBSCRIPTIONS.every((spec) => (process.env[spec.envKey] || '').startsWith('price_')), 'Growth and Autopilot Price IDs are configured')
  check('Distinct subscription Price IDs', new Set(subscriptionIds).size === SUBSCRIPTIONS.length && subscriptionIds.every(Boolean), 'Growth and Autopilot cannot share one Price ID')
  check('Live-mode approval remains off', process.env.BILLING_LIVE_MODE_APPROVED !== 'true', 'keep BILLING_LIVE_MODE_APPROVED=false during sandbox testing')

  if (!publishableKey) {
    warnings.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is absent; hosted Checkout still works, but add the matching pk_test_ key before any client-side Stripe UI.')
  } else {
    check('Stripe Test Mode publishable key', publishableKey.startsWith('pk_test_'), 'must start with pk_test_')
  }

  const walletEnabled = process.env.CREDIT_WALLET_ENABLED === 'true'
  if (walletEnabled) {
    check('Wallet tier Price IDs', WALLET_TIERS.every((spec) => (process.env[spec.envKey] || '').startsWith('price_')), 'all four immutable unit Price IDs are configured')
  } else {
    warnings.push('Credit wallet verification skipped because CREDIT_WALLET_ENABLED is not true.')
  }

  if (checks.some((item) => !item.passed)) {
    console.log(JSON.stringify({ ok: false, mode: 'test', apiCalled: false, checks, warnings }, null, 2))
    process.exitCode = 1
    return
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16', typescript: true })
  try {
    const account = await stripe.accounts.retrieve()
    check('Stripe account authentication', account && !account.deleted, 'Test Mode API authentication succeeded')
    await Promise.all(SUBSCRIPTIONS.map((spec) => verifyPrice(stripe, spec, true)))
    if (walletEnabled) {
      await Promise.all(WALLET_TIERS.map((spec) => verifyPrice(stripe, spec, false)))
    }
  } catch (error) {
    checks.push({ name: 'Stripe API verification', passed: false, detail: safeStripeError(error) })
  }

  const ok = checks.every((item) => item.passed)
  console.log(JSON.stringify({ ok, mode: 'test', apiCalled: true, checks, warnings }, null, 2))
  if (!ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, mode: 'test', error: safeStripeError(error) }, null, 2))
  process.exitCode = 1
})
