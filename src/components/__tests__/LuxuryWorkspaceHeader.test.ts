import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'src/components/LuxuryWorkspaceHeader.tsx'), 'utf8')

describe('LuxuryWorkspaceHeader responsive contract', () => {
  it('keeps desktop controls stacked until the workspace has enough room beside the sidebar', () => {
    expect(source).toContain('min-[1400px]:flex-row')
    expect(source).toContain('min-[1400px]:max-w-3xl')
    expect(source).not.toContain('lg:max-w-3xl lg:flex-row')
  })
})
