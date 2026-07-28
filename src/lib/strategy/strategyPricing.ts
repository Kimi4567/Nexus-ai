/**
 * PR-S1c-1 — Strategy pricing matrix (pure, deterministic).
 *
 * getStrategyCreditCost(order) returns the credit cost for a confirmed
 * StrategyOrder, per the approved pricing matrix. Cost depends on:
 *   - strategyType  (organic | paid | full)
 *   - contentIntensity (light | standard | growth | daily)  → maps to a tier
 *   - duration (30 / 90 / 180 / custom)  → a price column, with custom rules
 *
 * THIS PR IS PRICING-CONFIG ONLY. It performs NO deduction, NO I/O, NO React,
 * NO Prisma, NO API calls, NO mutation. Pure & deterministic — same input always
 * yields the same output and the input object is never mutated. The backend
 * (PR-S1c-3) will recompute price from the server-validated order; the client
 * value is display-only and must never be trusted as a chargeable amount.
 *
 * Custom > 180 days is NEVER chargeable: returns { supported:false, cost:null }.
 */

import type { StrategyOrder, ContentIntensity, PlanContextLike } from './strategyOrder'
import { INTENSITY_POST_TARGET } from './deliverablesContract'
import {
  customOrganicPostCountUnsupported,
  effectiveContentIntensityForOrder,
  includesOrganicScope,
  intensityForOrganicPostCount,
  isValidCustomOrganicPostCount,
  MAX_CUSTOM_ORGANIC_POST_COUNT,
} from './strategyPostCount'

export type DurationBucket = '30' | '90' | '180' | 'custom-unsupported'

export interface StrategyCreditCost {
  /** Whole-credit cost, or null when unsupported (custom > 180). */
  cost: number | null
  /** false only for custom > 180 days (or a non-positive horizon). */
  supported: boolean
  /** e.g. "Organic Standard", "Paid Advanced", "Full Daily". */
  tierLabel: string
  /** The price column used (30/90/180), or 'custom-unsupported'. */
  durationBucket: DurationBucket
  /** Short plain-language explanation of how the cost was derived. */
  pricingExplanation: string
}

type PriceRow = { 30: number; 90: number; 180: number }

// ── Approved matrices ────────────────────────────────────────────────────────
const ORGANIC: Record<ContentIntensity, PriceRow> = {
  light:    { 30: 12, 90: 18, 180: 24 },
  standard: { 30: 16, 90: 24, 180: 32 },
  growth:   { 30: 22, 90: 32, 180: 42 },
  daily:    { 30: 28, 90: 40, 180: 54 },
}

// Paid tiers (Basic / Standard / Advanced). Intensity maps onto these tiers.
const PAID: Record<'basic' | 'standard' | 'advanced', PriceRow> = {
  basic:    { 30: 16, 90: 24, 180: 32 },
  standard: { 30: 22, 90: 32, 180: 42 },
  advanced: { 30: 28, 90: 40, 180: 54 },
}

const FULL: Record<ContentIntensity, PriceRow> = {
  light:    { 30: 24, 90: 34, 180: 46 },
  standard: { 30: 32, 90: 46, 180: 60 },
  growth:   { 30: 42, 90: 60, 180: 78 },
  daily:    { 30: 54, 90: 76, 180: 96 },
}

// Paid intensity → paid tier (light=Basic, standard=Standard, growth/daily=Advanced).
const PAID_TIER_FOR_INTENSITY: Record<ContentIntensity, 'basic' | 'standard' | 'advanced'> = {
  light: 'basic',
  standard: 'standard',
  growth: 'advanced',
  daily: 'advanced',
}

const CAP = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

/** Resolve the effective horizon in days from preset/custom inputs. */
function resolveDays(order: StrategyOrder): number {
  if (order.durationPreset === '30') return 30
  if (order.durationPreset === '90') return 90
  if (order.durationPreset === '180') return 180
  const d = Math.floor(order.durationDays)
  return Number.isFinite(d) ? d : 0
}

/** Pick the price-column row + human tier label for the order. */
function pricingIntensityForOrder(
  order: StrategyOrder,
  planContext?: Pick<PlanContextLike, 'postsPerMonth'>,
): ContentIntensity {
  if (!includesOrganicScope(order)) return order.contentIntensity

  const requestedPostCount = isValidCustomOrganicPostCount(order.customOrganicPostCount)
    ? order.customOrganicPostCount
    : INTENSITY_POST_TARGET[order.contentIntensity]
  const rawPlanCap = planContext?.postsPerMonth
  if (typeof rawPlanCap !== 'number' || !Number.isFinite(rawPlanCap) || rawPlanCap <= 0) {
    return effectiveContentIntensityForOrder(order)
  }

  const deliveredPostCount = Math.min(requestedPostCount, Math.floor(rawPlanCap))
  return intensityForOrganicPostCount(deliveredPostCount)
}

/** Pick the price row from the scope that can actually be delivered. */
function rowAndLabel(
  order: StrategyOrder,
  planContext?: Pick<PlanContextLike, 'postsPerMonth'>,
): { row: PriceRow; tierLabel: string; pricingIntensity: ContentIntensity } {
  if (order.strategyType === 'paid') {
    const tier = PAID_TIER_FOR_INTENSITY[order.contentIntensity]
    return { row: PAID[tier], tierLabel: `Paid ${CAP(tier)}`, pricingIntensity: order.contentIntensity }
  }
  const effectiveIntensity = pricingIntensityForOrder(order, planContext)
  if (order.strategyType === 'full') {
    return {
      row: FULL[effectiveIntensity],
      tierLabel: `Full ${CAP(effectiveIntensity)}`,
      pricingIntensity: effectiveIntensity,
    }
  }
  return {
    row: ORGANIC[effectiveIntensity],
    tierLabel: `Organic ${CAP(effectiveIntensity)}`,
    pricingIntensity: effectiveIntensity,
  }
}

