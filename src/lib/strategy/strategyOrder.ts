/**
 * PR-S1a — Strategy Order types.
 *
 * Product model:
 *   Brand Brain = default preferences.
 *   Strategy Page = the FINAL confirmed order.
 * The final confirmed order (not Brand Brain) determines deliverables, credits,
 * and generation instructions.
 *
 * Critical rule: duration is the PLANNING HORIZON, not the number of posts
 * generated upfront. Strategy generation produces an execution outline; final
 * Content Hub draft posts / saved calendars are generated separately.
 *
 * This file is pure types — no logic, no I/O.
 */

export type StrategyType = 'organic' | 'paid' | 'full'
export type DurationPreset = '30' | '90' | '180' | 'custom'
export type ContentIntensity = 'light' | 'standard' | 'growth' | 'daily'
export type StrategyLanguage = 'en' | 'ar' | 'both'

/** The final confirmed order the user reviews before generation. */
export interface StrategyOrder {
  strategyType: StrategyType
  durationPreset: DurationPreset
  /** Resolved horizon in days. For presets this mirrors the preset; for custom it's the user value. */
  durationDays: number
  contentIntensity: ContentIntensity
  /**
   * Optional exact organic post-direction count for the first detailed window.
   * Applies only to organic/full strategies. Paid-only ignores it.
   * Valid range is 1..30 because the strategy run never generates more than the
   * first 30 days of detailed post directions.
   */
  customOrganicPostCount?: number | null
  goal: string
  language: StrategyLanguage
  /** When true, the UI layer (later PR) persists this order back to Brand Brain defaults. */
  saveAsDefault?: boolean
}

/**
 * Minimal subscription-plan context (subset of lib/agents/planContext.ts).
 * Optional — when omitted, no plan cap is applied. PR-S1a never imports the real
 * plan module; the caller passes the numbers it already has.
 */
export interface PlanContextLike {
  /** Monthly post quota from the user's plan tier (e.g. starter 10, growth 25). */
  postsPerMonth?: number
  /** Max platforms the plan supports (used for platformVariantCount when present). */
  platformCount?: number
}

/**
 * Deterministic deliverables contract. Counts come from THIS object — never from
 * the AI. Drives both the pre-charge review UI and the generation instructions.
 */
export interface StrategyDeliverables {
  /** false only for unsupported orders (custom > 180 days) — caller must block before charging. */
  supported: boolean
  /** Present only when supported === false. */
  unsupportedReason?: string

  planningHorizonDays: number
  /** Always ≤ 30. The window that gets a concrete strategy execution outline. */
  detailedCalendarDays: number
  roadmapMonths: number

  /** Final organic post count after any plan cap (0 for paid-only strategies). */
  organicPostCount: number
  /** What the chosen intensity asked for, before any plan cap. */
  requestedOrganicPostCount: number
  /** The plan's monthly quota when a PlanContext was supplied; otherwise null. */
  planCappedOrganicPostCount: number | null
  /** True when the requested intensity exceeded the plan quota and was capped. */
  planCapApplied: boolean

  platformVariantCount: number
  paidAdVariationCount: number
  creativeBriefCount: number
  audienceHypothesisCount: number

  includedDeliverables: string[]
  excludedDeliverables: string[]

  /** Localized (per order.language) plain-language summary of what will be generated. */
  userExplanation: string
  /** Constraints handed to the generation agents (single source of truth for scope). */
  generationInstructions: string
}
