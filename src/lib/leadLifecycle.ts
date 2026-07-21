export const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'NURTURING',
  'OPPORTUNITY',
  'WON',
  'LOST',
  'DISQUALIFIED',
] as const

export const LEAD_SOURCES = [
  'MANUAL',
  'FORM',
  'IMPORT',
  'SOCIAL',
  'PAID_AD',
  'REFERRAL',
  'OTHER',
] as const

export const LEAD_CONSENT_STATUSES = ['UNKNOWN', 'GRANTED', 'DENIED', 'REVOKED'] as const
export const LEAD_TASK_STATUSES = ['OPEN', 'COMPLETED', 'CANCELLED'] as const
export const LEAD_TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export const LEAD_CAPTURE_FORM_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const

export type LeadStage = typeof LEAD_STAGES[number]
export type LeadSource = typeof LEAD_SOURCES[number]
export type LeadConsentStatus = typeof LEAD_CONSENT_STATUSES[number]
export type LeadTaskStatus = typeof LEAD_TASK_STATUSES[number]
export type LeadTaskPriority = typeof LEAD_TASK_PRIORITIES[number]
export type LeadCaptureFormStatus = typeof LEAD_CAPTURE_FORM_STATUSES[number]

const STAGE_TRANSITIONS: Record<LeadStage, readonly LeadStage[]> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'NURTURING', 'OPPORTUNITY', 'LOST', 'DISQUALIFIED'],
  QUALIFIED: ['CONTACTED', 'NURTURING', 'OPPORTUNITY', 'LOST', 'DISQUALIFIED'],
  NURTURING: ['CONTACTED', 'QUALIFIED', 'OPPORTUNITY', 'LOST', 'DISQUALIFIED'],
  OPPORTUNITY: ['NURTURING', 'WON', 'LOST'],
  WON: ['OPPORTUNITY'],
  LOST: ['NEW', 'CONTACTED', 'QUALIFIED', 'NURTURING', 'OPPORTUNITY'],
  DISQUALIFIED: ['NEW', 'CONTACTED'],
}

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === 'string' && (LEAD_STAGES as readonly string[]).includes(value)
}

export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === 'string' && (LEAD_SOURCES as readonly string[]).includes(value)
}

export function isLeadConsentStatus(value: unknown): value is LeadConsentStatus {
  return typeof value === 'string' && (LEAD_CONSENT_STATUSES as readonly string[]).includes(value)
}

export function isLeadTaskStatus(value: unknown): value is LeadTaskStatus {
  return typeof value === 'string' && (LEAD_TASK_STATUSES as readonly string[]).includes(value)
}

export function isLeadTaskPriority(value: unknown): value is LeadTaskPriority {
  return typeof value === 'string' && (LEAD_TASK_PRIORITIES as readonly string[]).includes(value)
}

export function isLeadCaptureFormStatus(value: unknown): value is LeadCaptureFormStatus {
  return typeof value === 'string' && (LEAD_CAPTURE_FORM_STATUSES as readonly string[]).includes(value)
}

export function canTransitionLeadStage(from: LeadStage, to: LeadStage): boolean {
  return from === to || STAGE_TRANSITIONS[from].includes(to)
}

export function leadStageTransitionOptions(from: LeadStage): readonly LeadStage[] {
  return [from, ...STAGE_TRANSITIONS[from]]
}

export function normalizeLeadEmail(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim().toLowerCase()
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  return normalized
}

export function normalizeLeadPhone(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return `${trimmed.startsWith('+') ? '+' : ''}${digits}`
}

export function sanitizeLeadAttribution(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const allowed = ['source', 'medium', 'campaign', 'content', 'term', 'landingPage', 'referrer']
  return Object.fromEntries(allowed.flatMap(key => {
    const item = source[key]
    return typeof item === 'string' && item.trim()
      ? [[key, item.trim().slice(0, 500)]]
      : []
  }))
}

const CONTACTED_STAGES = new Set<LeadStage>([
  'CONTACTED',
  'QUALIFIED',
  'NURTURING',
  'OPPORTUNITY',
  'WON',
])

export function stageProvidesContactEvidence(stage: LeadStage): boolean {
  return CONTACTED_STAGES.has(stage)
}

export function calculateLeadResponseDueAt(from: Date, hours = 24): Date {
  const safeHours = Number.isFinite(hours) ? Math.min(168, Math.max(1, Math.floor(hours))) : 24
  return new Date(from.getTime() + safeHours * 60 * 60_000)
}

export function isLeadResponseOverdue(input: {
  stage: LeadStage
  firstContactedAt?: Date | string | null
  responseDueAt?: Date | string | null
}, now = new Date()): boolean {
  if (input.firstContactedAt || ['WON', 'LOST', 'DISQUALIFIED'].includes(input.stage)) return false
  if (!input.responseDueAt) return false
  const dueAt = new Date(input.responseDueAt)
  return Number.isFinite(dueAt.getTime()) && dueAt.getTime() < now.getTime()
}
