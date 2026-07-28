/**
 * AGENT 1 — Marketing Strategist (Sprint M — Operational Strategy Upgrade)
 *
 * Responsibilities:
 * - Diagnose the real marketing situation (stage, gaps, risks)
 * - Define a clear business and marketing objective
 * - Build specific, operational audience segments
 * - Map the full funnel with execution-ready stages
 * - Generate structured content angles (not generic advice)
 * - Produce a VEX-ready ad setup plan
 * - Output a 4-week execution calendar
 * - Define asset requirements and a readiness checklist
 *
 * Output is both human-readable AND machine-usable by:
 * Content Pack, Calendar, Creative Brief, VEX, Sentinel, Approval Checklist.
 */

import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { checkAndLog } from '@/lib/outputGuardrails'
import { getPlanContext } from './planContext'
import { normalizeStrategyOutput } from '@/lib/strategyNormalize'
import { validateCampaignStrategyContract } from '@/lib/campaignStrategyContract'
import {
  readOpenAIChatUsage,
  summarizeOpenAITextUsage,
  type OpenAITextUsage,
  type ProviderUsageSummary,
} from '@/lib/ai/providerEconomics'
import { recordOpenAIProviderUsage } from '@/lib/ai/providerUsageContext'
// PR-S1c-3 — deterministic Strategy Order + Deliverables Contract types (display/scope only).
import type { StrategyOrder, StrategyDeliverables } from '@/lib/strategy/strategyOrder'

// ── Preserved interfaces (backwards compat) ──────────────────────────────────

export interface BusinessBrief {
  companyName: string
  businessType: string
  targetAudience: string
  monthlyBudget: number
  currentPlatforms?: string[]
  primaryGoal?: string
  existingProblems?: string
  // Extended Brand Brain fields
  competitors?: string
  region?: string
  uniqueValue?: string
  avoidWords?: string
  pricePoint?: string
  writingStyle?: string
  painPoints?: string
  desires?: string
  primaryOffer?: string
  winningHooks?: string
  // Language preference: 'ar' | 'en' | 'bilingual'
  language?: string
  // Campaign memory: past learnings injected from campaign-memory.ts
  pastLearnings?: string
  // Subscription tier — controls strategy depth, calendar length, content volume
  planTier?: string
  // Media library context: describes existing assets the user has uploaded
  mediaContext?: string
  // PR-I — generation-time strategy intent (chosen in RunFullStrategyModal, not persisted).
  strategyType?: 'organic' | 'paid' | 'full'   // default 'organic'
  strategyDuration?: '30' | '90' | '180' | 'custom'  // default '90' (first 30 days actionable)

  // ── PR-S1c-3 — deterministic generation contract (the order the user reviewed & paid for).
  //    All optional + additive (back-compat). Computed server-side in /api/strategy/run-full
  //    from getStrategyDeliverables(order, planContext); the AI never decides these. When
  //    `generationInstructions` is present, the strategist treats it as a BINDING scope.
  strategyOrder?: StrategyOrder
  strategyDeliverables?: StrategyDeliverables
  /** Single source-of-truth scope string from the deliverables contract. */
  generationInstructions?: string
  /** Fixed organic post count for the detailed window (intensity → request → plan cap). */
  organicPostCount?: number
  /** Days that get a detailed day-by-day calendar (always ≤ 30). */
  detailedCalendarDays?: number
  /** Planning-horizon roadmap length in months (1 / 2 / 3 / 6). */
  roadmapMonths?: number
  /** True when the requested intensity exceeded the plan quota and was capped. */
  planCapApplied?: boolean
}

export interface FunnelStrategy {
  awareness: string
  consideration: string
  conversion: string
  retention: string
}

export interface ChannelStrategy {
  platform: string
  role: string
  contentType: string
  postingApproach: string
  cta: string
  rationale: string
}

export interface WeeklyPlan {
  week: number
  objective: string
  channels: string[]
  contentThemes: string[]
  keyMessage: string
  deliverables: string[]
  cta: string
}

export interface OfferCTAStrategy {
  primaryCTA: string
  secondaryCTA: string
  leadMagnet?: string
  betaOffer?: string
  contactFlow?: string
}

export interface ChannelAllocation {
  platform: string
  /**
   * Organic strategy should describe effort/rhythm, not spend.
   * Legacy saved strategies may still contain budgetPercent; the output guard
   * strips it for organic-only runs before persistence.
   */
  effortSharePercent?: number
  budgetPercent?: number
  rationale: string
  contentFrequency: string
}

export interface KPI {
  metric: string
  target: string
  timeframe: string
  /** PR-2B1: true when this KPI is a hypothesis (no historical data to back it). */
  isHypothesis?: boolean
}

export interface BudgetItem {
  category: string
  amount: number
  percent: number
}

export interface LaunchPhase {
  week: number
  focus: string
  actions: string[]
}

// ── New Sprint M interfaces ───────────────────────────────────────────────────

/** Practical business diagnosis — machine-readable breakdown */
export interface DiagnosisDetails {
  stage: 'pre-launch' | 'early-stage' | 'active' | 'scaling' | 'recovery'
  /** Whether the diagnosis is directly supported by Brand Brain or still a testable hypothesis. */
  basis: 'documented' | 'hypothesis'
  /** Exact Brand Brain field/evidence used, or the validation needed for a hypothesis. */
  evidenceBasis: string
  bottleneck: string
  trustGap: string
  offerClarity: 'clear' | 'unclear' | 'partial'
  contentGap: string
  assetReadiness: string
  conversionReadiness: string
  readyForPaidAds: boolean
  readyForPaidAdsReason: string
  mainRisk: string
}

/** Clear, structured business objective */
export interface BusinessObjective {
  primary: string
  marketing: string
  conversionAction: string
  expectedUserAction: string
  whyNow: string
  successIn30Days: string
}

/** Operational audience segment — goes far beyond "business owners" */
export interface AudienceSegmentDetailed {
  segment: string
  situation: string
  pain: string
  desiredOutcome: string
  objection: string
  message: string
  platform: string
  format: string
  cta: string
}

/** Full-funnel stage with product area mapping */
export interface FunnelStageDetailed {
  stage: 'awareness' | 'consideration' | 'conversion' | 'followUp'
  userMindset: string
  message: string
  contentType: string
  platform: string
  cta: string
  successMetric: string
  nextStep: string
  productArea: string
}

/** Content angle as structured execution unit */
export interface ContentAngleDetailed {
  title: string
  pain: string
  desiredOutcome?: string
  objection?: string
  format: string
  hook: string
  platform: string
  cta: string
  asset: string
  funnelStage: string
  proofNeeded?: string
  responseHandoff?: string
  reviewPoint?: string
}

/** Enriched weekly execution item */
export interface WeeklyExecutionItem {
  week: number
  objective: string
  keyMessage: string
  deliverables: string[]
  platforms: string[]
  assetsNeeded: string[]
  cta: string
  successMetric: string
  executionNote: string
  reviewPoints: string[]
}

/** What assets are needed before and during execution */
export interface AssetRequirements {
  mustHave: string[]
  niceToHave: string[]
  forAds: string[]
  forOrganic: string[]
  forProof: string[]
  canStartWithout: boolean
  canStartWithoutNote: string
  nextToCreate: string[]
}

/** VEX-ready ad setup plan */
export interface AdSetupPlan {
  objective: string
  testBudget: string
  duration: string
  platformPriority: string[]
  targeting: string
  exclusions: string
  creativeFormats: string[]
  adCopyAngles: string[]
  abTestPlan: string
  landingPath: string
  trackingRequired: string
  approvalChecklist: string[]
  notReadyIf: string[]
}

export interface PaidAudienceHypothesis {
  name: string
  buyingSituation: string
  targetingHypothesis: string
  exclusions: string
  validationNeeded: string
}

export interface PaidAdAngle {
  name: string
  audienceHypothesis: string
  message: string
  funnelStage: string
  proofNeeded: string
  testVariable: string
  successSignal: string
  rejectionRule: string
}

export interface PaidAdCopyVariation {
  id: string
  angle: string
  headline: string
  primaryText: string
  cta: string
  destination: string
  assumption: string
}

export interface PaidCreativeBrief {
  name: string
  angle: string
  format: string
  visualDirection: string
  requiredAssets: string[]
  assetStatus: 'existing_approved' | 'user_upload_required' | 'generation_required'
  proofBoundary: string
  reviewGate: string
}

export interface PaidPlanningPackage {
  planningOnly: true
  objective: string
  audienceHypotheses: PaidAudienceHypothesis[]
  adAngles: PaidAdAngle[]
  adCopyVariations: PaidAdCopyVariation[]
  creativeBriefs: PaidCreativeBrief[]
  budgetFramework: string
  trackingChecklist: string[]
  launchBlockers: string[]
}

/** Single readiness checklist item */
export interface ReadinessItem {
  label: string
  done: boolean
}

