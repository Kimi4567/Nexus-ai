import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BILLING_SRC = readFileSync(resolve(process.cwd(), 'src/app/billing/page.tsx'), 'utf8')
const STRIPE_SRC = readFileSync(resolve(process.cwd(), 'src/lib/stripe.ts'), 'utf8')

describe('billing plan copy truth', () => {
  it('keeps two paid plans and removes duplicate or unavailable sales surfaces', () => {
    expect(BILLING_SRC).toContain('PUBLIC_PAID_PLANS')
    expect(BILLING_SRC).toContain("plan.slug === 'growth'")
    expect(BILLING_SRC).toContain("plan.slug === 'autopilot'")
    expect(BILLING_SRC).toContain('nameEn: GROWTH_PLAN.name')
    expect(BILLING_SRC).toContain('nameEn: AUTOPILOT_PLAN.name')
    expect(BILLING_SRC).not.toContain('Plan comparison')
    expect(BILLING_SRC).not.toContain('Get your referral link')
    expect(BILLING_SRC).toContain('Credit wallet')
  })

  it('describes Campaign Memory as reviewed signals, not automatic brand learning', () => {
    expect(BILLING_SRC).toContain('Campaign Memory (reviewed signals across campaigns)')
    expect(STRIPE_SRC).toContain('Campaign Memory — reviewed signals across campaigns')

    expect(BILLING_SRC).not.toContain('AI learns your brand')
    expect(STRIPE_SRC).not.toContain('AI learns your brand')
    expect(BILLING_SRC).not.toContain('تعلّم من كل حملة')
  })

  it('does not present billing as disabled while authenticated status is still loading', () => {
    expect(BILLING_SRC).toContain('setLoading(true)')
    expect(BILLING_SRC).toContain("'Checking billing status...'")
    expect(BILLING_SRC).toContain("'Checking Stripe and wallet status...'")
    expect(BILLING_SRC).toContain("{!loading && !billingStatus?.creditPurchasesEnabled && (")
    expect(BILLING_SRC).toContain('disabled={loading || !billingStatus?.creditPurchasesEnabled')
  })
})
