/**
 * Agent Orchestrator
 *
 * Coordinates all 4 agents for a workspace.
 * Called by /api/agents/run and the cron jobs.
 */

import { prisma } from '@/lib/prisma'
import { runStrategistAgent, BusinessBrief, StrategyOutput } from './strategist'
import { runContentDirectorAgent, ContentDirectorInput } from './content-director'
import {
  runCampaignManagerAgent,
  buildMetricsFromCampaign,
  CampaignManagerOutput,
} from './campaign-manager'
import { runReportingAgent, getPeriodLabel, ReportingInput } from './reporting'

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

  const agentRun = await db.agentRun.create({
    data: {
      workspaceId,
      agent: 'STRATEGIST',
      status: 'RUNNING',
      triggeredBy: 'user',
      inputData: brief,
    },
  })

  try {
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
          brandProfile.competitorNotes ? `Key Competitors: ${brandProfile.competitorNotes}` : '',
          brandProfile.strategicNotes ? `Strategic Notes: ${brandProfile.strategicNotes}` : '',
        ].filter(Boolean).join('\n')
      : ''

    // 2. Strategist agent
    const strategy: StrategyOutput = await runStrategistAgent(brief, brandContext, brief.language)
    strategyCreated = true

    // 3. Content Director agent — pass full brand context
    const contentInput: ContentDirectorInput = {
      strategy,
      brandName: brandProfile?.brandName || brief.companyName,
      brandTone: brandProfile?.toneKeywords.length ? brandProfile.toneKeywords : ['modern', 'professional'],
      avoidKeywords: brandProfile?.avoidKeywords || [],
      writingStyle: brandProfile?.writingStyle || 'direct and engaging',
      competitors: brandProfile?.competitorNotes || undefined,
      region: brandProfile?.audienceLocation || undefined,
      painPoints: brandProfile?.audiencePainPoints?.length ? brandProfile.audiencePainPoints : undefined,
      winningHooks: brandProfile?.winningHooks?.length ? brandProfile.winningHooks.slice(0, 3) : undefined,
      language: brief.language,
    }
    const content = await runContentDirectorAgent(contentInput)
    contentCreated = true

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
    const campaign = await db.campaign.create({
      data: {
        workspaceId,
        projectId: project.id,
        name: strategy.campaignName || `${brief.companyName} — ${strategy.goal}`,
        description: strategy.positioning,
        goal: mapGoal(strategy.goal),
        audience: strategy.targetAudienceRefined,
        tone: 'MODERN',
        platforms: mapPlatforms(strategy.channelMix.map((c: { platform: string }) => c.platform)),
        status: 'DRAFT',
        aiOutput: {
          strategy,
          contentCalendar: content.calendar,
          topHooks: content.topHooks?.length ? content.topHooks : strategy.topHooks || [],
          ctaVariations: content.ctaVariations?.length ? content.ctaVariations : strategy.ctaVariations || [],
          captionFormulas: content.captionFormulas || [],
          scriptTemplate: content.scriptTemplate || '',
          contentPillars: content.contentPillars?.length ? content.contentPillars : strategy.contentPillars || [],
          generatedAt: new Date().toISOString(),
          generatedByAgents: true,
        },
      },
    })

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
    errors.push(message)
    await db.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    })
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