/** Structured success metric with category */
export interface SuccessMetricDetailed {
  category: 'lead' | 'engagement' | 'conversion' | 'operational'
  metric: string
  target: string
  timeframe: string
  /** PR-2B1: true when this metric is a hypothesis (no historical data to back it). */
  isHypothesis?: boolean
}

export interface MeasurementPlan {
  primaryOutcome: string
  baselineStatus: string
  eventsToTrack: string[]
  attributionRule: string
  reportingCadence: string
  owner: string
  noDataDecision: string
}

export interface OperatingCadence {
  daily: string[]
  weekly: string[]
  monthly: string[]
  approvalSla: string
  responseSla: string
  owners: string[]
}

export interface ExperimentBacklogItem {
  hypothesis: string
  audience: string
  variable: string
  successSignal: string
  minimumEvidence: string
  decisionRule: string
  priority: 'now' | 'next' | 'later'
  dependency: string
}

export interface DecisionRule {
  signal: string
  continueWhen: string
  iterateWhen: string
  stopWhen: string
  nextAction: string
}

export interface RoadmapPhase {
  phase: 'days_1_30' | 'days_31_60' | 'days_61_90'
  objective: string
  deliverables: string[]
  exitGate: string
}

export interface CompetitorFrame {
  analysisStatus: 'complete' | 'incomplete'
  providedCompetitors: string[]
  differentiationHypotheses: string[]
  researchNeeded: string[]
}

// ── PR-2B1 — honesty scaffold (all optional, server-authoritative where noted) ──

export type StrategyConfidenceLevel = 'high' | 'medium' | 'low'
export type CapabilityConfidenceLevel = 'high' | 'low' | 'none'

/**
 * Server-authoritative confidence readout. The model MAY propose this, but the
 * orchestrator overwrites it from getStrategyCapabilities() before persisting, so
 * the AI can never inflate confidence.
 */
export interface ConfidenceReport {
  overall: StrategyConfidenceLevel
  byCapability: Record<string, CapabilityConfidenceLevel>
}

/** Optional market/category context — isAssumption is ALWAYS forced true. */
export interface MarketContext {
  summary: string
  isAssumption: true
}

export interface StrategyEvidenceItem {
  statement: string
  status: 'source_linked' | 'brand_brain_entry'
  sourceName: string | null
  sourceLocator: string | null
}

/**
 * Compact readiness signal passed INTO the strategist so it knows what it may and
 * may not assert. Built server-side from getStrategyCapabilities() + Brand Brain.
 */
export interface StrategyReadinessContext {
  capabilities: { id: string; ready: boolean; confidence: CapabilityConfidenceLevel; missingKeys: string[] }[]
  missingKeys: string[]
  hasBudget: boolean
  budgetText?: string | null
  hasConversionDestination: boolean
  hasCompetitors: boolean
  hasHistoricalData: boolean
  hasPixel: boolean
}

// ── Main strategy output interface ───────────────────────────────────────────

export interface StrategyOutput {
  // Core fields (preserved for backwards compat)
  campaignName: string
  goal: string
  positioning: string
  keyMessage?: string
  targetAudienceRefined: string
  channelMix: ChannelAllocation[]
  kpis: KPI[]
  budgetBreakdown: BudgetItem[]
  contentPillars: string[]
  launchPlan: LaunchPhase[]
  estimatedResults: string
  confidence: number

  // Enriched Sprint D fields
  valueProps?: string[]
  visualDirection?: string
  executionChecklist?: string[]
  topHooks?: string[]
  ctaVariations?: string[]
  diagnosis?: string
  differentiation?: string
  funnelStrategy?: FunnelStrategy
  channelStrategy?: ChannelStrategy[]
  audienceSegments?: string[]
  contentAngles?: string[]
  weeklyPlan?: WeeklyPlan[]
  offerCTAStrategy?: OfferCTAStrategy
  successMetrics?: string[]
  riskNotes?: string[]
  nextBestAction?: string

  // Sprint M — new structured operational fields
  businessStage?: string
  mainBottleneck?: string
  mainRisk?: string
  readyForPaidAds?: boolean
  readyForPaidAdsReason?: string
  diagnosisDetails?: DiagnosisDetails
  businessObjective?: BusinessObjective
  audienceSegmentsDetailed?: AudienceSegmentDetailed[]
  funnelStages?: FunnelStageDetailed[]
  contentAnglesDetailed?: ContentAngleDetailed[]
  weeklyExecutionPlan?: WeeklyExecutionItem[]
  assetRequirements?: AssetRequirements
  adSetupPlan?: AdSetupPlan
  paidPlanning?: PaidPlanningPackage | null
  readinessChecklist?: ReadinessItem[]
  doNotDoYet?: string[]
  successMetricsDetailed?: SuccessMetricDetailed[]
  executionAssumptions?: string[]
  measurementPlan?: MeasurementPlan
  operatingCadence?: OperatingCadence
  experimentBacklog?: ExperimentBacklogItem[]
  decisionRules?: DecisionRule[]
  roadmap30_60_90?: RoadmapPhase[]
  competitorFrame?: CompetitorFrame

  // SERVER-AUTHORITATIVE snapshot built from Brand Brain proof. The model does
  // not generate or classify evidence provenance.
  evidenceLedger?: StrategyEvidenceItem[]

  // PR-2B1 — honesty scaffold (all optional; *server-authoritative fields are
  // overwritten by the orchestrator from getStrategyCapabilities()).
  assumptions?: string[]
  missingData?: string[]                 // SERVER-AUTHORITATIVE — stable readiness keys
  confidenceReport?: ConfidenceReport    // SERVER-AUTHORITATIVE
  competitorAnalysisComplete?: boolean   // SERVER-AUTHORITATIVE
  marketContext?: MarketContext          // isAssumption forced true if present
  /** Server-authored provider meter for margin auditing; never model-authored. */
  providerUsage?: ProviderUsageSummary
}

// ── AI provider call helper ───────────────────────────────────────────────────

export interface StrategistProviderConfig {
  endpoint: string
  token: string
  model: string
  providerName: 'Vercel AI Gateway' | 'OpenAI'
  supportsResponseFormat: boolean
  fallbackModels: string[]
}

/**
 * Production prefers Vercel's short-lived OIDC token so a revoked long-lived
 * OpenAI key does not take strategy generation down. Direct OpenAI remains a
 * local/backwards-compatible fallback.
 */
export function getStrategistProviderConfig(
  env: Record<string, string | undefined> = process.env,
): StrategistProviderConfig {
  const gatewayToken = env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim()
  if (gatewayToken) {
    const primaryModel = env.AI_GATEWAY_STRATEGY_MODEL?.trim() || 'openai/gpt-4o'
    const fallbackModel = env.AI_GATEWAY_STRATEGY_FALLBACK_MODEL?.trim() || 'openai/gpt-4.1-mini'
    return {
      endpoint: env.AI_GATEWAY_BASE_URL?.trim() || 'https://ai-gateway.vercel.sh/v1/chat/completions',
      token: gatewayToken,
      model: primaryModel,
      providerName: 'Vercel AI Gateway',
      // The OpenAI-compatible Gateway endpoint currently rejects
      // response_format. The same contract is injected into the system prompt.
      supportsResponseFormat: false,
      fallbackModels: fallbackModel === primaryModel ? [] : [fallbackModel],
    }
  }

  const openAIKey = env.OPENAI_API_KEY?.trim()
  if (!openAIKey) {
    throw new Error(
      'No AI provider credentials are configured. Set VERCEL_OIDC_TOKEN, AI_GATEWAY_API_KEY, or OPENAI_API_KEY.',
    )
  }

  return {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    token: openAIKey,
    model: 'gpt-4o',
    providerName: 'OpenAI',
    supportsResponseFormat: true,
    fallbackModels: [],
  }
}

export function buildGatewayJsonSystemPrompt(
  systemPrompt: string,
  responseFormat: Record<string, unknown>,
): string {
  const jsonSchema = responseFormat.type === 'json_schema'
    ? (responseFormat.json_schema as { schema?: unknown } | undefined)?.schema
    : undefined
  const schemaInstruction = jsonSchema
    ? `The returned JSON must conform exactly to this schema:\n${JSON.stringify(jsonSchema)}`
    : 'Return exactly one valid JSON object.'

  return [
    systemPrompt,
    '',
    'JSON OUTPUT CONTRACT (binding):',
    schemaInstruction,
    'Return raw JSON only. Do not wrap it in Markdown fences or add commentary.',
  ].join('\n')
}

export function parseStrategistJsonContent(content: string): unknown {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  return JSON.parse(normalized)
}

function aiProviderRequestError(status: number, providerName: StrategistProviderConfig['providerName']): Error {
  if (status === 401 || status === 403) {
    return new Error(
      `${providerName} authentication failed (${status}). Refresh the configured provider credentials before running live generation.`,
    )
  }
  if (status === 429) {
    return new Error(`${providerName} was rate-limited or has no available quota (429). Check provider limits before retrying.`)
  }
  return new Error(`${providerName} request failed (${status}).`)
}

