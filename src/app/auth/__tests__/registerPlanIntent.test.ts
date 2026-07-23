import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const registerSource = readFileSync('src/app/auth/register/page.tsx', 'utf8')

describe('registration plan intent', () => {
  it('preserves the pricing CTA context without claiming a charge or subscription', () => {
    expect(registerSource).toContain("getPublicPaidPlan(params.get('plan'))")
    expect(registerSource).toContain('does not activate a subscription or charge')
    expect(registerSource).toContain('ولا يفعّل اشتراكاً أو خصماً')
  })
})
