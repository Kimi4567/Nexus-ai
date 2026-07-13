/**
 * POST /api/generate/preview
 * Generates full AI campaign content. Requires authentication + credits.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { generateMarketingStrategy, generateAdConcepts } from '@/lib/ai/adapter'
import { prisma } from '@/lib/prisma'
import { checkAndDeductCredits, refundCredits } from '@/lib/credits'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'

// Simple in-memory rate limiter: 5 generations per user per minute
const rateMap = new Map<string, { count: number; reset: number }>()
const LIMIT = 5
const WINDOW_MS = 60_000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(userId) ?? { count: 0, reset: now + WINDOW_MS }
  if (now > entry.reset) { entry.count = 0; entry.reset = now + WINDOW_MS }
  entry.count++
  rateMap.set(userId, entry)
  return entry.count <= LIMIT
}

export async function POST(req: NextRequest) {
  // Require auth
  const userId = await getServerUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit
  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, goal, audience, tone, platforms, description, brandProfile, language } = body
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
  }

  if (!isAiProviderConfigured()) {
    return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
  }

  // ── Unified credit check + deduction ────────────────────────────────────────
  const credit = await checkAndDeductCredits(userId, 'CAMPAIGN_GENERATION')
  if (!credit.ok) {
    return NextResponse.json(credit, { status: 402 })
  }
  // ────────────────────────────────────────────────────────────────────────────

  try {
    const campaignData = {
      name: name.trim(),
      goal: goal || 'SALES',
      audience: audience || '',
      tone: tone || 'MODERN',
      platforms: platforms || [],
      description: description || '',
      brandProfile: brandProfile || null,
      language: typeof language === 'string' ? language : 'ar',
    }
    const projectData = { businessType: description || name }

    const [strategy, concepts] = await Promise.all([
      generateMarketingStrategy(campaignData, projectData),
      generateAdConcepts(campaignData, projectData),
    ])

    return NextResponse.json({
      campaign: campaignData,
      strategy,
      concepts,
      generatedAt: new Date().toISOString(),
      creditsRemaining: credit.creditsRemaining,
    })
  } catch (err: any) {
    console.error('[generate/preview] error', err)
    // Refund — failed generation must not charge the user (skip unlimited plans)
    if (credit.creditsUsed > 0) await refundCredits(userId, 'CAMPAIGN_GENERATION')
    return NextResponse.json({ error: err.message || 'Generation failed', refunded: credit.creditsUsed > 0 }, { status: 500 })
  }
}
