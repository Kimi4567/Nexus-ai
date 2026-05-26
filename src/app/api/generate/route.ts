import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import * as ai from '@/lib/ai/adapter'

const CREDITS_PER_GENERATION = 10
const FREE_CREDITS = 30 // 3 free generations for new users

// Simple in-memory rate limiter per user (MVP)
const RATE_WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
const rateMap = new Map<string, { count: number; windowStart: number }>()

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit
  const entry = rateMap.get(userId) || { count: 0, windowStart: Date.now() }
  const now = Date.now()
  if (now - entry.windowStart > RATE_WINDOW_MS) { entry.count = 0; entry.windowStart = now }
  entry.count++
  rateMap.set(userId, entry)
  if (entry.count > MAX_PER_WINDOW) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
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
      message: 'You have used all your free AI credits. Upgrade to continue generating campaigns.',
      creditsRemaining: currentCredits,
      upgradeUrl: '/billing',
    }, { status: 402 })
  }
  // ────────────────────────────────────────────────────────────

  const body = await req.json()
  const { campaignId } = body
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const project = await prisma.project.findUnique({ where: { id: campaign.projectId }, include: { media: true } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  try {
    const strategy = await ai.generateMarketingStrategy(campaign as any, project as any)
    const concepts = await ai.generateAdConcepts(campaign as any, project as any)

    const genStrategy = await prisma.generation.create({
      data: {
        campaignId: campaign.id,
        type: 'SOCIAL_POST',
        prompt: 'marketing strategy',
        params: {},
        status: 'COMPLETED',
        output: JSON.stringify(strategy),
        provider: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
      },
    })

    const genConcepts = await prisma.generation.create({
      data: {
        campaignId: campaign.id,
        type: 'SOCIAL_POST',
        prompt: 'ad concepts',
        params: {},
        status: 'COMPLETED',
        output: JSON.stringify(concepts),
        provider: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
      },
    })

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

    return NextResponse.json({ strategy, concepts, genStrategy, genConcepts, creditsRemaining })
  } catch (error) {
    console.error('Generate failed:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
