/**
 * Stripe integration for billing
 */

import Stripe from 'stripe'

const useMock = process.env.STRIPE_MOCK === '1' || !process.env.STRIPE_SECRET_KEY

if (useMock) {
  console.warn('Stripe running in MOCK mode. Set STRIPE_SECRET_KEY to enable live mode.')
}

let stripe: Stripe | null = null
if (!useMock) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
  })
}

export async function createCustomer(email: string, name?: string) {
  if (useMock) {
    return { id: `mock_cust_${Date.now()}`, email, name }
  }
  return stripe!.customers.create({ email, name })
}

export async function createSubscription(customerId: string, priceId: string) {
  if (useMock) {
    return {
      id: `mock_sub_${Date.now()}`,
      customer: customerId,
      items: [{ price: priceId }],
      status: 'incomplete',
    }
  }
  return stripe!.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  })
}

export async function cancelSubscription(subscriptionId: string) {
  if (useMock) {
    return { id: subscriptionId, deleted: true }
  }
  return stripe!.subscriptions.cancel(subscriptionId)
}

export const PRICING = {
  STARTER: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    monthlyCredits: 100,
    monthlyExports: 10,
    maxTeamMembers: 1,
  },
  PRO: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    monthlyCredits: 500,
    monthlyExports: 50,
    maxTeamMembers: 5,
  },
  AGENCY: {
    name: 'Agency',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
    monthlyCredits: 2000,
    monthlyExports: 500,
    maxTeamMembers: 50,
  },
}
