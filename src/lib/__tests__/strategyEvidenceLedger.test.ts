import { describe, expect, it } from 'vitest'
import {
  buildStrategyEvidenceLedger,
  normalizeStrategyEvidenceLedger,
} from '@/lib/strategy/strategyEvidenceLedger'

describe('strategy evidence ledger', () => {
  it('parses source-linked proof without asking the model for provenance', () => {
    expect(buildStrategyEvidenceLedger([
      'Nexus is ISO certified. [Source: certificate.pdf — Page 4]',
    ])).toEqual([{
      statement: 'Nexus is ISO certified.',
      status: 'source_linked',
      sourceName: 'certificate.pdf',
      sourceLocator: 'Page 4',
    }])
  })

  it('labels manual Brand Brain proof honestly and removes duplicates', () => {
    expect(buildStrategyEvidenceLedger([
      'Founder-confirmed same-day response process',
      ' Founder-confirmed same-day response process ',
    ])).toEqual([{
      statement: 'Founder-confirmed same-day response process',
      status: 'brand_brain_entry',
      sourceName: null,
      sourceLocator: null,
    }])
  })

  it('rejects malformed persisted entries and cannot upgrade a manual entry', () => {
    expect(normalizeStrategyEvidenceLedger([
      null,
      { statement: '' },
      { statement: 'Manual claim', status: 'invented', sourceName: 'fake.pdf' },
    ])).toEqual([{
      statement: 'Manual claim',
      status: 'brand_brain_entry',
      sourceName: null,
      sourceLocator: null,
    }])
  })
})
