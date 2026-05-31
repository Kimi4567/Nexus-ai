import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import * as ai from '@/lib/ai/adapter'
import { checkAndDeductCredits } from '@/lib/credits'

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

  // ── Unified credit check + deduction ────────────────────────────────────────
  const credit = await checkAndDeductCredits(userId, 'CAMPAIGN_GENERATION')
  if (!credit.ok) {
    return NextResponse.json(credit, { status: 402 })
  }
  // ────────────────────────────────────────────────────────────────────────────

  const body = await req.json()
  const { campaignId, language } = body
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const project = await prisma.project.findUnique({ where: { id: campaign.projectId }, include: { media: true } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Attach language preference so AI functions use the correct output language
  // Falls back to 'ar' (Arabic) to preserve behaviour for existing users
  const campaignWithLang = { ...(campaign as any), language: language || 'ar' }

  try {
    const strategy = await ai.generateMarketingStrategy(campaignWithLang, project as any)
    const concepts = await ai.generateAdConcepts(campaignWithLang, project as any)

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

    return NextResponse.json({
      strategy,
      concepts,
      genStrategy,
      genConcepts,
      creditsRemaining: credit.creditsRemaining,
    })
  } catch (error) {
    console.error('Generate failed:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