async function fetchStrategistCompletion(
  provider: StrategistProviderConfig,
  requestBody: Record<string, unknown>,
  providerTimeoutMs: number,
): Promise<Response> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.token}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(providerTimeoutMs),
    })
    if (response.status !== 429 || attempt === maxAttempts) return response

    const retryAfterSeconds = Number(response.headers.get('retry-after'))
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.min(retryAfterSeconds * 1000, 60_000)
      : attempt === 1 ? 15_000 : 45_000
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  throw new Error(`${provider.providerName} retry loop ended unexpectedly.`)
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4000,
  responseFormat: Record<string, unknown> = { type: 'json_object' },
): Promise<{ output: unknown; usage: OpenAITextUsage }> {
  // Keep provider calls inside the route's 180-second execution budget even
  // when a contract-repair pass is needed. A timed-out call is refunded by the
  // route because credits are charged only after a saveable strategy exists.
  const providerTimeoutMs = 80_000
  const provider = getStrategistProviderConfig()
  const requestBody: Record<string, unknown> = {
    model: provider.model,
    messages: [
      {
        role: 'system',
        content: provider.supportsResponseFormat
          ? systemPrompt
          : buildGatewayJsonSystemPrompt(systemPrompt, responseFormat),
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.30,  // PR-2B1: lowered 0.45→0.30 for grounding (less embellishment / number-invention)
    max_tokens: maxTokens,
  }
  if (provider.supportsResponseFormat) {
    requestBody.response_format = responseFormat
  } else if (provider.fallbackModels.length > 0) {
    requestBody.providerOptions = {
      gateway: {
        models: provider.fallbackModels,
      },
    }
  }

  const response = await fetchStrategistCompletion(provider, requestBody, providerTimeoutMs)
  if (!response.ok) throw aiProviderRequestError(response.status, provider.providerName)
  const data = await response.json()
  recordOpenAIProviderUsage(data.usage)
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error(`${provider.providerName} returned no strategy`)
  try {
    return {
      output: parseStrategistJsonContent(content),
      usage: readOpenAIChatUsage(data.usage),
    }
  } catch {
    throw new Error(`${provider.providerName} returned invalid strategy JSON`)
  }
}

// ── Prompt builder (pure) ─────────────────────────────────────────────────────

/**
 * PR-S1c-3 — pure prompt builder, extracted so the BINDING generation-scope
 * contract is unit-testable without calling OpenAI. When `brief.generationInstructions`
 * is present (set server-side in /api/strategy/run-full from getStrategyDeliverables),
 * it is injected as a binding scope block that overrides any softer guidance. When
 * absent, the prompts are byte-for-byte the previous behavior (back-compat).
 */
export function buildStrategistPrompts(
  brief: BusinessBrief,
  brandContext?: string,
  language?: string,
  readiness?: StrategyReadinessContext,
): { systemPrompt: string; userPrompt: string } {
  const langInstruction = getLanguageInstruction(language ?? brief.language)
  const selectedLanguage = (language ?? brief.language ?? '').toLowerCase()
  const isArabicOutput = selectedLanguage.startsWith('ar')
  const arabicOutputContract = isArabicOutput
    ? [
        '',
        '',
        'ARABIC OUTPUT CONTRACT (binding — applies to every generated value):',
        '- The selected language is Arabic. Every user-facing JSON value must be written in natural Modern Standard Arabic.',
        '- English Brand Context, source notes, field labels, and schema descriptions are source/instruction text only. Do not mirror their language in output values.',
        '- Keep JSON keys exactly as requested in English. Keep brand names, product names, and platform names as provided.',
        '- Translate or adapt all user-visible campaign names, positioning, diagnosis, hooks, CTAs, content angles, readiness labels, weekly deliverables, metrics, risks, assumptions, missing-data explanations, and content format labels into Arabic.',
        '- Do not output English fallback format labels such as "Carousel or short social post", "Short-form video", "Video", or "Post" inside Arabic user-facing values. Use Arabic labels such as "كاروسيل"، "فيديو قصير"، or "منشور اجتماعي قصير".',
        '- Bad campaignName: "BrightNest Home Care Organic Growth Strategy"; good campaignName: "استراتيجية نمو عضوي لـ BrightNest Home Care".',
        '- Bad CTA: "Book your cleaning in seconds with WhatsApp!"; good CTA: "احجز خدمة التنظيف عبر WhatsApp بخطوة بسيطة".',
        '- Bad readiness item: "Create content calendar for Instagram and Facebook"; good readiness item: "تجهيز خطة اتجاهات المحتوى لأول 30 يومًا على Instagram وFacebook".',
        '- If a schema description below is in English, treat it as an instruction for what the field means, not wording to copy into the JSON value.',
      ].join('\n')
    : ''
  const planContext = getPlanContext(brief.planTier, brief.strategyType)
  const allowedPlatformLine = brief.currentPlatforms?.length
    ? `Allowed content platforms from Brand Brain: ${brief.currentPlatforms.join(', ')}. Use ONLY these platforms in channelMix, contentAnglesDetailed.platform, audienceSegmentsDetailed.platform, funnelStages.platform, and weeklyExecutionPlan.platforms. Do not add Pinterest, LinkedIn, blog, website, or any other platform unless it appears in this allowed list. If another platform is strategically interesting, mention it only as a future consideration, not an execution channel.`
    : ''
  const professionalOperatingBriefContract = [
    '',
    '',
    'PROFESSIONAL STRATEGY OPERATING BRIEF CONTRACT (binding):',
    '- Treat the output as an agency-grade operating brief for a real marketing team, not a motivational essay.',
    '- Each audience segment must be executable: specific role/situation, concrete pain, desired outcome, objection, message, platform, format, and CTA. Avoid vague segment names like "busy professionals" unless the brief truly supports them.',
    '- Every funnel stage must explain the handoff after the CTA: what the user should do next, what the brand/team must respond with, and what must be reviewed before scaling.',
    '- Weekly execution deliverables must be countable post directions tied to a segment, message, format, platform, CTA, asset need, and review point. Do not use theme-only deliverables.',
    '- Each content angle must be meaningfully distinct. Do not recycle the same pain, hook, or promise under different titles.',
    '- Each content angle must include desiredOutcome, objection, asset, proofNeeded, responseHandoff, and reviewPoint. Never omit these fields. If a field is blocked by missing proof/data, write the missing-data gap and the exact review task instead of leaving it blank.',
    '- assetRequirements is required. It must separate mustHave, niceToHave, forAds, forOrganic, forProof, canStartWithout, canStartWithoutNote, and nextToCreate.',
    '- Each weeklyExecutionPlan item must include assetsNeeded, executionNote, and reviewPoints for every week. Do not shorten later weeks into partial objects.',
    '- If lead handling, conversion destination, proof, analytics, competitors, or budget are missing, turn them into explicit operating gaps and review tasks. Never fill those gaps with invented facts.',
    '- Include practical proof/compliance boundaries: what claims cannot be made yet, what proof assets must be collected, and which messages should stay educational until evidence exists.',
    '- Use sober, implementation-ready language. Prefer "validate", "review", "prepare", "collect", "test message clarity", and "follow up" over hype or certainty.',
    '- Do not use generic hook formulas such as "Did you know…?", "هل تعلم…؟", "Imagine if…", or empty claims that analytics/numbers change a business. Hooks must name the specific audience situation, tension, objection, or task from this brief.',
    '- Do not return overlapping broad segments. Every segment needs a distinct trigger situation, buying role, objection, and qualification implication.',
    '- Include a measurement plan, operating cadence, prioritized experiment backlog, explicit continue/iterate/stop rules, and a 30/60/90 roadmap. A strategy without decision rules is not operational.',
    '- Avoid broad absolute solution claims such as "perfect solution", "best solution", "ideal solution", "الحل الأمثل", or "حل مثالي". Prefer practical, reviewable language such as "practical solution", "clearer workflow", or "حل عملي".',
    '- Treat quality superlatives and luxury positioning as factual claims: never write freshest, finest, premium, high-quality, optimal, الأطزج, الأفضل, فاخر, or مثالي unless the user supplied that exact positioning or verified proof. Prefer the user\'s factual offer details.',
    '- State commercial objectives as goals, not promises: write "support sales goals" or "aim to improve lead quality", never "increase sales", "boost revenue", or equivalent outcome language as a factual result.',
  ].join('\n')

  // ── PR-S1c-3 — binding scope from the deterministic deliverables contract. The
  //    counts/scope come from getStrategyDeliverables — never from the model. This
  //    block is authoritative; the softer Strategy Type/Duration lines below defer to it.
  const d = brief.strategyDeliverables
  const bindingScope = brief.generationInstructions
    ? [
        '',
        '',
        'BINDING GENERATION SCOPE (highest priority — overrides any conflicting guidance below):',
        'The following scope is binding. Do not exceed it. If something is outside scope, label it as "not included".',
        brief.generationInstructions,
        (brief.roadmapMonths ?? 1) > 1
          ? `This is a ${brief.roadmapMonths}-month roadmap. Generate a first-${brief.detailedCalendarDays ?? 30}-day execution outline through weeklyExecutionPlan and contentAnglesDetailed. Represent months 2+ ONLY as themes / backlog / future monthly cycles inside narrative fields (e.g. contentPillars, executionAssumptions, roadmap language) — never as per-day posts for the full horizon.`
          : '',
        'Do NOT imply that all days across the planning horizon are scheduled or published.',
        'This strategy run does NOT create a saved Content Hub content calendar, final SocialPost drafts, final captions, or scheduled calendar entries. Treat weeklyExecutionPlan and contentAnglesDetailed as strategy outline / planning direction only.',
        'Platform variants are ADAPTATIONS of the same content per channel — not separate additional posts.',
        brief.strategyType === 'organic'
          ? 'Organic-only mode is not paid planning: channelMix must describe organic effort/rhythm with effortSharePercent only. Do NOT include budgetPercent, paid readiness, ad launch, spend, activation, or platform-execution claims.'
          : '',
        brief.strategyType === 'paid'
          ? 'Paid-only mode must NOT create organic post directions, reels, captions, posting cadence, or a Content Hub plan. weeklyExecutionPlan is a four-week paid-planning workplan (research, creative review, tracking readiness, approval gates), not an organic publishing calendar.'
          : '',
        allowedPlatformLine,
        'Never claim ads will launch, budget will be spent, campaigns will be activated, or that posts are scheduled/published — nothing is published or activated without explicit user approval.',
        typeof brief.organicPostCount === 'number' && brief.organicPostCount > 0
          ? `Organic output count is binding: return exactly ${brief.organicPostCount} contentAnglesDetailed entries and make weeklyExecutionPlan.deliverables add up to exactly ${brief.organicPostCount} countable post directions for the first ${brief.detailedCalendarDays ?? 30} days.`
          : '',
        d && d.paidAdVariationCount > 0
          ? `Paid output counts are binding inside paidPlanning: exactly ${d.audienceHypothesisCount} audienceHypotheses, ${d.paidAdAngleCount} adAngles, ${d.paidAdVariationCount} adCopyVariations, and ${d.creativeBriefCount} creativeBriefs. paidPlanning.planningOnly must be true.`
          : 'paidPlanning must be null because paid planning is outside this order.',
        isArabicOutput
          ? 'Arabic language is binding: follow the ARABIC OUTPUT CONTRACT below for every user-facing JSON value.'
          : '',
        'Do not use CTAs like "Download now" unless a downloadable asset, lead magnet, app download, or file download was explicitly provided. Prefer demo, consultation, review, trial, quote, or contact CTAs that match the provided offer.',
        d?.excludedDeliverables?.length
          ? `Explicitly NOT included (label as "not included" if referenced): ${d.excludedDeliverables.join('; ')}.`
          : '',
      ].filter(Boolean).join('\n')
    : ''

  const systemPrompt = `${langInstruction}
${planContext}${bindingScope}${arabicOutputContract}${professionalOperatingBriefContract}

You are an expert marketing strategist. Build a complete, specific, actionable marketing strategy for the brand below.

RULES:
- Be specific to THIS brand — no generic advice
- Positioning: "[Brand] is the [category] for [audience] who need [outcome] without [frustration]"
- Hooks must be scroll-stopping, not clichéd
- Weekly plan = real deliverables ("3 Reels scripts about X", not "create content")
- Every weekly deliverable must be countable and concrete, not a generic task like "post consistently", "build awareness", or "increase engagement"
- Every audience segment, content angle, and funnel stage must include the operational fields needed to execute: situation, pain, desired outcome, objection, message, platform, format/content type, CTA, next step, asset need, review point, and response/follow-up handoff where applicable
- readinessChecklist must contain at least 3 concrete, review-safe pre-execution items. They must all have done=false and must not claim that assets, proof, tracking, publishing, scheduling, or platform setup are already complete unless provided.
- Never use: transform / unlock / game-changer / cutting-edge / leverage / maximize ROI
- Never use broad absolute solution claims: perfect solution / best solution / ideal solution / الحل الأمثل / حل مثالي.
- All text must follow the language instruction above
- If Arabic is selected, campaignName, positioning, diagnosis, pillars, hooks, CTAs, weekly deliverables, metrics, risks, assumptions, and readinessChecklist labels must be Arabic. Platform names and brand/product names may remain as provided.

ANTI-HALLUCINATION RULES (strict — these override any urge to sound complete):
1. Never invent competitor names or facts. Use ONLY competitors explicitly provided. If none are provided, set "competitorAnalysisComplete": false and do not name any competitor.
2. Never invent performance numbers — no CPL, CPA, ROAS, CTR, conversion rates, click counts, or impressions. Numbers may ONLY echo values the user provided (e.g. their budget band or price point).
3. Never promise results. Use conditional, effort-framed language ("aims to", "target to validate") — never "you will get X".
4. Never state market or category claims as fact. If you include "marketContext", it is an ASSUMPTION (the field isAssumption is always true) and must be hedged.
5. No budget provided → do NOT produce a budget allocation as fact. Leave budgetBreakdown empty.
6. No conversion destination provided → add an explicit funnel/paid risk to "riskNotes" (the conversion step is unverified).
7. No competitors provided → competitor analysis is incomplete; say so plainly.
8. No historical performance data → every KPI and success metric is a hypothesis ("isHypothesis": true).
9. No pixel/analytics connected → retargeting is future setup only; do not describe active retargeting.
10. Where a required input is missing, write the literal phrase "Not enough data" in that field and add the missing item to "missingData".
11. Paid output stays read-only and advisory — never describe how to execute/launch ads.
12. Proof policy: never invent testimonials, customer stories, awards, reviews, satisfaction claims, case studies, guarantees, or performance proof. Use only proof explicitly provided in Brand Context.
13. If proof is missing, recommend collecting proof or asking customers for feedback. Do not phrase proof gaps as if they already exist.
14. Do not create a customer-proof content pillar, customer-story hook, or testimonial CTA unless verified proof was provided.
15. Do not describe this campaign as activated, running, published, scheduled, or live. If the business is already operating, say "business already operating"; the campaign itself remains in planning/review until the user takes later actions.
16. Do not invent ad budget, campaign budget, spend allocation, CAC, ROAS, or paid media budget. If budget is missing, write "Budget not provided" and list budget as missing data.
17. Respect the selected Strategy Type exactly. Organic-only must not include paid launch plans. Paid planning must not imply spend, launch, active ads, platform permissions, or connected-account readiness unless those facts were explicitly provided.
18. If paid inputs are missing, label the paid scope as missing inputs or planning gaps. Do not invent budget, tracking/pixel status, platform readiness, paid launch approval, past results, ROI, benchmarks, competitors, or proof.
19. Paid outputs are planning-only unless budget approval, tracking readiness, platform readiness, and explicit launch approval are all present in the provided context. If they are not present, state that launch and spend are not included.
20. Platform scope is binding. Use only the active/allowed platforms provided in the brief for execution fields. Never add Pinterest, blog, website, LinkedIn, or any other channel unless it was explicitly provided as active/allowed.
21. Strategy output is a review artifact. Do not claim Content Hub posts, saved calendars, SocialPost rows, final captions, scheduling, or publishing were generated by this strategy run.
22. Organic count is binding when provided. contentAnglesDetailed must contain exactly the specified number of entries, and weeklyExecutionPlan.deliverables must distribute exactly that many countable post directions across the first detailed window.
23. Do not invent a downloadable asset. Avoid "Download now" unless the brief explicitly includes a download, app, lead magnet, or file.
24. Audience preferences, tone, positioning, or common industry practice are not proof of a service policy. Never invent no-hidden-fee or transparent-pricing promises, bilingual service, family/children services, pain-free or stress-free care, or clinic/facility tours unless that exact fact appears in Brand Context.
25. Before returning JSON, perform a final fluency pass on every user-facing value. Reject sentence fragments, missing nouns, literal translations, and malformed Arabic. Every hook, CTA, positioning line, funnel message, and weekly key message must be a complete natural sentence or phrase.
26. If no conversion destination is provided, do not invent trials, demos, bookings, registrations, downloads, purchases, WhatsApp, or contact paths. Use review-safe awareness actions that the content itself can satisfy, and keep the conversion destination explicitly unresolved.
27. Diagnosis truth is explicit: diagnosisDetails.basis must be "documented" only when the stated bottleneck is supported by a named Brand Brain field; otherwise use "hypothesis" and put the exact validation needed in evidenceBasis.
28. Channel rationale is a planning hypothesis unless a source-linked evidence item supports it. Never state that a platform is popular, growing, high-engagement, best, or category-leading as an unsourced fact.
29. Paid angles are test cells, not paraphrases. Every angle must test one different variable, name an observable success signal, and include a rejection rule. Ad-copy variations must be materially different in message or framing, not word swaps.
30. Every paid creative brief must declare assetStatus. Use existing_approved only when the supplied context proves an approved asset exists; otherwise use user_upload_required or generation_required. Never present a missing image or video as an existing asset.

Return ONLY valid JSON. No markdown outside the JSON.`

  const budgetLine = readiness?.budgetText?.trim()
    ? `User-provided budget context: ${readiness.budgetText.trim()}`
    : 'Monthly Budget: Not provided'

  const extendedBrief = [
    `Company: ${brief.companyName}`,
    `Industry: ${brief.businessType}`,
    `Target Audience: ${brief.targetAudience}`,
    budgetLine,
    `Primary Goal: ${brief.primaryGoal || 'generate qualified leads'}`,
    `Strategy Type: ${brief.strategyType || 'organic'} — ${
      brief.strategyType === 'paid'
        ? 'focus on the paid campaign plan; keep organic light'
        : brief.strategyType === 'full'
          ? 'cover both organic content and paid campaign planning'
          : 'focus on the ORGANIC content plan; do NOT over-build paid details'
    }`,
    `Strategy Duration: ${brief.strategyDuration && brief.strategyDuration !== 'custom' ? brief.strategyDuration + ' days' : (brief.strategyDuration === 'custom' ? 'custom horizon' : '90 days')} — plan to this horizon and make the FIRST 30 days concretely actionable as a strategy outline, not saved Content Hub posts`,
    allowedPlatformLine,
    brief.planTier ? `User Plan Tier: ${brief.planTier} — scale the strategy scope to match this plan's quota (see Plan Context above)` : '',
    brief.region ? `Region/Market: ${brief.region}` : '',
    brief.primaryOffer ? `Core Offer: ${brief.primaryOffer}` : '',
    brief.pricePoint ? `Price Positioning: ${brief.pricePoint}` : '',
    brief.uniqueValue ? `Unique Advantages: ${brief.uniqueValue}` : '',
    brief.painPoints ? `Audience Pain Points: ${brief.painPoints}` : '',
    brief.desires ? `Audience Desires: ${brief.desires}` : '',
    brief.competitors ? `Key Competitors: ${brief.competitors}` : '',
    brief.winningHooks ? `Reviewed Hook Signals: ${brief.winningHooks}` : '',
    brief.writingStyle ? `Brand Writing Style: ${brief.writingStyle}` : '',
    brief.avoidWords ? `Never use these words/phrases: ${brief.avoidWords}` : '',
    brief.currentPlatforms?.length ? `Active Platforms: ${brief.currentPlatforms.join(', ')}` : '',
    brief.existingProblems ? `Current Challenges: ${brief.existingProblems}` : '',
    brandContext ? `\nFull Brand Context:\n${brandContext}` : '',
    brief.pastLearnings ? `\n${brief.pastLearnings}` : '',
    brief.mediaContext ? `\nMEDIA LIBRARY CONTEXT:\n${brief.mediaContext}` : '',
  ].filter(Boolean).join('\n')

  // PR-2B1 — readiness context so the model knows what it may/may not assert.
  const readinessBlock = readiness
    ? [
        '\nDATA READINESS (you must respect this — do not assert beyond it):',
        `- Budget provided: ${readiness.hasBudget ? 'yes' : 'no'}`,
        readiness.budgetText?.trim()
          ? `- User-provided budget context: ${readiness.budgetText.trim()}`
          : '- User-provided budget context: Not provided',
        `- Conversion destination provided: ${readiness.hasConversionDestination ? 'yes' : 'no'}`,
        `- Competitors provided: ${readiness.hasCompetitors ? 'yes' : 'no'}`,
        `- Historical performance data: ${readiness.hasHistoricalData ? 'yes' : 'no'}`,
        `- Pixel/analytics connected: ${readiness.hasPixel ? 'yes' : 'no'}`,
        readiness.missingKeys.length
          ? `- Missing inputs (echo these into "missingData" and write ${isArabicOutput ? '"لا توجد بيانات كافية"' : '"Not enough data"'} where they block a section): ${readiness.missingKeys.join(', ')}`
          : '- No critical inputs missing.',
        'Capability readiness: ' + readiness.capabilities.map(c => `${c.id}=${c.confidence}`).join(', '),
      ].join('\n')
    : ''

  const channelMixSchemaItem = brief.strategyType === 'organic'
    ? '{ "platform": "string", "effortSharePercent": number, "rationale": "string", "contentFrequency": "string" }'
    : '{ "platform": "string", "budgetPercent": number, "rationale": "string — planning assumption only", "contentFrequency": "string" }'

  const paidPlanningSchema = d && d.paidAdVariationCount > 0
    ? `"paidPlanning": {
    "planningOnly": true,
    "objective": "string — paid objective from the reviewed brief",
    "audienceHypotheses": [
      { "name": "string", "buyingSituation": "string", "targetingHypothesis": "string", "exclusions": "string", "validationNeeded": "string" }
    ],
    "adAngles": [
      { "name": "string", "audienceHypothesis": "string", "message": "string", "funnelStage": "string", "proofNeeded": "string", "testVariable": "string — one variable only", "successSignal": "string — observable evidence", "rejectionRule": "string — when to stop this angle" }
    ],
    "adCopyVariations": [
      { "id": "string", "angle": "string", "headline": "string", "primaryText": "string", "cta": "string", "destination": "string — use Not enough data when unresolved", "assumption": "string" }
    ],
    "creativeBriefs": [
      { "name": "string", "angle": "string", "format": "string", "visualDirection": "string", "requiredAssets": ["string"], "assetStatus": "existing_approved|user_upload_required|generation_required", "proofBoundary": "string", "reviewGate": "string" }
    ],
    "budgetFramework": "string — planning framework only; never invent spend",
    "trackingChecklist": ["string"],
    "launchBlockers": ["string"]
  },`
    : '"paidPlanning": null,'

  const userPrompt = `
${extendedBrief}
${readinessBlock}
${arabicOutputContract}

Return JSON with these exact fields — all specific to this brand:

{
  "campaignName": "string",
  "goal": "SALES|LEADS|AWARENESS|ENGAGEMENT|TRAFFIC|BRAND_BUILDING",
  "positioning": "string — '[Brand] is the [category] for [audience] who need [outcome] without [frustration]'",
  "keyMessage": "string — ONE sentence the audience must believe",
  "differentiation": "string — what this brand does that no one else does",
  "targetAudienceRefined": "string — specific audience with situation and behaviors",
  "businessStage": "pre-launch|early-stage|active|scaling",
  "diagnosis": "string — real marketing situation, stage, main problem (2-3 sentences, specific)",

  "audienceSegments": ["string — 2-3 segment labels"],
  "audienceSegmentsDetailed": [
    {
      "segment": "string — specific role/situation",
      "situation": "string — what is happening in their business/life now",
      "pain": "string",
      "desiredOutcome": "string",
      "objection": "string",
      "message": "string — message this segment should believe before the CTA",
      "platform": "string",
      "format": "string — Arabic label if Arabic output is selected; do not use English fallback labels in Arabic output",
      "cta": "string — realistic next action; avoid unsupported downloads"
    }
  ],

  "contentPillars": ["string — 4-5 specific pillars"],
  "contentAngles": ["string — specific planning angles; align count with the binding organic direction target when provided"],
  "contentAnglesDetailed": [
    {
      "title": "string",
      "hook": "string — scroll-stopping opening line",
      "pain": "string",
      "desiredOutcome": "string — the practical outcome this post direction should make credible",
      "objection": "string — buyer concern this angle answers",
      "format": "string",
      "platform": "string",
      "cta": "string",
      "asset": "string — visual or proof asset needed before this can be produced confidently",
      "funnelStage": "awareness|consideration|conversion",
      "proofNeeded": "string — proof, screenshot, process detail, demo clip, or disclaimer needed; write Not enough data if missing",
      "responseHandoff": "string — who follows up and what they send after the CTA",
      "reviewPoint": "string — what a marketer must check before producing/repeating this angle"
    }
  ],

  "channelMix": [
    ${channelMixSchemaItem}
  ],

  ${paidPlanningSchema}

  "topHooks": ["string — 5+ hooks specific to this brand"],
  "ctaVariations": ["string — 5 specific CTAs"],

  "weeklyExecutionPlan": [
    {
      "week": 1,
      "objective": "string",
      "keyMessage": "string",
      "deliverables": ["string — concrete and countable: '2 Reels about X'"],
      "platforms": ["string"],
      "assetsNeeded": ["string — concrete asset or proof needed for this week's deliverables"],
      "cta": "string",
      "successMetric": "string",
      "executionNote": "string — include response owner/follow-up handoff if a lead action is requested",
      "reviewPoints": ["string — what a marketer should check before repeating or scaling"]
    },
    { "week": 2, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "assetsNeeded": ["string"], "cta": "string", "successMetric": "string", "executionNote": "string", "reviewPoints": ["string"] },
    { "week": 3, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "assetsNeeded": ["string"], "cta": "string", "successMetric": "string", "executionNote": "string", "reviewPoints": ["string"] },
    { "week": 4, "objective": "string", "keyMessage": "string", "deliverables": ["string"], "platforms": ["string"], "assetsNeeded": ["string"], "cta": "string", "successMetric": "string", "executionNote": "string", "reviewPoints": ["string"] }
  ],

  "assetRequirements": {
    "mustHave": ["string — assets required before this can become real post drafts"],
    "niceToHave": ["string"],
    "forAds": ["string — paid assets only if paid planning is in scope; otherwise planning gaps"],
    "forOrganic": ["string"],
    "forProof": ["string — proof needed before proof/performance/customer claims"],
    "canStartWithout": boolean,
    "canStartWithoutNote": "string — what can start safely and what remains blocked",
    "nextToCreate": ["string — next assets to prepare"]
  },

  "valueProps": ["string — 3-5 value propositions"],
  "doNotDoYet": ["string — 3-5 specific traps to avoid"],
  "nextBestAction": "string — ONE specific task to do today",
  "estimatedResults": "string — realistic, stage-appropriate, NO invented numbers",
  "readyForPaidAds": boolean,
  "readyForPaidAdsReason": "string",

  "businessObjective": {
    "primary": "string — the business goal in plain terms",
    "marketing": "string", "conversionAction": "string",
    "expectedUserAction": "string", "whyNow": "string",
    "successIn30Days": "string — review-safe definition of what to validate in the first 30 days; if no analytics baseline exists, define the baseline to establish, not an increase/growth/result claim"
  },
  "diagnosisDetails": {
    "stage": "pre-launch|early-stage|active|scaling|recovery",
    "basis": "documented|hypothesis — use documented only when the diagnosis is explicitly supported by Brand Brain",
    "evidenceBasis": "string — cite the saved Brand Brain field, or state the exact validation needed for a hypothesis",
    "bottleneck": "string", "trustGap": "string", "offerClarity": "clear|unclear|partial",
    "contentGap": "string", "assetReadiness": "string", "conversionReadiness": "string",
    "readyForPaidAds": boolean, "readyForPaidAdsReason": "string", "mainRisk": "string"
  },
  "funnelStages": [
    { "stage": "awareness|consideration|conversion|followUp", "userMindset": "string", "message": "string", "contentType": "string", "platform": "string", "cta": "string", "successMetric": "string", "nextStep": "string — include handoff after the CTA and what the team must do next", "productArea": "string" }
  ],
  "kpis": [
    { "metric": "string", "target": "string — NO invented performance numbers; a goal to validate", "timeframe": "string", "isHypothesis": true }
  ],
  "successMetricsDetailed": [
    { "category": "lead|engagement|conversion|operational", "metric": "string", "target": "string — NO invented numbers", "timeframe": "string", "isHypothesis": true }
  ],
  "measurementPlan": {
    "primaryOutcome": "string — the business outcome this plan is trying to validate",
    "baselineStatus": "string — state what baseline exists; if none, say the first cycle establishes it",
    "eventsToTrack": ["string — observable events, not invented performance targets"],
    "attributionRule": "string — how an inquiry/conversion is tied to source",
    "reportingCadence": "string",
    "owner": "string — use a role or mark owner confirmation as required",
    "noDataDecision": "string — what to do when signal volume is insufficient"
  },
  "operatingCadence": {
    "daily": ["string — monitoring/response task"],
    "weekly": ["string — review/approval/optimization task"],
    "monthly": ["string — strategy and Brand Brain learning task"],
    "approvalSla": "string — proposed operating SLA, not a claim about the current team",
    "responseSla": "string — proposed lead/community response SLA",
    "owners": ["string — role ownership; mark unconfirmed owners as a gap"]
  },
  "experimentBacklog": [
    { "hypothesis": "string", "audience": "string", "variable": "string — test one variable only", "successSignal": "string", "minimumEvidence": "string — decision evidence, no invented numeric threshold", "decisionRule": "string", "priority": "now|next|later", "dependency": "string" }
  ],
  "decisionRules": [
    { "signal": "string", "continueWhen": "string", "iterateWhen": "string", "stopWhen": "string", "nextAction": "string" }
  ],
  "roadmap30_60_90": [
    { "phase": "days_1_30", "objective": "string", "deliverables": ["string"], "exitGate": "string — evidence required before moving on" },
    { "phase": "days_31_60", "objective": "string", "deliverables": ["string"], "exitGate": "string" },
    { "phase": "days_61_90", "objective": "string", "deliverables": ["string"], "exitGate": "string" }
  ],
  "competitorFrame": {
    "analysisStatus": "complete|incomplete",
    "providedCompetitors": ["string — only user-provided competitor names"],
    "differentiationHypotheses": ["string — hypotheses to validate, never invented competitor facts"],
    "researchNeeded": ["string — exact evidence needed to complete the comparison"]
  },
  "readinessChecklist": [
    { "label": "string — concrete pre-execution readiness item 1; not a result claim", "done": false },
    { "label": "string — concrete pre-execution readiness item 2; not a result claim", "done": false },
    { "label": "string — concrete pre-execution readiness item 3; not a result claim", "done": false }
  ],
  "riskNotes": ["string — real risks; flag funnel/paid risk if conversion destination or budget is missing"],
  "executionAssumptions": ["string — assumptions this plan rests on"],
  "assumptions": ["string — explicit assumptions you made due to missing data"],
  "missingData": ["string — inputs that were missing; write the readiness keys you were given"],
  "competitorAnalysisComplete": false,
  "confidenceReport": { "overall": "high|medium|low", "byCapability": { "contentStrategy": "high|low|none" } }
}`

  return { systemPrompt, userPrompt }
}

export function buildStrategistCountRepairPrompt(
  output: StrategyOutput,
  expectedCount: number,
  paidDeliverables?: StrategyDeliverables,
  strategyType: BusinessBrief['strategyType'] = 'organic',
  contractIssues: string[] = [],
): string {
  const paidRepair = paidDeliverables && paidDeliverables.paidAdVariationCount > 0
    ? `Return paidPlanning with planningOnly=true and EXACTLY ${paidDeliverables.audienceHypothesisCount} audienceHypotheses, ${paidDeliverables.paidAdAngleCount} adAngles, ${paidDeliverables.paidAdVariationCount} adCopyVariations, and ${paidDeliverables.creativeBriefCount} creativeBriefs. Every record must contain every schema field. Paid-only weekly deliverables must be paid-planning milestones, never organic posts or a publishing calendar.`
    : 'paidPlanning must be null because paid planning is outside the reviewed order.'
  const organicRepair = strategyType === 'paid'
    ? 'Do not create organic posts. Keep contentAnglesDetailed as paid message directions and weeklyExecutionPlan as four countable paid-planning milestones.'
    : `The reviewed order requires exactly ${expectedCount} contentAnglesDetailed entries. weeklyExecutionPlan.deliverables must also add up to exactly ${expectedCount} countable organic post directions across the first detailed window.`
  return [
    'REPAIR THE JSON CONTRACT. Return the complete corrected strategy JSON only.',
    contractIssues.length
      ? `The validator reported these exact issues; repair every one of them: ${contractIssues.join(', ')}.`
      : '',
    'Return at least 2 distinct audienceSegmentsDetailed entries. Each must keep every required operational field and must be framed as a reviewable audience hypothesis when the Brand Brain does not prove it.',
    organicRepair,
    paidRepair,
    'Return exactly 4 weeklyExecutionPlan entries for a 30-day detailed window. Every week must include at least one countable deliverable, assetsNeeded, executionNote, and reviewPoints.',
    'Preserve the brand, facts, language, strategy type, platforms, proof gaps, and every valid field already present.',
    'Add distinct, executable angles grounded in the same audience, offer, goal, and content pillars. Do not duplicate or merely paraphrase an existing angle.',
    'Every paid angle must have one distinct testVariable, an observable successSignal, and a rejectionRule. Every creative brief must declare assetStatus as existing_approved, user_upload_required, or generation_required.',
    'businessObjective.successIn30Days must define an observable baseline or signal plus a decision rule (continue, iterate, or stop). Never use a vague phrase such as validate interest, build awareness, or improve engagement.',
    'diagnosisDetails must label its basis as documented or hypothesis and state the exact saved evidence or validation still needed.',
    'Do not invent proof, services, prices, languages, guarantees, competitors, performance numbers, budgets, or execution status while repairing the count.',
    `JSON TO REPAIR:\n${JSON.stringify(output)}`,
  ].join('\n')
}

export interface StrategistQualityRepairIssues {
  stage: 'strategy_contract' | 'marketing_quality'
  issueCodes: string[]
  affectedPaths: string[]
  issueDetails?: string[]
}

export function canUseFocusedPaidQualityRepair(
  brief: BusinessBrief,
  issues: StrategistQualityRepairIssues,
): boolean {
  return Boolean(
    (issues.stage === 'strategy_contract' || issues.stage === 'marketing_quality')
    && brief.strategyDeliverables
    && brief.strategyDeliverables.paidAdVariationCount > 0
    && issues.affectedPaths.length > 0
    && issues.affectedPaths.every(path => /^(?:strategy\.)?paidPlanning(?:\.|$)/.test(path)),
  )
}

export function buildStrategistQualityRepairPrompt(
  output: StrategyOutput,
  brief: BusinessBrief,
  issues: StrategistQualityRepairIssues,
  brandContext?: string,
): string {
  const expectedCount = typeof brief.organicPostCount === 'number' && brief.organicPostCount > 0
    ? Math.floor(brief.organicPostCount)
    : 4
  const contractRepair = buildStrategistCountRepairPrompt(
    output,
    expectedCount,
    brief.strategyDeliverables,
    brief.strategyType,
    [
      ...issues.issueCodes,
      ...issues.affectedPaths.map(path => `path:${path}`),
    ],
  )
  const issueSpecificRepairs = [
    issues.issueCodes.includes('conversion_cta_without_destination')
      ? [
          'CONVERSION-DESTINATION REPAIR (binding): no verified conversion destination exists.',
          'Inspect and rewrite EVERY customer-facing CTA in the complete JSON, not only the reported path. This includes offerCTAStrategy, ctaVariations, audienceSegmentsDetailed, contentAnglesDetailed, funnelStages, weeklyExecutionPlan, roadmap, and paidPlanning when present.',
          'Remove every direct-response instruction such as shop, browse/explore a collection, view products, add to cart, buy, order, sign up, register, book, request a demo, WhatsApp, تسوق، تصفح المجموعة، اكتشف المجموعة، اشتر، اطلب، سجل، احجز، or واتساب.',
          'Use only destination-free actions the content itself can satisfy, such as review the explained options, compare the criteria in this post, save the checklist, or follow the series for the next explanation. Keep the missing conversion path explicit as an unresolved readiness task.',
        ].join('\n')
      : '',
    issues.issueCodes.includes('ungrounded_brand_context')
      ? [
          'UNGROUNDED BRAND-CONTEXT REPAIR (binding): rewrite every affected path using only facts stated in the authoritative Brand Brain context.',
          'Do not add occupations, work/office/meeting use, lifestyles, cultural or heritage attributes, materials, product properties, freshness timing, or outcomes unless those exact facts are present in the authoritative context.',
          'For audience segment labels, reuse the reviewed target-audience wording and distinguish segments only by a documented pain, objection, or decision stage. Do not invent a new demographic or use case.',
        ].join('\n')
      : '',
  ].filter(Boolean)

  return [
    contractRepair,
    '',
    'QUALITY-GATE REPAIR — this is the single final repair before persistence.',
    `Failed stage: ${issues.stage}.`,
    `Blocking issue codes: ${issues.issueCodes.join(', ') || 'unknown'}.`,
    `Affected paths: ${issues.affectedPaths.join(', ') || 'unknown'}.`,
    issues.issueDetails?.length
      ? `Exact validator findings:\n${issues.issueDetails.map(detail => `- ${detail}`).join('\n')}`
      : '',
    `Authoritative brand: ${brief.companyName}.`,
    `Authoritative category: ${brief.businessType}.`,
    `Authoritative audience: ${brief.targetAudience}.`,
    `Authoritative offer: ${brief.primaryOffer || 'Not provided'}.`,
    `Allowed platforms only: ${brief.currentPlatforms?.join(', ') || 'Not provided'}.`,
    brief.avoidWords ? `Forbidden brand wording: ${brief.avoidWords}.` : '',
    brief.generationInstructions
      ? `Binding reviewed delivery contract:\n${brief.generationInstructions}`
      : '',
    brandContext
      ? `Authoritative Brand Brain context — do not add facts outside it:\n${brandContext}`
      : '',
    ...issueSpecificRepairs,
    'Repair every blocking path without weakening, deleting, or bypassing the reviewed delivery contract.',
    'Replace unsupported claims, audience expansions, internal workflow copy, and unreviewed platform claims with factual Brand Brain wording or an explicit hypothesis/proof-collection task.',
    'Keep all customer-facing copy useful and specific. Do not solve a blocker with empty text, generic filler, cloned directions, or a claim that the work is already executed.',
  ].filter(Boolean).join('\n')
}

function combineStrategyProviderUsage(
  existing: ProviderUsageSummary | undefined,
  repairUsage: OpenAITextUsage,
): ProviderUsageSummary {
  const combined = summarizeOpenAITextUsage(
    'gpt-4o',
    existing ? [existing, repairUsage] : [repairUsage],
  )
  return {
    ...combined,
    calls: (existing?.calls ?? 0) + 1,
  }
}

/**
 * One bounded, issue-directed repair after the deterministic save gate reports
 * exact blockers. The repaired document is still required to pass the same
 * contract, truth, and marketing-quality checks in the orchestrator.
 */
export async function repairStrategistQualityFailure(
  output: StrategyOutput,
  brief: BusinessBrief,
  issues: StrategistQualityRepairIssues,
  brandContext?: string,
  language?: string,
  readiness?: StrategyReadinessContext,
): Promise<StrategyOutput> {
  if (canUseFocusedPaidQualityRepair(brief, issues) && brief.strategyDeliverables) {
    const paidRepair = await repairPaidPlanningPackage(
      output,
      brief,
      brief.strategyDeliverables,
      language ?? brief.language,
      issues,
      brandContext,
    )
    return {
      ...output,
      paidPlanning: paidRepair.paidPlanning,
      providerUsage: combineStrategyProviderUsage(output.providerUsage, paidRepair.usage),
    }
  }

  const { systemPrompt } = buildStrategistPrompts(brief, brandContext, language, readiness)
  const repairCall = await callOpenAI(
    `${systemPrompt}\n\nYou are repairing a rejected strategy document. The listed quality-gate blockers and the reviewed commercial order are binding. Return the complete corrected JSON document only.`,
    buildStrategistQualityRepairPrompt(output, brief, issues, brandContext),
    9500,
  )
  const repaired = normalizeStrategyOutput(repairCall.output) as StrategyOutput
  repaired.providerUsage = combineStrategyProviderUsage(output.providerUsage, repairCall.usage)
  return repaired
}

function exactObjectArraySchema(
  count: number,
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'array',
    minItems: count,
    maxItems: count,
    items: {
      type: 'object',
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
    },
  }
}

/**
 * A focused Structured Outputs schema for the paid package. Re-generating the
 * complete strategy just to repair a 4/9 ad-copy mismatch is expensive and can
 * damage already-valid sections. Exact array bounds make the commercial order
 * enforceable at provider-output time instead of hoping a prose instruction is
 * counted correctly.
 */
export function buildPaidPlanningStructuredOutputSchema(
  deliverables: StrategyDeliverables,
): Record<string, unknown> {
  const textField = { type: 'string' }
  return {
    type: 'json_schema',
    json_schema: {
      name: 'paid_planning_repair',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          paidPlanning: {
            type: 'object',
            additionalProperties: false,
            properties: {
              planningOnly: { type: 'boolean', enum: [true] },
              objective: textField,
              audienceHypotheses: exactObjectArraySchema(deliverables.audienceHypothesisCount, {
                name: textField,
                buyingSituation: textField,
                targetingHypothesis: textField,
                exclusions: textField,
                validationNeeded: textField,
              }),
              adAngles: exactObjectArraySchema(deliverables.paidAdAngleCount, {
                name: textField,
                audienceHypothesis: textField,
                message: textField,
                funnelStage: textField,
                proofNeeded: textField,
                testVariable: textField,
                successSignal: textField,
                rejectionRule: textField,
              }),
              adCopyVariations: exactObjectArraySchema(deliverables.paidAdVariationCount, {
                id: textField,
                angle: textField,
                headline: textField,
                primaryText: textField,
                cta: textField,
                destination: textField,
                assumption: textField,
              }),
              creativeBriefs: exactObjectArraySchema(deliverables.creativeBriefCount, {
                name: textField,
                angle: textField,
                format: textField,
                visualDirection: textField,
                requiredAssets: { type: 'array', minItems: 1, items: textField },
                assetStatus: { type: 'string', enum: ['existing_approved', 'user_upload_required', 'generation_required'] },
                proofBoundary: textField,
                reviewGate: textField,
              }),
              budgetFramework: textField,
              trackingChecklist: { type: 'array', minItems: 1, items: textField },
              launchBlockers: { type: 'array', minItems: 1, items: textField },
            },
            required: [
              'planningOnly',
              'objective',
              'audienceHypotheses',
              'adAngles',
              'adCopyVariations',
              'creativeBriefs',
              'budgetFramework',
              'trackingChecklist',
              'launchBlockers',
            ],
          },
        },
        required: ['paidPlanning'],
      },
    },
  }
}

