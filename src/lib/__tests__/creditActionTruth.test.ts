import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { getCreditActionTruth } from '@/lib/creditActionTruth'

const CREDITS_SRC = readFileSync(path.join(process.cwd(), 'src/lib/credits.ts'), 'utf8')
const BILLING_STATUS_SRC = readFileSync(path.join(process.cwd(), 'src/app/api/billing/status/route.ts'), 'utf8')
const USER_CREDITS_SRC = readFileSync(path.join(process.cwd(), 'src/app/api/user/credits/route.ts'), 'utf8')

function canonicalCost(action: string): number {
  const match = CREDITS_SRC.match(new RegExp(`${action}:\\s*(\\d+)`))
  if (!match) throw new Error(`Missing canonical cost for ${action}`)
  return Number(match[1])
}

describe('getCreditActionTruth', () => {
  it('allows IMAGE_GENERATION when enough credits are available', () => {
    const truth = getCreditActionTruth({ action: 'IMAGE_GENERATION', creditsRemaining: 10 })
    expect(truth.cost).toBe(3)
    expect(truth.canAfford).toBe(true)
    expect(truth.lockedReason).toBeNull()
  })

  it('locks IMAGE_GENERATION at zero credits', () => {
    const truth = getCreditActionTruth({ action: 'IMAGE_GENERATION', creditsRemaining: 0 })
    expect(truth.canAfford).toBe(false)
    expect(truth.lockedReason).toBe('Add credits to generate this.')
  })

  it('locks IMAGE_GENERATION when the balance is below cost', () => {
    const truth = getCreditActionTruth({ action: 'IMAGE_GENERATION', creditsRemaining: 2 })
    expect(truth.canAfford).toBe(false)
  })

  it('allows unlimited users regardless of numeric balance', () => {
    const truth = getCreditActionTruth({ action: 'IMAGE_GENERATION', creditsRemaining: 0, isUnlimited: true })
    expect(truth.canAfford).toBe(true)
    expect(truth.lockedReason).toBeNull()
  })

  it('treats negative credits as unaffordable', () => {
    const truth = getCreditActionTruth({ action: 'IMAGE_GENERATION', creditsRemaining: -5 })
    expect(truth.canAfford).toBe(false)
  })

  it('uses the canonical CREATIVE_BRIEF cost', () => {
    const truth = getCreditActionTruth({ action: 'CREATIVE_BRIEF', creditsRemaining: 3 })
    expect(truth.cost).toBe(canonicalCost('CREATIVE_BRIEF'))
    expect(truth.canAfford).toBe(true)
  })

  it('uses the canonical CONTENT_PLAN_GENERATION cost', () => {
    const truth = getCreditActionTruth({ action: 'CONTENT_PLAN_GENERATION', creditsRemaining: 2 })
    expect(truth.cost).toBe(canonicalCost('CONTENT_PLAN_GENERATION'))
    expect(truth.canAfford).toBe(true)
  })

  it('uses the canonical RUN_FULL_STRATEGY cost', () => {
    const truth = getCreditActionTruth({ action: 'RUN_FULL_STRATEGY', creditsRemaining: 8 })
    expect(truth.cost).toBe(canonicalCost('RUN_FULL_STRATEGY'))
    expect(truth.canAfford).toBe(true)
  })

  it('keeps starter-credit display eligibility aligned across credit status APIs', () => {
    expect(BILLING_STATUS_SRC).toContain('FREE_STARTER_CREDITS')
    expect(USER_CREDITS_SRC).toContain('FREE_STARTER_CREDITS')
    expect(BILLING_STATUS_SRC).toContain('isFreeStarterEligible')
    expect(BILLING_STATUS_SRC).toContain('!isActive')
    expect(BILLING_STATUS_SRC).toContain("String(dbUser.subscriptionStatus ?? '').toUpperCase() === 'FREE'")
    expect(BILLING_STATUS_SRC).not.toContain('storedCredits === 0 && (dbUser.monthlyGenerations ?? 0) === 0\n          ? FREE_STARTER_CREDITS')
  })
})
