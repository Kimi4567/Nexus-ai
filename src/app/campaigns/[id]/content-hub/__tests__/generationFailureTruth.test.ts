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

  it('closes the paid consent modal after a terminal job failure', () => {
    expect(SRC).toMatch(/err instanceof GeneratedVisualTerminalError/)
    expect(SRC).toMatch(/setImageGenerationConfirmPostId\(null\)/)
    expect(SRC).toMatch(/Promise\.all\(\[loadData\(\), refreshBillingStatus\(\)\]\)/)
  })

  it('keeps a synchronous Motion Design rejection visible inside its open modal', () => {
    expect(SRC).toMatch(/data\.code === 'MOTION_DESIGN_QUALITY_REJECTED'/)
    expect(SRC).toMatch(/Credits were restored\./)
    expect(SRC).toMatch(/role="alert" className="mt-4 rounded-xl border border-rose-200/)
  })

  it('shows and disables the per-post image action when daily capacity is exhausted', () => {
    expect(SRC).toMatch(/imageDailyCapReached=\{imageDailyCapReached\}/)
    expect(SRC).toMatch(/imageDailyCapReachedLabel=\{imageDailyCapReachedLabel\}/)
    expect(SRC).toMatch(/disabled=\{isGeneratingImage \|\| creditRestorationPending \|\| imageGenerationBlockedByTruthReview \|\| imageDailyCapReached\}/)
    expect(SRC).toMatch(/imageDailyCapReached \? imageDailyCapReachedLabel/)
    expect(SRC).toMatch(/اكتمل حد الصور اليومي/)
  })
})
