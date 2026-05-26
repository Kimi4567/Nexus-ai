/**
 * Lemon Squeezy billing integration
 * Replaces Stripe — no trade license required, works globally
 */

export const PLANS = {
  STARTER: {
    name: 'Starter',
    price: 29,
    credits: 50,
    campaigns: 3,
    workspaces: 1,
    variantId: process.env.LS_VARIANT_STARTER || '',
    features: ['50 AI credits/month', '3 campaigns/month', '1 workspace', 'PDF exports', 'Email support'],
    description: 'Perfect for solo creators and small brands',
  },
  PRO: {
    name: 'Pro',
    price: 79,
    credits: 200,
    campaigns: -1,
    workspaces: 3,
    variantId: process.env.LS_VARIANT_PRO || '',
    features: ['200 AI credits/month', 'Unlimited campaigns', '3 workspaces', 'Social publishing', 'Priority support'],
    description: 'For growing brands and marketing teams',
  },
  AGENCY: {
    name: 'Agency',
    price: 199,
    credits: -1,
    campaigns: -1,
    workspaces: 10,
    variantId: process.env.LS_VARIANT_AGENCY || '',
    features: ['Unlimited AI credits', 'Unlimited campaigns', '10 workspaces', 'White label', 'Dedicated support'],
    description: 'For agencies managing multiple clients',
  },
} as const

export type PlanKey = keyof typeof PLANS

const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY || ''
const LS_STORE_ID = process.env.LS_STORE_ID || ''
const BASE_URL = 'https://api.lemonsqueezy.com/v1'

// Generic LS API call
async function lsRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${LS_API_KEY}`,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LS API error ${res.status}: ${text}`)
  }
  return res.json()
}

// Create a checkout URL for a given plan
export async function createCheckoutUrl(
  variantId: string,
  userEmail: string,
  userId: string,
  planKey: string,
  baseUrl: string
): Promise<string> {
  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_options: {
          embed: false,
          media: false,
          logo: true,
        },
        checkout_data: {
          email: userEmail,
          custom: {
            user_id: userId,
            plan: planKey,
          },
        },
        product_options: {
          redirect_url: `${baseUrl}/billing?success=true&plan=${planKey.toLowerCase()}`,
        },
        expires_at: null,
      },
      relationships: {
        store: {
          data: { type: 'stores', id: LS_STORE_ID },
        },
        variant: {
          data: { type: 'variants', id: variantId },
        },
      },
    },
  }

  const data = await lsRequest('/checkouts', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return data.data?.attributes?.url as string
}

// Get a customer portal URL for subscription management
export async function getCustomerPortalUrl(subscriptionId: string): Promise<string> {
  const data = await lsRequest(`/subscriptions/${subscriptionId}`)
  return data.data?.attributes?.urls?.customer_portal as string
}

// Verify Lemon Squeezy webhook signature
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(rawBody)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return computedHex === signature
  } catch {
    return false
  }
}
