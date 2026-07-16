import { describe, expect, it } from 'vitest'
import {
  CREDIT_PURCHASE_POLICY,
  quoteCreditPurchase,
} from '@/lib/commercialPlans'

describe('credit wallet purchase pricing', () => {
  it('uses the margin-safe progressive schedule', () => {
    expect(quoteCreditPurchase(100)?.amountCents).toBe(9_500)
    expect(quoteCreditPurchase(300)?.amountCents).toBe(26_000)
  })

  it('prices progressive tiers without a volume cliff', () => {
    const at100 = quoteCreditPurchase(100)
    const at110 = quoteCreditPurchase(110)
    const at300 = quoteCreditPurchase(300)
    const at310 = quoteCreditPurchase(310)
    expect(at110?.amountCents).toBe((at100?.amountCents ?? 0) + 900)
    expect(at310?.amountCents).toBe((at300?.amountCents ?? 0) + 700)
  })

  it('accepts valid 5-credit increments inside the safety limits', () => {
    expect(quoteCreditPurchase(CREDIT_PURCHASE_POLICY.minimum)).toMatchObject({
      credits: 20,
      amountCents: 2_000,
      validityMonths: 12,
      pricingVersion: CREDIT_PURCHASE_POLICY.version,
    })
    expect(quoteCreditPurchase(CREDIT_PURCHASE_POLICY.maximum)?.credits).toBe(500)
  })

  it.each([0, 19, 21, 501, 10.5, 'not-a-number', null, undefined])(
    'rejects an unsafe quantity: %s',
    (value) => expect(quoteCreditPurchase(value)).toBeNull(),
  )
})
