import {
  isLeadConsentStatus,
  normalizeLeadEmail,
  normalizeLeadPhone,
  sanitizeLeadAttribution,
  type LeadConsentStatus,
} from '@/lib/leadLifecycle'

export const MAX_LEAD_CSV_BYTES = 256 * 1024
export const MAX_LEAD_CSV_ROWS = 200

type CanonicalHeader =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'company'
  | 'jobTitle'
  | 'sourceDetail'
  | 'consentStatus'
  | 'consentSource'
  | 'utmSource'
  | 'utmMedium'
  | 'utmCampaign'
  | 'utmContent'
  | 'utmTerm'

export interface ParsedLeadCsvRow {
  rowNumber: number
  fullName: string | null
  email: string | null
  emailNormalized: string | null
  phone: string | null
  phoneNormalized: string | null
  company: string | null
  jobTitle: string | null
  sourceDetail: string | null
  consentStatus: LeadConsentStatus
  consentSource: string | null
  attribution: Record<string, string>
}

export interface LeadCsvIssue {
  rowNumber: number
  code: 'INVALID_CONTACT' | 'INVALID_CONSENT' | 'CONSENT_EVIDENCE_REQUIRED' | 'DUPLICATE_IN_FILE' | 'DUPLICATE_IN_WORKSPACE'
  message: string
}

const HEADER_ALIASES: Record<string, CanonicalHeader> = {
  name: 'fullName',
  full_name: 'fullName',
  fullname: 'fullName',
  email: 'email',
  email_address: 'email',
  phone: 'phone',
  mobile: 'phone',
  mobile_number: 'phone',
  company: 'company',
  company_name: 'company',
  job_title: 'jobTitle',
  title: 'jobTitle',
  source_detail: 'sourceDetail',
  source: 'sourceDetail',
  consent_status: 'consentStatus',
  consent_source: 'consentSource',
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
}

function parseCsvMatrix(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
      continue
    }

    if (character === '"') {
      if (cell) throw new Error('CSV contains an unexpected quote')
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some(value => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field')
  row.push(cell)
  if (row.some(value => value.trim())) rows.push(row)
  return rows
}

function clean(value: string | undefined, max: number): string | null {
  if (!value?.trim()) return null
  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
  return normalized ? normalized.slice(0, max) : null
}

export function parseLeadCsv(csv: string): { rows: ParsedLeadCsvRow[]; issues: LeadCsvIssue[] } {
  if (typeof csv !== 'string' || !csv.trim()) throw new Error('CSV content is required')
  if (Buffer.byteLength(csv, 'utf8') > MAX_LEAD_CSV_BYTES) {
    throw new Error(`CSV must be ${MAX_LEAD_CSV_BYTES / 1024}KB or smaller`)
  }

  const matrix = parseCsvMatrix(csv.replace(/^\uFEFF/, ''))
  if (matrix.length < 2) throw new Error('CSV must contain a header and at least one data row')
  if (matrix.length - 1 > MAX_LEAD_CSV_ROWS) throw new Error(`CSV supports at most ${MAX_LEAD_CSV_ROWS} data rows`)

  const headers = matrix[0].map(value => HEADER_ALIASES[value.trim().toLowerCase()] ?? null)
  if (!headers.includes('email') && !headers.includes('phone')) {
    throw new Error('CSV requires an email or phone column')
  }

  const issues: LeadCsvIssue[] = []
  const rows: ParsedLeadCsvRow[] = []
  const seen = new Set<string>()

  for (let index = 1; index < matrix.length; index += 1) {
    const values = Object.fromEntries(headers.flatMap((header, columnIndex) => (
      header ? [[header, matrix[index][columnIndex] ?? '']] : []
    ))) as Partial<Record<CanonicalHeader, string>>
    const rowNumber = index + 1
    const email = clean(values.email, 254)
    const phone = clean(values.phone, 40)
    const emailNormalized = normalizeLeadEmail(email)
    const phoneNormalized = normalizeLeadPhone(phone)
    if ((email && !emailNormalized) || (phone && !phoneNormalized) || (!emailNormalized && !phoneNormalized)) {
      issues.push({ rowNumber, code: 'INVALID_CONTACT', message: 'A valid email or phone is required.' })
      continue
    }

    const consentValue = clean(values.consentStatus, 30)?.toUpperCase() ?? 'UNKNOWN'
    if (!isLeadConsentStatus(consentValue)) {
      issues.push({ rowNumber, code: 'INVALID_CONSENT', message: 'Consent status must be UNKNOWN, GRANTED, DENIED, or REVOKED.' })
      continue
    }
    const consentSource = clean(values.consentSource, 160)
    if (consentValue === 'GRANTED' && !consentSource) {
      issues.push({ rowNumber, code: 'CONSENT_EVIDENCE_REQUIRED', message: 'Granted consent requires a consent source.' })
      continue
    }

    const dedupeKeys = [emailNormalized ? `email:${emailNormalized}` : null, phoneNormalized ? `phone:${phoneNormalized}` : null].filter(Boolean) as string[]
    if (dedupeKeys.some(key => seen.has(key))) {
      issues.push({ rowNumber, code: 'DUPLICATE_IN_FILE', message: 'This contact appears more than once in the CSV.' })
      continue
    }
    dedupeKeys.forEach(key => seen.add(key))

    rows.push({
      rowNumber,
      fullName: clean(values.fullName, 140),
      email,
      emailNormalized,
      phone,
      phoneNormalized,
      company: clean(values.company, 140),
      jobTitle: clean(values.jobTitle, 140),
      sourceDetail: clean(values.sourceDetail, 200),
      consentStatus: consentValue,
      consentSource,
      attribution: sanitizeLeadAttribution({
        source: values.utmSource,
        medium: values.utmMedium,
        campaign: values.utmCampaign,
        content: values.utmContent,
        term: values.utmTerm,
      }),
    })
  }

  return { rows, issues }
}
