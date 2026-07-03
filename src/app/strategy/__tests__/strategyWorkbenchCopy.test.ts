import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/app/strategy/page.tsx', 'utf8')

describe('/strategy workbench source-of-truth copy', () => {
  it('frames the page as a workbench and points to the campaign brief for full strategy review', () => {
    expect(source).toContain('Strategy Workbench')
    expect(source).toContain('Campaign strategy brief')
    expect(source).toContain('The full strategy brief lives inside the campaign')
    expect(source).toContain('The full strategy brief, assumptions, limits, and execution decisions live inside the campaign page.')
    expect(source).toContain('Open full brief')
  })

  it('keeps Content Hub actions scoped to the active campaign when a recent campaign exists', () => {
    expect(source).toContain("const recentContentHubHref = recent?.id ? `/campaigns/${recent.id}/content-hub` : '/content-hub'")
    expect(source).toContain('href={recentContentHubHref}')
    expect(source).toContain('Open campaign Content Hub')
  })

  it('keeps strategy update copy tied to cost review before credits are spent', () => {
    expect(source).toContain('Update strategy after cost review')
    expect(source).not.toContain('Run updated strategy')
  })

  it('warns when the existing strategy draft does not match the current Brand Brain', () => {
    expect(source).toContain('Existing draft may not match current Brand Brain')
    expect(source).toContain('Update strategy for current Brand Brain')
    expect(source).toContain('this draft does not appear to match')
    expect(source).toContain('Do not use the old draft direction for the new brand')
  })
})
