import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import * as ai from '@/lib/ai/adapter'
import { checkAndDeductCredits } from '@/lib/credits'
import { aiRateLimitDb } from '@/lib/dbRateLimit'

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // BUG-03 fix: DB-backed rate limit (cross-instance, survives cold starts)
  const rl = await aiRateLimitDb(userId)
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

  // ── Unified credit check + deduction ────────────────────────────────────────
  const credit = await checkAndDeductCredits(userId, 'CAMPAIGN_GENERATION')
  if (!credit.ok) {
    return NextResponse.json(credit, { status: 402 })
  }
  // ────────────────────────────────────────────────────────────────────────────

  const body = await req.json()
  const { campaignId, language } = body
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

  // BUG-04 fix: verify ownership — only the campaign owner can trigger generation
  const workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
  })
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
