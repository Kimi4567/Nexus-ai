import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const protectedRoutes = [
  'src/app/campaigns/[id]/content-hub/page.tsx',
  'src/app/campaigns/[id]/paid-launch/page.tsx',
  'src/app/paid-campaigns/page.tsx',
  'src/app/paid-campaigns/[id]/page.tsx',
]

describe('protected marketing route contract', () => {
  it.each(protectedRoutes)('%s resolves signed-out visits to login', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')

    expect(source).toContain("router.replace('/auth/login')")
    expect(source).toContain('!authLoading && !isAuthenticated')
  })

  it('does not leave campaign production in a permanent loading state when signed out', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
      'utf8',
    )

    expect(source).toContain('if (!authLoading && !isAuthenticated) return null')
    expect(source).toContain('if (authLoading || loading)')
  })
})
