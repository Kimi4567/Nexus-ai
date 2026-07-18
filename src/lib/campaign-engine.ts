import { prisma } from '@/lib/prisma'
import * as ai from '@/lib/ai/adapter'
import { type CampaignContext } from '@/lib/agents/visual-director'
import { type SentinelReviewInput } from '@/lib/agents/sentinel-reviewer'
import { validateOutputObject, logQualityReport } from '@/lib/ai/outputValidator'
import { guardStrategyOutputContract } from '@/lib/ai/strategyOutputContractGuard'
import { guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import { assertCampaignStrategyContract } from '@/lib/campaignStrategyContract'
import {
  reviewBrandTruthConsistency,
  reviewStrategyGrounding,
} from '@/lib/ai/marketingQualityGate'

const db = prisma as any

export type EngineStepKey = 'strategy' | 'content' | 'creative' | 'sentinel' | 'calendar' | 'approval' | 'autopilot'
export type EngineStepStatus = 'pending' | 'running' | 'done' | 'blocked' | 'failed'

export interface EngineStep {
  key: EngineStepKey
  label: string
  status: EngineStepStatus
  message?: string
  completedAt?: string
}

export interface CampaignEngineState {
  version: 1
  status: 'idle' | 'running' | 'ready_for_approval' | 'ready_for_launch' | 'scheduled' | 'blocked' | 'failed'
  currentStep?: EngineStepKey
  steps: EngineStep[]
  score: number
  lastRunAt?: string
  lastCompletedAt?: string
  error?: string
  calendarCount?: number
  sentinelStatus?: 'passed' | 'needs_attention' | 'not_reviewed'
}

interface CalendarItem {
  id: string
  campaignId: string
  week: number
  date: string
  platform: string
  topic: string
  title?: string
  hook?: string
  caption?: string
  cta?: string
  visualNote?: string
  contentType?: string
  status: 'planned'
  source: 'campaign_ai_output'
}

const STEP_LABELS: Record<EngineStepKey, string> = {
  strategy: 'Strategy',
  content: 'Content',
  creative: 'Creative',
  sentinel: 'Sentinel',
  calendar: 'Calendar',
  approval: 'Approval',
  autopilot: 'Autopilot',
}

function getNextMonday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const daysUntilMonday = day === 1 ? 0 : ((8 - day) % 7 || 7)
  d.setDate(d.getDate() + daysUntilMonday)
  return d
}

