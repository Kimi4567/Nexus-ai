import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const PLANS = {
  STARTER: {
    name: 'Starter',
    price: 2900,
    credits: 50,
    campaigns: 3,
    workspaces: 1,
    features: ['50 AI credits/month', '3 campaigns/month', '1 workspace', 'PDF exports', 'Email support'],
    description: 'Perfect for solo creators and small brands',
  },
  PRO: {
    name: 'Pro',
    price: 7900,
    credits: 200,
    campaigns: -1,
    workspaces: 3,
    features: ['200 AI credits/month', 'Unlimited campaigns', '3 workspaces', 'Social publishing', 'Priority support'],
    description: 'For growing brands and marketing teams',
  },
  AGENCY: {
    name: 'Agency',
    price: 19900,
    credits: -1,
    campaigns: -1,
    workspaces: 10,
    features: ['Unlimited AI credits', 'Unlimited campaigns', '10 workspaces', 'White label', 'Dedicated support'],
    description: 'For agencies managing multiple clients',
  },
} as const

export type PlanKey = keyof typeof PLANS
