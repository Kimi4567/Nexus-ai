import { describe, expect, it } from 'vitest'
import {
  CREDIT_PURCHASE_POLICY,
  quoteCreditPurchase,
} from '@/lib/commercialPlans'

describe('credit wallet purchase pricing', () => {
  it('preserves the original 100/$29 and 300/$69 reference points', () => {
    expect(quoteCreditPurchase(100)?.amountCents).toBe(2_900)
    expect(quoteCreditPurchase(300)?.amountCents).toBe(6_900)
  })

  it('prices progressive tiers without a volume cliff', () => {
    const at100 = quoteCreditPurchase(100)
    const at110 = quoteCreditPurchase(110)
    const at300 = quoteCreditPurchase(300)
    const at310 = quoteCreditPurchase(310)
    expect(at110?.amountCents).toBe((at100?.amountCents ?? 0) + 200)
    expect(at310?.amountCents).toBe((at300?.amountCents ?? 0) + 170)
  })

  it('accepts every valid 10-credit increment inside the safety limits', () => {
    expect(quoteCreditPurchase(CREDIT_PURCHASE_POLICY.minimum)).toMatchObject({
      credits: 50,
      amountCents: 1_450,
      validityMonths: 12,
      pricingVersion: CREDIT_PURCHASE_POLICY.version,
    })
    expect(quoteCreditPurchase(CREDIT_PURCHASE_POLICY.maximum)?.credits).toBe(5_000)
  })

  it.each([0, 49, 51, 5_001, 10.5, 'not-a-number', null, undefined])(
    'rejects an unsafe quantity: %s',
    (value) => expect(quoteCreditPurchase(value)).toBeNull(),
  )
})
