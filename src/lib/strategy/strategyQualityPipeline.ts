/**
 * Production Strategy OS quality pipeline.
 *
 * This module is deliberately pure: it prepares the same grounded context used
 * by the strategist and applies the same deterministic truth/quality gates used
 * before persistence. Keeping the pipeline outside the database orchestrator
 * lets live evaluations exercise production behavior without creating campaigns,
 * consuming product credits, or depending on a workspace.
 */

import type { StrategyCapabilities } from '@/lib/brandReadiness'
import { getStrategyCapabilities } from '@/lib/brandReadiness'
import {
  formatBrandBrainGenerationSafetyNote,
  getBrandBrainGenerationSafety,
} from '@/lib/brandBrainGenerationSafety'
import type {
  BusinessBrief,
  StrategyOutput,
  StrategyReadinessContext,
} from '@/lib/agents/strategist'
import { applyServerReadiness, collectMissingKeys } from '@/lib/strategyNormalize'
import { guardStrategyKpis } from '@/lib/ai/strategyKpiGuard'
import { buildProofPolicyPrompt } from '@/lib/ai/strategyProofGuard'
import { guardStrategyTruthContract } from '@/lib/ai/strategyTruthContractGuard'
import {
  reviewBrandTruthConsistency,
  reviewStrategyGrounding,
  type MarketingBrandProfile,
  type MarketingQualityGateReport,
} from '@/lib/ai/marketingQualityGate'
import {
  validateCampaignStrategyContract,
  type CampaignStrategyContractReport,
} from '@/lib/campaignStrategyContract'
import {
  buildStrategyEvidenceLedger,
} from '@/lib/strategy/strategyEvidenceLedger'
import { hasUsableConversionDestination } from '@/lib/strategyBriefReadiness'
import { buildStrategyProofContextFromBrand } from '@/lib/strategy/strategyProofContext'

export type StrategyBrandProfile = MarketingBrandProfile & Record<string, unknown>

export interface StrategyProofContext {
  verifiedProof: string[]
  budgetText: string | null
  allowedClaimText: string[]
  commercialClaimText: string[]
}

export interface StrategyGenerationContext {
  safeBrandProfile: StrategyBrandProfile
  brandContext: string
  capabilities: StrategyCapabilities
  readiness: StrategyReadinessContext
  hasHistoricalData: boolean
  allowedNumbers: string[]
  allowedCompetitors: string[]
  proofContext: StrategyProofContext
  recordedProof: string[]
}

export interface FinalizedStrategyQuality {
  strategy: StrategyOutput
  contractReport: CampaignStrategyContractReport
  qualityGate: MarketingQualityGateReport
}

export interface StrategyQualityFailureDiagnostics {
  stage: 'strategy_contract' | 'marketing_quality'
  mode: BusinessBrief['strategyType']
  issueCodes: string[]
  affectedPaths: string[]
  outputCounts: {
    contentDirections: number
    weeklyDeliverables: number
    audienceHypotheses: number
    adAngles: number
    adCopies: number
    creativeBriefs: number
  }
  contractReport?: CampaignStrategyContractReport
  qualityGate?: MarketingQualityGateReport
}

export class StrategyQualityFailure extends Error {
  readonly diagnostics: StrategyQualityFailureDiagnostics

  constructor(message: string, diagnostics: StrategyQualityFailureDiagnostics) {
    super(message)
    this.name = 'StrategyQualityFailure'
    this.diagnostics = diagnostics
  }
}

function countWeeklyDeliverables(strategy: StrategyOutput): number {
  if (!Array.isArray(strategy.weeklyExecutionPlan)) return 0
  return strategy.weeklyExecutionPlan.reduce((total, week) => (
    total + (Array.isArray(week?.deliverables) ? week.deliverables.length : 0)
  ), 0)
}

