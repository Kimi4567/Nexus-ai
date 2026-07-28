/**
 * PR-S1c-2 — Server/client-safe Strategy Order normalizer + charge resolver (pure).
 *
 * The Run Full Strategy modal sends a loosely-typed body. The backend MUST NOT
 * trust any client-supplied price — it rebuilds a validated StrategyOrder from
 * that body and recomputes the credit cost itself via getStrategyCreditCost.
 *
 *   normalizeStrategyOrder(body) → a fully-validated StrategyOrder
 *   resolveStrategyCharge(body)  → { order, pricing, supported, cost }
 *
 * Both are pure & deterministic: no I/O, no React, no Prisma, no mutation. The
 * SAME functions power the modal's display, so the price the user sees and the
 * price the backend charges are computed from identical logic on identical input.
 *
 * Defaults match the modal pickers (organic / 90-day / standard) so client and
 * server never disagree when a field is missing.
 */

import type {
  StrategyOrder,
  StrategyType,
  DurationPreset,
  ContentIntensity,
  StrategyLanguage,
  PlanContextLike,
} from './strategyOrder'
import { getStrategyCreditCost, type StrategyCreditCost } from './strategyPricing'
import { normalizeCustomOrganicPostCount } from './strategyPostCount'

/** Loosely-typed input shape (e.g. a parsed request body). */
export interface StrategyOrderInput {
  strategyType?: unknown
  strategyDuration?: unknown
  durationPreset?: unknown
  contentIntensity?: unknown
  customOrganicPostCount?: unknown
  customDurationDays?: unknown
  durationDays?: unknown
  goal?: unknown
  language?: unknown
}

const STRATEGY_TYPES: readonly StrategyType[] = ['organic', 'paid', 'full']
const DURATION_PRESETS: readonly DurationPreset[] = ['30', '90', '180', 'custom']
const CONTENT_INTENSITIES: readonly ContentIntensity[] = ['light', 'standard', 'growth', 'daily']
const STRATEGY_LANGUAGES: readonly StrategyLanguage[] = ['en', 'ar', 'both']

/** Strategy type — default 'organic' for anything invalid/missing. */
function normalizeStrategyType(raw: unknown): StrategyType {
  return STRATEGY_TYPES.includes(raw as StrategyType) ? (raw as StrategyType) : 'organic'
}

/** Duration preset — default '90'. Accepts strategyDuration or durationPreset. */
function normalizeDurationPreset(raw: unknown): DurationPreset {
  return DURATION_PRESETS.includes(raw as DurationPreset) ? (raw as DurationPreset) : '90'
}

/** Content intensity — whitelist; default 'standard' for anything invalid/missing. */
export function normalizeContentIntensity(raw: unknown): ContentIntensity {
  return CONTENT_INTENSITIES.includes(raw as ContentIntensity) ? (raw as ContentIntensity) : 'standard'
}

/** Language — default 'en'. */
function normalizeLanguage(raw: unknown): StrategyLanguage {
  // The run modal sends 'bilingual'; map it to the contract's 'both'.
  if (raw === 'bilingual') return 'both'
  return STRATEGY_LANGUAGES.includes(raw as StrategyLanguage) ? (raw as StrategyLanguage) : 'en'
}

/**
 * Resolve the effective horizon in days.
 *  - presets → the preset number (30/90/180).
 *  - custom  → Math.floor(Number(customDurationDays)); non-finite/≤0 → 0, which
 *    getStrategyCreditCost treats as unsupported (no charge). Values > 180 stay
 *    as-is so pricing flags them unsupported too.
 */
function resolveDurationDays(preset: DurationPreset, rawCustom: unknown, rawDays: unknown): number {
  if (preset !== 'custom') return Number(preset)
  const source = rawCustom !== undefined ? rawCustom : rawDays
  const n = Math.floor(Number(source))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Build a validated StrategyOrder from loosely-typed body input.
 * Never throws; always returns a well-formed order with safe defaults.
 */
export function normalizeStrategyOrder(input: StrategyOrderInput | null | undefined): StrategyOrder {
  const body = input ?? {}
  const strategyType = normalizeStrategyType(body.strategyType)
  const durationPreset = normalizeDurationPreset(
    body.strategyDuration !== undefined ? body.strategyDuration : body.durationPreset,
  )
  const contentIntensity = normalizeContentIntensity(body.contentIntensity)
  const customOrganicPostCount = normalizeCustomOrganicPostCount(body.customOrganicPostCount)
  const durationDays = resolveDurationDays(durationPreset, body.customDurationDays, body.durationDays)
  const language = normalizeLanguage(body.language)
  const goal = typeof body.goal === 'string' ? body.goal : ''

  return {
    strategyType,
    durationPreset,
    durationDays,
    contentIntensity,
    customOrganicPostCount,
    goal,
    language,
  }
}

/** Result of resolving a charge from raw input. */
export interface ResolvedStrategyCharge {
  order: StrategyOrder
  pricing: StrategyCreditCost
  /** false for unsupported orders (custom > 180 or non-positive) — caller must NOT charge. */
  supported: boolean
  /** Whole-credit cost, or null when unsupported. Never a client-supplied value. */
  cost: number | null
}

/**
 * Normalize a body into a validated order and recompute its credit cost.
 * This is the single source of truth the backend uses before any deduction —
 * the client's displayed price is never trusted.
 */
export function resolveStrategyCharge(
  input: StrategyOrderInput | null | undefined,
  planContext?: Pick<PlanContextLike, 'postsPerMonth'>,
): ResolvedStrategyCharge {
  const order = normalizeStrategyOrder(input)
  const pricing = getStrategyCreditCost(order, planContext)
  return {
    order,
    pricing,
    supported: pricing.supported,
    cost: pricing.cost,
  }
}
