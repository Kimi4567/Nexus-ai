/**
 * Agent Orchestrator
 *
 * Runs the production strategy workflow for a workspace.
 * Called by the strategy API and scheduled monitoring entrypoints.
 */

import { prisma } from '@/lib/prisma'
import { runStrategistAgent, BusinessBrief, StrategyOutput } from './strategist'
import type { ContentDirectorOutput } from './content-director'
import { saveCampaignMemory } from '@/lib/campaign-memory'
import { getStrategyCapabilities } from '@/lib/brandReadiness'
import { applyServerReadiness, collectMissingKeys } from '@/lib/strategyNormalize'
import { guardStrategyKpis } from '@/lib/ai/strategyKpiGuard'
import { buildProofPolicyPrompt, guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import { guardStrategyOutputContract, selectStrategyCampaignPlatforms } from '@/lib/ai/strategyOutputContractGuard'
import { assertCampaignStrategyContract } from '@/lib/campaignStrategyContract'
import {
  formatBrandBrainGenerationSafetyNote,
  getBrandBrainGenerationSafety,
} from '@/lib/brandBrainGenerationSafety'
import type { StrategyReadinessContext } from './strategist'
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

export interface RunFullAgencyOptions {
  /**
   * Called after the strategy has passed deterministic guards/contracts and
   * immediately before any campaign/suggestion rows are created. Expensive
   * routes can use this to charge only when there is a saveable strategy, so
   * upstream AI/provider timeouts never leave a user charged with no campaign.
   */
  beforePersistStrategy?: () => Promise<void>
}

/**
 * Full agency run — Strategist → Content Director → save to DB
 * Called when user submits the /start briefing form
 */
export async function runFullAgency(
  workspaceId: string,
  brief: BusinessBrief,
  options: RunFullAgencyOptions = {},
): Promise<OrchestratorResult> {
  const startedAt = Date.now()
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

    // 1. Brand context — inject Brand Brain fields after generation-safety screening.
    const brandProfile = await prisma.brandProfile.findUnique({ where: { workspaceId } })
    const brandSafety = getBrandBrainGenerationSafety(brandProfile as any)
    const safeBrandProfile = brandSafety.safeProfile as any
    const brandContext = brandProfile
      ? [
          `Brand: ${safeBrandProfile.brandName || 'Unknown'}`,
          safeBrandProfile.industry ? `Industry: ${safeBrandProfile.industry}` : '',
          safeBrandProfile.description ? `Business Description: ${safeBrandProfile.description}` : '',
          safeBrandProfile.primaryOffer ? `Core Offer: ${safeBrandProfile.primaryOffer}` : '',
          safeBrandProfile.pricePoint ? `Price Positioning: ${safeBrandProfile.pricePoint}` : '',
          safeBrandProfile.uniqueAdvantages?.length ? `Unique Advantages: ${safeBrandProfile.uniqueAdvantages.join(', ')}` : '',
          safeBrandProfile.targetAudience ? `Target Audience: ${safeBrandProfile.targetAudience}` : '',
          safeBrandProfile.audienceAge ? `Audience Age Range: ${safeBrandProfile.audienceAge}` : '',
          safeBrandProfile.audienceLocation ? `Market / Region: ${safeBrandProfile.audienceLocation}` : '',
          safeBrandProfile.audiencePainPoints?.length ? `Audience Pain Points: ${safeBrandProfile.audiencePainPoints.join(', ')}` : '',
          safeBrandProfile.audienceDesires?.length ? `Audience Desires: ${safeBrandProfile.audienceDesires.join(', ')}` : '',
          safeBrandProfile.toneKeywords?.length ? `Brand Tone: ${safeBrandProfile.toneKeywords.join(', ')}` : '',
          safeBrandProfile.writingStyle ? `Writing Style: ${safeBrandProfile.writingStyle}` : '',
          safeBrandProfile.avoidKeywords?.length ? `Never use these words: ${safeBrandProfile.avoidKeywords.join(', ')}` : '',
          safeBrandProfile.topPlatforms?.length ? `Best Platforms: ${safeBrandProfile.topPlatforms.join(', ')}` : '',
          safeBrandProfile.winningHooks?.length ? `Reviewed Hook Signals (use as style reference): ${safeBrandProfile.winningHooks.slice(0, 3).join(' | ')}` : '',
          safeBrandProfile.winningAngles?.length ? `Content Angle Signals: ${safeBrandProfile.winningAngles.slice(0, 3).join(', ')}` : '',
          buildProofPolicyPrompt({ verifiedProof: safeBrandProfile.verifiedProof }),
          safeBrandProfile.competitorNotes ? `Competitor Notes: ${safeBrandProfile.competitorNotes}` : '',
          safeBrandProfile.competitors?.length ? `Named Competitors (use ONLY these — never invent others): ${safeBrandProfile.competitors.join(', ')}` : '',
          safeBrandProfile.strategicNotes ? `Strategic Notes: ${safeBrandProfile.strategicNotes}` : '',
          formatBrandBrainGenerationSafetyNote(brandSafety),
          // PR-2B1 — wire the PR-2A strategy-data fields into the strategist context.
          safeBrandProfile.businessGoal ? `Business Goal: ${safeBrandProfile.businessGoal}` : '',
          safeBrandProfile.marketingBudget ? `Marketing Budget (band): ${safeBrandProfile.marketingBudget}` : '',
          safeBrandProfile.conversionDestination ? `Conversion Destination: ${safeBrandProfile.conversionDestination}` : '',
          safeBrandProfile.leadHandling ? `Lead Handling / Sales Process: ${safeBrandProfile.leadHandling}` : '',
          safeBrandProfile.customerObjections?.length ? `Customer Objections: ${safeBrandProfile.customerObjections.join(', ')}` : '',
          safeBrandProfile.complianceNotes ? `Compliance Notes: ${safeBrandProfile.complianceNotes}` : '',
          safeBrandProfile.averageOrderValue ? `Average Order Value: ${safeBrandProfile.averageOrderValue}` : '',
          safeBrandProfile.grossMargin ? `Gross Margin: ${safeBrandProfile.grossMargin}` : '',
          safeBrandProfile.customerLifetimeValue ? `Customer Lifetime Value: ${safeBrandProfile.customerLifetimeValue}` : '',
          safeBrandProfile.salesCycleLength ? `Sales Cycle Length: ${safeBrandProfile.salesCycleLength}` : '',
          safeBrandProfile.seasonality ? `Seasonality: ${safeBrandProfile.seasonality}` : '',
          safeBrandProfile.pastAdResults ? `Past Ad Results (historical data): ${safeBrandProfile.pastAdResults}` : '',
        ].filter(Boolean).join('\n')
      : ''

    // 1b. PR-2B1 — compute capability readiness server-side (single source of truth)
    //     and build the compact readiness context passed into the strategist.
    const bp: any = brandProfile ? safeBrandProfile : {}
    const capabilities = getStrategyCapabilities(bp, { hasPixel: false })
    const hasHistoricalData = Boolean(bp.pastAdResults)
    const readiness: StrategyReadinessContext = {
      capabilities: Object.values(capabilities).map(c => ({
        id: c.id, ready: c.ready, confidence: c.confidence, missingKeys: c.missingKeys,
      })),
      missingKeys: collectMissingKeys(capabilities),
      hasBudget: Boolean(bp.marketingBudget),
      budgetText: typeof bp.marketingBudget === 'string' ? bp.marketingBudget : null,
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
      allowedClaimText: [
        bp.description,
        bp.primaryOffer,
        bp.pricePoint,
        bp.languagePreference,
        ...((bp.uniqueAdvantages as string[] | undefined) || []),
        bp.complianceNotes,
        ...((bp.verifiedProof as string[] | undefined) || []),
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    }

    // 2. Strategist agent
    let strategy: StrategyOutput = await runStrategistAgent(brief, brandContext, brief.language, readiness)
    // 2b. PR-2B1 — server-authoritative readiness + anti-hallucination scrubbing.
    //     The model's confidenceReport/missingData/competitorAnalysisComplete are
    //     DISCARDED and replaced from getStrategyCapabilities() here.
    strategy = applyServerReadiness(strategy, capabilities, {
      hasHistoricalData, allowedCompetitors, allowedNumbers, strategyType: brief.strategyType, language: brief.language,
    })
    // 2c. PR-I — KPI Truth Guard. applyServerReadiness flags KPIs as hypotheses but
    //     does NOT scrub the KPI/metric `target` strings, so invented figures like
    //     "Increase by 20%" leaked through. This strips unsupported performance
    //     numbers from KPI targets / success metrics / estimated results, keeping
    //     only user/analytics-provided numbers (allowedNumbers) and calendar timeframes.
    strategy = guardStrategyKpis(
      strategy as unknown as Record<string, unknown>,
      allowedNumbers,
      { language: brief.language },
    ) as unknown as StrategyOutput
    // GEN-TRUTH1 — deterministic proof guard. Prompt policy prevents most issues;
    // this backstop keeps unsupported testimonials/customer stories/awards from
    // being persisted when Brand Brain has no verified proof.
    strategy = guardStrategyProof(strategy, proofContext)
    // STRATEGY-OUTPUT-CONTRACT1 — keep persisted strategy output inside the
    // user-reviewed strategy contract: selected platforms only, no unverified
    // readiness "done" states, and no invented platform execution paths.
    strategy = guardStrategyOutputContract(strategy, {
      allowedPlatforms: Array.isArray(brief.currentPlatforms) ? brief.currentPlatforms : [],
      language: brief.language,
      strategyType: brief.strategyType,
      organicPostCount: brief.organicPostCount,
      hasLeadHandling: Boolean(bp.leadHandling),
      hasConversionDestination: Boolean(bp.conversionDestination),
      allowedCompetitors,
    })
    const contractReport = assertCampaignStrategyContract(strategy, {
      language: brief.language,
      expectedOrganicPostCount: brief.organicPostCount,
    })
    console.log(
      `[Orchestrator] Strategy OS contract passed score=${contractReport.score} workspace=${workspaceId}`,
    )

    if (options.beforePersistStrategy) {
      await options.beforePersistStrategy()
    }

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

    // 4–5. Create project and campaign under the same commercial lock used by
    // the other campaign creation paths. Concurrent requests cannot exceed the
    // workspace owner's monthly allowance.
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

    const rawPlatforms = selectStrategyCampaignPlatforms(
      strategy as unknown as { channelMix?: unknown },
      Array.isArray(brief.currentPlatforms) ? brief.currentPlatforms : [],
    )

    console.log('[Orchestrator] Creating campaign:', {
      name: campaignName,
      goal: strategy.goal,
      platforms: rawPlatforms,
      hasAudience: !!campaignAudience,
    })
    // ─────────────────────────────────────────────────────────────────────────

    const campaign = await prisma.$transaction(async (tx) => {
      const workspaceRecord = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
      })
      if (!workspaceRecord) throw new Error('Workspace not found')

      const allowance = await readLockedCampaignAllowance(tx, workspaceRecord.ownerId)
      if (allowance.limit !== 999 && allowance.current >= allowance.limit) {
        throw new Error(`CAMPAIGN_LIMIT_REACHED:${allowance.limit}:${allowance.periodEnd.toISOString()}`)
      }

      let project = await tx.project.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      })
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
            strategyType: brief.strategyType || 'organic',
            strategyDuration: brief.strategyDuration || '90',
            strategyOrder: (brief as any).strategyOrder || null,
            strategyDeliverables: (brief as any).strategyDeliverables || null,
            organicPostCount: typeof (brief as any).organicPostCount === 'number' ? (brief as any).organicPostCount : null,
            detailedCalendarDays: typeof (brief as any).detailedCalendarDays === 'number' ? (brief as any).detailedCalendarDays : null,
            language: brief.language || 'ar',
            selectedMediaIds: Array.isArray((brief as any).selectedMediaIds) ? (brief as any).selectedMediaIds : [],
            generatedAt: new Date().toISOString(),
            generatedByAgents: true,
          } as any,
        },
      })
    })
    strategyCreated = true

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
        durationMs: Date.now() - startedAt,
      },
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Log full error stack so Vercel logs show the real failure point
    console.error('[Orchestrator] runFullAgency FAILED:', message, err)
    errors.push(message)
    await db.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'FAILED', error: message, completedAt: new Date(), durationMs: Date.now() - startedAt },
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
    'youtube shorts': 'YOUTUBE_SHORTS', youtube_shorts: 'YOUTUBE_SHORTS',
    snapchat: 'SNAPCHAT', website: 'WEBSITE', pinterest: 'PINTEREST',
  }
  const valid = ['TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE_SHORTS', 'SNAPCHAT', 'LINKEDIN', 'TWITTER', 'WEBSITE', 'PINTEREST']
  return platforms
    .map(p => map[p.toLowerCase()] || p.toUpperCase())
    .filter(p => valid.includes(p))
    .slice(0, 3)
}
