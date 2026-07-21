import { describe, expect, it } from 'vitest'
import { MAX_LEAD_CSV_ROWS, parseLeadCsv } from '@/lib/leadCsvImport'

describe('lead CSV import parser', () => {
  it('parses quoted fields, normalizes contacts, and keeps allowed attribution only', () => {
    const result = parseLeadCsv([
      'full_name,email,phone,company,consent_status,consent_source,utm_source,utm_medium',
      '"Doe, Jane", JANE@Example.com ,+971 50 123 4567,"Acme, Inc",GRANTED,Webinar checkbox,linkedin,social',
    ].join('\n'))

    expect(result.issues).toEqual([])
    expect(result.rows).toEqual([expect.objectContaining({
      rowNumber: 2,
      fullName: 'Doe, Jane',
      emailNormalized: 'jane@example.com',
      phoneNormalized: '+971501234567',
      company: 'Acme, Inc',
      consentStatus: 'GRANTED',
      consentSource: 'Webinar checkbox',
      attribution: { source: 'linkedin', medium: 'social' },
    })])
  })

  it('rejects inferred consent, malformed contacts, and duplicates inside the file', () => {
    const result = parseLeadCsv([
      'email,phone,consent_status,consent_source',
      'same@example.com,,GRANTED,',
      'not-an-email,,,',
      'same@example.com,,UNKNOWN,',
      'same@example.com,,UNKNOWN,',
    ].join('\n'))

    expect(result.rows).toHaveLength(1)
    expect(result.issues.map(issue => issue.code)).toEqual([
      'CONSENT_EVIDENCE_REQUIRED',
      'INVALID_CONTACT',
      'DUPLICATE_IN_FILE',
    ])
  })

  it('rejects files beyond the bounded import size', () => {
    const lines = ['email', ...Array.from({ length: MAX_LEAD_CSV_ROWS + 1 }, (_, index) => `person${index}@example.com`)]
    expect(() => parseLeadCsv(lines.join('\n'))).toThrow(`at most ${MAX_LEAD_CSV_ROWS}`)
  })
})