export function buildPaidPlanningRepairPrompt(
  output: StrategyOutput,
  brief: BusinessBrief,
  deliverables: StrategyDeliverables,
  issues?: StrategistQualityRepairIssues,
  brandContext?: string,
): string {
  return [
    'Repair ONLY the paidPlanning package. Return the schema object and no other strategy sections.',
    issues
      ? `Repair trigger: ${issues.stage}. Blocking issue codes: ${issues.issueCodes.join(', ') || 'unknown'}.`
      : '',
    issues?.affectedPaths.length
      ? `Rewrite every affected paid path: ${issues.affectedPaths.join(', ')}.`
      : '',
    issues?.issueDetails?.length
      ? `Exact validator findings:\n${issues.issueDetails.map(detail => `- ${detail}`).join('\n')}`
      : '',
    `Brand: ${brief.companyName}`,
    `Category: ${brief.businessType}`,
    `Audience: ${brief.targetAudience}`,
    `Goal: ${brief.primaryGoal || 'Not provided'}`,
    `Offer: ${brief.primaryOffer || 'Not provided'}`,
    `Allowed platforms: ${brief.currentPlatforms?.join(', ') || 'Not provided'}`,
    brandContext
      ? `Authoritative Brand Brain context — every factual detail must come from this block:\n${brandContext}`
      : '',
    `Required counts: ${deliverables.audienceHypothesisCount} audience hypotheses, ${deliverables.paidAdAngleCount} ad angles, ${deliverables.paidAdVariationCount} ad copy variations, and ${deliverables.creativeBriefCount} creative briefs.`,
    'Every item must be materially distinct and grounded in the same audience, offer, objective, proof limits, and allowed platforms.',
    'Audience hypotheses: give each record a different documented buying situation, targeting hypothesis, and validationNeeded test. A renamed segment with the same test is a duplicate.',
    'Ad angles: vary the decision barrier, message, single testVariable, successSignal, and rejectionRule. Do not reuse the same experiment with synonyms.',
    'Ad-copy variations: every headline and primaryText pair must express a materially different message angle and sentence structure. Changing only the CTA, opening phrase, or a synonym is a duplicate.',
    'Creative briefs: vary the angle, format, visual treatment, and required asset plan; do not clone one concept into four names.',
    'Creative visualDirection may specify composition, hierarchy, crop, typography treatment, color relationships, and the placement of user-supplied or approved assets. It must not invent a location, lifestyle, occupation, cultural context, material, product property, person, or use case that is absent from the authoritative Brand Brain.',
    'If the Brand Brain does not prove a visual fact, use a neutral studio/layout direction and mark the exact asset as user_upload_required or generation_required instead of inventing context.',
    'Before returning JSON, compare every pair inside each array and rewrite any pair that shares the same test or mostly the same wording. Arabic records must also use genuinely different ideas, not translated or reordered duplicates.',
    'This is planning only. Do not claim launch, spend, publishing, account readiness, conversions, performance, customer proof, or results.',
    'Never invent a budget, destination, price, proof point, competitor fact, service, or tracking state. Mark unresolved facts as Not enough data or the natural-language equivalent.',
    `CURRENT PACKAGE TO REPAIR:\n${JSON.stringify(output.paidPlanning ?? null)}`,
  ].join('\n')
}

