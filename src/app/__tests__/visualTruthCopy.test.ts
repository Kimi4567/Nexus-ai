import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('visual audit truth-copy regressions', () => {
  it('does not explain a live maturity score with a stale hardcoded number', () => {
    const scoreHistory = source('src/app/brand/score-history/page.tsx')

    expect(scoreHistory).not.toMatch(/read 45|يكون 45/)
    expect(scoreHistory).toContain('it can differ from completeness')
  })

  it('describes campaign content without downgrading scheduled records to drafts', () => {
    const campaign = source('src/app/campaigns/[id]/page.tsx')

    expect(campaign).not.toContain('planned or draft post records')
    expect(campaign).not.toContain('محتوى مخطط أو مسودات')
    expect(campaign).toContain('This campaign has content records')
  })

  it('describes provider disconnect as credential clearing with a retained audit record', () => {
    const deletion = source('src/app/data-deletion/page.tsx')

    expect(deletion).not.toContain('removes the stored integration record')
    expect(deletion).toContain('keeps a sanitized disconnect audit record without access or refresh tokens')
  })
})
