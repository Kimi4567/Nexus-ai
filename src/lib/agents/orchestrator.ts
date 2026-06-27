/**
 * Agent Orchestrator
 *
 * Coordinates all 4 agents for a workspace.
 * Called by /api/agents/run and the cron jobs.
 */

import { prisma } from '@/lib/prisma'
import { runStrategistAgent, BusinessBrief, StrategyOutput } from './strategist'
import { runContentDirectorAgent, ContentDirectorInput, ContentDirectorOutput } from './content-director'
import {
  runCampaignManagerAgent,
  buildMetricsFromCampaign,
  CampaignManagerOutput,
} from './campaign-manager'
import { runReportingAgent, getPeriodLabel, ReportingInput } from './reporting'
import { saveCampaignMemory } from '@/lib/campaign-memory'
import { getStrategyCapabilities } from '@/lib/brandReadiness'
import { applyServerReadiness, collectMissingKeys } from '@/lib/strategyNormalize'
import { guardStrategyKpis } from '@/lib/ai/strategyKpiGuard'
import { buildProofPolicyPrompt, guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import type { StrategyReadinessContext } from './strategist'

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
    const planTier = (workspace?.owner?.subscriptionStatus || 'starter').toLowerCase()

    // Inject plan tier into brief so agents can scale output depth
    if (!brief.planTier) {
      brief = { ...brief, planTier }
    }

    // 1. Brand context — inject ALL Brand Brain fields
    const brandProfile = await prisma.brandProfile.findUnique({ where: { workspaceId } })
    const brandContext = brandProfile
      ? [
          `Brand: ${brandProfile.brandName || 'Unknown'}`,
          brandProfile.industry ? `Industry: ${brandProfile.industry}` : '',
          brandProfile.description ? `Business Description: ${brandProfile.description}` : '',
          brandProfile.primaryOffer ? `Core Offer: ${brandProfile.primaryOffer}` : '',
          brandProfile.pricePoint ? `Price Positioning: ${brandProfile.pricePoint}` : '',
          brandProfile.uniqueAdvantages?.length ? `Unique Advantages: ${brandProfile.uniqueAdvantages.join(', ')}` : '',
          brandProfile.targetAudience ? `Target Audience: ${brandProfile.targetAudience}` : '',
          brandProfile.audienceAge ? `Audience Age Range: ${brandProfile.audienceAge}` : '',
          brandProfile.audienceLocation ? `Market / Region: ${brandProfile.audienceLocation}` : '',
          brandProfile.audiencePainPoints?.length ? `Audience Pain Points: ${brandProfile.audiencePainPoints.join(', ')}` : '',
          brandProfile.audienceDesires?.length ? `Audience Desires: ${brandProfile.audienceDesires.join(', ')}` : '',
          brandProfile.toneKeywords?.length ? `Brand Tone: ${brandProfile.toneKeywords.join(', ')}` : '',
          brandProfile.writingStyle ? `Writing Style: ${brandProfile.writingStyle}` : '',
          brandProfile.avoidKeywords?.length ? `Never use these words: ${brandProfile.avoidKeywords.join(', ')}` : '',
          brandProfile.topPlatforms?.length ? `Best Platforms: ${brandProfile.topPlatforms.join(', ')}` : '',
          brandProfile.winningHooks?.length ? `Winning Hooks (use as style reference): ${brandProfile.winningHooks.slice(0, 3).join(' | ')}` : '',
          brandProfile.winningAngles?.length ? `Winning Angles: ${brandProfile.winningAngles.slice(0, 3).join(', ')}` : '',
          buildProofPolicyPrompt({ verifiedProof: brandProfile.verifiedProof }),
          brandProfile.competitorNotes ? `Competitor Notes: ${brandProfile.competitorNotes}` : '',
          (brandProfile as any).competitors?.length ? `Named Competitors (use ONLY these — never invent others): ${(brandProfile as any).competitors.join(', ')}` : '',
          brandProfile.strategicNotes ? `Strategic Notes: ${brandProfile.strategicNotes}` : '',
          // PR-2B1 — wire the PR-2A strategy-data fields into the strategist context.
          (brandProfile as any).businessGoal ? `Business Goal: ${(brandProfile as any).businessGoal}` : '',
          (brandProfile as any).marketingBudget ? `Marketing Budget (band): ${(brandProfile as any).marketingBudget}` : '',
          (brandProfile as any).conversionDestination ? `Conversion Destination: ${(brandProfile as any).conversionDestination}` : '',
          (brandProfile as any).leadHandling ? `Lead Handling / Sales Process: ${(brandProfile as any).leadHandling}` : '',
          (brandProfile as any).customerObjections?.length ? `Customer Objections: ${(brandProfile as any).customerObjections.join(', ')}` : '',
          (brandProfile as any).complianceNotes ? `Compliance Notes: ${(brandProfile as any).complianceNotes}` : '',
          (brandProfile as any).averageOrderValue ? `Average Order Value: ${(brandProfile as any).averageOrderValue}` : '',
          (brandProfile as any).grossMargin ? `Gross Margin: ${(brandProfile as any).grossMargin}` : '',
          (brandProfile as any).customerLifetimeValue ? `Customer Lifetime Value: ${(brandProfile as any).customerLifetimeValue}` : '',
          (brandProfile as any).salesCycleLength ? `Sales Cycle Length: ${(brandProfile as any).salesCycleLength}` : '',
          (brandProfile as any).seasonality ? `Seasonality: ${(brandProfile as any).seasonality}` : '',
          (brandProfile as any).pastAdResults ? `Past Ad Results (historical data): ${(brandProfile as any).pastAdResults}` : '',
        ].filter(Boolean).join('\n')
      : ''

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
    const proofContext = {
      verifiedProof: (bp.verifiedProof as string[] | undefined) || [],
      budgetText: typeof bp.marketingBudget === 'string' ? bp.marketingBudget : null,
    }

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
    // GEN-TRUTH1 — deterministic proof guard. Prompt policy prevents most issues;
    // this backstop keeps unsupported testimonials/customer stories/awards from
    // being persisted when Brand Brain has no verified proof.
    strategy = guardStrategyProof(strategy, proofContext)
    strategyCreated = true

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
    contentCreated = true  // Content Director runs separately — mark as ok

    // 4. Find or create project
    let project = await db.project.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    if (!project) {
      project = await db.project.create({
        data: {
          workspaceId,
          name: `${brief.companyName} Marketing`,
          description: brief.targetAudience,
          businessType: brief.businessType,
          status: 'ACTIVE',
        },
      })
    }

    // 5. Create campaign
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

    const campaign = await db.campaign.create({
      data: {
        workspaceId,
        projectId: project.id,
        name: campaignName,
        description: campaignDesc,
        goal: mapGoal(strategy.goal),
        audience: campaignAudience,
        tone: 'MODERN',
        platforms: mapPlatforms(rawPlatforms),
        status: 'DRAFT',
        aiOutput: {
          strategy,
          contentCalendar: content.calendar,
          topHooks: content.topHooks?.length ? content.topHooks : (strategy as any).topHooks || [],
          ctaVariations: content.ctaVariations?.length ? content.ctaVariations : (strategy as any).ctaVariations || [],
          captionFormulas: content.captionFormulas || [],
          scriptTemplate: content.scriptTemplate || '',
          contentPillars: content.contentPillars?.length ? content.contentPillars : strategy.contentPillars || [],
          // Persist language so all downstream agents (content plan, images) use the same language
          language: brief.language || 'ar',
          selectedMediaIds: Array.isArray((brief as any).selectedMediaIds) ? (brief as any).selectedMediaIds : [],
          generatedAt: new Date().toISOString(),
          generatedByAgents: true,
        },
      },
    })

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
        reasoning: `Based on your brief, I've built a ${strategy.goal.toLowerCase()} campaign targeting ${strategy.targetAudienceRefined}. ${strategy.estimatedResults}`,
        impact: strategy.estimatedResults,
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

/**
 * Campaign Manager — monitors all ACTIVE campaigns for a workspace
 */
export async function runCampaignMonitor(workspaceId: string): Promise<{
  campaignsChecked: number
  suggestionsCreated: number
  errors: string[]
}> {
  const errors: string[] = []
  let suggestionsCreated = 0

  const campaigns = await db.campaign.findMany({
    where: { workspaceId, status: { in: ['ACTIVE', 'DRAFT'] }, aiOutput: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  for (const campaign of campaigns) {
    try {
      const agentRun = await db.agentRun.create({
        data: { workspaceId, agent: 'CAMPAIGN_MANAGER', status: 'RUNNING', triggeredBy: 'cron' },
      })

      const metrics = buildMetricsFromCampaign(campaign)
      const analysis: CampaignManagerOutput = await runCampaignManagerAgent(metrics)

      if (analysis.healthScore < 75) {
        for (const suggestion of analysis.suggestions) {
          const existing = await db.agentSuggestion.findFirst({
            where: { workspaceId, campaignId: campaign.id, type: suggestion.type, status: 'PENDING' },
          })
          if (existing) continue

          await db.agentSuggestion.create({
            data: {
              workspaceId,
              agentRunId: agentRun.id,
              agent: 'CAMPAIGN_MANAGER',
              type: suggestion.type,
              status: 'PENDING',
              priority: suggestion.priority,
              title: suggestion.title,
              reasoning: suggestion.reasoning,
              impact: suggestion.impact,
              payload: suggestion.payload,
              campaignId: campaign.id,
              expiresAt: new Date(Date.now() + 3 * 86_400_000),
            },
          })
          suggestionsCreated++
        }
      }

      await db.agentRun.update({
        where: { id: agentRun.id },
        data: { status: 'COMPLETED', outputData: analysis, completedAt: new Date() },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`Campaign ${campaign.id}: ${message}`)
    }
  }

  return { campaignsChecked: campaigns.length, suggestionsCreated, errors }
}

/**
 * Reporting Agent — generates a report for a workspace
 */
export async function runReport(
  workspaceId: string,
  type: 'daily' | 'weekly' | 'monthly'
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { owner: { select: { company: true, email: true } } },
  })

  const campaigns = await db.campaign.findMany({
    where: { workspaceId, status: { in: ['ACTIVE', 'DRAFT'] } },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  })

  if (!campaigns.length) return

  const agentRun = await db.agentRun.create({
    data: { workspaceId, agent: 'REPORTING', status: 'RUNNING', triggeredBy: 'cron' },
  })

  try {
    const metrics = campaigns.map(buildMetricsFromCampaign)
    const periodLabel = getPeriodLabel(type)

    const reportInput: ReportingInput = {
      businessName: workspace?.owner?.company || 'Your Business',
      period: type,
      periodLabel,
      campaigns: metrics,
    }

    const reportOutput = await runReportingAgent(reportInput)

    const now = new Date()
    const periodStart = new Date()
    const periodEnd = new Date()

    if (type === 'daily') {
      periodStart.setHours(0, 0, 0, 0)
      periodEnd.setHours(23, 59, 59, 999)
    } else if (type === 'weekly') {
      periodStart.setDate(now.getDate() - 7)
    } else {
      periodStart.setDate(1)
      periodStart.setMonth(now.getMonth() - 1)
    }

    await db.agentReport.create({
      data: {
        workspaceId,
        agentRunId: agentRun.id,
        type: type.toUpperCase(),
        title: reportOutput.title,
        summary: reportOutput.summary,
        body: reportOutput,
        periodStart,
        periodEnd,
      },
    })

    await db.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await db.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    })
  }
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