async function repairPaidPlanningPackage(
  output: StrategyOutput,
  brief: BusinessBrief,
  deliverables: StrategyDeliverables,
  language?: string,
  issues?: StrategistQualityRepairIssues,
  brandContext?: string,
): Promise<{ paidPlanning: PaidPlanningPackage; usage: OpenAITextUsage }> {
  const call = await callOpenAI(
    `${getLanguageInstruction(language ?? brief.language)}\nYou are a senior paid-media planner repairing a reviewed planning package. Follow the exact Structured Outputs schema. Preserve factual uncertainty and produce distinct, reviewable hypotheses rather than invented facts.`,
    buildPaidPlanningRepairPrompt(output, brief, deliverables, issues, brandContext),
    6000,
    buildPaidPlanningStructuredOutputSchema(deliverables),
  )
  const wrapper = call.output as { paidPlanning?: PaidPlanningPackage }
  if (!wrapper?.paidPlanning) {
    throw new Error('OpenAI returned no paid planning package')
  }
  return { paidPlanning: wrapper.paidPlanning, usage: call.usage }
}

// ── Main agent function ───────────────────────────────────────────────────────

export async function runStrategistAgent(
  brief: BusinessBrief,
  brandContext?: string,
  language?: string,
  readiness?: StrategyReadinessContext
): Promise<StrategyOutput> {
  const { systemPrompt, userPrompt } = buildStrategistPrompts(brief, brandContext, language, readiness)
  const providerCalls: OpenAITextUsage[] = []

  const initialCall = await callOpenAI(systemPrompt, userPrompt, 7500)
  providerCalls.push(initialCall.usage)
  let output = normalizeStrategyOutput(initialCall.output) as StrategyOutput

  // Models sometimes miss the reviewed count or return too few audience/week
  // records. Repair once before the commercial contract rejects/refunds the
  // run; never pad by cloning generic angles.
  let contractPreview = validateCampaignStrategyContract(output, {
    language: language ?? brief.language,
    expectedOrganicPostCount: brief.organicPostCount,
    strategyType: brief.strategyType,
    expectedPaidPlanning: brief.strategyDeliverables,
  })
  const nonPaidContractIssues = [
    ...contractPreview.missingFields,
    ...contractPreview.weakFields,
    ...contractPreview.languageViolations,
  ].filter(field => !field.startsWith('paidPlanning'))
  const structuralRepairNeeded = nonPaidContractIssues.length > 0
  const nonPaidCountRepairNeeded = contractPreview.countViolations.some(field => !field.startsWith('paidPlanning.'))
  if (nonPaidCountRepairNeeded || structuralRepairNeeded) {
    const repairDirectionCount = typeof brief.organicPostCount === 'number' && brief.organicPostCount > 0
      ? Math.floor(brief.organicPostCount)
      : 4
    const repairCall = await callOpenAI(
      `${systemPrompt}\n\nYou are repairing a previously generated JSON document. The repair instructions and reviewed order are binding.`,
      buildStrategistCountRepairPrompt(
        output,
        repairDirectionCount,
        brief.strategyDeliverables,
        brief.strategyType,
        [
          ...nonPaidContractIssues,
          ...contractPreview.countViolations.filter(field => !field.startsWith('paidPlanning.')),
        ],
      ),
      9500,
    )
    providerCalls.push(repairCall.usage)
    output = normalizeStrategyOutput(repairCall.output) as StrategyOutput
    contractPreview = validateCampaignStrategyContract(output, {
      language: language ?? brief.language,
      expectedOrganicPostCount: brief.organicPostCount,
      strategyType: brief.strategyType,
      expectedPaidPlanning: brief.strategyDeliverables,
    })
  }

  const paidDeliverables = brief.strategyDeliverables
  const paidRepairNeeded = Boolean(
    paidDeliverables &&
    paidDeliverables.paidAdVariationCount > 0 &&
    (
      contractPreview.missingFields.some(field => field.startsWith('paidPlanning')) ||
      contractPreview.weakFields.some(field => field.startsWith('paidPlanning')) ||
      contractPreview.countViolations.some(field => field.startsWith('paidPlanning.'))
    )
  )
  if (paidRepairNeeded && paidDeliverables) {
    const paidRepair = await repairPaidPlanningPackage(
      output,
      brief,
      paidDeliverables,
      language ?? brief.language,
    )
    providerCalls.push(paidRepair.usage)
    output = { ...output, paidPlanning: paidRepair.paidPlanning }
  }

  output.providerUsage = summarizeOpenAITextUsage('gpt-4o', providerCalls)
  console.info('[AI Economics] strategy', {
    model: output.providerUsage.model,
    calls: output.providerUsage.calls,
    inputTokens: output.providerUsage.inputTokens,
    outputTokens: output.providerUsage.outputTokens,
    estimatedProviderCostUsd: output.providerUsage.estimatedProviderCostUsd,
    pricingVersion: output.providerUsage.pricingVersion,
  })

  // ── Quality guardrail: log if output is too generic ───────────────────────
  const rawText = JSON.stringify(output)
  checkAndLog('strategist', rawText, {
    brandName: brief.companyName,
    industry: brief.businessType,
    targetAudience: brief.targetAudience,
    primaryOffer: brief.primaryOffer,
  })

  return output
}
