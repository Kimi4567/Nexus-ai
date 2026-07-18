import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/app/api/agents/suggestions/[id]/route.ts'),
  'utf8',
)

describe('agent suggestion live Brand Brain gate', () => {
  it('allows rejection and safety pauses while blocking other derived approvals', () => {
    expect(source).toContain("if (action === 'reject')")
    expect(source).toContain("suggestion.type !== 'CAMPAIGN_PAUSE'")
    expect(source).toContain('reviewBrandTruthConsistency(brandProfile)')
    expect(source).toContain("error: 'BRAND_TRUTH_CONFLICT'")
    expect(source).toContain('{ status: 409 }')
  })

  it('never records execution-monitor navigation as an approval', () => {
    expect(source).toContain("if (suggestionSource === 'execution-monitor')")
    expect(source).toContain("status: 'NAVIGATION_ONLY'")
    expect(source).toContain('executed: false')
    expect(source).toContain('cannot be approved as completed work')
  })
})
