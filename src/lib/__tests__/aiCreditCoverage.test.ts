import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const API_ROOT = path.join(process.cwd(), 'src/app/api')
const PROVIDER_MARKERS = ['api.openai.com', 'fal.run/fal-ai']

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(absolute)
    return entry.name === 'route.ts' ? [absolute] : []
  })
}

function source(file: string): string {
  return readFileSync(file, 'utf8')
}

function relative(file: string): string {
  return path.relative(process.cwd(), file)
}

const directProviderRoutes = routeFiles(API_ROOT).filter((file) =>
  PROVIDER_MARKERS.some((marker) => source(file).includes(marker)),
)

const indirectProviderRoutes = [
  'src/app/api/generate/route.ts',
  'src/app/api/generate/preview/route.ts',
  'src/app/api/agents/run/route.ts',
  'src/app/api/strategy/run-full/route.ts',
  'src/app/api/campaigns/[id]/engine/route.ts',
  'src/app/api/campaigns/[id]/creative-brief/route.ts',
  'src/app/api/campaigns/[id]/sentinel-review/route.ts',
  'src/app/api/visuals/generate/route.ts',
].map((file) => path.join(process.cwd(), file))

describe('AI provider credit coverage', () => {
  it('keeps every direct provider route behind the unified credit deduction and refund contract', () => {
    expect(directProviderRoutes.length).toBeGreaterThan(10)
    for (const file of directProviderRoutes) {
      const routeSource = source(file)
      expect(routeSource, `${relative(file)} must charge before provider work`).toContain('checkAndDeductCredits')
      expect(routeSource, `${relative(file)} must refund failed provider work`).toMatch(/refundCredit/)
    }
  })

  it('keeps known indirect provider entrypoints metered and refundable', () => {
    for (const file of indirectProviderRoutes) {
      const routeSource = source(file)
      expect(routeSource, `${relative(file)} must charge before delegated AI work`).toContain('checkAndDeductCredits')
      expect(routeSource, `${relative(file)} must refund failed delegated AI work`).toMatch(/refundCredit/)
    }
  })

  it('returns a user-displayable charge receipt from every interactive provider route', () => {
    const interactiveRoutes = [...directProviderRoutes, ...indirectProviderRoutes]
      .filter((file, index, all) => all.indexOf(file) === index)
      .filter((file) => !relative(file).includes('/api/cron/'))

    for (const file of interactiveRoutes) {
      const routeSource = source(file)
      expect(
        /creditCharges?|buildCreditChargeReceipt|X-Nexus-Credit/.test(routeSource),
        `${relative(file)} must expose what was charged and why`,
      ).toBe(true)
    }
  })
})