function resolveDate(anchor: Date, weekIndex: number, dayStr: string | undefined): Date {
  const dayMap: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  }

  let dayOffset = 0
  if (dayStr) {
    const lc = dayStr.toLowerCase().replace(/^day\s*/, '').trim()
    if (lc in dayMap) dayOffset = dayMap[lc] === 0 ? 6 : dayMap[lc] - 1
    const n = parseInt(lc, 10)
    if (!Number.isNaN(n)) dayOffset = n - 1
  }

  const result = new Date(anchor)
  result.setDate(anchor.getDate() + weekIndex * 7 + dayOffset)
  return result
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function buildCalendarItems(campaignId: string, aiOutput: any): CalendarItem[] {
  const anchor = getNextMonday()
  const items: CalendarItem[] = []

  const weeklyExecutionPlan: any[] = aiOutput?.strategy?.weeklyExecutionPlan || []
  if (weeklyExecutionPlan.length > 0) {
    for (const wk of weeklyExecutionPlan) {
      const weekNum = parseInt(wk.week ?? '1', 10) || 1
      const deliverables: string[] = Array.isArray(wk.deliverables) ? wk.deliverables : []
      const platforms: string[] = Array.isArray(wk.platforms) ? wk.platforms : ['general']

      deliverables.forEach((deliverable, di) => {
        const date = new Date(anchor)
        date.setDate(anchor.getDate() + (weekNum - 1) * 7 + (di % 5))
        items.push({
          id: `${campaignId}_wex_w${weekNum}_${items.length}`,
          campaignId,
          week: weekNum,
          date: toDateString(date),
          platform: (platforms[di % platforms.length] || 'general').toUpperCase(),
          topic: deliverable,
          title: wk.theme,
          hook: wk.keyMessage,
          caption: wk.organicFocus,
          visualNote: wk.theme,
          contentType: wk.paidFocus ? 'paid' : 'organic',
          status: 'planned',
          source: 'campaign_ai_output',
        })
      })
    }
    return items
  }

  const calendarSource: any[] = (aiOutput?.contentCalendar || []).length > 0
    ? aiOutput.contentCalendar
    : aiOutput?.strategy?.contentCalendar || []

  if (calendarSource.length > 0) {
    for (const weekObj of calendarSource) {
      const weekNum = parseInt(weekObj.week ?? weekObj.weekNumber ?? '1', 10) || 1
      const posts: any[] = weekObj.posts || weekObj.content || []

      for (const post of posts) {
        const date = resolveDate(anchor, weekNum - 1, post.day ?? post.dayOfWeek ?? post.dayNumber)
        items.push({
          id: `${campaignId}_w${weekNum}_${items.length}`,
          campaignId,
          week: weekNum,
          date: toDateString(date),
          platform: post.platform || 'general',
          topic: post.topic || post.theme || post.title || 'Campaign Post',
          title: post.title || post.headline,
          hook: post.hook,
          caption: post.caption || post.content,
          cta: post.cta || post.callToAction,
          visualNote: post.visual || post.visualNote || post.visualDirection,
          contentType: post.type || post.contentType,
          status: 'planned',
          source: 'campaign_ai_output',
        })
      }
    }
    return items
  }

  const weeklyPlan: any[] = aiOutput?.strategy?.weeklyPlan || []
  if (weeklyPlan.length > 0) {
    for (const weekObj of weeklyPlan) {
      const weekNum = parseInt(weekObj.week ?? '1', 10) || 1
      const posts: any[] = weekObj.posts || weekObj.days || weekObj.content || []

      for (const post of posts) {
        const date = resolveDate(anchor, weekNum - 1, post.day ?? post.dayOfWeek)
        items.push({
          id: `${campaignId}_wp_w${weekNum}_${items.length}`,
          campaignId,
          week: weekNum,
          date: toDateString(date),
          platform: post.platform || 'general',
          topic: post.topic || post.theme || weekObj.theme || 'Campaign Post',
          title: post.title || post.headline,
          hook: post.hook,
          caption: post.caption || post.content,
          cta: post.cta || post.callToAction,
          visualNote: post.visual || post.visualNote,
          contentType: post.type || post.contentType,
          status: 'planned',
          source: 'campaign_ai_output',
        })
      }
    }
    return items
  }

  const pillars: any[] = aiOutput?.strategy?.contentPillars || []
  const hooks: string[] = aiOutput?.topHooks || aiOutput?.strategy?.topHooks || []
  const ctas: string[] = aiOutput?.ctaVariations || aiOutput?.strategy?.ctaVariations || []

  pillars.forEach((pillar, i) => {
    const date = resolveDate(anchor, Math.floor(i / 3), String((i % 3) + 1))
    items.push({
      id: `${campaignId}_pillar_${i}`,
      campaignId,
      week: Math.floor(i / 3) + 1,
      date: toDateString(date),
      platform: pillar.platform || 'general',
      topic: pillar.topic || pillar.pillar || pillar.title || 'Campaign Post',
      hook: hooks[i % Math.max(1, hooks.length)],
      cta: ctas[i % Math.max(1, ctas.length)],
      status: 'planned',
      source: 'campaign_ai_output',
    })
  })

  return items
}

function step(key: EngineStepKey, status: EngineStepStatus, message?: string): EngineStep {
  return {
    key,
    label: STEP_LABELS[key],
    status,
    message,
    completedAt: status === 'done' ? new Date().toISOString() : undefined,
  }
}

