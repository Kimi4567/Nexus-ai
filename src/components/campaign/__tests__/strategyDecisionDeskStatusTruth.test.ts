import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('strategy decision desk channel truth', () => {
  it('checks not_connected before the connected substring', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/campaign/StrategyDecisionDesk.tsx'),
      'utf8',
    )
    const functionSource = source.slice(
      source.indexOf('function statusCopy'),
      source.indexOf('function readField'),
    )

    expect(functionSource.indexOf("normalized.includes('not_connected')"))
      .toBeLessThan(functionSource.indexOf("normalized.includes('ready') || normalized.includes('connected')"))
    expect(functionSource).toContain("'Not connected'")
    expect(functionSource).toContain("'Execution ready'")
  })
})
