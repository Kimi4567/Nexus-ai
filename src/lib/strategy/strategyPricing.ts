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

import type { StrategyOrder, ContentIntensity } from './strategyOrder'

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
  light:    { 30: 8,  90: 12, 180: 16 },
  standard: { 30: 10, 90: 14, 180: 18 },
  growth:   { 30: 12, 90: 16, 180: 20 },
  daily:    { 30: 14, 90: 18, 180: 22 },
}

// Paid tiers (Basic / Standard / Advanced). Intensity maps onto these tiers.
const PAID: Record<'basic' | 'standard' | 'advanced', PriceRow> = {
  basic:    { 30: 10, 90: 14, 180: 18 },
  standard: { 30: 12, 90: 16, 180: 20 },
  advanced: { 30: 14, 90: 18, 180: 22 },
}

const FULL: Record<ContentIntensity, PriceRow> = {
  light:    { 30: 14, 90: 18, 180: 24 },
  standard: { 30: 16, 90: 21, 180: 27 },
  growth:   { 30: 18, 90: 24, 180: 30 },
  daily:    { 30: 20, 90: 27, 180: 34 },
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
function rowAndLabel(order: StrategyOrder): { row: PriceRow; tierLabel: string } {
  if (order.strategyType === 'paid') {
    const tier = PAID_TIER_FOR_INTENSITY[order.contentIntensity]
    return { row: PAID[tier], tierLabel: `Paid ${CAP(tier)}` }
  }
  if (order.strategyType === 'full') {
    return { row: FULL[order.contentIntensity], tierLabel: `Full ${CAP(order.contentIntensity)}` }
  }
  return { row: ORGANIC[order.contentIntensity], tierLabel: `Organic ${CAP(order.contentIntensity)}` }
}

/**
 * Compute the credit cost for a confirmed order. Pure; never mutates `order`.
 */
export function getStrategyCreditCost(order: StrategyOrder): StrategyCreditCost {
  const { row, tierLabel } = rowAndLabel(order)
  const days = resolveDays(order)
  const isCustom = order.durationPreset === 'custom'

  // ── Preset durations: direct matrix lookup ──
  if (!isCustom) {
    const bucket = order.durationPreset as '30' | '90' | '180'
    const cost = row[Number(bucket) as 30 | 90 | 180]
    return {
      cost,
      supported: true,
      tierLabel,
      durationBucket: bucket,
      pricingExplanation: `${tierLabel} · ${bucket}-day price = ${cost} credits`,
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
      pricingExplanation: `${tierLabel} · custom ${days} days = 30-day price = ${row[30]} credits`,
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
      pricingExplanation: `${tierLabel} · custom ${days} days = 30-day price +20% (ceil) = ${cost} credits`,
    }
  }
  // 61–90 → 90-day price.
  if (days <= 90) {
    return {
      cost: row[90],
      supported: true,
      tierLabel,
      durationBucket: '90',
      pricingExplanation: `${tierLabel} · custom ${days} days = 90-day price = ${row[90]} credits`,
    }
  }
  // 91–180 → 180-day price.
  return {
    cost: row[180],
    supported: true,
    tierLabel,
    durationBucket: '180',
    pricingExplanation: `${tierLabel} · custom ${days} days = 180-day price = ${row[180]} credits`,
  }
}