export function deriveCampaignEngineState(campaign: any): CampaignEngineState {
  const aiOutput = campaign?.aiOutput || {}
  const strategy = aiOutput.strategy || {}
  const sentinelReview = aiOutput.sentinelReview
  const qualityGatePassed = aiOutput.qualityGate?.schemaVersion === 1
    && aiOutput.qualityGate?.status === 'passed'
    && Array.isArray(aiOutput.qualityGate?.blockers)
    && aiOutput.qualityGate.blockers.length === 0
  const sentinelStatus = sentinelReview?.status || 'not_reviewed'
  const calendarCount = Array.isArray(aiOutput.calendarItems) ? aiOutput.calendarItems.length : 0

  const hasStrategy = !!strategy && Object.keys(strategy).length > 0
  const hasContent = Boolean(
    (aiOutput.topHooks || strategy.topHooks || []).length ||
    (aiOutput.contentCalendar || strategy.contentCalendar || []).length ||
    (strategy.weeklyExecutionPlan || []).length
  )
  const hasCreative = !!aiOutput.creativeBrief
  const isApproved = campaign?.status === 'ACTIVE' || campaign?.status === 'SCHEDULED' || campaign?.status === 'COMPLETED'
  const isScheduled = campaign?.autopilotEnabled || campaign?.status === 'SCHEDULED'

  const steps: EngineStep[] = [
    step('strategy', hasStrategy && qualityGatePassed ? 'done' : hasStrategy ? 'blocked' : 'pending'),
    step('content', hasContent && qualityGatePassed ? 'done' : hasStrategy && qualityGatePassed ? 'pending' : 'blocked'),
    step('creative', qualityGatePassed && hasCreative ? 'done' : qualityGatePassed && hasContent ? 'pending' : 'blocked'),
    step('sentinel', qualityGatePassed && sentinelStatus === 'passed' ? 'done' : sentinelStatus === 'needs_attention' ? 'blocked' : qualityGatePassed && hasCreative ? 'pending' : 'blocked'),
    step('calendar', qualityGatePassed && calendarCount > 0 ? 'done' : qualityGatePassed && sentinelStatus === 'passed' ? 'pending' : 'blocked'),
    step('approval', qualityGatePassed && isApproved ? 'done' : qualityGatePassed && sentinelStatus === 'passed' ? 'pending' : 'blocked'),
    step('autopilot', qualityGatePassed && isScheduled ? 'done' : qualityGatePassed && isApproved ? 'pending' : 'blocked'),
  ]
  const done = steps.filter(s => s.status === 'done').length
  const score = Math.round((done / steps.length) * 100)

  let status: CampaignEngineState['status'] = 'idle'
  if (!qualityGatePassed && hasStrategy) status = 'blocked'
  else if (isScheduled) status = 'scheduled'
  else if (isApproved) status = 'ready_for_launch'
  else if (sentinelStatus === 'passed' && calendarCount > 0) status = 'ready_for_approval'
  else if (sentinelStatus === 'needs_attention') status = 'blocked'

  return {
    version: 1,
    status,
    steps,
    score,
    calendarCount,
    sentinelStatus,
    lastRunAt: aiOutput.nexusEngine?.lastRunAt,
    lastCompletedAt: aiOutput.nexusEngine?.lastCompletedAt,
    error: aiOutput.nexusEngine?.error,
  }
}

