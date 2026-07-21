import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const rootLayout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
const homePage = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8')

describe('structured-data scope', () => {
  it('keeps the NEXUS SoftwareApplication claim on the home page, not every customer route', () => {
    expect(homePage).toContain("'@type': 'SoftwareApplication'")
    expect(homePage).toContain('application/ld+json')
    expect(rootLayout).not.toContain("'@type': 'SoftwareApplication'")
    expect(rootLayout).not.toContain('application/ld+json')
  })
})
