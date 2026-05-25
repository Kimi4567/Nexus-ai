import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import * as ai from '@/lib/ai/adapter'

// Simple in-memory rate limiter per user (MVP)
const RATE_WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
const rateMap = new Map<string, { count: number; windowStart: number }>()

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // rate limit
  const entry = rateMap.get(userId) || { count: 0, windowStart: Date.now() }
  const now = Date.now()
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 0
    entry.windowStart = now
  }
  entry.count++
  rateMap.set(userId, entry)
  if (entry.count > MAX_PER_WINDOW) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

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

    // Create Generation records for tracking
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

    // Decrement user's AI credits (simple model: -10 credits per generation)
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      const newCredits = Math.max(0, (user.aiCredits || 0) - 10)
      await prisma.user.update({ where: { id: userId }, data: { aiCredits: newCredits } })

      // Record usage
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      await prisma.usage.upsert({
        where: { userId_month_year: { userId, month, year } as any },
        update: { aiCreditsUsed: { increment: 10 }, generationsCount: { increment: 1 } as any },
        create: { userId, month, year, aiCreditsUsed: 10, generationsCount: 1 },
      })
    }

    return NextResponse.json({ strategy, concepts, genStrategy, genConcepts })
  } catch (error) {
    console.error('Generate failed:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
