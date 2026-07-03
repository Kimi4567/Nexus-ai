import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BILLING_SRC = readFileSync(resolve(process.cwd(), 'src/app/billing/page.tsx'), 'utf8')
const STRIPE_SRC = readFileSync(resolve(process.cwd(), 'src/lib/stripe.ts'), 'utf8')

describe('billing plan copy truth', () => {
  it('describes Campaign Memory as reviewed signals, not automatic brand learning', () => {
    expect(BILLING_SRC).toContain('Campaign Memory (reviewed signals across campaigns)')
    expect(STRIPE_SRC).toContain('Campaign Memory — reviewed signals across campaigns')

    expect(BILLING_SRC).not.toContain('AI learns your brand')
    expect(STRIPE_SRC).not.toContain('AI learns your brand')
    expect(BILLING_SRC).not.toContain('تعلّم من كل حملة')
  })
})
