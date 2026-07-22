import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const loadingRoutes = [
  'src/app/loading.tsx',
  'src/app/agency/loading.tsx',
  'src/app/billing/loading.tsx',
  'src/app/brand/loading.tsx',
  'src/app/calendar/loading.tsx',
  'src/app/campaigns/loading.tsx',
  'src/app/dashboard/loading.tsx',
  'src/app/imports/loading.tsx',
  'src/app/media/loading.tsx',
  'src/app/schedule/loading.tsx',
  'src/app/settings/loading.tsx',
  'src/app/strategy/loading.tsx',
  'src/app/templates/loading.tsx',
]

describe('authenticated workspace loading contract', () => {
  it.each(loadingRoutes)('%s uses the shared NEXUS workspace state', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')

    expect(source).toContain('WorkspaceRouteLoading')
    expect(source).not.toContain('Loading Nexus...')
    expect(source).not.toContain('#FF9500')
  })

  it('explains that loading never performs marketing actions', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/WorkspaceRouteLoading.tsx'),
      'utf8',
    )
    const styles = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

    expect(source).toContain('من دون إنشاء محتوى أو تنفيذ أي إجراء')
    expect(source).toContain('without generating content or taking any action')
    expect(source).toContain('aria-busy="true"')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
