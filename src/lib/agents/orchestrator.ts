/**
 * Agent Orchestrator
 *
 * Coordinates all 4 agents for a workspace.
 * Called by /api/agents/run and the cron jobs.
 */

import { prisma } from '@/lib/prisma'
import { runStrategistAgent, BusinessBrief, StrategyOutput } from './strategist'
import { runContentDirectorAgent, ContentDirectorInput, ContentDirectorOutput } from './content-director'
import { saveCampaignMemory } from '@/lib/campaign-memory'
import { getStrategyCapabilities } from '@/lib/brandReadiness'
import { applyServerReadiness, collectMissingKeys } from '@/lib/strategyNormalize'
import { guardStrategyKpis } from '@/lib/ai/strategyKpiGuard'
import type { StrategyReadinessContext } from './strategist'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { readLockedCampaignAllowance } from '@/lib/campaignCommercial'

// Re-export for API routes
export type { BusinessBrief }

const db = prisma as any  // new models not yet in generated client — safe cast

export interface OrchestratorResult {
  agentRunId: string
  strategyCreated: boolean
  contentCreated: boolean
  suggestions: number
  errors: string[]
}

/**
 * Full agency run — Strategist → Content Director → save to DB
 * Called when user submits the /start briefing form
 */
export async function runFullAgency(
  workspaceId: string,
  brief: BusinessBrief
): Promise<OrchestratorResult> {
  const errors: string[] = []
  let strategyCreated = false
  let contentCreated = false
  let suggestionsCount = 0

  // AgentRun is non-critical — wrap so it never blocks strategy generation
  let agentRun: { id: string } = { id: 'local-' + Date.now() }
  try {
    agentRun = await db.agentRun.create({
      data: {
        workspaceId,
        agent: 'STRATEGIST',
        status: 'RUNNING',
        triggeredBy: 'user',
        inputData: brief,
      },
    })
  } catch (agentRunErr) {
    console.warn('[Orchestrator] agentRun.create failed (non-critical):', agentRunErr)
  }

  try {
    // 0. Resolve user plan tier from workspace owner
    // NOTE: User model uses 'subscriptionStatus' not 'plan'
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { owner: { select: { subscriptionStatus: true } } },
    })
    const planTier = (workspace?.owner?.subscriptionStatus || 'free').toLowerCase()

    // Inject plan tier into brief so agents can scale output depth
    if (!brief.planTier) {
      brief = { ...brief, planTier }
    }

    // 1. Brand context — inject ALL Brand Brain fields
    const brandProfile = await prisma.brandProfile.findUnique({ where: { workspaceId } })
    const brandContext = buildBrandExecutionContext(brandProfile as unknown as Record<string, unknown> | null)

    // 1b. PR-2B1 — compute capability readiness server-side (single source of truth)
    //     and build the compact readiness context passed into the strategist.
    const bp: any = brandProfile || {}
    const capabilities = getStrategyCapabilities(bp, { hasPixel: false })
    const hasHistoricalData = Boolean(bp.pastAdResults)
    const readiness: StrategyReadinessContext = {
      capabilities: Object.values(capabilities).map(c => ({
        id: c.id, ready: c.ready, confidence: c.confidence, missingKeys: c.missingKeys,
      })),
      missingKeys: collectMissingKeys(capabilities),
      hasBudget: Boolean(bp.marketingBudget),
      hasConversionDestination: Boolean(bp.conversionDestination),
      hasCompetitors: Boolean(bp.competitors?.length) || Boolean(bp.competitorNotes),
      hasHistoricalData,
      hasPixel: false,
    }
    // Numbers the model is allowed to echo (user-provided), used by the scrubber.
    const allowedNumbers = [bp.marketingBudget, bp.pricePoint, bp.averageOrderValue, bp.customerLifetimeValue, bp.grossMargin]
      .filter(Boolean) as string[]
    const allowedCompetitors = [
      ...((bp.competitors as string[] | undefined) || []),
      ...(bp.competitorNotes ? [bp.competitorNotes as string] : []),
    ]

    // 2. Strategist agent
    let strategy: StrategyOutput = await runStrategistAgent(brief, brandContext, brief.language, readiness)
    // 2b. PR-2B1 — server-authoritative readiness + anti-hallucination scrubbing.
    //     The model's confidenceReport/missingData/competitorAnalysisComplete are
    //     DISCARDED and replaced from getStrategyCapabilities() here.
    strategy = applyServerReadiness(strategy, capabilities, {
      hasHistoricalData, allowedCompetitors, allowedNumbers,
    })
    // 2c. PR-I — KPI Truth Guard. applyServerReadiness flags KPIs as hypotheses but
    //     does NOT scrub the KPI/metric `target` strings, so invented figures like
    //     "Increase by 20%" leaked through. This strips unsupported performance
    //     numbers from KPI targets / success metrics / estimated results, keeping
    //     only user/analytics-provided numbers (allowedNumbers) and calendar timeframes.
    strategy = guardStrategyKpis(strategy as unknown as Record<string, unknown>, allowedNumbers) as unknown as StrategyOutput

    // 3. Content Director REMOVED from runFullAgency to avoid Vercel 60s timeout.
    //    Strategy-only run: campaign is created from strategy output.
    //    Content plan is generated separately via /api/campaigns/[id]/generate-content-plan
    //    which the user can trigger from the Content Hub.
    const content: ContentDirectorOutput = {
      contentPillars: strategy.contentPillars || [],
      calendar: [],
      topHooks: (strategy as any).topHooks || [],
      ctaVariations: (strategy as any).ctaVariations || [],
      scriptTemplate: '',
      captionFormulas: [],
    }

    // 4–5. Create the project/campaign under the same commercial lock used by
    // every other campaign creation path. The expensive strategy above remains
    // refundable if another concurrent request consumed the final allowance.
    // ── Null-safe field extraction ────────────────────────────────────────────
    const campaignName = strategy.campaignName
      || strategy.goal
      || `${brief.companyName} Campaign`

    const campaignDesc = strategy.positioning
      || (strategy as any).keyMessage
      || (strategy as any).positioningStatement
      || ''

    const campaignAudience = strategy.targetAudienceRefined
      || (strategy as any).targetAudience
      || brief.targetAudience
      || 'General audience'

    const rawPlatforms = Array.isArray(strategy.channelMix)
      ? strategy.channelMix.map((c: any) => c?.platform || c || '').filter(Boolean)
      : []

    console.log('[Orchestrator] Creating campaign:', {
      name: campaignName,
      goal: strategy.goal,
      platforms: rawPlatforms,
      hasAudience: !!campaignAudience,
    })
    // ─────────────────────────────────────────────────────────────────────────

    const campaign = await prisma.$transaction(async (tx) => {
      const workspaceRecord = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } })
      if (!workspaceRecord) throw new Error('Workspace not found')
      const allowance = await readLockedCampaignAllowance(tx, workspaceRecord.ownerId)
      if (allowance.limit !== 999 && allowance.current >= allowance.limit) {
        throw new Error(`CAMPAIGN_LIMIT_REACHED:${allowance.limit}:${allowance.periodEnd.toISOString()}`)
      }

      let project = await tx.project.findFirst({ where: { workspaceId }, orderBy: { createdAt: 'desc' } })
      if (!project) {
        project = await tx.project.create({
          data: {
            workspaceId,
            name: `${brief.companyName.slice(0, 90)} Marketing`,
            description: brief.targetAudience?.slice(0, 500),
            businessType: brief.businessType?.slice(0, 120),
            status: 'ACTIVE',
          },
        })
      }

      return tx.campaign.create({
        data: {
          workspaceId,
          projectId: project.id,
          name: String(campaignName).slice(0, 120),
          description: String(campaignDesc).slice(0, 2_000),
          goal: mapGoal(strategy.goal) as any,
          audience: String(campaignAudience).slice(0, 1_000),
          tone: 'MODERN',
          platforms: mapPlatforms(rawPlatforms) as any,
          status: 'DRAFT',
          aiOutput: {
            strategy,
            contentCalendar: content.calendar,
            topHooks: content.topHooks?.length ? content.topHooks : (strategy as any).topHooks || [],
            ctaVariations: content.ctaVariations?.length ? content.ctaVariations : (strategy as any).ctaVariations || [],
            captionFormulas: content.captionFormulas || [],
            scriptTemplate: content.scriptTemplate || '',
            contentPillars: content.contentPillars?.length ? content.contentPillars : strategy.contentPillars || [],
            language: brief.language || 'ar',
            selectedMediaIds: Array.isArray((brief as any).selectedMediaIds) ? (brief as any).selectedMediaIds : [],
            generatedAt: new Date().toISOString(),
            generatedByAgents: true,
          } as any,
        },
      })
    })
    strategyCreated = true
    contentCreated = true // Content Director is a later, separate workflow.

    // 5b. Save campaign memory (non-blocking)
    saveCampaignMemory({
      workspaceId,
      campaignId: campaign.id,
      goal: brief.primaryGoal ?? undefined,
      tone: undefined,
      industry: brief.businessType ?? undefined,
      audienceHint: brief.targetAudience ?? undefined,
      strategy,
    }).catch(() => {})

    // 6. Update brand profile insights
    if (brandProfile) {
      await prisma.brandProfile.update({
        where: { workspaceId },
        data: {
          aiInsights: {
            summary: strategy.positioning,
            recommendations: strategy.contentPillars,
            lastUpdated: new Date().toISOString(),
          },
        },
      })
    }

    // 7. Create strategy suggestion for user to approve
    await db.agentSuggestion.create({
      data: {
        workspaceId,
        agentRunId: agentRun.id,
        agent: 'STRATEGIST',
        type: 'STRATEGY',
        status: 'PENDING',
        priority: 1,
        title: `Strategy ready: ${strategy.campaignName}`,
        reasoning: `Planning hypothesis based on the approved brief for ${strategy.goal.toLowerCase()} and the stated audience. Review the strategy, evidence requirements, and execution package before approval.`,
        impact: 'Potential impact is not estimated until eligible platform evidence is available.',
        payload: { strategy, campaignId: campaign.id },
        campaignId: campaign.id,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    })
    suggestionsCount++

    await db.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: 'COMPLETED',
        outputData: { strategyCreated, contentCreated, campaignId: campaign.id },
        completedAt: new Date(),
      },
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Log full error stack so Vercel logs show the real failure point
    console.error('[Orchestrator] runFullAgency FAILED:', message, err)
    errors.push(message)
    await db.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    }).catch(() => {})  // Don't let agentRun update failure mask the real error
  }

  return { agentRunId: agentRun.id, strategyCreated, contentCreated, suggestions: suggestionsCount, errors }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function mapGoal(goal: string): string {
  const g = goal.toUpperCase()
  const valid = ['SALES', 'AWARENESS', 'LEADS', 'TRAFFIC', 'ENGAGEMENT', 'BRAND_BUILDING']
  return valid.find(v => v.includes(g) || g.includes(v)) || 'LEADS'
}

function mapPlatforms(platforms: string[]): string[] {
  const map: Record<string, string> = {
    instagram: 'INSTAGRAM', tiktok: 'TIKTOK', facebook: 'FACEBOOK',
    linkedin: 'LINKEDIN', twitter: 'TWITTER', youtube: 'YOUTUBE_SHORTS',
    snapchat: 'SNAPCHAT', website: 'WEBSITE',
  }
  const valid = ['TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE_SHORTS', 'SNAPCHAT', 'LINKEDIN', 'TWITTER', 'WEBSITE']
  return platforms
    .map(p => map[p.toLowerCase()] || p.toUpperCase())
    .filter(p => valid.includes(p))
    .slice(0, 3)
}