function buildCreativeContext(campaign: any, brand: any, aiOutput: any): CampaignContext {
  const strategy = aiOutput.strategy || {}
  return {
    campaignName: campaign.name,
    campaignGoal: campaign.goal ?? undefined,
    audience: campaign.audience ?? undefined,
    tone: campaign.tone ?? undefined,
    language: aiOutput.language || 'ar',
    brand: brand ? {
      name: brand.brandName ?? undefined,
      businessType: brand.industry ?? undefined,
      visualStyle: brand.visualStyle ?? undefined,
      colorPalette: Array.isArray(brand.colorPalette) ? brand.colorPalette.join(', ') : undefined,
      uniqueValue: Array.isArray(brand.uniqueAdvantages) ? brand.uniqueAdvantages.slice(0, 3).join('; ') : undefined,
      writingStyle: brand.writingStyle ?? undefined,
      painPoints: Array.isArray(brand.audiencePainPoints) ? brand.audiencePainPoints.slice(0, 3).join('; ') : undefined,
      desires: Array.isArray(brand.audienceDesires) ? brand.audienceDesires.slice(0, 3).join('; ') : undefined,
    } : undefined,
    strategy: {
      positioning: strategy.positioning ?? undefined,
      keyMessage: strategy.keyMessage ?? undefined,
      contentPillars: Array.isArray(strategy.contentPillars) ? strategy.contentPillars : undefined,
      visualDirection: strategy.visualDirection ?? undefined,
      differentiation: strategy.differentiation ?? undefined,
      diagnosis: strategy.diagnosis ?? undefined,
    },
  }
}

function buildSentinelInput(campaign: any, brand: any, aiOutput: any): SentinelReviewInput {
  const strategy = aiOutput.strategy || {}
  const creativeBrief = aiOutput.creativeBrief || null
  return {
    campaignName: campaign.name,
    campaignGoal: campaign.goal ?? undefined,
    audience: campaign.audience ?? undefined,
    tone: campaign.tone ?? undefined,
    language: aiOutput.language || 'ar',
    brand: brand ? {
      name: brand.brandName ?? undefined,
      businessType: brand.industry ?? undefined,
      toneKeywords: Array.isArray(brand.toneKeywords) ? brand.toneKeywords : [],
      avoidKeywords: Array.isArray(brand.avoidKeywords) ? brand.avoidKeywords : [],
      writingStyle: brand.writingStyle ?? undefined,
      targetAudience: brand.targetAudience ?? undefined,
      pricePoint: brand.pricePoint ?? undefined,
    } : undefined,
    strategy: {
      positioning: strategy.positioning ?? undefined,
      keyMessage: strategy.keyMessage ?? undefined,
      differentiation: strategy.differentiation ?? undefined,
      riskNotes: Array.isArray(strategy.riskNotes) ? strategy.riskNotes : [],
      diagnosis: strategy.diagnosis ?? undefined,
      offerCTAStrategy: strategy.offerCTAStrategy ?? undefined,
      doNotDoYet: Array.isArray(strategy.doNotDoYet) ? strategy.doNotDoYet : [],
      readinessChecklist: Array.isArray(strategy.readinessChecklist) ? strategy.readinessChecklist : [],
      adSetupPlan: strategy.adSetupPlan ?? undefined,
      funnelStages: Array.isArray(strategy.funnelStages) ? strategy.funnelStages : [],
      contentAnglesDetailed: Array.isArray(strategy.contentAnglesDetailed) ? strategy.contentAnglesDetailed.slice(0, 5) : [],
    },
    content: {
      topHooks: aiOutput.topHooks || strategy.topHooks || [],
      ctaVariations: aiOutput.ctaVariations || strategy.ctaVariations || [],
      captionFormulas: aiOutput.captionFormulas || creativeBrief?.captionFormulas || [],
      scriptTemplate: aiOutput.scriptTemplate || '',
      contentAngles: strategy.contentAngles || [],
      adCopyVariants: creativeBrief?.adCopyVariants || [],
    },
    calendar: aiOutput.contentCalendar || strategy.contentCalendar || [],
    creativeBriefDirection: creativeBrief?.overallCreativeDirection || creativeBrief?.moodDescription || undefined,
  }
}

