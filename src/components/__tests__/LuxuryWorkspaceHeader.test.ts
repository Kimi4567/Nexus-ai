import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'src/components/LuxuryWorkspaceHeader.tsx'), 'utf8')

describe('LuxuryWorkspaceHeader responsive contract', () => {
  it('keeps page identity and actions compact at ordinary workspace widths', () => {
    expect(source).toContain('sm:flex-row sm:items-end sm:justify-between')
    expect(source).toContain("ar ? 'مساحة عمل NEXUS' : 'NEXUS workspace'")
    expect(source).not.toContain('Search in Nexus')
    expect(source).not.toContain('Notifications and analytics')
    expect(source).not.toContain('useAuth')
  })
})
