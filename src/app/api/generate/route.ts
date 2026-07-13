import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import * as ai from '@/lib/ai/adapter'
import { checkAndDeductCredits, refundCredits, refundCreditsForTransaction } from '@/lib/credits'
import { aiRateLimitDb } from '@/lib/dbRateLimit'
import { validateOutputObject, logQualityReport } from '@/lib/ai/outputValidator'
import { getRelevantMemories, formatMemoriesForPrompt, saveCampaignMemory } from '@/lib/campaign-memory'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // BUG-03 fix: DB-backed rate limit (cross-instance, survives cold starts)
  const rl = await aiRateLimitDb(userId)
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
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

  if (!isAiProviderConfigured()) {
    return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
  }

  // Attach language preference so AI functions use the correct output language
  // Falls back to 'ar' (Arabic) to preserve behaviour for existing users
  const memories = await getRelevantMemories({
    workspaceId: workspace.id,
    goal: campaign.goal ?? undefined,
  })
  const pastLearnings = formatMemoriesForPrompt(memories) || undefined

  const campaignWithLang = {
    ...(campaign as any),
    language: language || 'ar',
    pastLearnings,
  }

  // ── Unified credit check + deduction ────────────────────────────────────────
  // Deduct only after cheap validation and ownership checks pass. The next step
  // is the expensive AI/provider work.
  const credit = await checkAndDeductCredits(userId, 'CAMPAIGN_GENERATION')
  if (!credit.ok) {
    return NextResponse.json(credit, { status: 402 })
  }
  // ────────────────────────────────────────────────────────────────────────────

  try {
    // Run both AI calls in parallel — halves execution time vs sequential
    const [strategy, concepts] = await Promise.all([
      ai.generateMarketingStrategy(campaignWithLang, project as any),
      ai.generateAdConcepts(campaignWithLang, project as any),
    ])

    // AD3: Post-generation quality validation (non-blocking — logs only)
    const qualityReport = validateOutputObject(strategy, {
      brandName: campaign.name,
      minScore: 40,
    })
    logQualityReport('/api/generate', qualityReport, `campaign=${campaign.id}`)

    // ── CRITICAL: Save aiOutput — run in parallel with non-critical audit records ──
    await Promise.all([
      prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          aiOutput: { strategy, concepts },
          activities: {
            create: {
              type: 'generated',
              description: 'AI strategy and ad concepts generated',
            },
          },
        },
      }),
      // Audit records — non-critical, failures are silenced
      prisma.generation.create({
        data: {
          campaignId: campaign.id, type: 'SOCIAL_POST', prompt: 'marketing strategy',
          params: {}, status: 'COMPLETED', output: JSON.stringify(strategy),
          provider: 'openai',
        },
      }).catch(() => null),
      prisma.generation.create({
        data: {
          campaignId: campaign.id, type: 'SOCIAL_POST', prompt: 'ad concepts',
          params: {}, status: 'COMPLETED', output: JSON.stringify(concepts),
          provider: 'openai',
        },
      }).catch(() => null),
    ])

    // Save campaign memory (non-blocking — never delays the response)
    saveCampaignMemory({
      workspaceId: workspace.id,
      campaignId: campaign.id,
      goal: campaign.goal ?? undefined,
      tone: (campaign as any).tone ?? undefined,
      audienceHint: campaign.audience ?? undefined,
      strategy: strategy as any,
    }).catch(() => {})

    return NextResponse.json({
      strategy,
      concepts,
      creditsRemaining: credit.creditsRemaining,
      qualityScore: qualityReport.score,
    })
  } catch (error) {
    console.error('Generate failed:', error)
    // Refund — failed generation must not charge the user (skip unlimited plans)
    if (credit.creditsUsed > 0) {
      if (credit.transactionId) {
        await refundCreditsForTransaction({
          userId,
          transactionId: credit.transactionId,
          reason: 'Campaign generation failed',
        })
      } else {
        await refundCredits(userId, 'CAMPAIGN_GENERATION')
      }
    }
    return NextResponse.json({ error: 'Generation failed', refunded: credit.creditsUsed > 0 }, { status: 500 })
  }
}
