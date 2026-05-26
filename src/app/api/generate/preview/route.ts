/**
 * POST /api/generate/preview
 * Generates full AI campaign content. Requires authentication + credits.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { generateMarketingStrategy, generateAdConcepts } from '@/lib/ai/adapter'
import { prisma } from '@/lib/prisma'

const CREDITS_PER_GENERATION = 10
const FREE_CREDITS = 30 // 3 free generations for new users

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

  // ── Credit check ────────────────────────────────────────────
  let dbUser = await prisma.user.findUnique({ where: { id: userId } })

  // Give free credits to brand new users (first generation ever)
  if (dbUser && dbUser.aiCredits === 0 && dbUser.subscriptionStatus === 'FREE') {
    const usageCount = await prisma.usage.aggregate({
      where: { userId },
      _sum: { generationsCount: true },
    })
    const totalGenerations = usageCount._sum.generationsCount || 0

    if (totalGenerations === 0) {
      // First time user — grant free starter credits
      dbUser = await prisma.user.update({
        where: { id: userId },
        data: { aiCredits: FREE_CREDITS },
      })
    }
  }

  const currentCredits = dbUser?.aiCredits || 0
  const isPaidUser = dbUser?.subscriptionStatus === 'ACTIVE'

  // Block free users with no credits
  if (!isPaidUser && currentCredits < CREDITS_PER_GENERATION) {
    return NextResponse.json({
      error: 'NO_CREDITS',
      message: 'You have used all your free AI credits. Upgrade to Pro to continue generating campaigns.',
      creditsRemaining: currentCredits,
      upgradeUrl: '/billing',
    }, { status: 402 })
  }
  // ────────────────────────────────────────────────────────────

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

    // Deduct credits — unlimited for paid users
    if (!isPaidUser) {
      const newCredits = Math.max(0, currentCredits - CREDITS_PER_GENERATION)
      await prisma.user.update({ where: { id: userId }, data: { aiCredits: newCredits } })
    }

    // Record usage always
    const nowDate = new Date()
    const month = nowDate.getMonth() + 1
    const year = nowDate.getFullYear()
    await prisma.usage.upsert({
      where: { userId_month_year: { userId, month, year } as any },
      update: { aiCreditsUsed: { increment: CREDITS_PER_GENERATION }, generationsCount: { increment: 1 } as any },
      create: { userId, month, year, aiCreditsUsed: CREDITS_PER_GENERATION, generationsCount: 1 },
    })

    const creditsRemaining = isPaidUser ? -1 : Math.max(0, currentCredits - CREDITS_PER_GENERATION)

    return NextResponse.json({
      campaign: campaignData,
      strategy,
      concepts,
      generatedAt: new Date().toISOString(),
      creditsRemaining,
    })
  } catch (err: any) {
    console.error('[generate/preview] error', err)
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 })
  }
}
