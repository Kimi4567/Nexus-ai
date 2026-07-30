import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/learning/page.tsx'), 'utf8')

describe('learning loading truth', () => {
  it('does not render empty or unavailable measurement claims before the first overview resolves', () => {
    expect(source).toContain('if (authLoading || (loading && !overview))')
    expect(source).toContain('WorkspaceRouteLoading')
  })
})
