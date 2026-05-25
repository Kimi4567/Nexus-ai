/**
 * POST /api/generate/preview
 * Generates full AI campaign content. Requires authentication.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { generateMarketingStrategy, generateAdConcepts } from '@/lib/ai/adapter'

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

  try {
    const body = await req.json()
    const { name, goal, audience, tone, platforms, description, brandProfile } = body

    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    const campaignData = {
      name,
      goal: goal || 'SALES',
      audience: audience || '',
      tone: tone || 'MODERN',
      platforms: platforms || [],
      description: description || '',
      brandProfile: brandProfile || null,
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
    })
  } catch (err: any) {
    console.error('[generate/preview] error', err)
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 })
  }
}