function planAdjustedPricingNote(
  order: StrategyOrder,
  pricingIntensity: ContentIntensity,
  planContext?: Pick<PlanContextLike, 'postsPerMonth'>,
): string {
  if (!includesOrganicScope(order)) return ''
  const rawPlanCap = planContext?.postsPerMonth
  if (typeof rawPlanCap !== 'number' || !Number.isFinite(rawPlanCap) || rawPlanCap <= 0) return ''

  const requestedPostCount = isValidCustomOrganicPostCount(order.customOrganicPostCount)
    ? order.customOrganicPostCount
    : INTENSITY_POST_TARGET[order.contentIntensity]
  const deliveredPostCount = Math.min(requestedPostCount, Math.floor(rawPlanCap))
  if (deliveredPostCount >= requestedPostCount) return ''

  return ` · plan-adjusted to ${deliveredPostCount} of ${requestedPostCount} requested post directions (${CAP(pricingIntensity)} price)`
}

/**
 * Compute the credit cost for a confirmed order. Pure; never mutates `order`.
 */
export function getStrategyCreditCost(
  order: StrategyOrder,
  planContext?: Pick<PlanContextLike, 'postsPerMonth'>,
): StrategyCreditCost {
  const { row, tierLabel, pricingIntensity } = rowAndLabel(order, planContext)
  const planAdjustedNote = planAdjustedPricingNote(order, pricingIntensity, planContext)
  const days = resolveDays(order)
  const isCustom = order.durationPreset === 'custom'
  const hasOrganicCustomCount = includesOrganicScope(order) && order.customOrganicPostCount != null

  if (customOrganicPostCountUnsupported(order)) {
    return {
      cost: null,
      supported: false,
      tierLabel,
      durationBucket: 'custom-unsupported',
      pricingExplanation: `${tierLabel} · custom organic post count must be 1-${MAX_CUSTOM_ORGANIC_POST_COUNT} for the first detailed window — no charge`,
    }
  }

  // ── Preset durations: direct matrix lookup ──
  if (!isCustom) {
    const bucket = order.durationPreset as '30' | '90' | '180'
    const cost = row[Number(bucket) as 30 | 90 | 180]
    return {
      cost,
      supported: true,
      tierLabel,
      durationBucket: bucket,
      pricingExplanation: hasOrganicCustomCount
        ? `${tierLabel} · exact ${order.customOrganicPostCount} organic post directions${planAdjustedNote} · ${bucket}-day price = ${cost} credits`
        : `${tierLabel}${planAdjustedNote} · ${bucket}-day price = ${cost} credits`,
    }
  }

  // ── Custom durations ──
  // > 180 (or non-positive) → unsupported, never chargeable.
  if (days > 180 || days <= 0) {
    return {
      cost: null,
      supported: false,
      tierLabel,
      durationBucket: 'custom-unsupported',
      pricingExplanation:
        days > 180
          ? `${tierLabel} · custom ${days} days is over 180 — not supported, custom quote only (no automatic charge)`
          : `${tierLabel} · invalid custom duration — no charge`,
    }
  }

  // 1–30 → 30-day price.
  if (days <= 30) {
    return {
      cost: row[30],
      supported: true,
      tierLabel,
      durationBucket: '30',
      pricingExplanation: hasOrganicCustomCount
        ? `${tierLabel} · exact ${order.customOrganicPostCount} organic post directions${planAdjustedNote} · custom ${days} days = 30-day price = ${row[30]} credits`
        : `${tierLabel}${planAdjustedNote} · custom ${days} days = 30-day price = ${row[30]} credits`,
    }
  }
  // 31–60 → 30-day price + 20%, rounded up.
  if (days <= 60) {
    const cost = Math.ceil(row[30] * 1.2)
    return {
      cost,
      supported: true,
      tierLabel,
      durationBucket: '30',
      pricingExplanation: hasOrganicCustomCount
        ? `${tierLabel} · exact ${order.customOrganicPostCount} organic post directions${planAdjustedNote} · custom ${days} days = 30-day price +20% (ceil) = ${cost} credits`
        : `${tierLabel}${planAdjustedNote} · custom ${days} days = 30-day price +20% (ceil) = ${cost} credits`,
    }
  }
  // 61–90 → 90-day price.
  if (days <= 90) {
    return {
      cost: row[90],
      supported: true,
      tierLabel,
      durationBucket: '90',
      pricingExplanation: hasOrganicCustomCount
        ? `${tierLabel} · exact ${order.customOrganicPostCount} organic post directions${planAdjustedNote} · custom ${days} days = 90-day price = ${row[90]} credits`
        : `${tierLabel}${planAdjustedNote} · custom ${days} days = 90-day price = ${row[90]} credits`,
    }
  }
  // 91–180 → 180-day price.
  return {
    cost: row[180],
    supported: true,
    tierLabel,
    durationBucket: '180',
    pricingExplanation: hasOrganicCustomCount
      ? `${tierLabel} · exact ${order.customOrganicPostCount} organic post directions${planAdjustedNote} · custom ${days} days = 180-day price = ${row[180]} credits`
      : `${tierLabel}${planAdjustedNote} · custom ${days} days = 180-day price = ${row[180]} credits`,
  }
}
