export type DashboardLocale = 'en' | 'ar'

export interface DashboardPostLike {
  status?: string | null
  publishMode?: string | null
  manuallyPublishedAt?: string | Date | null
  platformPostId?: string | null
  platformUrl?: string | null
  analyticsData?: unknown
  analyticsFetched?: boolean | null
}

export interface DashboardPostSummary {
  draft: number
  approved: number
  scheduled: number
  published: number
  manuallyPublished: number
  platformPublished: number
  analyticsReady: number
}

export interface DashboardStatusCopy {
  label: string
  labelAr: string
  color: string
  pulse: boolean
}

const EMPTY_SUMMARY: DashboardPostSummary = {
  draft: 0,
  approved: 0,
  scheduled: 0,
  published: 0,
  manuallyPublished: 0,
  platformPublished: 0,
  analyticsReady: 0,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function hasValidDate(value: string | Date | null | undefined): boolean {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime())
}

function isAutoPublished(post: DashboardPostLike): boolean {
  return (
    String(post.publishMode ?? '').toUpperCase() === 'AUTO' ||
    Boolean(post.platformPostId || post.platformUrl)
  )
}

function hasAnalytics(post: DashboardPostLike): boolean {
  return Boolean(post.analyticsFetched || isRecord(post.analyticsData))
}

function n(value: number | null | undefined): number {
  return Math.max(0, Math.trunc(value ?? 0))
}

export function emptyDashboardPostSummary(): DashboardPostSummary {
  return { ...EMPTY_SUMMARY }
}

export function summarizeDashboardPosts(posts: DashboardPostLike[]): DashboardPostSummary {
  const summary = emptyDashboardPostSummary()

  for (const post of posts) {
    const status = String(post.status ?? '').toUpperCase()
    if (status === 'DRAFT') summary.draft += 1
    if (status === 'APPROVED') summary.approved += 1
    if (status === 'SCHEDULED') summary.scheduled += 1
    if (status === 'PUBLISHED') {
      summary.published += 1
      if (isAutoPublished(post)) summary.platformPublished += 1
      else if (hasValidDate(post.manuallyPublishedAt) || String(post.publishMode ?? '').toUpperCase() !== 'AUTO') {
        summary.manuallyPublished += 1
      }
      if (hasAnalytics(post)) summary.analyticsReady += 1
    }
  }

  return summary
}

export function normalizeDashboardPostSummary(summary?: Partial<DashboardPostSummary> | null): DashboardPostSummary {
  return {
    draft: n(summary?.draft),
    approved: n(summary?.approved),
    scheduled: n(summary?.scheduled),
    published: n(summary?.published),
    manuallyPublished: n(summary?.manuallyPublished),
    platformPublished: n(summary?.platformPublished),
    analyticsReady: n(summary?.analyticsReady),
  }
}

export function hasDashboardPostProgress(summary?: Partial<DashboardPostSummary> | null): boolean {
  const s = normalizeDashboardPostSummary(summary)
  return s.draft + s.approved + s.scheduled + s.published > 0
}

export function getDashboardCampaignStatusCopy(
  summary: Partial<DashboardPostSummary> | null | undefined,
  fallbackStatus: string
): DashboardStatusCopy {
  const s = normalizeDashboardPostSummary(summary)

  if (s.manuallyPublished > 0 && s.scheduled > 0) {
    return {
      label: `${s.manuallyPublished} manually published · ${s.scheduled} scheduled`,
      labelAr: `${s.manuallyPublished} منشور تم تأكيد نشره يدويًا · ${s.scheduled} مجدولة`,
      color: '#0F766E',
      pulse: false,
    }
  }
  if (s.manuallyPublished > 0) {
    return {
      label: `${s.manuallyPublished} manually published`,
      labelAr: `${s.manuallyPublished} منشور تم تأكيد نشره يدويًا`,
      color: '#0F766E',
      pulse: false,
    }
  }
  if (s.platformPublished > 0 && s.scheduled > 0) {
    return {
      label: `${s.platformPublished} platform published · ${s.scheduled} scheduled`,
      labelAr: `${s.platformPublished} منشور عبر منصة · ${s.scheduled} مجدولة`,
      color: '#059669',
      pulse: false,
    }
  }
  if (s.platformPublished > 0) {
    return {
      label: `${s.platformPublished} platform published`,
      labelAr: `${s.platformPublished} منشور عبر منصة`,
      color: '#059669',
      pulse: false,
    }
  }
  if (s.scheduled > 0) {
    return {
      label: `${s.scheduled} scheduled · not published`,
      labelAr: `${s.scheduled} مجدولة · غير منشورة`,
      color: '#D97706',
      pulse: false,
    }
  }
  if (s.approved > 0) {
    return {
      label: `${s.approved} approved · not scheduled`,
      labelAr: `${s.approved} معتمدة · غير مجدولة`,
      color: '#5E5CE6',
      pulse: false,
    }
  }
  if (s.draft > 0) {
    return {
      label: `${s.draft} drafts to review`,
      labelAr: `${s.draft} مسودات للمراجعة`,
      color: '#64748B',
      pulse: false,
    }
  }

  const status = String(fallbackStatus || 'DRAFT').toUpperCase()
  const fallback: Record<string, DashboardStatusCopy> = {
    DRAFT: { label: 'Draft', labelAr: 'مسودة', color: '#64748B', pulse: false },
    ACTIVE: { label: 'Active', labelAr: 'نشطة', color: '#10B981', pulse: true },
    PAUSED: { label: 'Paused', labelAr: 'متوقفة', color: '#EAB308', pulse: false },
    COMPLETED: { label: 'Completed', labelAr: 'مكتملة', color: '#06B6D4', pulse: false },
    ARCHIVED: { label: 'Archived', labelAr: 'مؤرشفة', color: '#374151', pulse: false },
  }
  return fallback[status] ?? fallback.DRAFT
}

export function getDashboardExecutionCopy(summary: Partial<DashboardPostSummary>): DashboardStatusCopy {
  const s = normalizeDashboardPostSummary(summary)
  return getDashboardCampaignStatusCopy(s, 'DRAFT')
}

export function getDashboardLearningCopy(summary: Partial<DashboardPostSummary>): {
  value: string
  valueAr: string
  severity: 'good' | 'watch' | 'risk'
  loopComplete: boolean
} {
  const s = normalizeDashboardPostSummary(summary)
  if (s.analyticsReady > 0) {
    return {
      value: 'Analytics available',
      valueAr: 'التحليلات متاحة',
      severity: 'good',
      loopComplete: true,
    }
  }
  if (s.manuallyPublished > 0 || s.published > 0) {
    return {
      value: 'Analytics pending',
      valueAr: 'التحليلات قيد الانتظار',
      severity: 'watch',
      loopComplete: false,
    }
  }
  return {
    value: 'Pending until analytics',
    valueAr: 'بانتظار التحليلات',
    severity: 'watch',
    loopComplete: false,
  }
}

