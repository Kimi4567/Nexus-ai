import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('product truth language', () => {
  it('does not claim an always-on system when the persisted monitor may not have started', () => {
    const landing = read('src/app/page.tsx')
    const sidebar = read('src/components/Sidebar.tsx')
    const operations = read('src/components/operations/OperationsCenterPage.tsx')

    expect(landing).toContain('A marketing department you direct.')
    expect(landing).not.toContain('An always-on marketing department.')
    expect(sidebar).not.toContain("badgeKey: '24/7'")
    expect(operations).toContain('Scheduled execution monitor')
    expect(operations).toContain('No heartbeat is stored yet, so it is not presented as active.')
  })

  it('separates saved account identity from provider-evidenced publishing readiness', () => {
    const dashboard = read('src/app/dashboard/page.tsx')
    const operations = read('src/components/operations/OperationsCenterPage.tsx')

    expect(dashboard).toContain('derivePlatformReadiness(data.accounts)')
    expect(dashboard).toContain('identities saved')
    expect(dashboard).toContain('publish-ready')
    expect(operations).toContain('Stored sessions')
    expect(operations).not.toContain("title: copy('اتصالات النشر والإعلانات', 'Publishing and ads connections')")
  })

  it('makes stale competitor context visible after Brand Brain identity changes', () => {
    const brand = read('src/app/brand/page.tsx')
    const competitors = read('src/app/brand/competitors/page.tsx')

    expect(brand).toContain('competitor monitor(s) paused after the brand identity changed')
    expect(competitors).toContain('Brand Brain identity changed — old monitoring is safely paused')
    expect(competitors).toContain('Confirm as a competitor for the current brand')
    expect(competitors).toContain('Archived from a previous Brand Brain')
  })
})
