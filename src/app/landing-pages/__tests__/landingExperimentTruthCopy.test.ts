import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const panel = readFileSync(join(process.cwd(), 'src/components/landing-pages/LandingExperimentPanel.tsx'), 'utf8')

describe('landing experiment truth copy', () => {
  it('separates reported denominators from confirmed form evidence', () => {
    expect(panel).toContain('Views and clicks are browser signals. Only form intake is server-confirmed')
    expect(panel).toContain('Descriptive rate')
    expect(panel).toContain('not a significance test')
  })

  it('requires human review and never labels an automatic winner', () => {
    expect(panel).toContain('Human decision after minimum evidence')
    expect(panel).toContain('No statistical winner is claimed')
    expect(panel).toContain('Prepare challenger draft')
    expect(panel).not.toContain('Publish winner')
  })
})