export async function runCampaignEngine(params: {
  userId: string
  campaignId: string
  language?: string
  force?: boolean
}): Promise<{ campaign: any; engine: CampaignEngineState; creditsRecommended: boolean }> {
  const campaign = await db.campaign.findFirst({
    where: { id: params.campaignId, workspace: { ownerId: params.userId } },
    include: {
      workspace: { include: { brandProfile: true } },
      project: { include: { media: true } },
    },
  })
  if (!campaign) throw new Error('Campaign not found')

  let aiOutput: Record<string, any> = {
    ...((campaign.aiOutput as Record<string, any>) || {}),
    language: params.language || (campaign.aiOutput as any)?.language || 'ar',
    nexusEngine: {
      ...((campaign.aiOutput as any)?.nexusEngine || {}),
      status: 'running',
      lastRunAt: new Date().toISOString(),
    },
    // Persist a "generating" flag immediately so the client can detect it on reload
    _generatingAt: new Date().toISOString(),
  }

  // Immediately persist the _generatingAt flag — so if the user navigates away
  // and comes back, the client can detect the ongoing generation and show the right UI
  await db.campaign.update({
    where: { id: campaign.id },
    data: { aiOutput },
  })

  const agentRun = await db.agentRun.create({
    data: {
      workspaceId: campaign.workspaceId,
      agent: 'STRATEGIST',
      status: 'RUNNING',
      triggeredBy: 'engine',
      inputData: { campaignId: campaign.id, force: params.force === true },
    },
  })

  try {
    const brand = campaign.workspace?.brandProfile
    const needsStrategy = params.force || !aiOutput.strategy
    const brandTruthReview = reviewBrandTruthConsistency(brand)
    if (brandTruthReview.status === 'blocked') {
      throw new Error(`BRAND_TRUTH_CONFLICT:${brandTruthReview.blockers.map(item => item.code).join(',')}`)
    }

    // ── STEP 1: Strategy + Concepts (parallel, ~5-8s total)
    // This is the only AI step in the engine to stay within Vercel Hobby 10s limit.
    // Creative Brief and Sentinel Review run via their own separate API routes.
    if (needsStrategy) {
      const campaignWithLang = { ...campaign, language: aiOutput.language }
      let [strategy, concepts] = await Promise.all([
        ai.generateMarketingStrategy(campaignWithLang, campaign.project),
        ai.generateAdConcepts(campaignWithLang, campaign.project),
      ])
      const proofContext = {
          verifiedProof: brand?.verifiedProof || [],
          allowedClaimText: [
            brand?.description,
            brand?.primaryOffer,
            ...(brand?.uniqueAdvantages || []),
            ...(brand?.verifiedProof || []),
          ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      }
      strategy = guardStrategyOutputContract(
        guardStrategyProof(strategy, proofContext),
        {
          allowedPlatforms: campaign.platforms || [],
          allowedCompetitors: brand?.competitors || [],
          language: aiOutput.language,
          strategyType: 'full',
          hasLeadHandling: Boolean(brand?.leadHandling),
          hasConversionDestination: Boolean(brand?.conversionDestination),
        },
      )
      concepts = guardStrategyProof(concepts, proofContext)
      assertCampaignStrategyContract(strategy, { language: aiOutput.language })
      const qualityGate = reviewStrategyGrounding({
        strategy,
        brand,
        allowedPlatforms: campaign.platforms || [],
        requireAllReviewedPlatforms: true,
        goal: campaign.goal,
      })
      if (qualityGate.status === 'blocked') {
        throw new Error(`MARKETING_QUALITY_GATE_BLOCKED:${qualityGate.blockers.map(item => item.code).join(',')}`)
      }

      const qualityReport = validateOutputObject(strategy, {
        brandName: brand?.brandName || campaign.name,
        minScore: 45,
      })
      logQualityReport('campaign-engine.strategy', qualityReport, `campaign=${campaign.id}`)

      aiOutput = {
        ...aiOutput,
        strategy,
        concepts,
        topHooks: strategy.topHooks || aiOutput.topHooks || [],
        ctaVariations: strategy.ctaVariations || aiOutput.ctaVariations || [],
        contentCalendar: strategy.contentCalendar || aiOutput.contentCalendar || [],
        generatedAt: new Date().toISOString(),
        generatedByEngine: true,
        qualityScore: qualityReport.score,
        qualityGate,
      }
    } else {
      // Revalidate legacy/existing output whenever the engine state is rebuilt.
      // A historical score never grants current approval or execution readiness.
      aiOutput = {
        ...aiOutput,
        qualityGate: reviewStrategyGrounding({
          strategy: aiOutput.strategy,
          brand,
          allowedPlatforms: campaign.platforms || [],
          requireAllReviewedPlatforms: true,
          goal: campaign.goal,
        }),
      }
    }

    // ── STEP 2: Build Calendar Items from strategy (pure JS, no AI call)
    const calendarItems = buildCalendarItems(campaign.id, aiOutput)
    if (calendarItems.length > 0 && (params.force || !aiOutput.calendarPushedAt || (aiOutput.calendarItems || []).length === 0)) {
      aiOutput = {
        ...aiOutput,
        calendarItems,
        calendarPushedAt: new Date().toISOString(),
      }
    }

    const projectedCampaign = {
      ...campaign,
      aiOutput,
    }
    const engine = {
      ...deriveCampaignEngineState(projectedCampaign),
      lastRunAt: aiOutput.nexusEngine.lastRunAt,
      lastCompletedAt: new Date().toISOString(),
    }
    aiOutput.nexusEngine = {
      ...engine,
      status: engine.status,
      lastRunAt: aiOutput.nexusEngine.lastRunAt,
      lastCompletedAt: engine.lastCompletedAt,
    }
    // Clear the _generatingAt flag — generation is done
    delete aiOutput._generatingAt

    // Persist the final result with retry — DB connections can time out after a
    // long GPT-4o call. 3 retries with 2 s back-off covers transient pool issues.
    let updatedCampaign: typeof campaign & { activities: any[] } = campaign as any
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        updatedCampaign = await db.campaign.update({
          where: { id: campaign.id },
          data: {
            aiOutput,
            activities: {
              create: {
                type: 'engine_run',
                description: `NEXUS Engine prepared campaign package (${engine.score}% ready)`,
                metadata: {
                  score: engine.score,
                  status: engine.status,
                  sentinelStatus: engine.sentinelStatus,
                  calendarCount: engine.calendarCount,
                },
              },
            },
          },
          include: { activities: { orderBy: { createdAt: 'desc' }, take: 20 } },
        })
        break // success — exit retry loop
      } catch (dbErr: any) {
        const isTimeout =
          dbErr?.message?.includes('timeout') ||
          dbErr?.message?.includes('57014') ||
          dbErr?.code === 'P2024'
        if (isTimeout && attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * attempt))
          continue
        }
        throw dbErr
      }
    }

    await db.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: 'COMPLETED',
        outputData: { campaignId: campaign.id, engine },
        completedAt: new Date(),
      },
    })

    if (brand) {
      await prisma.brandProfile.update({
        where: { workspaceId: campaign.workspaceId },
        data: {
          aiInsights: {
            ...(brand.aiInsights as any || {}),
            lastEngineRun: new Date().toISOString(),
            lastCampaignId: campaign.id,
            lastReadinessScore: engine.score,
            lastSentinelStatus: engine.sentinelStatus,
          },
        },
      }).catch(() => null)
    }

    return { campaign: updatedCampaign, engine, creditsRecommended: true }
  } catch (err: any) {
    const message = err?.message || 'NEXUS Engine failed'
    await db.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    }).catch(() => null)

    const failedOutput = {
      ...aiOutput,
      nexusEngine: {
        ...(aiOutput.nexusEngine || {}),
        status: 'failed',
        error: message,
      },
      // Clear the generating flag so the client doesn't show a stale "generating" UI
      _generatingAt: undefined,
    }
    await db.campaign.update({
      where: { id: campaign.id },
      data: { aiOutput: failedOutput },
    }).catch(() => null)

    throw err
  }
}