function strategyOutputCounts(strategy: StrategyOutput): StrategyQualityFailureDiagnostics['outputCounts'] {
  const paid = strategy.paidPlanning
  return {
    contentDirections: Array.isArray(strategy.contentAnglesDetailed) ? strategy.contentAnglesDetailed.length : 0,
    weeklyDeliverables: countWeeklyDeliverables(strategy),
    audienceHypotheses: Array.isArray(paid?.audienceHypotheses) ? paid.audienceHypotheses.length : 0,
    adAngles: Array.isArray(paid?.adAngles) ? paid.adAngles.length : 0,
    adCopies: Array.isArray(paid?.adCopyVariations) ? paid.adCopyVariations.length : 0,
    creativeBriefs: Array.isArray(paid?.creativeBriefs) ? paid.creativeBriefs.length : 0,
  }
}

function strategyContractFailureMessage(report: CampaignStrategyContractReport): string {
  const details = [
    report.legacySchemaDetected ? 'legacy engine schema detected' : '',
    report.missingFields.length ? `missing: ${report.missingFields.join(', ')}` : '',
    report.weakFields.length ? `weak: ${report.weakFields.join(', ')}` : '',
    report.languageViolations.length ? `language: ${report.languageViolations.slice(0, 8).join(', ')}` : '',
    report.countViolations.length ? `count: ${report.countViolations.join(', ')}` : '',
  ].filter(Boolean).join('; ')
  return `Campaign engine strategy failed Strategy OS contract (${details || 'unknown reason'})`
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * Screen Brand Brain input and prepare the exact grounded context passed to the
 * strategist. Throws before any provider call when the saved brand facts
 * contradict one another.
 */
export function prepareStrategyGenerationContext(
  brandProfile: StrategyBrandProfile | null | undefined,
): StrategyGenerationContext {
  const brandSafety = getBrandBrainGenerationSafety(brandProfile as any)
  const safeBrandProfile = brandSafety.safeProfile as StrategyBrandProfile
  const brandTruthReview = reviewBrandTruthConsistency(safeBrandProfile)

  if (brandTruthReview.status === 'blocked') {
    throw new Error(
      `BRAND_TRUTH_CONFLICT:${brandTruthReview.blockers.map(item => item.code).join(',')}`,
    )
  }

  const bp = brandProfile ? safeBrandProfile : ({} as StrategyBrandProfile)
  const values = bp as Record<string, unknown>
  const competitors = stringArray(values.competitors)
  const { recordedProof, proofContext } = buildStrategyProofContextFromBrand(values)
  const verifiedProof = proofContext.verifiedProof
  const uniqueAdvantages = stringArray(values.uniqueAdvantages)
  const audiencePainPoints = stringArray(values.audiencePainPoints)
  const audienceDesires = stringArray(values.audienceDesires)
  const toneKeywords = stringArray(values.toneKeywords)
  const avoidKeywords = stringArray(values.avoidKeywords)
  const topPlatforms = stringArray(values.topPlatforms)
  const winningHooks = stringArray(values.winningHooks)
  const winningAngles = stringArray(values.winningAngles)
  const customerObjections = stringArray(values.customerObjections)

  const brandContext = brandProfile
    ? [
        `Brand: ${optionalString(values.brandName) || 'Unknown'}`,
        optionalString(values.industry) ? `Industry: ${values.industry}` : '',
        optionalString(values.description) ? `Business Description: ${values.description}` : '',
        optionalString(values.primaryOffer) ? `Core Offer: ${values.primaryOffer}` : '',
        optionalString(values.pricePoint) ? `Price Positioning: ${values.pricePoint}` : '',
        uniqueAdvantages.length ? `Unique Advantages: ${uniqueAdvantages.join(', ')}` : '',
        optionalString(values.targetAudience) ? `Target Audience: ${values.targetAudience}` : '',
        optionalString(values.audienceAge) ? `Audience Age Range: ${values.audienceAge}` : '',
        optionalString(values.audienceLocation) ? `Market / Region: ${values.audienceLocation}` : '',
        audiencePainPoints.length ? `Audience Pain Points: ${audiencePainPoints.join(', ')}` : '',
        audienceDesires.length ? `Audience Desires: ${audienceDesires.join(', ')}` : '',
        toneKeywords.length ? `Brand Tone: ${toneKeywords.join(', ')}` : '',
        optionalString(values.writingStyle) ? `Writing Style: ${values.writingStyle}` : '',
        avoidKeywords.length ? `Never use these words: ${avoidKeywords.join(', ')}` : '',
        topPlatforms.length ? `Best Platforms: ${topPlatforms.join(', ')}` : '',
        winningHooks.length ? `Reviewed Hook Signals (use as style reference): ${winningHooks.slice(0, 3).join(' | ')}` : '',
        winningAngles.length ? `Content Angle Signals: ${winningAngles.slice(0, 3).join(', ')}` : '',
        buildProofPolicyPrompt({ verifiedProof }),
        optionalString(values.competitorNotes) ? `Competitor Notes: ${values.competitorNotes}` : '',
        competitors.length ? `Named Competitors (use ONLY these — never invent others): ${competitors.join(', ')}` : '',
        optionalString(values.strategicNotes) ? `Strategic Notes: ${values.strategicNotes}` : '',
        formatBrandBrainGenerationSafetyNote(brandSafety),
        optionalString(values.businessGoal) ? `Business Goal: ${values.businessGoal}` : '',
        optionalString(values.marketingBudget) ? `Marketing Budget (band): ${values.marketingBudget}` : '',
        optionalString(values.conversionDestination) ? `Conversion Destination: ${values.conversionDestination}` : '',
        optionalString(values.leadHandling) ? `Lead Handling / Sales Process: ${values.leadHandling}` : '',
        customerObjections.length ? `Customer Objections: ${customerObjections.join(', ')}` : '',
        optionalString(values.complianceNotes) ? `Compliance Notes: ${values.complianceNotes}` : '',
        optionalString(values.averageOrderValue) ? `Average Order Value: ${values.averageOrderValue}` : '',
        optionalString(values.grossMargin) ? `Gross Margin: ${values.grossMargin}` : '',
        optionalString(values.customerLifetimeValue) ? `Customer Lifetime Value: ${values.customerLifetimeValue}` : '',
        optionalString(values.salesCycleLength) ? `Sales Cycle Length: ${values.salesCycleLength}` : '',
        optionalString(values.seasonality) ? `Seasonality: ${values.seasonality}` : '',
        optionalString(values.pastAdResults) ? `Past Ad Results (historical data): ${values.pastAdResults}` : '',
      ].filter(Boolean).join('\n')
    : ''

  const capabilities = getStrategyCapabilities(bp as any, { hasPixel: false })
  const hasHistoricalData = Boolean(optionalString(values.pastAdResults))
  const marketingBudget = optionalString(values.marketingBudget)
  const readiness: StrategyReadinessContext = {
    capabilities: Object.values(capabilities).map(capability => ({
      id: capability.id,
      ready: capability.ready,
      confidence: capability.confidence,
      missingKeys: capability.missingKeys,
    })),
    missingKeys: collectMissingKeys(capabilities),
    hasBudget: Boolean(marketingBudget),
    budgetText: marketingBudget,
    hasConversionDestination: hasUsableConversionDestination(values.conversionDestination, values.campaignObjective as string | null),
    hasCompetitors: competitors.length > 0 || Boolean(optionalString(values.competitorNotes)),
    hasHistoricalData,
    hasPixel: false,
  }
  const allowedNumbers = [
    values.marketingBudget,
    values.pricePoint,
    values.averageOrderValue,
    values.customerLifetimeValue,
    values.grossMargin,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const allowedCompetitors = [
    ...competitors,
    ...(optionalString(values.competitorNotes) ? [String(values.competitorNotes)] : []),
  ]
  return {
    safeBrandProfile,
    brandContext,
    capabilities,
    readiness,
    hasHistoricalData,
    allowedNumbers,
    allowedCompetitors,
    proofContext,
    recordedProof,
  }
}

/**
 * Apply every deterministic guard and contract required before persistence.
 * This is the authoritative saveability check for production and live evals.
 */
export function finalizeStrategyQuality(
  generatedStrategy: StrategyOutput,
  brief: BusinessBrief,
  context: StrategyGenerationContext,
): FinalizedStrategyQuality {
  let strategy = applyServerReadiness(generatedStrategy, context.capabilities, {
    hasHistoricalData: context.hasHistoricalData,
    allowedCompetitors: context.allowedCompetitors,
    allowedNumbers: context.allowedNumbers,
    strategyType: brief.strategyType,
    language: brief.language,
  })

  strategy = guardStrategyKpis(
    strategy as unknown as Record<string, unknown>,
    context.allowedNumbers,
    { language: brief.language },
  ) as unknown as StrategyOutput
  strategy = guardStrategyTruthContract(strategy, context.proofContext, {
    allowedPlatforms: Array.isArray(brief.currentPlatforms) ? brief.currentPlatforms : [],
    language: brief.language,
    strategyType: brief.strategyType,
    organicPostCount: brief.organicPostCount,
    hasLeadHandling: Boolean((context.safeBrandProfile as Record<string, unknown>).leadHandling),
    hasBudget: context.readiness.hasBudget,
    budgetText: context.proofContext.budgetText,
    hasConversionDestination: hasUsableConversionDestination(
      (context.safeBrandProfile as Record<string, unknown>).conversionDestination,
      brief.primaryGoal,
    ),
    allowedCompetitors: context.allowedCompetitors,
    goal: brief.primaryGoal,
  })
  strategy.evidenceLedger = buildStrategyEvidenceLedger(context.recordedProof)

  const contractReport = validateCampaignStrategyContract(strategy, {
    language: brief.language,
    expectedOrganicPostCount: brief.organicPostCount,
    strategyType: brief.strategyType,
    expectedPaidPlanning: brief.strategyDeliverables,
  })
  if (!contractReport.valid) {
    throw new StrategyQualityFailure(strategyContractFailureMessage(contractReport), {
      stage: 'strategy_contract',
      mode: brief.strategyType,
      issueCodes: [
        ...contractReport.missingFields.map(path => `missing:${path}`),
        ...contractReport.weakFields.map(path => `weak:${path}`),
        ...contractReport.languageViolations.map(path => `language:${path}`),
        ...contractReport.countViolations.map(path => `count:${path}`),
      ],
      affectedPaths: [
        ...contractReport.missingFields,
        ...contractReport.weakFields,
        ...contractReport.languageViolations,
        ...contractReport.countViolations,
      ],
      outputCounts: strategyOutputCounts(strategy),
      contractReport,
    })
  }
  const qualityGate = reviewStrategyGrounding({
    strategy,
    brand: context.safeBrandProfile,
    allowedPlatforms: Array.isArray(brief.currentPlatforms) ? brief.currentPlatforms : [],
    requireAllReviewedPlatforms: true,
    goal: brief.primaryGoal,
  })

  if (qualityGate.status === 'blocked') {
    throw new StrategyQualityFailure(
      `MARKETING_QUALITY_GATE_BLOCKED:${qualityGate.blockers.map(item => `${item.code}@${item.path}`).join(',')}`,
      {
        stage: 'marketing_quality',
        mode: brief.strategyType,
        issueCodes: qualityGate.blockers.map(item => item.code),
        affectedPaths: qualityGate.blockers.map(item => item.path),
        outputCounts: strategyOutputCounts(strategy),
        qualityGate,
      },
    )
  }

  return { strategy, contractReport, qualityGate }
}
