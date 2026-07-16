import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('new campaign route', () => {
  it('opens the canonical strategy request instead of silently landing on the portfolio', () => {
    const route = readFileSync(path.join(process.cwd(), 'src/app/campaigns/new/page.tsx'), 'utf8')
    const strategy = readFileSync(path.join(process.cwd(), 'src/app/strategy/page.tsx'), 'utf8')

    expect(route).toContain("redirect('/strategy?request=new')")
    expect(strategy).toContain("get('request')")
    expect(strategy).toContain("setRunStrategyOpen(true)")
  })
})
