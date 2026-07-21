#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import Stripe from 'stripe'

const PRICING_VERSION = '2026-07-16-v2'
const TIERS = [
  {
    envKey: 'STRIPE_PRICE_CREDIT_WALLET_TIER_1',
    lookupKey: 'nexus_credit_wallet_tier_1_v2',
    range: 'Credits 1-50',
    unitAmount: 100,
  },
  {
    envKey: 'STRIPE_PRICE_CREDIT_WALLET_TIER_2',
    lookupKey: 'nexus_credit_wallet_tier_2_v2',
    range: 'Credits 51-150',
    unitAmount: 90,
  },
  {
    envKey: 'STRIPE_PRICE_CREDIT_WALLET_TIER_3',
    lookupKey: 'nexus_credit_wallet_tier_3_v2',
    range: 'Credits 151-300',
    unitAmount: 80,
  },
  {
    envKey: 'STRIPE_PRICE_CREDIT_WALLET_TIER_4',
    lookupKey: 'nexus_credit_wallet_tier_4_v2',
    range: 'Credits 301-500',
    unitAmount: 70,
  },
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

function argumentValue(name) {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

function safeStripeError(error) {
  return {
    type: typeof error?.type === 'string' ? error.type : 'stripe_request_failed',
    code: typeof error?.code === 'string' ? error.code : null,
    statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : null,
  }
}

function priceMatches(price, tier, productId) {
  return price.active === true
    && price.livemode === false
    && price.product === productId
    && price.currency?.toLowerCase() === 'usd'
    && price.type === 'one_time'
    && price.unit_amount === tier.unitAmount
    && price.lookup_key === tier.lookupKey
}

async function main() {
  loadLocalEnv(path.resolve('.env.local'))
  loadLocalEnv(path.resolve('.env'))

  const apply = process.argv.includes('--apply')
  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim()
  const productId = argumentValue('product') || (process.env.STRIPE_CREDIT_WALLET_PRODUCT_ID || '').trim()

  if (!secretKey.startsWith('sk_test_')) {
    throw new Error('Refusing to call Stripe: STRIPE_SECRET_KEY must be a Test Mode sk_test_ key.')
  }
  if (!productId.startsWith('prod_')) {
    throw new Error('Provide a Test Mode wallet product through --product=prod_... or STRIPE_CREDIT_WALLET_PRODUCT_ID.')
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16', typescript: true })
  const product = await stripe.products.retrieve(productId)
  if (product.deleted || product.active !== true || product.livemode !== false) {
    throw new Error('The wallet product must be active and belong to Stripe Test Mode.')
  }

  const listed = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  const resolved = []

  for (const tier of TIERS) {
    const existing = listed.data.find((price) => price.lookup_key === tier.lookupKey)
    if (existing && !priceMatches(existing, tier, productId)) {
      throw new Error(`Lookup key ${tier.lookupKey} exists but does not match the immutable ${tier.range} contract.`)
    }
    if (existing) {
      resolved.push({ ...tier, id: existing.id, created: false })
      continue
    }
    if (!apply) {
      resolved.push({ ...tier, id: null, created: false })
      continue
    }

    const created = await stripe.prices.create({
      product: productId,
      currency: 'usd',
      unit_amount: tier.unitAmount,
      nickname: tier.range,
      lookup_key: tier.lookupKey,
      metadata: {
        nexus_contract: 'credit_wallet_progressive_tier',
        pricing_version: PRICING_VERSION,
        credit_range: tier.range,
        env_key: tier.envKey,
      },
    })
    if (!priceMatches(created, tier, productId)) {
      throw new Error(`Stripe returned an unexpected Price object for ${tier.range}.`)
    }
    resolved.push({ ...tier, id: created.id, created: true })
  }

  const ok = resolved.every((tier) => tier.id?.startsWith('price_'))
  console.log(JSON.stringify({
    ok,
    mode: 'test',
    applied: apply,
    product: { id: product.id, name: product.name },
    pricingVersion: PRICING_VERSION,
    prices: resolved.map(({ envKey, range, unitAmount, id, created }) => ({
      envKey,
      range,
      unitAmountCents: unitAmount,
      id,
      created,
    })),
    next: ok
      ? 'Update the four Vercel environment variables with these IDs, redeploy, then run npm run billing:verify-test-mode.'
      : 'Review the dry run, then repeat with --apply to create only the missing immutable Test Mode prices.',
  }, null, 2))
  if (!ok) process.exitCode = 2
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    mode: 'test',
    error: error instanceof Error ? error.message : safeStripeError(error),
  }, null, 2))
  process.exitCode = 1
})
