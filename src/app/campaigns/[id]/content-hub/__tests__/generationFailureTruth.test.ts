import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

describe('Content Hub — generation failure truth', () => {
  it('keeps the persisted production failure visible on the affected post', () => {
    expect(SRC).toMatch(/errorMessage: string \| null/)
    expect(SRC).toMatch(/post\.errorMessage/)
    expect(SRC).toMatch(/Media production did not complete/)
  })

  it('does not claim a refund is final while reconciliation may still be pending', () => {
    expect(SRC).toMatch(/Credit restoration is being reconciled/)
    expect(SRC).toMatch(/Check Credit History for the final settlement before retrying/)
  })
})
