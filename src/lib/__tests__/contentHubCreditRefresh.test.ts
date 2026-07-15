import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const contentHubSource = readFileSync(
  path.join(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

const visualGeneratorSource = readFileSync(
  path.join(process.cwd(), 'src/components/VisualGenerator.tsx'),
  'utf8',
)

describe('paid action credit balance refresh', () => {
  it('refreshes Content Hub billing status after successful paid actions', () => {
    expect(contentHubSource).toContain('invalidate: refreshBillingStatus')

    const refreshCalls = contentHubSource.match(/await refreshBillingStatus\(\)/g) ?? []
    expect(refreshCalls.length).toBeGreaterThanOrEqual(4)

    expect(contentHubSource).toContain('async function generatePlan')
    expect(contentHubSource).toContain('async function generateAllImages')
    expect(contentHubSource).toContain('async function rewritePost')
    expect(contentHubSource).toContain('async function generatePostImage')
  })

  it('refreshes campaign concept visual billing status after generation', () => {
    expect(visualGeneratorSource).toContain('invalidate: refreshBillingStatus')
    expect(visualGeneratorSource).toContain('await refreshBillingStatus()')
    expect(visualGeneratorSource).toContain("fetchCreditOperation(operationScope, '/api/visuals/generate'")
  })
})
